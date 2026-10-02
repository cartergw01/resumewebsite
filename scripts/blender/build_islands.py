"""Model and render Carter's islands with geometry and procedural materials.

blender -b --factory-startup --python scripts/blender/build_islands.py -- \
  --world all --output /tmp/carter-islands --samples 48 --width 1600

The saved scenes, camera-projected interaction anchors and web renders all
come from this one source, with no raster source images. Dimensions use Blender
world units; each island is composed independently around its main landmark.
"""

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector, noise
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parents[2]
P = {}
ANCHORS = {}
WINDOWS = []
ANIMATED = []


def material(name, color, metal=0, rough=0.45, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    return mat


def textured(name, dark, pale, kind='stone', metal=0, rough=.7):
    """Object-space materials remain self contained in the saved Blender scene."""
    mat = material(name, dark, metal, rough)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bs = nodes.get('Principled BSDF')
    coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeVectorMath'); mapping.operation='MULTIPLY'
    mapping.inputs[1].default_value = (1.5, 38, 5) if kind=='wood' else (1, 1, 1)
    links.new(coord.outputs['Object'], mapping.inputs[0])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3.5 if kind=='wood' else 5
    noise.inputs['Detail'].default_value = 5
    noise.inputs['Roughness'].default_value = .72
    links.new(mapping.outputs[0], noise.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position=.16
    ramp.color_ramp.elements[0].color=(*dark,1)
    ramp.color_ramp.elements[1].position=.84
    ramp.color_ramp.elements[1].color=(*pale,1)
    links.new(noise.outputs['Fac'],ramp.inputs[0]); links.new(ramp.outputs[0],bs.inputs['Base Color'])
    fine=nodes.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value=90 if kind=='wood' else 72
    fine.inputs['Detail'].default_value=3
    links.new(mapping.outputs[0],fine.inputs['Vector'])
    bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.42
    bump.inputs['Distance'].default_value=.012 if kind=='wood' else .028
    links.new(fine.outputs['Fac'],bump.inputs['Height'])
    broad=nodes.new('ShaderNodeBump'); broad.inputs['Strength'].default_value=.33
    broad.inputs['Distance'].default_value=.006 if kind=='wood' else .095
    links.new(noise.outputs['Fac'],broad.inputs['Height'])
    links.new(broad.outputs[0],bump.inputs['Normal']); links.new(bump.outputs[0],bs.inputs['Normal'])
    return mat


def palette():
    global P
    P = {
        'rock': textured('Fractured slate · mineral grain',(.026,.032,.031),(.17,.18,.16)),
        'rock2': textured('Weathered stone · strata',(.038,.044,.039),(.22,.21,.17)),
        'rock3': textured('Deep mineral seams',(.012,.017,.018),(.07,.08,.075)),
        'stone': textured('Weathered limestone',(.095,.105,.10),(.25,.26,.23)),
        'soil': textured('Damp earth',(.024,.019,.013),(.095,.078,.042)),
        'jade': material('Muted green enamel',(.07,.13,.105),metal=.22,rough=.34),
        'teal': material('Charcoal painted steel',(.018,.032,.036),metal=.35,rough=.32),
        'glass': material('Blue grey architectural glazing',(.072,.12,.14),metal=.7,rough=.22),
        'glass2': material('Bronze architectural glazing',(.105,.098,.085),metal=.62,rough=.27),
        'glass3': material('Silver architectural glazing',(.19,.23,.24),metal=.65,rough=.28),
        'concrete': textured('Architectural concrete',(.18,.18,.16),(.36,.35,.31)),
        'brick': textured('Fired clay brick',(.12,.055,.035),(.28,.14,.08)),
        'brass': textured('Patinated brass',(.16,.105,.038),(.40,.29,.13),metal=.76,rough=.37),
        'copper': material('Oxidised copper',(.19,.10,.063),metal=.55,rough=.48),
        'wood': textured('Oiled walnut · long grain',(.055,.026,.012),(.24,.12,.048),'wood',rough=.46),
        'oak': textured('Worn oak · long grain',(.14,.074,.033),(.38,.24,.12),'wood',rough=.51),
        'paper': textured('Warm rag paper',(.65,.61,.51),(.89,.86,.75),rough=.86),
        'page': material('Fine page edges',(.55,.49,.38),rough=.8),
        'ink': material('Soft black rubber',(.012,.017,.02),rough=.57),
        'moss': textured('Ground moss',(.022,.045,.018),(.12,.16,.063)),
        'leaf': material('Leaf green',(.10,.17,.063),rough=.72),
        'leaf2': material('Shadow foliage',(.033,.077,.035),rough=.81),
        'leaf3': material('Young foliage',(.18,.24,.09),rough=.72),
        'clay': textured('Unglazed terracotta',(.22,.082,.043),(.45,.22,.11)),
        'leather': textured('Tanned leather',(.045,.018,.013),(.14,.060,.023),rough=.52),
        'linen': textured('Woven book cloth',(.13,.17,.18),(.26,.31,.30),rough=.9),
        'redcloth': textured('Burgundy book cloth',(.08,.024,.021),(.23,.075,.043),rough=.9),
        'light': material('Warm practical lights',(1,.67,.30),emission=3),
        'window': material('Warm occupied offices',(.83,.55,.26),emission=1.5),
        'window2': material('Cool occupied offices',(.54,.68,.72),emission=.75),
        'window3': material('Dim occupied offices',(.43,.34,.21),emission=.55),
        'screen': material('Screen glass',(.025,.065,.08),emission=.35),
        'steel': material('Brushed aluminium',(.30,.33,.34),metal=.83,rough=.3),
    }

def finish(obj, name, mat, bevel=0):
    obj.name = name
    if mat:
        obj.data.materials.append(P[mat] if isinstance(mat, str) else mat)
    if bevel:
        mod = obj.modifiers.new('Soft manufactured edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        mod = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    return obj


def box(name, loc, size, mat, bevel=0.007, rot=0):
    x,y,z=[d/2 for d in size]
    verts=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    obj=mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
    obj.location=loc; obj.rotation_euler.z=rot
    if bevel: finish(obj,name,None,bevel)
    return obj


def cylinder(name, loc, radius, depth, mat, vertices=32, top=None, bevel=0.006):
    upper=radius if top is None else top
    verts=[(r*math.cos(i*math.tau/vertices),r*math.sin(i*math.tau/vertices),z)
           for r,z in [(radius,-depth/2),(upper,depth/2)] for i in range(vertices)]
    faces=[tuple(reversed(range(vertices))),tuple(range(vertices,vertices*2))]
    faces.extend((i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices))
    obj=mesh(name,verts,faces,mat);obj.location=loc
    for face in list(obj.data.polygons)[2:]: face.use_smooth=True
    if bevel: finish(obj,name,None,bevel)
    return obj


def sphere(name, loc, scale, mat, subdivision=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivision, radius=1, location=loc)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, mat)


def rod(name, a, b, radius, mat, vertices=12):
    a, b = Vector(a), Vector(b)
    obj = cylinder(name, (a + b) / 2, radius, (b - a).length, mat, vertices, bevel=0)
    obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return obj


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat)


def curve(name, pts, radius, mat, cyclic=False):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 16
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(pts) - 1)
    for point, co in zip(spline.bezier_points, pts):
        point.co = co
        point.handle_left_type = 'AUTO'
        point.handle_right_type = 'AUTO'
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(P[mat])
    return obj


def light(name, loc, color, energy, size, target=None):
    data = bpy.data.lights.new(name, 'AREA' if target else 'POINT')
    data.color, data.energy = color, energy
    if target:
        data.shape, data.size = 'DISK', size
    else:
        data.shadow_soft_size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    if target:
        obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    return obj


def rock_fragment(name, loc, scale, rng, mat='rock', subdivision=2):
    obj=sphere(name,loc,scale,mat,max(2,subdivision))
    for v in obj.data.vertices:
        v.co *= 1+noise.noise_vector(v.co*3.8+Vector((loc[0],loc[1],loc[2]))).x*.19
    for poly in obj.data.polygons: poly.use_smooth=True
    obj.rotation_euler=(rng.uniform(-.3,.3),rng.uniform(-.3,.3),rng.uniform(0,math.tau))
    return obj


def foliage(name, center, scale, rng, count=220):
    # Hundreds of actual individual leaves, not polygonal lollipops.
    verts, faces=[],[]
    for i in range(count):
        a=rng.uniform(0,math.tau); t=rng.uniform(-1,1); rr=rng.random()**.34
        co=Vector((center[0]+math.cos(a)*math.sqrt(1-t*t)*scale[0]*rr,
                   center[1]+math.sin(a)*math.sqrt(1-t*t)*scale[1]*rr,
                   center[2]+t*scale[2]*rr))
        size=rng.uniform(.018,.048)
        u=Vector((math.cos(a),math.sin(a),rng.uniform(-.5,.5)))*size
        v=Vector((-math.sin(a),math.cos(a),rng.uniform(-.5,.8)))*size*.52
        n=len(verts); verts.extend([co-u,co-v,co+u,co+v]); faces.append((n,n+1,n+2,n+3))
    obj=mesh(name,verts,faces,'leaf')
    obj.data.materials.append(P['leaf2']); obj.data.materials.append(P['leaf3'])
    for poly in obj.data.polygons: poly.material_index=rng.choices([0,1,2],[4,4,1])[0]
    return obj


def foundation(seed):
    rng=random.Random(seed)
    count=120; rings=[]; vertices=[]
    contour=[1+.055*math.sin(i*.71)+.04*math.cos(i*.37)+rng.uniform(-.035,.035) for i in range(count)]
    # Uneven ledges and offset strata avoid the former perfectly conical plinth.
    profiles=[(1,.015,0,0),(.99,-.18,0,0),(.92,-.46,.02,.03),(.95,-.72,-.04,.03),
              (.78,-1.08,-.08,.10),(.72,-1.42,.10,.12),(.48,-1.88,.16,.15),
              (.36,-2.28,.28,.07),(.19,-2.68,.36,.12),(.08,-2.93,.44,.08)]
    expanded=[]
    for left,right in zip(profiles,profiles[1:]):
        for f in [0,.25,.5,.75]: expanded.append(tuple(a*(1-f)+b*f for a,b in zip(left,right)))
    expanded.append(profiles[-1]); profiles=expanded
    for k,(r,z,ox,oy) in enumerate(profiles):
        ring=[]
        for i in range(count):
            a=i*math.tau/count; radius=contour[i]*r*(1+rng.uniform(-.05,.05))
            zz=z+(0 if k==0 else .085*math.sin(i*.33+k*.2)+rng.uniform(-.033,.033))
            ring.append(len(vertices)); vertices.append((math.cos(a)*4.15*radius+ox,math.sin(a)*2.8*radius+oy,zz))
        rings.append(ring)
    faces=[tuple(rings[0])]
    for k in range(len(rings)-1):
        for i in range(count):
            a,b,c,d=rings[k][i],rings[k][(i+1)%count],rings[k+1][(i+1)%count],rings[k+1][i]
            faces.extend([(a,d,b),(b,d,c)])
    faces.append(tuple(reversed(rings[-1])))
    obj=mesh('Island · weathered stratified bedrock',vertices,faces,'rock')
    obj.data.materials.append(P['rock2']); obj.data.materials.append(P['rock3']); obj.data.materials.append(P['soil'])
    for poly in obj.data.polygons:
        poly.material_index=0
        poly.use_smooth=True
    obj.data.polygons[0].use_smooth=False
    obj.data.polygons[0].material_index=3
    for i in range(95):
        a=rng.uniform(0,math.tau); z=rng.uniform(-1.8,-.11)
        r=1-abs(z)*.21
        pos=(math.cos(a)*4.0*r,math.sin(a)*2.69*r,z)
        rock_fragment('Split rock · exposed strata',pos,(rng.uniform(.14,.39),rng.uniform(.13,.28),rng.uniform(.19,.55)),rng,'rock2' if i%7==0 else 'rock',1)
    for i in range(46):
        a=i*math.tau/46; r=rng.uniform(.90,.985)
        x,y=math.cos(a)*4.03*r,math.sin(a)*2.68*r
        rock_fragment('Broken perimeter stone',(x,y,.035),(rng.uniform(.12,.32),rng.uniform(.10,.26),rng.uniform(.07,.17)),rng,'rock2',1)
        if i%3!=0:
            foliage('Moss at the cliff edge',(x,y,.095),(.22,.17,.045),rng,75)
        if i%4==0:
            end=rng.uniform(.4,1.2)
            pts=[(x*(1-t*.08),y*(1-t*.08),.06-t*end) for t in [0,.25,.5,.75,1]]
            curve('Trailing creeper',pts,.008,'moss')
            for t in [.15,.36,.58,.8]: foliage('Cliffside trailing leaves',(x*(1-t*.08),y*(1-t*.08),.06-t*end),(.09,.09,.16),rng,38)
    for i in range(35):
        x=rng.uniform(-3.6,3.6); y=rng.uniform(-2.2,2.2)
        if (x/4)**2+(y/2.6)**2<.96:
            rock_fragment('Surface gravel',(x,y,.05),(.035,.045,.025),rng,'stone',1)


def tree(x,y,scale=1):
    rng=random.Random(int((x+10)*109+(y+10)*170))
    trunk=.012*scale
    rod('Tree · fine bark trunk',(x,y,.055),(x,y,.52*scale),trunk,'wood')
    for i in range(7):
        a=rng.uniform(0,math.tau)
        p=(x+math.cos(a)*.12*scale,y+math.sin(a)*.12*scale,(.42+i*.046)*scale)
        rod('Tree · branch',(x,y,.32*scale),p,.006*scale,'wood')
        foliage('Tree · fine canopy',p,(.16*scale,.15*scale,.16*scale),rng,100)

def plant(x,y,z,scale=1):
    rng=random.Random(int((x+12)*190+(y+7)*141))
    cylinder('Planter · tapered earthenware',(x,y,z+.17*scale),.14*scale,.34*scale,'clay',64,top=.20*scale,bevel=.006)
    torus('Planter · rolled rim',(x,y,z+.336*scale),.194*scale,.016*scale,'clay')
    cylinder('Planter · dark earth',(x,y,z+.327*scale),.178*scale,.008,'soil',48,bevel=0)
    for i in range(11):
        a=i*2.399; h=rng.uniform(.43,.86)*scale; r=rng.uniform(.14,.36)*scale
        end=Vector((x+math.cos(a)*r,y+math.sin(a)*r,z+h))
        start=Vector((x,y,z+.30*scale))
        curve('Plant · arching stem',[start,(start+end)/2+Vector((0,0,.09*scale)),end],.005*scale,'moss')
        forward=Vector((math.cos(a),math.sin(a),-.25))*.30*scale
        sideways=Vector((-math.sin(a),math.cos(a),0))*.095*scale
        verts=[]
        for j in range(9):
            t=j/8; center=end+forward*t+Vector((0,0,math.sin(t*math.pi)*.055*scale))
            width=math.sin(t*math.pi)**.7
            verts.extend([center-sideways*width-Vector((0,0,.024*width*scale)),center,center+sideways*width-Vector((0,0,.024*width*scale))])
        faces=[]
        for j in range(8):
            n=j*3; faces.extend([(n,n+3,n+4,n+1),(n+1,n+4,n+5,n+2)])
        leaf=mesh('Plant · curved living leaf',verts,faces,'leaf2' if i%3 else 'leaf')
        for poly in leaf.data.polygons: poly.use_smooth=True
        curve('Plant · central leaf vein',[verts[j*3+1] for j in range(9)],.0018*scale,'moss')


def window_grid(x,y,width,depth,height,seed,base=.10,spacing=.075):
    rng=random.Random(seed); verts=[]; faces=[]; mats=[]
    cols=max(3,int(width/spacing)); rows=max(3,int(height/.095))
    for side in ['front','right','back']:
        span=width if side!='right' else depth
        cols=max(3,int(span/spacing))
        for row in range(rows):
            for col in range(cols):
                h=base+height*(row+.5)/rows
                u=span*((col+.5)/cols-.5); w=span/cols*.37; hh=height/rows*.32
                if side=='front':
                    p=(x+u,y-depth/2-.0015,h)
                    quad=[(p[0]-w,p[1],h-hh),(p[0]+w,p[1],h-hh),(p[0]+w,p[1],h+hh),(p[0]-w,p[1],h+hh)]
                elif side=='back':
                    p=(x+u,y+depth/2+.0015,h)
                    quad=[(p[0]-w,p[1],h-hh),(p[0]+w,p[1],h-hh),(p[0]+w,p[1],h+hh),(p[0]-w,p[1],h+hh)]
                else:
                    p=(x+width/2+.0015,y+u,h)
                    quad=[(p[0],p[1]-w,h-hh),(p[0],p[1]+w,h-hh),(p[0],p[1]+w,h+hh),(p[0],p[1]-w,h+hh)]
                lit=rng.random()<(.38 if row%6<4 else .18)
                n=len(verts); verts.extend(quad); faces.append(tuple(range(n,n+4)))
                mats.append(rng.choices([0,1,2],[5,2,3])[0] if lit else 3)
                if lit and side=='front' and rng.random()<.014: WINDOWS.append(p)
    obj=mesh('Facade · individual office glazing',verts,faces,'window')
    for m in ['window2','window3','glass']: obj.data.materials.append(P[m])
    for poly,mat in zip(obj.data.polygons,mats): poly.material_index=mat


def building(x,y,width,depth,height,seed):
    rng=random.Random(seed); style=seed%5
    body=['glass','glass2','concrete','glass3','brick'][style]
    box('City · building mass',(x,y,.10+height/2),(width,depth,height),body,.004)
    window_grid(x,y,width,depth,height,seed,spacing=.068 if height>1 else .095)
    # Subtle mullions, roof parapets, rooftop equipment and different rooflines.
    for z in [.10+height, .10+height*.5] if style==2 else [.10+height]:
        box('Facade · slim stone band',(x,y,z),(width+.014,depth+.014,.018),'concrete',.002)
    for xx in [x-width/2+.014,x+width/2-.014]:
        box('Facade · corner mullion',(xx,y-depth/2-.003,.1+height/2),(.008,.008,height),'steel',0)
    if style==0:
        for i in range(max(2,int(width/.16))):
            xx=x-width/2+.065+i*.16
            box('Facade · vertical mullion',(xx,y-depth/2-.004,.1+height/2),(.008,.009,height),'steel',0)
    for i in range(rng.randint(1,3)):
        xx=x+rng.uniform(-.22,.22)*width; yy=y+rng.uniform(-.22,.22)*depth
        box('Roof · HVAC housing',(xx,yy,height+.137),(.11,.15,.073),'teal',.002)
        cylinder('Roof · ventilation fan',(xx,yy,height+.176),.037,.007,'steel',16,bevel=0)
    if style==1:
        rod('Roof · antenna',(x,y,height+.1),(x,y,height+rng.uniform(.28,.51)),.005,'steel')
    if height>1.3 and style==3:
        box('Roof · stepped crown',(x,y,height+.22),(width*.63,depth*.73,.24),'glass',.006)
        window_grid(x,y,width*.63,depth*.73,.20,seed+1,base=height+.10)


def tapered_tier(x,y,z,w,d,h):
    bottom=[(-w*.415,-d*.415),(w*.415,-d*.415),(w*.415,d*.415),(-w*.415,d*.415)]
    top=[(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]
    verts=[(x+a,y+b,z) for a,b in bottom]+[(x+a,y+b,z+h) for a,b in top]
    mesh('Taipei 101 · tapered curtain wall',verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'glass')
    for row in range(7):
        t=(row+.5)/7; ww=w*(.83+.17*t); dd=d*(.83+.17*t); zz=z+h*t
        # Fine continuous bands of blue glass and intermittent lit office panes.
        for side in ['front','right']:
            for col in range(9):
                u=(col+.5)/9-.5
                loc=(x+ww*u,y-dd/2-.001,zz) if side=='front' else (x+ww/2+.001,y+dd*u,zz)
                size=(ww/9*.78,.004,h/7*.63) if side=='front' else (.004,dd/9*.78,h/7*.63)
                box('101 · individual glazing panel',loc,size,'window2' if (row+col)%5==0 else 'glass3',0)
        box('101 · floor edge',(x,y,z+h*t),(ww+.009,dd+.009,.006),'steel',0)
    for xx,yy in [(-1,-1),(1,-1),(1,1),(-1,1)]:
        rod('101 · structural corner',(x+xx*w*.415,y+yy*d*.415,z),(x+xx*w*.5,y+yy*d*.5,z+h),.009,'steel')
    box('101 · thin pagoda ledge',(x,y,z+h),(w+.034,d+.034,.024),'glass3',.002)


def city():
    foundation(31)
    rng=random.Random(261)
    # City blocks and a finer street scale make the tower part of a real skyline.
    for y in [-1.65,-.82,.11,1.08]:
        box('Street · asphalt',(0,y,.036),(6.5,.19,.016),'ink',0)
        for x in [i*.32-3 for i in range(20)]: box('Street · dashed lane line',(x,y,.046),(.14,.01,.003),'page',0)
    for x in [-2.65,-1.28,1.13,2.59]:
        box('Street · asphalt',(x,-.13,.037),(.19,3.8,.015),'ink',0)
        for y in [-1.68,-.84,.12,1.08]:
            for j in range(5): box('Street · crosswalk',(x-.076+j*.038,y-.16,.049),(.019,.12,.004),'paper',0)
    lots=[(-2.12,1.36,.45,.48,1.65),(-1.62,1.49,.40,.49,2.28),(-.82,1.34,.49,.42,1.84),
          (-.29,1.32,.36,.43,1.32),(1.6,1.38,.50,.49,2.37),(2.18,1.35,.37,.52,1.62),
          (-3.02,.68,.37,.44,1.17),(-2.14,.55,.66,.60,1.76),(-1.56,.54,.35,.47,1.36),
          (-.82,.58,.37,.55,2.11),(1.63,.59,.59,.54,1.55),(2.25,.53,.36,.59,1.20),(3.04,.50,.35,.47,.97),
          (-3.06,-.31,.35,.60,.63),(-2.17,-.33,.62,.61,1.02),(-1.64,-.33,.33,.51,.78),
          (-.81,-.33,.34,.57,.95),(-.39,-.33,.35,.60,.77),(.45,-.35,.59,.57,1.14),
          (1.67,-.31,.61,.58,.84),(2.26,-.32,.35,.54,.67),(3.04,-.31,.39,.54,.82),
          (-2.15,-1.21,.55,.54,.54),(-1.65,-1.21,.32,.54,.43),(-.84,-1.22,.34,.51,.71),
          (-.39,-1.21,.38,.50,.49),(.11,-1.24,.42,.53,.64),(.66,-1.21,.34,.54,.52),
          (1.62,-1.22,.63,.56,.47),(2.25,-1.19,.35,.48,.62)]
    for i,lot in enumerate(lots): building(*lot,41+i)
    tx,ty=.35,.65
    box('101 · broad retail podium',(tx,ty,.26),(.91,.84,.37),'concrete',.009)
    window_grid(tx,ty,.91,.84,.35,98)
    box('101 · lower tower',(tx,ty,.70),(.55,.49,.52),'glass',.004)
    window_grid(tx,ty,.55,.49,.50,97,base=.44)
    for i in range(8):
        z=.98+i*.37; w=.64-i*.016
        tapered_tier(tx,ty,z,w,w*.9,.345)
    tapered_tier(tx,ty,3.965,.32,.29,.27)
    tapered_tier(tx,ty,4.24,.23,.21,.18)
    cylinder('101 · spire crown',(tx,ty,4.47),.079,.16,'glass3',8,top=.045,bevel=.002)
    rod('101 · antenna',(tx,ty,4.54),(tx,ty,5.02),.009,'steel')
    sphere('101 · navigation light',(tx,ty,4.99),(.018,.018,.024),'light')
    ANCHORS['landmark']=(tx,ty,3.30); ANCHORS['tower']=(tx,ty,4.22)
    # A leafy waterfront-like promenade, human-scale street furniture and cars.
    for i in range(18):
        x=-3.0+i*.35; y=-2.01+.18*math.sin(i*.32)
        tree(x,y,.48+rng.random()*.34)
    for x,y in [(-3.25,.95),(-2.73,1.67),(-1.12,1.93),(.36,1.87),(2.48,1.6),(3.18,.85),(3.24,-.8)]: tree(x,y,.65)
    for x in [-2.9,-2.15,-1.4,-.65,.1,.85,1.6,2.35]:
        rod('Streetlamp · pole',(x,-1.84,.055),(x,-1.84,.32),.008,'teal')
        rod('Streetlamp · arm',(x,-1.84,.32),(x+.07,-1.84,.34),.007,'teal')
        box('Streetlamp · light',(x+.075,-1.84,.34),(.085,.035,.021),'light',.003)
    for i in range(14):
        x=rng.uniform(-2.8,2.8); y=rng.choice([-.82,-1.65,.11])+.037
        box('Street · small vehicle',(x,y,.08),(.14,.063,.056),rng.choice(['clay','paper','teal']),.009)
        box('Vehicle · windscreen',(x+.008,y,.115),(.066,.055,.021),'glass',.004)
    for x in [-2.7,-1.7,.4,1.5,2.5]:
        for j in range(4): box('Promenade bench · slat',(x,-2.2+j*.019,.11),(.24,.014,.015),'wood',.002)
        for xx in [x-.09,x+.09]: rod('Bench · legs',(xx,-2.17,.04),(xx,-2.17,.11),.009,'teal')

def torus(name,loc,major,minor,mat,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=40,minor_segments=8,location=loc,rotation=rotation)
    obj=bpy.context.object
    for face in obj.data.polygons: face.use_smooth=True
    return finish(obj,name,mat)


def desk_lamp(x,y,z,scale=1):
    cylinder('Lamp · cast iron foot',(x,y,z+.035*scale),.27*scale,.07*scale,'teal',64,bevel=.008)
    torus('Lamp · foot ring',(x,y,z+.065*scale),.225*scale,.007*scale,'steel')
    a=(x,y,z+.08*scale); b=(x-.24*scale,y,z+.85*scale); c=(x+.32*scale,y,z+1.45*scale)
    for off in [-.042,.042]:
        rod('Lamp · lower articulated rail',(a[0]+off,y,a[2]),(b[0]+off,y,b[2]),.014*scale,'teal')
        rod('Lamp · upper articulated rail',(b[0]+off,y,b[2]),(c[0]+off,y,c[2]),.014*scale,'teal')
    for j,p in enumerate([a,b,c]):
        rod('Lamp · hinge barrel',(p[0],y-.045*scale,p[2]),(p[0],y+.045*scale,p[2]),.044*scale,'teal',24)
        rod('Lamp · hinge screw',(p[0],y-.052*scale,p[2]),(p[0],y-.047*scale,p[2]),.021*scale,'steel',24)
    # Closely wound mechanical springs are visible between the articulated rails.
    for dx in [-.046,.046]:
        pts=[(x+dx+.017*math.cos(i*math.tau/8)*scale,y+.018*math.sin(i*math.tau/8)*scale,z+(.17+i*.006)*scale) for i in range(44)]
        curve('Lamp · tension spring',pts,.003*scale,'steel')
    curve('Lamp · fabric power cable',[(x-.08,y+.05,z+.10),(b[0]-.055,y+.04,b[2]),(c[0],y+.04,c[2])],.008*scale,'ink')
    shade=(c[0]+.09*scale,y,c[2]-.12*scale)
    cylinder('Lamp · spun metal shade',shade,.28*scale,.29*scale,'teal',64,top=.09*scale,bevel=.008)
    torus('Lamp · rolled shade lip',(shade[0],y,shade[2]-.145*scale),.279*scale,.009*scale,'steel')
    bulb=(shade[0],y,shade[2]-.15*scale)
    cylinder('Lamp · frosted diffuser',bulb,.25*scale,.009*scale,'light',64,bevel=0)
    practical=light('Desk lamp illumination',(bulb[0],bulb[1],bulb[2]-.07),(1,.72,.42),22*scale,.22*scale)
    ANCHORS['lamp']=bulb
    return practical


def book_stack(x,y,z):
    for i,(w,d,h,mat,a) in enumerate([(1.06,.72,.11,'linen',-.12),(.98,.70,.15,'redcloth',.03),(.90,.66,.10,'leather',-.04)]):
        box('Book · lower cloth cover',(x,y,z+.012),(w,d,.024),mat,.007,a)
        box('Book · paper block',(x,y,z+.025+h/2),(w-.035,d-.029,h),'paper',.004,a)
        for j in range(8):
            box('Book · cut page edge',(x,y-d/2+.005,z+.03+j*h/8),(w-.045,.004,.0015),'page',0,a)
        box('Book · rounded spine',(x-w/2+.018,y,z+.018+h/2),(.052,d,h+.025),mat,.012,a)
        z+=h+.032
        box('Book · upper cloth cover',(x,y,z),(w,d,.025),mat,.007,a)
        z+=.027


def floorboards():
    for i in range(22):
        x=(i-10.5)*.30; length=2.1*math.sqrt(max(0,1-(x/3.8)**2))
        box('Floor · aged oak plank',(x,0,.10),(.289,length*2,.095),'oak' if i%4==0 else 'wood',.006)
        for y in [-length+.10,length-.10]:
            for xx in [x-.095,x+.095]: cylinder('Floor · iron nail',(xx,y,.152),.007,.003,'ink',8,bevel=0)


def shelf_book(x,y,z,width,height,mat):
    depth=.34
    box('Library · page block',(x,y,z+height/2),(width-.021,depth-.025,height-.028),'paper',.003)
    for xx in [x-width/2,x+width/2]: box('Library · cloth board',(xx,y,z+height/2),(.014,depth,height),mat,.003)
    box('Library · bound spine',(x,y-depth/2,z+height/2),(width,.027,height),mat,.01)
    for zz in [z+.052,z+height-.064]:
        box('Library · gold spine tooling',(x,y-depth/2-.015,zz),(width*.8,.003,.007),'brass',.001)
    for j in range(3): box('Library · fine title impression',(x,y-depth/2-.015,z+height*.60+j*.017),(width*.52,.002,.003),'page',0)


def library_shelves():
    rng=random.Random(289)
    for x in [-2.27,2.27]: box('Library · upright',(x,1.71,1.66),(.095,.52,3.04),'wood',.007)
    for i in range(17): box('Library · back panel',(-2.18+i*.274,1.96,1.68),(.265,.055,2.99),'wood',.005)
    for z in [.21,.92,1.64,2.37,3.18]:
        box('Library · shelf',(0,1.68,z),(4.61,.61,.075),'oak',.006)
        if z<3:
            x=-2.12
            while x<2.03:
                w=rng.uniform(.085,.19); h=rng.uniform(.39,.63)
                if z==1.64 and -.65<x<.3:
                    x=.3; continue
                shelf_book(x+w/2,1.57,z+.042,w,h,rng.choice(['linen','leather','redcloth','teal','oak']))
                x+=w+rng.uniform(.008,.025)
    # A framed print and small ceramic vessel leave a breathing space in the books.
    box('Library · small oak frame',(-.21,1.47,1.94),(.57,.045,.47),'oak',.012)
    box('Library · print mount',(-.21,1.44,1.94),(.48,.014,.39),'paper',.001)
    for i in range(6): box('Library · ink landscape',(-.21,1.43,1.84+i*.015),(.32-i*.035,.003,.006),'ink',0)
    plant(2.38,1.6,.17,.75)


def page_height(x):
    return 1.535 + .068*math.sin(min(1,abs(x)/1.45)*math.pi) + .018*abs(x)


def writing():
    foundation(73); floorboards(); library_shelves()
    # A standing-height writing desk with mortise joinery and an open, readable notebook.
    for x in [-2.45,2.45]:
        for y in [-1.22,.76]:
            box('Desk · tapered walnut leg',(x,y,.72),(.12,.13,1.14),'wood',.006)
            box('Desk · brass foot',(x,y,.21),(.124,.134,.13),'brass',.004)
        box('Desk · stretcher',(x,-.22,.43),(.07,2.1,.09),'wood',.004)
    for y in [-1.27,.76]: box('Desk · apron',(0,y,1.22),(5.02,.10,.27),'wood',.005)
    for i in range(7): box('Desk · walnut board',(0,-1.26+i*.34,1.395),(5.55,.335,.14),'wood',.01)
    box('Desk · drawer front',(0,-1.329,1.22),(1.24,.075,.22),'oak',.006)
    for x in [-.37,.37]: sphere('Desk · small pull',(x,-1.393,1.22),(.028,.021,.028),'brass',3)
    for side in [-1,1]:
        box('Notebook · supple leather cover',(side*.77,-.35,1.49),(1.56,2.105,.035),'leather',.012)
        for layer in range(16):
            vertices=[]
            for yy in [-1.35,.65]:
                for i in range(49):
                    x=side*(.025+i/48*1.49)
                    vertices.append((x,yy,page_height(x)-layer*.0027))
            obj=mesh('Notebook · thin curved paper leaf',vertices,[(i,i+1,i+50,i+49) for i in range(48)],'paper' if layer%2==0 else 'page')
            for face in obj.data.polygons: face.use_smooth=True
    # Fine printed lines instead of thick decorative ruling.
    rng=random.Random(591)
    for side in [-1,1]:
        for line in range(19):
            yy=-1.20+line*.090; length=rng.uniform(.63,1.15)
            if line in [5,12]: continue
            pts=[(side*(.19+j/16*length),yy,page_height(side*(.19+j/16*length))+.002) for j in range(17)]
            curve('Notebook · ink line',pts,.0018,'page')
    curve('Notebook · ribbon bookmark',[(.02,.65,1.54),(.025,-.8,1.539),(.06,-1.44,1.45),(.14,-1.51,1.22)],.009,'redcloth')
    ANCHORS['spread']=[(-1.5,.65,page_height(1.5)),(1.5,.65,page_height(1.5)),(-1.5,-1.35,page_height(1.5))]
    ANCHORS['page']=[(.13,.56,1.544),(1.36,.56,page_height(1.36)+.003),(.13,-1.21,1.544)]
    ANCHORS['landmark']=(.1,-.32,1.55)
    practical=desk_lamp(-2.16,.32,1.47,.88)
    for f,e in [(1,24),(25,27),(49,24)]:
        practical.data.energy=e; practical.data.keyframe_insert(data_path='energy',frame=f)
    ANIMATED.append(practical)
    book_stack(2.05,.39,1.47)
    # Pen is beside the book, so it cannot collide with the site's live page overlay.
    rod('Pen · lacquer barrel',(-1.74,-1.04,1.49),(-1.75,-.31,1.49),.025,'ink',24)
    rod('Pen · nib',(-1.74,-1.04,1.49),(-1.738,-1.17,1.49),.013,'brass',12)
    rod('Pen · clip',(-1.72,-.35,1.50),(-1.72,-.53,1.50),.004,'brass')
    box('Ink bottle',(-2.24,-.64,1.60),(.22,.22,.24),'glass2',.014)
    cylinder('Ink bottle · ribbed cap',(-2.24,-.64,1.755),.087,.07,'teal',40,bevel=.003)
    for i in range(20):
        a=i*math.tau/20
        rod('Ink cap · knurl',(-2.24+.088*math.cos(a),-.64+.088*math.sin(a),1.725),(-2.24+.088*math.cos(a),-.64+.088*math.sin(a),1.785),.002,'steel')
    # Two thin spectacle rims, bridge and folded temples.
    for x in [1.89,2.19]: torus('Reading glasses · fine rim',(x,-.82,1.485),.135,.005,'brass')
    curve('Reading glasses · bridge',[(2.02,-.82,1.485),(2.04,-.80,1.49),(2.06,-.82,1.485)],.005,'brass')
    for x in [1.75,2.33]: curve('Reading glasses · temple',[(x,-.82,1.485),(x+.04,-.43,1.492),(x+.01,-.36,1.48)],.005,'brass')
    # A ceramic mug with a modelled handle and coffee surface.
    cylinder('Mug · ceramic body',(-1.42,.60,1.60),.11,.26,'linen',64,top=.13,bevel=.008)
    cylinder('Mug · coffee',(-1.42,.60,1.729),.114,.003,'leather',48,bevel=0)
    torus('Mug · ceramic rim',(-1.42,.60,1.731),.121,.006,'linen')
    torus('Mug · handle',(-1.57,.60,1.61),.076,.016,'linen',(math.pi/2,0,0))
    # A loose page has a subtle curl and lifts gently in the continuous loop.
    for j in range(2):
        verts=[]
        for row in range(2):
            for k in range(17):
                x=1.76+k*.046; yy=-1.31+row*.45; z=1.477+j*.006+.055*(k/16)**4
                verts.append((x,yy,z))
        leaf=mesh('Loose correspondence · curled corner',verts,[(k,k+1,k+18,k+17) for k in range(16)],'paper')
        for face in leaf.data.polygons: face.use_smooth=True
        for f,dz in [(1,0),(25,.018+j*.008),(49,0)]:
            leaf.location.z=dz; leaf.keyframe_insert(data_path='location',frame=f)
        ANIMATED.append(leaf)
    # Low reading stool on the side, below the book sightline.
    for x in [-3.03,-2.52]:
        for y in [-1.57,-1.07]: rod('Reading stool · turned leg',(x,y,.17),(x*.99,y*.98,.82),.028,'wood',24)
    box('Reading stool · leather cushion',(-2.78,-1.32,.87),(.70,.64,.15),'leather',.075)
    for i in range(23):
        x=-3.06+i*.026
        box('Reading stool · saddle stitch',(x,-1.637,.899),(.012,.003,.003),'page',0)
    plant(-3.02,1.07,.15,1.1)

def hammer(x,y,z):
    rod('Hammer · hickory handle',(x,y,z),(x,y,z+.52),.023,'oak',24)
    cylinder('Hammer · grip end',(x,y,z+.055),.026,.11,'leather',32,bevel=.003)
    box('Hammer · forged head',(x,y,z+.53),(.22,.073,.078),'steel',.01)
    rod('Hammer · striking face',(x-.10,y,z+.53),(x-.15,y,z+.53),.044,'steel',24)
    curve('Hammer · claw',[(x+.10,y,z+.53),(x+.18,y,z+.50),(x+.21,y,z+.46)],.018,'steel')


def workshop_details():
    rng=random.Random(613)
    # Fine joinery, dog holes and screws give the workbench a credible scale.
    for x in [-2.30,-1.95,-1.60,-1.25,-.9,-.55,-.2,.15,.5,.85,1.2,1.55,1.9,2.25]:
        cylinder('Bench · dog hole',(x,-.76,1.473),.016,.002,'ink',16,bevel=0)
    for x in [-2.2,2.2]:
        for y in [-.73,.56]:
            rod('Bench · stretcher',(x,y,.60),(-x,y,.60),.035,'wood')
            for z in [.82,1.02]:
                rod('Bench · exposed bolt',(x,y-.123,z),(x,y-.13,z),.020,'steel',6)
    for x in [-1.77,-.86,.03,.91,1.80]:
        box('Bench · joined timber seam',(x,-.05,1.471),(.004,1.85,.003),'wood',0)
    # Soldering station, iron and a curled cable on the left side of the bench.
    box('Soldering station · steel case',(-1.35,-.18,1.60),(.37,.36,.24),'teal',.015)
    box('Soldering station · control plate',(-1.35,-.367,1.60),(.31,.012,.18),'steel',.002)
    box('Soldering station · readout',(-1.42,-.376,1.62),(.13,.004,.051),'screen',.003)
    rod('Soldering station · dial',(-1.25,-.38,1.59),(-1.25,-.394,1.59),.030,'ink',32)
    box('Soldering iron · rest',(-.99,.34,1.51),(.20,.36,.045),'steel',.006)
    rod('Soldering iron · handle',(-1.0,.15,1.56),(-1.0,.45,1.69),.025,'teal',32)
    rod('Soldering iron · heated shaft',(-1.0,.45,1.69),(-1.0,.64,1.78),.010,'steel')
    curve('Soldering iron · cable',[(-1.0,.16,1.55),(-1.12,-.05,1.51),(-1.7,-.1,1.49),(-1.72,-.5,1.49),(-1.46,-.48,1.49),(-1.34,-.22,1.57)],.008,'ink')
    # Actual PCB, connectors, sensor cable and axle hardware on the prototype.
    box('Prototype · circuit board',(-.45,-.13,1.735),(.46,.30,.015),'jade',.002)
    for i in range(10):
        x=-.63+(i%5)*.088; y=-.23+(i//5)*.15
        box('Prototype · surface component',(x,y,1.751),(.040,.025,.018),'ink',.002)
    box('Prototype · microcontroller',(-.46,-.13,1.76),(.13,.105,.030),'teal',.002)
    for i in range(7):
        x=-.513+i*.018
        for y in [-.198,-.062]: box('Prototype · soldered pin',(x,y,1.75),(.005,.025,.007),'steel',0)
    for x in [-.65,-.25]:
        for y in [-.27,.01]: cylinder('Prototype · mounting screw',(x,y,1.755),.012,.008,'steel',12,bevel=0)
    for k in range(3): curve('Prototype · jumper wire',[(-.57+k*.035,-.22,1.77),(-.58+k*.045,-.10,1.91),(-.47+k*.035,-.10,1.86)],.005,'clay' if k==0 else 'ink')
    for x in [-.68,-.22]:
        for y in [-.438,.178]:
            rod('Prototype · wheel hub',(x,y-.006,1.62),(x,y+.006,1.62),.046,'steel',24)
            for i in range(18):
                a=i*math.tau/18
                box('Prototype · tyre tread',(x+.128*math.cos(a),y,1.62+.128*math.sin(a)),(.021,.078,.012),'ink',.001)
    # Small measuring tools, wood offcuts and bench clutter placed with intent.
    box('Steel rule',(1.89,-.79,1.482),(.73,.045,.008),'steel',.001,rot=.08)
    for i in range(23): box('Steel rule · engraving',(1.56+i*.029,-.801,1.488),(.002,.015 if i%5 else .027,.002),'ink',0)
    for i in range(3): box('Wood offcut',(-1.88+i*.10,.17+i*.12,1.49+i*.028),(.41,.055,.025),'oak',.002,rot=-.16+i*.08)
    cylinder('Pencil cup',(2.12,.67,1.62),.12,.28,'steel',48,bevel=.006)
    cylinder('Pencil cup · dark opening',(2.12,.67,1.762),.107,.003,'ink',40,bevel=0)
    for i in range(6):
        x=2.12+rng.uniform(-.07,.07); y=.67+rng.uniform(-.07,.07)
        rod('Pencil',(x,y,1.63),(x+.02,y,2.0+rng.uniform(-.04,.09)),.011,'oak',6)
    # Wall electrical fittings and conduit bring the background down to human scale.
    curve('Workshop · steel conduit',[(-2.8,1.475,.46),(-2.8,1.475,1.48),(-2.75,1.475,1.55),(-2.5,1.475,1.55)],.010,'steel')
    box('Workshop · outlet',(-2.51,1.465,1.58),(.11,.034,.16),'paper',.004)
    for z in [1.55,1.62]:
        for x in [-2.53,-2.49]: box('Outlet · socket',(x,1.444,z),(.008,.004,.021),'ink',0)
    # Stacked drawers and jars with actual lids below the existing open shelf.
    for x in [1.0,1.43,1.86,2.29]:
        for z in [1.84,2.08]:
            box('Parts drawer · carcass',(x,1.30,z),(.405,.33,.22),'wood',.005)
            box('Parts drawer · face',(x,1.119,z),(.38,.027,.194),'oak',.004)
            box('Parts drawer · label',(x,1.102,z+.028),(.13,.003,.05),'paper',.002)
            rod('Parts drawer · pull',(x-.06,1.085,z-.04),(x+.06,1.085,z-.04),.008,'steel')
    # Hand saw replaces one repeated hammer, with individually modelled teeth.
    verts=[(-2.00,1.40,2.48),(-1.68,1.40,2.48),(-1.72,1.40,1.94),(-1.87,1.40,1.94)]
    mesh('Handsaw · tapered blade',verts,[(0,1,2,3)],'steel')
    for i in range(18):
        z=1.96+i*.028; x=-1.87-(z-1.94)*.13/.54
        mesh('Handsaw · tooth',[(x,1.40,z),(x-.014,1.40,z+.012),(x-.006,1.40,z+.026)],[(0,1,2)],'steel')
    curve('Handsaw · wooden grip',[(-1.99,1.39,2.51),(-1.99,1.39,2.70),(-1.69,1.39,2.70),(-1.68,1.39,2.50)],.025,'oak',True)
    # Fine coiled extension lead hanging from the side post.
    for i in range(5): torus('Workshop · coiled cable',(-3.035,1.405,1.43+i*.013),.20+i*.007,.008,'ink',(math.pi/2,0,0))
    curve('Workshop · cable tail',[(-3.19,1.4,1.4),(-3.20,1.4,1.04),(-3.14,1.4,.96)],.008,'ink')


def workshop():
    foundation(107)
    floorboards()
    for x in [-3.05,3.05]: box('Workshop · timber upright',(x,1.55,1.68),(.18,.22,3.05),'oak',.035)
    box('Workshop · upper beam',(0,1.55,3.14),(6.36,.28,.22),'oak',.03)
    box('Workshop · teal pegboard',(0,1.57,1.93),(5.88,.13,2.23),'linen',.008)
    # Many small pegboard perforations in one mesh.
    verts,faces=[],[]
    for row in range(13):
        for col in range(33):
            x=-2.8+col*.175; z=.96+row*.163; n=len(verts)
            verts.extend([(x-.013,1.498,z-.013),(x+.013,1.498,z-.013),(x+.013,1.498,z+.013),(x-.013,1.498,z+.013)])
            faces.append(tuple(range(n,n+4)))
    mesh('Workshop · pegboard holes',verts,faces,'ink')
    for x in [-2.45,-1.27]: hammer(x,1.38,1.97)
    for i,x in enumerate([-.64,-.30,.04,.38]):
        rod('Screwdriver · shaft',(x,1.37,1.99),(x,1.37,2.34),.014,'steel')
        rod('Screwdriver · handle',(x,1.37,2.34),(x,1.37,2.61),.027,'clay' if i%2 else 'ink')
    for x in [1.01,1.42]:
        rod('Pliers · left grip',(x-.09,1.37,1.94),(x+.035,1.37,2.38),.024,'clay')
        rod('Pliers · right grip',(x+.09,1.37,1.94),(x-.035,1.37,2.38),.024,'clay')
        rod('Pliers · jaws',(x,1.37,2.28),(x,1.37,2.58),.035,'steel')
    # A real bench, with joinery, shelf, drawers and a front vice.
    for x in [-2.20,2.2]:
        for y in [-.73,.56]: box('Bench · leg',(x,y,.71),(.21,.24,1.10),'oak',.03)
    box('Bench · lower shelf',(0,-.05,.47),(4.58,1.6,.14),'oak',.025)
    box('Bench · thick top',(0,-.05,1.36),(4.98,1.88,.22),'oak',.04)
    for x in [-1.38,-.45,.48]:
        box('Bench · drawer',(x,-.80,1.02),(.84,.24,.39),'wood',.025)
        rod('Drawer · pull',(x-.15,-.951,1.03),(x+.15,-.951,1.03),.025,'brass')
    box('Vice · fixed jaw',(-1.97,-.94,1.45),(.4,.31,.32),'steel',.035)
    box('Vice · sliding jaw',(-1.97,-1.18,1.39),(.41,.11,.26),'steel',.022)
    rod('Vice · screw',(-1.97,-1.0,1.26),(-1.97,-1.42,1.26),.035,'steel')
    rod('Vice · handle',(-2.13,-1.45,1.10),(-1.81,-1.45,1.40),.02,'brass')
    # Laptop: the projected glass is also the site's interactive screen plane.
    sx,sy,sz=1.43,.22,1.47
    box('Laptop · keyboard deck',(sx,sy-.32,sz),(.98,.67,.055),'teal',.045)
    for row in range(4):
        for col in range(10): box('Laptop · key',(sx-.39+col*.086,sy-.42+row*.08,sz+.033),(.061,.049,.012),'steel',.006)
    box('Laptop · trackpad',(sx,sy-.57,sz+.032),(.30,.14,.012),'glass',.01)
    box('Laptop · screen housing',(sx,sy,sz+.44),(1.02,.075,.79),'teal',.04)
    # A front plane, aligned to SVG's top-left, top-right, bottom-left corners.
    screen=[(sx-.455,sy-.042,sz+.79),(sx+.455,sy-.042,sz+.79),(sx-.455,sy-.042,sz+.10)]
    mesh('Laptop · screen glass',[screen[0],screen[1],(sx+.455,sy-.042,sz+.10),screen[2]],[(0,1,2,3)],'screen')
    ANCHORS['screen']=screen
    ANCHORS['landmark']=(sx,sy-.05,sz+.43)
    ANCHORS['screenGlow']=(sx,sy-.30,sz+.02)
    # Miniature rover being built on a gridded cutting mat.
    box('Cutting mat',(-.45,-.13,1.484),(1.3,.95,.022),'jade',.02)
    for i in range(7): box('Mat grid',(-1.05+i*.19,-.13,1.498),(.008,.83,.003),'leaf',0)
    for i in range(5): box('Mat grid',(-.45,-.52+i*.19,1.498),(1.19,.008,.003),'leaf',0)
    box('Rover · chassis',(-.45,-.13,1.62),(.58,.37,.19),'brass',.035)
    for x in [-.68,-.22]:
        for y in [-.39,.13]:
            wheel=cylinder('Rover · rubber tyre',(x,y,1.62),.13,.085,'ink',20,bevel=.02)
            wheel.rotation_euler.x=math.pi/2
    box('Rover · sensor',(-.45,-.12,1.82),(.17,.16,.19),'teal',.03)
    sphere('Rover · sensor lens',(-.45,-.22,1.84),(.047,.025,.047),'window2')
    desk_lamp(-1.65,.59,1.47,.58)
    # Shelf boxes and a solder spool make the space read as a workshop.
    box('Wall shelf',(1.74,1.33,2.68),(2.15,.48,.095),'oak',.02)
    for x,m in [(1.02,'clay'),(1.70,'jade'),(2.4,'oak')]:
        box('Parts bin',(x,1.23,2.92),(.53,.40,.38),m,.012)
        box('Parts bin · recessed opening',(x,1.23,3.115),(.47,.34,.004),'ink',.003)
        box('Parts bin label',(x,1.016,2.94),(.17,.004,.065),'paper',.002)
    for x,m in [(-1.4,'teal'),(-.42,'clay'),(.55,'jade')]: box('Under-bench storage',(x,-.12,.72),(.70,.75,.36),m,.035)
    cylinder('Solder spool',(.48,-.50,1.64),.15,.27,'copper')
    for z in [1.5,1.78]: cylinder('Solder spool rim',(.48,-.50,z),.17,.025,'ink')
    for x in [2.78,3.3]:
        for y in [-1.0,-.49]: rod('Stool · splayed leg',(x,y,.23),(3.04+(x-3.04)*.72,-.745+(y+.745)*.72,1.00),.045,'wood')
    cylinder('Stool · seat',(3.04,-.745,1.04),.43,.13,'oak',48)
    plant(-2.94,-1.2,.24,.95)
    plant(2.74,1.04,.24,.76)
    workshop_details()
    # Warm practical lights hung from a gently sagging cable.
    curve('Workshop · light cable',[(-3.04,1.34,3.11),(0,1.30,2.91),(3.04,1.34,3.11)],.013,'ink')
    ANCHORS['bulbs']=[]
    for x in [-2.65,-1.33,0,1.33,2.65]:
        z=2.92+(x/3)**2*.16
        rod('Bulb socket',(x,1.30,z),(x,1.30,z-.11),.025,'brass')
        pos=(x,1.30,z-.17)
        sphere('Workshop · frosted bulb',pos,(.033,.033,.047),'light')
        ANCHORS['bulbs'].append(pos)


def setup(world, width, samples, engine, device):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version=0
    palette()
    scene=bpy.context.scene
    scene.name=f'{world.title()} · Carter Wang'
    scene.render.engine=engine
    scene.render.resolution_x=width
    scene.render.resolution_y=round(width*2/3)
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=True
    scene.render.fps=12
    scene.frame_start=1; scene.frame_end=48
    scene.world=bpy.data.worlds.new('Studio ambience')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.27,.34,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.28
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=-.12
    if engine=='CYCLES':
        scene.cycles.samples=samples
        scene.cycles.use_denoising=True
        scene.cycles.max_bounces=6
        if device == 'METAL':
            prefs=bpy.context.preferences.addons['cycles'].preferences
            prefs.compute_device_type='METAL'
            prefs.get_devices()
            for dev in prefs.devices: dev.use=dev.type=='METAL'
            if any(dev.type=='METAL' for dev in prefs.devices): scene.cycles.device='GPU'
    return scene


def camera_and_lights(scene):
    # One camera direction across the set; frame from the model bounds.
    target=Vector((0,0,0))
    direction=Vector((7.5,-17,10)).normalized()
    data=bpy.data.cameras.new('Isometric portrait lens')
    camera=bpy.data.objects.new('Camera',data)
    bpy.context.collection.objects.link(camera)
    camera.location=direction*25
    camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    data.type='ORTHO'
    scene.camera=camera
    bpy.context.view_layer.update()
    inverse=camera.matrix_world.inverted()
    coords=[]
    graph=bpy.context.evaluated_depsgraph_get()
    for obj in scene.objects:
        if obj.type not in {'MESH','CURVE'}: continue
        evaluated=obj.evaluated_get(graph)
        geometry=evaluated.to_mesh()
        coords.extend(inverse@(obj.matrix_world@v.co) for v in geometry.vertices)
        evaluated.to_mesh_clear()
    xmin,xmax=min(c.x for c in coords),max(c.x for c in coords)
    ymin,ymax=min(c.y for c in coords),max(c.y for c in coords)
    rotation=camera.rotation_euler.to_matrix()
    target=rotation@Vector(((xmin+xmax)/2,(ymin+ymax)/2,0))
    camera.location=target+direction*25
    data.ortho_scale=max((xmax-xmin)/.88,(ymax-ymin)*1.5/.88)
    light('Key · large warm softbox',(-5,-7,10),(1,.83,.65),780,7,(0,0,0))
    light('Fill · cool silk',(6,-3,5),(.49,.72,1),420,6,(0,0,.5))
    light('Rim · warm skylight',(1,6,8),(1,.72,.43),980,5,(0,0,.5))
    light('Basalt bounce',(0,-4,-1),(.48,.57,.64),85,5,(0,0,-.8))
    bpy.context.view_layer.update()
    return camera


def projected(scene, point):
    v=world_to_camera_view(scene,scene.camera,Vector(point))
    return [round(v.x*1200,3),round((1-v.y)*800,3)]


def export_anchors(scene, world, path):
    result={'width':1200,'height':800,'src':f'/blender/island-{world}.webp'}
    for key,value in ANCHORS.items():
        if isinstance(value,list): result[key]=[projected(scene,v) for v in value]
        else: result[key]=projected(scene,value)
    if WINDOWS: result['windows']=[projected(scene,p) for p in WINDOWS]
    path.write_text(json.dumps(result,indent=2)+'\n')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--world',choices=['work','writing','projects','all'],default='all')
    parser.add_argument('--output',type=Path,default=Path('/tmp/carter-islands'))
    parser.add_argument('--width',type=int,default=1600)
    parser.add_argument('--samples',type=int,default=48)
    parser.add_argument('--engine',default='CYCLES')
    parser.add_argument('--device',choices=['CPU','METAL'],default='CPU')
    parser.add_argument('--animate',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.output.mkdir(parents=True,exist_ok=True)
    sources=ROOT/'artwork'/'blender'
    sources.mkdir(parents=True,exist_ok=True)
    for world in (['work','writing','projects'] if args.world=='all' else [args.world]):
        ANCHORS.clear(); WINDOWS.clear(); ANIMATED.clear()
        scene=setup(world,args.width,args.samples,args.engine,args.device)
        {'work':city,'writing':writing,'projects':workshop}[world]()
        camera_and_lights(scene)
        scene.frame_set(1)
        export_anchors(scene,world,args.output/f'{world}.json')
        scene.render.filepath=str(args.output/f'{world}.png')
        bpy.ops.wm.save_as_mainfile(filepath=str(sources/f'{world}.blend'),compress=True)
        bpy.ops.render.render(write_still=True)
        if args.animate and world=='writing':
            frames=args.output/'writing-frames'
            frames.mkdir(exist_ok=True)
            scene.render.resolution_x=1200; scene.render.resolution_y=800
            if args.engine=='CYCLES': scene.cycles.samples=24
            # Animation stays on a fixed camera so the live page still aligns.
            for frame in range(1,49):
                scene.frame_set(frame)
                scene.render.filepath=str(frames/f'{frame}.png')
                bpy.ops.render.render(write_still=True)
        print(f'COMPLETED {world}',flush=True)


if __name__=='__main__':
    main()
