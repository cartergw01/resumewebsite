"""Model and render Carter's islands from geometry, without generated textures.

blender -b --factory-startup --python scripts/blender/build_islands.py -- \
  --world all --output /tmp/carter-islands --samples 48 --width 1600

The saved scenes, camera-projected interaction anchors and web renders all
come from this one source. All dimensions are in Blender metres.
"""

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector
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


def palette():
    global P
    P = {
        'rock': material('Basalt · ink blue', (0.045, 0.072, 0.093), rough=0.7),
        'rock2': material('Basalt · slate', (0.075, 0.12, 0.14), rough=0.64),
        'rock3': material('Basalt · dark seam', (0.022, 0.038, 0.045), rough=0.74),
        'stone': material('Terrace · blue limestone', (0.095, 0.14, 0.15), rough=0.65),
        'jade': material('Jade enamel', (0.065, 0.28, 0.27), metal=0.32, rough=0.27),
        'teal': material('Deep teal enamel', (0.025, 0.12, 0.15), metal=0.25, rough=0.3),
        'glass': material('Smoky jade glass', (0.035, 0.135, 0.16), metal=0.58, rough=0.23),
        'brass': material('Brushed brass', (0.38, 0.21, 0.065), metal=0.72, rough=0.32),
        'copper': material('Aged copper', (0.32, 0.14, 0.075), metal=0.52, rough=0.44),
        'wood': material('Walnut', (0.24, 0.105, 0.052), rough=0.4),
        'oak': material('Honey oak', (0.29, 0.135, 0.05), rough=0.46),
        'paper': material('Ivory paper', (0.88, 0.79, 0.59), rough=0.86),
        'page': material('Page edges', (0.65, 0.54, 0.35), rough=0.8),
        'ink': material('Midnight ink', (0.025, 0.04, 0.055), rough=0.4),
        'moss': material('Moss green', (0.15, 0.24, 0.115), rough=0.8),
        'leaf': material('Sage leaves', (0.24, 0.40, 0.22), rough=0.64),
        'clay': material('Terracotta', (0.50, 0.20, 0.12), rough=0.65),
        'light': material('Warm practical lights', (1, 0.64, 0.25), emission=2.6),
        'window': material('Amber windows', (1, 0.64, 0.28), emission=1.25),
        'window2': material('Cool windows', (0.39, 0.73, 0.77), emission=0.5),
        'screen': material('Screen glass', (0.09, 0.32, 0.39), emission=0.35),
        'steel': material('Satin steel', (0.32, 0.38, 0.39), metal=0.75, rough=0.3),
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


def box(name, loc, size, mat, bevel=0.025, rot=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler.z = rot
    return finish(obj, name, mat, bevel)


def cylinder(name, loc, radius, depth, mat, vertices=32, top=None, bevel=0.015):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
                                  radius2=radius if top is None else top,
                                  depth=depth, location=loc)
    return finish(bpy.context.object, name, mat, bevel)


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


def foundation(seed):
    rng = random.Random(seed)
    count = 24
    rings, vertices = [], []
    for radius, z in [(1, 0), (1.015, -0.22), (0.81, -1.10), (0.38, -2.35), (0.045, -3.45)]:
        ring = []
        for i in range(count):
            angle = i * math.tau / count
            jitter = rng.uniform(0.95, 1.05)
            ring.append(len(vertices))
            vertices.append((math.cos(angle) * 4.15 * radius * jitter,
                             math.sin(angle) * 2.85 * radius * jitter,
                             z + (rng.uniform(-0.13, 0.13) if z < -0.23 else 0)))
        rings.append(ring)
    faces = [tuple(reversed(rings[0]))]
    for ring in range(len(rings)-1):
        for i in range(count):
            a,b,c,d=rings[ring][i],rings[ring][(i+1)%count],rings[ring+1][(i+1)%count],rings[ring+1][i]
            faces.extend([(a,b,c),(a,c,d)])
    faces.append(tuple(rings[-1]))
    obj = mesh('Floating basalt · individually cut faces', vertices, faces, 'rock')
    obj.data.materials.append(P['rock2'])
    obj.data.materials.append(P['rock3'])
    for polygon in obj.data.polygons:
        polygon.material_index=rng.choices([0,1,2], [6,2,1])[0]
    top = cylinder('Stone terrace', (0,0,0.035), 1, 0.13, 'stone', 64, bevel=0.035)
    top.scale=(4.07,2.76,1)
    # Deliberate mineral seams and small separate pieces, not a noisy texture.
    for i in [13,15,18,20,22]:
        a = vertices[rings[1][i]]
        b = vertices[rings[2][i]]
        c = vertices[rings[3][i]]
        curve('Copper mineral seam', [a,b,c], 0.009, 'copper')
    for i, pos in enumerate([(-3.0,-1.2,-1.9),(3.2,0.7,-1.7),(-1,1.9,-2.1)]):
        sphere('Drifting basalt fragment',pos,(0.18,0.23,0.28),'rock2',1)


def tree(x,y,scale=1):
    rod('Tree trunk',(x,y,0.10),(x,y,0.10+scale*0.48),0.035*scale,'wood')
    sphere('Sculpted tree crown',(x,y,0.1+scale*0.7),(scale*0.27,scale*0.24,scale*0.37),'moss')
    sphere('Crown highlight',(x-scale*0.12,y-0.03,0.15+scale*0.83),(scale*0.17,scale*0.18,scale*0.20),'leaf')


def plant(x,y,z,scale=1):
    cylinder('Terracotta planter',(x,y,z+0.19*scale),0.19*scale,0.38*scale,'clay',top=0.24*scale)
    cylinder('Pot soil',(x,y,z+0.383*scale),0.21*scale,0.015,'ink')
    for i in range(7):
        a=i*math.tau/7
        start=(x,y,z+0.36*scale)
        end=(x+math.cos(a)*0.33*scale,y+math.sin(a)*0.33*scale,z+(0.58+(i%3)*0.12)*scale)
        rod('Plant stem',start,end,0.012*scale,'moss')
        leaf=sphere('Olive leaf',end,(0.11*scale,0.035*scale,0.24*scale),'leaf')
        leaf.rotation_euler=(math.sin(a)*0.6,math.cos(a)*0.6,-a)


def window_grid(x,y,width,depth,height,seed):
    rng=random.Random(seed)
    vertices, faces=[],[]
    # Combine all panes into one mesh, while preserving the projected lights.
    for side in ['front','right']:
        span = width if side=='front' else depth
        cols=max(2,int(span/0.13)); rows=max(3,int(height/0.18))
        for col in range(cols):
            for row in range(rows):
                if rng.random()<0.46: continue
                h=0.12+height*(row+0.6)/rows
                u=span*((col+0.5)/cols-0.5)
                w=min(0.033,span/cols*0.24); hh=0.026
                if side=='front':
                    p=(x+u,y-depth/2-0.008,h)
                    quad=[(p[0]-w,p[1],h-hh),(p[0]+w,p[1],h-hh),(p[0]+w,p[1],h+hh),(p[0]-w,p[1],h+hh)]
                else:
                    p=(x+width/2+0.008,y+u,h)
                    quad=[(p[0],p[1]-w,h-hh),(p[0],p[1]+w,h-hh),(p[0],p[1]+w,h+hh),(p[0],p[1]-w,h+hh)]
                start=len(vertices); vertices.extend(quad); faces.append(tuple(range(start,start+4)))
                if rng.random()<0.035: WINDOWS.append(p)
    mesh('Individual illuminated windows', vertices,faces,'window')


def building(x,y,width,depth,height,seed):
    box('City building',(x,y,0.12+height/2),(width,depth,height),'glass',0.025)
    box('Roof cornice',(x,y,0.12+height),(width+0.06,depth+0.06,0.045),'brass',0.008)
    box('Rooftop plant room',(x,y,height+0.19),(width*0.5,depth*0.5,0.12),'teal',0.018)
    window_grid(x,y,width,depth,height,seed)
    for i in [-1,1]:
        box('Vertical facade mullion',(x+i*(width/2-0.035),y-depth/2-0.012,0.12+height/2),(0.018,0.02,height),'brass',0)


def tapered_tier(x,y,z,w,d,h):
    bottom=[(-w*.40,-d*.40),(w*.40,-d*.40),(w*.40,d*.40),(-w*.40,d*.40)]
    top=[(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]
    verts=[(x+a,y+b,z) for a,b in bottom]+[(x+a,y+b,z+h) for a,b in top]
    return mesh('Taipei 101 · bamboo module', verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'jade')


def city():
    foundation(31)
    # A quiet plaza keeps Taipei 101 readable even in the opening overview.
    for y in [-1.70,-1.12,1.54]:
        box('Plaza paving',(0,y,0.115),(6.6,0.42,0.035),'rock2',0.02)
    for x in [-2.8,-1.3,1.05,2.7]:
        box('Walkway',(x,0,0.116),(0.36,4.0,0.038),'rock2',0.015)
    config=[(-2.5,0.85,.64,.62,1.48),(-1.52,1.1,.66,.70,2.18),(-.52,1.4,.68,.7,1.58),(1.55,1.05,.73,.76,1.9),(2.65,.6,.58,.70,1.42),
            (-2.45,-.3,.66,.65,1.07),(-1.4,-.05,.63,.76,1.40),(1.6,-.20,.62,.68,1.19),(2.55,-.52,.60,.65,.83),(-.65,-1.15,.78,.57,.62),(.6,-1.12,.86,.62,.73)]
    for i,(x,y,w,d,h) in enumerate(config): building(x,y,w,d,h,41+i)
    tx,ty=.20,.32
    box('Taipei 101 · podium',(tx,ty,.39),(1.10,1.02,.57),'teal',.05)
    window_grid(tx,ty,1.10,1.02,.57,99)
    for i in range(8):
        z=.68+i*.355; w=.92-i*.032
        tapered_tier(tx,ty,z,w,w*.85,.338)
        box('101 pagoda rim',(tx,ty,z+.326),(w+.055,w*.85+.055,.035),'brass',.008)
        for side in [-1,1]:
            rod('101 corner spine',(tx+side*w*.39,ty-w*.85*.4,z+.04),(tx+side*w*.49,ty-w*.85*.5,z+.30),.015,'brass')
        for j in range(4):
            zz=z+.09+j*.054
            box('101 horizontal glazing',(tx,ty-w*.85*.45-.014,zz),(w*.73,.012,.011),'window2',0)
            if i%2==0: WINDOWS.append((tx,ty-w*.85*.5-.018,zz))
    cylinder('101 lantern',(tx,ty,3.75),.24,.44,'jade',8,top=.19)
    cylinder('101 upper lantern',(tx,ty,4.02),.15,.15,'brass',8,top=.095)
    rod('Taipei spire',(tx,ty,4.08),(tx,ty,4.77),.026,'brass')
    sphere('Taipei beacon',(tx,ty,4.77),(.04,.04,.05),'light')
    ANCHORS['landmark']=(tx,ty,3.10)
    ANCHORS['tower']=(tx,ty,3.75)
    for x,y,s in [(-3,-.85,.65),(-2.3,-1.78,.72),(-1.55,-1.9,.6),(.15,-1.95,.7),(1.45,-1.75,.68),(2.8,-1.35,.65),(-3,1.0,.52),(3,1,.62)]: tree(x,y,s)
    for x in [-2.9,-1.85,-.8,.25,1.3,2.35]:
        rod('Promenade lamp',(x,-2.1,.1),(x,-2.1,.50),.015,'brass')
        sphere('Promenade globe',(x,-2.1,.53),(.06,.06,.075),'light')
    # Small red-brown tram: a deliberate city detail, without invented signage.
    box('Taipei tram body',(-1.8,-1.12,.26),(.67,.26,.28),'clay',.065)
    for xx in [-2.03,-1.85,-1.67]: box('Tram window',(xx,-1.258,.29),(.115,.012,.11),'window',.01)


def desk_lamp(x,y,z,scale=1):
    cylinder('Lamp · weighted base',(x,y,z+.07*scale),.30*scale,.14*scale,'jade')
    a=(x,y,z+.15*scale); b=(x-.22*scale,y,z+1.03*scale); c=(x+.45*scale,y,z+1.72*scale)
    for offset in [-.047,.047]:
        rod('Lamp · articulated arm',(a[0]+offset,a[1],a[2]),(b[0]+offset,b[1],b[2]),.025*scale,'brass')
        rod('Lamp · upper arm',(b[0]+offset,b[1],b[2]),(c[0]+offset,c[1],c[2]),.025*scale,'brass')
    for p in [a,b,c]: sphere('Lamp · hinge',p,(.08*scale,.08*scale,.08*scale),'brass')
    shade=(c[0]+.08*scale,c[1],c[2]-.16*scale)
    cylinder('Lamp · enamel shade',shade,.38*scale,.36*scale,'jade',48,top=.12*scale,bevel=.025)
    cylinder('Lamp · brass lip',(shade[0],shade[1],shade[2]-.18*scale),.39*scale,.035*scale,'brass',48)
    bulb=(shade[0],shade[1],shade[2]-.195*scale)
    cylinder('Lamp · warm diffuser',bulb,.33*scale,.02*scale,'light')
    practical=light('Desk lamp illumination',(bulb[0],bulb[1],bulb[2]-.08),(1,.69,.36),45*scale, .3*scale)
    ANCHORS['lamp']=bulb
    return practical


def book_stack(x,y,z):
    for i,(w,d,h,mat,a) in enumerate([(1.2,.88,.15,'teal',-.14),(1.06,.82,.20,'clay',.06),(.96,.76,.16,'jade',-.02)]):
        box('Clothbound book cover',(x,y,z+.02),(w,d,.045),mat,.035,a)
        box('Stacked book pages',(x,y,z+.025+h/2),(w-.045,d-.035,h),'page',.02,a)
        z+=h+.045
        box('Clothbound book cover',(x,y,z),(w,d,.04),mat,.02,a)
        z+=.05


def page_height(x):
    # A restrained curved leaf: raised shoulder, anchored gutter, flat edge.
    return .46 + .10*math.sin(min(1,abs(x)/1.45)*math.pi) + .035*abs(x)


def writing():
    foundation(73)
    # An inlaid walnut platform is the writing island's material signature.
    table=cylinder('Walnut writing surface',(0,0,.18),1,.22,'wood',64,bevel=.04)
    table.scale=(3.68,2.38,1)
    ring=[(math.cos(i*math.tau/64)*3.5,math.sin(i*math.tau/64)*2.2,.296) for i in range(64)]
    curve('Desk brass inlay',ring,.012,'brass',True)
    # Covers and many individual page edges make a modelled open book.
    for side in [-1,1]:
        box('Open notebook · leather cover',(side*.77,-.35,.33),(1.57,2.12,.075),'teal',.045)
        for layer in range(9):
            vertices=[]
            for y in [-1.35,.65]:
                for i in range(33):
                    x=side*(.025+i/32*1.49)
                    vertices.append((x,y,page_height(x)-layer*.012))
            faces=[(i,i+1,i+34,i+33) for i in range(32)]
            mesh('Notebook · curved paper leaf',vertices,faces,'paper' if layer==0 else 'page')
    # Fine ruled lines are actual curves sitting on the pages.
    for side in [-1,1]:
        for line in range(12):
            yy=-1.20+line*.148
            points=[(side*(.20+j/10*1.17),yy,page_height(side*(.20+j/10*1.17))+.006) for j in range(11)]
            curve('Notebook · printed ruling',points,.003,'page')
    curve('Notebook · ribbon bookmark',[(.06,.5,.463),(.05,-.8,.466),(.11,-1.6,.305),(.15,-1.75,.2)],.018,'clay')
    # The screen transition uses the camera projection of these page corners.
    ANCHORS['spread']=[(-1.5,.65,page_height(1.5)),(1.5,.65,page_height(1.5)),(-1.5,-1.35,page_height(1.5))]
    ANCHORS['page']=[(.13,.56,.493),(1.36,.56,page_height(1.36)+.008),(.13,-1.21,.493)]
    ANCHORS['landmark']=(.10,-.32,.5)
    practical=desk_lamp(-2.32,.36,.29,1.1)
    for f,e in [(1,47),(25,53),(49,47)]:
        practical.data.energy=e
        practical.data.keyframe_insert(data_path='energy',frame=f)
    ANIMATED.append(practical)
    book_stack(1.9,1.25,.29)
    # Fountain pen, nib, ink bottle, loose sheets and a small ceramic cup.
    rod('Fountain pen · lacquer barrel',(.32,-.90,.58),(1.28,-.68,.61),.047,'ink')
    rod('Fountain pen · cap band',(1.08,-.725,.606),(1.17,-.705,.609),.052,'brass')
    rod('Fountain pen · nib',(.32,-.90,.58),(.10,-.95,.57),.025,'brass')
    box('Ink bottle',(-1.94,-.83,.51),(.31,.30,.4),'glass',.055)
    cylinder('Ink bottle cap',(-1.94,-.83,.76),.13,.11,'brass')
    for i in range(3): box('Loose correspondence',(2.3,-.92+i*.06,.32+i*.015),(.86,1.03,.014),'paper',.009,-.13+i*.06)
    plant(-.92,1.45,.30,.65)
    # Two copper-edged floating leaves, lightly bobbing over the desk.
    for i,(x,y,z) in enumerate([(1.10,1.28,1.17),(2.5,.55,.77)]):
        leaf=box('Loose leaf in the air',(x,y,z),(.67,.88,.012),'paper',.015,(-.22 if i==0 else .16))
        leaf.rotation_euler.x=.16 if i==0 else -.10
        for f,dz in [(1,0),(25,.10),(49,0)]:
            leaf.location.z=z+dz
            leaf.keyframe_insert(data_path='location',frame=f)
        ANIMATED.append(leaf)


def hammer(x,y,z):
    rod('Hammer · walnut grip',(x,y,z),(x,y,z+.5),.036,'wood')
    box('Hammer · steel head',(x,y,z+.52),(.28,.13,.13),'steel',.025)


def workshop():
    foundation(107)
    # Narrow oak floorboards and a cutaway back wall; no front wall to hide the bench.
    for i in range(15):
        x=(i-7)*.46
        extent=2.4*math.sqrt(max(0,1-(x/4.0)**2))
        box('Workshop · oak floorboard',(x,0,.15),(.445,extent*2,.15),'wood',.018)
    for x in [-3.05,3.05]: box('Workshop · timber upright',(x,1.55,1.68),(.18,.22,3.05),'oak',.035)
    box('Workshop · upper beam',(0,1.55,3.14),(6.36,.28,.22),'oak',.03)
    box('Workshop · teal pegboard',(0,1.57,1.93),(5.88,.13,2.23),'teal',.045)
    # Many small pegboard perforations in one mesh.
    verts,faces=[],[]
    for row in range(13):
        for col in range(33):
            x=-2.8+col*.175; z=.96+row*.163; n=len(verts)
            verts.extend([(x-.013,1.498,z-.013),(x+.013,1.498,z-.013),(x+.013,1.498,z+.013),(x-.013,1.498,z+.013)])
            faces.append(tuple(range(n,n+4)))
    mesh('Workshop · pegboard holes',verts,faces,'ink')
    for x in [-2.45,-1.87,-1.27]: hammer(x,1.38,1.97)
    for i,x in enumerate([-.64,-.30,.04,.38]):
        rod('Screwdriver · shaft',(x,1.37,1.99),(x,1.37,2.34),.014,'steel')
        rod('Screwdriver · handle',(x,1.37,2.34),(x,1.37,2.61),.043,'clay' if i%2 else 'oak')
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
        box('Parts bin',(x,1.23,2.92),(.53,.40,.38),m,.045)
        box('Parts bin label',(x,1.016,2.94),(.22,.012,.095),'paper',.01)
    for x,m in [(-1.4,'teal'),(-.42,'clay'),(.55,'jade')]: box('Under-bench storage',(x,-.12,.72),(.70,.75,.36),m,.035)
    cylinder('Solder spool',(.48,-.50,1.64),.15,.27,'copper')
    for z in [1.5,1.78]: cylinder('Solder spool rim',(.48,-.50,z),.19,.035,'ink')
    for x in [2.78,3.3]:
        for y in [-1.0,-.49]: rod('Stool · splayed leg',(x,y,.23),(3.04+(x-3.04)*.72,-.745+(y+.745)*.72,1.00),.045,'wood')
    cylinder('Stool · seat',(3.04,-.745,1.04),.43,.13,'oak',48)
    plant(-2.94,-1.2,.24,.95)
    plant(2.74,1.04,.24,.76)
    # Warm practical lights hung from a gently sagging cable.
    curve('Workshop · light cable',[(-3.04,1.34,3.11),(0,1.30,2.91),(3.04,1.34,3.11)],.013,'ink')
    ANCHORS['bulbs']=[]
    for x in [-2.65,-1.33,0,1.33,2.65]:
        z=2.92+(x/3)**2*.16
        rod('Bulb socket',(x,1.30,z),(x,1.30,z-.11),.025,'brass')
        pos=(x,1.30,z-.17)
        sphere('Workshop · frosted bulb',pos,(.065,.065,.085),'light')
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
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.16,.22,.30,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.20
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=-.12
    if engine=='CYCLES':
        scene.cycles.samples=samples
        scene.cycles.use_denoising=True
        scene.cycles.max_bounces=6
        try:
            if device == 'CPU':
                raise RuntimeError('CPU rendering selected')
            prefs=bpy.context.preferences.addons['cycles'].preferences
            prefs.compute_device_type='METAL'
            prefs.get_devices()
            for dev in prefs.devices: dev.use=dev.type=='METAL'
            if any(dev.type=='METAL' for dev in prefs.devices): scene.cycles.device='GPU'
        except Exception:
            pass
    else:
        scene.eevee.taa_render_samples=samples
        if hasattr(scene.eevee,'use_gtao'):
            scene.eevee.use_gtao=True
    return scene


def camera_and_lights(scene):
    # One camera direction across the set; frame from the model bounds.
    target=Vector((0,0,0))
    direction=Vector((9,-16,11)).normalized()
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
    light('Key · large warm softbox',(-5,-7,10),(1,.83,.65),620,7,(0,0,0))
    light('Fill · cool silk',(6,-3,5),(.49,.72,1),290,6,(0,0,.5))
    light('Rim · warm skylight',(1,6,8),(1,.72,.43),800,5,(0,0,.5))
    light('Basalt bounce',(0,-4,-1),(.28,.51,.70),65,5,(0,0,-.8))
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
            scene.render.resolution_x=960; scene.render.resolution_y=640
            if args.engine=='CYCLES': scene.cycles.samples=16
            # Animation stays on a fixed camera so the live page still aligns.
            for frame in range(1,49):
                scene.frame_set(frame)
                scene.render.filepath=str(frames/f'{frame}.png')
                bpy.ops.render.render(write_still=True)
        print(f'COMPLETED {world}',flush=True)


if __name__=='__main__':
    main()
