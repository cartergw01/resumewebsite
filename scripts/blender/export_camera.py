"""Record an island's camera and the crop of its published still.

blender -b artwork/blender/work.blend --python scripts/blender/export_camera.py -- --world work --crop X Y WIDTH HEIGHT

The camera (in Three's coordinates) and the crop let the browser's 3D flights
between islands (lib/island-flight.ts) start and end on each still's exact
framing; the crop also places the day, lights-off and depth variants
(export_variant.mjs, export_depth.mjs). Written to lib/island-cameras.json.
"""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
args = argparse.ArgumentParser()
args.add_argument('--world', required=True, choices=['work', 'writing', 'projects'])
args.add_argument('--crop', type=int, nargs=4, metavar=('X', 'Y', 'WIDTH', 'HEIGHT'))
opts = args.parse_args(sys.argv[sys.argv.index('--')+1:])


def web_point(v): return [round(v[0], 6), round(v[2], 6), round(-v[1], 6)]


camera = bpy.context.scene.camera
rotation = camera.rotation_euler.to_matrix()
view = {'position': web_point(camera.location), 'up': web_point(rotation @ Vector((0, 1, 0))),
        'direction': web_point(rotation @ Vector((0, 0, -1))), 'fov': float(camera.data.angle_y*180/3.141592653589793)}

manifest_path = ROOT/'lib'/'island-cameras.json'
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
crop = opts.crop or manifest.get(opts.world, {}).get('crop')
if not crop: raise ValueError('Supply --crop X Y WIDTH HEIGHT from prepare_islands.mjs')
manifest[opts.world] = {**manifest.get(opts.world, {}), 'camera': view, 'crop': crop}
manifest_path.write_text(json.dumps(manifest, indent=2)+'\n')
print(f'CAMERA {opts.world}: crop {crop}', flush=True)
