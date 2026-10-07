"""Project extra 3D points from a saved island scene into its cropped still,
for the browser's live details (traffic, festoon bulbs, lamplight).

blender -b artwork/blender/work.blend --python scripts/blender/export_life_anchors.py -- --world work

Points come from the scene's own objects or known street centrelines, go
through the render camera, then through the same crop as the still
(lib/island-orbit-assets.json), and are written to lib/blender-islands.json
under "life".
"""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
args = argparse.ArgumentParser()
args.add_argument('--world', required=True, choices=['work', 'writing', 'projects'])
opts = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
scene = bpy.context.scene
camera = scene.camera
crop = json.loads((ROOT / 'lib' / 'island-orbit-assets.json').read_text())[opts.world]['crop']


def project(point):
    v = world_to_camera_view(scene, camera, Vector(point))
    x, y = v.x * 1200, (1 - v.y) * 800
    return [round((x - crop[0]) / crop[2] * 1200, 2), round((y - crop[1]) / crop[3] * 800, 2)]


def centres(prefix):
    return [project(obj.matrix_world.translation) for obj in scene.objects if obj.name.startswith(prefix)]


life = {}
if opts.world == 'work':
    # Lanes either side of each avenue's centreline, at road height. Each lane
    # is sampled along its length, so traffic can follow the perspective.
    def lane(a, b, offset, axis, samples=9):
        pts = []
        for i in range(samples):
            t = i / (samples - 1)
            x = a[0] + (b[0] - a[0]) * t; y = a[1] + (b[1] - a[1]) * t
            if axis == 'x': y += offset
            else: x += offset
            pts.append(project((x, y, .052)))
        return pts
    roads = [((-3.3, -.95), (3.2, -.95), 'x'), ((-3.2, 1.35), (3.2, 1.35), 'x'), ((-1.05, -2.3), (-1.05, 2.15), 'y'), ((1.55, -2.3), (1.55, 2.15), 'y')]
    life['lanes'] = [lane(a, b, off, axis) for a, b, axis in roads for off in (-.05, .05)]
    # Taipei 101's front face, from the podium to the crown, for its lift.
    life['tower'] = [project((.52, -.39 - .27, 1.25)), project((.52, -.39 - .2, 3.85))]
elif opts.world == 'writing':
    lamp = next((o for o in scene.objects if o.name.startswith('Lamp · frosted diffuser')), None)
    desk = [o for o in scene.objects if o.name.startswith('Desk · solid walnut top')]
    if lamp:
        life['lamp'] = project(lamp.matrix_world.translation)
        # The lit cone below the shade, from the bulb down to the desk.
        life['cone'] = project(lamp.matrix_world.translation + Vector((0, 0, -.9)))
    if desk:
        life['desk'] = [project(o.matrix_world.translation) for o in desk]
else:
    life['festoon'] = centres('Festoon · bulb')
    life['bulb'] = centres('Workshop · bare bulb')[:1]
    life['yard'] = [project(p) for p in [(-3.6, -2.2, .25), (3.3, -1.6, .25), (-3.9, 1.0, .25), (2.6, -2.6, .25), (4.2, 0, .3)]]

path = ROOT / 'lib' / 'blender-islands.json'
manifest = json.loads(path.read_text())
manifest[opts.world]['life'] = life
path.write_text(json.dumps(manifest, indent=2) + '\n')
print(f'LIFE {opts.world}: ' + ', '.join(f'{k}={len(v) if isinstance(v[0], list) else 1}' for k, v in life.items()), flush=True)
