"""Render a camera-depth map from a saved island scene, for browser parallax.

blender -b artwork/blender/work.blend --python scripts/blender/render_depth.py -- \
  --world work --output .blender-build/depth --width 1440

White is nearest to the camera, black farthest, normalised over the island's
own depth range. The camera, framing and transparency match the still render,
so the same crop applies (scripts/blender/export_depth.mjs).
"""
import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector

args = argparse.ArgumentParser()
args.add_argument('--world', required=True)
args.add_argument('--output', type=Path, required=True)
args.add_argument('--width', type=int, default=1440)
opts = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
scene = bpy.context.scene
camera = scene.camera

# The island's depth range, from its geometry's bounds as seen by the camera.
distances = []
for obj in scene.objects:
    if obj.type not in {'MESH', 'CURVE'} or obj.hide_render or obj.name.startswith('Night · '):
        continue
    for corner in obj.bound_box:
        distances.append((obj.matrix_world @ Vector(corner) - camera.location).length)
distances.sort()
near = distances[int(len(distances) * .02)]
far = distances[int(len(distances) * .98)]

depth = bpy.data.materials.new('Depth · camera distance')
depth.use_nodes = True
nodes, links = depth.node_tree.nodes, depth.node_tree.links
for node in list(nodes):
    nodes.remove(node)
data = nodes.new('ShaderNodeCameraData')
remap = nodes.new('ShaderNodeMapRange')
remap.inputs['From Min'].default_value = near
remap.inputs['From Max'].default_value = far
remap.inputs['To Min'].default_value = 1
remap.inputs['To Max'].default_value = 0
remap.clamp = True
links.new(data.outputs['View Distance'], remap.inputs['Value'])
emit = nodes.new('ShaderNodeEmission')
links.new(remap.outputs[0], emit.inputs['Color'])
out = nodes.new('ShaderNodeOutputMaterial')
links.new(emit.outputs[0], out.inputs['Surface'])

layer = bpy.context.view_layer
layer.material_override = depth
for obj in list(scene.objects):
    if obj.type == 'LIGHT':
        obj.hide_render = True
    if obj.name.startswith('Night · '):
        obj.hide_render = True
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 4
scene.cycles.use_denoising = False
scene.render.film_transparent = True
scene.render.resolution_x = opts.width
scene.render.resolution_y = round(opts.width * 2 / 3)
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '16'
opts.output.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(opts.output / f'{opts.world}.png')
bpy.ops.render.render(write_still=True)
print(f'DEPTH {opts.world}: near {near:.2f} far {far:.2f}', flush=True)
