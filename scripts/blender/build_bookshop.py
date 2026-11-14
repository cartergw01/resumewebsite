"""Model and render the Writing page's walk-along bookshop.

node scripts/blender/bookshop_content.mjs
blender -b --factory-startup --python scripts/blender/build_bookshop.py -- \
  --output .blender-build/bookshop --ppu 300 --samples 64

One long, narrow bookshop seen straight on, like a doll's house with its
front taken off, which the page walks you along. The shelf is a timeline:
the door (the newsletter's letter slot) first, then a bay of shelves per
year from Carter's first essay to his latest, each essay face out at eye
height under a brass year plate, each year's reading list propped on a
table in front of its bay, and the corkboard of notes (the tweets) by the
window at the far end. The other books have no titles, so nothing on show
is invented.

It renders in two passes from one level orthographic camera:
  bookshop-back.png  the room itself, foreground furniture left out
  bookshop-fore.png  the foreground furniture alone on transparency, with
                     its shadows on the floor, so the page can move it a
                     little faster than the wall as you walk (parallax)
and bookshop.json: every clickable thing's rectangle in the panorama's
pixels, the year bays, and the foreground pieces' rectangles.
"""
import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).parent))
import build_islands as B  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CONTENT = json.loads((ROOT / '.blender-build' / 'bookshop-content.json').read_text())
TOP = 4.3            # wall height, 2 units a metre like the islands
BACK = 1.0           # the back wall's face
SHELF_Y = BACK - .30 # shelf centre line
FORE_Y = -1.15       # where the foreground furniture stands
FLOOR_FRONT = -6.0
ROWS = [.20, 1.28, 2.36, 3.44]   # shelf heights; the essays stand on 1.28
ITEMS = {}           # key -> world corners (top-left, top-right, bottom-left, bottom-right)
BAYS = []            # (year, x0, x1)
FORE = {}            # foreground piece -> its objects
WARM = B.WARM


def rgb(text):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
    return tuple(lin(float(v)) for v in text.split())


def serif():
    for path in ['/System/Library/Fonts/Supplemental/Georgia.ttf', '/Library/Fonts/Georgia.ttf']:
        if Path(path).exists(): return bpy.data.fonts.load(path)
    return None


def words(name, body, loc, size, mat, width=None, font=None):
    data = bpy.data.curves.new(name, 'FONT'); data.body = body; data.size = size; data.extrude = .0004
    data.align_x = 'CENTER'; data.align_y = 'CENTER'; data.space_line = 1.05
    if width: data.text_boxes[0].width = width; data.text_boxes[0].x = -width / 2
    if font: data.font = font
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj)
    obj.location = loc; obj.rotation_euler = (math.pi / 2, 0, 0)
    data.materials.append(B.P[mat] if isinstance(mat, str) else mat)
    return obj


def plate(name, source, centre, width, height, position=(.5, .5)):
    """A printed cover, upright and facing the room, cropped like object-fit: cover."""
    image = bpy.data.images.load(str(ROOT / 'public' / source), check_existing=True)
    if not image.packed_file: image.pack()
    mat = B.material(name + ' · print', (.8, .8, .8), rough=.55)
    nodes = mat.node_tree.nodes
    tex = nodes.new('ShaderNodeTexImage'); tex.image = image; tex.extension = 'CLIP'
    mat.node_tree.links.new(tex.outputs['Color'], nodes['Principled BSDF'].inputs['Base Color'])
    w, h = image.size
    aspect, want = w / h, width / height
    su, sv = (want / aspect, 1) if aspect > want else (1, aspect / want)
    u0 = (1 - su) * position[0]; v0 = (1 - sv) * (1 - position[1])
    x, y, z = centre
    verts = [(x - width/2, y, z - height/2), (x + width/2, y, z - height/2), (x + width/2, y, z + height/2), (x - width/2, y, z + height/2)]
    obj = B.mesh(name, verts, [(0, 1, 2, 3)], mat)
    uv = obj.data.uv_layers.new(name='Cover')
    for loop, (a, b) in zip(uv.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop.uv = (u0 + a * su, v0 + b * sv)
    return obj


def face(key, x, y, z0, width, height):
    ITEMS[key] = [(x - width/2, y, z0 + height), (x + width/2, y, z0 + height), (x - width/2, y, z0), (x + width/2, y, z0)]


def anonymous_book(x, y, z, width, height, mat, depth=.34):
    B.box('Shelf book · page block', (x, y, z + height/2), (width - .02, depth - .025, height - .028), 'paper', .003)
    B.box('Shelf book · spine', (x, y - depth/2, z + height/2), (width, .026, height), mat, .009)
    for zz in [z + .05, z + height - .06]:
        B.box('Shelf book · gilt band', (x, y - depth/2 - .014, zz), (width * .8, .003, .006), 'brass', .001)


def shelf_run(x0, x1, z, rng, low=.42, high=.86):
    x = x0
    while x < x1 - .07:
        if rng.random() < .04: x += .10; continue
        w = rng.uniform(.05, .10); h = rng.uniform(low, high)
        if x + w > x1: break
        if rng.random() < .05 and x + .34 < x1:
            # Now and then a short stack lying flat.
            for j in range(rng.randint(2, 4)):
                B.box('Shelf book · lying flat', (x + .16, SHELF_Y, z + .04 + j * .075), (.32, .30, .07), rng.choice(['linen', 'leather', 'redcloth', 'teal']), .006)
            x += .36; continue
        anonymous_book(x + w/2, SHELF_Y + rng.uniform(-.015, .015), z, w, h, rng.choice(['linen', 'leather', 'redcloth', 'teal', 'oak', 'linen']))
        x += w + .008


def materials():
    B.P['shopwall'] = B.textured('Bookshop · warm limewash', (.34, .29, .22), (.45, .39, .30), 'plaster', rough=.9)
    B.P['shopgreen'] = B.textured('Bookshop · bottle green joinery', (.018, .045, .034), (.036, .075, .056), 'plaster', rough=.55)
    B.P['shelf_panel'] = B.material('Bookcase · dark back panel', (.03, .026, .022), rough=.8)
    B.P['led_strip'] = B.material('Bookcase · LED strip', (1, .74, .48), emission=9)
    B.P['clearwindow'] = B.material('Bookshop window · clear glass', (.9, .95, 1), rough=.04)
    B.P['clearwindow'].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = 0
    B.P['cork'] = B.textured('Corkboard · pressed cork', (.20, .12, .06), (.36, .24, .13), 'soil', rough=.98)
    B.P['gilt'] = B.material('Window · gilt lettering', (.62, .44, .16), metal=.9, rough=.3)


def wall(xa, xb, za, zb):
    B.box('Bookshop · back wall', ((xa + xb) / 2, BACK + .06, (za + zb) / 2), (xb - xa, .14, zb - za), 'shopwall', .004)


def room(length):
    """Floor, ceiling, crown and skirting along the whole shop."""
    # Boards run along the shop, so the walk follows the grain.
    y = FLOOR_FRONT
    while y < BACK:
        B.sawn_ends(B.box('Floor · oak plank', (length / 2, y + .15, .10), (length + .6, .289, .095), 'floorwood', .003), 'X')
        y += .30
    B.box('Bookshop · crown', (length / 2, BACK - .03, TOP - .05), (length + .6, .07, .10), 'paper', .004)
    # Only over the back of the shop: any nearer and the tipped camera sees it.
    B.box('Bookshop · ceiling', (length / 2, BACK - .7, TOP + .05), (length + .6, 1.6, .10), 'shopwall', .002)
    B.box('Bookshop · skirting', (length / 2, BACK - .015, .22), (length + .6, .03, .10), 'shopgreen', .002)


def entrance(x0, font):
    """The shop door with its letter plate, and the shop window beside it with
    the publication's name in gilt on the glass."""
    door_x, w, h = x0 + 1.0, 1.0, 3.0
    xd0, xd1 = door_x - w / 2, door_x + w / 2
    for xx in [xd0 + .04, xd1 - .04]: B.box('Shop door · stile', (xx, BACK, .16 + h / 2), (.08, .08, h), 'shopgreen', .004)
    for zz, hh in [(.22, .12), (2.02, .10), (.16 + h - .05, .10)]: B.box('Shop door · rail', (door_x, BACK, zz), (w, .08, hh), 'shopgreen', .004)
    B.box('Shop door · lower panel', (door_x, BACK, 1.09), (w - .1, .05, 1.78), 'shopgreen', .006)
    for zz in [.72, 1.46]: B.box('Shop door · panel moulding', (door_x, BACK - .03, zz), (w - .24, .014, .016), 'shopgreen', .002)
    B.box('Shop door · glazing', (door_x, BACK, 2.62), (w - .1, .012, 1.04), 'clearwindow', .001)
    B.rod('Shop door · glazing bar', (door_x, BACK - .01, 2.07), (door_x, BACK - .01, 3.14), .012, 'shopgreen')
    B.box('Shop door · frame head', (door_x, BACK, .16 + h + .06), (w + .16, .12, .12), 'shopgreen', .004)
    for xx in [xd0 - .04, xd1 + .04]: B.box('Shop door · frame', (xx, BACK, .16 + h / 2), (.08, .12, h + .1), 'shopgreen', .004)
    B.box('Letter plate · brass', (door_x, BACK - .045, 1.80), (.42, .012, .11), 'brass', .004)
    B.box('Letter plate · slot', (door_x, BACK - .052, 1.79), (.32, .004, .022), 'ink', .001)
    B.box('Shop door · kick plate', (door_x, BACK - .03, .30), (w - .08, .01, .22), 'brass', .002)
    B.sphere('Shop door · knob', (xd1 - .14, BACK - .07, 1.42), (.045, .045, .045), 'brass', 2)
    # The wire basket that catches the post, under the slot.
    by = BACK - .20
    for zz in [1.36, 1.62]:
        B.rod('Letter basket · wire', (door_x - .22, by - .15, zz), (door_x + .22, by - .15, zz), .006, 'brass', 8)
        B.rod('Letter basket · wire', (door_x - .22, by - .15, zz), (door_x - .22, by + .15, zz), .006, 'brass', 8)
        B.rod('Letter basket · wire', (door_x + .22, by - .15, zz), (door_x + .22, by + .15, zz), .006, 'brass', 8)
    for xx in [door_x - .22, door_x + .22]:
        B.rod('Letter basket · wire', (xx, by - .15, 1.36), (xx, by - .15, 1.62), .006, 'brass', 8)
    for i, dx in enumerate([-.06, .05]):
        letter = B.box('Letter · envelope', (door_x + dx, by, 1.52), (.30, .012, .20), 'paper', .002)
        letter.rotation_euler = (0, .10 - i * .2, .05)
    ITEMS['letters'] = [(door_x - .5, BACK, 2.0), (door_x + .5, BACK, 2.0), (door_x - .5, BACK, 1.25), (door_x + .5, BACK, 1.25)]
    # The shop window: clear glass, so the night beyond is the page's own sky,
    # with "flying Arrows" in gilt on it.
    wx0, wx1, wz0, wz1 = door_x + .80, door_x + 2.75, 1.05, 3.45
    B.box('Shop window · glass', ((wx0 + wx1) / 2, BACK + .02, (wz0 + wz1) / 2), (wx1 - wx0, .012, wz1 - wz0), 'clearwindow', .001)
    for xx in [wx0, wx1]: B.box('Shop window · frame', (xx, BACK, (wz0 + wz1) / 2), (.07, .10, wz1 - wz0 + .07), 'shopgreen', .003)
    for zz in [wz0, wz1, wz1 - .55]: B.box('Shop window · frame', ((wx0 + wx1) / 2, BACK, zz), (wx1 - wx0 + .07, .10, .07), 'shopgreen', .003)
    B.box('Shop window · sill', ((wx0 + wx1) / 2, BACK - .12, wz0 - .04), (wx1 - wx0 + .2, .26, .06), 'oak', .004)
    words('Shop window · flying Arrows', 'flying Arrows', ((wx0 + wx1) / 2, BACK - .005, wz1 - .28), .24, 'gilt', font=font)
    # Walls around the openings.
    end = x0 + 4.4
    wall(x0 - .3, xd0 - .08, .16, TOP); wall(xd1 + .08, wx0 - .035, .16, TOP)
    wall(xd0 - .08, xd1 + .08, .16 + h + .12, TOP)
    wall(wx0 - .035, wx1 + .035, .16, wz0 - .035); wall(wx0 - .035, wx1 + .035, wz1 + .035, TOP)
    wall(wx1 + .035, end, .16, TOP)
    B.up_down_sconce(end - .30, BACK - .02, 2.9, 80)
    return end


def bay(x0, year, essays, font, rng):
    """One year's bay of shelves: its essays face out on the lit eye-level shelf
    under a brass plate with the year, anonymous books on the rest."""
    slot = 1.15
    width = max(2.5, len(essays) * slot + .7)
    x1 = x0 + width
    wall(x0, x1, .16, TOP)
    B.box('Bookcase · back panel', ((x0 + x1) / 2, BACK - .02, 1.9), (width, .02, 3.5), 'shelf_panel', .002)
    for x in [x0, x1]: B.box('Bookcase · upright', (x, SHELF_Y, 1.86), (.06, .56, 3.40), 'shopgreen', .003)
    for z in ROWS:
        B.box('Bookcase · shelf', ((x0 + x1) / 2, SHELF_Y, z), (width, .56, .05), 'wood', .003)
        B.box('Bookcase · shelf lip', ((x0 + x1) / 2, SHELF_Y - .29, z + .03), (width, .02, .06), 'shopgreen', .002)
    for z in [ROWS[0], ROWS[2]]: shelf_run(x0 + .05, x1 - .05, z + .028, rng)
    shelf_run(x0 + .05, x1 - .05, ROWS[3] + .028, rng, .30, .52)
    # The year, on a brass plate on the top shelf's lip.
    B.box('Year plate · brass', ((x0 + x1) / 2, SHELF_Y - .31, ROWS[3] + .30), (.62, .012, .22), 'brass', .006)
    words('Year plate · ' + year, year, ((x0 + x1) / 2, SHELF_Y - .318, ROWS[3] + .30), .15, 'ink', font=font)
    if not essays: shelf_run(x0 + .05, x1 - .05, ROWS[1] + .028, rng)
    # The essays, face out, oldest on the left.
    z0 = ROWS[1] + .028
    bw, bh = .62, .86
    for i, essay in enumerate(essays):
        x = x0 + width / 2 + (i - (len(essays) - 1) / 2) * slot
        cloth = B.material('Essay · ' + essay['title'] + ' cloth', rgb(essay['spine']['bottom']), rough=.8)
        foil = B.material('Essay · ' + essay['title'] + ' foil', rgb(essay['spine']['accent']), metal=.6, rough=.4)
        fy = SHELF_Y - .12
        B.box('Essay · page block', (x, fy + .055, z0 + bh / 2), (bw - .03, .10, bh - .03), 'paper', .003)
        B.box('Essay · front board', (x, fy, z0 + bh / 2), (bw, .016, bh), cloth, .006)
        B.box('Essay · back board', (x, fy + .11, z0 + bh / 2), (bw, .016, bh), cloth, .006)
        plate('Essay cover · ' + essay['title'], essay['image'], (x, fy - .0095, z0 + bh - .06 - .29), bw - .10, .52, essay['position'])
        B.box('Essay · plate rule', (x, fy - .009, z0 + bh - .06 - .29 - .28), (bw - .10, .002, .004), foil, 0)
        words('Essay title · ' + essay['title'], essay['title'], (x, fy - .0095, z0 + .12), .044, foil, width=bw - .06, font=font)
        face('essay:' + essay['slug'], x, fy, z0, bw, bh)
        B.light('Essay · picture light', (x, SHELF_Y - .45, ROWS[2] - .06), WARM, 16, .05, (x, fy, z0 + .4))
    B.box('Bookcase · LED strip', ((x0 + x1) / 2, SHELF_Y - .26, ROWS[2] - .028), (width - .1, .016, .006), 'led_strip', 0)
    BAYS.append((year, x0, x1))
    return x1


def reading_table(name, x, item, font):
    """A small oak table in front of a bay, with a stack of books and that
    year's reading list propped on a stand on top, cover to the room. It's
    low, so from the front it sits over the bottom shelf and never covers the
    essays."""
    before = set(bpy.context.scene.objects)
    top = .74
    for dx in [-.62, .62]:
        for dy in [-.30, .30]: B.box('Reading table · leg', (x + dx, FORE_Y + dy, (top + .16) / 2), (.06, .06, top - .16), 'oak', .004)
    B.box('Reading table · apron', (x, FORE_Y, top - .08), (1.30, .66, .10), 'oak', .003)
    B.box('Reading table · top', (x, FORE_Y, top), (1.50, .80, .05), 'oak', .004)
    z = top + .025
    for j, mat in enumerate(['linen', 'redcloth', 'leather']):
        B.box('Reading stack · book', (x - .38, FORE_Y, z + .045), (.52 - j * .03, .44, .09), mat, .008)
        B.box('Reading stack · pages', (x - .38, FORE_Y - .004, z + .045), (.49 - j * .03, .44, .07), 'paper', .002)
        z += .09
    cloth = B.material('Reading list ' + item['year'] + ' · cloth', rgb(item['spine']['bottom']), rough=.8)
    bw, bh = .56, .66
    bx, by, bz = x + .26, FORE_Y - .02, top + .05
    B.box('Reading list · book stand', (bx, by + .08, bz + .20), (.40, .03, .40), 'wood', .004)
    B.box('Reading list · ledge', (bx, by - .05, bz + .02), (.60, .08, .04), 'wood', .004)
    B.box('Reading list · board', (bx, by, bz + bh / 2 + .02), (bw, .03, bh), cloth, .006)
    plate('Reading list cover · ' + item['year'], item['image'], (bx, by - .017, bz + bh / 2 + .08), bw - .08, bh - .20, item['position'])
    words('Reading list year · ' + item['year'], item['year'], (bx, by - .017, bz + .10), .055, 'paper', font=font)
    face('reading:' + item['slug'], bx, by, bz + .02, bw, bh)
    FORE[name] = set(bpy.context.scene.objects) - before


def foreground_plant(name, x, scale=1):
    before = set(bpy.context.scene.objects)
    B.plant(x, FORE_Y - .2, .15, scale)
    FORE[name] = set(bpy.context.scene.objects) - before


def nook(x0):
    """The far end: the corkboard of notes under a brass picture light, then a
    tall window onto the night with a window seat."""
    cx, cz = x0 + 1.0, 2.25
    wall(x0 - .1, x0 + 2.0, .16, TOP)
    B.box('Corkboard · frame', (cx, BACK - .02, cz), (1.10, .04, 1.30), 'oak', .006)
    B.box('Corkboard · cork', (cx, BACK - .042, cz), (1.00, .01, 1.20), 'cork', .002)
    rng = random.Random(77)
    pin = B.material('Pin · red', (.45, .05, .04), rough=.4)
    for i, (dx, dz) in enumerate([(-.26, .36), (.22, .40), (-.24, .02), (.25, .05), (-.22, -.33), (.21, -.30)]):
        tilt = rng.uniform(-.08, .08)
        card = B.box('Note card', (cx + dx, BACK - .052, cz + dz), (.34, .004, .25), 'paper', .001); card.rotation_euler.y = tilt
        for k in range(3):
            line = B.box('Note card · pencil line', (cx + dx, BACK - .0555, cz + dz + .06 - k * .055), (.24 - k * .04, .002, .007), 'page', 0)
            line.rotation_euler.y = tilt
        B.sphere('Note card · pin', (cx + dx, BACK - .062, cz + dz + .09), (.018, .018, .018), pin if i % 2 else 'brass')
    ITEMS['notes'] = [(cx - .55, BACK, cz + .65), (cx + .55, BACK, cz + .65), (cx - .55, BACK, cz - .65), (cx + .55, BACK, cz - .65)]
    B.rod('Corkboard · picture light arm', (cx, BACK - .02, cz + .78), (cx, BACK - .18, cz + .86), .009, 'brass')
    B.rod('Corkboard · picture light shade', (cx - .32, BACK - .19, cz + .86), (cx + .32, BACK - .19, cz + .86), .034, 'brass', 24)
    B.light('Corkboard · picture light', (cx, BACK - .26, cz + .80), WARM, 45, .08, (cx, BACK, cz - .1))
    wx0, wx1, wz0, wz1 = x0 + 2.0, x0 + 3.6, 1.10, 3.70
    B.box('Nook window · glass', ((wx0 + wx1) / 2, BACK + .02, (wz0 + wz1) / 2), (wx1 - wx0, .012, wz1 - wz0), 'clearwindow', .001)
    for xx in [wx0, (wx0 + wx1) / 2, wx1]: B.box('Nook window · mullion', (xx, BACK, (wz0 + wz1) / 2), (.05, .08, wz1 - wz0), 'shopgreen', .002)
    for zz in [wz0, (wz0 + wz1) / 2 + .2, wz1]: B.box('Nook window · rail', ((wx0 + wx1) / 2, BACK, zz), (wx1 - wx0, .08, .05), 'shopgreen', .002)
    B.box('Window seat · bench', ((wx0 + wx1) / 2, BACK - .30, .80), (wx1 - wx0 + .3, .56, .08), 'shopgreen', .004)
    B.box('Window seat · front', ((wx0 + wx1) / 2, BACK - .56, .48), (wx1 - wx0 + .3, .04, .62), 'shopgreen', .003)
    B.box('Window seat · cushion', ((wx0 + wx1) / 2, BACK - .30, .89), (wx1 - wx0 + .2, .50, .10), 'linen', .03)
    end = x0 + 4.6
    wall(wx1, end + .3, .16, TOP)
    wall(wx0, wx1, .16, wz0); wall(wx0, wx1, wz1, TOP)
    return end


def build(font):
    materials()
    rng = random.Random(1717)
    essays = sorted(CONTENT['essays'], key=lambda e: e['iso'])
    lists = {item['year']: item for item in CONTENT['readingLists']}
    years = sorted({e['iso'][:4] for e in essays} | set(lists))
    x = entrance(0, font)
    foreground_plant('plant:door', 3.85, 1.05)
    for year in years:
        x0 = x
        x = bay(x0, year, [e for e in essays if e['iso'][:4] == year], font, rng)
        if year in lists: reading_table('table:' + year, (x0 + x) / 2, lists[year], font)
        wall(x, x + .12, .16, TOP)
        x += .12
    x = nook(x)
    foreground_plant('plant:nook', x - 1.6, .95)
    room(x)
    # A warm wash along the shop, and the moon through the glass.
    for i in range(int(x / 2.4) + 2):
        B.light('Bookshop · warm fill', (i * 2.4, -1.6, 3.9), WARM, 40, 2.0, (i * 2.4, BACK, 1.6))
    moon = bpy.data.lights.new('Moon · through the glass', 'SUN')
    moon.color = (.70, .78, 1); moon.energy = .6; moon.angle = math.radians(2)
    key = bpy.data.objects.new('Moon · through the glass', moon); bpy.context.collection.objects.link(key)
    key.rotation_euler = Vector((.3, -1, -.5)).to_track_quat('-Z', 'Y').to_euler()
    return x


def camera(scene, length, ppu, pitch=6, bottom=-.45, top=4.12):
    """Level and straight on, tipped down a few degrees to show the floor."""
    data = bpy.data.cameras.new('Bookshop · straight on')
    data.type = 'ORTHO'; data.ortho_scale = length + .2
    cam = bpy.data.objects.new('Camera', data); bpy.context.collection.objects.link(cam)
    a = math.radians(pitch)
    cam.rotation_euler = (math.pi / 2 - a, 0, 0)
    mid = (bottom + top) / 2
    cam.location = (length / 2, -20 * math.cos(a), mid + 20 * math.sin(a))
    height = (top - bottom) * math.cos(a)
    scene.render.resolution_x = round((length + .2) * ppu)
    scene.render.resolution_y = round(height * ppu)
    scene.camera = cam
    bpy.context.view_layer.update()
    return cam


def projected(scene, point):
    from bpy_extras.object_utils import world_to_camera_view
    v = world_to_camera_view(scene, scene.camera, Vector(point))
    return [round(v.x * scene.render.resolution_x, 1), round((1 - v.y) * scene.render.resolution_y, 1)]


def rect(scene, points, pad=0):
    xy = [projected(scene, p) for p in points]
    xs = [p[0] for p in xy]; ys = [p[1] for p in xy]
    return [round(min(xs) - pad, 1), round(min(ys) - pad, 1), round(max(xs) + pad, 1), round(max(ys) + pad, 1)]


def bounds(objects):
    points = []
    for obj in objects:
        if obj.type in {'MESH', 'CURVE', 'FONT'}:
            points.extend(obj.matrix_world @ Vector(c) for c in obj.bound_box)
    return points


def export(scene, path):
    w, h = scene.render.resolution_x, scene.render.resolution_y
    result = {'width': w, 'height': h, 'items': {}, 'bays': [], 'fore': {}}
    for key, corners in ITEMS.items(): result['items'][key] = rect(scene, corners)
    for year, x0, x1 in BAYS:
        result['bays'].append({'year': year, 'x0': projected(scene, (x0, SHELF_Y, 1))[0], 'x1': projected(scene, (x1, SHELF_Y, 1))[0]})
    for name, objects in FORE.items():
        # Padded, most of all below, for the shadow the piece throws on the floor.
        l, t, r, b = rect(scene, bounds(objects), 8)
        result['fore'][name] = [max(0, round(l - 10)), max(0, round(t)), min(w, round(r + 10)), min(h, round(b + 4))]
        foot = Vector((0, 0, 0))
        for obj in objects: foot += obj.matrix_world.translation
        result.setdefault('feet', {})[name] = projected(scene, (foot.x / len(objects), FORE_Y, .15))[1]
    path.write_text(json.dumps(result, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / '.blender-build' / 'bookshop')
    parser.add_argument('--ppu', type=int, default=120, help='pixels per scene unit')
    parser.add_argument('--samples', type=int, default=24)
    parser.add_argument('--device', choices=['CPU', 'METAL'], default='METAL')
    parser.add_argument('--exposure', type=float, default=.95)
    parser.add_argument('--back-only', action='store_true')
    parser.add_argument('--fore-only', action='store_true', help='re-render only the furniture pass')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    args.output.mkdir(parents=True, exist_ok=True)
    scene = B.setup('bookshop', 1200, args.samples, 'CYCLES', args.device)
    scene.view_settings.exposure = args.exposure
    length = build(serif())
    camera(scene, length, args.ppu)
    B.unseen_lights(scene)
    export(scene, args.output / 'bookshop.json')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'artwork' / 'blender' / 'bookshop.blend'), compress=True)
    fore = set().union(*FORE.values())
    # The room, with the foreground furniture out of the picture entirely.
    for obj in fore: obj.hide_render = True
    scene.render.filepath = str(args.output / 'bookshop-back.png')
    if not args.fore_only:
        bpy.ops.render.render(write_still=True)
        print('COMPLETED back', flush=True)
    if args.back_only: return
    # The furniture alone: the room is held out (transparent) but still lights
    # and hides it; the floor only catches its shadows.
    for obj in fore: obj.hide_render = False
    for obj in scene.objects:
        if obj in fore or obj.type not in {'MESH', 'CURVE', 'FONT'}: continue
        # Held out, and casting nothing. The floor too: a shadow catcher brought
        # the floor's own shading with it, as a grey slab under each piece, so
        # the page draws a soft contact shadow at each piece's foot instead.
        obj.is_holdout = True
        obj.visible_shadow = False
        if 'haze' in obj.name: obj.hide_render = True
    scene.render.filepath = str(args.output / 'bookshop-fore.png')
    bpy.ops.render.render(write_still=True)
    print('COMPLETED fore', flush=True)


if __name__ == '__main__':
    main()
