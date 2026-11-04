"""The layers the browser needs to shoot the workshop's basketball.

The ball, net and court are baked into the island's still, so a live shot
needs them apart, from the same scene, camera and lighting:
- the court with the ball gone, and with only its shadow left (their
  difference is the shadow, which then follows the ball);
- the ball alone, turning once on the axis it rolls home on (24 frames; frame 0
  is the still's own pose, so the swap at each end of a shot is invisible);
- the hoop with no net, the net's back and front halves, and the rim's front.
The rim and front cords pass in front of the ball as it drops through.

build_islands.py --world projects --time hoop-shot[-dark], for a lit and dark
set; scripts/blender/export_hoop_shot.mjs crops and packs them for the site.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

FRAMES = 24
BALL = 'Basketball ·'
NET = ('Hoop · diamond net braid', 'Hoop · net attachment', 'Hoop · net bottom binding')
RIM = 'Hoop · orange rim'
# Regions in the published still's 1200×800 coordinates.
COURT_REGION = (795, 455, 120, 110)
BALL_REGION = (820, 468, 58, 58)
NET_REGION = (925, 222, 75, 68)


def render_layers(scene, output, root):
    crop = json.loads((root/'lib/island-cameras.json').read_text())['projects']['crop']
    scene.render.use_persistent_data = True
    scene.render.use_border = True
    scene.render.use_crop_to_border = False
    objects = list(scene.objects)
    ball = [o for o in objects if o.name.startswith(BALL)]
    rim = next(o for o in objects if o.name == RIM)
    net = [o for o in objects if o.name.startswith(NET)]
    rim_at = rim.matrix_world.translation
    centre = next(o for o in ball if o.name.startswith('Basketball · Wilson Evolution')).matrix_world.translation.copy()
    # Halves by each cord's side of the rim. The bottom binding is one ring, so
    # it goes with the front: a hairline, and the ball is past it in a blink.
    front = [o for o in net if o.name.startswith(NET[2]) or o.matrix_world.translation.y <= rim_at.y]
    back = [o for o in net if o not in front]

    def region(x, y, width, height):
        # The still is a crop of the render; Blender's border runs bottom-up.
        left = (crop[0]+x/1200*crop[2])/1200
        right = (crop[0]+(x+width)/1200*crop[2])/1200
        top = (crop[1]+y/800*crop[3])/800
        bottom = (crop[1]+(y+height)/800*crop[3])/800
        scene.render.border_min_x, scene.render.border_max_x = left, right
        scene.render.border_min_y, scene.render.border_max_y = 1-bottom, 1-top

    def shoot(name):
        scene.render.filepath = str(output/f'{name}.png')
        bpy.ops.render.render(write_still=True)
        print(f'HOOP LAYER {name}', flush=True)

    def only(seen):
        """Only these reach the camera; everything still lights and shadows."""
        seen = set(seen)
        for obj in objects:
            if obj.type != 'LIGHT':
                obj.visible_camera = obj in seen

    def matte(seen):
        """As only(), but everything else still blocks the view: the housing
        hides the cords behind it, and the near cords those behind them."""
        seen = set(seen)
        for obj in objects:
            if obj.type != 'LIGHT':
                obj.visible_camera = True
                obj.is_holdout = obj not in seen

    def everything():
        for obj in objects:
            if obj.type != 'LIGHT':
                obj.visible_camera = True
                obj.is_holdout = False

    # The court.
    region(*COURT_REGION)
    for obj in ball:
        obj.hide_render = True
    shoot('court-clean')
    for obj in ball:
        obj.hide_render = False
        obj.visible_camera = False
    shoot('court-shadow')
    everything()

    # The ball, rolling toward home: rotation about up × travel.
    region(*BALL_REGION)
    only(ball)
    home = (centre-rim_at).to_2d().normalized()
    axis = Vector((-home.y, home.x, 0))
    rest = {obj: obj.matrix_world.copy() for obj in ball}
    for frame in range(FRAMES):
        turn = Matrix.Translation(centre) @ Matrix.Rotation(frame*math.tau/FRAMES, 4, axis) @ Matrix.Translation(-centre)
        for obj in ball:
            obj.matrix_world = turn @ rest[obj]
        bpy.context.view_layer.update()
        shoot(f'ball-{frame:02}')
    for obj in ball:
        obj.matrix_world = rest[obj]
    bpy.context.view_layer.update()
    everything()

    # The hoop.
    region(*NET_REGION)
    for obj in net:
        obj.visible_camera = False
    shoot('net-plate')
    everything()
    matte(back)
    shoot('net-back')
    matte(front)
    shoot('net-front')
    # A camera-only plane through the rim's centre cuts away the far half.
    mesh = bpy.data.meshes.new('Hoop shot · rim cut')
    mesh.from_pydata([(-4, 0, -4), (4, 0, -4), (4, 0, 4), (-4, 0, 4)], [], [(0, 1, 2, 3)])
    plane = bpy.data.objects.new('Hoop shot · rim cut', mesh)
    plane.location = rim_at
    scene.collection.objects.link(plane)
    plane.is_holdout = True
    for ray in ('diffuse', 'glossy', 'transmission', 'volume_scatter', 'shadow'):
        setattr(plane, f'visible_{ray}', False)
    matte([rim])
    shoot('rim-front')
    (output/'layers.json').write_text(json.dumps({
        'ball': list(centre), 'ballRadius': .24, 'rim': list(rim_at), 'rimRadius': .28,
        'netDepth': .416, 'floor': round(centre.z-.24, 4),
        'frames': FRAMES, 'court': COURT_REGION, 'ballRegion': BALL_REGION, 'net': NET_REGION,
    }, indent=2)+'\n')
