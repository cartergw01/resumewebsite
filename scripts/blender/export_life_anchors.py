"""Project extra 3D points from a saved island scene into its cropped still,
for the browser's live details (traffic, lamplight, the LED ball and strips).

blender -b artwork/blender/work.blend --python scripts/blender/export_life_anchors.py -- --world work

Points come from the scene's own objects or known street centrelines, go
through the render camera, then through the same crop as the still
(lib/island-cameras.json), and are written to lib/blender-islands.json
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
crop = json.loads((ROOT / 'lib' / 'island-cameras.json').read_text())[opts.world]['crop']


def project(point):
    v = world_to_camera_view(scene, camera, Vector(point))
    x, y = v.x * 1200, (1 - v.y) * 800
    return [round((x - crop[0]) / crop[2] * 1200, 2), round((y - crop[1]) / crop[3] * 800, 2)]



life = {}
if opts.world == 'work':
    # Lanes either side of each avenue's centreline, at road height. Each lane
    # is sampled densely along its length, so traffic follows the perspective,
    # and each sample carries whether the camera can actually see that bit of
    # road: behind a tower, a car is hidden rather than drawn over it.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eye = camera.matrix_world.translation

    def seen(point):
        target = Vector(point)
        ray = target - eye
        hit, location, *_ = scene.ray_cast(depsgraph, eye, ray.normalized(), distance=ray.length)
        return 0 if hit and (location - eye).length < ray.length - .03 else 1

    def lane(a, b, offset, axis, samples=72):
        pts = []
        for i in range(samples):
            t = i / (samples - 1)
            x = a[0] + (b[0] - a[0]) * t; y = a[1] + (b[1] - a[1]) * t
            if axis == 'x': y += offset
            else: x += offset
            # A car's roof, not the asphalt: a kerb or a parked car never hides it.
            pts.append(project((x, y, .052)) + [seen((x, y, .075))])
        return pts
    roads = [((-3.3, -.95), (3.2, -.95), 'x'), ((-3.2, 1.35), (3.2, 1.35), 'x'), ((-1.05, -2.3), (-1.05, 2.15), 'y'), ((1.55, -2.3), (1.55, 2.15), 'y')]
    life['lanes'] = [lane(a, b, off, axis) for a, b, axis in roads for off in (-.05, .05)]
    # The same lanes in 3D, for traffic in the rotatable model and the camera
    # flights (lib/island-traffic.ts): each a straight run of road, in Three's
    # coordinates (Blender X, Z, -Y), in the same order as the 2D lanes.
    def run(a, b, offset, axis):
        ends = [(a[0], a[1] + offset) if axis == 'x' else (a[0] + offset, a[1]), (b[0], b[1] + offset) if axis == 'x' else (b[0] + offset, b[1])]
        return [[round(x, 5), .052, round(-y, 5)] for x, y in ends]
    cameras_path = ROOT / 'lib' / 'island-cameras.json'
    cameras = json.loads(cameras_path.read_text())
    cameras.setdefault('work', {})['traffic'] = {'lanes': [run(a, b, off, axis) for a, b, axis in roads for off in (-.05, .05)]}
    cameras_path.write_text(json.dumps(cameras, indent=2) + '\n')
    # Where Taipei 101's fireworks fire from, as in its New Year show: the two
    # front corners at the top of each of the eight tiers, and the spire tip.
    # (Tower centre, tier tops and widths as built by taipei101 in
    # build_islands.py.)
    tx, ty, half = .52, -.39, .258
    life['fireworks'] = {
        'tiers': [[project((tx - half, ty - half, 1.19 + i * .337 + .32)), project((tx + half, ty - half, 1.19 + i * .337 + .32))] for i in range(8)],
        'top': project((tx, ty, 5.15)),
    }
    # Taipei 101's front face, from the podium to the crown, for its lift.
    life['tower'] = [project((.52, -.39 - .27, 1.25)), project((.52, -.39 - .2, 3.85))]
elif opts.world == 'writing':
    clock = scene.objects.get('Omega clock · live hands')
    if clock:
        center = clock.matrix_world.translation
        radius = clock['radius']
        life['clock'] = {'corners': [project(center + Vector((x * radius, 0, z * radius)))
                                    for x, z in [(-1, 1), (1, 1), (-1, -1), (1, -1)]]}
        cameras_path = ROOT / 'lib' / 'island-cameras.json'
        cameras = json.loads(cameras_path.read_text())
        cameras.setdefault('writing', {})['clock'] = {
            'center': [round(center.x, 6), round(center.z, 6), round(-center.y, 6)],
            'radius': radius,
        }
        cameras_path.write_text(json.dumps(cameras, indent=2) + '\n')
    lamp = next((o for o in scene.objects if o.name.startswith('Lamp · frosted diffuser')), None)
    desk = [o for o in scene.objects if o.name.startswith('Desk · solid walnut top')]
    if lamp:
        life['lamp'] = project(lamp.matrix_world.translation)
        # The lit cone below the shade, from the bulb down to the desk.
        life['cone'] = project(lamp.matrix_world.translation + Vector((0, 0, -.9)))
    if desk:
        life['desk'] = [project(o.matrix_world.translation) for o in desk]
    # The lava lamp's bottle: bottom and top of the liquid, and a point on its
    # widest edge (for the wax's width). Built by lava_lamp in build_islands.py.
    bottle = next((o for o in scene.objects if o.name.startswith('Lava lamp · bottle')), None)
    if bottle:
        base = bottle.matrix_world.translation
        k = bottle.dimensions.z / .25
        life['lava'] = [project(base + Vector((0, 0, .02 * k))), project(base + Vector((0, 0, .23 * k))), project(base + Vector((.064 * k, 0, .07 * k)))]
else:
    # The LED ball's centre and edge.
    ball = next((o for o in scene.objects if o.name == 'LED ball'), None)
    if ball:
        centre = ball.matrix_world.translation
        life['ball'] = [project(centre), project(centre + Vector((ball.scale.x, 0, 0)))]

# The rooms' LED strips (named "Glow · … strip") the camera can see: each
# one's two ends and its colour, for the glow that breathes along them on the
# page. A strip hidden behind something (the roof beam's, under the roof's
# edge) is left out, so its light never floats over what hides it.
strips = []
depsgraph = bpy.context.evaluated_depsgraph_get()
eye = camera.matrix_world.translation


def visible(obj, point):
    ray = point - eye
    hit, location, normal, index, hit_obj, matrix = scene.ray_cast(depsgraph, eye, ray.normalized(), distance=ray.length + .01)
    return not hit or hit_obj.name == obj.name or (location - eye).length > ray.length - .02


for obj in scene.objects:
    if obj.type != 'MESH' or not obj.name.startswith('Glow ·') or 'strip' not in obj.name:
        continue
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    centre = sum(corners, Vector()) / 8
    axis = max(((corners[4] - corners[0]), (corners[3] - corners[0]), (corners[1] - corners[0])), key=lambda v: v.length)
    samples = [centre + axis * t for t in (-.4, -.2, 0, .2, .4)]
    if sum(visible(obj, point) for point in samples) < 3:
        continue
    colour = obj.active_material.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value
    strips.append([project(centre - axis / 2), project(centre + axis / 2), [round(c * 255) for c in colour[:3]]])
if strips:
    life['strips'] = strips

path = ROOT / 'lib' / 'blender-islands.json'
manifest = json.loads(path.read_text())
manifest[opts.world]['life'] = life
path.write_text(json.dumps(manifest, indent=2) + '\n')
print(f'LIFE {opts.world}: ' + ', '.join(f'{k}={len(v) if isinstance(v, dict) or isinstance(v[0], list) else 1}' for k, v in life.items()), flush=True)
