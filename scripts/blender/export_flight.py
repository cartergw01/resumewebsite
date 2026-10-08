"""Bake a lightweight, pre-lit island for the browser's camera flights.

blender -b artwork/blender/work.blend --python scripts/blender/export_flight.py -- --world work

The scene's full Cycles lighting (sun or moon, lamps, emission, bounce) is
baked into vertex colours on the joined island, so the browser can draw it
unlit and cheaply while still looking like the stills. Taipei also bakes its
daytime lighting into a second colour layer, written as its own day file. The mesh is then decimated to a
flight budget and written as a Draco GLB to public/blender/flight-<world>-*.glb,
with its path recorded in lib/island-flight-assets.json.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts' / 'blender'))
args = argparse.ArgumentParser()
args.add_argument('--world', required=True, choices=['work', 'writing', 'projects'])
args.add_argument('--faces', type=int, default=45000)
args.add_argument('--samples', type=int, default=24)
opts = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
scene = bpy.context.scene
scene.frame_set(1)
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'; prefs.get_devices()
for device in prefs.devices: device.use = device.type == 'METAL'
scene.cycles.device = 'GPU'
scene.cycles.samples = opts.samples
scene.cycles.use_denoising = False

# Blades of grass, hair-thin roots and sub-pixel hardware vanish in a moving
# camera; dropping them keeps the budget for the shapes that read.
SKIP = ('Night · ', 'Terrain · clustered meadow blades', 'Rim · fine wild grass', 'Cliff · ', 'Rug · ',
        'Sheet · screw head', 'Street · lane marking', 'Street · zebra crossing', 'Tool panel · fine perforations',
        'Lamp · tension spring', 'PCB · ', 'Bike · spoke', 'Poster · star')
depsgraph = bpy.context.evaluated_depsgraph_get()
parts = []
for obj in list(scene.objects):
    if obj.type not in {'MESH', 'CURVE', 'FONT'} or obj.hide_render: continue
    if obj.name.startswith(SKIP):
        obj.hide_render = True; continue
    evaluated = obj.evaluated_get(depsgraph)
    data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    if not data or not len(data.vertices): continue
    # Procedural wood and stone read the original object's coordinates.
    coords = data.attributes.new('LocalSurface', 'FLOAT_VECTOR', 'POINT')
    values = np.empty(len(data.vertices) * 3, dtype=np.float32)
    data.vertices.foreach_get('co', values); coords.data.foreach_set('vector', values)
    part = bpy.data.objects.new('Flight ' + obj.name, data)
    part.matrix_world = obj.matrix_world.copy()
    parts.append(part)
    obj.hide_render = True
for part in parts: scene.collection.objects.link(part)
for mat in bpy.data.materials:
    if not mat.use_nodes: continue
    for node in list(mat.node_tree.nodes):
        if node.type != 'TEX_COORD': continue
        output = node.outputs.get('Object')
        for link in list(output.links):
            attribute = mat.node_tree.nodes.new('ShaderNodeAttribute'); attribute.attribute_name = 'LocalSurface'
            mat.node_tree.links.new(attribute.outputs['Vector'], link.to_socket)

bpy.ops.object.select_all(action='DESELECT')
for part in parts: part.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
model = bpy.context.object
model.name = f'{opts.world.title()} island · flight'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
print(f'FLIGHT {opts.world}: {len(model.data.polygons)} faces before decimation', flush=True)


def bake(layer):
    # Per vertex, not per face corner: shared vertices keep the file small and
    # the shading smooth.
    color = model.data.color_attributes.new(name=layer, type='BYTE_COLOR', domain='POINT')
    model.data.color_attributes.active_color = color
    scene.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='COMBINED', target='VERTEX_COLORS', margin=0)
    values = np.empty(len(color.data) * 4, dtype=np.float32); color.data.foreach_get('color', values)
    print(f'FLIGHT {opts.world}: baked {layer}, mean colour {values.reshape(-1, 4)[:, :3].mean(0).round(3)}', flush=True)


def report(stage):
    for attribute in model.data.color_attributes:
        values = np.empty(len(attribute.data) * 4, dtype=np.float32); attribute.data.foreach_get('color', values)
        print(f'FLIGHT {opts.world}: {stage} {attribute.name} {attribute.domain} {values.reshape(-1, 4)[:, :3].mean(0).round(3)}', flush=True)


bake('Night')
if opts.world == 'work':
    import build_islands
    build_islands.daylight(scene)
    bake('Day')
report('after bakes')
model.data.attributes.remove(model.data.attributes['LocalSurface'])

# Decimate to the flight budget. Decimation keeps only the active colour
# layer (others come back white), so a second layer is decimated on an
# identical copy and its colours copied across; the topology matches.
ratio = min(1, opts.faces / max(1, len(model.data.polygons)))
def decimated(obj, layer):
    obj.data.color_attributes.active_color = obj.data.color_attributes[layer]
    obj.data.color_attributes.render_color_index = obj.data.color_attributes.active_color_index
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active = obj
    modifier = obj.modifiers.new('Flight budget', 'DECIMATE'); modifier.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=modifier.name)
copy = None
if 'Day' in model.data.color_attributes:
    copy = model.copy(); copy.data = model.data.copy(); scene.collection.objects.link(copy)
decimated(model, 'Night')
if copy:
    decimated(copy, 'Day')
    if len(copy.data.vertices) != len(model.data.vertices): raise RuntimeError('Day and night decimations diverged')
    values = np.empty(len(copy.data.vertices) * 4, dtype=np.float32)
    copy.data.color_attributes['Day'].data.foreach_get('color', values)
    model.data.color_attributes['Day'].data.foreach_set('color', values)
    bpy.data.objects.remove(copy, do_unlink=True)
for uv in list(model.data.uv_layers): model.data.uv_layers.remove(uv)
model.data.materials.clear()
plain = bpy.data.materials.new('Flight · baked light'); model.data.materials.append(plain)
model.data.color_attributes.active_color = model.data.color_attributes['Night']
report('after decimation')
print(f'FLIGHT {opts.world}: {len(model.data.polygons)} faces after decimation', flush=True)

output = ROOT / '.blender-build' / 'flight'; output.mkdir(parents=True, exist_ok=True)
manifest_path = ROOT / 'lib' / 'island-flight-assets.json'
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
entry = {}
for old in (ROOT / 'public' / 'blender').glob(f'flight-{opts.world}-*.glb'): old.unlink()
# One colour layer per file: the glTF exporter only carries one reliably.
for layer in [a.name for a in model.data.color_attributes]:
    single = model.copy(); single.data = model.data.copy(); scene.collection.objects.link(single)
    for other in [a.name for a in single.data.color_attributes if a.name != layer]:
        single.data.color_attributes.remove(single.data.color_attributes[other])
    single.data.color_attributes.active_color = single.data.color_attributes[layer]
    path = output / f'{opts.world}-{layer.lower()}.glb'
    bpy.ops.object.select_all(action='DESELECT'); single.select_set(True); bpy.context.view_layer.objects.active = single
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_animations=False, export_cameras=False, export_lights=False, export_materials='NONE',
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=12, export_draco_color_quantization=8,
        export_vertex_color='ACTIVE')
    bpy.data.objects.remove(single, do_unlink=True)
    fingerprint = hashlib.sha256(path.read_bytes()).hexdigest()[:8]
    suffix = '' if layer == 'Night' else '-' + layer.lower()
    name = f'flight-{opts.world}{suffix}-{fingerprint}.glb'
    (ROOT / 'public' / 'blender' / name).write_bytes(path.read_bytes())
    entry['src' if layer == 'Night' else 'daySrc'] = '/blender/' + name
    print(f'FLIGHT {opts.world}: {name} ({path.stat().st_size / 1048576:.2f} MiB)', flush=True)
manifest[opts.world] = entry
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
