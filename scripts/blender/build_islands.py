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


def material(name, color, metal=0, rough=0.65, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = (*color, 1)
    bs.inputs['Metallic'].default_value = metal
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Specular IOR Level'].default_value = .28
    if emission:
        bs.inputs['Emission Color'].default_value = (*color, 1)
        bs.inputs['Emission Strength'].default_value = emission
    return mat


def textured(name, dark, pale, kind='stone', metal=0, rough=.85, grain=None):
    """Matte, multiscale surfaces: grain changes color, normal and roughness."""
    mat = material(name, dark, metal, rough)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bs = nodes.get('Principled BSDF')
    bs.inputs['Specular IOR Level'].default_value = .22 if not metal else .35
    coord = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeVectorMath'); mapping.operation='MULTIPLY'
    mapping.inputs[1].default_value = grain or ((1.2, 32, 5) if kind=='wood' else (1, 1, 1))
    links.new(coord.outputs['Object'], mapping.inputs[0])
    texture = nodes.new('ShaderNodeTexNoise')
    texture.inputs['Scale'].default_value = 3 if kind=='wood' else 5
    texture.inputs['Detail'].default_value = 5
    texture.inputs['Roughness'].default_value = .78
    links.new(mapping.outputs[0], texture.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position=.23
    ramp.color_ramp.elements[0].color=(*dark,1)
    ramp.color_ramp.elements[1].position=.78
    ramp.color_ramp.elements[1].color=(*pale,1)
    links.new(texture.outputs['Fac'],ramp.inputs[0]); links.new(ramp.outputs[0],bs.inputs['Base Color'])
    # Material-specific relief avoids using the same cloudy bump on everything.
    profiles = {
        'wood': (65,.006,.007), 'stone': (48,.028,.075),
        'soil': (65,.019,.040), 'moss': (85,.026,.028),
        'plaster': (95,.008,.006), 'fabric': (150,.004,.001),
        'paper': (150,.0006,.0002), 'metal': (90,.001,.001),
    }
    scale, distance, broad_distance = profiles.get(kind,profiles['stone'])
    fine=nodes.new('ShaderNodeTexNoise'); fine.inputs['Scale'].default_value=scale
    fine.inputs['Detail'].default_value=3
    links.new(mapping.outputs[0],fine.inputs['Vector'])
    bump=nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.38
    bump.inputs['Distance'].default_value=distance
    links.new(fine.outputs['Fac'],bump.inputs['Height'])
    broad=nodes.new('ShaderNodeBump'); broad.inputs['Strength'].default_value=.35
    broad.inputs['Distance'].default_value=broad_distance
    links.new(texture.outputs['Fac'],broad.inputs['Height'])
    links.new(broad.outputs[0],bump.inputs['Normal'])
    normal=bump.outputs[0]
    if kind=='fabric':
        # Crossing warp and weft distinguish cloth from mottled plaster.
        waves=[]
        for axis in ['X','Y']:
            wave=nodes.new('ShaderNodeTexWave');wave.bands_direction=axis
            wave.inputs['Scale'].default_value=95
            wave.inputs['Distortion'].default_value=1.3
            links.new(coord.outputs['Object'],wave.inputs['Vector']);waves.append(wave)
        weave=nodes.new('ShaderNodeMath');weave.operation='MULTIPLY'
        for i,wave in enumerate(waves):links.new(wave.outputs['Color'],weave.inputs[i])
        woven=nodes.new('ShaderNodeBump');woven.inputs['Strength'].default_value=.6
        woven.inputs['Distance'].default_value=.005
        links.new(weave.outputs[0],woven.inputs['Height']);links.new(normal,woven.inputs['Normal'])
        normal=woven.outputs[0]
        bs.inputs['Sheen Weight'].default_value=.24
    if kind=='stone':
        cracks=nodes.new('ShaderNodeTexVoronoi'); cracks.feature='DISTANCE_TO_EDGE'
        cracks.inputs['Scale'].default_value=7
        links.new(coord.outputs['Object'],cracks.inputs['Vector'])
        fissure=nodes.new('ShaderNodeValToRGB')
        fissure.color_ramp.elements[0].position=.012
        fissure.color_ramp.elements[1].position=.055
        links.new(cracks.outputs['Distance'],fissure.inputs[0])
        fracture=nodes.new('ShaderNodeBump'); fracture.inputs['Strength'].default_value=.48
        fracture.inputs['Distance'].default_value=.032
        links.new(fissure.outputs[0],fracture.inputs['Height'])
        links.new(normal,fracture.inputs['Normal']);normal=fracture.outputs[0]
    links.new(normal,bs.inputs['Normal'])
    roughness=nodes.new('ShaderNodeMapRange')
    roughness.inputs['From Min'].default_value=.15;roughness.inputs['From Max'].default_value=.85
    roughness.inputs['To Min'].default_value=max(.25,rough-.10)
    roughness.inputs['To Max'].default_value=min(1,rough+.09)
    links.new(texture.outputs['Fac'],roughness.inputs['Value'])
    links.new(roughness.outputs[0],bs.inputs['Roughness'])
    return mat


def palette():
    global P
    P = {
        'rock': textured('Weathered shale · fractured mineral grain',(.050,.046,.033),(.22,.20,.15)),
        'rock2': textured('Ochre mineral faces',(.075,.058,.035),(.28,.23,.15)),
        'rock3': textured('Deep mineral seams',(.023,.025,.019),(.095,.091,.067)),
        'stone': textured('Weathered limestone',(.15,.145,.12),(.32,.30,.245)),
        'soil': textured('Exposed humus and grit',(.045,.026,.015),(.18,.12,.06),'soil',rough=.97),
        'jade': material('Weathered green paint',(.065,.105,.075),metal=.05,rough=.72),
        'teal': textured('Worn charcoal painted steel',(.025,.036,.032),(.065,.077,.06),'metal',metal=.12,rough=.68),
        'glass': material('Blue green architectural glazing',(.045,.105,.095),metal=.40,rough=.24),
        'glass2': material('Bronze architectural glazing',(.105,.098,.085),metal=.50,rough=.32),
        'glass3': material('Silver architectural glazing',(.19,.23,.24),metal=.58,rough=.31),
        'concrete': textured('Mineral architectural concrete',(.235,.23,.20),(.33,.325,.29),'plaster',rough=.9),
        'plaster': textured('Hand trowelled lime plaster',(.30,.275,.225),(.45,.42,.35),'plaster',rough=.94),
        'brick': textured('Fired clay brick',(.12,.055,.035),(.28,.14,.08),'plaster'),
        'brass': textured('Patinated brass',(.16,.105,.038),(.40,.29,.13),'metal',metal=.76,rough=.48),
        'copper': material('Oxidised copper',(.19,.10,.063),metal=.45,rough=.62),
        'wood': textured('Weathered walnut · open grain',(.072,.044,.025),(.25,.17,.095),'wood',rough=.83),
        'oak': textured('Unvarnished oak · open grain',(.16,.11,.064),(.38,.285,.175),'wood',rough=.86),
        'floorwood': textured('Reclaimed floorboards · lengthwise grain',(.065,.046,.026),(.24,.18,.10),'wood',rough=.9,grain=(32,1.2,5)),
        'paper': textured('Warm rag paper',(.72,.70,.65),(.86,.84,.79),'paper',rough=.94),
        'page': material('Fine page edges',(.55,.49,.38),rough=.9),
        'ink': material('Soft black rubber',(.012,.017,.02),rough=.78),
        'moss': textured('Lichen and moss',(.038,.062,.020),(.18,.22,.075),'moss',rough=.98),
        'leaf': material('Leaf green',(.095,.145,.046),rough=.83),
        'leaf2': material('Shadow foliage',(.039,.070,.021),rough=.9),
        'leaf3': material('Young foliage',(.19,.23,.065),rough=.82),
        'clay': textured('Unglazed terracotta',(.19,.083,.047),(.37,.20,.11),'plaster',rough=.93),
        'leather': textured('Worn tanned leather',(.051,.028,.018),(.15,.09,.050),'fabric',rough=.76),
        'linen': textured('Natural flax cloth',(.20,.205,.165),(.34,.335,.265),'fabric',rough=.97),
        'redcloth': textured('Faded rust book cloth',(.095,.049,.035),(.24,.13,.08),'fabric',rough=.96),
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
    # Continuous patches follow the surface rather than the mesh's triangle grid.
    ground=textured('Earth · irregular moss and exposed humus',(.047,.032,.016),(.13,.145,.057),'soil',rough=.98)
    ramp=next(n for n in ground.node_tree.nodes if n.type=='VALTORGB')
    ramp.color_ramp.elements[0].position=.30
    ramp.color_ramp.elements[1].position=.76
    ramp.color_ramp.elements.new(.48).color=(.13,.087,.038,1)
    ramp.color_ramp.elements.new(.62).color=(.055,.072,.025,1)
    P['ground']=ground
    for axis in ['X','Y']:
        mat=material('Oak · sawn end grain '+axis,(.27,.19,.105),rough=.92)
        nodes,links=mat.node_tree.nodes,mat.node_tree.links
        coord=nodes.new('ShaderNodeTexCoord');wave=nodes.new('ShaderNodeTexWave')
        wave.wave_type='RINGS';wave.rings_direction=axis
        wave.inputs['Scale'].default_value=18;wave.inputs['Distortion'].default_value=4
        links.new(coord.outputs['Object'],wave.inputs['Vector'])
        ramp=nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color=(.16,.095,.042,1)
        ramp.color_ramp.elements[1].color=(.36,.26,.14,1)
        links.new(wave.outputs['Color'],ramp.inputs[0])
        links.new(ramp.outputs[0],nodes.get('Principled BSDF').inputs['Base Color'])
        P['endgrain'+axis]=mat


def sawn_ends(obj,axis='X'):
    obj.data.materials.append(P['endgrain'+axis])
    for index in ([3,5] if axis=='X' else [2,4]):
        obj.data.polygons[index].material_index=len(obj.data.materials)-1
    return obj

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


def terrain_height(x,y,seed):
    """The inhabited plot is level; the outer land rises into broken shoulders."""
    radius=math.sqrt((x/5.535)**2+(y/3.9825)**2)
    edge=max(0,min(1,(radius-.66)/.25))
    broad=noise.noise_vector(Vector((x*.65,y*.65,seed)),noise_basis='PERLIN_ORIGINAL').x
    return edge*edge*(.10+.22*(.5+.5*math.sin(x*1.4+y*.8))+.14*broad)


def foundation(seed):
    before=set(bpy.context.scene.objects)
    rng=random.Random(seed)
    count=192; levels=64; verts=[]; rings=[]; faces=[]; materials=[]
    # Broken cliff contours replace the old smooth, periodically stacked rings.
    outline=[rng.uniform(.88,1.05) for _ in range(24)]
    # Different plans share the same sedimentary structure. Local faults cut
    # vertically through stepped ledges rather than smoothing into a bowl.
    faults=[(rng.uniform(0,math.tau),rng.uniform(.08,.18),rng.uniform(.06,.15)) for _ in range(11)]
    strata=[(0,1),(.10,.99),(.15,.86),(.29,.88),(.34,.72),(.48,.74),(.54,.56),(.70,.57),(.77,.35),(.90,.28),(1,.025)]
    def point(a,t):
        phase=(a%math.tau)/math.tau*24;i=int(phase);f=phase-i
        edge=outline[i%24]*(1-f)+outline[(i+1)%24]*f
        coarse=noise.noise_vector(Vector((math.cos(a)*2.7,math.sin(a)*2.7,t*4.6+seed)),noise_basis='PERLIN_ORIGINAL').x
        grit=noise.noise_vector(Vector((math.cos(a)*16,math.sin(a)*16,t*24)),noise_basis='PERLIN_ORIGINAL').x
        warped=max(0,min(1,t+(.075*math.sin(a*3+seed)+.032*math.sin(a*7))*math.sin(math.pi*t)))
        for (ta,ra),(tb,rb) in zip(strata,strata[1:]):
            if ta<=warped<=tb:
                profile=ra+(rb-ra)*(warped-ta)/(tb-ta);break
        fissure=sum(depth*math.exp(-(math.atan2(math.sin(a-angle),math.cos(a-angle))/width)**2) for angle,width,depth in faults)
        profile=profile*.62+((1-t)**.80*.98+.02)*.38
        radius=profile*edge*(1+coarse*.19+grit*.035-fissure*min(1,t*14))
        x=math.cos(a)*4.1*radius+.3*t;y=math.sin(a)*2.95*radius+.15*t
        rise=terrain_height(x*1.35,y*1.35,seed)/1.18
        z=-3.05*t+(.055*grit+.16*coarse)*min(1,t*18)+rise*(1-t)**3
        return Vector((x,y,z))
    for k in range(levels+1):
        ring=[]
        for i in range(count):
            ring.append(len(verts));verts.append(point(i*math.tau/count,k/levels))
        rings.append(ring)
    for k in range(levels):
        for i in range(count):
            j=(i+1)%count
            faces.extend([(rings[k][i],rings[k+1][i],rings[k][j]),(rings[k][j],rings[k+1][i],rings[k+1][j])])
            t=k/levels
            mineral=noise.noise_vector(verts[rings[k][i]]*2.7+Vector((seed,0,0))).x
            mat=2 if k<2 else (3 if mineral>.23 else (4 if mineral<-.40 else 0))
            materials.extend([mat,mat])
    # A tessellated soil cap with an exposed organic rim and a level inner plot.
    inner=[]
    for radius in [.0,.14,.28,.44,.58,.76,.90,1.0]:
        ring=[]
        for i in range(count):
            v=verts[rings[0][i]]*radius
            v.z=terrain_height(v.x*1.35,v.y*1.35,seed)/1.18
            if radius!=1:v.z+=.014+max(0,radius-.7)*noise.noise_vector(Vector((v.x*8,v.y*8,seed))).x*.075
            ring.append(len(verts));verts.append(v)
        inner.append(ring)
    for k in range(len(inner)-1):
        for i in range(count):
            j=(i+1)%count
            faces.extend([(inner[k][i],inner[k+1][i],inner[k+1][j]),(inner[k][i],inner[k+1][j],inner[k][j])])
            mat=1 if k<4 else 2
            materials.extend([mat,mat])
    obj=mesh('Island · eroded basalt escarpment',verts,faces,'rock')
    for mat in ['soil','ground','rock2','rock3']:obj.data.materials.append(P[mat])
    for poly,mat in zip(obj.data.polygons,materials):
        poly.material_index=mat
        # Dense facets catch daylight like chipped stone, without inflated edges.
        poly.use_smooth=poly.index>=levels*count*2
    # Low groundcover, grass, gravel and roots sit in the soil around the edge.
    city_scale=.18 if seed==31 else 1
    for i in range(110):
        a=rng.uniform(0,math.tau);v=point(a,0)*rng.uniform(.87,.98)
        v.z=terrain_height(v.x*1.35,v.y*1.35,seed)/1.18+.03
        if i%3==0:
            foliage('Rim · low wild groundcover',v,(.19*city_scale,.14*city_scale,.085*city_scale),rng,110)
        grass_verts=[];grass_faces=[]
        for j in range(rng.randint(16,32)):
            x=v.x+rng.uniform(-.13,.13);y=v.y+rng.uniform(-.10,.10)
            rim=point(math.atan2(y/2.95,x/4.1),0)
            if math.hypot(x/4.1,y/2.95)>.96*math.hypot(rim.x/4.1,rim.y/2.95):continue
            h=rng.uniform(.035,.15)*city_scale;lean=rng.uniform(-.04,.04)*city_scale;w=rng.uniform(.002,.006)*city_scale
            n=len(grass_verts)
            z=terrain_height(x*1.35,y*1.35,seed)/1.18+.025
            grass_verts.extend([(x-w,y,z),(x+w,y,z),(x+lean,y+.025,z+h)])
            grass_faces.append((n,n+1,n+2))
        mesh('Rim · fine wild grass',grass_verts,grass_faces,'moss' if i%2 else 'leaf2')
        for j in range(3):
            pos=v+Vector((rng.uniform(-.12,.12),rng.uniform(-.1,.1),-.016))
            size=rng.uniform(.018,.060)*city_scale
            stone=sphere('Rim · embedded angular gravel',pos,(size,size*.75,size*.48),'rock2' if j%2 else 'rock',1)
            stone.rotation_euler=(rng.random(),rng.random(),rng.random()*math.pi)
        if i%8==0 and seed!=31:
            pts=[point(a+.014*math.sin(t*22),t)+Vector((math.cos(a)*.012,math.sin(a)*.012,.01)) for t in [0,.025,.06,.105,.17,.24]]
            curve('Cliff · exposed root',pts,.006,'wood')
            branch=[pts[2],point(a+.04,.10),point(a+.07,.15)]
            curve('Cliff · branching root',branch,.003,'wood')
    # Give every world a broad, substantial landmass without enlarging its
    # buildings or furniture. The inner plot keeps its previous physical size.
    bpy.context.view_layer.update()
    transform_objects(set(bpy.context.scene.objects)-before,scale=(1.35,1.35,1.18))


def terrain_path(name,points,width,seed,mat='stone',step=.28):
    """Individual worn slabs follow the ground; no floating flat walkway."""
    rng=random.Random(seed)
    for a,b in zip(points,points[1:]):
        a,b=Vector(a),Vector(b);delta=b-a;count=max(1,round(delta.length/step))
        angle=math.atan2(delta.y,delta.x)
        for i in range(count):
            p=a+delta*((i+.5)/count);z=terrain_height(p.x,p.y,seed)
            city=seed==31
            box(name,(p.x,p.y,z+(.012 if city else .041)),(max(.004,delta.length/count-(.002 if city else .025)),width*rng.uniform(.96,1.01) if city else width*rng.uniform(.89,1.04),.018 if city else .065),mat,.001 if city else .018,angle+rng.uniform(-.008 if city else -.035,.008 if city else .035))


def landscape(world,seed):
    rng=random.Random(seed+18)
    # Raycast the actual soil cap, including its notches. An ideal ellipse
    # places some clumps outside the newly fractured outline.
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    ground=bpy.data.objects['Island · eroded basalt escarpment']
    terrain=BVHTree.FromObject(ground,bpy.context.evaluated_depsgraph_get())
    inverse=ground.matrix_world.inverted()
    def surface(x,y):
        hit,normal,index,distance=terrain.ray_cast(inverse@Vector((x,y,10)),Vector((0,0,-1)))
        if hit is None:return None
        pos=ground.matrix_world@hit
        return pos.z if pos.z>-.03 else None
    # A few embedded mineral outcrops and dense planted pockets create scale.
    for x,y in [(-4.35,.85),(3.95,1.87),(-2.85,-2.75),(2.65,-2.84),(4.55,-.55)]:
        z=surface(x,y)
        if z is None:continue
        size=.16 if world=='work' else 1
        rock=sphere('Terrain · exposed bedrock',(x,y,z-.08*size),(.43*size,.31*size,.23*size),'rock2',2)
        rock.rotation_euler.z=rng.uniform(-1,1)
        for i in range(4):
            px=x+rng.uniform(-.42,.42);py=y+rng.uniform(-.30,.30);pz=surface(px,py)
            if pz is None:continue
            p=(px,py,pz+.02)
            foliage('Terrain · sheltered planting',p,(.24*size,.19*size,.12*size),rng,130)
    # Actual blades form drifts, with bare earth between them and around paths.
    verts=[];faces=[]
    for i in range(150 if world=='work' else 65):
        a=rng.uniform(0,math.tau);r=rng.uniform(.80,.93)
        x=5.25*r*math.cos(a);y=3.65*r*math.sin(a)
        if abs(x)<2 and y<-2.5:continue
        for j in range(45):
            xx=x+rng.gauss(0,.13);yy=y+rng.gauss(0,.10)
            z=surface(xx,yy)
            if z is None:continue
            z+=.012;h=rng.uniform(.07,.23)*(.16 if world=='work' else 1)
            w=h*.035;lean=rng.uniform(-.4,.4)*h;n=len(verts)
            verts.extend([(xx-w,yy,z),(xx+w,yy,z),(xx+lean+w*.4,yy+.012,z+h*.65),(xx+lean,yy+.02,z+h)])
            faces.extend([(n,n+1,n+2),(n,n+2,n+3)])
    grass=mesh('Terrain · clustered meadow blades',verts,faces,'leaf2')
    grass.data.materials.append(P['leaf']);grass.data.materials.append(P['moss'])
    for face in grass.data.polygons:face.material_index=rng.choices([0,1,2],[4,3,1])[0]
    if world=='work':
        for i in range(68):
            a=rng.uniform(0,math.tau);r=rng.uniform(.70,.90)
            x=5.25*r*math.cos(a);y=3.60*r*math.sin(a)
            if abs(x)<3.35 and abs(y)<2.22:continue
            z=surface(x,y)
            if z is None:continue
            created=capture(tree,x,y,rng.uniform(.22,.34))
            transform_objects(created,offset=(0,0,z))
        # The original Xinyi streets now end in pedestrian places, not bare soil.
        terrain_path('Xinyi · west promenade',[(-4.45,-1.08),(-3.35,-.95)],.045,seed,'paving',.028)
        terrain_path('Xinyi · east promenade',[(3.25,-.95),(4.37,-.78)],.045,seed,'paving',.028)
        terrain_path('Xinyi · plaza approach',[(3.16,.50),(3.90,.50),(4.10,-.72)],.045,seed,'paving',.028)
        pavers=[];tiles=[]
        for row in range(73):
            for col in range(60):
                x=-4.05+col*.012;y=-.70+row*.012;z=terrain_height(x,y,seed)+.014;n=len(pavers)
                pavers.extend([(x,y,z),(x+.011,y,z),(x+.011,y+.011,z),(x,y+.011,z)])
                tiles.append((n,n+1,n+2,n+3))
        mesh('Xinyi · metre-scale civic paving',pavers,tiles,'paving')
        for x,y in [(-4.25,-.65),(-4.22,.25),(3.86,-.5),(3.85,.95)]:
            z=terrain_height(x,y,seed)
            box('Xinyi · raised planter',(x,y,z+.012),(.065,.065,.020),'stone',.001)
            created=capture(tree,x,y,.15)
            transform_objects(created,offset=(0,0,z+.015))
            box('Plaza · timber bench',(x+.055,y,z+.023),(.016,.05,.008),'wood',.001)
        # Yellow taxis, scooter bays and a green cycle strip are characteristic
        # street details, authored at the same scale as the surrounding city.
        P['taxi']=material('Taipei taxi yellow',(.72,.43,.018),rough=.55)
        for x in [-2.4,.3,2.45]:
            box('Taipei · yellow taxi',(x,-1.01,.069),(.047,.021,.018),'taxi',.004)
            box('Taxi · glazing',(x-.003,-1.01,.080),(.026,.016,.006),'glass',.001)
        box('Xinyi · green cycle lane',(-1.11,-.94,.049),(4.00,.024,.002),'jade',0)
        for x,y,title in [(-1.18,-1.08,'Xinyi Rd'),(1.68,1.30,'Songzhi Rd')]:
            rod('Taipei · street sign post',(x,y,.05),(x,y,.18),.004,'steel',8)
            box('Taipei · green road sign',(x,y,.18),(.17,.009,.044),'jade',.001)
            lettering('Taipei · '+title,title,(x,y-.006,.18),.025)
        for i in range(8):
            x=-2.82+i*.053
            rod('Scooter · front fork',(x,-1.19,.055),(x,-1.18,.079),.003,'steel',8)
            box('Scooter · saddle',(x,-1.20,.079),(.015,.025,.009),'ink',.002)
            box('Scooter · parking mark',(x,-1.21,.048),(.001,.06,.001),'paper',0)
    elif world=='writing':
        terrain_path('Garden · worn stepping stones',[(1.65,-3.28),(.75,-2.87),(-.10,-2.28)],.56,seed,'stone',.36)
        terrain_path('Garden · reading walk',[(-3.02,-.92),(-3.65,-.50),(-3.67,.83)],.53,seed,'stone',.37)
        # A low garden enclosure, bench and climbing plants shelter the study.
        for y in [-.20,.24,.68,1.12,1.56]:
            z=terrain_height(-4.0,y,seed)
            box('Garden · dry-stone wall',(-4.0,y,z+.27),(.27,.43,.54),'stone',.035)
        box('Garden · reading bench',(-3.66,.68,.46),(.50,1.15,.10),'wood',.016)
        for y in [.23,1.13]:box('Garden · bench support',(-3.66,y,.24),(.35,.11,.43),'stone',.014)
        for y in [-.3,1.50]:rod('Garden · trellis post',(-4.12,y,.05),(-4.12,y,1.73),.035,'wood')
        for z in [.48,.80,1.12,1.44,1.72]:rod('Garden · open trellis',(-4.12,-.30,z),(-4.12,1.50,z),.015,'wood')
        for i in range(16):
            y=rng.uniform(-.3,1.5);z=rng.uniform(.3,1.72)
            foliage('Garden · climbing leaves',(-4.09,y,z),(.20,.23,.18),rng,120)
    else:
        terrain_path('Workshop · worn yard paving',[(1.50,-3.24),(1.05,-2.62),(.30,-1.96)],.92,seed,'paving',.35)
        for i in range(2):box('Workshop · stone threshold step',(.30,-2.15+i*.22,.045+i*.045),(1.35,.30,.09),'stone',.015)
        for i in range(7):
            sawn_ends(box('Yard · reclaimed timber stack',(-3.82,-.48,.14+i*.061),(.40,1.88,.055),'floorwood',.004,rot=.08*(i%2)),'Y')
        for i in range(5):
            sawn_ends(box('Yard · loose sawn offcut',(-3.57+i*.14,-1.61+.06*(i%2),.045+i*.013),(.12,.32+i*.09,.035),'floorwood',.002,rot=-.25+i*.13),'Y')
        for x in [-3.98,-3.65]:box('Yard · stack bearer',(x,-.48,.07),(.13,1.95,.10),'wood',.003)
        box('Yard · material crate',(3.64,.45,.24),(.65,.85,.46),'wood',.008)
        for x in [3.40,3.63,3.86]:box('Yard · crate slat',(x,.01,.26),(.16,.024,.42),'oak',.003)
        for i in range(4):
            box('Yard · aluminium offcut',(3.58+i*.07,.44,.75),(.022,.027,.94-i*.09),'steel',.001,rot=.05*i)
        cylinder('Yard · cable reel',(3.62,-.83,.22),.27,.35,'wood',40,bevel=.01)
        for z in [.065,.365]:cylinder('Reel · flange',(3.62,-.83,z),.33,.035,'oak',40,bevel=.006)


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
        if bpy.context.scene.name.startswith('Writing'):
            leaf.shape_key_add(name='Rest')
            breeze=leaf.shape_key_add(name='Gentle leaf flex')
            for index,point in enumerate(breeze.data):
                weight=(index//3)/8
                point.co.z+=.025*scale*weight*weight
                point.co.x+=.012*scale*weight*weight
            for frame,value in [(1,0),(13,.6 if i%2 else .3),(29,1),(41,.25),(49,0)]:
                breeze.value=value;breeze.keyframe_insert(data_path='value',frame=frame)
        curve('Plant · central leaf vein',[verts[j*3+1] for j in range(9)],.0018*scale,'moss')


def window_grid(x,y,width,depth,height,seed,base=.10,spacing=.075):
    rng=random.Random(seed); verts=[]; faces=[]; mats=[]
    cols=max(3,int(width/spacing)); rows=max(3,int(height/.038))
    for side in ['front','right','back']:
        span=width if side!='right' else depth
        cols=max(3,int(span/spacing))
        suites={}
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
                suite=(row//3,col//4)
                if suite not in suites:suites[suite]=rng.random()<.23
                lit=suites[suite] and rng.random()<.87
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
                if col%5==0:suite_lit=occupied and rng.random()<.40
                ms.append(rng.choice([1,1,2,3]) if suite_lit and rng.random()<.9 else rng.choice([0,0,0,4,5]))
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
    if 'mixed-use' in name and style%3:
        # Older blocks have recessed penthouses, balcony bands and roof gardens.
        rectilinear_block(name,x,y,w,d,h*.73,seed,style)
        rectilinear_block(name+' · recessed upper storey',x+.025,y+.025,w*.76,d*.77,h*.27,seed+53,style,base=.055+h*.73)
        for z in [.13,.23,.33]:
            if z>h*.70:continue
            box(name+' · balcony ledge',(x,y-d/2-.019,z),(w*.83,.045,.009),'concrete',.001)
            rod(name+' · balcony rail',(x-w*.4,y-d/2-.04,z+.030),(x+w*.4,y-d/2-.04,z+.030),.002,'steel',6)
    else:rectilinear_block(name,x,y,w,d,h,seed,style)


def rectilinear_block(name,x,y,w,d,h,seed,style=0,base=.055):
    rng=random.Random(seed)
    box(name+' · mass',(x,y,base+h/2),(w,d,h),['concrete','glass','glass2','stone'][style%4],.001)
    # Hundreds of small panes, concrete piers, roof plant and recessed entrances.
    window_grid(x,y,w,d,h,seed,base=base,spacing=.025 if h>1 else .032)
    rows=max(2,round(h/.038))
    for j in range(rows+1):
        box(name+' · floor slab',(x,y,base+j*h/rows),(w+.003,d+.003,.004 if style else .007),'teal' if style else 'concrete',0)
    for side in [-1,1]:
        for j in range(max(2,int(w/.09))):
            xx=x-w/2+.035+j*.09
            box(name+' · facade pier',(xx,y+side*(d/2+.001),base+h/2),(.007,.004,h),'steel' if style else 'concrete',0)
    box(name+' · roof slab',(x,y,h+base+.005),(w+.012,d+.012,.018),'concrete',.001)
    for j in range(3):
        xx=x+rng.uniform(-.25,.25)*w;yy=y+rng.uniform(-.25,.25)*d
        box(name+' · roof mechanical',(xx,yy,h+base+.033),(.045,.073,.035),'steel',.001)
        for k in range(4):box(name+' · condenser louvre',(xx,yy-.029+k*.018,h+base+.052),(.040,.004,.002),'ink',0)
    for xx in [x-w*.22,x+w*.22]:box(name+' · entry',(xx,y-d/2-.006,base+.035),(.05,.025,.07),'glass',.001)


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
    P['glass']=material('Taipei · green architectural glazing',(.055,.12,.092),metal=.42,rough=.24)
    foundation(31);landscape('work',31);rng=random.Random(263)
    ground=bpy.data.objects['Island · eroded basalt escarpment'];ground.data.materials[1]=P['paving']
    ground.data.materials[2]=textured('Xinyi · park meadow',(.046,.060,.020),(.16,.18,.071),'moss',rough=.98)
    # A compressed Xinyi composition. North is +Y; east is +X.
    # Xinyi Road, City Hall Road, Songzhi Road and Songshou Road frame the blocks.
    street((-3.35,-.95),(3.25,-.95),.24)
    street((-1.05,-2.36),(-1.05,2.2),.18)
    street((1.55,-2.36),(1.55,2.2),.17)
    street((-3.3,1.35),(3.25,1.35),.18)
    street((-3.15,.12),(-1.17,.12),.13)
    street((-2.80,-2.32),(1.67,-2.32),.10)
    ANCHORS['traffic']=[(-2.65,-2.32,.064),(1.38,-2.32,.064)]
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
        sawn_ends(box('Floor · aged oak plank',(x,0,.10),(.289,length*2,.095),'floorwood',.003),'Y')
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
    rng=random.Random(733)
    curve('Notebook · recessed cloth spine',[(x,y-depth/2,z+.009),(x,y,z+.007),(x,y+depth/2,z+.009)],.008,'leather')
    for side in [-1,1]:
        box('Notebook · soft cloth binding',(x+side*width/4,y,z+.006),(width/2+.009,depth+.025,.012),'linen',.003)
        for layer in range(22):
            verts=[]
            edge=rng.uniform(-.004,.004)
            for yy in [-depth/2,depth/2]:
                for i in range(33):
                    u=i/32;xx=side*(.010+u*(width/2-.010+edge))
                    zz=z+.018+layer*.0013+.046*math.sin(u*math.pi)**.70
                    verts.append((x+xx,y+yy+edge*u,zz))
            obj=mesh('Notebook · individual paper sheet',verts,[(i,i+1,i+34,i+33) for i in range(32)],'paper')
            for f in obj.data.polygons:f.use_smooth=True
            if layer==21 and side==1:
                obj.shape_key_add(name='Rest');corner=obj.shape_key_add(name='Lifted paper corner')
                for index,point in enumerate(corner.data):
                    weight=max(0,(index%33-25)/7)**2*(1 if index<33 else 0)
                    point.co.z+=.022*weight
                for frame,value in [(1,0),(25,1),(49,0)]:corner.value=value;corner.keyframe_insert(data_path='value',frame=frame)
    ANCHORS['spread']=[(x-width/2,y+depth/2,z+.072),(x+width/2,y+depth/2,z+.072),(x-width/2,y-depth/2,z+.072),(x+width/2,y-depth/2,z+.072)]
    ANCHORS['page']=[(x+.075,y+.27,z+.087),(x+.406,y+.27,z+.077),(x+.075,y-.27,z+.087),(x+.406,y-.27,z+.077)]
    ANCHORS['landmark']=(x,y,z+.07)
    rng=random.Random(233)
    for j in range(16):
        yy=y-.275+j*.035
        length=rng.uniform(.19,.32)
        pts=[]
        for i in range(12):
            xx=-.225-length/2+length*i/11;u=abs(xx)/(.46)
            pts.append((x+xx,yy,z+.047+.046*math.sin(u*math.pi)**.70))
        curve('Notebook · handwritten line',pts,.00045,'page')
    curve('Notebook · silk bookmark',[(x,y+.31,z+.045),(x+.002,y-.30,z+.045),(x+.014,y-.40,z-.005)],.0025,'redcloth')


def woven_rug():
    # A soft selvedge and individually modelled warp make this read as cloth.
    verts=[];faces=[];cols=90;rows=65
    for j in range(rows+1):
        for i in range(cols+1):
            u=i/cols;v=j/rows
            edge=abs(u-.5)*2
            x=.1+(u-.5)*4.31+.009*math.sin(v*38)*edge**12
            y=-.61+(v-.5)*3.21+.008*math.sin(u*47)*(abs(v-.5)*2)**12
            z=.157+.006*math.sin(u*21+v*3)*math.sin(v*16)+.012*edge**16*math.sin(v*9)**2
            verts.append((x,y,z))
    for j in range(rows):
        for i in range(cols):
            a=j*(cols+1)+i;faces.append((a,a+1,a+cols+2,a+cols+1))
    rug=mesh('Study · softly rumpled woven rug',verts,faces,'linen')
    for face in rug.data.polygons:face.use_smooth=True
    for i in range(215):
        x=-2.05+i*.02
        curve('Rug · visible warp',[(x,-2.21+j*.20,.166+.002*math.sin(i+j)) for j in range(17)],.0018,'linen')
    for side in [-1,1]:
        for i in range(115):
            y=-2.18+i*.027
            curve('Rug · loose flax fringe',[(side*2.14+.1,y,.164),(side*2.20+.1,y+.006,.157),(side*(2.24+.008*math.sin(i))+.1,y+.003,.151)],.0018,'linen')


def image_panel(name, source, center, width, height):
    """A matte physical print of Carter's existing site artwork, packed into .blend."""
    image=bpy.data.images.load(str(ROOT/'public'/source),check_existing=True)
    if not image.packed_file: image.pack()
    mat=material(name+' · archival print',(.8,.8,.8),rough=.96)
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
    x,y,z=center
    obj=mesh(name,[(x-width/2,y,z-height/2),(x+width/2,y,z-height/2),(x+width/2,y,z+height/2),(x-width/2,y,z+height/2)],[(0,1,2,3)],mat)
    uv=obj.data.uv_layers.new(name='Print coordinates')
    for loop,point in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]):loop.uv=point
    return obj


def lettering(name, body, loc, size, mat='paper', rotation=(math.pi/2,0,0)):
    data=bpy.data.curves.new(name,'FONT');data.body=body;data.size=size;data.extrude=.0002
    data.align_x='CENTER';data.align_y='CENTER';data.space_line=1.12
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    obj.location=loc;obj.rotation_euler=rotation;data.materials.append(P[mat])
    return obj


def turn_group(name, objects, degrees, origin, anchor_keys=()):
    # Parent space keeps the paper's keyed movement and lamp's light animation
    # attached to the furniture, while projecting anchors through the same turn.
    from mathutils import Matrix
    matrix=Matrix.Translation(Vector(origin)) @ Matrix.Rotation(math.radians(degrees),4,'Z') @ Matrix.Translation(-Vector(origin))
    parent=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(parent)
    parent.matrix_world=matrix
    for obj in objects: obj.parent=parent
    for key in anchor_keys:
        value=ANCHORS[key]
        ANCHORS[key]=[tuple(matrix@Vector(v)) for v in value] if isinstance(value,list) else tuple(matrix@Vector(value))


def writing():
    foundation(73);landscape('writing',73);floorboards()
    # A low garden wall and an open frame replace the enclosing room box.
    box('Study · low limewashed garden wall',(-.18,1.98,.57),(6.1,.12,.82),'plaster',.009)
    box('Study · low side return',(-3.19,1.1,.57),(.12,1.82,.82),'plaster',.009)
    box('Study · stone coping',(-.18,1.98,1.00),(6.16,.20,.055),'stone',.007)
    # A sheltered window seat: slender frame, trees visible around it.
    for xx in [-2.79,-1.13]:box('Window · structural oak post',(xx,1.89,1.54),(.065,.09,2.75),'oak',.003)
    box('Study · window glass',(-1.96,1.90,2.10),(1.58,.011,1.43),'glass',.001)
    box('Window · central mullion',(-1.96,1.85,2.10),(.026,.07,1.47),'teal',.002)
    for zz in [1.36,2.10,2.84]:box('Window · horizontal rail',(-1.96,1.85,zz),(1.72,.07,.027),'teal',.002)
    box('Window · oak sill',(-1.96,1.77,1.32),(1.89,.29,.05),'oak',.003)
    box('Window · narrow rain canopy',(-1.96,1.72,2.95),(2.06,.54,.055),'teal',.004)
    # Open, lower shelves let the book keep the foreground and sky stay visible.
    rng=random.Random(940)
    for x in [-.58,1.0,2.58]:box('Study · bookcase upright',(x,1.62,1.49),(.046,.46,2.60),'wood',.003)
    for z in [.20,1.04,1.90,2.80]:
        box('Study · bookcase shelf',(1,1.60,z),(3.22,.55,.040),'wood',.002)
        if z>2.7:continue
        for start,end in [(-.53,.90),(1.08,2.53)]:
            x=start
            while x<end-.15:
                if rng.random()<.16:x+=.30;continue
                w=rng.uniform(.048,.11);h=rng.uniform(.36,.55)
                created=capture(shelf_book,x+w/2,1.59,z+.022,w,h,rng.choice(['linen','leather','redcloth','teal','oak']))
                for obj in created:obj.location.y+=rng.uniform(-.008,.008)
                x+=w+.011
    # These are Carter's published essays, presented as bound journals—not
    # invented reading-list entries. Their existing covers are used verbatim.
    journals=[('the-cost-of-keeping-up','The Cost of Keeping Up',-.24),('slop-and-spiral','Slop and Spiral',.47),('we-all-have-superpowers','We All Have Superpowers',1.42)]
    for slug,title,x in journals:
        box('Journal · '+title,(x,1.29,2.20),(.46,.065,.58),'linen',.006)
        image_panel('Journal cover · '+title,'essay-covers/'+slug+'.webp',(x,1.252,2.20),.44,.56)
        box('Journal · title label',(x,1.244,1.999),(.42,.008,.11),'paper',.001)
        lettering('Journal title · '+title,title,(x,1.236,2.0),.025,'ink')
    furniture=set(bpy.context.scene.objects)
    # Desk height 74cm, top 3cm; proportions use 2 scene units per metre.
    for x in [-1.46,1.66]:
        for y in [-1.34,-.07]:
            rod('Desk · tapered oak leg',(x*1.035,y,.16),(x,y,1.55),.045,'wood',24)
        box('Desk · short apron',(x,-.70,1.41),(.055,1.31,.18),'wood',.002)
    for y in [-1.32,-.07]:box('Desk · long apron',(.1,y,1.43),(3.18,.055,.13),'wood',.002)
    for i in range(5):sawn_ends(box('Desk · solid walnut top',(.1,-1.39+i*.32,1.58),(3.56,.315,.060),'wood',.005))
    box('Desk · inset drawer',(.05,-1.417,1.43),(1.16,.04,.13),'wood',.002)
    rod('Desk · recessed drawer pull',(-.10,-1.443,1.45),(.20,-1.443,1.45),.008,'brass')
    capture(notebook,.16,-.80,1.614,scale=(1.22,1.22,1.22),origin=(.16,-.80,1.614))
    for key in ['spread','page','landmark']:
        value=ANCHORS[key]
        convert=lambda v:tuple(Vector((.16,-.80,1.614))+(Vector(v)-Vector((.16,-.80,1.614)))*1.22)
        ANCHORS[key]=[convert(v) for v in value] if isinstance(value,list) else convert(value)
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
    turn_group('Study · gently turned desk',set(bpy.context.scene.objects)-furniture,10,(.1,-.7,0),['spread','page','landmark','lamp'])
    light('Study · paper warmth',(.2,-1.15,2.75),(1,.78,.51),25,.8,(.1,-.8,1.65))
    plant(-2.65,.57,.15,1.06)
    # A woven rug grounds the chair and desk without adding another plinth.
    woven_rug()


def hammer(x,y,z):
    rod('Hammer · hickory handle',(x,y,z),(x,y,z+.52),.023,'oak',24)
    cylinder('Hammer · grip end',(x,y,z+.055),.026,.11,'leather',32,bevel=.003)
    box('Hammer · forged head',(x,y,z+.53),(.22,.073,.078),'steel',.01)
    rod('Hammer · striking face',(x-.10,y,z+.53),(x-.15,y,z+.53),.044,'steel',24)
    curve('Hammer · claw',[(x+.10,y,z+.53),(x+.18,y,z+.50),(x+.21,y,z+.46)],.018,'steel')


def workshop():
    foundation(107);landscape('projects',107);floorboards()
    # A practical studio wall, with a small tool rail rather than a giant toy pegboard.
    box('Workshop · limewashed tool wall',(-1.45,1.96,1.58),(3.36,.10,2.84),'plaster',.003)
    box('Workshop · wall coping',(-1.45,1.96,3.02),(3.45,.19,.07),'stone',.004)
    box('Workshop · perforated steel panel',(-1.22,1.864,2.18),(2.80,.028,1.33),'teal',.002)
    vs=[];fs=[]
    for row in range(18):
        for col in range(39):
            x=-2.55+col*.070;z=1.57+row*.071;n=len(vs)
            vs.extend([(x-.005,1.847,z-.005),(x+.005,1.847,z-.005),(x+.005,1.847,z+.005),(x-.005,1.847,z+.005)])
            fs.append((n,n+1,n+2,n+3))
    mesh('Tool panel · fine perforations',vs,fs,'ink')
    for i,x in enumerate([-2.2,-1.72]):capture(hammer,0,0,0,scale=(.65,.65,.65),offset=(x,1.79,1.82))
    for i,x in enumerate([-.98,-.80,-.62]):
        rod('Driver · shaft',(x,1.80,1.85),(x,1.80,2.10),.008,'steel')
        rod('Driver · rubber handle',(x,1.80,2.10),(x,1.80,2.27),.022,'ink' if i%2 else 'clay')
    # Real project references are pinned above the tools, like working prints.
    for x,source,title in [(-2.25,'taipei-flix.webp','TaipeiFlix'),(-1.36,'taipei-run.jpg','Taipei Run')]:
        box('Project reference · '+title,(x,1.813,2.55),(.76,.017,.48),'paper',.002)
        image_panel('Project print · '+title,'project-shots/'+source,(x,1.800,2.55),.71,.43)
        pin=cylinder('Project pin',(x,1.78,2.79),.016,.008,'brass',16);pin.rotation_euler.x=math.pi/2
    furniture=set(bpy.context.scene.objects)
    # Bench dimensions: 2.35m wide, 80cm deep, 86cm working height.
    for x in [-2.17,2.17]:
        for y in [-.60,.72]:box('Bench · welded steel leg',(x,y,.95),(.085,.085,1.56),'teal',.004)
        box('Bench · steel crossmember',(x,.06,.47),(.067,1.4,.067),'teal',.003)
    for y in [-.60,.72]:box('Bench · steel apron',(0,y,1.59),(4.42,.055,.15),'teal',.003)
    for i in range(9):sawn_ends(box('Bench · laminated beech top',(0,-.70+i*.19,1.74),(4.74,.185,.10),'oak',.003))
    box('Bench · lower shelf',(0,.08,.50),(4.38,1.33,.035),'wood',.003)
    # One real cabinet, with narrow reveals and small handles.
    for row in range(4):
        z=.71+row*.223
        if row==3:
            box('Bench · open drawer bottom',(-1.51,-.76,z-.085),(1.03,1.03,.020),'wood',.004)
            for x in [-2.016,-1.004]:box('Bench · drawer side',(x,-.76,z),(.018,1.03,.19),'teal',.003)
            box('Bench · open drawer front',(-1.51,-1.275,z),(1.03,.025,.20),'teal',.006)
            for i in range(4):box('Drawer · spare component',(-1.84+i*.22,-1.05,z-.015),(.13,.22,.06),'steel' if i%2 else 'ink',.003)
        else:box('Bench · painted drawer',(-1.51,-.56,z),(1.03,.70,.20),'teal',.006)
        yy=-1.297 if row==3 else -.928
        rod('Bench · drawer handle',(-1.72,yy,z+.045),(-1.30,yy,z+.045),.010,'steel')
    for i in range(9):cylinder('Bench · dog hole',(-2.04+i*.44,-.69,1.792),.012,.002,'ink',16,bevel=0)
    # A 27-inch studio monitor gives the screen a clear silhouette above the
    # tools. A separate keyboard and trackpad preserve credible desk proportions.
    sx,sy,sz=.98,.30,1.809
    box('Workstation · aluminium keyboard',(sx,sy-.42,sz),(.86,.32,.022),'steel',.008)
    for row in range(5):
        for col in range(14):box('Workstation · key',(sx-.38+col*.058,sy-.54+row*.047,sz+.014),(.048,.034,.003),'ink',.003)
    box('Workstation · trackpad',(sx+.68,sy-.43,sz),(.25,.30,.016),'steel',.006)
    box('Monitor · weighted foot',(sx,sy+.04,sz),(.46,.36,.025),'steel',.007)
    box('Monitor · slender stand',(sx,sy+.18,sz+.26),(.075,.052,.48),'steel',.006)
    bottom=sz+.37;top=bottom+.72
    screen=[(sx-.60,sy+.11,top),(sx+.60,sy+.11,top),(sx-.60,sy+.06,bottom),(sx+.60,sy+.06,bottom)]
    housing=box('Monitor · thin display housing',(sx,sy+.105,(bottom+top)/2),(1.25,.036,.77),'teal',.008)
    housing.rotation_euler.x=math.radians(-4)
    mesh('Monitor · screen glass',[screen[0],screen[1],screen[3],screen[2]],[(0,1,2,3)],'screen')
    ANCHORS['screen']=screen;ANCHORS['landmark']=(sx,sy+.085,(bottom+top)/2);ANCHORS['screenGlow']=(sx,sy-.22,sz+.02)
    light('Monitor · reflected screen light',(sx,sy-.18,sz+.72),(.64,.79,1),3,.7,(sx,sy-.50,sz))
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
    # Different working objects replace the three identical empty cases.
    box('Bench · shallow parts tray',(-.43,-.12,.55),(.82,.76,.05),'teal',.006)
    for x in [-.84,-.02]:box('Tray · side',(x,-.12,.63),(.015,.76,.14),'teal',.003)
    for y in [-.50,.26]:box('Tray · end',(-.43,y,.63),(.82,.015,.14),'teal',.003)
    for i in range(3):box('Tray · compartment divider',(-.66+i*.23,-.12,.62),(.008,.74,.12),'steel',.002)
    for i in range(12):
        x=-.74+(i%4)*.20;y=-.36+(i//4)*.21
        cylinder('Tray · spare fitting',(x,y,.60),.034,.055,'brass' if i%3 else 'steel',12,bevel=.002)
    for i in range(5):torus('Bench · coiled extension lead',(.64,-.04,.55+i*.017),.28-i*.012,.012,'ink')
    box('Bench · cable connector',(.78,-.35,.575),(.055,.11,.050),'teal',.006)
    box('Bench · folded canvas tool roll',(1.50,.05,.60),(.65,.65,.15),'linen',.025,rot=.10)
    for x in [1.28,1.69]:box('Tool roll · leather strap',(x,.05,.68),(.045,.68,.014),'leather',.003,rot=.10)
    turn_group('Workshop · turned workbench',set(bpy.context.scene.objects)-furniture,9,(0,0,0),['screen','landmark','screenGlow','lamp'])
    rear_storage=set(bpy.context.scene.objects)
    # A metal storage rack and drawer organiser; no decorative string lights.
    for x in [.48,2.68]:box('Storage · shelf upright',(x,1.60,2.0),(.045,.055,3.68),'steel',.002)
    for x in [.48,2.68]:box('Storage · floor foot',(x,1.60,.18),(.23,.48,.05),'teal',.003)
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
    bpy.context.view_layer.update()
    transform_objects(set(bpy.context.scene.objects)-rear_storage,scale=(1,1,.72),origin=(0,0,.16))
    # A low stool with metal legs and a modest padded seat.
    for xx in [-.27,.27]:
        for yy in [-.27,.27]:rod('Stool · splayed steel leg',(2.75+xx*1.25,-.78+yy*1.25,.16),(2.75+xx,-.78+yy,1.08),.021,'teal',20)
    cylinder('Stool · padded seat',(2.75,-.78,1.10),.37,.085,'leather',64,bevel=.020)
    torus('Stool · foot ring',(2.75,-.78,.43),.33,.012,'steel')
    # Under-shelf task strip provides a soft local pool of light.
    box('Workshop · practical LED strip',(1.56,1.44,1.61),(2.04,.025,.015),'light',.003)
    ANCHORS['bulbs']=[(1.10,1.44,1.61),(2.0,1.44,1.61)]
    light('Workshop · task strip',(1.56,1.35,1.58),(1,.79,.58),9,1.0,(1.1,.6,1.1))
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
    scene.view_settings.exposure=.25
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
    # Broad daylight keeps matte timber and stone clear; practicals add warmth.
    light('Sky · north window',(-7,-4,11),(.86,.90,1),1450,4.5,(0,0,.7))
    light('Dusk · horizon',(4,5,7),(1,.81,.57),750,5,(0,0,1))
    light('Front · reflected sky',(0,-8,3),(.82,.87,1),160,8,(0,0,.7))
    light('Cliff · ambient bounce',(-4,-3,-1),(.66,.69,.60),35,6,(0,0,-.8))
    light('Cliff · cool edge',(5,3,1),(.53,.68,1),230,3,(0,0,-.8))
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
            if args.engine=='CYCLES':
                scene.cycles.samples=24
                scene.cycles.adaptive_threshold=.08
                scene.cycles.adaptive_min_samples=4
                scene.render.use_persistent_data=True
            # Animation stays on a fixed camera so the live page still aligns.
            for frame in range(1,49):
                scene.frame_set(frame)
                scene.render.filepath=str(frames/f'{frame}.png')
                bpy.ops.render.render(write_still=True)
        print(f'COMPLETED {world}',flush=True)


if __name__=='__main__':
    main()
