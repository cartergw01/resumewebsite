"""Bake the existing Blender scene into a compressed browser mesh with real materials.

blender -b artwork/blender/work.blend --threads 6 --python scripts/blender/export_orbit.py -- --world work
The editable source .blend is never overwritten.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
args = argparse.ArgumentParser()
args.add_argument('--world', required=True, choices=['work', 'writing', 'projects'])
args.add_argument('--samples', type=int, default=4)
args.add_argument('--crop', type=int, nargs=4, metavar=('X','Y','WIDTH','HEIGHT'))
opts = args.parse_args(sys.argv[sys.argv.index('--')+1:])
scene = bpy.context.scene
scene.frame_set(1)
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = opts.samples
scene.cycles.use_denoising = True

def web_point(v): return [round(v[0],6),round(v[2],6),round(-v[1],6)]
camera = scene.camera
camera_data = {'position':web_point(camera.location), 'up':web_point(camera.rotation_euler.to_matrix() @ Vector((0,1,0))),
               'direction':web_point(camera.rotation_euler.to_matrix() @ Vector((0,0,-1))),
               'fov':float(camera.data.angle_y*180/np.pi)}

# A joined mesh still needs each object's original coordinates for procedural
# stone and wood. Preserve them as an attribute before applying world transforms.
depsgraph=bpy.context.evaluated_depsgraph_get()
parts=[]
originals=[]
image_parts=[]
for obj in list(scene.objects):
    if obj.type not in {'MESH','CURVE','FONT'} or obj.hide_render: continue
    if obj.type=='MESH' and any(m and m.use_nodes and any(n.type=='TEX_IMAGE' for n in m.node_tree.nodes) for m in obj.data.materials):
        image_parts.append(obj)
        continue
    evaluated=obj.evaluated_get(depsgraph)
    data=bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
    if not data or not len(data.vertices): continue
    coords=data.attributes.new('LocalSurface', 'FLOAT_VECTOR', 'POINT')
    values=np.empty(len(data.vertices)*3,dtype=np.float32)
    data.vertices.foreach_get('co',values)
    coords.data.foreach_set('vector',values)
    part=bpy.data.objects.new('Orbit '+obj.name,data)
    part.matrix_world=obj.matrix_world.copy()
    parts.append(part)
    originals.append(obj)

for obj in originals:
    obj.hide_render=True
    obj.hide_set(True)
for part in parts: scene.collection.objects.link(part)

for mat in bpy.data.materials:
    if not mat.use_nodes or any(n.type=='TEX_IMAGE' for n in mat.node_tree.nodes): continue
    for node in list(mat.node_tree.nodes):
        if node.type != 'TEX_COORD': continue
        output=node.outputs.get('Object')
        links=list(output.links)
        if not links: continue
        attribute=mat.node_tree.nodes.new('ShaderNodeAttribute')
        attribute.attribute_name='LocalSurface'
        for link in links: mat.node_tree.links.new(attribute.outputs['Vector'],link.to_socket)

bpy.ops.object.select_all(action='DESELECT')
for part in parts: part.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.join()
model=bpy.context.object
model.name=f'{opts.world.title()} island · browser materials'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
print(f'ORBIT: baking {len(model.data.vertices)} vertices, {len(model.data.polygons)} faces',flush=True)
# Bake color only. A lighting bake at face corners creates black edge samples,
# particularly on the city's glass. Browser lighting must be evaluated per pixel.
original_materials=list(model.data.materials)
settings=[]
for mat in original_materials:
    bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    settings.append((mat.name,bs.inputs['Metallic'].default_value,bs.inputs['Roughness'].default_value,
                     tuple(bs.inputs['Emission Color'].default_value),bs.inputs['Emission Strength'].default_value))
    emit=mat.node_tree.nodes.new('ShaderNodeEmission')
    color_input=bs.inputs['Base Color']
    if color_input.is_linked: mat.node_tree.links.new(color_input.links[0].from_socket,emit.inputs['Color'])
    else: emit.inputs['Color'].default_value=color_input.default_value
    output=next(n for n in mat.node_tree.nodes if n.type=='OUTPUT_MATERIAL')
    mat.node_tree.links.new(emit.outputs[0],output.inputs['Surface'])
color=model.data.color_attributes.new(name='SurfaceColor',type='BYTE_COLOR',domain='CORNER')
model.data.color_attributes.active_color=color
scene.render.bake.target='VERTEX_COLORS'
bpy.ops.object.bake(type='EMIT',target='VERTEX_COLORS')
for i,(name,metal,rough,emission,strength) in enumerate(settings):
    material=bpy.data.materials.new(name+' · web')
    material.use_nodes=True
    bs=material.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value=(1,1,1,1)
    bs.inputs['Metallic'].default_value=metal
    bs.inputs['Roughness'].default_value=max(.3,rough)
    bs.inputs['Emission Color'].default_value=emission
    bs.inputs['Emission Strength'].default_value=strength
    attr=material.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='SurfaceColor'
    material.node_tree.links.new(attr.outputs['Color'],bs.inputs['Base Color'])
    model.data.materials[i]=material
# These attributes were only needed while baking.
model.data.attributes.remove(model.data.attributes['LocalSurface'])
for uv in list(model.data.uv_layers): model.data.uv_layers.remove(uv)

output=ROOT/'.blender-build'/'orbit';output.mkdir(parents=True,exist_ok=True)
path=output/f'{opts.world}.glb'
for obj in image_parts: obj.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(output/f'{opts.world}-export.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
    export_animations=False,export_cameras=False,export_lights=False,
    export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,export_draco_color_quantization=8,
    export_vertex_color='NAME',export_vertex_color_name='SurfaceColor')
fingerprint=hashlib.sha256(path.read_bytes()).hexdigest()[:8]
name=f'orbit-{opts.world}-{fingerprint}.glb'
target=ROOT/'public'/'blender'/name;target.write_bytes(path.read_bytes())
(output/f'{opts.world}-camera.json').write_text(json.dumps(camera_data,indent=2)+'\n')
print(f'ORBIT: {name} ({target.stat().st_size/1048576:.2f} MiB)',flush=True)

manifest_path=ROOT/'lib'/'island-orbit-assets.json'
manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
crop=opts.crop or manifest.get(opts.world,{}).get('crop')
if not crop: raise ValueError('Supply --crop X Y WIDTH HEIGHT from prepare_islands.mjs')
manifest[opts.world]={'src':'/blender/'+name,'camera':camera_data,'crop':crop}
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
