"""Bake a lightweight, pre-lit island for the browser's camera flights.

blender -b artwork/blender/work.blend --python scripts/blender/export_flight.py -- --world work

The scene's full Cycles lighting (sun or moon, lamps, emission, bounce) is
baked into vertex colours on the joined island, so the browser can draw it
unlit and cheaply while still looking like the stills. Taipei also bakes its
daytime lighting into a second colour layer, written as its own day file. The mesh is then decimated to a
flight budget and written as a Draco GLB to public/blender/flight-<world>-*.glb,
with its path recorded in lib/island-flight-assets.json.

--social-preview instead writes a capture-only GLB under .blender-build,
retaining emissive fixtures and denser surfaces for the social video.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
import bmesh
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts' / 'blender'))
args = argparse.ArgumentParser()
args.add_argument('--world', required=True, choices=['work', 'writing', 'projects'])
args.add_argument('--faces', type=int, default=45000)
args.add_argument('--samples', type=int, default=24)
args.add_argument('--social-preview', action='store_true', help='Keep lit fixtures and denser light pools in capture-only models')
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
SKIP = ('Hoop · clear glass pane', 'Night · ', 'Study · window glass', 'Shadow box · protective glazing', 'Iced latte · glass', 'Iced latte · ice', 'Terrain · clustered meadow blades', 'Rim · fine wild grass', 'Cliff · ', 'Rug · ',
        'Sheet · screw head', 'Street · lane marking', 'Street · zebra crossing', 'Tool panel · fine perforations',
        'Lamp · tension spring', 'Poster · star')


def volume_only(mat):
    if not mat or not mat.use_nodes: return False
    outputs = [node for node in mat.node_tree.nodes if node.type == 'OUTPUT_MATERIAL' and node.is_active_output]
    return bool(outputs) and all(node.inputs['Volume'].is_linked and not node.inputs['Surface'].is_linked for node in outputs)


def emissive(mat):
    if not mat or not mat.use_nodes: return False
    return any(node.type == 'BSDF_PRINCIPLED' and node.inputs['Emission Strength'].default_value > 0
               for node in mat.node_tree.nodes)


depsgraph = bpy.context.evaluated_depsgraph_get()
parts = []
fixtures = []
for obj in list(scene.objects):
    if obj.type not in {'MESH', 'CURVE', 'FONT'} or obj.hide_render: continue
    if obj.name.startswith(SKIP):
        obj.hide_render = True; continue
    # Light-beam volumes have no solid surface. Joining their boundary meshes
    # would turn the haze into opaque cones when the browser draws baked colours.
    # Leave them in the bake scene for lighting, but out of the exported model.
    if obj.material_slots and all(volume_only(slot.material) for slot in obj.material_slots):
        print(f'FLIGHT {opts.world}: excluding volume boundary {obj.name}', flush=True)
        continue
    evaluated = obj.evaluated_get(depsgraph)
    data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    if not data or not len(data.vertices): continue
    # Tiny bulbs, windows and LED strips disappear into the flight mesh's
    # decimation. Keep their original geometry and emissive materials for the
    # offline social capture. They remain present while the surrounding light
    # is baked, so their illumination and visible source agree.
    if opts.social_preview and obj.material_slots and all(emissive(slot.material) for slot in obj.material_slots):
        fixture = bpy.data.objects.new('Social light · ' + obj.name, data)
        fixture.matrix_world = obj.matrix_world.copy()
        fixtures.append(fixture)
        obj.hide_render = True
        continue
    # Vertex baking needs samples inside broad surfaces, not just their
    # corners, to retain a lamp's pool on a desk, shelf, wall or deck.
    if opts.social_preview and len(data.polygons) < 300:
        mesh = bmesh.new(); mesh.from_mesh(data)
        edges = [edge for edge in mesh.edges if (obj.matrix_world.to_3x3() @ (edge.verts[0].co - edge.verts[1].co)).length > .2]
        if edges: bmesh.ops.subdivide_edges(mesh, edges=edges, cuts=5, use_grid_fill=True)
        mesh.to_mesh(data); mesh.free()
    # Procedural wood and stone read the original object's coordinates.
    coords = data.attributes.new('LocalSurface', 'FLOAT_VECTOR', 'POINT')
    values = np.empty(len(data.vertices) * 3, dtype=np.float32)
    data.vertices.foreach_get('co', values); coords.data.foreach_set('vector', values)
    part = bpy.data.objects.new('Flight ' + obj.name, data)
    part.matrix_world = obj.matrix_world.copy()
    parts.append(part)
    obj.hide_render = True
for part in parts: scene.collection.objects.link(part)
for fixture in fixtures: scene.collection.objects.link(fixture)
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
if opts.world == 'work' and not opts.social_preview:
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
model.data.polygons.foreach_set('material_index', np.zeros(len(model.data.polygons), dtype=np.int32))
model.data.color_attributes.active_color = model.data.color_attributes['Night']
report('after decimation')
print(f'FLIGHT {opts.world}: {len(model.data.polygons)} faces after decimation', flush=True)

output = ROOT / '.blender-build' / ('social-preview' if opts.social_preview else 'flight'); output.mkdir(parents=True, exist_ok=True)
if opts.social_preview:
    # Thousands of city windows share a handful of materials. Join each
    # material group without simplifying it, preserving every lit surface
    # while avoiding thousands of draw calls in the capture browser.
    groups = {}
    for fixture in fixtures:
        groups.setdefault(tuple(slot.material.name for slot in fixture.material_slots), []).append(fixture)
    fixtures = []
    for group in groups.values():
        bpy.ops.object.select_all(action='DESELECT')
        for fixture in group: fixture.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        if len(group) > 1: bpy.ops.object.join()
        fixtures.append(bpy.context.object)
    bpy.ops.object.select_all(action='DESELECT')
    model.select_set(True)
    for fixture in fixtures: fixture.select_set(True)
    bpy.context.view_layer.objects.active = model
    path = output / f'{opts.world}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_animations=False, export_cameras=False, export_lights=False,
        export_materials='EXPORT', export_vertex_color='ACTIVE')
    print(f'SOCIAL {opts.world}: {path} with {len(fixtures)} lit fixtures', flush=True)
    # Capture-only source models are never installed into the live flight
    # manifest or shipped to visitors; only the finished MP4/JPEG are public.
    sys.exit(0)
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
