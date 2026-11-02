"""Export inspectable copies of existing props; never save or alter the .blend.

blender -b artwork/blender/projects.blend --python scripts/blender/export_workshop_curios.py
"""
import hashlib
import json
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[2]
scene=bpy.context.scene
camera=scene.camera
crop=json.loads((ROOT/'lib/island-cameras.json').read_text())['projects']['crop']
specs=json.loads((ROOT/'content/workshop-curios.json').read_text())
output=ROOT/'public/workshop'; output.mkdir(exist_ok=True)
original=list(scene.objects)
depsgraph=bpy.context.evaluated_depsgraph_get()
manifest={}

def project(point):
    p=world_to_camera_view(scene,camera,point)
    return [(p.x*1200-crop[0])/crop[2]*1200,((1-p.y)*800-crop[1])/crop[3]*800]

for spec in specs:
    source=[o for o in original if o.type in {'MESH','FONT','CURVE'} and not o.hide_render
            and any(o.name.startswith(p) for p in spec['prefixes'])
            and 'haze' not in o.name and 'protective glazing' not in o.name]
    assert source, 'No geometry matched '+spec['id']
    points=[project(o.matrix_world@Vector(v)) for o in source for v in o.bound_box]
    xs,ys=zip(*points); bounds=[min(xs),min(ys),max(xs)-min(xs),max(ys)-min(ys)]
    # Copy evaluated meshes, so bevels, curves, lettering and parent transforms
    # are retained without changing the original objects or their materials.
    clones=[]
    bpy.ops.object.select_all(action='DESELECT')
    for o in source:
        data=bpy.data.meshes.new_from_object(o.evaluated_get(depsgraph),depsgraph=depsgraph)
        # The Cycles glass mixes a transparent and a reflection shader. Give
        # its inspectable copy a glTF-compatible transparent surface.
        for slot, mat in enumerate(data.materials):
            if mat and mat.name.startswith('Hoop · low-iron clear glass'):
                glass=bpy.data.materials.get('Inspect · clear hoop glass')
                if glass is None:
                    glass=bpy.data.materials.new('Inspect · clear hoop glass');glass.use_nodes=True
                    bs=glass.node_tree.nodes.get('Principled BSDF')
                    bs.inputs['Base Color'].default_value=(.70,.84,.88,1)
                    bs.inputs['Alpha'].default_value=.10
                    bs.inputs['Roughness'].default_value=.045
                    glass.surface_render_method='DITHERED'
                data.materials[slot]=glass
        clone=bpy.data.objects.new('Inspect · '+o.name,data)
        scene.collection.objects.link(clone); clone.matrix_world=o.matrix_world.copy()
        clone.select_set(True); clones.append(clone)
    raw=output/(spec['id']+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,
        export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT',
        export_yup=True,export_extras=False)
    blob=raw.read_bytes(); name=spec['id']+'-'+hashlib.sha256(blob).hexdigest()[:8]+'.glb'
    raw.rename(output/name)
    manifest[spec['id']]={'point':[round(bounds[0]+bounds[2]/2,3),round(bounds[1]+bounds[3]/2,3)],
        'bounds':[round(v,3) for v in bounds],'src':'/workshop/'+name}
    for clone in clones:
        data=clone.data;bpy.data.objects.remove(clone,do_unlink=True);bpy.data.meshes.remove(data)
    print('CURIO',spec['id'],len(source),len(blob),flush=True)

(ROOT/'lib/workshop-curios.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Exported',len(manifest),'inspectable props; source scene unchanged.',flush=True)
