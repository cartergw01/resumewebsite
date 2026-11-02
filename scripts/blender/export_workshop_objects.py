"""Camera-project the real project objects into the same crop as the still."""
import json
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[2]
scene=bpy.context.scene
crop=json.loads((ROOT/'lib/island-cameras.json').read_text())['projects']['crop']
def project(point):
    p=world_to_camera_view(scene,scene.camera,point)
    return [round((p.x*1200-crop[0])/crop[2]*1200,3),round(((1-p.y)*800-crop[1])/crop[3]*800,3)]
objects={}
for root in scene.objects:
    slug=root.get('workshop_project')
    if not slug:continue
    corners=[project(child.matrix_world@Vector(v)) for child in root.children
             if child.type in {'MESH','FONT','CURVE'} and not child.hide_render for v in child.bound_box]
    xs,ys=zip(*corners)
    objects[slug]={'point':project(root.matrix_world@Vector(root['anchor'])),
                   'bounds':[round(min(xs),3),round(min(ys),3),round(max(xs)-min(xs),3),round(max(ys)-min(ys),3)]}
assert len(objects)==8, f'Expected 8 workshop objects, found {len(objects)}'
(ROOT/'lib/workshop-objects.json').write_text(json.dumps(objects,indent=2)+'\n')
print('WORKSHOP OBJECTS '+', '.join(objects),flush=True)
