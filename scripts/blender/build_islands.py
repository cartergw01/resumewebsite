"""Model and render Carter's islands with geometry and procedural materials.

blender -b --factory-startup --python scripts/blender/build_islands.py -- \
  --world all --output /tmp/carter-islands --samples 48 --width 1600

The saved scenes, camera-projected interaction anchors and web renders all
come from this source. Dimensions use Blender
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
    bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.18
    bump.inputs['Distance'].default_value=.0015 if kind=='wood' else .005
    links.new(fine.outputs['Fac'],bump.inputs['Height'])
    broad=nodes.new('ShaderNodeBump'); broad.inputs['Strength'].default_value=.15
    broad.inputs['Distance'].default_value=.002 if kind=='wood' else .013
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
        'glass': material('Blue green architectural glazing',(.045,.115,.115),metal=.48,rough=.17),
        'glass2': material('Bronze architectural glazing',(.105,.098,.085),metal=.62,rough=.27),
        'glass3': material('Silver architectural glazing',(.19,.23,.24),metal=.65,rough=.28),
        'concrete': textured('Architectural concrete',(.22,.225,.21),(.28,.286,.266)),
        'brick': textured('Fired clay brick',(.12,.055,.035),(.28,.14,.08)),
        'brass': textured('Patinated brass',(.16,.105,.038),(.40,.29,.13),metal=.76,rough=.37),
        'copper': material('Oxidised copper',(.19,.10,.063),metal=.55,rough=.48),
        'wood': textured('Oiled walnut · long grain',(.055,.026,.012),(.24,.12,.048),'wood',rough=.46),
        'oak': textured('Worn oak · long grain',(.14,.074,.033),(.38,.24,.12),'wood',rough=.51),
        'paper': textured('Warm rag paper',(.72,.70,.65),(.86,.84,.79),rough=.82),
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
        'window': material('Warm occupied offices',(.83,.55,.26),emission=.65),
        'window2': material('Cool occupied offices',(.54,.68,.72),emission=.42),
        'window3': material('Dim occupied offices',(.43,.34,.21),emission=.28),
        'screen': material('Screen glass',(.025,.065,.08),emission=.35),
        'pane2': material('Slightly warmer reflective glass',(.046,.084,.078),metal=.34,rough=.19),
        'pane3': material('Slightly cooler reflective glass',(.042,.079,.091),metal=.38,rough=.15),
        'paving': textured('Urban pavers',(.085,.087,.082),(.16,.165,.157),rough=.77),
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


def box(name, loc, size, mat, bevel=0.003, rot=0):
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


def foliage(name, center, scale, rng, count=220):
    # Hundreds of actual individual leaves, not polygonal lollipops.
    verts, faces=[],[]
    for i in range(count):
        a=rng.uniform(0,math.tau); t=rng.uniform(-1,1); rr=rng.random()**.34
        co=Vector((center[0]+math.cos(a)*math.sqrt(1-t*t)*scale[0]*rr,
                   center[1]+math.sin(a)*math.sqrt(1-t*t)*scale[1]*rr,
                   center[2]+t*scale[2]*rr))
        size=rng.uniform(.018,.048)*min(1,max(scale)*4)
        u=Vector((math.cos(a),math.sin(a),rng.uniform(-.5,.5)))*size
        v=Vector((-math.sin(a),math.cos(a),rng.uniform(-.5,.8)))*size*.52
        n=len(verts); verts.extend([co-u,co-v,co+u,co+v]); faces.append((n,n+1,n+2,n+3))
    obj=mesh(name,verts,faces,'leaf')
    obj.data.materials.append(P['leaf2']); obj.data.materials.append(P['leaf3'])
    for poly in obj.data.polygons: poly.material_index=rng.choices([0,1,2],[4,4,1])[0]
    return obj


def foundation(seed):
    rng=random.Random(seed)
    count=144; verts=[]; rings=[]
    # A continuous fractured mass: broad geological forms, no repeated boulders.
    contour=[1+.055*math.sin(i*math.tau/count*3)+.035*math.cos(i*math.tau/count*7) for i in range(count)]
    for k in range(33):
        t=k/32; z=-3.05*t
        radius=(1-t)**.80*.975+.025
        ring=[]
        for i in range(count):
            a=i*math.tau/count
            layer=.035*math.sin(t*math.pi*13+a*3)+.04*math.cos(a*11+t*8)
            n=noise.noise_vector(Vector((math.cos(a)*3.1,math.sin(a)*3.1,t*6)),noise_basis='PERLIN_ORIGINAL').x
            r=radius*contour[i]*(1+layer+n*.19)
            zz=z+(0 if k==0 else .045*math.sin(a*7+t*8))
            ring.append(len(verts));verts.append((math.cos(a)*4.1*r+.3*t,math.sin(a)*2.95*r+.15*t,zz))
        rings.append(ring)
    faces=[tuple(reversed(rings[0]))]
    for k in range(32):
        for i in range(count):
            j=(i+1)%count
            faces.extend([(rings[k][i],rings[k+1][i],rings[k][j]),(rings[k][j],rings[k+1][i],rings[k+1][j])])
    obj=mesh('Island · eroded basalt escarpment',verts,faces,'rock')
    obj.data.materials.append(P['soil'])
    for poly in obj.data.polygons: poly.use_smooth=True
    obj.data.polygons[0].material_index=1;obj.data.polygons[0].use_smooth=False
    for i in range(28):
        a=i*math.tau/28;r=rng.uniform(.93,.985)
        x,y=math.cos(a)*4.0*r,math.sin(a)*2.85*r
        if i%3==0:
            foliage('Crevice vegetation',(x,y,.035),(.19,.11,.05),rng,80)
            pts=[(x*(1-t*.05),y*(1-t*.05),.04-t*.55) for t in [0,.3,.6,1]]
            curve('Roots following a fissure',pts,.004,'wood')
    # A few fine mineral veins break across the broad rock surface.
    for j in range(9):
        a=math.pi+j*.24
        pts=[]
        for k in range(10):
            t=.08+k*.068;r=(1-t)**.80*.985
            pts.append((math.cos(a)*4.1*r+.3*t,math.sin(a)*2.95*r+.15*t,-3.05*t))
        curve('Basalt · hairline fault',pts,.005,'rock3')


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
    cols=max(3,int(width/spacing)); rows=max(3,int(height/.038))
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
                lit=rng.random()<(.22 if row%6<4 else .07)
                n=len(verts); verts.extend(quad); faces.append(tuple(range(n,n+4)))
                mats.append(rng.choices([0,1,2],[5,2,3])[0] if lit else 3)
                if lit and side=='front' and rng.random()<.014: WINDOWS.append(p)
    obj=mesh('Facade · individual office glazing',verts,faces,'window')
    for m in ['window2','window3','glass']: obj.data.materials.append(P[m])
    for poly,mat in zip(obj.data.polygons,mats): poly.material_index=mat


def chamfered_square(width,cut=.10):
    h=width/2;c=width*cut
    return [(-h+c,-h),(h-c,-h),(h,-h+c),(h,h-c),(h-c,h),(-h+c,h),(-h,h-c),(-h,-h+c)]


def curtain_tower(name,x,y,z,width,topwidth,height,floors,seed=1,mat='glass',columns=24):
    """Glazing follows the actual sloping planes; fine mullions retain scale."""
    rng=random.Random(seed);lower=chamfered_square(width);upper=chamfered_square(topwidth)
    verts=[(x+a,y+b,z) for a,b in lower]+[(x+a,y+b,z+height) for a,b in upper]
    mesh(name+' · core',verts,[tuple(reversed(range(8))),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)],mat)
    vs=[];fs=[];ms=[]
    for side in range(8):
        a,b=Vector((*lower[side],0)),Vector((*lower[(side+1)%8],0))
        c,d=Vector((*upper[side],height)),Vector((*upper[(side+1)%8],height))
        normal=Vector(((b-a).y,-(b-a).x,0)).normalized()*.0007
        cols=columns if side%2==0 else max(2,columns//5)
        def pt(u,v): return Vector((x,y,z))+(a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v+normal
        for row in range(floors):
            # Occupied suites form clusters instead of a uniform checkerboard.
            occupied=rng.random()<.37
            for col in range(cols):
                u0=(col+.065)/cols;u1=(col+.935)/cols
                v0=(row+.12)/floors;v1=(row+.87)/floors
                n=len(vs);vs.extend([pt(u0,v0),pt(u1,v0),pt(u1,v1),pt(u0,v1)]);fs.append((n,n+1,n+2,n+3))
                ms.append(rng.choice([1,2,3]) if occupied and rng.random()<.26 else rng.choice([0,0,0,4,5]))
                if ms[-1]==1 and side==0 and rng.random()<.01: WINDOWS.append(tuple(pt((u0+u1)/2,(v0+v1)/2)))
        for col in range(cols+1):
            rod(name+' · narrow aluminium mullion',pt(col/cols,0),pt(col/cols,1),.0008,'steel',4)
        for row in range(floors+1): rod(name+' · transom',pt(0,row/floors),pt(1,row/floors),.0008,'teal',4)
    obj=mesh(name+' · individually glazed panes',vs,fs,mat)
    for m in ['window','window2','window3','pane2','pane3']:obj.data.materials.append(P[m])
    for poly,m in zip(obj.data.polygons,ms):poly.material_index=m


def taipei101(x,y):
    # 1 unit = 100m. Eight equal 8-floor modules above a separate tapering base.
    # Dimensions below are reference-based approximations, not construction data.
    curtain_tower('101 lower shaft',x,y,.07,.68,.43,1.12,26,81,columns=28)
    for i in range(8):
        z=1.19+i*.337
        curtain_tower(f'101 module {i+1}',x,y,z,.432,.516,.323,8,101+i,columns=24)
        for side in range(8):
            poly=chamfered_square(.522)
            aa,bb=poly[side],poly[(side+1)%8]
            rod('101 · restrained projecting cornice',(x+aa[0],y+aa[1],z+.326),(x+bb[0],y+bb[1],z+.326),.005,'jade',6)
        for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]:
            # Corner scrolls, kept much smaller than the curtain-wall module.
            curve('101 · corner ruyi',[(x+sx*.225,y+sy*.225,z+.30),(x+sx*.261,y+sy*.261,z+.322),(x+sx*.258,y+sy*.258,z+.35)],.0045,'jade')
    curtain_tower('101 observation crown',x,y,3.894,.34,.37,.35,8,179,columns=16)
    curtain_tower('101 upper crown',x,y,4.249,.19,.205,.205,5,189,columns=9)
    cylinder('101 · antenna pedestal',(x,y,4.48),.080,.055,'jade',8,top=.061,bevel=.002)
    for zz,rr in [(4.52,.052),(4.58,.046),(4.65,.035),(4.73,.025)]:
        cylinder('101 · spire lattice',(x,y,zz),rr,.09,'steel',8,top=rr*.75,bevel=0)
    rod('101 · final antenna',(x,y,4.73),(x,y,5.15),.006,'steel')
    for zz in [4.57,4.63,4.72]:cylinder('101 · service ring',(x,y,zz),.052,.009,'jade',16,bevel=0)
    sphere('101 · obstruction light',(x,y,5.15),(.005,.005,.008),'light',2)
    for sy in [-1,1]:
        coin=torus('101 · round-and-square emblem',(x,y+sy*.263,1.13),.073,.010,'jade',(math.pi/2,0,0))
        box('101 · emblem center',(x,y+sy*.265,1.13),(.032,.015,.032),'jade',.001)
    ANCHORS['landmark']=(x,y,3.34);ANCHORS['tower']=(x,y,4.43)


def city_block(name,x,y,w,d,h,seed,style=0):
    rng=random.Random(seed)
    box(name+' · mass',(x,y,.055+h/2),(w,d,h),['concrete','glass','glass2','stone'][style%4],.001)
    # Hundreds of small panes, concrete piers, roof plant and recessed entrances.
    window_grid(x,y,w,d,h,seed,base=.055,spacing=.025 if h>1 else .032)
    rows=max(2,round(h/.038))
    for j in range(rows+1):
        box(name+' · floor slab',(x,y,.055+j*h/rows),(w+.003,d+.003,.004 if style else .007),'teal' if style else 'concrete',0)
    for side in [-1,1]:
        for j in range(max(2,int(w/.09))):
            xx=x-w/2+.035+j*.09
            box(name+' · facade pier',(xx,y+side*(d/2+.001),.055+h/2),(.007,.004,h),'steel' if style else 'concrete',0)
    box(name+' · roof slab',(x,y,h+.06),(w+.012,d+.012,.018),'concrete',.001)
    for j in range(3):
        xx=x+rng.uniform(-.25,.25)*w;yy=y+rng.uniform(-.25,.25)*d
        box(name+' · roof mechanical',(xx,yy,h+.088),(.045,.073,.035),'steel',.001)
        for k in range(4):box(name+' · condenser louvre',(xx,yy-.029+k*.018,h+.107),(.040,.004,.002),'ink',0)
    for xx in [x-w*.22,x+w*.22]:box(name+' · entry',(xx,y-d/2-.006,.09),(.05,.025,.07),'glass',.001)


def street(a,b,width):
    delta=Vector(b)-Vector(a);angle=math.atan2(delta.y,delta.x);center=(Vector(a)+Vector(b))/2
    box('Street · curb and sidewalk',(center.x,center.y,.031),(delta.length,width+.10,.018),'concrete',.001,angle)
    box('Street · asphalt',(center.x,center.y,.042),(delta.length,width,.008),'ink',0,angle)
    direction=delta.normalized();normal=Vector((-direction.y,direction.x))
    for t in range(int(delta.length/.085)):
        p=Vector(a)+direction*(t*.085+.025)
        box('Street · lane marking',(p.x,p.y,.047),(.035,.004,.001),'paper',0,angle)
    for end in [.17,delta.length-.17]:
        p=Vector(a)+direction*end
        for i in range(8):
            q=p+normal*((i-3.5)*width/9)
            box('Street · zebra crossing',(q.x,q.y,.048),(.068,width/18,.001),'paper',0,angle)


def city():
    P['glass']=material('Taipei · green architectural glazing',(.055,.135,.11),metal=.48,rough=.17)
    foundation(31);rng=random.Random(263)
    ground=bpy.data.objects['Island · eroded basalt escarpment'];ground.data.materials[1]=P['paving']
    # A compressed Xinyi composition. North is +Y; east is +X.
    # Xinyi Road, City Hall Road, Songzhi Road and Songshou Road frame the blocks.
    street((-3.35,-.95),(3.25,-.95),.24)
    street((-1.05,-2.1),(-1.05,2.2),.18)
    street((1.55,-2.0),(1.55,2.2),.17)
    street((-3.3,1.35),(3.25,1.35),.18)
    street((-3.15,.12),(-1.17,.12),.13)
    street((2.70,-1.95),(2.70,1.65),.14)
    tx,ty=.52,-.39
    # The low mall adjoins the tower northwards; repeated sawtooth roof skylights.
    box('Taipei 101 · mall podium',(.34,.47,.245),(1.64,1.22,.41),'concrete',.004)
    window_grid(.34,.47,1.64,1.22,.37,177,base=.05,spacing=.025)
    for j in range(10):
        x=-.39+j*.152
        mesh('101 mall · glazed roof lantern',[(x,.02,.456),(x+.11,.02,.456),(x+.055,.02,.52),(x,1,.456),(x+.11,1,.456),(x+.055,1,.52)],[(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)],'glass')
    taipei101(tx,ty)
    # Taipei World Trade Center: broad courtyard block immediately west.
    for x,y,w,d in [(-2.10,-.41,1.50,.25),(-2.10,.49,1.50,.25),(-2.78,.04,.20,.82),(-1.43,.04,.20,.82)]:
        city_block('World Trade Center',x,y,w,d,.33,202,0)
    box('TWTC · recessed courtyard',(-2.10,.04,.04),(1.18,.56,.01),'stone',0)
    # Grand Hyatt north of the trade center, with a stepped shoulder profile.
    city_block('Grand Hyatt main volume',-2.15,.95,1.08,.34,1.04,215,0)
    for x in [-2.79,-1.51]:city_block('Grand Hyatt wing',x,.89,.25,.43,.87,216,0)
    # Nan Shan's paired blades are the front/back edges of one folded tower,
    # not two pyramidal roofs. See Mitsubishi Jisho Design's project photograph.
    for j in range(3):
        box('Nan Shan · planted retail terrace',(2.09,.19+j*.055,.15+j*.15),(.94-j*.11,1.12-j*.09,.14),'glass2',.002)
        box('Nan Shan · terrace coping',(2.09,.19+j*.055,.225+j*.15),(.96-j*.11,1.14-j*.09,.015),'steel',.001)
        for i in range(7):tree(1.69+i*.12,-.28+j*.09,.16)
    nx,ny=2.13,.72
    curtain_tower('Nan Shan · continuous folded shaft',nx,ny,.06,.48,.54,2.44,44,312,mat='glass3',columns=26)
    for side in [-1,1]:
        yy=ny+side*.263
        verts=[(nx-.27,yy,2.45),(nx+.27,yy,2.45),(nx+.27,yy,2.79),(nx-.27,yy,2.72)]
        mesh('Nan Shan · glazed crown blade',verts,[(0,1,2,3)],'glass3')
        for i in range(28):
            xx=nx-.27+i*.02;top=2.72+i/27*.07
            rod('Nan Shan · crown vertical fin',(xx,yy,2.43),(xx,yy,top),.0022,'steel',4)
        rod('Nan Shan · sloping crown rim',verts[3],verts[2],.003,'steel',4)
        for z in [2.49,2.58,2.67]:rod('Nan Shan · crown transom',(nx-.27,yy,z),(nx+.27,yy,z),.002,'steel',4)
    box('Nan Shan · recessed roof',(nx,ny,2.48),(.49,.47,.05),'teal',.001)
    for sx in [-1,1]:
        # A vertical side spine and diagonal fold distinguish its facades.
        box('Nan Shan · side spine',(nx+sx*.273,ny,1.32),(.014,.07,2.48),'concrete',.001)
        rod('Nan Shan · diagonal facet',(nx+sx*.274,ny-.20,.07),(nx+sx*.274,ny+.20,.68),.002,'steel',4)
    # The small Xinyi park and planted paths meet the retail terraces.
    box('Xinyi · planted plaza',(2.15,-.53,.057),(.93,.41,.026),'moss',.015)
    for x in [1.83,2.07,2.30,2.52]:tree(x,-.58,.22)
    # Department stores and office blocks north of Songshou, kept lower than 101.
    for args in [('Xinyi retail',-.42,1.90,.84,.66,.63,401,0),('Xinyi offices',.53,1.97,.68,.62,1.38,402,1),('Xinyi department store',1.92,1.90,.86,.62,.92,403,2),('Conference annex',-2.12,1.83,1.27,.48,.36,404,0)]:city_block(*args)
    # Landscaped pedestrian areas soften the edges of the city slice.
    for x,y,w,d in [(-3.25,.30,.36,1.63),(3.16,.36,.33,1.62),(-.07,-2.14,3.80,.22)]:
        box('City · planted perimeter',(x,y,.043),(w,d,.018),'moss',.01)
    # Older, narrower mixed-use blocks south of Xinyi Road.
    for i in range(20):
        x=-2.94+(i%10)*.62;y=-1.42-(i//10)*.52
        if abs(x)>2.8 and y<-1.7:continue
        w=rng.uniform(.22,.40);d=rng.uniform(.24,.34);h=rng.uniform(.20,.53)
        city_block('Xinyi · mixed-use frontage',x,y,w,d,h,480+i,i%4)
        if i%3==0:
            box('Street · shop canopy',(x,y-d/2-.018,.1),(w*.85,.09,.012),'jade',.002)
            for k in range(3):cylinder('Roof · water tank',(x-.08+k*.072,y,h+.125),.027,.077,'steel',20,bevel=.001)
    # Street trees are 8–12m tall, cars 4m long at the same scale as the tower.
    for i in range(38):
        x=-3.05+i*.16
        tree(x,-1.14,.14+rng.random()*.03)
        if i%2==0:tree(x,1.20,.15)
    for i in range(23):
        x=rng.uniform(-3.0,3.0);y=-.95+rng.choice([-.07,.07])
        box('Street · car',(x,y,.069),(.045,.018,.017),rng.choice(['paper','teal','glass2']),.004)
        box('Car · glazing',(x-.004,y,.079),(.023,.015,.008),'glass',.001)
    for i in range(24):
        x=-2.91+i*.055
        box('Parked scooter',(x,-1.10,.064),(.016,.007,.014),'teal',.002)
    for x in [-3,-2.4,-1.8,-.8,-.1,.7,1.8,2.4,3]:
        rod('Streetlamp',(x,-.77,.04),(x,-.77,.14),.0014,'steel',8)
        box('Streetlamp head',(x,-.78,.143),(.025,.008,.004),'light',.001)
    for i in range(170):
        x=rng.uniform(-3.65,3.65);y=rng.uniform(-2.3,2.3)
        if .69<(x/3.9)**2+(y/2.8)**2<.94:tree(x,y,.21+rng.random()*.045)


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


def transform_objects(objects,scale=(1,1,1),offset=(0,0,0),origin=(0,0,0)):
    from mathutils import Matrix
    transform=Matrix.Translation(Vector(offset)+Vector(origin)) @ Matrix.Diagonal((*scale,1)) @ Matrix.Translation(-Vector(origin))
    for obj in objects: obj.matrix_world=transform @ obj.matrix_world


def capture(fn,*args,scale=(1,1,1),offset=(0,0,0),origin=(0,0,0)):
    before=set(bpy.context.scene.objects);fn(*args)
    created=set(bpy.context.scene.objects)-before
    bpy.context.view_layer.update()
    transform_objects(created,scale,offset,origin)
    return created


def chair(x,y):
    # A usable chair: shaped seat, slender frame, an upholstered back and stitching.
    for xx in [-.37,.37]:
        for yy in [-.36,.36]:
            rod('Chair · tapered leg',(x+xx*1.16,y+yy*1.12,.16),(x+xx,y+yy,1.00),.024,'wood',20)
        rod('Chair · side rail',(x+xx,y-.36,.87),(x+xx,y+.36,.87),.026,'wood')
    seat=box('Chair · upholstered seat',(x,y,1.01),(.83,.83,.12),'leather',.055)
    for xx in [-.36,.36]:rod('Chair · back upright',(x+xx,y-.35,.93),(x+xx,y-.48,1.93),.025,'wood',20)
    box('Chair · curved back cushion',(x,y-.465,1.65),(.76,.08,.45),'leather',.035)
    for i in range(30):box('Chair · seam',(x-.35+i*.024,y-.509,1.85),(.009,.001,.002),'page',0)


def notebook(x,y,z):
    width=.92;depth=.64
    for side in [-1,1]:
        box('Notebook · soft cloth binding',(x+side*width/4,y,z+.006),(width/2+.009,depth+.025,.012),'linen',.003)
        for layer in range(12):
            verts=[]
            for yy in [-depth/2,depth/2]:
                for i in range(33):
                    xx=side*(.008+i/32*(width/2-.008))
                    zz=z+.020+layer*.0007+.012*math.sin(abs(xx)/(width/2)*math.pi)
                    verts.append((x+xx,y+yy,zz))
            obj=mesh('Notebook · individual paper sheet',verts,[(i,i+1,i+34,i+33) for i in range(32)],'paper')
            for f in obj.data.polygons:f.use_smooth=True
    ANCHORS['spread']=[(x-width/2,y+depth/2,z+.03),(x+width/2,y+depth/2,z+.03),(x-width/2,y-depth/2,z+.03),(x+width/2,y-depth/2,z+.03)]
    ANCHORS['page']=[(x+.022,y+.28,z+.039),(x+.424,y+.28,z+.036),(x+.022,y-.28,z+.039),(x+.424,y-.28,z+.036)]
    ANCHORS['landmark']=(x,y,z+.035)
    rng=random.Random(233)
    for j in range(16):
        yy=y-.275+j*.035
        box('Notebook · handwritten line',(x-.225,yy,z+.039),(rng.uniform(.19,.36),.001,.001),'page',0)
    curve('Notebook · silk bookmark',[(x,y+.31,z+.04),(x+.002,y-.30,z+.04),(x+.014,y-.40,z-.005)],.0025,'redcloth')


def writing():
    foundation(73);floorboards()
    # An open architectural section: plaster, a large window and built-in joinery.
    box('Study · plaster rear wall',(-.18,1.98,2.11),(6.1,.09,3.90),'concrete',.005)
    box('Study · left return',(-3.19,1.1,2.11),(.09,1.82,3.9),'concrete',.005)
    # Framed window to the left of the shelves; glass catches the cool sky.
    box('Study · window recess',(-1.96,1.914,2.46),(1.72,.065,2.22),'ink',.002)
    box('Study · window glass',(-1.96,1.874,2.46),(1.58,.011,2.10),'glass',.001)
    for xx in [-2.79,-1.96,-1.13]:box('Window · painted timber mullion',(xx,1.85,2.46),(.027,.07,2.24),'teal',.002)
    for zz in [1.35,2.46,3.57]:box('Window · horizontal rail',(-1.96,1.85,zz),(1.72,.07,.027),'teal',.002)
    box('Window · oak sill',(-1.96,1.77,1.32),(1.89,.29,.05),'oak',.003)
    # Built-in bookshelves with breathing space and books at varied angles.
    rng=random.Random(940)
    for x in [-.58,1.0,2.58]:box('Study · bookcase upright',(x,1.62,2.12),(.046,.46,3.82),'wood',.003)
    for z in [.20,.92,1.65,2.39,3.12,4.00]:
        box('Study · bookcase shelf',(1,1.60,z),(3.22,.55,.040),'wood',.002)
        if z>3.9:continue
        for start,end in [(-.53,.90),(1.08,2.53)]:
            x=start
            while x<end-.15:
                if rng.random()<.12:x+=.30;continue
                w=rng.uniform(.048,.11);h=rng.uniform(.36,.55)
                created=capture(shelf_book,x+w/2,1.59,z+.022,w,h,rng.choice(['linen','leather','redcloth','teal','oak']))
                # Tiny lean and uneven depth keep the shelf from looking tiled.
                for obj in created:obj.location.y+=rng.uniform(-.008,.008)
                x+=w+.011
    # Desk height 74cm, top 3cm; proportions use 2 scene units per metre.
    for x in [-1.46,1.66]:
        for y in [-1.34,-.07]:
            rod('Desk · tapered oak leg',(x*1.035,y,.16),(x,y,1.55),.045,'wood',24)
        box('Desk · short apron',(x,-.70,1.41),(.055,1.31,.18),'wood',.002)
    for y in [-1.32,-.07]:box('Desk · long apron',(.1,y,1.43),(3.18,.055,.13),'wood',.002)
    for i in range(5):box('Desk · solid walnut top',(.1,-1.39+i*.32,1.58),(3.56,.315,.060),'wood',.005)
    box('Desk · inset drawer',(.05,-1.417,1.43),(1.16,.04,.13),'wood',.002)
    rod('Desk · recessed drawer pull',(-.10,-1.443,1.45),(.20,-1.443,1.45),.008,'brass')
    notebook(.16,-.80,1.614)
    practical=desk_lamp(-1.17,-.14,1.614,.55)
    for f,e in [(1,13),(25,14.3),(49,13)]:practical.data.energy=e;practical.data.keyframe_insert(data_path='energy',frame=f)
    ANIMATED.append(practical)
    capture(book_stack,0,0,0,scale=(.52,.52,.52),offset=(1.21,-.13,1.614))
    # Ceramic cup, glasses and a pen: each has a normal relationship to the book.
    cylinder('Study · stoneware mug',(-.68,-.21,1.716),.071,.195,'linen',64,top=.076,bevel=.003)
    cylinder('Study · coffee',(-.68,-.21,1.812),.068,.002,'leather',40,bevel=0)
    torus('Study · mug rim',(-.68,-.21,1.814),.071,.003,'linen')
    torus('Study · mug handle',(-.777,-.21,1.726),.048,.008,'linen',(math.pi/2,0,0))
    rod('Fountain pen',(.80,-1.18,1.634),(.75,-.87,1.634),.009,'ink',20)
    rod('Fountain pen · silver nib',(.80,-1.18,1.634),(.807,-1.221,1.634),.004,'steel')
    for x in [1.13,1.31]:torus('Study · spectacles',(x,-1.05,1.632),.075,.0024,'brass')
    rod('Spectacles · bridge',(1.205,-1.05,1.632),(1.235,-1.05,1.632),.0024,'brass')
    for x in [1.055,1.385]:curve('Spectacles · temple',[(x,-1.05,1.632),(x-.02,-.84,1.637),(x-.04,-.81,1.63)],.0024,'brass')
    # Thin correspondence, with a restrained looping lifted corner.
    for j in range(3):
        vs=[]
        for row in range(2):
            for k in range(17):
                xx=.91+k*.032;yy=-.80+row*.44;zz=1.617+j*.002+.025*(k/16)**6
                vs.append((xx,yy,zz))
        leaf=mesh('Study · loose draft',vs,[(k,k+1,k+18,k+17) for k in range(16)],'paper')
        for face in leaf.data.polygons:face.use_smooth=True
        for f,dz in [(1,0),(25,.006+j*.002),(49,0)]:leaf.location.z=dz;leaf.keyframe_insert(data_path='location',frame=f)
        ANIMATED.append(leaf)
    chair(-.95,-2.0)
    plant(-2.65,.57,.15,1.06)
    # A woven rug grounds the chair and desk without adding another plinth.
    box('Study · wool rug',(.10,-.61,.161),(4.31,3.21,.010),'linen',.008)
    for side in [-1,1]:
        for i in range(83):rod('Rug · fringe',(side*2.16+.1,-2.12+i*.037,.164),(side*2.23+.1,-2.12+i*.037,.164),.0015,'page',6)


def hammer(x,y,z):
    rod('Hammer · hickory handle',(x,y,z),(x,y,z+.52),.023,'oak',24)
    cylinder('Hammer · grip end',(x,y,z+.055),.026,.11,'leather',32,bevel=.003)
    box('Hammer · forged head',(x,y,z+.53),(.22,.073,.078),'steel',.01)
    rod('Hammer · striking face',(x-.10,y,z+.53),(x-.15,y,z+.53),.044,'steel',24)
    curve('Hammer · claw',[(x+.10,y,z+.53),(x+.18,y,z+.50),(x+.21,y,z+.46)],.018,'steel')


def workshop():
    foundation(107);floorboards()
    # A practical studio wall, with a small tool rail rather than a giant toy pegboard.
    box('Workshop · painted masonry wall',(0,1.96,2.12),(6.26,.10,3.94),'stone',.003)
    for zz in [.16,4.04]:box('Workshop · wall trim',(0,1.889,zz),(6.24,.045,.06),'teal',.002)
    box('Workshop · perforated steel panel',(-1.22,1.864,2.80),(2.80,.028,1.33),'teal',.002)
    vs=[];fs=[]
    for row in range(18):
        for col in range(39):
            x=-2.55+col*.070;z=2.19+row*.071;n=len(vs)
            vs.extend([(x-.005,1.847,z-.005),(x+.005,1.847,z-.005),(x+.005,1.847,z+.005),(x-.005,1.847,z+.005)])
            fs.append((n,n+1,n+2,n+3))
    mesh('Tool panel · fine perforations',vs,fs,'ink')
    for i,x in enumerate([-2.2,-1.72]):capture(hammer,0,0,0,scale=(.65,.65,.65),offset=(x,1.79,2.44))
    for i,x in enumerate([-.98,-.80,-.62]):
        rod('Driver · shaft',(x,1.80,2.47),(x,1.80,2.72),.008,'steel')
        rod('Driver · rubber handle',(x,1.80,2.72),(x,1.80,2.89),.022,'ink' if i%2 else 'clay')
    # Bench dimensions: 2.35m wide, 80cm deep, 86cm working height.
    for x in [-2.17,2.17]:
        for y in [-.60,.72]:box('Bench · welded steel leg',(x,y,.95),(.085,.085,1.56),'teal',.004)
        box('Bench · steel crossmember',(x,.06,.47),(.067,1.4,.067),'teal',.003)
    for y in [-.60,.72]:box('Bench · steel apron',(0,y,1.59),(4.42,.055,.15),'teal',.003)
    for i in range(9):box('Bench · laminated beech top',(0,-.70+i*.19,1.74),(4.74,.185,.10),'oak',.003)
    box('Bench · lower shelf',(0,.08,.50),(4.38,1.33,.035),'wood',.003)
    # One real cabinet, with narrow reveals and small handles.
    for row in range(4):
        z=.71+row*.223
        box('Bench · painted drawer',(-1.51,-.56,z),(1.03,.70,.20),'teal',.006)
        rod('Bench · drawer handle',(-1.72,-.928,z+.045),(-1.30,-.928,z+.045),.010,'steel')
    for i in range(9):cylinder('Bench · dog hole',(-2.04+i*.44,-.69,1.792),.012,.002,'ink',16,bevel=0)
    # Laptop scale and hinge angle approximate a 16-inch machine.
    sx,sy,sz=1.12,.30,1.809
    box('Laptop · aluminium deck',(sx,sy-.23,sz),(.73,.50,.022),'steel',.008)
    for row in range(5):
        for col in range(12):box('Laptop · key',(sx-.312+col*.056,sy-.24+row*.042,sz+.014),(.047,.031,.003),'ink',.003)
    box('Laptop · trackpad',(sx,sy-.401,sz+.013),(.26,.119,.003),'glass3',.003)
    # Screen tilt is modelled, and all four corners are exported for perspective.
    topy=sy+.105;bottomy=sy-.006
    screen=[(sx-.327,topy,sz+.461),(sx+.327,topy,sz+.461),(sx-.327,bottomy,sz+.033),(sx+.327,bottomy,sz+.033)]
    housing=box('Laptop · display housing',(sx,sy+.066,sz+.248),(.738,.017,.479),'teal',.007)
    housing.rotation_euler.x=math.radians(-14.5)
    mesh('Laptop · screen glass',[screen[0],screen[1],screen[3],screen[2]],[(0,1,2,3)],'screen')
    rod('Laptop · hinge',(sx-.30,sy,sz+.028),(sx+.30,sy,sz+.028),.012,'steel',20)
    ANCHORS['screen']=screen;ANCHORS['landmark']=(sx,sy+.045,sz+.25);ANCHORS['screenGlow']=(sx,sy-.34,sz+.02)
    # A partially assembled electronics instrument, with an open aluminium case.
    box('Workshop · antistatic cutting mat',(-.69,-.11,1.799),(1.52,1.08,.006),'jade',.003)
    for i in range(16):box('Cutting mat · fine grid',(-1.40+i*.095,-.11,1.803),(.0015,.995,.001),'leaf2',0)
    for i in range(11):box('Cutting mat · fine grid',(-.69,-.59+i*.095,1.803),(1.43,.0015,.001),'leaf2',0)
    box('Prototype · base plate',(-.68,-.10,1.829),(.65,.46,.012),'steel',.001)
    for x in [-1,-.36]:box('Prototype · open case side',(x,-.10,1.896),(.012,.46,.146),'steel',.001)
    box('Prototype · connector panel',(-.68,.125,1.90),(.65,.012,.15),'steel',.001)
    box('Prototype · PCB',(-.68,-.10,1.857),(.57,.36,.009),'jade',.001)
    for i in range(32):
        x=-.92+(i%8)*.065;y=-.235+(i//8)*.08
        box('PCB · SMD component',(x,y,1.869),(.025,.014,.010),'ink',.001)
        for xx in [x-.013,x+.013]:box('PCB · solder pad',(xx,y,1.862),(.007,.018,.002),'steel',0)
    box('PCB · processor',(-.70,-.10,1.885),(.105,.10,.016),'ink',.001)
    for i in range(8):
        for side in [-1,1]:box('PCB · processor pins',(-.744+i*.013,-.1+side*.059,1.877),(.004,.015,.004),'steel',0)
    for j in range(5):
        curve('Prototype · jumper cable',[(-.89+j*.027,-.22,1.887),(-.91+j*.04,-.15,1.96),(-.77+j*.035,.08,1.889)],.003,'clay' if j%2 else 'ink')
    # Detached lid, hand tools and a digital caliper alongside the active work.
    box('Prototype · removed lid',(.17,-.40,1.810),(.40,.55,.012),'steel',.002,rot=.13)
    rod('Caliper · rule',(.03,-.55,1.829),(.37,-.52,1.829),.008,'steel')
    box('Caliper · readout',(.16,-.539,1.846),(.083,.055,.036),'teal',.004)
    box('Caliper · LCD',(.16,-.539,1.865),(.054,.035,.001),'screen',.001)
    for x in [.04,.19]:rod('Caliper · jaws',(x,-.57,1.825),(x,-.65,1.825),.005,'steel')
    # Soldering station, curled cable, brass sponge and task lighting.
    box('Solder station',(-1.80,.24,1.902),(.35,.40,.20),'teal',.007)
    box('Solder station · readout',(-1.83,.032,1.922),(.14,.008,.045),'screen',.002)
    rod('Solder station · dial',(-1.69,.031,1.89),(-1.69,.019,1.89),.026,'ink',32)
    rod('Iron · rubber grip',(-1.82,-.17,1.823),(-1.79,-.40,1.823),.016,'ink',24)
    rod('Iron · steel tip',(-1.79,-.40,1.823),(-1.77,-.56,1.823),.005,'steel')
    curve('Iron · flexible cable',[(-1.82,-.17,1.823),(-2.04,-.18,1.81),(-2.15,.20,1.81),(-1.96,.36,1.81),(-1.80,.35,1.89)],.005,'ink')
    practical=desk_lamp(-1.55,.77,1.792,.51)
    # A metal storage rack and drawer organiser; no decorative string lights.
    for x in [.48,2.68]:box('Storage · shelf upright',(x,1.60,2.98),(.037,.037,1.70),'steel',.002)
    for z in [2.21,2.98,3.79]:box('Storage · steel shelf',(1.58,1.61,z),(2.25,.49,.028),'steel',.002)
    for row in range(3):
        for col in range(5):
            x=.78+col*.34;z=2.34+row*.188
            box('Parts · smoked drawer',(x,1.51,z),(.317,.32,.170),'glass2',.003)
            box('Parts · paper label',(x,1.342,z),(.105,.002,.030),'paper',.001)
            box('Parts · small handle',(x,1.329,z-.036),(.074,.024,.012),'steel',.002)
    for i in range(4):
        box('Storage · labelled carton',(.75+i*.49,1.61,3.19),(.44,.43,.38),'wood',.003)
        box('Carton · label',(.75+i*.49,1.39,3.19),(.14,.002,.08),'paper',0)
    for x in [-.45,.60,1.55]:box('Bench · equipment case',(x,.10,.71),(.77,.82,.38),'teal',.014)
    # A low stool with metal legs and a modest padded seat.
    for xx in [-.27,.27]:
        for yy in [-.27,.27]:rod('Stool · splayed steel leg',(2.75+xx*1.25,-.78+yy*1.25,.16),(2.75+xx,-.78+yy,1.08),.021,'teal',20)
    cylinder('Stool · padded seat',(2.75,-.78,1.10),.37,.085,'leather',64,bevel=.020)
    torus('Stool · foot ring',(2.75,-.78,.43),.33,.012,'steel')
    # Under-shelf task strip provides a soft local pool of light.
    box('Workshop · practical LED strip',(1.56,1.44,2.17),(2.04,.025,.015),'light',.003)
    ANCHORS['bulbs']=[(1.10,1.44,2.17),(2.0,1.44,2.17)]
    light('Workshop · task strip',(1.56,1.35,2.14),(1,.79,.58),12,1.2,(1.1,0,1.7))
    plant(-2.98,.95,.16,.64)


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
    sky=scene.world.node_tree.nodes.new('ShaderNodeTexSky')
    sky.sky_type='MULTIPLE_SCATTERING';sky.sun_elevation=math.radians(8);sky.sun_rotation=math.radians(135)
    sky.sun_disc=False;sky.altitude=.15;sky.air_density=1.2;sky.aerosol_density=2
    scene.world.node_tree.links.new(sky.outputs['Color'],scene.world.node_tree.nodes['Background'].inputs[0])
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.17
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
    # A long perspective lens maintains architectural verticals without a toy-like
    # orthographic projection or miniature depth-of-field blur.
    city_scene=scene.name.startswith('Work ·')
    direction=Vector((-5.5,-17,8.4) if city_scene else (5.4,-17,10.2)).normalized()
    data=bpy.data.cameras.new('Architectural perspective · 70mm')
    camera=bpy.data.objects.new('Camera',data);bpy.context.collection.objects.link(camera)
    data.type='PERSP';data.lens=70;data.sensor_width=36;data.dof.use_dof=False
    camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    scene.camera=camera
    bpy.context.view_layer.update()
    rotation=camera.rotation_euler.to_matrix(); inverse=rotation.transposed()
    coords=[]
    for obj in scene.objects:
        if obj.type not in {'MESH','CURVE'}:continue
        coords.extend(inverse@(obj.matrix_world@Vector(v)) for v in obj.bound_box)
    xmin,xmax=min(c.x for c in coords),max(c.x for c in coords)
    ymin,ymax=min(c.y for c in coords),max(c.y for c in coords)
    target=rotation@Vector(((xmin+xmax)/2,(ymin+ymax)/2,0))
    distance=max((xmax-xmin),1.5*(ymax-ymin))/.83/(36/70)
    camera.location=target+direction*(distance+3)
    # Broad cool sky and restrained warm practicals separate glass, timber and metal.
    light('Sky · north window',(-7,-4,11),(.61,.76,1),950,8,(0,0,.7))
    light('Dusk · horizon',(4,5,7),(1,.73,.46),780,6,(0,0,1))
    light('Front · reflected sky',(0,-8,3),(.67,.78,1),155,7,(0,0,.7))
    light('Cliff · ambient bounce',(-4,-3,-1),(.44,.56,.64),38,5,(0,0,-.8))
    bpy.context.view_layer.update()
    # Fit the perspective projection itself, including the nearest corners.
    for step in range(6):
        pts=[]
        for obj in scene.objects:
            if obj.type in {'MESH','CURVE'}:
                pts.extend(world_to_camera_view(scene,camera,obj.matrix_world@Vector(v)) for v in obj.bound_box)
        left,right=min(v.x for v in pts),max(v.x for v in pts)
        bottom,top=min(v.y for v in pts),max(v.y for v in pts)
        camera.location+=rotation@Vector(((left+right-1)*.5*distance*36/70,(bottom+top-1)*.5*distance*24/70,0))
        factor=max((right-left)/.88,(top-bottom)/.88)
        distance*=factor
        camera.location+=direction*(factor-1)*(camera.location-target).length
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
