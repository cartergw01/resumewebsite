"""Model and render the Writing page's bookshop, from the islands' own kit.

blender -b --factory-startup --python scripts/blender/build_bookshop.py -- \
  --output .blender-build/bookshop --width 2880 --samples 96 --device METAL

A small bookshop at night on a floating plot, cut away like the study on the
home page so the back and side walls show. Everything in it is Carter's:
the essays stand face out on the lit shelf, the yearly reading lists lie in
stacks on the table, the corkboard holds his notes (the tweets), and the mail
slot in the door is the newsletter. The rest of the shelves are anonymous
books with no titles, so nothing on show is invented.

Writes bookshop.png (the whole shop), one sharper close-up per area rendered
by the same camera at a larger size and cropped to that area (so the page can
zoom into the still and the close-up lines up exactly), and bookshop.json
with every clickable thing's corners projected into a 1200x800 frame.
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
import build_islands as B  # noqa: E402  (Blender adds this folder late)

ROOT = Path(__file__).resolve().parents[2]
CONTENT = json.loads((ROOT / '.blender-build' / 'bookshop-content.json').read_text())
ANCHORS = {}
# Areas the page zooms into: each is the objects whose corners frame it.
AREAS = {'essays': [], 'reading': [], 'notes': [], 'letters': []}
TOP = 4.2          # wall height (2 units a metre, like the study)
BACK = 1.94        # the back wall's inside face
SIDE = -3.24       # the side wall's inside face


def rgb(text):
    """'r g b' from content (sRGB 0-255) to a linear Blender colour."""
    def lin(c):
        c /= 255
        return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
    return tuple(lin(float(v)) for v in text.split())


def keep(area, key, corners):
    """Record a clickable face (top-left, top-right, bottom-left, bottom-right)."""
    ANCHORS[key] = corners
    AREAS[area].extend(corners)


def plate(name, source, centre, width, height, facing='front', position=(.5, .5)):
    """A printed cover image, cropped to its plate like CSS object-fit: cover."""
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
    if facing == 'front':   # upright, facing the room (-y)
        verts = [(x - width/2, y, z - height/2), (x + width/2, y, z - height/2), (x + width/2, y, z + height/2), (x - width/2, y, z + height/2)]
    else:                   # lying face up; the top edge toward the back
        verts = [(x - width/2, y - height/2, z), (x + width/2, y - height/2, z), (x + width/2, y + height/2, z), (x - width/2, y + height/2, z)]
    obj = B.mesh(name, verts, [(0, 1, 2, 3)], mat)
    uv = obj.data.uv_layers.new(name='Cover')
    for loop, (a, b) in zip(uv.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop.uv = (u0 + a * su, v0 + b * sv)
    return obj, [verts[3], verts[2], verts[0], verts[1]]


def words(name, body, loc, size, mat, rotation=(math.pi / 2, 0, 0), width=None, font=None):
    data = bpy.data.curves.new(name, 'FONT'); data.body = body; data.size = size; data.extrude = .0004
    data.align_x = 'CENTER'; data.align_y = 'CENTER'; data.space_line = 1.05
    if width: data.text_boxes[0].width = width; data.text_boxes[0].x = -width / 2
    if font: data.font = font
    obj = bpy.data.objects.new(name, data); bpy.context.collection.objects.link(obj)
    obj.location = loc; obj.rotation_euler = rotation; data.materials.append(B.P[mat] if isinstance(mat, str) else mat)
    return obj


def serif():
    for path in ['/System/Library/Fonts/Supplemental/Georgia.ttf', '/Library/Fonts/Georgia.ttf', '/System/Library/Fonts/NewYork.ttf']:
        if Path(path).exists(): return bpy.data.fonts.load(path)
    return None


def anonymous_book(x, y, z, width, height, mat, depth=.34):
    """A shelf book with no title: page block, boards, spine and tooling."""
    B.box('Shelf book · page block', (x, y, z + height/2), (width - .02, depth - .025, height - .028), 'paper', .003)
    B.box('Shelf book · spine', (x, y - depth/2, z + height/2), (width, .026, height), mat, .009)
    for zz in [z + .05, z + height - .06]:
        B.box('Shelf book · gilt band', (x, y - depth/2 - .014, zz), (width * .8, .003, .006), 'brass', .001)


def shelf_run(x0, x1, y, z, rng, low=.40, high=.78):
    x = x0
    while x < x1 - .07:
        roll = rng.random()
        if roll < .03: x += .12; continue
        w = rng.uniform(.05, .105); h = rng.uniform(low, high)
        if x + w > x1: break
        anonymous_book(x + w/2, y + rng.uniform(-.02, .02), z, w, h, rng.choice(['linen', 'leather', 'redcloth', 'teal', 'oak', 'linen']))
        x += w + .009


def walls(font):
    B.P['shopwall'] = B.textured('Bookshop · warm limewash', (.36, .30, .23), (.47, .40, .31), 'plaster', rough=.9)
    B.P['shopgreen'] = B.textured('Bookshop · bottle green joinery', (.018, .045, .034), (.036, .075, .056), 'plaster', rough=.55)
    # The back wall carries the bookcase; the side wall has the window, the
    # corkboard and the door, cut out of it.
    B.box('Bookshop · back wall', (-.0, 2.0, TOP/2 + .08), (6.72, .12, TOP - .16), 'shopwall', .004)
    def side(y0, y1, z0, z1):
        B.box('Bookshop · side wall', (SIDE - .06, (y0 + y1)/2, (z0 + z1)/2), (.12, y1 - y0, z1 - z0), 'shopwall', .004)
    window = (-.05, 1.10, 1.55, 3.30)   # y0, y1, z0, z1
    door = (-1.80, -.86, .16, 3.20)
    side(-1.98, door[0], .16, TOP)
    side(door[1], window[0], .16, TOP)
    side(window[1], 2.06, .16, TOP)
    side(door[0], door[1], door[3], TOP)
    side(window[0], window[1], .16, window[2])
    side(window[0], window[1], window[3], TOP)
    for name, loc, size in [('Bookshop · back crown', (0, 1.91, TOP - .04), (6.72, .07, .09)),
                            ('Bookshop · side crown', (SIDE + .03, 0, TOP - .04), (.07, 3.96, .09)),
                            ('Bookshop · back wall top', (0, 2.0, TOP + .015), (6.78, .14, .03)),
                            ('Bookshop · side wall top', (SIDE - .06, .04, TOP + .015), (.14, 4.06, .03))]:
        B.box(name, loc, size, 'paper', .004)
    B.box('Bookshop · skirting', (SIDE + .015, 0, .22), (.03, 3.96, .10), 'shopgreen', .002)
    # The window: clear glass, so the night beyond is the site's own sky.
    B.P['clearwindow'] = B.material('Bookshop window · clear glass', (.9, .95, 1), rough=.04)
    B.P['clearwindow'].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = .03
    y0, y1, z0, z1 = window
    B.box('Bookshop window · glass', (SIDE - .06, (y0 + y1)/2, (z0 + z1)/2), (.011, y1 - y0, z1 - z0), 'clearwindow', .001)
    for yy in [y0, (y0 + y1)/2, y1]: B.box('Bookshop window · mullion', (SIDE - .02, yy, (z0 + z1)/2), (.05, .035, z1 - z0), 'shopgreen', .002)
    for zz in [z0, (z0 + z1)/2 + .15, z1]: B.box('Bookshop window · rail', (SIDE - .02, (y0 + y1)/2, zz), (.05, y1 - y0, .035), 'shopgreen', .002)
    # A window seat with a linen cushion, under the window.
    B.box('Window seat · bench', (SIDE + .26, (y0 + y1)/2, .78), (.52, y1 - y0 + .1, .08), 'shopgreen', .004)
    B.box('Window seat · front panel', (SIDE + .50, (y0 + y1)/2, .47), (.04, y1 - y0 + .1, .60), 'shopgreen', .003)
    B.box('Window seat · cushion', (SIDE + .26, (y0 + y1)/2, .87), (.46, y1 - y0, .10), 'linen', .03)
    return door


def front_door(door):
    """A green shop door, seen from inside: glazed above, panelled below, with
    a brass letter plate and a wire basket catching the post beneath it."""
    y0, y1, z0, z1 = door
    cy, w = (y0 + y1)/2, y1 - y0
    x = SIDE - .03
    for yy in [y0 + .04, y1 - .04]: B.box('Shop door · stile', (x, yy, (z0 + z1)/2), (.08, .08, z1 - z0), 'shopgreen', .004)
    for zz, h in [(z0 + .06, .12), (2.02, .10), (z1 - .05, .10)]: B.box('Shop door · rail', (x, cy, zz), (.08, w, h), 'shopgreen', .004)
    B.box('Shop door · lower panel', (x, cy, (z0 + 2.02)/2), (.05, w - .1, 1.80), 'shopgreen', .006)
    for zz in [.75, 1.45]:
        for a, b in [((-1, zz - .28), (1, zz - .28)), ((-1, zz + .28), (1, zz + .28))]:
            B.box('Shop door · panel moulding', (x + .03, cy, zz + (a[1] - zz)), (.014, w - .22, .016), 'shopgreen', .002)
    B.box('Shop door · glazing', (x, cy, 2.62), (.012, w - .1, 1.04), 'clearwindow', .001)
    B.rod('Shop door · glazing bar', (x + .01, cy, 2.07), (x + .01, cy, 3.15), .012, 'shopgreen')
    # The letter plate sits in the lock rail, at hand height.
    slot = (x + .045, cy, 1.80)
    B.box('Letter plate · brass', slot, (.012, .42, .11), 'brass', .004)
    B.box('Letter plate · slot', (slot[0] + .007, cy, 1.79), (.004, .32, .022), 'ink', .001)
    B.box('Shop door · brass kick plate', (x + .03, cy, .30), (.01, w - .08, .22), 'brass', .002)
    B.cylinder('Shop door · knob', (x + .09, y1 - .13, 1.42), .045, .06, 'brass', 24, bevel=.01).rotation_euler.y = math.pi/2
    # The wire basket under the slot holds two letters.
    bx = x + .20
    for zz in [1.36, 1.62]:
        for a, b in [((bx - .15, cy - .22), (bx + .15, cy - .22)), ((bx - .15, cy + .22), (bx + .15, cy + .22)), ((bx + .15, cy - .22), (bx + .15, cy + .22))]:
            B.rod('Letter basket · wire', (a[0], a[1], zz), (b[0], b[1], zz), .006, 'brass', 8)
    for yy in [cy - .22, cy + .22]:
        for xx in [bx - .15, bx + .15]: B.rod('Letter basket · wire', (xx, yy, 1.36), (xx, yy, 1.62), .006, 'brass', 8)
    for i, (dy, tilt) in enumerate([(-.04, .10), (.05, -.06)]):
        letter = B.box('Letter · envelope', (bx - .02 + i * .03, cy + dy, 1.52), (.012, .30, .20), 'paper', .002)
        letter.rotation_euler = (tilt, -.12 + i * .2, 0)
    corners = [Vector((x + .04, cy - .21, 1.855)), Vector((x + .04, cy + .21, 1.855)), Vector((x + .04, cy - .21, 1.745)), Vector((x + .04, cy + .21, 1.745))]
    keep('letters', 'slot', [tuple(c) for c in corners])
    # Frame the whole door when zooming in on it.
    AREAS['letters'].extend([(x, y0, 2.45), (x, y1, 2.45), (x, y0, 1.05), (x, y1, 1.05), (bx + .2, cy, 1.3)])


def bookcase(font):
    """Wall-to-wall shelves: Carter's essays face out in the lit middle bay,
    anonymous books packed into the bays either side."""
    rng = random.Random(1717)
    y = 1.60
    B.P['shelf_panel'] = B.material('Bookcase · dark back panel', (.03, .026, .022), rough=.8)
    B.P['led_strip'] = B.material('Bookcase · LED strip', (1, .74, .48), emission=9)
    B.box('Bookcase · back panel', (0, 1.885, 1.95), (6.40, .02, 3.55), 'shelf_panel', .002)
    uprights = [-3.18, -1.86, 1.86, 3.18]
    for x in uprights: B.box('Bookcase · upright', (x, y, 1.90), (.05, .55, 3.50), 'shopgreen', .003)
    rows = [.20, 1.32, 2.44, 3.56]
    for z in rows:
        B.box('Bookcase · shelf', (0, y, z), (6.42, .56, .05), 'wood', .003)
        B.box('Bookcase · shelf lip', (0, y - .29, z + .03), (6.42, .02, .06), 'shopgreen', .002)
    # Side bays: three rows of books, the bottom one a little taller.
    for x0, x1 in [(uprights[0] + .04, uprights[1] - .04), (uprights[2] + .04, uprights[3] - .04)]:
        for z in rows[:3]: shelf_run(x0, x1, y, z + .028, rng)
    # Middle bay, bottom row: more anonymous books.
    shelf_run(uprights[1] + .04, uprights[2] - .04, y, rows[0] + .028, rng)
    # The essays, newest first, four to a shelf, each a cloth-bound book in
    # its own colours with its real cover as a tipped-in plate and its title
    # stamped beneath it. They stand on the two lit shelves.
    serif_font = font
    essays = CONTENT['essays']
    per_row = math.ceil(len(essays) / 2)
    width, height, gap = .58, .82, .26
    for i, essay in enumerate(essays):
        row, col = divmod(i, per_row)
        count = min(per_row, len(essays) - row * per_row)
        x = (col - (count - 1)/2) * (width + gap)
        z0 = rows[2 - row] + .028
        cloth = B.material('Essay · ' + essay['title'] + ' cloth', rgb(essay['spine']['bottom']), rough=.8)
        accent = B.material('Essay · ' + essay['title'] + ' foil', rgb(essay['spine']['accent']), metal=.6, rough=.4)
        # Standing face out, leaning back a few degrees against a book rest.
        face = 1.47
        B.box('Essay · page block', (x, face + .055, z0 + height/2), (width - .03, .10, height - .03), 'paper', .003)
        B.box('Essay · front board', (x, face, z0 + height/2), (width, .016, height), cloth, .006)
        B.box('Essay · back board', (x, face + .11, z0 + height/2), (width, .016, height), cloth, .006)
        B.box('Essay · spine', (x - width/2, face + .055, z0 + height/2), (.02, .12, height), cloth, .006)
        image_w = width - .10
        _, corners = plate('Essay cover · ' + essay['title'], essay['image'], (x, face - .0095, z0 + height - .06 - .30), image_w, .54, 'front', essay['position'])
        B.box('Essay · plate rule', (x, face - .009, z0 + height - .06 - .30 - .29), (image_w, .002, .004), accent, 0)
        words('Essay title · ' + essay['title'], essay['title'], (x, face - .0095, z0 + .115), .043, accent, width=width - .06, font=serif_font)
        whole = [(x - width/2, face, z0 + height), (x + width/2, face, z0 + height), (x - width/2, face, z0), (x + width/2, face, z0)]
        keep('essays', 'essay:' + essay['slug'], whole)
        B.box('Essay · book rest', (x, face + .16, z0 + .05), (width * .5, .04, .10), 'shopgreen', .003)
    # A warm strip under each lit shelf and a small brass picture light.
    for z in rows[1:3]:
        top = z + 1.12 - .03
        B.box('Bookcase · LED strip', (0, 1.36, top - .028), (3.6, .016, .006), 'led_strip', 0)
        for bx in [-1.2, 0, 1.2]: B.light('Bookcase · essay wash', (bx, 1.30, top - .06), (1, .74, .48), 22, .05, (bx, 1.45, top - .9))
    # The publication's name, in brass letters on the wall over the shelves.
    words('Bookshop · flying Arrows', 'flying Arrows', (0, BACK - .01, 3.86), .28, 'brass', font=serif_font)
    B.light('Bookshop · sign light', (0, 1.2, 4.35), B.WARM, 45, .2, (0, BACK, 3.86))


def reading_table(font):
    """An oak table in the middle of the shop, with the yearly reading lists
    in three stacks, each topped by that list's own cover."""
    tx, ty, top = .45, -.62, 1.50
    for x in [tx - 1.05, tx + 1.05]:
        for y in [ty - .46, ty + .46]: B.box('Reading table · leg', (x, y, (top + .16)/2), (.07, .07, top - .16), 'oak', .004)
    B.box('Reading table · apron', (tx, ty, top - .09), (2.10, .92, .10), 'oak', .003)
    for i in range(4): B.sawn_ends(B.box('Reading table · oak top', (tx, ty - .375 + i * .25, top), (2.30, .245, .055), 'oak', .004))
    lists = CONTENT['readingLists']
    rng = random.Random(23)
    surface = top + .028
    for i, item in enumerate(sorted(lists, key=lambda l: l['year'])):
        x = tx - .72 + i * .72; y = ty + .02
        z = surface
        twist = rng.uniform(-.06, .06)
        for j, mat in enumerate(['linen', 'redcloth', 'leather']):
            w, d, h = .50 - j * .02, .64 - j * .02, .07 + j * .01
            book = B.box('Reading stack · book', (x, y, z + h/2), (w, d, h), mat, .008, twist + rng.uniform(-.05, .05))
            B.box('Reading stack · page edge', (x + .004, y, z + h/2), (w - .03, d + .004, h - .02), 'paper', .002, book.rotation_euler.z)
            z += h
        # The list itself on top: a slim book with its cover face up.
        cloth = B.material('Reading list ' + item['year'] + ' · cloth', rgb(item['spine']['bottom']), rough=.8)
        B.box('Reading list · book', (x, y, z + .03), (.48, .62, .06), cloth, .008)
        _, corners = plate('Reading list cover · ' + item['year'], item['image'], (x, y + .03, z + .0605), .42, .42, 'up', item['position'])
        words('Reading list year · ' + item['year'], item['year'], (x, y - .25, z + .0606), .05, 'paper', rotation=(0, 0, 0), font=font)
        keep('reading', 'reading:' + item['slug'], [(x - .24, y + .31, z + .06), (x + .24, y + .31, z + .06), (x - .24, y - .31, z + .06), (x + .24, y - .31, z + .06)])
        AREAS['reading'].append((x, y, surface))
    # The table lamp at its far end lights the covers.
    B.arundel_table_lamp(tx + 1.0, ty + .33, top + .028, 360, k=.9, toward=(tx, ty))
    AREAS['reading'].append((tx + 1.0, ty + .33, top + .9))


def corkboard():
    """Carter's notes, pinned up on the strip of wall between the door and the
    window: plain cards with pencilled lines, no words of their own."""
    B.P['cork'] = B.textured('Corkboard · pressed cork', (.20, .12, .06), (.36, .24, .13), 'soil', rough=.98)
    cy, cz = -.46, 2.30
    x = SIDE + .02
    B.box('Corkboard · frame', (x, cy, cz), (.04, .74, .96), 'oak', .006)
    B.box('Corkboard · cork', (x + .022, cy, cz), (.01, .66, .88), 'cork', .002)
    rng = random.Random(77)
    cards = [(-.17, .27), (.15, .30), (-.14, .02), (.17, .04), (-.16, -.25), (.14, -.24)]
    for i, (dy, dz) in enumerate(cards):
        card = B.box('Note card', (x + .032, cy + dy, cz + dz), (.004, .25, .19), 'paper', .001)
        tilt = rng.uniform(-.09, .09); card.rotation_euler.x = tilt
        for k in range(3):
            line = B.box('Note card · pencil line', (x + .0355, cy + dy, cz + dz + .05 - k * .045), (.002, .17 - k * .03, .006), 'page', 0)
            line.rotation_euler.x = tilt
        B.sphere('Note card · pin', (x + .04, cy + dy, cz + dz + .07), (.014, .014, .014), B.material('Pin · red', (.45, .05, .04), rough=.4) if i % 2 else 'brass')
    keep('notes', 'notes', [(x + .03, cy - .33, cz + .44), (x + .03, cy + .33, cz + .44), (x + .03, cy - .33, cz - .44), (x + .03, cy + .33, cz - .44)])
    # A slim brass picture light over the board lights it.
    B.rod('Corkboard · picture light arm', (x + .01, cy, cz + .50), (x + .16, cy, cz + .58), .009, 'brass')
    B.rod('Corkboard · picture light shade', (x + .17, cy - .22, cz + .58), (x + .17, cy + .22, cz + .58), .032, 'brass', 24)
    B.box('Corkboard · picture light lens', (x + .17, cy, cz + .548), (.03, .40, .004), 'light', 0)
    B.light('Corkboard · picture light', (x + .2, cy, cz + .52), B.WARM, 30, .08, (x, cy, cz - .1))


def reading_corner():
    B.eames_lounge_chair(2.55, -1.15, -35, .8)
    B.cylinder('Side table · top', (1.75, -1.55, .92), .22, .04, 'wood', 40, bevel=.006)
    B.rod('Side table · stem', (1.75, -1.55, .16), (1.75, -1.55, .90), .025, 'ink', 16)
    B.cylinder('Side table · foot', (1.75, -1.55, .18), .16, .03, 'ink', 40, bevel=.004)
    B.eave_table_lamp(1.75, -1.55, .94, 220, k=.75)
    B.plant(2.85, .80, .15, 1.0)
    B.plant(-2.65, -1.55, .15, .85)


def build(font):
    B.foundation(41, 'garden'); B.landscape('bookshop', 41); B.floorboards()
    door = walls(font)
    front_door(door)
    bookcase(font)
    reading_table(font)
    corkboard()
    reading_corner()
    B.light('Bookshop · warm room fill', (0, -.4, 3.9), B.WARM, 40, 2.5, (0, 0, 0))


def projected(scene, point):
    return B.projected(scene, point)


def frame(scene, direction=(7.6, -16, 10.4), margin=.06):
    """Look from a little further round than the islands do, so the door wall
    reads, and fit the shop to the frame by its actual vertices (bounding
    boxes of the scattered grass overshoot)."""
    from bpy_extras.object_utils import world_to_camera_view
    camera = scene.camera
    direction = Vector(direction).normalized()
    camera.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    camera.location = Vector((0, 0, .6)) + direction * 34
    depsgraph = bpy.context.evaluated_depsgraph_get()
    points = []
    for obj in scene.objects:
        if obj.type != 'MESH' or 'haze' in obj.name.lower(): continue
        data = obj.evaluated_get(depsgraph).to_mesh()
        step = max(1, len(data.vertices) // 400)
        points.extend(obj.matrix_world @ data.vertices[i].co for i in range(0, len(data.vertices), step))
        obj.evaluated_get(depsgraph).to_mesh_clear()
    data = camera.data
    data.shift_x = data.shift_y = 0
    for _ in range(4):
        bpy.context.view_layer.update()
        view = [world_to_camera_view(scene, camera, p) for p in points]
        left, right = min(v.x for v in view), max(v.x for v in view)
        bottom, top = min(v.y for v in view), max(v.y for v in view)
        factor = min((1 - 2 * margin) / (right - left), (1 - 2 * margin) / (top - bottom))
        # Shift is in units of the frame's width; y is scaled by the aspect.
        data.shift_x += ((left + right) / 2 - .5)
        data.shift_y += ((bottom + top) / 2 - .5) * 2/3
        data.lens *= factor
        data.shift_x *= factor; data.shift_y *= factor
    bpy.context.view_layer.update()


def export(scene, path):
    result = {'width': 1200, 'height': 800}
    for key, value in ANCHORS.items(): result[key] = [projected(scene, v) for v in value]
    boxes = {}
    for area, points in AREAS.items():
        xy = [projected(scene, p) for p in points]
        xs = [p[0] for p in xy]; ys = [p[1] for p in xy]
        boxes[area] = [round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)]
    result['areas'] = boxes
    path.write_text(json.dumps(result, indent=2) + '\n')
    return boxes


def render_closeups(scene, boxes, output, width, scale):
    """Each area again, by the same camera at `scale` times the size, cropped
    to the area padded to the page's zoom frame (3:2) so nothing needs
    stretching to line up."""
    scene.render.use_border = True; scene.render.use_crop_to_border = True
    scene.render.resolution_x = width * scale; scene.render.resolution_y = round(width * 2/3) * scale
    crops = {}
    for area, (x0, y0, x1, y1) in boxes.items():
        cx, cy = (x0 + x1)/2, (y0 + y1)/2
        w, h = (x1 - x0) * 1.35, (y1 - y0) * 1.35
        # Never closer than about 3.6x: past that the shop stops reading as a place.
        w = max(w, h * 1.5, 330); h = w / 1.5
        left, right = max(0, cx - w/2), min(1200, cx + w/2)
        top, bottom = max(0, cy - h/2), min(800, cy + h/2)
        scene.render.border_min_x = left / 1200; scene.render.border_max_x = right / 1200
        scene.render.border_min_y = 1 - bottom / 800; scene.render.border_max_y = 1 - top / 800
        scene.render.filepath = str(output / f'bookshop-{area}.png')
        bpy.ops.render.render(write_still=True)
        crops[area] = [round(left, 2), round(top, 2), round(right, 2), round(bottom, 2)]
        print(f'CLOSEUP {area} {crops[area]}', flush=True)
    scene.render.use_border = False
    return crops


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / '.blender-build' / 'bookshop')
    parser.add_argument('--width', type=int, default=1440)
    parser.add_argument('--samples', type=int, default=32)
    parser.add_argument('--closeup-scale', type=int, default=3)
    parser.add_argument('--device', choices=['CPU', 'METAL'], default='METAL')
    parser.add_argument('--no-closeups', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    args.output.mkdir(parents=True, exist_ok=True)
    scene = B.setup('bookshop', args.width, args.samples, 'CYCLES', args.device)
    font = serif()
    build(font)
    scene.frame_set(1)
    B.camera_and_lights(scene)
    frame(scene)
    B.unseen_lights(scene)
    boxes = export(scene, args.output / 'bookshop.json')
    scene.render.filepath = str(args.output / 'bookshop.png')
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'artwork' / 'blender' / 'bookshop.blend'), compress=True)
    bpy.ops.render.render(write_still=True)
    print('COMPLETED bookshop', flush=True)
    if not args.no_closeups:
        crops = render_closeups(scene, boxes, args.output, args.width, args.closeup_scale)
        data = json.loads((args.output / 'bookshop.json').read_text())
        data['crops'] = crops
        (args.output / 'bookshop.json').write_text(json.dumps(data, indent=2) + '\n')


if __name__ == '__main__':
    main()
