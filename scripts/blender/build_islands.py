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
REFINEMENTS = json.loads((Path(__file__).with_name('island-refinements.json')).read_text())


def refined(world, detail):
    """Build-time switches: selective reverts never add browser work."""
    return REFINEMENTS.get(world, {}).get(detail, False)


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


def fade_with_depth(mat, top=0., bottom=-3.6, floor=.45):
    """Darken a surface toward the island's underside, so the cliff recedes
    into the night instead of reading as an evenly lit rock sample."""
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bs = nodes.get('Principled BSDF')
    source = bs.inputs['Base Color'].links[0].from_socket if bs.inputs['Base Color'].is_linked else None
    geometry = nodes.new('ShaderNodeNewGeometry')
    split = nodes.new('ShaderNodeSeparateXYZ')
    links.new(geometry.outputs['Position'], split.inputs[0])
    ramp = nodes.new('ShaderNodeMapRange')
    ramp.inputs['From Min'].default_value = bottom; ramp.inputs['From Max'].default_value = top
    ramp.inputs['To Min'].default_value = floor; ramp.inputs['To Max'].default_value = 1
    links.new(split.outputs['Z'], ramp.inputs['Value'])
    curve = nodes.new('ShaderNodeMath'); curve.operation = 'POWER'; curve.inputs[1].default_value = 1.25
    links.new(ramp.outputs[0], curve.inputs[0])
    mix = nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1
    if source: links.new(source, mix.inputs['A'])
    else: mix.inputs['A'].default_value = bs.inputs['Base Color'].default_value
    links.new(curve.outputs[0], mix.inputs['B'])
    links.new(mix.outputs['Result'], bs.inputs['Base Color'])
    return mat


def weathered(mat, value=.16, hue=.03, streak=.20):
    """No two buildings share an exact colour: each object gets its own small
    shift in value and hue, and rain streaks darken the facade downward."""
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bs = nodes.get('Principled BSDF')
    source = bs.inputs['Base Color'].links[0].from_socket if bs.inputs['Base Color'].is_linked else None
    info = nodes.new('ShaderNodeObjectInfo')
    lift = nodes.new('ShaderNodeMapRange'); lift.inputs['To Min'].default_value = 1-value; lift.inputs['To Max'].default_value = 1+value
    links.new(info.outputs['Random'], lift.inputs['Value'])
    spread = nodes.new('ShaderNodeMath'); spread.operation = 'MULTIPLY'; spread.inputs[1].default_value = 7.13
    links.new(info.outputs['Random'], spread.inputs[0])
    frac = nodes.new('ShaderNodeMath'); frac.operation = 'FRACT'; links.new(spread.outputs[0], frac.inputs[0])
    shift = nodes.new('ShaderNodeMapRange'); shift.inputs['To Min'].default_value = .5-hue; shift.inputs['To Max'].default_value = .5+hue
    links.new(frac.outputs[0], shift.inputs['Value'])
    tint = nodes.new('ShaderNodeHueSaturation')
    links.new(shift.outputs[0], tint.inputs['Hue']); links.new(lift.outputs[0], tint.inputs['Value'])
    if source: links.new(source, tint.inputs['Color'])
    else: tint.inputs['Color'].default_value = bs.inputs['Base Color'].default_value
    geometry = nodes.new('ShaderNodeNewGeometry')
    stretch = nodes.new('ShaderNodeVectorMath'); stretch.operation = 'MULTIPLY'; stretch.inputs[1].default_value = (70, 70, 3)
    links.new(geometry.outputs['Position'], stretch.inputs[0])
    rain = nodes.new('ShaderNodeTexNoise'); rain.inputs['Scale'].default_value = 1; rain.inputs['Detail'].default_value = 3
    links.new(stretch.outputs[0], rain.inputs['Vector'])
    stain = nodes.new('ShaderNodeMapRange'); stain.inputs['From Min'].default_value = .45; stain.inputs['From Max'].default_value = .75
    stain.inputs['To Min'].default_value = 1; stain.inputs['To Max'].default_value = 1-streak
    links.new(rain.outputs['Fac'], stain.inputs['Value'])
    mix = nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'; mix.inputs['Factor'].default_value = 1
    links.new(tint.outputs[0], mix.inputs['A']); links.new(stain.outputs[0], mix.inputs['B'])
    links.new(mix.outputs['Result'], bs.inputs['Base Color'])
    return mat


def palette():
    global P
    P = {
        'rock': textured('Weathered shale · fractured mineral grain',(.062,.056,.040),(.29,.26,.195)),
        'rock2': textured('Ochre mineral faces',(.10,.072,.040),(.40,.31,.18)),
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
        'rug': textured('Hand-knotted madder wool',(.16,.045,.028),(.36,.15,.075),'fabric',rough=.98),
        'redcloth': textured('Faded rust book cloth',(.095,.049,.035),(.24,.13,.08),'fabric',rough=.96),
        'light': material('Warm practical lights',(1,.67,.30),emission=3),
        'window': material('Warm occupied offices',(.95,.64,.32),emission=1.2),
        'window2': material('Cool occupied offices',(.62,.76,.86),emission=.9),
        'window3': material('Dim occupied offices',(.55,.42,.26),emission=.45),
        'screen': material('Screen glass',(.025,.065,.08),emission=.35),
        'pane2': material('Slightly warmer reflective glass',(.046,.084,.078),metal=.34,rough=.19),
        'nightglass': material('Window onto the night',(.012,.020,.050),metal=.2,rough=.08,emission=.35),
        'pane3': material('Slightly cooler reflective glass',(.042,.079,.091),metal=.38,rough=.15),
        'paving': textured('Urban pavers',(.085,.087,.082),(.16,.165,.157),rough=.77),
        'steel': material('Brushed aluminium',(.30,.33,.34),metal=.83,rough=.3),
    }
    for key in ['rock','rock2','rock3','soil']: fade_with_depth(P[key])
    # Continuous patches follow the surface rather than the mesh's triangle grid.
    ground=textured('Earth · irregular moss and exposed humus',(.047,.032,.016),(.13,.145,.057),'soil',rough=.98)
    ramp=next(n for n in ground.node_tree.nodes if n.type=='VALTORGB')
    # Mostly meadow, with soil showing only in the hollows.
    ramp.color_ramp.elements[0].position=.20
    ramp.color_ramp.elements[0].color=(.042,.038,.018,1)
    ramp.color_ramp.elements[1].position=.78
    ramp.color_ramp.elements[1].color=(.13,.165,.062,1)
    ramp.color_ramp.elements.new(.40).color=(.080,.074,.034,1)
    ramp.color_ramp.elements.new(.58).color=(.075,.105,.036,1)
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


# Terrain and cliff noise use noise.noise, never noise.noise_vector: Blender
# seeds noise_vector's offsets randomly at startup, so it reshaped every island
# (and moved everything placed on it) on each build.
def terrain_height(x,y,seed):
    """The inhabited plot is level; the outer land rises into broken shoulders."""
    radius=math.sqrt((x/5.535)**2+(y/3.9825)**2)
    edge=max(0,min(1,(radius-.66)/.25))
    broad=noise.noise(Vector((x*.65,y*.65,seed)),noise_basis='PERLIN_ORIGINAL')
    # The city's district is built out to its edge, so its shoulders stay low.
    rise=.22 if seed==31 else 1
    height=rise*edge*edge*(.10+.22*(.5+.5*math.sin(x*1.4+y*.8))+.14*broad)
    if seed==107:
        # Grade the expanded court's yard below its concrete pad, blending
        # back into the irregular shoulders beyond the playing surface.
        x0,x1,y0,y1=COURT
        distance=max(x0-x,x-x1,y0-y,y-y1,0)
        blend=max(0,min(1,distance/.55))
        height*=blend*blend*(3-2*blend)
    return height


# Each island has its own plan instead of one shared oval. (squareness,
# jitter range, lobes as (angle, width, reach)).
PLANS={
    # A broad, squarer district the city's grid actually fills.
    'district':(3.4,(.95,1.02),[(math.radians(35),.5,.06),(math.radians(215),.5,.05)]),
    # A soft, rounded garden plot with a bulge where the reading garden sits.
    'garden':(2.0,(.94,1.02),[(math.radians(170),.55,.10),(math.radians(-60),.6,.05)]),
    # A rough, broken lot: a jagged edge and a yard lobe past the court. Kept
    # narrow (a short yard lobe, the left shoulder drawn in where the timber
    # stack stood) so the wide, low shed fills as much of its frame as the
    # taller study and city do on a phone.
    'lot':(2.3,(.80,1.07),[(math.radians(12),.75,.18),(math.radians(-150),.35,.08),(math.radians(180),.6,-.15)]),
}


def plan_radius(a,plan):
    n,_,lobes=PLANS[plan]
    square=(abs(math.cos(a))**n+abs(math.sin(a))**n)**(-1/n)
    lobe=sum(reach*math.exp(-(math.atan2(math.sin(a-angle),math.cos(a-angle))/width)**2) for angle,width,reach in lobes)
    return square*(1+lobe)


def foundation(seed,plan='garden'):
    before=set(bpy.context.scene.objects)
    rng=random.Random(seed)
    count=192; levels=64; verts=[]; rings=[]; faces=[]; materials=[]
    # Broken cliff contours replace the old smooth, periodically stacked rings.
    low,high=PLANS[plan][1]
    outline=[rng.uniform(low,high) for _ in range(24 if plan!='lot' else 36)]
    # Different plans share the same sedimentary structure. Local faults cut
    # vertically through stepped ledges rather than smoothing into a bowl.
    faults=[(rng.uniform(0,math.tau),rng.uniform(.08,.18),rng.uniform(.06,.15)) for _ in range(11)]
    # Full under the soil lip, easing to a narrower keel: shallow enough that
    # the base supports the scene rather than outweighing it.
    strata=[(0,1),(.10,.99),(.15,.86),(.29,.88),(.34,.72),(.48,.73),(.54,.55),(.70,.53),(.77,.33),(.90,.24),(1,.02)]
    def point(a,t):
        k=len(outline);phase=(a%math.tau)/math.tau*k;i=int(phase);f=phase-i
        edge=(outline[i%k]*(1-f)+outline[(i+1)%k]*f)*plan_radius(a,plan)
        coarse=noise.noise(Vector((math.cos(a)*2.7,math.sin(a)*2.7,t*4.6+seed)),noise_basis='PERLIN_ORIGINAL')
        grit=noise.noise(Vector((math.cos(a)*16,math.sin(a)*16,t*24)),noise_basis='PERLIN_ORIGINAL')
        warped=max(0,min(1,t+(.075*math.sin(a*3+seed)+.032*math.sin(a*7))*math.sin(math.pi*t)))
        if refined('shared','geology'):
            warped=max(0,min(1,warped+.055*coarse*math.sin(math.pi*t)))
        for (ta,ra),(tb,rb) in zip(strata,strata[1:]):
            if ta<=warped<=tb:
                profile=ra+(rb-ra)*(warped-ta)/(tb-ta);break
        fissure=sum(depth*math.exp(-(math.atan2(math.sin(a-angle),math.cos(a-angle))/width)**2) for angle,width,depth in faults)
        profile=profile*.62+((1-t)**.80*.98+.02)*.38
        radius=profile*edge*(1+coarse*.19+grit*.035-fissure*min(1,t*14))
        x=math.cos(a)*4.1*radius+.3*t;y=math.sin(a)*2.95*radius+.15*t
        rise=terrain_height(x*1.35,y*1.35,seed)/1.18
        z=-2.4*t+(.055*grit+.16*coarse)*min(1,t*18)+rise*(1-t)**3
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
            # Sediment reads as continuous horizontal beds (gently warped and
            # broken by the faults), not a patchwork of per-facet mineral pockets.
            v=verts[rings[k][i]]
            warp=noise.noise(Vector((v.x*.35,v.y*.35,seed)),noise_basis='PERLIN_ORIGINAL')*.06+.025*math.sin(v.x*1.7+v.y)
            bed=int(max(0,t+warp-.06)*11)
            mat=2 if k<2 else (1 if k<4 else [0,3,0,0,4,3,0,4,0,4,4][min(10,bed)])
            if refined('shared','geology') and k>=4:
                pocket=noise.noise(Vector((v.x*.82,v.y*.82,t*7+seed)),noise_basis='PERLIN_ORIGINAL')
                if mat==3 and pocket<.18:mat=0
                if pocket<-.42 and t>.22:mat=4
            materials.extend([mat,mat])
    # A tessellated soil cap with an exposed organic rim and a level inner plot.
    inner=[]
    for radius in [.0,.14,.28,.44,.58,.76,.90,1.0]:
        ring=[]
        for i in range(count):
            v=verts[rings[0][i]]*radius
            v.z=terrain_height(v.x*1.35,v.y*1.35,seed)/1.18
            if radius!=1:v.z+=.014+max(0,radius-.7)*noise.noise(Vector((v.x*8,v.y*8,seed)),noise_basis='PERLIN_ORIGINAL')*.075
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
        if refined('shared','planting') and math.sin(a*5+seed)+.55*math.cos(a*9)<-.25:continue
        v.z=terrain_height(v.x*1.35,v.y*1.35,seed)/1.18+.03
        if seed==107 and on_court('projects',v.x*1.35,v.y*1.35,.25):continue
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
    # Roots that have pushed through the soil hang free below the lip, a few
    # long ones and more short ones, clustered where the cliff is deepest.
    for i in range(8):
        a=rng.uniform(-math.pi*.95,-math.pi*.05) if i<6 else rng.uniform(0,math.tau)
        out=Vector((math.cos(a),math.sin(a),0))
        top=point(a,.035)+out*.01
        lip=point(a,.075)+out*.06
        length=rng.uniform(.14,.30) if i%4 else rng.uniform(.45,.70)
        sway=Vector((rng.uniform(-.05,.05),rng.uniform(-.05,.05),0))
        pts=[top,lip,lip+out*.05+sway*.3+Vector((0,0,-length*.35)),lip+out*.07+sway*.7+Vector((0,0,-length*.7)),lip+out*.08+sway+Vector((0,0,-length))]
        root=curve('Cliff · hanging root',pts,rng.uniform(.005,.011),'wood')
        if refined('shared','roots'):
            for j,p in enumerate(root.data.splines[0].bezier_points):
                t=j/(len(pts)-1);p.radius=1-.94*t
                p.co.x+=.035*math.sin(t*5+i)*t
                p.co.y+=.025*math.sin(t*7+i)*t
        if length>.5:
            fork=pts[2]
            tendril=curve('Cliff · hanging root tendril',[fork,fork+out*.04+Vector((rng.uniform(-.06,.06),0,-.12)),fork+out*.05+Vector((rng.uniform(-.08,.08),0,-length*.45))],.0035,'wood')
            if refined('shared','roots'):
                for j,p in enumerate(tendril.data.splines[0].bezier_points):p.radius=1-.9*j/2
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


# The workshop's half-court: a poured pad in the yard lobe right of the shed,
# (x0, x1, y0, y1) in island units. Nothing else is planted or stacked on it.
COURT=(3.35,5.85,-1.65,2.35) if refined('projects','court') else (3.35,5.45,-1.65,2.35)


def on_court(world,x,y,margin=.12):
    x0,x1,y0,y1=COURT
    return world=='projects' and x0-margin<x<x1+margin and y0-margin<y<y1+margin


def wax_apple_garden():
    """Taiwanese red wax apples on low fruiting branches along the left trellis."""
    rng=random.Random(73121)
    for key,color in [('wax_red',(.55,.018,.035)),('wax_rose',(.72,.038,.055)),('wax_crimson',(.36,.009,.023))]:
        P[key]=material('Wax apple · '+key,color,rough=.24)
        bs=P[key].node_tree.nodes['Principled BSDF']
        bs.inputs['Coat Weight'].default_value=.32
        bs.inputs['Coat Roughness'].default_value=.18
    P['wax_leaf']=material('Wax apple · glossy evergreen leaves',(.042,.13,.033),rough=.38)
    P['wax_leaf_young']=material('Wax apple · young leaves',(.12,.23,.048),rough=.45)
    P['wax_calyx']=material('Wax apple · recessed blossom end',(.13,.008,.014),rough=.6)
    # A narrow neck opens into broad, softly lobed shoulders at the blossom
    # end. The underside folds inward around the four persistent sepals.
    profile=[(0,.12),(-.04,.38),(-.12,.47),(-.25,.49),(-.43,.56),
             (-.62,.72),(-.79,.91),(-.91,.97),(-.98,.88),(-.96,.62),(-.88,.16)]
    def fruit(position,height,tilt,tone):
        vertices=[];faces=[];segments=32
        for z,radius in profile:
            for i in range(segments):
                a=math.tau*i/segments
                lobes=1+.055*math.cos(4*a)*min(1,abs(z)*1.5)
                rr=radius*height*.5*lobes
                vertices.append((rr*math.cos(a),rr*math.sin(a),height*z))
        for row in range(len(profile)-1):
            for i in range(segments):
                j=row*segments+i;k=row*segments+(i+1)%segments
                faces.append((j,j+segments,k+segments,k))
        faces.extend([tuple(range(segments)),tuple(reversed(range((len(profile)-1)*segments,len(profile)*segments)))])
        apple=mesh('Wax apple · bell-shaped fruit',vertices,faces,tone)
        apple.location=position;apple.rotation_euler=tilt
        for face in apple.data.polygons:face.use_smooth=True
        smooth=apple.modifiers.new('Rounded waxy skin','SUBSURF')
        smooth.levels=1;smooth.render_levels=1
        rotation=apple.rotation_euler.to_matrix()
        def at(p):return Vector(position)+rotation@Vector(p)
        rod('Wax apple · fruit stalk',at((0,0,-.004)),at((0,0,.045)),.0045,'leaf2',8)
        for i in range(4):
            a=i*math.tau/4
            sepal=[at((0,0,-height*.89)),
                   at((math.cos(a-.4)*height*.18,math.sin(a-.4)*height*.18,-height*.95)),
                   at((math.cos(a)*height*.31,math.sin(a)*height*.31,-height*.98)),
                   at((math.cos(a+.4)*height*.18,math.sin(a+.4)*height*.18,-height*.95))]
            mesh('Wax apple · four-lobed calyx',sepal,[(0,1,2,3)],'wax_calyx')
        return at((0,0,.045))
    for y in [.12,1.15]:
        curve('Wax apple · trained woody stem',[(-4.14,y,.20),(-4.10,y-.05,.72),(-4.09,y+.06,1.30),(-4.12,y,1.74)],.022,'wood')
    # Keep the bunches on the exposed side of the foliage, in staggered
    # groups rather than an evenly spaced row of identical red spheres.
    clusters=[(-.24,1.49),(.18,1.14),(.35,1.73),(.73,1.42),(1.12,1.69),(1.40,1.30),(.89,.95)]
    for index,(y,z) in enumerate(clusters):
        source=Vector((-4.10,.12 if y<.65 else 1.15,z-.15))
        tip=Vector((-3.91,y,z+.07))
        curve('Wax apple · fruiting branch',[source,(-4.02,(source.y+y)/2,z+.10),tip],.009,'wood')
        for j,(dx,dy,dz) in enumerate([(0,-.09,0),(.07,.07,-.045),(-.09,.035,.08)]):
            position=Vector((-3.87+dx,y+dy,z+dz))
            varied=refined('writing','garden')
            if varied:position+=Vector((-.12 if (index+j)%3==0 else .015,0,-.035*(j%2)))
            stalk=fruit(position,rng.uniform(.145,.24) if varied else rng.uniform(.195,.23),(rng.uniform(-.30,.30) if varied else rng.uniform(-.16,.16),rng.uniform(-.28,.28) if varied else rng.uniform(-.22,.22),rng.uniform(-.4,.4)),['wax_red','wax_rose','wax_crimson'][(index+j)%3])
            rod('Wax apple · branching fruit stalk',tip,stalk,.004,'leaf2',8)
    # Broad, pointed oval leaves complement the existing smaller climbing
    # leaves without hiding the hanging fruit.
    vertices=[];faces=[]
    for i in range(100):
        center=Vector((-4.10+rng.uniform(-.15,.02),rng.uniform(-.35,1.60),rng.uniform(.70,1.84)))
        a=rng.uniform(0,math.tau);length=rng.uniform(.09,.16)
        u=Vector((math.cos(a),math.sin(a),rng.uniform(-.5,.5)))*length
        v=Vector((-math.sin(a),math.cos(a),0))*length*.40
        n=len(vertices)
        vertices.extend([center-u,center-u*.45+v,center+u*.35+v*.9,center+u,
                         center+u*.35-v*.9,center-u*.45-v,center+Vector((0,0,.014))])
        for j in range(6):faces.append((n+6,n+j,n+(j+1)%6))
    leaves=mesh('Wax apple · oval leaves',vertices,faces,'wax_leaf')
    leaves.data.materials.append(P['wax_leaf_young'])
    for face in leaves.data.polygons:face.material_index=1 if face.index//6%7==0 else 0


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
        if on_court(world,x,y,.5) or (world=='writing' and x>3 and -.9<y<2.4):continue
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
        if refined('shared','planting') and math.sin(a*5+seed)+.55*math.cos(a*9)<-.15:continue
        x=5.25*r*math.cos(a);y=3.65*r*math.sin(a)
        if abs(x)<2 and y<-2.5:continue
        for j in range(45):
            xx=x+rng.gauss(0,.13);yy=y+rng.gauss(0,.10)
            if on_court(world,xx,yy) or (world=='writing' and 2.95<xx<4.55 and -1.9<yy<2.4):continue
            z=surface(xx,yy)
            if z is None:continue
            z+=.012;h=rng.uniform(.05,.16)*(.16 if world=='work' else 1)
            w=h*.035;lean=rng.uniform(-.4,.4)*h;n=len(verts)
            verts.extend([(xx-w,yy,z),(xx+w,yy,z),(xx+lean+w*.4,yy+.012,z+h*.65),(xx+lean,yy+.02,z+h)])
            faces.extend([(n,n+1,n+2),(n,n+2,n+3)])
    grass=mesh('Terrain · clustered meadow blades',verts,faces,'leaf2')
    grass.data.materials.append(P['leaf']);grass.data.materials.append(P['moss'])
    for face in grass.data.polygons:face.material_index=rng.choices([0,1,2],[4,3,1])[0]
    if world=='work':
        # The developed district and its planting are composed together below.
        # Scattering trees here would put them inside the later building plots.
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
        wax_apple_garden()
    else:
        terrain_path('Workshop · worn yard paving',[(1.50,-3.24),(1.05,-2.62),(.30,-1.96)],.92,seed,'paving',.35)
        for i in range(2):box('Workshop · stone threshold step',(.30,-2.15+i*.22,.045+i*.045),(1.35,.30,.09),'stone',.015)
        # The crate, offcuts and cable reel that stood here made way for the
        # half-court (see half_court()); the timber stack and loose offcuts by
        # the deck went so the lot could narrow.


def tree(x,y,scale=1,base=0):
    rng=random.Random(int((x+10)*109+(y+10)*170))
    trunk=.012*scale
    rod('Tree · fine bark trunk',(x,y,base+.008),(x,y,base+.52*scale),trunk,'wood')
    for i in range(7):
        a=rng.uniform(0,math.tau)
        p=(x+math.cos(a)*.12*scale,y+math.sin(a)*.12*scale,base+(.42+i*.046)*scale)
        rod('Tree · branch',(x,y,base+.32*scale),p,.006*scale,'wood')
        foliage('Tree · fine canopy',p,(.16*scale,.15*scale,.16*scale),rng,100)


def reading_maple(x,y):
    """A spreading green Japanese maple shelters the reading chair.

    Tapered branching, airy tiers of lobed leaves, and two shielded uplights
    rooted in the same terrain as the tree. All practicals use the Tree
    uplight prefix so both their emission and their wash follow the switch.
    """
    rng=random.Random(7319)
    base=terrain_height(x,y,73)
    P['maple_bark']=textured('Reading maple · grey brown bark',(.075,.060,.045),(.19,.16,.12),'wood',rough=.9,grain=(14,14,1.5))
    for key,color in [('maple_leaf',(.075,.16,.035)),('maple_leaf2',(.15,.25,.055)),('maple_leaf3',(.24,.31,.07))]:
        P[key]=material('Reading maple · '+key,color,rough=.72)
        P[key].node_tree.nodes['Principled BSDF'].inputs['Subsurface Weight'].default_value=.08
    def at(dx,dy,z):return (x+dx,y+dy,base+z)
    def branch(name,points,radius):
        obj=curve('Reading maple · '+name,[at(*p) for p in points],radius,'maple_bark')
        for i,p in enumerate(obj.data.splines[0].bezier_points):
            p.radius=1-.84*i/(len(points)-1)
        return obj
    branch('trunk',[(0,0,-.06),(-.06,.02,.8),(.04,.02,1.65),(-.14,.04,2.55),(-.08,.08,3.55)],.15)
    for i in range(6):
        a=i*math.tau/6
        branch('root flare',[(math.cos(a)*.40,math.sin(a)*.40,.015),(math.cos(a)*.16,math.sin(a)*.16,.10),(0,0,.40)],.055)
    # The high open crown leaves the chair visible beneath it and clears
    # the study wall; its lobes overlap as an irregular, broad umbrella.
    crowns=[(-1.04,-.36,3.85),(-.82,.65,4.08),(.16,.85,4.42),
            (1.02,.44,4.04),(1.06,-.40,3.87),(.28,-.80,4.12),
            (-.40,-.18,4.65),(.45,.15,4.76)]
    for i,(dx,dy,z) in enumerate(crowns):
        start=(-.04,.03,1.65+i*.14)
        middle=(dx*.48,dy*.48,z-.70)
        branch('spreading bough',[start,middle,(dx,dy,z-.12)],.068 if i<6 else .052)
        for j in range(3):
            a=rng.uniform(0,math.tau)
            end=(dx+math.cos(a)*.48,dy+math.sin(a)*.42,z+rng.uniform(-.12,.26))
            branch('fine twig',[middle,(dx,dy,z-.12),end],.018)
        verts=[];faces=[]
        leaf_count=470 if refined('writing','garden') else 650
        for j in range(leaf_count):
            a=rng.uniform(0,math.tau);r=math.sqrt(rng.random())
            center=Vector(at(dx+math.cos(a)*r*.79,dy+math.sin(a)*r*.64,z+rng.uniform(-.22,.24)))
            length=rng.uniform(.05,.085) if refined('writing','garden') else rng.uniform(.055,.10);tilt=rng.uniform(-.65,.65)
            u=Vector((math.cos(a),math.sin(a),tilt))*length
            v=Vector((-math.sin(a),math.cos(a),rng.uniform(-.3,.3)))*length
            n=len(verts);verts.append(center)
            # Seven pointed lobes with deep sinuses, curled around the vein.
            for k in range(14):
                t=math.tau*k/14;reach=1 if k%2==0 else .40
                verts.append(center+(u*math.cos(t)+v*math.sin(t))*reach+Vector((0,0,.012*reach)))
            for k in range(14):faces.append((n,n+1+k,n+1+(k+1)%14))
        leaves=mesh('Reading maple · lobed canopy',verts,faces,'maple_leaf')
        leaves.data.materials.append(P['maple_leaf2']);leaves.data.materials.append(P['maple_leaf3'])
        tones=rng.choices([0,1,2],[6,4,.5] if refined('writing','garden') else [5,4,1],k=leaf_count)
        for p in leaves.data.polygons:p.material_index=tones[p.index//14]
    P['tree_uplight']=material('Tree uplight · warm lens',(1,.76,.45),emission=6)
    for dx,dy in [(-.43,-.36),(.45,.14)]:
        px,py=x+dx,y+dy;pz=terrain_height(px,py,73)+.09
        target=Vector(at(-.04,.04,2.65));position=Vector((px,py,pz))
        axis=(target-position).normalized()
        fixture=cylinder('Tree uplight · shielded bronze housing',tuple(position),.075,.16,'brass',24,bevel=.008)
        fixture.rotation_euler=axis.to_track_quat('Z','Y').to_euler()
        lens=cylinder('Tree uplight · warm lens',tuple(position+axis*.081),.057,.006,'tree_uplight',24,bevel=0)
        lens.rotation_euler=fixture.rotation_euler
        spot('Tree uplight · trunk and canopy wash',tuple(position+axis*.09),tuple(target),WARM,480,88,.65,.055)

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


def faux_snake_plant(x,y,z,scale=1):
    """A faux snake plant (sansevieria) in a white matte ceramic pot: stiff,
    upright sword leaves, dark green banded with a yellow edge. It's fake, so
    unlike the living plant it never stirs in the breeze."""
    rng=random.Random(int((x+12)*173+(y+7)*131))
    P.setdefault('ceramic',material('Faux plant · white matte ceramic pot',(.72,.71,.68),rough=.7))
    P.setdefault('faux_leaf',textured('Faux snake plant · banded green blade',(.03,.075,.035),(.09,.17,.07),'fabric',rough=.55))
    P.setdefault('faux_edge',material('Faux snake plant · yellow leaf edge',(.55,.50,.12),rough=.55))
    k=scale
    cylinder('Faux plant · white ceramic pot',(x,y,z+.075*k),.085*k,.15*k,'ceramic',48,top=.095*k,bevel=.008*k)
    cylinder('Faux plant · faux moss top',(x,y,z+.142*k),.088*k,.008,'soil',40,bevel=0)
    for i in range(9):
        a=i*2.399+rng.uniform(-.2,.2);r=rng.uniform(.0,.045)*k
        base=Vector((x+math.cos(a)*r,y+math.sin(a)*r,z+.14*k))
        h=rng.uniform(.30,.48)*k;w=rng.uniform(.030,.042)*k
        lean=Vector((math.cos(a),math.sin(a),0))*rng.uniform(.02,.07)*k
        face=Vector((-math.sin(a+.9),math.cos(a+.9),0))
        verts=[];faces=[]
        for j in range(7):
            t=j/6;c=base+lean*t+Vector((0,0,h*t));half=w*(1-t**1.6)*(1 if j<6 else 0)
            verts.extend([c-face*half,c,c+face*half])
        for j in range(6):
            n=j*3;faces.extend([(n,n+3,n+4,n+1),(n+1,n+4,n+5,n+2)])
        blade=mesh('Faux snake plant · stiff blade',verts,faces,'faux_leaf')
        sol=blade.modifiers.new('Blade thickness','SOLIDIFY');sol.thickness=.004*k
        for poly in blade.data.polygons:poly.use_smooth=True
        for side in (0,2):curve('Faux snake plant · yellow edge',[verts[j*3+side] for j in range(7)],.0016*k,'faux_edge')


def window_grid(x,y,width,depth,height,seed,base=.10,spacing=.075):
    rng=random.Random(seed); verts=[]; faces=[]; mats=[]
    cols=max(3,int(width/spacing)); rows=max(3,int(height/.038))
    # At night offices light by floor and by tenant, not window by window:
    # floors run lit or dark together, and each building keeps one tone.
    tone=0 if rng.random()<.68 else 1
    floors=[];previous=False
    for row in range(rows):
        previous=rng.random()<(.74 if previous else .30);floors.append(previous)
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
                if row not in suites:
                    start=rng.uniform(-.1,.45);suites[row]=(start,start+rng.uniform(.45,1.1))
                a,b=suites[row];fraction=(col+.5)/cols
                lit=floors[row] and a<=fraction<=b and rng.random()<.9
                n=len(verts); verts.extend(quad); faces.append(tuple(range(n,n+4)))
                mats.append((2 if rng.random()<.12 else tone) if lit else 3)
                if lit and side=='front' and rng.random()<.02: WINDOWS.append(p)
    obj=mesh('Facade · individual office glazing',verts,faces,'window')
    for m in ['window2','window3','glass']: obj.data.materials.append(P[m])
    for poly,mat in zip(obj.data.polygons,mats): poly.material_index=mat


def chamfered_square(width,cut=.10):
    h=width/2;c=width*cut
    return [(-h+c,-h),(h-c,-h),(h,-h+c),(h,h-c),(h-c,h),(-h+c,h),(-h,h-c),(-h,-h+c)]


def stepped_square(width,step=.06):
    """Taipei 101's plan: a square whose corners step in twice ("double
    stairstep" re-entrant corners). Side 0 is the south face; the four faces
    are sides 0, 5, 10 and 15, each corner four short steps."""
    h=width/2;s=width*step
    return [(-h+2*s,-h),(h-2*s,-h),(h-2*s,-h+s),(h-s,-h+s),(h-s,-h+2*s),(h,-h+2*s),
            (h,h-2*s),(h-s,h-2*s),(h-s,h-s),(h-2*s,h-s),(h-2*s,h),
            (-h+2*s,h),(-h+2*s,h-s),(-h+s,h-s),(-h+s,h-2*s),(-h,h-2*s),
            (-h,-h+2*s),(-h+s,-h+2*s),(-h+s,-h+s),(-h+2*s,-h+s)]


def curtain_tower(name,x,y,z,width,topwidth,height,floors,seed=1,mat='glass',columns=24,force=(),plan=chamfered_square,even=False):
    """Glazing follows the actual sloping planes; fine mullions retain scale.
    An even tower (Taipei 101) is one uniform curtain wall: every pane the
    same glass by day and the same soft glow by night, not a patchwork of
    tenants' lit floors."""
    rng=random.Random(seed);lower=plan(width);upper=plan(topwidth);sides=len(lower)
    longest=max((Vector(lower[(i+1)%sides])-Vector(lower[i])).length for i in range(sides))
    tone=1 if rng.random()<.7 else 2
    occupancy=[];previous=False
    for row in range(floors):
        previous=rng.random()<(.72 if previous else .32);occupancy.append(previous)
    verts=[(x+a,y+b,z) for a,b in lower]+[(x+a,y+b,z+height) for a,b in upper]
    mesh(name+' · core',verts,[tuple(reversed(range(sides))),tuple(range(sides,2*sides))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)],mat)
    vs=[];fs=[];ms=[]
    for side in range(sides):
        a,b=Vector((*lower[side],0)),Vector((*lower[(side+1)%sides],0))
        c,d=Vector((*upper[side],height)),Vector((*upper[(side+1)%sides],height))
        normal=Vector(((b-a).y,-(b-a).x,0)).normalized()*.0007
        if plan is chamfered_square: cols=columns if side%2==0 else max(2,columns//5)
        else: cols=max(1,round(columns*(b-a).length/longest))
        def pt(u,v): return Vector((x,y,z))+(a*(1-u)+b*u)*(1-v)+(c*(1-u)+d*u)*v+normal
        for row in range(floors):
            # A lit floor is one tenant's run of bays, the same on every face.
            start=rng.uniform(-.15,.4);end=start+rng.uniform(.5,1.2)
            for col in range(cols):
                u0=(col+.065)/cols;u1=(col+.935)/cols
                v0=(row+.12)/floors;v1=(row+.87)/floors
                n=len(vs);vs.extend([pt(u0,v0),pt(u1,v0),pt(u1,v1),pt(u0,v1)]);fs.append((n,n+1,n+2,n+3))
                lit=occupancy[row] and start<=(col+.5)/cols<=end and rng.random()<.92
                if (side,row,col) in force:lit=True
                # The Work entry's window is just another pane of the even wall.
                if even: ms.append(6)
                else: ms.append(((3 if rng.random()<.1 else tone) if (side,row,col) not in force else 1) if lit else rng.choice([0,0,0,4,5]))
                if ms[-1]==1 and side==0 and rng.random()<.01: WINDOWS.append(tuple(pt((u0+u1)/2,(v0+v1)/2)))
        for col in range(cols+1):
            rod(name+' · narrow aluminium mullion',pt(col/cols,0),pt(col/cols,1),.0008,'steel',4)
        for row in range(floors+1): rod(name+' · transom',pt(0,row/floors),pt(1,row/floors),.0008,'teal',4)
    obj=mesh(name+' · individually glazed panes',vs,fs,mat)
    for m in ['window','window2','window3','pane2','pane3']:obj.data.materials.append(P[m])
    if even: obj.data.materials.append(P['101glass'])
    for poly,m in zip(obj.data.polygons,ms):poly.material_index=m


def taipei101(x,y):
    # 1 unit = 100m. Eight equal 8-floor modules above a separate tapering base.
    # Dimensions below are reference-based approximations, not construction data.
    # The pedestal: 25 floors tapering inward like a truncated pyramid.
    STEP=.06
    curtain_tower('101 lower shaft',x,y,.07,.68,.43,1.12,26,81,columns=28,plan=lambda w:stepped_square(w,STEP),even=True)
    for i in range(8):
        z=1.19+i*.337
        # Eight 8-floor modules, each flaring outward ~7 degrees like a
        # pagoda tier. Module 7 holds the window the Work entry flies into.
        curtain_tower(f'101 module {i+1}',x,y,z,.432,.516,.323,8,101+i,columns=24,force={(0,4,14),(0,4,15)} if i==6 else (),plan=lambda w:stepped_square(w,STEP),even=True)
        poly=stepped_square(.522,STEP);glow=stepped_square(.528,STEP)
        for side in range(len(poly)):
            aa,bb=poly[side],poly[(side+1)%len(poly)]
            rod('101 · restrained projecting cornice',(x+aa[0],y+aa[1],z+.326),(x+bb[0],y+bb[1],z+.326),.005,'jade',6)
            # Each tier's eave is uplit gold at night, so the pagoda reads.
            ga,gb=glow[side],glow[(side+1)%len(glow)]
            rod('101 · gold tier light',(x+ga[0],y+ga[1],z+.320),(x+gb[0],y+gb[1],z+.320),.0022,'tierglow',4)
        for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]:
            # A ruyi bracket at each tier's corners, on the outer step: at
            # least 8m tall, curling out as a small canopy over the floors
            # below, its cloud-scroll head tucked under the eave.
            r=.516/2-.516*STEP
            at=lambda k,h:(x+sx*r*k,y+sy*r*k,z+h)
            curve('101 · corner ruyi',[at(.90,.245),at(1.0,.27),at(1.07,.305),at(1.06,.33),at(1.0,.326)],.005,'jade')
            curve('101 · corner ruyi scroll',[at(1.06,.33),at(1.10,.318),at(1.085,.302),at(1.06,.309)],.0035,'jade')
    curtain_tower('101 observation crown',x,y,3.894,.34,.37,.35,8,179,columns=16,plan=lambda w:stepped_square(w,STEP),even=True)
    curtain_tower('101 upper crown',x,y,4.249,.19,.205,.205,5,189,columns=9,plan=lambda w:stepped_square(w,STEP),even=True)
    cylinder('101 · antenna pedestal',(x,y,4.48),.080,.055,'jade',8,top=.061,bevel=.002)
    for zz,rr in [(4.52,.052),(4.58,.046),(4.65,.035),(4.73,.025)]:
        cylinder('101 · spire lattice',(x,y,zz),rr,.09,'steel',8,top=rr*.75,bevel=0)
    rod('101 · final antenna',(x,y,4.73),(x,y,5.15),.006,'steel')
    for zz in [4.57,4.63,4.72]:cylinder('101 · service ring',(x,y,zz),.052,.009,'jade',16,bevel=0)
    sphere('101 · obstruction light',(x,y,5.15),(.005,.005,.008),'light',2)
    # Where the pedestal meets the tower (floor 26), an ancient coin on each
    # face: a round disc with a square hole.
    for ax,ay in [(0,-1),(1,0),(0,1),(-1,0)]:
        # Centred on the junction; clear of both the pedestal and module 1.
        face=.228
        rot=(math.pi/2,0,math.atan2(ax,-ay))
        torus('101 · ancient coin rim',(x+ax*face,y+ay*face,1.16),.074,.009,'tierglow',rot)
        disc=cylinder('101 · ancient coin',(x+ax*(face-.004),y+ay*(face-.004),1.16),.072,.006,'jade',40,bevel=0)
        disc.rotation_euler=rot
        hole=box('101 · coin square hole',(x+ax*(face+.0005),y+ay*(face+.0005),1.16),(.034,.034,.034),'glass',0)
        hole.rotation_euler=rot
    ANCHORS['landmark']=(x,y,3.34);ANCHORS['tower']=(x,y,4.43)
    # The Work arrival travels through a real patch of the south-facing glazing.
    # Keep its corners and the eight cornices tied to the render camera.
    bottom=3.212+.323*4.12/8;top=3.212+.323*4.87/8
    def facade(z):return y-(.432+.084*((z-3.212)/.323))/2-.002
    def bay(z,u):return x+(.432+.084*((z-3.212)/.323))*(1-4*STEP)*(u/24-.5)
    ANCHORS['entryWindow']=[(bay(top,14.04),facade(top),top),(bay(top,15.96),facade(top),top),(bay(bottom,14.04),facade(bottom),bottom),(bay(bottom,15.96),facade(bottom),bottom)]
    ANCHORS['towerSteps']=[(x,y-(.516/2),1.19+i*.337+.323) for i in range(8)]


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


def street(a,b,width,base=0):
    delta=Vector(b)-Vector(a);angle=math.atan2(delta.y,delta.x);center=(Vector(a)+Vector(b))/2
    box('Street · curb and sidewalk',(center.x,center.y,base+.031),(delta.length,width+.10,.018),'concrete',.001,angle)
    box('Street · asphalt',(center.x,center.y,base+.042),(delta.length,width,.008),'ink',0,angle)
    direction=delta.normalized();normal=Vector((-direction.y,direction.x))
    for t in range(int(delta.length/.085)):
        p=Vector(a)+direction*(t*.085+.025)
        box('Street · lane marking',(p.x,p.y,base+.047),(.035,.004,.001),'paper',0,angle)
    # Lamps at a regular spacing on both kerbs light the length of each street.
    for t in range(1,int(delta.length/.30)):
        for side in [-1,1]:
            p=Vector(a)+direction*(t*.30)+normal*side*(width/2+.035)
            rod('Street · lamp column',(p.x,p.y,base+.04),(p.x,p.y,base+.105),.0012,'steel',6)
            box('Street · lamp head',(p.x,p.y,base+.107),(.012,.012,.004),'streetlight',0)
    for end in [.17,delta.length-.17]:
        p=Vector(a)+direction*end
        for i in range(8):
            q=p+normal*((i-3.5)*width/9)
            box('Street · zebra crossing',(q.x,q.y,base+.048),(.068,width/18,.001),'paper',0,angle)


def city_frontage(name,x,y,w,d,h,seed,base=.055):
    """Human-scale apartment and shop fabric around the landmark district."""
    rng=random.Random(seed)
    family=seed%4
    if refined('work','building_families'):
        # Narrow/tall residential, broad/low shops, terraced mixed-use and
        # medium apartment blocks. All remain inside their original plots.
        w*=[.80,1,.92,.96][family];d*=[.90,.96,1,.86][family]
        h*=[1.20,.72,1.06,.90][family]
    if refined('work','tower_plaza') and -.1<x<1.30 and -2.15<y<-1.20:
        h=min(h,.19 if y>-1.6 else .25)
    wall=rng.choice(['city-tile','city-plaster','city-grey','brick'])
    if refined('work','building_families'):
        wall=['city-plaster','brick','city-tile','city-grey'][family]
    box(name+' · tiled apartment body',(x,y+.018,base+.036+(h-.072)/2),(w,d-.036,h-.072),wall,.002)
    # Taipei's covered arcades glow at night; most shopfronts are still open.
    box(name+' · recessed shopfront',(x,y+.026,base+.028),(w*.92,d-.07,.056),'shoplight' if rng.random()<.78 else 'glass2',.001)
    # A continuous covered pavement at the ground floor, with slender piers.
    for xx in [x-w*.46,x+w*.46]:
        box(name+' · arcade pier',(xx,y-d/2+.006,base+.040),(.013,.014,.080),wall,.001)
    box(name+' · arcade canopy',(x,y-d/2-.016,base+.084),(w+.008,.10,.012),'concrete',.001)
    box(name+' · shop fascia',(x,y-d/2-.065,base+.068),(w*.78,.005,.021),rng.choice(['jade','city-rust','teal']),.001)
    # A blade sign stands out from the facade above the arcade.
    if rng.random()<.6 and h>.2:
        hs=rng.uniform(.06,min(.16,h-.14));sx=x+rng.choice([-1,1])*w*.40
        box(name+' · vertical shop sign',(sx,y-d/2-.024,base+.10+hs/2),(.005,.038,hs),'sign-'+rng.choice(['red','blue','yellow','green','white','orange','red']),.001)
    rows=max(2,round((h-.09)/.037));cols=max(2,round(w/.055))
    vs=[];fs=[];mats=[]
    for row in range(rows):
        z=base+.11+row*(h-.12)/rows
        occupied=rng.random()<.42
        for col in range(cols):
            xx=x-w/2+(col+.5)*w/cols;ww=w/cols*.34;hh=.010
            n=len(vs);vs.extend([(xx-ww,y-d/2-.001,z-hh),(xx+ww,y-d/2-.001,z-hh),(xx+ww,y-d/2-.001,z+hh),(xx-ww,y-d/2-.001,z+hh)])
            fs.append((n,n+1,n+2,n+3));mats.append(1 if occupied and rng.random()<.7 else 0)
        if row%2==0 and seed%4!=0:
            box(name+' · balcony slab',(x,y-d/2-.014,z-.015),(w*.91,.044,.005),'concrete',.001)
            rod(name+' · balcony rail',(x-w*.43,y-d/2-.035,z+.003),(x+w*.43,y-d/2-.035,z+.003),.0017,'steel',6)
            box(name+' · external AC',(x+w*.32,y-d/2-.018,z+.008),(.022,.018,.012),'city-grey',.001)
        if seed%4==1:
            for xx in [x-w*.32,x+w*.32]:
                box(name+' · balcony dividing fin',(xx,y-d/2-.011,z),(.009,.05,.036),wall,.001)
    glazing=mesh(name+' · recessed windows',vs,fs,'glass2');glazing.data.materials.append(P['homelight'])
    for face,mat in zip(glazing.data.polygons,mats):face.material_index=mat
    # The side elevation has its own rhythm; roofs vary instead of repeating
    # the same three oversized mechanical boxes on every building.
    for z in [base+.15+i*.072 for i in range(max(1,round((h-.12)/.072)))]:
        box(name+' · side window',(x-w/2-.001,y,z),(.002,d*.46,.020),'glass',0)
    box(name+' · rooftop',(x,y,base+h),(w+.015,d+.014,.012),'city-roof',.001)
    for yy in [y-d/2,y+d/2]:box(name+' · parapet',(x,yy,base+h+.012),(w,.008,.025),wall,.001)
    for xx in [x-w/2,x+w/2]:box(name+' · parapet',(xx,y,base+h+.012),(.008,d,.025),wall,.001)
    if seed%3:
        ew=w*rng.uniform(.38,.64);ed=d*rng.uniform(.36,.60);eh=rng.uniform(.033,.064)
        box(name+' · roof extension',(x-w*.10,y+d*.16,base+h+eh/2),(ew,ed,eh),'city-grey',.001)
        roof=box(name+' · weathered sheet roof',(x-w*.10,y+d*.16,base+h+eh+.006),(ew+.015,ed+.014,.006),'city-rust' if seed%2 else 'teal',.001)
        roof.rotation_euler.x=.09 if seed%2 else -.07
    else:
        for offset in [-.16,.16]:
            box(name+' · roof ventilation',(x+offset*w,y,base+h+.020),(.040,.055,.030),'steel',.002)
    cylinder(name+' · rooftop water tank',(x+w*.28,y-d*.20,base+h+.032),.012,.048,'steel',16,bevel=.001)
    box(name+' · tank support',(x+w*.28,y-d*.20,base+h+.009),(.033,.033,.012),'concrete',.001)
    if refined('work','street_connections'):
        box(name+' · entrance pavement',(x,y-d/2-.058,base-.012),(w+.018,.105,.018),'paving',.001)
        if family%2==0:
            box(name+' · pavement planter',(x+w*.38,y-d/2-.083,base+.001),(.035,.020,.009),'moss',.001)


def urban_extension():
    """Fill the larger ground with connected city blocks and a planted edge."""
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    ground=bpy.data.objects['Island · eroded basalt escarpment']
    terrain=BVHTree.FromObject(ground,bpy.context.evaluated_depsgraph_get())
    inverse=ground.matrix_world.inverted();rng=random.Random(886)
    def surface(x,y):
        hit,_,_,_=terrain.ray_cast(inverse@Vector((x,y,10)),Vector((0,0,-1)))
        if hit is None:return None
        z=(ground.matrix_world@hit).z
        return z if z>-.025 else None
    def plot(name,x,y,w,d,h,seed):
        corners=[surface(x+dx*w/2,y+dy*d/2) for dx,dy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
        if any(z is None for z in corners):return
        low,high=min(corners),max(corners)
        if high-low>.18:return
        base=high+.028
        box(name+' · terraced plot',(x,y,(low+base)/2),(w+.035,d+.035,base-low),'paving',.001)
        city_frontage(name,x,y,w,d,h,seed,base)
    # Perimeter streets connect to the original Xinyi spine. The western and
    # eastern shoulders become small urban terraces, not an empty lawn.
    street((-4.03,-.95),(-3.30,-.95),.15,.08)
    street((3.22,-.95),(4.12,-.95),.15,.07)
    street((-3.55,-1.93),(-3.55,1.75),.12,.06)
    street((3.48,-1.90),(3.48,1.80),.12,.06)
    street((-3.55,1.72),(-2.80,1.72),.10,.05)
    street((2.63,1.71),(3.49,1.71),.10,.05)
    street((-2.53,2.42),(2.44,2.42),.13,.035)
    street((-1.05,2.13),(-1.05,2.45),.13,.025)
    street((1.55,2.13),(1.55,2.45),.13,.025)
    i=0
    # Unequal widths and shared walls create blocks, rather than freestanding
    # identical miniatures in evenly spaced rows.
    for side in [-1,1]:
        for column in range(2):
            x=side*(3.83+column*.38)
            y=-1.73+column*.30
            while y<1.51-column*.22:
                d=rng.uniform(.26,.41);w=rng.uniform(.25,.33)
                plot('Neighborhood · side frontage',x,y+d/2,w,d,rng.uniform(.25,.67),900+i)
                y+=d+.027;i+=1
    for y,start,end in [(2.77,-2.54,2.40)]:
        x=start
        while x<end-.22:
            w=rng.uniform(.24,.41)
            if abs(x+w/2+.55)>.35+w/2:
                plot('Neighborhood · north frontage',x+w/2,y,w,.34,rng.uniform(.31,.74),1000+i)
            x+=w+.028;i+=1
    # Three supporting silhouettes frame 101 with a broader skyline.
    for x,y,w,d,h,seed in [(-3.00,1.88,.44,.43,1.28,810),(-.55,2.82,.41,.40,1.69,811),(3.00,1.96,.38,.45,1.10,812)]:
        z=surface(x,y) or .02
        rectilinear_block('District · setback office podium',x,y,w+.09,d+.09,.24,seed,0,base=z+.035)
        curtain_tower('District · slender office shaft',x,y,z+.27,w,w*.88,h-.28,round(h/.045),seed,mat='glass3' if seed%2 else 'glass2',columns=12)
        box('District · recessed crown',(x,y,z+h+.035),(w*.57,d*.57,.07),'teal',.001)
    # A planted perimeter promenade leaves breathing room between city and
    # cliff. Trees follow the actual cap so none float beyond its notches.
    for a,b in [((-3.10,-2.53),(-1.48,-2.71)),((-1.48,-2.71),(1.22,-2.72)),((1.22,-2.72),(2.68,-2.48))]:
        terrain_path('City edge · stone promenade',[a,b],.095,31,'paving',.07)
    for i in range(150):
        a=rng.uniform(0,math.tau);r=rng.uniform(.82,.91)
        x=5.25*r*math.cos(a);y=3.67*r*math.sin(a)
        z=surface(x,y)
        if z is None or (abs(x)>3.45 and abs(y)<1.80):continue
        # Natural clumps, with clear openings onto the approach paths.
        if abs(x)<.45 and y<-2.3:continue
        tree(x,y,rng.uniform(.25,.42),z)
    for x,y in [(-2.4,-2.59),(-1.5,-2.65),(.3,-2.76),(1.75,-2.55),(2.60,-2.44)]:
        z=surface(x,y)
        if z is None:continue
        box('Promenade · timber bench',(x,y,z+.023),(.050,.017,.009),'wood',.001)
        rod('Promenade · low lamp',(x+.07,y,z),(x+.07,y,z+.068),.002,'teal',8)
        sphere('Promenade · warm light',(x+.07,y,z+.069),(.006,.006,.004),'light',1)


def elephant_mountain(cx,cy,rx,ry,height):
    """Xiangshan, the forested ridge south-east of Taipei 101, with a trail."""
    rng=random.Random(4410);verts=[];faces=[];rings=14;seg=48
    def h(u,a=0):
        silhouette=1+.20*math.cos(a-.6)*(1-u)+.09*math.sin(a*3)*u if refined('work','hill') else 1
        return height*(1-u**2)**1.4*silhouette
    for k in range(rings+1):
        u=k/rings
        for i in range(seg):
            a=i*math.tau/seg;wob=1+.10*math.sin(a*3+1.3)+.05*math.sin(a*7)
            ridge=.18*math.cos(a-.6)*(1-u)
            verts.append((cx+math.cos(a)*rx*u*wob,cy+math.sin(a)*ry*u*wob,max(.02,h(u,a)*(1+ridge)+.03*noise.noise(Vector((a*2,u*3,7))))))
    verts.append((cx,cy,h(0)*1.12))
    for k in range(rings):
        for i in range(seg):
            j=(i+1)%seg;faces.append((k*seg+i,k*seg+j,(k+1)*seg+j,(k+1)*seg+i))
    hill=mesh('Xiangshan · forested ridge',verts,faces,'moss')
    for f in hill.data.polygons:f.use_smooth=True
    # Dense subtropical canopy, thinning toward the bare summit rocks.
    for i in range(70):
        u=math.sqrt(rng.random())*.95;a=rng.uniform(0,math.tau)
        x=cx+math.cos(a)*rx*u;y=cy+math.sin(a)*ry*u
        if not refined('work','hill') or (u>.20 and math.sin(a*3)+u>-.2):
            tree(x,y,rng.uniform(.16,.26),h(u,a)-.01)
    for i in range(5):
        a=rng.uniform(0,math.tau);u=rng.uniform(.05,.25)
        sphere('Xiangshan · summit boulder',(cx+math.cos(a)*rx*u,cy+math.sin(a)*ry*u,h(u,a)+.01),(.05,.04,.03),'rock2',1)
    # The lit stair trail hikers climb for the view of 101.
    pts=[];P.setdefault('trail',material('Xiangshan · lamplit stair trail',(1,.72,.40),emission=2.2))
    for k in range(22):
        u=1-k/22*.92;a=-2.2+k*.11
        pts.append((cx+math.cos(a)*rx*u,cy+math.sin(a)*ry*u,h(u,a)+.012))
    for a,b in zip(pts,pts[1:]):rod('Xiangshan · trail lamps',a,b,.0035,'trail',6)
    if refined('work','hill'):
        terrain_path('Xiangshan · connected approach',[(2.68,-2.48),(3.0,-2.82),(pts[0][0],pts[0][1])],.075,31,'paving',.065)


def night_extras(tx,ty):
    """Night-only fun: a lantern-strung night market.
    Named 'Night · ' so the daytime render removes them."""
    rng=random.Random(1231)
    P['lantern']=material('Night · red lantern',(1,.16,.08),emission=5)
    # A lantern string zig-zags over a night-market street south of 101.
    for y in [-1.30,-1.55,-1.80,-2.05]:
        pts=[(1.55+.11*(-1 if i%2 else 1)*(1-abs(i-4)/4),y+.06*math.sin(i),.13-.025*math.sin(math.pi*i/8)) for i in range(9)]
        pts=[(1.44+i*.0275,y,.135-.03*math.sin(math.pi*i/8)) for i in range(9)]
        curve('Night · lantern string',pts,.0012,'ink')
        for p in pts[1::2]:sphere('Night · red lantern',(p[0],p[1],p[2]-.008),(.007,.007,.009),'lantern',1)
    for y in [-1.42,-1.67,-1.92]:
        for side in [-1,1]:
            box('Night · market stall awning',(1.55+side*.085,y,.072),(.05,.07,.006),'redcloth',.001)


def temple(x,y,z):
    """A Taiwanese folk temple: stone platform, vermilion hall and columns,
    an orange glazed roof with swallowtail ridge ends, red lanterns."""
    box('Temple · stone platform',(x,y,z+.012),(.38,.32,.024),'stone',.002)
    box('Temple · forecourt',(x,y-.12,z+.026),(.30,.10,.004),'paving',0)
    box('Temple · hall',(x,y+.04,z+.024+.045),(.26,.17,.09),'temple-red',.002)
    for k in range(4):
        cylinder('Temple · red column',(x-.105+k*.07,y-.055,z+.024+.045),.007,.09,'temple-red',12,bevel=0)
    box('Temple · gilded plaque',(x,y-.047,z+.10),(.06,.003,.018),'temple-gold',.001)
    rz=z+.024+.09
    verts=[(x-.17,y-.13,rz),(x+.17,y-.13,rz),(x+.17,y+.14,rz),(x-.17,y+.14,rz),(x-.12,y+.005,rz+.06),(x+.12,y+.005,rz+.06)]
    mesh('Temple · glazed hip roof',verts,[(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)],'temple-roof')
    curve('Temple · swallowtail ridge',[(x-.19,y+.005,rz+.095),(x-.15,y+.005,rz+.066),(x,y+.005,rz+.064),(x+.15,y+.005,rz+.066),(x+.19,y+.005,rz+.095)],.006,'temple-roof')
    for sx in [-1,1]:
        curve('Temple · upturned eave',[(x+sx*.17,y-.13,rz),(x+sx*.19,y-.15,rz+.012),(x+sx*.205,y-.16,rz+.03)],.004,'temple-roof')
        sphere('Temple · ridge pearl',(x,y+.005,rz+.072),(.008,.008,.008),'temple-gold',1)
        sphere('Night · temple lantern',(x+sx*.06,y-.08,z+.10),(.009,.009,.012),'temple-lantern',1)


def densify_city():
    """Build out every empty patch of the district: mid-rise frontage, a few
    residential towers and pocket parks, never on top of what's there."""
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    ground=bpy.data.objects['Island · eroded basalt escarpment']
    terrain=BVHTree.FromObject(ground,bpy.context.evaluated_depsgraph_get())
    inverse=ground.matrix_world.inverted();rng=random.Random(2026)
    elephant_mountain(4.05,-2.55,1.15,.82,.62)
    bpy.context.view_layer.update()
    depsgraph=bpy.context.evaluated_depsgraph_get();scene=bpy.context.scene
    placed_temple=False
    def surface(x,y):
        hit=terrain.ray_cast(inverse@Vector((x,y,10)),Vector((0,0,-1)))[0]
        if hit is None:return None
        z=(ground.matrix_world@hit).z
        return z if z>-.025 else None
    def free(x,y,w,d):
        for dx,dy in [(0,0),(-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5),(0,-.5),(0,.5),(-.5,0),(.5,0)]:
            ok,loc,_,_,obj,_=scene.ray_cast(depsgraph,Vector((x+dx*w,y+dy*d,8)),Vector((0,0,-1)))
            if not ok or obj.name!=ground.name:return False
        return True
    # A small neighbourhood temple, the kind tucked between Taipei's blocks.
    for (x,y) in [(-2.15,-2.25),(-1.55,-2.30),(-.45,-2.40),(2.35,-2.10),(-2.85,-1.55),(-3.2,1.9)]:
        if placed_temple or not free(x,y,.42,.36):continue
        z=surface(x,y)
        if z is None:continue
        temple(x,y,z);placed_temple=True
    bpy.context.view_layer.update();depsgraph=bpy.context.evaluated_depsgraph_get()
    i=0;step=.40
    for gy in range(-9,10):
        for gx in range(-13,14):
            x=gx*step+rng.uniform(-.05,.05);y=gy*step+rng.uniform(-.05,.05)
            w=rng.uniform(.24,.34);d=rng.uniform(.24,.34)
            if not free(x,y,w+.05,d+.05):continue
            corners=[surface(x+dx*w/2,y+dy*d/2) for dx,dy in [(-1,-1),(1,-1),(1,1),(-1,1)]]
            if any(z is None for z in corners):continue
            low,high=min(corners),max(corners)
            if high-low>.12:continue
            base=high+.028;roll=rng.random();edge=math.hypot(x/5.2,y/3.7)
            # Keep a green margin between the city and the cliff edge.
            if any(surface(x+dx*(w/2+.22),y+dy*(d/2+.22)) is None for dx,dy in [(-1,-1),(1,-1),(1,1),(-1,1),(0,-1.3),(0,1.3),(-1.3,0),(1.3,0)]):continue
            if roll<.08:
                # An occasional pocket park: trees straight in the ground.
                for k in range(rng.randint(3,5)):tree(x+rng.uniform(-w,w)*.4,y+rng.uniform(-d,d)*.4,rng.uniform(.13,.2),low)
            elif roll<.32 and edge<.75:
                box('Residential tower · podium',(x,y,(low+base)/2),(w+.03,d+.03,base-low),'paving',.001)
                rectilinear_block('Residential tower',x,y,w*.8,d*.8,rng.uniform(.75,1.15),3100+i,rng.choice([0,3]),base=base)
            else:
                box('Neighborhood · terraced plot',(x,y,(low+base)/2),(w+.03,d+.03,base-low),'paving',.001)
                city_frontage('Neighborhood · infill frontage',x,y,w,d,rng.uniform(.22,.58),3000+i,base)
            i+=1
    print(f'CITY: infilled {i} plots',flush=True)


def city():
    P['glass']=material('Taipei · green architectural glazing',(.055,.12,.092),metal=.42,rough=.24)
    P['city-tile']=textured('City · warm ceramic tile',(.23,.20,.16),(.39,.35,.28),'plaster',rough=.82)
    P['city-plaster']=textured('City · pale weathered render',(.26,.26,.24),(.43,.43,.40),'plaster',rough=.92)
    P['city-grey']=material('City · grey mineral facade',(.20,.23,.23),rough=.84)
    P['city-roof']=textured('City · aged flat roof',(.055,.065,.065),(.13,.14,.13),'plaster',rough=.94)
    P['city-rust']=material('City · weathered red sheet metal',(.16,.074,.043),metal=.12,rough=.77)
    P['shoplight']=material('City · lit arcade shopfront',(1,.72,.42),emission=1.6)
    P['homelight']=material('City · lamplit apartment',(.95,.62,.32),emission=.9)
    P['streetlight']=material('City · sodium street lamp',(1,.70,.38),emission=6)
    P['tierglow']=material('Taipei 101 · gold tier lighting',(1,.78,.42),emission=5)
    # By night the whole curtain wall glows softly and evenly, cool white
    # through green glass; by day it is the same blue-green glass throughout.
    P['101glass']=material('Taipei 101 · evenly lit glazing',(.30,.56,.52),emission=.075)
    P['headlight']=material('Traffic · headlight trail',(1,.93,.80),emission=4)
    P['taillight']=material('Traffic · taillight trail',(1,.10,.06),emission=4)
    for key in ['city-tile','city-plaster','city-grey','brick','concrete','city-roof','stone']:weathered(P[key])
    weathered(P['city-rust'],.1,.02,.12)
    # Taipei's vertical shop signs: saturated by day, lit by night.
    for name,color in [('red',(.62,.05,.04)),('blue',(.05,.18,.55)),('yellow',(.85,.62,.06)),('green',(.06,.40,.20)),('white',(.80,.80,.76)),('orange',(.85,.30,.05))]:
        P['sign-'+name]=material('Sign · '+name,color,rough=.5,emission=2.2)
    P['temple-red']=textured('Temple · vermilion lacquer',(.32,.04,.03),(.48,.08,.05),'plaster',rough=.55)
    P['temple-roof']=material('Temple · glazed orange tile',(.62,.22,.05),rough=.32)
    P['temple-gold']=material('Temple · gilded trim',(.75,.52,.14),metal=.8,rough=.35)
    P['temple-lantern']=material('Night · temple lantern',(1,.18,.08),emission=4)
    foundation(31,'district');landscape('work',31);rng=random.Random(263)
    ground=bpy.data.objects['Island · eroded basalt escarpment'];ground.data.materials[1]=P['paving']
    ground.data.materials[2]=textured('Xinyi · park meadow',(.035,.051,.018),(.115,.135,.048),'moss',rough=.98)
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
    if refined('work','tower_plaza'):
        box('101 plaza · stone forecourt',(tx,-.798,.061),(.89,.13,.018),'paving',.002)
        for x in [tx-.31,tx+.31]:
            box('101 plaza · low planter',(x,-.79,.080),(.12,.042,.022),'concrete',.002)
            box('101 plaza · planted bed',(x,-.79,.092),(.108,.034,.004),'moss',.001)
        for x in [tx-.18,tx,tx+.18]:
            box('101 plaza · entrance glazing',(x,ty-.334,.12),(.12,.008,.10),'glass',.001)
        box('101 plaza · entrance canopy',(tx,ty-.37,.184),(.62,.12,.014),'steel',.002)
    # Taipei World Trade Center: broad courtyard block immediately west.
    for x,y,w,d in [(-2.10,-.41,1.50,.25),(-2.10,.49,1.50,.25),(-2.78,.04,.20,.82),(-1.43,.04,.20,.82)]:
        city_block('World Trade Center',x,y,w,d,.33,202,0)
    box('TWTC · recessed courtyard',(-2.10,.04,.04),(1.18,.56,.01),'stone',0)
    # Grand Hyatt north of the trade center, with a stepped shoulder profile.
    city_block('Grand Hyatt main volume',-2.15,.95,1.08,.34,1.04,215,0)
    for x in [-2.79,-1.51]:city_block('Grand Hyatt wing',x,.89,.25,.43,.87,216,0)
    # Nan Shan's paired blades are the front/back edges of one folded tower,
    # not two pyramidal roofs. See Mitsubishi Jisho Design's project photograph.
    # The retail annex: three large blocks offset in alternating layers, like
    # hands laid one on another, with planted roof terraces.
    for j in range(3):
        shift=(-.07,.07,-.07)[j]
        box('Nan Shan · planted retail terrace',(2.09+shift,.19+j*.04,.15+j*.15),(.92-j*.06,1.12-j*.08,.14),'glass2',.002)
        box('Nan Shan · terrace coping',(2.09+shift,.19+j*.04,.225+j*.15),(.94-j*.06,1.14-j*.08,.015),'steel',.001)
        for i in range(6):tree(1.72+shift+i*.12,-.28+j*.08,.16,.23+j*.15)
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
    i=0
    for y in [-1.43,-1.96]:
        for start,end in [(-3.08,-1.23),(-.85,1.34),(1.76,2.54),(2.86,3.22)]:
            x=start
            while x<end-.16:
                w=min(rng.uniform(.19,.34),end-x-.015)
                city_frontage('Xinyi · arcade frontage',x+w/2,y,w,rng.uniform(.27,.33),rng.uniform(.23,.54),480+i)
                x+=w+.018;i+=1
    # Street trees are 8–12m tall, cars 4m long at the same scale as the tower.
    for i in range(38):
        x=-3.05+i*.16
        tree(x,-1.14,.14+rng.random()*.03)
        if i%2==0:tree(x,1.20,.15)
    # Long-exposure traffic: white headlights one way, red tail lights the
    # other, broken into the gaps between junctions.
    trng=random.Random(5101)
    for (a,b,fixed,axis) in [(-3.2,3.2,-.95,'x'),(-2.3,2.1,-1.05,'y'),(-2.3,2.1,1.55,'y'),(-3.2,3.2,1.35,'x')]:
        for lane,mat in [(-.045,'headlight'),(.045,'taillight')]:
            t=a+trng.uniform(0,.3)
            while t<b-.1:
                ln=trng.uniform(.14,.42)
                c=t+ln/2
                if axis=='x':box('Traffic · light trail',(c,fixed+lane,.0505),(ln,.006,.003),mat,0)
                else:box('Traffic · light trail',(fixed+lane,c,.0505),(.006,ln,.003),mat,0)
                t+=ln+trng.uniform(.18,.55)
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
    urban_extension()
    densify_city()
    night_extras(tx,ty)
    for x,y in [(-1.08,-.90),(1.53,-.94),(2.65,1.34)]:
        light('City · warm intersection',(x,y,.30),(1,.64,.30),2.4,.25,(x,y,.05))


def torus(name,loc,major,minor,mat,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=40,minor_segments=8,location=loc,rotation=rotation)
    obj=bpy.context.object
    for face in obj.data.polygons: face.use_smooth=True
    return finish(obj,name,mat)


def lathe(name,loc,profile,mat,segments=32):
    """A turned shape from (radius, height) pairs, bottom to top, capped."""
    verts=[(r*math.cos(i*math.tau/segments),r*math.sin(i*math.tau/segments),z) for r,z in profile for i in range(segments)]
    rings=len(profile)
    faces=[tuple(reversed(range(segments))),tuple(range((rings-1)*segments,rings*segments))]
    faces+=[(k*segments+i,k*segments+(i+1)%segments,(k+1)*segments+(i+1)%segments,(k+1)*segments+i) for k in range(rings-1) for i in range(segments)]
    obj=mesh(name,verts,faces,mat);obj.location=loc
    for face in list(obj.data.polygons)[2:]:face.use_smooth=True
    return obj


def lava_lamp(x,y,z,k=1):
    """A small lava lamp: chrome cone base and cap round a tapered bottle of
    magenta liquid, on the room's switch. Only the wax pooled at the
    bottom is modelled: the page animates the drops rising (IslandLife)."""
    P['lava_liquid']=material('Glow · lava lamp liquid',(.90,.06,.45),rough=.15,emission=.6)
    P['lava_wax']=material('Glow · lava lamp wax',(1,.48,.08),rough=.3,emission=3)
    lathe('Lava lamp · chrome base',(x,y,z),[(.10*k,0),(.098*k,.012*k),(.056*k,.16*k)],'steel')
    lathe('Lava lamp · bottle',(x,y,z+.16*k),[(.054*k,0),(.064*k,.07*k),(.052*k,.17*k),(.036*k,.25*k)],'lava_liquid')
    sphere('Lava lamp · pooled wax',(x,y-.01*k,z+.18*k),(.05*k,.05*k,.022*k),'lava_wax',2)
    lathe('Lava lamp · chrome cap',(x,y,z+.41*k),[(.038*k,0),(.022*k,.07*k),(.021*k,.072*k)],'steel')
    light('Glow · lava lamp',(x,y-.12*k,z+.30*k),(1,.25,.40),5*k,.06)


def starship(x,y,z,height=1.05):
    """A stainless Starship / Super Heavy display stack, with a black
    windward heat shield, two pairs of ship flaps and booster grid fins."""
    k=height/1.05;r=.041*k
    P.setdefault('starship_steel',textured('Starship · brushed stainless steel',(.40,.44,.48),(.69,.73,.76),'metal',metal=.85,rough=.28))
    P.setdefault('starship_tiles',textured('Starship · black heat shield',(.008,.010,.014),(.025,.029,.035),'stone',rough=.9))
    cylinder('Starship model · display base',(x,y,z+.012*k),.10*k,.024*k,'ink',48,bevel=.003)
    cylinder('Super Heavy · engine skirt',(x,y,z+.055*k),r,.060*k,'starship_steel',48,bevel=.001)
    cylinder('Super Heavy · stainless booster',(x,y,z+.345*k),r,.53*k,'starship_steel',48,bevel=.001)
    for i in range(12):
        a=i*math.tau/12
        cylinder('Super Heavy · engine bell',(x+math.cos(a)*r*.73,y+math.sin(a)*r*.73,z+.030*k),.007*k,.018*k,'steel',12,top=.004*k,bevel=0)
    for i in range(12):
        torus('Super Heavy · welded ring',(x,y,z+(.09+i*.043)*k),r+.0003*k,.0006*k,'steel')
    # The vented hot-stage ring separates the two silver cylinders.
    cylinder('Super Heavy · hot-stage shadow',(x,y,z+.626*k),r*.90,.033*k,'ink',40,bevel=0)
    for zz in [.610,.643]:
        torus('Super Heavy · hot-stage rim',(x,y,z+zz*k),r,.0018*k,'starship_steel')
    for i in range(16):
        a=i*math.tau/16
        rod('Super Heavy · hot-stage strut',(x+math.cos(a)*r,y+math.sin(a)*r,z+.611*k),(x+math.cos(a)*r,y+math.sin(a)*r,z+.642*k),.0011*k,'starship_steel',6)
    for i in range(4):
        a=math.pi/4+i*math.pi/2
        box('Super Heavy · grid fin',(x+math.cos(a)*(r+.012*k),y+math.sin(a)*(r+.012*k),z+.574*k),(.035*k,.025*k,.005*k),'ink',.001,rot=a)
        for j in range(4):
            bar=box('Super Heavy · grid fin rib',(x+math.cos(a)*(r+.012*k),y+math.sin(a)*(r+.012*k),z+.578*k),(.031*k,.0014*k,.002*k),'steel',0,rot=a)
            bar.location.x+=-math.sin(a)*(j-1.5)*.006*k
            bar.location.y+=math.cos(a)*(j-1.5)*.006*k
    # Ship: cylindrical tank barrel and a gently rounded ogive nose.
    profile=[(r,0),(r,.265*k),(.038*k,.305*k),(.028*k,.350*k),(.015*k,.383*k),(.002*k,.407*k)]
    lathe('Starship · stainless ship',(x,y,z+.643*k),profile,'starship_steel',segments=64)
    for zz in [.69,.74,.79,.84,.89]:
        torus('Starship · welded ring',(x,y,z+zz*k),r+.0003*k,.0006*k,'steel')
    # A partial shell shows both the tiled belly and the polished steel side.
    # The belly faces the wall, so from the site camera the ship's steel side
    # (and its edge-on black tiles) reads against the night instead of a
    # black silhouette.
    verts=[];faces=[];segments=24
    for radius,h in profile:
        for i in range(segments+1):
            a=math.radians(15)+i*math.radians(135)/segments
            verts.append((x+(radius+.0006*k)*math.cos(a),y+(radius+.0006*k)*math.sin(a),z+.643*k+h))
    for row in range(len(profile)-1):
        for i in range(segments):
            n=row*(segments+1)+i
            faces.append((n,n+1,n+segments+2,n+segments+1))
    shield=mesh('Starship · windward heat shield',verts,faces,'starship_tiles')
    for face in shield.data.polygons:face.use_smooth=True
    for side in [-1,1]:
        for label,outline in [
            ('aft',[(.036,.66),(.082,.66),(.080,.72),(.041,.81)]),
            ('forward',[(.031,.927),(.062,.925),(.058,.973),(.022,1.011)]),
        ]:
            v=[(x+side*u*k,y+dy*k,z+h*k) for dy in [-.005,.005] for u,h in outline]
            flap=mesh('Starship · '+label+' flap',v,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'starship_steel')
            flap.data.materials.append(P['starship_tiles']);flap.data.polygons[0].material_index=1


def spot(name,loc,target,color,energy,cone,blend=.5,soft=.04):
    """A spotlight at `loc` aimed at `target`: a fixture's own light, falling
    where its shade or opening sends it, with a soft (`blend`) edge."""
    data=bpy.data.lights.new(name,'SPOT');data.color=color;data.energy=energy
    data.spot_size=math.radians(cone);data.spot_blend=blend;data.shadow_soft_size=soft
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
    return obj


def shell(name,loc,profile,mat,segments=48):
    """A turned shell from (radius, height) pairs, rim first: open at the rim
    (a lamp shade lets its light out), closed at the crown."""
    verts=[(r*math.cos(i*math.tau/segments),r*math.sin(i*math.tau/segments),z) for r,z in profile for i in range(segments)]
    rings=len(profile)
    faces=[tuple(range((rings-1)*segments,rings*segments))]
    faces+=[(k*segments+i,k*segments+(i+1)%segments,(k+1)*segments+(i+1)%segments,(k+1)*segments+i) for k in range(rings-1) for i in range(segments)]
    obj=mesh(name,verts,faces,mat);obj.location=loc
    for face in list(obj.data.polygons)[1:]:face.use_smooth=True
    return obj


# The rooms' lamps are In Common With designs (incommonwith.com), modelled at
# their catalogue proportions in the rooms' 2-units-per-metre scale. Each room
# is lit by its fixtures: every pool, beam and glow has a source you can see.
# Every lamp burns the same warm white, about 2700K, so the room reads as lit
# by one family of bulbs.
WARM=(1,.64,.36)


def haze(name,apex,target,cone,density=.035):
    """A faint haze in a lamp's beam, so the light shows in the air between
    the fixture and where it lands: a cone of thin warm scattering volume
    from `apex` toward `target`, `cone` degrees wide. Named for its fixture,
    it switches with it (and is cleared when the room is dark)."""
    if 'haze' not in P:
        mat=bpy.data.materials.new('Beam haze');mat.use_nodes=True
        nodes=mat.node_tree.nodes
        nodes.remove(nodes['Principled BSDF'])
        volume=nodes.new('ShaderNodeVolumePrincipled')
        volume.inputs['Color'].default_value=(1,.92,.84,1);volume.inputs['Anisotropy'].default_value=.45
        mat.node_tree.links.new(volume.outputs[0],nodes['Material Output'].inputs['Volume'])
        P['haze']=mat
    apex,target=Vector(apex),Vector(target)
    length=(target-apex).length;radius=length*math.tan(math.radians(cone/2))
    segments=32
    verts=[(0,0,0)]+[(radius*math.cos(i*math.tau/segments),radius*math.sin(i*math.tau/segments),-length) for i in range(segments)]
    faces=[tuple(range(segments,0,-1))]+[(0,i+1,(i+1)%segments+1) for i in range(segments)]
    obj=mesh(name,verts,faces,P['haze'].copy())
    obj.data.materials[0].node_tree.nodes['Principled Volume'].inputs['Density'].default_value=density
    obj.location=apex
    obj.rotation_euler=(target-apex).to_track_quat('-Z','Y').to_euler()
    obj.visible_shadow=False
    return obj


def arundel_table_lamp(x,y,z,energy,k=1,toward=None):
    """In Common With's Arundel Table Lamp: a domed enamel shade on a slender
    stem over a round foot, in sage. Its light falls in a pool beneath the
    dome, leaning a little `toward` a point on the surface if given, and
    lights the inside of the shade."""
    P['sage']=material('Arundel · sage enamel',(.19,.25,.18),rough=.45)
    cylinder('Arundel lamp · round foot',(x,y,z+.014*k),.15*k,.028*k,'sage',48,bevel=.008)
    rod('Arundel lamp · stem',(x,y,z+.02*k),(x,y,z+.86*k),.011*k,'sage',16)
    rim=z+.70*k
    shell('Arundel lamp · domed shade',(x,y,rim),[(.36*k,0),(.356*k,.022*k),(.335*k,.065*k),(.29*k,.11*k),(.21*k,.148*k),(.11*k,.172*k),(.03*k,.182*k)],'sage')
    bulb=(x,y,rim+.11*k)
    sphere('Lamp · frosted diffuser',bulb,(.055*k,.055*k,.045*k),'light',2)
    light('Arundel lamp · light in the shade',(x,y,rim+.03*k),WARM,energy*.06,.10*k)
    ANCHORS['lamp']=bulb
    target=(*toward,z) if toward else (x,y,z)
    haze('Arundel lamp · haze',(x,y,rim+.04*k),target,96,.022)
    return spot('Arundel lamp · pool of light',(x,y,rim+.05*k),target,WARM,energy,125,.55,.06*k)


def up_down_sconce(x,y,z,energy,k=1):
    """In Common With's Up Down Sconce on a wall whose face is at `y`: a short
    enamel cylinder on a round wall plate, open at both ends, glowing at each
    and throwing one beam up the wall and one down it."""
    P['moss']=material('Up Down Sconce · moss enamel',(.09,.13,.07),rough=.5)
    plate=cylinder('Up Down Sconce · wall plate',(x,y-.012*k,z),.07*k,.024*k,'ink',32,bevel=.004);plate.rotation_euler.x=math.pi/2
    rod('Up Down Sconce · arm',(x,y-.02*k,z),(x,y-.13*k,z),.014*k,'ink',12)
    body=(x,y-.17*k,z)
    cylinder('Up Down Sconce · body',body,.075*k,.46*k,'moss',40,bevel=.006)
    for side in (1,-1):
        cylinder('Up Down Sconce · lit opening',(x,body[1],z+side*.231*k),.066*k,.004*k,'light',40,bevel=0)
        spot('Up Down Sconce · beam '+('up' if side>0 else 'down'),(x,body[1],z+side*.24*k),(x,y-.05*k,z+side*1.8*k),WARM,energy,44,.35,.03*k)
        # The haze stops short of the wall's top and the desk.
        haze('Up Down Sconce · haze '+('up' if side>0 else 'down'),(x,body[1],z+side*.24*k),(x,y-.09*k,z+side*(.85 if side>0 else 1.1)*k),36,.05)


def luca_wall_sconce(x,y,z,energy,k=1):
    """In Common With's Luca Wall Sconce on a wall whose face is at `y`: a
    dark steel box that hides its lamp and throws a fan of light down the
    wall beneath it."""
    P['luca']=material('Luca sconce · blackened steel',(.025,.024,.022),metal=.4,rough=.5)
    box('Luca sconce · body',(x,y-.075*k,z),(.26*k,.15*k,.36*k),'luca',.008)
    box('Luca sconce · lit underside',(x,y-.075*k,z-.181*k),(.23*k,.12*k,.004),'light',0)
    haze('Luca sconce · haze',(x,y-.09*k,z-.19*k),(x,y-.16*k,z-1.3*k),64,.055)
    return spot('Luca sconce · wash down the wall',(x,y-.05*k,z-.19*k),(x,y-.01*k,z-2.0*k),WARM,energy,100,.6,.04*k)


def eave_table_lamp(x,y,z,energy,k=1):
    """In Common With's Eave Table Lamp in black steel: a straight-sided cone
    of a shade (12in across) on a slim stem over a round weighted foot, 17 3/4in
    tall. The bulb glows under the shade, whose pale enamel inside catches its
    light, and throws a pool of light down onto the bench."""
    P['eave']=material('Eave lamp · black steel',(.018,.018,.02),metal=.55,rough=.42)
    P['eave_inside']=material('Eave lamp · bone enamel inside',(.78,.74,.66),rough=.55)
    cylinder('Eave lamp · round foot',(x,y,z+.018*k),.13*k,.036*k,'eave',48,bevel=.006)
    rod('Eave lamp · stem',(x,y,z+.03*k),(x,y,z+.84*k),.012*k,'eave',16)
    rim=z+.56*k
    cone=[(.305*k,0),(.30*k,.006*k),(.22*k,.09*k),(.13*k,.185*k),(.045*k,.275*k),(.03*k,.285*k)]
    shell('Eave lamp · cone shade',(x,y,rim),cone,'eave')
    shell('Eave lamp · shade inside',(x,y,rim+.004*k),[(r-.006*k,h) for r,h in cone],'eave_inside')
    bulb=(x,y,rim+.17*k)
    sphere('Eave lamp · bulb',bulb,(.045*k,.045*k,.04*k),'light',2)
    light('Eave lamp · light in the shade',(x,y,rim+.10*k),WARM,energy*.08,.08*k)
    ANCHORS['lamp']=bulb
    return spot('Eave lamp · pool of light',(x,y,rim+.12*k),(x,y,z),WARM,energy,120,.55,.06*k)


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


def deck_glow():
    """Carter asked for LED strips under the workshop's deck, so the floor
    seems to glow: the same Lakers purple as the shed's strips, run along the
    foot of every plank's end and the steps between them (where the deck's
    rounded edge is stepped), its light spilling out from under the boards
    onto the grass. Not "strip" by name: it follows the deck's whole outline,
    not one straight run, so the live details leave it be."""
    planks=[((i-10.5)*.30,2.1*math.sqrt(max(0,1-(((i-10.5)*.30)/3.8)**2))) for i in range(22)]
    recessed=refined('projects','deck_lighting')
    half=.1445;z=.042 if recessed else .058;proud=-.026 if recessed else .004
    for side in [-1,1]:
        for i,(x,length) in enumerate(planks):
            if side>0 and abs(x)<3:continue
            # The board's end, then the step to its neighbour's end.
            box('Glow · purple deck LED',(x,side*(length+proud),z),(.27,.008,.012),'purple_strip',0)
            if recessed:
                box('Deck · recessed lighting fascia',(x,side*(length-.008),.078),(.299,.026,.065),'floorwood',.003)
        for (x0,l0),(x1,l1) in zip(planks,planks[1:]):
            if side>0 or abs(l1-l0)<.01:continue
            longer_x,edge=(x1,-half) if l1>l0 else (x0,half)
            box('Glow · purple deck LED',(longer_x+edge+math.copysign(proud,edge),-(l0+l1)/2,z),(.008,abs(l1-l0),.012),'purple_strip',0)
    # The outer boards' long sides.
    for x,length in [planks[0],planks[-1]]:
        out=math.copysign(half+proud,x)
        box('Glow · purple deck LED',(x+out,0,z),(.008,length*2,.012),'purple_strip',0)
    # Its light, low in the gap under the boards, spilling out onto the ground.
    for i in [1,3,5,7,9,12,14,16,18,20]:
        x,length=planks[i]
        light('Glow · purple deck wash',(x,-length-.02,.05),(.45,.14,1),8 if recessed else 14,.78 if recessed else .45,(x*1.06,-length-.75,0))
    for x,length in [planks[0],planks[-1]]:
        out=math.copysign(1,x)
        light('Glow · purple deck wash',(x+out*(half+.02),-length*.5,.05),(.45,.14,1),5,.4,(x+out*.8,-length*.6,0))


def eames_lounge_chair(x,y,angle,k=1):
    """Herman Miller's Eames Lounge Chair and Ottoman (Carter asked for one
    in the study): three moulded walnut shells, seat, back and headrest, each
    cradling a black leather cushion, the back and headrest reclined on two
    polished aluminium spines, walnut armrests with leather pads, all on a
    five-star swivel base; the ottoman's shell and cushion on a four-star
    base in front. Built facing -y at 2 units a metre, then turned by
    `angle` and scaled by k (the study is small)."""
    from mathutils import Matrix
    before=set(bpy.context.scene.objects)
    P.setdefault('eames_leather',textured('Lounge chair · supple black leather',(.025,.022,.020),(.052,.044,.038),'fabric',rough=.49) if refined('writing','lounge') else material('Lounge chair · black leather',(.04,.035,.032),rough=.3))
    P.setdefault('eames_alu',material('Lounge chair · polished aluminium',(.65,.67,.69) if refined('writing','lounge') else (.80,.80,.82),metal=1,rough=.34 if refined('writing','lounge') else .22))
    def tilted(name,c,size,mat,bevel,tilt):
        obj=box(name,c,size,mat,bevel);obj.rotation_euler.x=tilt;return obj
    def shell(part,c,size,tilt,lip):
        # A moulded walnut tray: the panel, its curled-up sides, and the
        # cushion it holds, proud of it.
        w,d,h=size
        tilted('Lounge chair · walnut '+part+' shell',c,size,'wood',.02,tilt)
        for side in [-1,1]:tilted('Lounge chair · walnut shell lip',(c[0]+side*(w/2-.02),*c[1:]),(.05,*lip),'wood',.015,tilt)
    # Seat: tipped back a little.
    seat=-.17
    shell('seat',(0,-.02,.60),(1.12,1.02,.06),seat,(1.0,.16))
    tilted('Lounge chair · leather seat cushion',(0,-.05,.71),(1.02,.96,.17),'eames_leather',.07,seat)
    # Back and headrest, reclined, the headrest a touch more.
    back,head=-.35,-.42
    shell('back',(0,.52,1.08),(1.12,.06,.66),back,(.16,.64))
    tilted('Lounge chair · leather back cushion',(0,.44,1.10),(1.02,.17,.62),'eames_leather',.07,back)
    shell('headrest',(0,.70,1.62),(1.0,.06,.42),head,(.16,.40))
    tilted('Lounge chair · leather headrest cushion',(0,.62,1.63),(.92,.16,.38),'eames_leather',.07,head)
    # Armrests: walnut with a leather pad, from the back shell forward.
    for side in [-1,1]:
        tilted('Lounge chair · walnut armrest',(side*.62,-.02,.97),(.10,.82,.05),'wood',.02,-.05)
        tilted('Lounge chair · leather arm pad',(side*.62,-.04,1.01),(.12,.72,.05),'eames_leather',.02,-.05)
    # The aluminium spines that join the back to the headrest and the seat.
    for sx in [-.26,.26]:
        rod('Lounge chair · aluminium back spine',(sx,.59,.80),(sx,.80,1.80),.028,'eames_alu',12)
        rod('Lounge chair · aluminium seat bracket',(sx,.28,.55),(sx,.59,.80),.026,'eames_alu',12)
    # Five-star swivel base, black with polished tops.
    cylinder('Lounge chair · swivel column',(0,.05,.33),.06,.40,'ink',24)
    for i in range(5):
        a=math.radians(90+i*72);end=(math.cos(a)*.58,.05+math.sin(a)*.58,.05)
        rod('Lounge chair · base spoke',(0,.05,.14),end,.034,'ink',10)
        rod('Lounge chair · polished spoke top',(0,.05,.17),(end[0],end[1],.08),.016,'eames_alu',8)
        cylinder('Lounge chair · glide',(end[0],end[1],.025),.035,.05,'ink',12)
    # The ottoman in front, on its own four-star base.
    oy=-1.35
    cylinder('Ottoman · column',(0,oy,.20),.05,.26,'ink',24)
    for i in range(4):
        a=math.radians(45+i*90);end=(math.cos(a)*.45,oy+math.sin(a)*.45,.05)
        rod('Ottoman · base spoke',(0,oy,.12),end,.03,'ink',10)
        rod('Ottoman · polished spoke top',(0,oy,.15),(end[0],end[1],.08),.014,'eames_alu',8)
        cylinder('Ottoman · glide',(end[0],end[1],.025),.03,.05,'ink',12)
    tilted('Ottoman · walnut shell',(0,oy,.38),(1.0,.86,.06),'wood',.02,.06)
    for side in [-1,1]:tilted('Ottoman · walnut shell lip',(side*.48,oy,.43),(.05,.84,.14),'wood',.015,.06)
    tilted('Ottoman · leather cushion',(0,oy,.49),(.92,.80,.16),'eames_leather',.07,.06)
    parts=set(bpy.context.scene.objects)-before
    bpy.context.view_layer.update()
    place=Matrix.Translation(Vector((x,y,.148)))@Matrix.Rotation(math.radians(angle),4,'Z')@Matrix.Diagonal((k,k,k,1))
    for obj in parts:obj.matrix_world=place@obj.matrix_world


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
    """A soft-bound essay notebook: the ink and paper share one lit surface."""
    import subprocess
    import textwrap
    width=.92;depth=.64
    rng=random.Random(733)
    P['notebook_paper']=textured('Notebook · warm uncoated paper',(.64,.60,.51),(.74,.70,.61),'paper',rough=.96)
    P['notebook_ink']=material('Notebook · absorbed charcoal ink',(.025,.023,.020),rough=.98)
    P['notebook_pencil']=material('Notebook · soft graphite notes',(.24,.22,.18),rough=1)
    P['notebook_cloth']=textured('Notebook · worn olive cloth',(.075,.085,.060),(.15,.16,.115),'fabric',rough=.94)
    columns=32;rows=12
    leaves={-1:26,1:17}
    def paper_point(side,u,v,layer,edge=0):
        # More pages lie on the left. Both halves settle toward the desk,
        # with a shallow rise at the sewn gutter rather than a padded arch.
        yy=(v-.5)*depth
        round_corner=max(0,abs(yy)-(depth/2-.012))
        inset=.012-math.sqrt(max(0,.012**2-round_corner**2))
        xx=side*(.003+u*(width/2-.003+edge)-inset*u**12)
        arch=(.021 if side<0 else .029)*math.sin(math.pi*u)**1.1
        curl=(.003 if side<0 else .014)*u**7*(1-v)**7
        ripple=.0015*math.sin(v*5+u*3)*(u**2)
        zz=z+.016+layer*.00075+arch+.004*math.exp(-u*9)+curl+ripple
        return (x+xx,y+yy+edge*u,zz)

    curve('Notebook · recessed cloth spine',[(x,y-depth/2,z+.009),(x,y,z+.007),(x,y+depth/2,z+.009)],.008,'leather')
    for side in [-1,1]:
        box('Notebook · soft cloth binding',(x+side*width/4,y,z+.006),(width/2+.012,depth+.018,.011),'notebook_cloth',.005)
        for layer in range(leaves[side]):
            verts=[]
            edge=0 if layer==leaves[side]-1 else rng.uniform(-.0015,.0015)
            for row in range(rows+1):
                for col in range(columns+1):
                    verts.append(paper_point(side,col/columns,row/rows,layer,edge))
            faces=[]
            for row in range(rows):
                for col in range(columns):
                    i=row*(columns+1)+col
                    face=(i,i+1,i+columns+2,i+columns+1)
                    faces.append(face if side>0 else tuple(reversed(face)))
            obj=mesh('Notebook · individual paper sheet',verts,faces,'notebook_paper')
            for f in obj.data.polygons:f.use_smooth=True
            thickness=obj.modifiers.new('Paper thickness and cut edges','SOLIDIFY')
            thickness.thickness=.00065;thickness.offset=-1
    ANCHORS['spread']=[paper_point(side,1,v,leaves[side]-1) for v in [1,0] for side in [-1,1]]
    ANCHORS['page']=[paper_point(1,u,v,leaves[1]-1) for v in [.92,.08] for u in [.15,.90]]
    ANCHORS['landmark']=(x,y,z+.04)

    def ink_point(xx,yy,side=1):
        u=(abs(xx)-.003)/(width/2-.003)
        px,py,pz=paper_point(side,u,yy/depth+.5,leaves[side]-1)
        return (px,py,pz+.0006)

    # Model only the ink, then bend it onto the paper. It receives exactly
    # the page's lighting and parallax, including when the lamp is switched off.
    font_path=Path('/System/Library/Fonts/Supplemental/Georgia.ttf')
    font=bpy.data.fonts.load(str(font_path),check_existing=True) if font_path.exists() else None
    bold_path=Path('/System/Library/Fonts/Supplemental/Georgia Bold.ttf')
    bold=bpy.data.fonts.load(str(bold_path),check_existing=True) if bold_path.exists() else font
    def print_line(body,xx,yy,size,side=1):
        obj=lettering('Notebook · printed '+body,body,(0,0,0),size,'notebook_ink',(0,0,0))
        obj.data.align_x='LEFT';obj.data.align_y='BOTTOM_BASELINE'
        obj.data.extrude=0;obj.data.resolution_u=3
        if font:obj.data.font=font
        if refined('writing','notebook_focus') and size>=.04 and bold:obj.data.font=bold
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.convert(target='MESH')
        for vertex in obj.data.vertices:
            vertex.co=ink_point(xx+vertex.co.x,yy+vertex.co.y,side)
        return obj

    essay=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/blender/notebook_page.mjs')],text=True))
    print_line('flying Arrows',.070,.245,.013)
    print_line(essay['date'].upper(),.070,.207,.0075)
    title=textwrap.wrap(essay['title'],14,break_long_words=False)
    title_size=.052 if refined('writing','notebook_focus') else .031
    title_step=.065 if refined('writing','notebook_focus') else .042
    for i,line in enumerate(title):print_line(line,.062 if refined('writing','notebook_focus') else .070,.140-i*title_step,title_size)
    baseline=.140-len(title)*title_step-.030
    rule=[ink_point(.070+i*.004,baseline) for i in range(10)]
    curve('Notebook · printed title rule',rule,.00035,'notebook_ink')
    for i,line in enumerate(textwrap.wrap(essay['subtitle'],35,break_long_words=False)):
        print_line(line,.070,baseline-.035-i*.020,.011 if refined('writing','notebook_focus') else .0095)
    print_line('Carter Wang',.070,-.251,.010)
    # A few pencil notes on the facing page, broken into words so the marks
    # read as handwriting instead of a ruled rectangle.
    rng=random.Random(233)
    print_line('Notes',-.39,.245,.016,-1)
    for row in range(12):
        yy=.185-row*.029
        cursor=-.39
        for word in range(rng.randint(3,5)):
            length=rng.uniform(.025,.060)
            if cursor+length>-.065:break
            points=[ink_point(cursor+length*i/12,yy+.0015*math.sin(i*2.1+row),-1) for i in range(13)]
            curve('Notebook · pencil note',points,.00038,'notebook_pencil')
            cursor+=length+.012
    # A flat woven ribbon lies in the gutter and relaxes over the near edge.
    ribbon=[(x-.003,y+.28,z+.025),(x-.003,y-.27,z+.025),
            (x+.003,y-.33,z+.015),(x+.018,y-.39,z+.007)]
    verts=[(px+side*.003,py,pz) for px,py,pz in ribbon for side in [-1,1]]
    mesh('Notebook · silk bookmark',verts,[(i,i+1,i+3,i+2) for i in range(0,6,2)],'redcloth')


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
            if refined('writing','rug'):
                # Most wool lies flat; only the far corners lift. Compression
                # stays above the floorboard tops, including under the chair.
                corner=.009*(u**18*v**18+(1-u)**18*(1-v)**18)
                dent=.002*math.exp(-((x-.16)**2+(y+2.0)**2)/.22)
                z=.159+.0012*math.sin(u*13)*math.sin(v*11)+corner-dent
            verts.append((x,y,z))
    for j in range(rows):
        for i in range(cols):
            a=j*(cols+1)+i;faces.append((a,a+1,a+cols+2,a+cols+1))
    rug=mesh('Study · softly rumpled woven rug',verts,faces,'rug')
    if refined('writing','rug'):
        thickness=rug.modifiers.new('Dense wool edge','SOLIDIFY');thickness.thickness=.007;thickness.offset=1
    for face in rug.data.polygons:face.use_smooth=True
    for i in range(215):
        x=-2.05+i*.02
        curve('Rug · visible warp',[(x,-2.21+j*.20,.166+.002*math.sin(i+j)) for j in range(17)],.0018,'rug')
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


def glass_material(name,color=(1,1,1),rough=.02,transmission=1.0):
    """Clear glass (or ice): fully transmissive, with a hint of tint."""
    mat=material(name,color,rough=rough)
    bs=mat.node_tree.nodes['Principled BSDF']
    for key in ['Transmission Weight','Transmission']:
        if key in bs.inputs:bs.inputs[key].default_value=transmission;break
    bs.inputs['IOR'].default_value=1.45
    return mat


def lay_down(objects,axis,degrees):
    """Tip objects built upright around the origin onto their side (turned
    `degrees` about `axis`), then lower them until their lowest point rests
    on z=0, ready to place() on a surface."""
    from mathutils import Matrix
    bpy.context.view_layer.update()
    turn=Matrix.Rotation(math.radians(degrees),4,axis)
    for obj in objects:obj.matrix_world=turn@obj.matrix_world
    bpy.context.view_layer.update()
    low=min((obj.matrix_world@Vector(corner)).z for obj in objects if obj.type in {'MESH','CURVE'} for corner in obj.bound_box)
    for obj in objects:obj.matrix_world=Matrix.Translation((0,0,-low))@obj.matrix_world


def place(objects,x,y,z,angle):
    """Move objects built around the origin to (x, y, z), turned about Z."""
    from mathutils import Matrix
    bpy.context.view_layer.update()
    pose=Matrix.Translation(Vector((x,y,z)))@Matrix.Rotation(angle,4,'Z')
    for obj in objects:obj.matrix_world=pose@obj.matrix_world


def ipad_pro(x,y,z,angle,wallpaper):
    """A 12.9-inch iPad Pro on a black Magic Keyboard: the keyboard and
    trackpad on the desk, the iPad floating on its cantilevered back plate,
    its screen facing the room and showing `wallpaper` (a path from ROOT)."""
    from mathutils import Matrix
    before=set(bpy.context.scene.objects)
    P['magic_keyboard']=material('Magic Keyboard · black polyurethane',(.018,.018,.02),rough=.6)
    P['ipad_body']=material('iPad Pro · space grey aluminium',(.085,.09,.10),metal=.7,rough=.3)
    P['magic_trackpad']=material('Magic Keyboard · matte glass trackpad',(.033,.035,.04),rough=.48)
    # Rounded outlines are independent of the thin bodies: a bevel on a box
    # clamps the corner radius to half its thickness and looks square.
    def outline(w,h,r):
        return [(cx+r*math.cos(a+math.pi/2*k/6),cz+r*math.sin(a+math.pi/2*k/6))
                for cx,cz,a in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,math.pi/2),
                                (-w/2+r,-h/2+r,math.pi),(w/2-r,-h/2+r,3*math.pi/2)]
                for k in range(7)]
    def panel(name,centre,w,h,thickness,radius,mat,tilt):
        edge=outline(w,h,radius);n=len(edge)
        vertices=[(px,py,pz) for py in (-thickness/2,thickness/2) for px,pz in edge]
        faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
        faces += [(i+n,(i+1)%n+n,(i+1)%n,i) for i in range(n)]
        obj=mesh(name,vertices,faces,mat);obj.location=centre;obj.rotation_euler.x=tilt
        return obj
    # A compact black deck, five staggered key rows, and a 10 x 5cm
    # trackpad. Only the small legends glow, not the entire keyboard bed.
    P['key_backlight']=material('Magic Keyboard · key backlight',(.46,.49,.54),emission=.35)
    panel('Magic Keyboard · base',(0,.225,.009),.575,.45,.018,.018,'magic_keyboard',math.pi/2)
    box('Magic Keyboard · recessed key bed',(0,.273,.0185),(.545,.252,.001),'ink',.006)
    def key(kx,ky,kw=.034,kh=.037,legend=True):
        box('Magic Keyboard · key',(kx,ky,.022),(kw,kh,.005),'magic_keyboard',.002)
        if legend:
            box('Magic Keyboard · key legend',(kx-.004,ky+.004,.0247),(.004,.005,.0004),'key_backlight',0)
    for row in range(4):
        for col in range(12):
            key(-.232+col*.041+(row%2)*.007,.365-row*.047)
    for kx,kw in [(-.243,.03),(-.205,.03),(-.163,.04),(0,.23),(.163,.04),(.208,.035),(.249,.03)]:
        key(kx,.177,kw,legend=abs(kx)>.12)
    panel('Magic Keyboard · trackpad',(0,.077,.0188),.205,.10,.0016,.009,'magic_trackpad',math.pi/2)
    rod('Magic Keyboard · base hinge',(-.27,.441,.022),(.27,.441,.022),.012,'magic_keyboard',24)
    # The lower support leans FORWARD from the rear hinge, then folds back
    # behind the tablet's upper half. This leaves its bottom floating above
    # the keys instead of reading as a laptop hinged at the rear edge.
    tilt=math.radians(-20);rotation=Matrix.Rotation(tilt,3,'X')
    centre=Vector((0,.315,.292))
    lower=Vector((0,.441,.025));fold=centre+rotation@Vector((0,.016,0))
    span=fold-lower
    panel('Magic Keyboard · forward cantilever support',tuple((lower+fold)/2),
          .55,span.length,.010,.008,'magic_keyboard',math.atan2(-span.y,span.z))
    panel('Magic Keyboard · magnetic upper panel',tuple(centre+rotation@Vector((0,.016,.102))),
          .553,.211,.010,.018,'magic_keyboard',tilt)
    rod('Magic Keyboard · upper hinge',tuple(fold+Vector((-.267,0,0))),tuple(fold+Vector((.267,0,0))),.008,'magic_keyboard',24)
    # Screen, bezel and body share one tilted local frame, so the display
    # stays seated in the glass all the way around its rounded border.
    panel('iPad Pro · body',tuple(centre),.561,.430,.012,.027,'ipad_body',tilt)
    panel('iPad Pro · black bezel',tuple(centre+rotation@Vector((0,-.0065,0))),
          .556,.425,.001,.025,'ink',tilt)
    image=bpy.data.images.load(str(ROOT/wallpaper),check_existing=True)
    if not image.packed_file:image.pack()
    display=material('iPad Pro · Screen display',(.02,.02,.02),rough=.2)
    tex=display.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    bs=display.node_tree.nodes['Principled BSDF']
    display.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    display.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color'])
    bs.inputs['Emission Strength'].default_value=1.1
    w,h=.524,.393
    edge=outline(w,h,.018)
    screen=mesh('iPad Pro · screen',[(px,0,pz) for px,pz in edge],[tuple(range(len(edge)))],display)
    uv=screen.data.uv_layers.new(name='Screen coordinates')
    for loop in screen.data.loops:
        px,_,pz=screen.data.vertices[loop.vertex_index].co
        uv.data[loop.index].uv=(px/w+.5,pz/h+.5)
    screen.location=centre+rotation@Vector((0,-.0075,0));screen.rotation_euler.x=tilt
    place(set(bpy.context.scene.objects)-before,x,y,z,angle)


def spotted_chip(color):
    """A clay chip's material with its six white edge spots, so chips on
    edge in a row read as chips, not a solid bar: the spots are bands of
    angle around the chip's own axis (object space)."""
    key='spotted-'+color
    if key in P:return key
    base=P['chip-'+color]
    mat=bpy.data.materials.new(base.name+' · edge spots');mat.use_nodes=True
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    bs=nodes['Principled BSDF'];bs.inputs['Roughness'].default_value=.45
    coords=nodes.new('ShaderNodeTexCoord')
    angle=nodes.new('ShaderNodeTexGradient');angle.gradient_type='RADIAL'
    links.new(coords.outputs['Object'],angle.inputs['Vector'])
    times=nodes.new('ShaderNodeMath');times.operation='MULTIPLY';times.inputs[1].default_value=6
    links.new(angle.outputs['Fac'],times.inputs[0])
    frac=nodes.new('ShaderNodeMath');frac.operation='FRACT'
    links.new(times.outputs[0],frac.inputs[0])
    spot=nodes.new('ShaderNodeMath');spot.operation='GREATER_THAN';spot.inputs[1].default_value=.70
    links.new(frac.outputs[0],spot.inputs[0])
    mix=nodes.new('ShaderNodeMix');mix.data_type='RGBA'
    links.new(spot.outputs[0],mix.inputs[0])
    mix.inputs[6].default_value=base.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[:]
    mix.inputs[7].default_value=(.86,.84,.78,1) if color!='white' else (.50,.04,.05,1)
    links.new(mix.outputs[2],bs.inputs['Base Color'])
    P[key]=mat
    return key


def poker_chip_case(x,y,z,angle):
    """An aluminium poker chip case, open on its back hinge: five rows of
    chips on edge in black felt, one colour to a row, with two decks of
    cards, a dealer button and five dice beside them."""
    from mathutils import Matrix
    before=set(bpy.context.scene.objects)
    for name,color in [('white',(.70,.68,.62)),('red',(.50,.025,.03)),('blue',(.02,.07,.32)),
                       ('black',(.012,.012,.014)),('green',(.02,.20,.07))]:
        P['chip-'+name]=material('Poker chip · '+name+' clay',color,rough=.45)
    P['poker_felt']=material('Chip case · black felt',(.010,.010,.012),rough=.98)
    W,D,H,t=.78,.50,.10,.012
    box('Chip case · aluminium floor',(0,0,t/2),(W,D,t),'steel',.003)
    for s in (-1,1):
        box('Chip case · aluminium end',(s*(W-t)/2,0,H/2),(t,D,H),'steel',.003)
        box('Chip case · aluminium side',(0,s*(D-t)/2,H/2),(W-2*t,t,H),'steel',.003)
        box('Chip case · black rim trim',(0,s*(D/2+.002),H-.004),(W+.006,.006,.012),'ink',.002)
        box('Chip case · latch',(s*.22,-D/2-.006,H-.025),(.05,.010,.035),'steel',.003)
    felt=t+.048
    box('Chip case · felt chip tray',(0,0,felt/2+t/2),(W-2*t,D-2*t,felt-t),'poker_felt',0)
    # Each row is 26 chips on edge, half sunk in its felt channel.
    r,thick,n=.040,.0125,26;crng=random.Random(5252)
    for row,color in enumerate(['white','red','blue','green','black']):
        ry=-.176+row*.088
        for k in range(n):
            chip=cylinder('Chip case · clay chip',(-W/2+.04+thick/2+k*thick,ry,felt),r,thick-.0008,spotted_chip(color),24,bevel=.0015)
            # Each chip turned at random about its own axis (Z, applied
            # first), so the spots scatter as in a real rack; then on edge.
            chip.rotation_mode='ZYX';chip.rotation_euler.z=crng.uniform(0,math.tau)
            chip.rotation_euler.y=math.pi/2
    # Cards, the dealer button and dice in the compartment at the right.
    for k,(cy,back) in enumerate([(-.10,'redcloth'),(.10,'chip-blue')]):
        box('Chip case · deck of cards',(.24,cy,felt+.02),(.13,.18,.04),'paper',.003)
        box('Chip case · card back',(.24,cy,felt+.0405),(.11,.16,.001),back,0)
    cylinder('Chip case · dealer button',(.34,.17,felt+.006),.035,.012,'paper',24,bevel=.002)
    for k in range(5):box('Chip case · red die',(.34,-.19+k*.075,felt+.013),(.026,.026,.026),'chip-red',.004,rot=k*.4)
    # The lid, built closed about its hinge and swung open past upright.
    lid_before=set(bpy.context.scene.objects)
    lh=.05
    box('Chip case · aluminium lid',(0,-D/2,lh-t/2),(W,D,t),'steel',.003)
    for s in (-1,1):
        box('Chip case · lid end',(s*(W-t)/2,-D/2,lh/2),(t,D,lh),'steel',.003)
        box('Chip case · lid side',(0,-D/2+s*(D-t)/2,lh/2),(W-2*t,t,lh),'steel',.003)
    box('Chip case · lid foam',(0,-D/2,lh-t-.008),(W-2*t,D-2*t,.016),'ink',0)
    box('Chip case · handle',(0,-D-.012,lh/2),(.20,.022,.022),'ink',.006)
    bpy.context.view_layer.update()
    hinge=Matrix.Translation(Vector((0,D/2,H)))@Matrix.Rotation(math.radians(-100),4,'X')
    for obj in set(bpy.context.scene.objects)-lid_before:obj.matrix_world=hinge@obj.matrix_world
    place(set(bpy.context.scene.objects)-before,x,y,z,angle)


def airpods_max(x,y,z,angle):
    """Apple AirPods Max in blue, laid down flat the way you'd put them on a
    desk: two anodised aluminium cups with knit cushions facing each other,
    resting on their edges, and the steel-framed knit headband lying flat
    behind them."""
    before=set(bpy.context.scene.objects)
    P['airpods_blue']=material('AirPods Max · blue anodised aluminium',(.11,.20,.42),metal=.7,rough=.35)
    P['airpods_knit']=textured('AirPods Max · pale blue knit mesh',(.22,.28,.38),(.34,.40,.50),'fabric',rough=.95)
    for s in (-1,1):
        # Cup and cushion are 9 x 7.5cm ovals, axes facing in.
        cup=cylinder('AirPods Max · ear cup',(s*.135,0,.09),.075,.07,'airpods_blue',32,bevel=.018)
        cup.scale=(1.2,1,1);cup.rotation_euler.y=math.pi/2
        cushion=cylinder('AirPods Max · ear cushion',(s*.075,0,.09),.072,.05,'airpods_knit',32,bevel=.016)
        cushion.scale=(1.2,1,1);cushion.rotation_euler.y=math.pi/2
        rod('AirPods Max · stainless arm',(s*.135,0,.17),(s*.135,0,.25),.006,'steel')
    box('AirPods Max · digital crown',(.135,.045,.175),(.024,.024,.012),'airpods_blue',.004)
    arch=[(.135*math.cos(math.pi*i/8),0,.25+.135*math.sin(math.pi*i/8)) for i in range(9)]
    curve('AirPods Max · stainless headband frame',arch,.008,'steel')
    curve('AirPods Max · knit canopy',[(px,0,pz-.012) for px,_,pz in arch],.022,'airpods_knit')
    built=set(bpy.context.scene.objects)-before
    lay_down(built,'X',-90)
    place(built,x,y,z,angle)


def watch_box(x,y,z,angle):
    """A six-watch box, 33 x 22cm: walnut, its glass-topped lid open on a
    back hinge, and six watches on cream suede cushions in two rows of
    three, each dial facing up and set to ten past ten."""
    from mathutils import Matrix
    before=set(bpy.context.scene.objects)
    P['watch_suede']=material('Watch box · cream suede lining',(.52,.45,.34),rough=.95)
    P['watch_glass']=glass_material('Watch box · lid glass',(.92,.95,.96),rough=.05)
    P['watch_crystal']=glass_material('Watch · sapphire crystal',rough=.02)
    W,D,H,t=.66,.44,.17,.02
    iw,id=W-2*t,D-2*t
    box('Watch box · walnut floor',(0,0,t/2),(W,D,t),'wood',.004)
    for s in (-1,1):
        box('Watch box · walnut end',(s*(W-t)/2,0,H/2),(t,D,H),'wood',.004)
        box('Watch box · walnut side',(0,s*(D-t)/2,H/2),(iw,t,H),'wood',.004)
        box('Watch box · compartment divider',(s*iw/6,0,t+.055),(.008,id,.11),'watch_suede',.002)
        rod('Watch box · brass hinge',(s*.20-.03,D/2,H),(s*.20+.03,D/2,H),.007,'brass')
    box('Watch box · suede floor',(0,0,t+.003),(iw,id,.006),'watch_suede',0)
    box('Watch box · compartment divider',(0,0,t+.055),(iw,.008,.11),'watch_suede',.002)
    box('Watch box · brass clasp',(0,-D/2-.003,H-.02),(.04,.006,.03),'brass',.002)
    # Dial colour, strap material; the back row first, left to right.
    watches=[((.012,.012,.014),'steel'),((.02,.06,.20),'leather'),((.80,.78,.72),'ink'),
             ((.03,.14,.08),'steel'),((.40,.42,.44),'leather'),((.012,.012,.014),'steel')]
    top=t+.006+.085
    for i,(dial,strap) in enumerate(watches):
        cx=(i%3-1)*iw/3;cy=id/4 if i<3 else -id/4
        box('Watch box · suede cushion',(cx,cy,t+.006+.0425),(.15,.12,.085),'watch_suede',.035)
        box('Watch · strap over the cushion',(cx,cy,top+.003),(.040,.125,.006),strap,.002)
        for s in (-1,1):box('Watch · strap down the cushion',(cx,cy+s*.063,top-.03),(.040,.006,.06),strap,.002)
        cz=top+.006+.011
        cylinder('Watch · steel case',(cx,cy,cz),.040,.022,'steel',32,bevel=.004)
        rod('Watch · crown',(cx+.039,cy,cz),(cx+.050,cy,cz),.006,'steel')
        P['watch_dial_'+str(i)]=material('Watch · dial '+str(i+1),dial,rough=.35)
        cylinder('Watch · dial',(cx,cy,cz+.0115),.033,.002,'watch_dial_'+str(i),32,bevel=0)
        hand='ink' if sum(dial)>1 else 'paper'
        for length,a in [(.022,math.radians(150)),(.029,math.radians(30))]:
            box('Watch · hand',(cx+math.cos(a)*length/2,cy+math.sin(a)*length/2,cz+.0130),(length,.003,.0008),hand,0,rot=a)
        cylinder('Watch · crystal',(cx,cy,cz+.0145),.035,.003,'watch_crystal',32,bevel=.001)
    # The lid, built closed about its hinge and then swung up past upright.
    lid_before=set(bpy.context.scene.objects)
    fw,lt=.04,.035
    box('Watch box · lid front rail',(0,-D+fw/2,lt/2),(W,fw,lt),'wood',.004)
    box('Watch box · lid back rail',(0,-fw/2,lt/2),(W,fw,lt),'wood',.004)
    for s in (-1,1):box('Watch box · lid side rail',(s*(W-fw)/2,-D/2,lt/2),(fw,D-2*fw,lt),'wood',.004)
    box('Watch box · lid glass',(0,-D/2,lt/2),(W-2*fw+.004,D-2*fw+.004,.004),'watch_glass',0)
    bpy.context.view_layer.update()
    hinge=Matrix.Translation(Vector((0,D/2,H)))@Matrix.Rotation(math.radians(-102),4,'X')
    for obj in set(bpy.context.scene.objects)-lid_before:obj.matrix_world=hinge@obj.matrix_world
    place(set(bpy.context.scene.objects)-before,x,y,z,angle)


def iced_latte(x,y,z):
    """An iced latte from Verve, the Santa Cruz roaster, in a clear glass:
    milk below, espresso settling through it above, ice, a straw, the VERVE
    mark printed on the glass, on a cork coaster."""
    P['latte_glass']=glass_material('Iced latte · glass',rough=.03)
    P['latte_ice']=glass_material('Iced latte · ice',(.95,.97,1),rough=.12,transmission=.92)
    P['latte_milk']=material('Iced latte · milk',(.83,.76,.64),rough=.3)
    P['latte_blend']=material('Iced latte · milky espresso',(.58,.40,.24),rough=.3)
    P['latte_espresso']=material('Iced latte · espresso',(.30,.16,.07),rough=.3)
    P['cork']=textured('Coaster · cork',(.42,.28,.15),(.55,.39,.22),'fabric',rough=.95)
    cylinder('Coaster · cork',(x,y,z+.004),.10,.008,'cork',40,bevel=.002)
    r=.070;h=.30;base=z+.008
    cylinder('Iced latte · glass',(x,y,base+h/2),r,h,'latte_glass',48,top=r*1.08,bevel=.003)
    for name,mat,z0,z1,rr in [('milk','latte_milk',.012,.15,.064),('milky espresso','latte_blend',.15,.185,.066),('espresso','latte_espresso',.185,.235,.067)]:
        cylinder('Iced latte · '+name,(x,y,base+(z0+z1)/2),rr,z1-z0,mat,40,top=rr*1.01,bevel=0)
    rng=random.Random(41)
    for k in range(5):
        cube=box('Iced latte · ice',(x+rng.uniform(-.03,.03),y+rng.uniform(-.03,.03),base+.215+k*.012),(.042,.042,.038),'latte_ice',.006)
        cube.rotation_euler=(rng.uniform(0,1),rng.uniform(0,1),rng.uniform(0,3))
    rod('Iced latte · straw',(x+.02,y+.01,base+.05),(x+.05,y+.03,base+.40),.0075,'ink',12)
    lettering('Iced latte · VERVE mark','VERVE',(x,y-r*1.05-.002,base+.24),.030,'paper')


def omega_wall_clock(x,y,z,r=.235):
    """A navy Seamaster Aqua Terra dial, adapted as the study's wall clock.

    Smooth steel bezel, horizontal teak grooves and faceted wedge indexes.
    The wall-clock adaptation keeps all twelve hour markers in place of the
    watch's date aperture. The browser supplies live luminous arrow hands,
    using the same dial plane during the 3D camera flight.
    """
    k=r/.235
    P['omega_steel']=material('Omega clock · brushed steel',(.62,.65,.68),metal=1,rough=.28)
    P['omega_polished']=material('Omega clock · polished rhodium',(.80,.84,.88),metal=.85,rough=.18)
    # The face occupies only a few dozen screen pixels. Softer metal and a
    # low, constant dial glow keep its navy colour and lettering legible in
    # both room-light states instead of reflecting the dark sky as black.
    P['omega_dial']=material('Omega clock · navy Aqua Terra dial',(.035,.110,.260),metal=.12,rough=.42,emission=.35)
    P['omega_groove']=material('Omega clock · dark teak channels',(.012,.035,.075),metal=.12,rough=.45,emission=.20)
    P['omega_ridge']=material('Omega clock · blue teak edges',(.060,.150,.310),metal=.18,rough=.38,emission=.30)
    P['omega_print']=material('Omega clock · white dial printing',(.91,.92,.88),rough=.6,emission=.35)
    P['omega_lume']=material('Omega clock · ivory index lume',(.68,.91,.79),rough=.6,emission=.25)
    def at(u,v,depth=0):return (x+u*k,y+depth*k,z+v*k)
    def disc(name,u,v,radius,depth,thickness,mat):
        obj=cylinder('Omega clock · '+name,at(u,v,depth),radius*k,thickness*k,mat,96,bevel=.001*k)
        obj.rotation_euler.x=math.pi/2
        return obj
    def ring(name,u,v,radius,depth,thickness,mat):
        return torus('Omega clock · '+name,at(u,v,depth),radius*k,thickness*k,mat,(math.pi/2,0,0))
    def mark(name,u,v,angle,inner,outer,width,depth=-.047):
        a=math.radians(angle)
        return rod('Omega clock · '+name,at(u+math.sin(a)*inner,v+math.cos(a)*inner,depth),
                   at(u+math.sin(a)*outer,v+math.cos(a)*outer,depth),width*k,'omega_print',8)
    disc('steel case',0,0,.235,0,.064,'omega_steel')
    disc('smooth steel bezel',0,0,.226,-.034,.010,'omega_polished')
    ring('polished outer lip',0,0,.226,-.037,.004,'omega_polished')
    disc('navy teak dial',0,0,.204,-.041,.008,'omega_dial')
    ring('inner bezel edge',0,0,.205,-.045,.002,'omega_steel')
    # Fine horizontal grooves, clipped to the circular dial. Real geometry
    # carries the same texture into the stills and the baked flight model.
    for row in range(-11,12):
        v=row*.017
        half=math.sqrt(.201**2-v*v)
        box('Omega clock · teak channel',at(0,v,-.0454),(half*2*k,.0008*k,.0017*k),'omega_groove',0)
        box('Omega clock · teak glint',at(0,v+.0015,-.0455),(half*2*k,.0006*k,.0006*k),'omega_ridge',0)
    for i in range(60):
        mark('minute track',0,0,i*6,.186 if i%5==0 else .191,.197,.00065)
    # Each applied index has two polished facets and a narrow luminous inset.
    # The point faces the centre, as on the Aqua Terra's sail-shaped indexes.
    for hour in range(12):
        a=math.radians(hour*30)
        def index_at(u,v,depth):
            return at(u*math.cos(a)+v*math.sin(a),v*math.cos(a)-u*math.sin(a),depth)
        w=.0095 if hour==0 else .0075
        verts=[index_at(-w,.183,-.048),index_at(w,.183,-.048),
               index_at(0,.139,-.048),index_at(0,.183,-.052)]
        mesh('Omega clock · faceted hour index',verts,[(0,2,3),(3,2,1),(0,3,1)],'omega_polished')
        mesh('Omega clock · index lume',
             [index_at(-w*.36,.179,-.0522),index_at(w*.36,.179,-.0522),index_at(0,.151,-.0522)],
             [(0,2,1)],'omega_lume')
    # Draw the Omega symbol explicitly so it does not depend on font coverage.
    logo=[(-.022,.090),(-.010,.090)]
    logo += [(.017*math.cos(a),.103+.017*math.sin(a))
             for a in [math.radians(225-i*270/32) for i in range(33)]]
    logo += [(.010,.090),(.022,.090)]
    curve('Omega clock · Omega symbol',[at(u,v,-.049) for u,v in logo],.0019*k,'omega_print')
    lettering('Omega clock · OMEGA wordmark','OMEGA',at(0,.073,-.049),.026*k,'omega_print')
    model=lettering('Omega clock · Seamaster signature','Seamaster',at(0,.049,-.049),.018*k,'omega_print')
    model.data.shear=.22
    lettering('Omega clock · AQUA TERRA','AQUA TERRA',at(0,.030,-.049),.009*k,'omega_print')
    for body,v in [('CO-AXIAL',-.066),('MASTER CHRONOMETER',-.080),('150m / 500ft',-.094)]:
        lettering('Omega clock · '+body,body,at(0,v,-.049),.008*k,'omega_print')
    # No fixed hands are baked into the dial: they would show through the
    # live ones whenever the time changes. This anchor uses the same plane
    # for the browser's projected hands and its full 3D flight hands.
    clock=bpy.data.objects.new('Omega clock · live hands',None)
    bpy.context.collection.objects.link(clock)
    clock.location=at(0,0,-.060)
    clock['radius']=.204*k


def writing():
    foundation(73,'garden');landscape('writing',73);floorboards()
    # A cutaway corner of a proper study-office: painted plaster above, green
    # panelled wainscot below, a chair rail and crown moulding, cut like a
    # doll's house so the window and shelves are set into real walls.
    P['officewall']=textured('Study · eggshell paint',(.47,.44,.38),(.55,.52,.45),'plaster',rough=.7)
    P['wainscot']=textured('Study · painted panelling',(.040,.075,.060),(.065,.105,.085),'plaster',rough=.55)
    top=3.42;rail=1.24
    def wall(name,x0,x1,z0,z1):
        box(name,((x0+x1)/2,1.98,(z0+z1)/2),(x1-x0,.12,z1-z0),'officewall',.004)
    wall('Study · back wall',-3.25,-2.79,rail,top)
    wall('Study · back wall',-1.13,2.89,rail,top)
    wall('Study · wall under the window',-2.79,-1.13,rail,1.32)
    wall('Study · wall over the window',-2.79,-1.13,2.90,top)
    box('Study · side wall',(-3.19,.93,(top+rail)/2),(.12,2.22,top-rail),'officewall',.004)
    box('Study · back wainscot',(-.18,1.98,(rail+.16)/2),(6.14,.13,rail-.16),'wainscot',.004)
    box('Study · side wainscot',(-3.19,.93,(rail+.16)/2),(.13,2.22,rail-.16),'wainscot',.004)
    # Raised panels, a chair rail, crown moulding and skirting, all square.
    x=-3.10
    while x<2.70:
        for (z0,z1) in [(.34,1.10)]:
            for a,b in [((x,z0),(x+.62,z0)),((x,z1),(x+.62,z1)),((x,z0),(x,z1)),((x+.62,z0),(x+.62,z1))]:
                box('Wainscot · panel moulding',((a[0]+b[0])/2,1.912,(a[1]+b[1])/2),(abs(b[0]-a[0])+.022,.016,abs(b[1]-a[1])+.022),'wainscot',.003)
        x+=.74
    for y0 in [.0,.74,1.48]:
        for a,b in [((y0,.34),(y0+.5,.34)),((y0,1.10),(y0+.5,1.10)),((y0,.34),(y0,1.10)),((y0+.5,.34),(y0+.5,1.10))]:
            box('Wainscot · panel moulding',(-3.122,(a[0]+b[0])/2,(a[1]+b[1])/2),(.016,abs(b[0]-a[0])+.022,abs(b[1]-a[1])+.022),'wainscot',.003)
    box('Study · chair rail',(-.18,1.905,rail),(6.14,.04,.05),'oak',.004)
    box('Study · side chair rail',(-3.115,.93,rail),(.04,2.22,.05),'oak',.004)
    box('Study · crown moulding',(-.18,1.90,top-.05),(6.14,.06,.08),'paper',.006)
    box('Study · side crown moulding',(-3.11,.93,top-.05),(.06,2.22,.08),'paper',.006)
    box('Study · back wall top',(-.18,1.98,top+.015),(6.20,.14,.03),'paper',.004)
    box('Study · side wall top',(-3.19,.93,top+.015),(.14,2.26,.03),'paper',.004)
    box('Study · skirting',(-.18,1.905,.22),(6.1,.03,.10),'oak',.002)
    # Carter studied at UC Santa Cruz: his degree, framed above the desk.
    # It hangs on the side wall, facing into the room.
    dy,dz=.62,2.18
    box('Diploma · walnut frame',(-3.115,dy,dz),(.03,.66,.50),'wood',.006)
    box('Diploma · mat',(-3.098,dy,dz),(.006,.58,.42),'paper',.001)
    box('Diploma · certificate',(-3.094,dy,dz),(.004,.44,.30),'page',.001)
    cylinder('Diploma · gold seal',(-3.090,dy+.15,dz-.09),.035,.004,'brass',24,bevel=0).rotation_euler.y=math.pi/2
    for k in range(4):box('Diploma · printed line',(-3.091,dy-.03,dz+.09-k*.045),(.002,.26-k*.035,.008),'ink',0)
    # The window is clear glass: the night outside is the site's own galaxy,
    # seen through the panes (the render is transparent beyond the wall).
    P['clearwindow']=material('Window · clear glass',(.9,.95,1),rough=.04)
    P['clearwindow'].node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.03
    box('Study · window glass',(-1.96,1.985,2.11),(1.66,.011,1.58),'clearwindow',.001)
    # Linen drapes on a brass rod frame the window.
    rod('Window · curtain rod',(-3.02,1.86,3.02),(-.90,1.86,3.02),.012,'brass',12)
    for x0 in [-3.00,-1.24]:
        verts=[];faces=[];cols=14
        for c in range(cols+1):
            xx=x0+.30*c/cols;yy=1.84-.03*math.sin(c/cols*math.pi*4)
            verts+= [(xx,yy,1.28),(xx,yy,3.0)]
        for c in range(cols):faces.append((c*2,c*2+2,c*2+3,c*2+1))
        drape=mesh('Window · linen drape',verts,faces,'linen')
        for f in drape.data.polygons:f.use_smooth=True
        drape.modifiers.new('Cloth thickness','SOLIDIFY').thickness=.008
    # Carter's Omega wall clock sits between the shelves and crown moulding.
    omega_wall_clock(1.0,1.87,3.09)
    box('Window · central mullion',(-1.96,1.95,2.11),(.026,.05,1.58),'teal',.002)
    for zz in [1.33,2.11,2.89]:box('Window · horizontal rail',(-1.96,1.95,zz),(1.66,.05,.027),'teal',.002)
    for xx in [-2.79,-1.13]:box('Window · reveal',(xx,1.95,2.11),(.03,.06,1.58),'teal',.002)
    box('Window · oak sill',(-1.96,1.84,1.30),(1.89,.24,.05),'oak',.003)
    # A modern bookshelf: walnut shelves on a slim black steel frame over a
    # dark back panel, each shelf washed from above by a warm LED strip.
    rng=random.Random(940)
    P['shelf_panel']=material('Bookshelf · charcoal back panel',(.028,.028,.032),rough=.8)
    P['led_strip']=material('Bookshelf · LED strip',(1,.74,.48),emission=9)
    box('Bookshelf · back panel',(1,1.885,1.50),(3.20,.02,2.62),'shelf_panel',.002)
    for x in [-.58,1.0,2.58]:box('Study · bookcase upright',(x,1.62,1.49),(.03,.50,2.60),'ink',.002)
    for z in [.20,1.04,1.90,2.80]:
        box('Study · bookcase shelf',(1,1.60,z),(3.22,.55,.045),'wood',.002)
        if z>.5:
            # The strip sits under the front lip of the shelf above the books.
            box('Bookshelf · LED strip',(1,1.37,z-.026),(3.10,.016,.006),'led_strip',0)
            for bx in [.21,1.79]:light('Bookshelf · LED wash',(bx,1.55,z-.05),(1,.74,.48),7,.05,(bx,1.62,z-.6))
        if z>2.7:continue
        for start,end in [(-.53,.90),(1.08,2.53)]:
            x=start
            while x<end-.15:
                if rng.random()<.16:x+=.30;continue
                w=rng.uniform(.048,.11);h=rng.uniform(.36,.55)
                created=capture(shelf_book,x+w/2,1.59,z+.022,w,h,rng.choice(['linen','leather','redcloth','teal','oak']))
                # One offset for the entire binding: covers, spine, tooling
                # and page block must stay aligned as a single rigid book.
                offset=rng.uniform(-.035,.035) if refined('writing','bookshelves') else rng.uniform(-.008,.008)
                for obj in created:obj.location.y+=offset
                if refined('writing','bookshelves'):
                    from mathutils import Matrix
                    lean=rng.choice([0,0,-.065,.045])
                    pivot=Vector((x+w/2,1.59,z+.022))
                    turn=Matrix.Translation(pivot)@Matrix.Rotation(lean,4,'Y')@Matrix.Translation(-pivot)
                    bpy.context.view_layer.update()
                    for obj in created:obj.matrix_world=turn@obj.matrix_world
                x+=w+.011
    # Carter asked for LED strips behind the bookshelf: a warm strip runs round
    # the back of the case, in the gap between its back panel and the wall,
    # and its light spills out past the edges so the wall glows in a soft halo
    # around the case. Named for the bookshelf, it follows the shelves' switch.
    P['backlight']=material('Bookshelf · backlight strip',(1,.70,.42),emission=12)
    gap=1.906
    box('Bookshelf · backlight strip',(1,gap,2.78),(3.10,.006,.012),'backlight',0)
    for x in [-.57,2.57]:box('Bookshelf · backlight strip',(x,gap,1.52),(.012,.006,2.50),'backlight',0)
    for x in [-.40,.20,.80,1.40,2.00,2.45]:light('Bookshelf · backlight',(x,gap,2.77),(1,.70,.42),12,.012)
    for x in [-.565,2.565]:
        for z in [.62,1.42,1.95,2.45]:light('Bookshelf · backlight',(x,gap,z),(1,.70,.42),12,.012)
    # These are Carter's published essays, presented as bound journals—not
    # invented reading-list entries. Their existing covers are used verbatim.
    journals=[('the-cost-of-keeping-up','The Cost of Keeping Up',-.24),('slop-and-spiral','Slop and Spiral',.47),('we-all-have-superpowers','We All Have Superpowers',1.42)]
    for slug,title,x in journals:
        box('Journal · '+title,(x,1.29,2.20),(.46,.065,.58),'linen',.006)
        image_panel('Journal cover · '+title,'essay-covers/'+slug+'.webp',(x,1.252,2.20),.44,.56)
        box('Journal · title label',(x,1.244,1.999),(.42,.008,.11),'paper',.001)
        lettering('Journal title · '+title,title,(x,1.236,2.0),.025,'ink')
    # A lava lamp on the top shelf, and at its other end a faux snake plant
    # (Carter asked for a fake plant on the shelf). The lamp stands just right
    # of the clock: any farther right and the maple's branch hides it.
    lava_lamp(1.62,1.56,2.8225,1.3)
    faux_snake_plant(.20,1.58,2.8225,1.1)
    # In Common With's Up Down Sconce on the strip of wall between the window
    # and the bookcase: one beam up the wall, one down to the desk.
    up_down_sconce(-.86,1.92,2.48,110)
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
    # In Common With's Arundel Table Lamp at the back left of the desk: its
    # pool of light, leaning toward the notebook, lights the desk and the
    # open pages.
    practical=arundel_table_lamp(-1.22,-.20,1.614,420,toward=(-.22,-.70) if refined('writing','notebook_focus') else (-.55,-.62))
    for f,e in [(1,420),(25,445),(49,420)]:practical.data.energy=e;practical.data.keyframe_insert(data_path='energy',frame=f)
    ANIMATED.append(practical)
    capture(book_stack,0,0,0,scale=(.52,.52,.52),offset=(1.40,.0,1.614) if refined('writing','desk_spacing') else (1.21,-.13,1.614))
    # An iced latte and capped fountain pen beside the notebook.
    iced_latte(-.70,-.30,1.61)
    # A capped fountain pen beside the notebook: black lacquer, gold band and clip.
    a,b=Vector((.84,-1.20,1.628)),Vector((.79,-.82,1.628))
    rod('Fountain pen · black lacquer barrel',tuple(a),tuple(b),.016,'ink',24)
    cap=a+(b-a)*.58
    rod('Fountain pen · gold cap band',tuple(cap),tuple(cap+(b-a).normalized()*.018),.0172,'brass',24)
    rod('Fountain pen · gold clip',tuple(cap+(b-a).normalized()*.03+Vector((0,0,.016))),tuple(b-(b-a).normalized()*.03+Vector((0,0,.016))),.004,'brass',8)
    for end in [a,b]:sphere('Fountain pen · rounded end',tuple(end),(.016,.016,.016),'ink',2)
    # Thin correspondence, with a restrained looping lifted corner.
    for j in range(3):
        vs=[]
        for row in range(2):
            for k in range(17):
                xx=(1.13 if refined('writing','desk_spacing') else .91)+k*.032;yy=(-.62 if refined('writing','desk_spacing') else -.80)+row*.44;zz=1.617+j*.002+.025*(k/16)**6
                vs.append((xx,yy,zz))
        leaf=mesh('Study · loose draft',vs,[(k,k+1,k+18,k+17) for k in range(16)],'paper')
        for face in leaf.data.polygons:face.use_smooth=True
        for f,dz in [(1,0),(25,.006+j*.002),(49,0)]:leaf.location.z=dz;leaf.keyframe_insert(data_path='location',frame=f)
        ANIMATED.append(leaf)
    # The chair is pulled up to the open notebook, where you'd sit to write.
    chair(.16,-2.0)
    turn_group('Study · gently turned desk',set(bpy.context.scene.objects)-furniture,10,(.1,-.7,0),['spread','page','landmark','lamp'])
    # A reading spot on the right, under the maple. A level stone landing
    # supports both bases, with a short approach from the study's floor.
    for row in range(5):
        for col in range(3):
            box('Reading garden · limestone paver',(3.20+col*.49,-1.44+row*.48,.10),(.475,.465,.096),'stone',.012)
    eames_lounge_chair(3.68,.02,-15,.85)
    reading_maple(3.78,1.55)
    plant(-2.72,-.92,.15,1.06)
    # A woven rug grounds the chair and desk without adding another plinth.
    woven_rug()


def hammer(x,y,z):
    rod('Hammer · hickory handle',(x,y,z),(x,y,z+.52),.023,'oak',24)
    cylinder('Hammer · grip end',(x,y,z+.055),.026,.11,'leather',32,bevel=.003)
    box('Hammer · forged head',(x,y,z+.53),(.22,.073,.078),'steel',.01)
    rod('Hammer · striking face',(x-.10,y,z+.53),(x-.15,y,z+.53),.044,'steel',24)
    curve('Hammer · claw',[(x+.10,y,z+.53),(x+.18,y,z+.50),(x+.21,y,z+.46)],.018,'steel')


def ninebot_scooter(x,y,angle):
    """A Segway-Ninebot MAX electric kick scooter on its kickstand: 10-inch
    pneumatic tyres (a hub motor in the front), a long low deck with black
    grip, the raked folding stem with its dashboard display and headlight, a
    rear mudguard with a red brake light. Scene scale is 2 units a metre.
    Built with its tyres touching z=0, then pitched so both tyres sit on the
    ground where it stands and leaned a few degrees onto the kickstand."""
    from mathutils import Matrix
    before=set(bpy.context.scene.objects)
    P.setdefault('scooter',material('Scooter · dark grey aluminium',(.055,.058,.062),metal=.45,rough=.38))
    P.setdefault('scooter_red',material('Scooter · red brake light',(.7,.02,.02),rough=.3,emission=1.5))
    P.setdefault('scooter_amber',material('Scooter · amber side reflector',(.9,.5,.05),rough=.3))
    r=.255;wb=1.66
    rear=Vector((-wb/2,0,r));front=Vector((wb/2,0,r))
    for c,hub in [(rear,.10),(front,.15)]:
        torus('Scooter · pneumatic tyre',tuple(c),r-.055,.055,'ink',(math.pi/2,0,0))
        cylinder('Scooter · wheel hub',tuple(c),hub,.10,'scooter',32,bevel=.006).rotation_euler.x=math.pi/2
    # The deck: long and low, black grip tape on top, a light lip round it.
    box('Scooter · deck',(-.06,0,.36),(1.10,.38,.11),'scooter',.03)
    box('Scooter · grip tape',(-.08,0,.418),(.98,.32,.006),'ink',.002)
    # Rear: a short swingarm to the axle, the mudguard and its brake light.
    for side in [-1,1]:
        rod('Scooter · rear bracket',(-.58,side*.07,.34),tuple(rear+Vector((0,side*.07,0))),.022,'scooter',12)
    curve('Scooter · rear mudguard',[tuple(rear+Vector((math.cos(a)*(r+.04),0,math.sin(a)*(r+.04)))) for a in [.25*math.pi,.55*math.pi,.92*math.pi]],.05,'ink')
    box('Scooter · brake light',tuple(rear+Vector((-.27,0,.08))),(.03,.10,.035),'scooter_red',.006)
    # The stem rakes back from the front axle: the fork, the folding joint
    # where the deck meets it, the tall stem, the dashboard and the bars.
    tilt=math.radians(13);up=Vector((-math.sin(tilt),0,math.cos(tilt)))
    neck=front+up*.42;top=front+up*2.15
    for side in [-1,1]:rod('Scooter · front fork',tuple(front+Vector((0,side*.075,0))),tuple(neck+Vector((0,side*.05,0))),.024,'scooter',12)
    box('Scooter · folding joint',tuple(neck+Vector((-.10,0,-.02))),(.26,.13,.16),'scooter',.03)
    rod('Scooter · stem',tuple(neck),tuple(top),.046,'scooter',24)
    for side in [-1,1]:box('Scooter · side reflector',tuple(front+up*.24+Vector((0,side*.08,0))),(.08,.008,.03),'scooter_amber',.002)
    box('Scooter · headlight',tuple(top+up*-.10+Vector((.045,0,0))),(.02,.07,.035),'light',.006)
    dash=box('Scooter · dashboard',tuple(top+Vector((-.01,0,.03))),(.14,.12,.04),'ink',.012);dash.rotation_euler.y=-.35
    screen=box('Scooter · dashboard display',tuple(top+Vector((-.02,0,.053))),(.06,.07,.004),'screen',.001);screen.rotation_euler.y=-.35
    rod('Scooter · handlebar',tuple(top+Vector((0,-.25,.02))),tuple(top+Vector((0,.25,.02))),.02,'scooter',16)
    for side in [-1,1]:
        rod('Scooter · grip',tuple(top+Vector((0,side*.25,.02))),tuple(top+Vector((0,side*.15,.02))),.03,'ink',16)
        rod('Scooter · brake lever',tuple(top+Vector((.03,side*.13,.03))),tuple(top+Vector((.07,side*.21,.0))),.008,'ink',8)
    # The kickstand reaches the ground on the side the scooter leans toward (-y).
    rod('Scooter · kickstand',(-.10,-.17,.31),(-.32,-.27,.02),.014,'ink',8)
    parts=set(bpy.context.scene.objects)-before
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    ground=bpy.data.objects['Island · eroded basalt escarpment']
    tree=BVHTree.FromObject(ground,bpy.context.evaluated_depsgraph_get())
    inv=ground.matrix_world.inverted()
    def height(dx):
        px=x+math.cos(angle)*dx;py=y+math.sin(angle)*dx
        hit=tree.ray_cast(inv@Vector((px,py,10)),Vector((0,0,-1)))[0]
        z=(ground.matrix_world@hit).z if hit is not None else .12
        # A tyre over the workshop deck rests on its boards (top at .151).
        if -3.3<px<3.3 and -2.05<py<1.75:z=max(z,.151)
        return z
    h_rear,h_front=height(-wb/2),height(wb/2)
    pitch=-math.atan2(h_front-h_rear,wb)
    pose=Matrix.Translation(Vector((x,y,(h_rear+h_front)/2)))@Matrix.Rotation(angle,4,'Z')@Matrix.Rotation(math.radians(4),4,'X')@Matrix.Rotation(pitch,4,'Y')
    for obj in parts:obj.matrix_world=pose@obj.matrix_world
    print(f'SCOOTER: rear ground {h_rear:.3f}, front ground {h_front:.3f}, pitch {math.degrees(pitch):.1f} deg',flush=True)


def kobe_jersey(cx,y,cz):
    """Back of Kobe's 2009–10 gold home jersey, as shown by the NBA Store:
    purple BRYANT with white edging, white varsity 24 outlined in purple,
    broad shoulders, a shallow back collar, and purple side panels."""
    P['jersey_gold']=textured('Jersey · Lakers gold mesh',(.85,.40,.008),(1,.61,.025),'fabric',rough=.8)
    P['jersey_purple']=material('Jersey · Lakers purple',(.09,.018,.23),rough=.6)
    P['jersey_white']=material('Jersey · white piping',(.86,.86,.84),rough=.6)
    P['frame_black']=material('Shadow box · black frame',(.015,.015,.017),rough=.35)
    P['frame_back']=material('Shadow box · charcoal backing',(.035,.035,.04),rough=.95)
    fw,fh=.76,1.00
    box('Shadow box · backing',(cx,y+.012,cz),(fw,.008,fh),'frame_back',.002)
    for dx,dz,w,h in [(0,fh/2,fw+.06,.05),(0,-fh/2,fw+.06,.05),(-fw/2,0,.05,fh+.06),(fw/2,0,.05,fh+.06)]:
        box('Shadow box · frame rail',(cx+dx,y-.005,cz+dz),(w,.045,h),'frame_black',.004)
    # The jersey's outline, from the hem up the side, round the armhole, over
    # the strap, down into the neck and back out (u across, v up).
    W,H=.29,.78;bottom=cz-.39
    half=[(1,0),(.96,.58),(.84,.67),(.73,.82),(.68,1.0),(.35,1.0),(.25,.96),(0,.94)]
    outline=half+[(-u,v) for u,v in reversed(half[:-1])]
    at=lambda u,v,dy=0:(cx+u*W,y-.004+dy,bottom+v*H)
    body=mesh('Jersey · gold body',[at(u,v) for u,v in outline],[tuple(range(len(outline)))],'jersey_gold')
    # Purple trim with white piping round the neck and both armholes.
    neck=[(.35,1.0),(.25,.96),(0,.94),(-.25,.96),(-.35,1.0)]
    curve('Jersey · purple back collar',[at(u,v,-.003) for u,v in neck],.009,'jersey_purple')
    for side in [-1,1]:
        arm=[(.96,.58),(.84,.67),(.73,.82),(.68,1.0)]
        curve('Jersey · purple armhole trim',[at(side*u,v,-.003) for u,v in arm],.010,'jersey_purple')
        mesh('Jersey · purple side panel',[at(side*u,v,-.003) for u,v in [(1,0),(.96,.58),(.81,.59),(.85,0)]],[(0,1,2,3)],'jersey_purple')
        curve('Jersey · white side piping',[at(side*.85,.01,-.005),at(side*.81,.59,-.005)],.004,'jersey_white')
    curve('Jersey · stitched hem',[at(-.98,.025,-.002),at(0,.02,-.002),at(.98,.025,-.002)],.0015,'jersey_gold')
    font=None
    for path in ['/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf','/System/Library/Fonts/Supplemental/Impact.ttf']:
        try:font=bpy.data.fonts.load(path,check_existing=True);break
        except Exception:pass
    def glyph(name,text,loc,size,mat,tilt=0,outline=0):
        data=bpy.data.curves.new(name,'FONT');data.body=text;data.size=size;data.extrude=.0012
        data.align_x='CENTER';data.align_y='CENTER'
        if font:data.font=font
        if outline:data.offset=outline
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
        obj.location=loc;obj.rotation_euler=(math.pi/2,tilt,0);data.materials.append(P[mat])
        return obj
    # The name is upright varsity lettering, arched across the shoulders.
    word='BRYANT';radius=.58;step=.103
    for k,ch in enumerate(word):
        th=(k-(len(word)-1)/2)*step
        u=math.sin(th)*radius/W;v=.79+(math.cos(th)-1)*radius/H
        glyph('Jersey · BRYANT letter',ch,at(u,v,-.010),.127,'jersey_purple',th)
        glyph('Jersey · BRYANT outline',ch,at(u,v,-.007),.127,'jersey_white',th,.003)
    # Model the angular varsity digits directly instead of substituting a
    # rounded system font; the 2009–10 number is white inside a purple border.
    digits=[
        [[(0,.75),(.18,.75),(.18,.82),(.40,.82),(.46,.76),(.46,.65),(0,.18),(0,0),(.66,0),(.66,.18),(.25,.18),(.66,.60),(.66,.87),(.53,1),(.12,1),(0,.88)]],
        [[(0,.36),(.40,1),(.61,1),(.61,.33),(.70,.33),(.70,.16),(.61,.16),(.61,0),(.42,0),(.42,.16),(0,.16)],
         [(.19,.33),(.42,.33),(.42,.70)]],
    ]
    scale=.27
    for digit,contours in enumerate(digits):
        for mat,dy,offset in [('jersey_purple',-.007,.008),('jersey_white',-.011,0)]:
            data=bpy.data.curves.new('Jersey · varsity '+str(2 if digit==0 else 4),'CURVE')
            data.dimensions='2D';data.fill_mode='BOTH';data.extrude=.0005;data.offset=offset
            for i,points in enumerate(contours):
                area=sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(points,points[1:]+points[:1]))
                if (area>0)!=(i==0):points=list(reversed(points))
                spline=data.splines.new('POLY');spline.points.add(len(points)-1)
                for p,(u,v) in zip(spline.points,points):p.co=(u*scale,v*scale,0,1)
                spline.use_cyclic_u=True
            obj=bpy.data.objects.new('Jersey · '+mat+' number '+str(2 if digit==0 else 4),data)
            bpy.context.collection.objects.link(obj);data.materials.append(P[mat])
            obj.location=(cx-.197+digit*.205,y-.004+dy,bottom+.29*H)
            obj.rotation_euler.x=math.pi/2
    # A small museum label identifies the framed shirt even at closer views.
    box('Shadow box · Kobe nameplate',(cx,y-.014,cz-fh/2+.045),(.37,.008,.040),'brass',.002)
    lettering('Shadow box · Kobe Bryant label','KOBE BRYANT',(cx,y-.020,cz-fh/2+.045),.026,'ink',(math.pi/2,0,0))
    light('Shadow box · display light',(cx,y-.45,cz+.55),(1,.86,.66),4,.2,(cx,y,cz))


def wilson_evolution(x,y,z,r=.24):
    """Orange/black Evolution game ball with curved, modelled print.
    The official Wilson wordmark is converted from its source SVG contours;
    every marking follows the sphere, including in the baked flight mesh."""
    import bmesh
    import re
    import xml.etree.ElementTree as ET
    from mathutils import Matrix
    before=set(bpy.context.scene.objects)
    leather=material('Wilson Evolution · microfiber composite',(.65,.17,.024),rough=.76)
    nodes,links=leather.node_tree.nodes,leather.node_tree.links
    bs=nodes.get('Principled BSDF')
    coord=nodes.new('ShaderNodeTexCoord')
    pebbles=nodes.new('ShaderNodeTexVoronoi');pebbles.inputs['Scale'].default_value=110/(2*r)
    pebbles.inputs['Randomness'].default_value=.72
    links.new(coord.outputs['Object'],pebbles.inputs['Vector'])
    relief=nodes.new('ShaderNodeValToRGB')
    relief.color_ramp.elements[0].position=.16;relief.color_ramp.elements[0].color=(1,1,1,1)
    relief.color_ramp.elements[1].position=.58;relief.color_ramp.elements[1].color=(0,0,0,1)
    links.new(pebbles.outputs['Distance'],relief.inputs[0])
    color=nodes.new('ShaderNodeMixRGB');color.blend_type='MIX'
    color.inputs[1].default_value=(.43,.105,.012,1)
    color.inputs[2].default_value=(.60,.16,.021,1)
    links.new(relief.outputs[0],color.inputs[0]);links.new(color.outputs[0],bs.inputs['Base Color'])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.48
    bump.inputs['Distance'].default_value=.0005
    links.new(relief.outputs[0],bump.inputs['Height']);links.new(bump.outputs[0],bs.inputs['Normal'])
    P['evolution_cover']=leather
    ink=leather.copy();ink.name='Wilson Evolution · pebbled black print and channels'
    ink_bs=ink.node_tree.nodes.get('Principled BSDF')
    for link in list(ink_bs.inputs['Base Color'].links):ink.node_tree.links.remove(link)
    ink_bs.inputs['Base Color'].default_value=(.008,.009,.009,1)
    P['evolution_black']=ink
    P['evolution_outline']=material('Wilson Evolution · warm ivory logo edge',(.82,.76,.58),rough=.8)
    ball=sphere('Basketball · Wilson Evolution',(0,0,0),(r,r,r),'evolution_cover',5)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for face in ball.data.polygons:face.use_smooth=True
    # Flush spherical ribbons form the eight panels; the two bowed channels
    # frame the front branding instead of crossing through the wordmark.
    for angle in (0,math.pi/2,.78,-.78):
        verts=[];faces=[];steps=192;half_width=.014
        tangent=Vector((0,math.cos(angle),math.sin(angle)))
        normal=Vector((0,-math.sin(angle),math.cos(angle)))
        for i in range(steps):
            a=i*math.tau/steps
            radial=Vector((math.cos(a),0,0))+tangent*math.sin(a)
            for side in (-1,1):
                verts.append(tuple((radial*math.cos(half_width)+normal*side*math.sin(half_width))*(r+.0003)))
        for i in range(steps):
            a=i*2;b=((i+1)%steps)*2;faces.append((a,b,b+1,a+1))
        channel=mesh('Basketball · Evolution pebbled channel',verts,faces,'evolution_black')
        for face in channel.data.polygons:face.use_smooth=True
    def wrap(obj,radius):
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.convert(target='MESH')
        obj=bpy.context.object
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        topology=bmesh.new();topology.from_mesh(obj.data)
        bmesh.ops.triangulate(topology,faces=list(topology.faces))
        for _ in range(8):
            edges=[edge for edge in topology.edges if edge.calc_length()>r*.025]
            if not edges:break
            bmesh.ops.subdivide_edges(topology,edges=edges,cuts=1,use_grid_fill=True)
            bmesh.ops.triangulate(topology,faces=list(topology.faces))
        topology.to_mesh(obj.data);topology.free()
        for vertex in obj.data.vertices:
            u,v=vertex.co.x,vertex.co.y
            vertex.co=(u,-math.sqrt(max(0,radius*radius-u*u-v*v)),v)
        for face in obj.data.polygons:face.use_smooth=True
    # This SVG uses absolute M/C/H/V/Z commands. Sample its cubic contours
    # into filled 2D curves so letter counters and the script stay intact.
    path=ET.parse(ROOT/'artwork/blender/wilson-logo.svg').getroot().find('{http://www.w3.org/2000/svg}path').attrib['d']
    tokens=re.findall(r'[A-Za-z]|-?\d+(?:\.\d+)?',path)
    contours=[];points=[];i=0;command=None;at=Vector((0.,0.))
    while i<len(tokens):
        if tokens[i].isalpha():
            command=tokens[i];i+=1
            if command=='Z':
                contours.append(points);points=[];continue
        count={'M':2,'C':6,'H':1,'V':1}[command]
        values=list(map(float,tokens[i:i+count]));i+=count
        if command=='M':
            at=Vector(values);points.append(at.copy())
        elif command=='C':
            p1,p2,end=Vector(values[:2]),Vector(values[2:4]),Vector(values[4:])
            for j in range(1,9):
                t=j/8
                points.append((1-t)**3*at+3*(1-t)**2*t*p1+3*(1-t)*t*t*p2+t**3*end)
            at=end
        else:
            at=Vector((values[0],at.y) if command=='H' else (at.x,values[0]))
            points.append(at.copy())
    width=r*1.37
    data=bpy.data.curves.new('Wilson · official script contours','CURVE')
    data.dimensions='2D';data.fill_mode='BOTH';data.resolution_u=1
    for contour in contours:
        spline=data.splines.new('POLY');spline.points.add(len(contour)-1)
        flat=[]
        for point,source in zip(spline.points,contour):
            u,v=(source.x/807-.5)*width,(100-source.y)*width/807+r*.34
            point.co=(u,v,0,1)
            flat.append(Vector((u,v)))
        spline.use_cyclic_u=True
        # A thin contour stroke leaves the spaces between letters orange.
        edge=[]
        for j,start in enumerate(flat):
            end=flat[(j+1)%len(flat)];steps=max(1,math.ceil((end-start).length/(r*.02)))
            for step in range(steps):
                u,v=start.lerp(end,step/steps)
                edge.append((u,-math.sqrt((r+.0006)**2-u*u-v*v),v,1))
        stroke=bpy.data.curves.new('Wilson · ivory contour','CURVE')
        stroke.dimensions='3D';stroke.bevel_depth=r*.0024;stroke.bevel_resolution=2
        boundary=stroke.splines.new('POLY');boundary.points.add(len(edge)-1)
        for point,co in zip(boundary.points,edge):point.co=co
        boundary.use_cyclic_u=True
        outline=bpy.data.objects.new('Basketball · Wilson ivory outline',stroke)
        bpy.context.collection.objects.link(outline);stroke.materials.append(P['evolution_outline'])
    obj=bpy.data.objects.new('Basketball · Wilson script logo',data)
    bpy.context.collection.objects.link(obj);data.materials.append(P['evolution_black'])
    wrap(obj,r+.0011)
    font_path=Path('/System/Library/Fonts/Supplemental/Arial Bold Italic.ttf')
    font=bpy.data.fonts.load(str(font_path),check_existing=True) if font_path.exists() else None
    for text,width,height,cy in [('EVOLUTION',r*1.30,r*.185,-r*.36),
                                  ('INDOOR GAME BALL',r*.79,r*.044,r*.108),
                                  ('ADVANCED MICROFIBER COMPOSITE',r*1.27,r*.038,-r*.50)]:
        obj=lettering('Basketball · '+text,text,(0,0,0),1,'evolution_black',(0,0,0))
        obj.data.extrude=0
        if text=='EVOLUTION' and font:obj.data.font=font
        bpy.context.view_layer.update()
        obj.scale.x=width/obj.dimensions.x;obj.scale.y=height/obj.dimensions.y
        # Apply the baseline offset in curve space before wrapping to the ball.
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
        bpy.ops.object.convert(target='MESH');obj=bpy.context.object
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        for vertex in obj.data.vertices:vertex.co.y+=cy
        wrap(obj,r+.0010)
    # Turn the printed face toward the main camera with a slight resting tilt.
    front=Vector((.20,-.90,.39)).normalized()
    right=Vector((0,0,1)).cross(front).normalized();up=front.cross(right)
    rotation=Matrix((right,-front,up)).transposed().to_4x4()@Matrix.Rotation(.12,4,'Y')
    bpy.context.view_layer.update()
    for obj in set(bpy.context.scene.objects)-before:
        obj.matrix_world=Matrix.Translation(Vector((x,y,z)))@rotation@obj.matrix_world


def captain_america_shield(x,y,floor=.148,r=.72,lean=15,yaw=0):
    """A domed metal shield resting on its rim, tilted back against the bench.
    The coloured rings and inset five-point star follow the same curved face,
    so the design remains geometry in the island's baked flight model."""
    from mathutils import Matrix
    before=set(bpy.context.scene.objects)
    P['shield_red']=material('Captain America shield · crimson enamel',(.48,.018,.027),metal=.55,rough=.30)
    P['shield_silver']=material('Captain America shield · brushed silver',(.70,.74,.79),metal=.78,rough=.31)
    P['shield_blue']=material('Captain America shield · navy enamel',(.018,.055,.20),metal=.42,rough=.32)
    P['shield_leather']=material('Captain America shield · leather grips',(.065,.028,.014),rough=.76)
    segments=128
    radii=[0]+[r*(start+(end-start)*i/4) for start,end in [(0,.4),(.4,.6),(.6,.8),(.8,1)] for i in range(1,5)]
    def face_depth(radius):
        return -.14*r*(1-(radius/r)**2)
    verts=[(0,face_depth(0),0)]
    for radius in radii[1:]:
        verts.extend((radius*math.cos(i*math.tau/segments),face_depth(radius),radius*math.sin(i*math.tau/segments)) for i in range(segments))
    faces=[];colours=[]
    for row,radius in enumerate(radii[1:]):
        colour=2 if radius<=r*.4+.0001 else 0 if radius<=r*.6+.0001 or radius>r*.8+.0001 else 1
        for i in range(segments):
            a=1+row*segments+i;b=1+row*segments+(i+1)%segments
            faces.append((0,a,b) if row==0 else (a-segments,a,b,b-segments))
            colours.append(colour)
    # A continuous shallow bowl, with a silver back and a rolled metal rim.
    back=len(verts)
    verts.extend((u,v+.035,w) for u,v,w in list(verts))
    front_faces=list(faces)
    faces.extend(tuple(index+back for index in reversed(face)) for face in front_faces)
    colours.extend([1]*len(front_faces))
    outer=1+(len(radii)-2)*segments
    for i in range(segments):
        a=outer+i;b=outer+(i+1)%segments
        faces.append((a,b,b+back,a+back));colours.append(1)
    shell=mesh('Captain America shield · domed concentric rings',verts,faces,'shield_red')
    shell.data.materials.append(P['shield_silver']);shell.data.materials.append(P['shield_blue'])
    for face,colour in zip(shell.data.polygons,colours):
        face.material_index=colour;face.use_smooth=True
    torus('Captain America shield · rolled silver rim',(0,.0175,0),r,.008,'shield_silver',(math.pi/2,0,0))
    # Subdivide the star radially so its silver face follows the dome.
    outline=[]
    for i in range(10):
        angle=math.pi/2+i*math.pi/5
        radius=r*.36*(1 if i%2==0 else .382)
        outline.append(Vector((radius*math.cos(angle),radius*math.sin(angle))))
    boundary=[]
    for i,point in enumerate(outline):
        boundary.extend(point.lerp(outline[(i+1)%10],j/4) for j in range(4))
    count=len(boundary);star_verts=[(0,face_depth(0)-.0015,0)];star_faces=[]
    for row in range(1,9):
        for point in boundary:
            u,v=point*row/8
            star_verts.append((u,face_depth(math.hypot(u,v))-.0015,v))
        for i in range(count):
            a=1+(row-1)*count+i;b=1+(row-1)*count+(i+1)%count
            star_faces.append((0,a,b) if row==1 else (a-count,a,b,b-count))
    star=mesh('Captain America shield · silver five-point star',star_verts,star_faces,'shield_silver')
    for face in star.data.polygons:face.use_smooth=True
    for side in (-1,1):
        u=side*r*.30
        curve('Captain America shield · rear leather strap',[(u,face_depth(abs(u))+.04,-r*.23),(u,.12,0),(u,face_depth(abs(u))+.04,r*.23)],.028,'shield_leather')
    bpy.context.view_layer.update()
    objects=set(bpy.context.scene.objects)-before
    tilt=Matrix.Rotation(math.radians(yaw),4,'Z')@Matrix.Rotation(math.radians(-lean),4,'X')
    bottom=min((tilt@obj.matrix_world@vertex.co).z for obj in objects if obj.type=='MESH' for vertex in obj.data.vertices)
    placement=Matrix.Translation(Vector((x,y,floor-bottom)))@tilt
    for obj in objects:obj.matrix_world=placement@obj.matrix_world


def lugia_figurine(x,y,z,angle=0,k=.43):
    """A painted-resin Lugia, wings raised, on a navy display plinth.
    The local frame faces -Y; broad fingered wings and the blue belly stay
    legible at the workshop shelf's miniature scale."""
    import bmesh
    before=set(bpy.context.scene.objects)
    P['lugia_white']=material('Lugia · pearl white resin',(.79,.83,.86),rough=.32)
    P['lugia_blue']=material('Lugia · blue belly',(.18,.35,.62),rough=.38)
    P['lugia_navy']=material('Lugia · deep blue markings',(.025,.065,.22),rough=.35)
    P['lugia_eye']=material('Lugia · red iris',(.44,.025,.035),rough=.27)
    cylinder('Lugia · display plinth',(0,0,.014),.25,.028,'lugia_navy',64,bevel=.005)
    white=[]
    def sculpt(name,centre,size):
        obj=sphere('Lugia · '+name,centre,size,'lugia_white',3)
        white.append(obj)
    def tube(name,points,radii):
        verts=[];faces=[];segments=16
        for i,point in enumerate(points):
            centre=Vector(point)
            tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
            side=tangent.cross(Vector((1,0,0))).normalized()
            across=tangent.normalized().cross(side)
            for j in range(segments):
                a=j*math.tau/segments
                verts.append(tuple(centre+radii[i]*(math.cos(a)*side+math.sin(a)*across)))
        faces=[tuple(reversed(range(segments)))]
        for i in range(len(points)-1):
            for j in range(segments):
                a=i*segments+j;b=i*segments+(j+1)%segments
                faces.append((a,b,b+segments,a+segments))
        faces.append(tuple(range((len(points)-1)*segments,len(points)*segments)))
        obj=mesh('Lugia · '+name,verts,faces,'lugia_white');white.append(obj)
    sculpt('body',(0,.01,.47),(.17,.14,.26))
    tube('curved neck',[(0,-.015,.61),(0,-.035,.76),(0,-.09,.91),(0,-.15,1.005)],[.12,.095,.075,.075])
    sculpt('head',(0,-.15,1.005),(.11,.11,.082))
    tube('pointed muzzle',[(0,-.18,1.01),(0,-.24,1.006),(0,-.30,.996),(0,-.35,.98)],[.072,.052,.027,.002])
    tube('swept head crest',[(0,-.12,1.035),(0,-.025,1.075),(0,.025,1.09)],[.075,.04,.004])
    tube('curved tail',[(0,.10,.32),(0,.23,.19),(.12,.36,.12),(.25,.40,.15),(.32,.40,.23),(.35,.39,.27)],[.09,.07,.052,.034,.015,.002])
    for s in (-1,1):
        sculpt('haunch',(s*.13,.025,.285),(.115,.11,.15))
        sculpt('ankle',(s*.14,-.015,.155),(.075,.075,.13))
        sculpt('foot',(s*.14,-.075,.085),(.10,.145,.06))
        for toe in (-1,0,1):
            sculpt('toe',(s*.14+toe*.049,-.18,.069),(.029,.063,.036))
        # Five broad digits with real gaps give Lugia its hand-shaped wings.
        outline=[(.10,.68),(.32,.73),(.43,.89),(.46,1.04),(.52,1.06),
                 (.55,.92),(.65,1.13),(.71,1.12),(.66,.89),(.81,1.09),
                 (.87,1.06),(.76,.85),(.93,.98),(.96,.93),(.80,.77),
                 (.97,.82),(.96,.75),(.73,.65),(.53,.65),(.30,.61),(.11,.58)]
        n=len(outline)
        verts=[(s*u,-.015-u*.055+depth,v) for depth in (-.026,.026) for u,v in outline]
        faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]
        faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        wing=mesh('Lugia · hand-shaped wing',verts,faces,'lugia_white')
        white.append(wing)
    # Fuse the white pieces into one smooth toy without primitive seams.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in white:obj.select_set(True)
    bpy.context.view_layer.objects.active=white[0]
    bpy.ops.object.join()
    body=bpy.context.object;body.name='Lugia · sculpted white figure'
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    topology=bmesh.new();topology.from_mesh(body.data)
    bmesh.ops.recalc_face_normals(topology,faces=list(topology.faces))
    topology.to_mesh(body.data);topology.free()
    remesh=body.modifiers.new('Continuous resin sculpture','REMESH')
    remesh.mode='VOXEL';remesh.voxel_size=.010;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=body.modifiers.new('Polished resin contours','SMOOTH')
    smooth.factor=.7;smooth.iterations=4
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    for face in body.data.polygons:face.use_smooth=True
    # The blue painted patch conforms to the front of the torso.
    verts=[];faces=[];rows=20;cols=20
    for i in range(rows+1):
        phi=-1.12+i/rows*2.12
        spread=.88*(1-.25*max(0,phi))
        for j in range(cols+1):
            theta=-spread+2*spread*j/cols
            verts.append((.172*math.cos(phi)*math.sin(theta),
                          .01-.142*math.cos(phi)*math.cos(theta),.47+.262*math.sin(phi)))
    for i in range(rows):
        for j in range(cols):
            a=i*(cols+1)+j;faces.append((a,a+1,a+cols+2,a+cols+1))
    belly=mesh('Lugia · painted blue belly',verts,faces,'lugia_blue')
    for face in belly.data.polygons:face.use_smooth=True
    for s in (-1,1):
        verts=[(s*.025,-.251,1.028),(s*.085,-.219,1.067),
               (s*.14,-.075,1.125),(s*.11,-.17,1.005)]
        mesh('Lugia · pointed eye marking',verts,[(0,1,2,3)],'lugia_navy')
        sphere('Lugia · eye',(s*.069,-.235,1.04),(.022,.006,.010),'paper',2)
        sphere('Lugia · iris',(s*.070,-.241,1.042),(.006,.003,.007),'lugia_eye',2)
        for zz in (.70,.59,.48,.37):
            plate=box('Lugia · dorsal plate',(s*.135,.128,zz),(.105,.10,.075),'lugia_navy',.012)
            plate.rotation_euler.y=s*.35;plate.rotation_euler.x=.20
        spike=cylinder('Lugia · tail spike',(.275+s*.025,.402,.22),.025,.12,'lugia_navy',16,top=.002,bevel=0)
        spike.rotation_euler.y=s*.55
    curve('Lugia · mouth line',[(-.052,-.293,.978),(0,-.329,.976),(.052,-.293,.978)],.002,'lugia_navy')
    objects=set(bpy.context.scene.objects)-before
    bpy.context.view_layer.update()
    transform_objects(objects,scale=(k,k,k),origin=(0,0,0))
    place(objects,x,y,z,angle)


def jbl_charge4(x,y,z,angle):
    """A JBL Charge 4 in navy, lying on its foot: a 220 x 95mm cylinder of
    fabric grille between rubber end caps, a passive radiator in each end, a
    rubber foot along the bottom, buttons along the top and the orange JBL
    badge on the front. Life size (2 units a metre); its length runs along x."""
    before=set(bpy.context.scene.objects)
    P.setdefault('jbl_grille',textured('JBL Charge 4 · navy fabric grille',(.018,.03,.075),(.05,.07,.15),'fabric',rough=.95))
    P.setdefault('jbl_rubber',material('JBL Charge 4 · navy rubber',(.016,.024,.06),rough=.6))
    P.setdefault('jbl_radiator',material('JBL Charge 4 · passive radiator',(.03,.035,.05),metal=.2,rough=.4))
    P.setdefault('jbl_orange',material('JBL Charge 4 · orange badge',(.85,.30,.02),rough=.5))
    r,L,cap=.095,.36,.04;cz=r+.006
    def along_x(obj):obj.rotation_euler.y=math.pi/2;return obj
    along_x(cylinder('JBL Charge 4 · fabric body',(0,0,cz),r,L,'jbl_grille',48,bevel=.004))
    for s in (-1,1):
        along_x(cylinder('JBL Charge 4 · rubber end cap',(s*(L/2+cap/2),0,cz),r+.002,cap,'jbl_rubber',48,bevel=.012))
        along_x(cylinder('JBL Charge 4 · passive radiator',(s*(L/2+cap-.002),0,cz),r*.70,.006,'jbl_radiator',40,bevel=.002))
        torus('JBL Charge 4 · radiator ring',(s*(L/2+cap+.001),0,cz),r*.74,.006,'jbl_rubber',(0,math.pi/2,0))
    box('JBL Charge 4 · rubber foot',(0,0,.006),(L*.78,.07,.012),'jbl_rubber',.004)
    box('JBL Charge 4 · button strip',(0,0,cz+r-.002),(.17,.034,.012),'jbl_rubber',.005)
    box('JBL Charge 4 · JBL badge',(0,-r+.004,cz+.012),(.08,.012,.034),'jbl_orange',.003).rotation_euler.x=math.radians(-8)
    lettering('JBL Charge 4 · JBL logo','JBL',(0,-r-.003,cz+.012),.024,'paper',(math.pi/2-math.radians(8),0,0))
    place(set(bpy.context.scene.objects)-before,x,y,z,angle)


def blackpink_lightstick(x,y,z,angle,k=1.3):
    """BLACKPINK's official light stick (Bl-ping-bong, Ver. 2), lying on its
    side: a toy-hammer shape, a black cylindrical handle with a pink button
    and a pink band near the top, and a head of two pink silicone hearts, one
    at each end. Lit, the hearts and the band glow pink. Catalogue size is
    155 x 87 x 253mm; it's drawn `k` times life size so it reads at the
    island's scale. Built upright, then laid down resting on a heart's edge
    and the end of the handle."""
    before=set(bpy.context.scene.objects)
    u=.002*k  # one millimetre
    P.setdefault('bp_black',material('Lightstick · black handle',(.012,.012,.014),rough=.35))
    P.setdefault('bp_pink',material('Lightstick · pink button',(.85,.32,.48),rough=.45))
    P.setdefault('bp_glow',material('Lightstick · pink heart',(.95,.10,.42),rough=.5,emission=.55))
    P.setdefault('bp_band',material('Lightstick · pink band',(.95,.10,.42),rough=.4,emission=.55))
    # Handle: 30mm across, from its end cap to the head.
    hb,ht=0,160*u
    cylinder('Lightstick · black handle',(0,0,(hb+ht)/2),15*u,ht-hb,'bp_black',32,bevel=2*u)
    cylinder('Lightstick · pink band',(0,0,ht-16*u),15.6*u,9*u,'bp_band',32,bevel=0)
    b=cylinder('Lightstick · pink button',(0,-15.2*u,(hb+ht)/2+8*u),6*u,3*u,'bp_pink',24,bevel=1*u);b.rotation_euler.x=math.pi/2
    # Head: a black hub across the top of the handle, a heart at each end.
    hz=ht+38*u
    hub=cylinder('Lightstick · black hub',(0,0,hz),24*u,40*u,'bp_black',32,bevel=3*u);hub.rotation_euler.x=math.pi/2
    cylinder('Lightstick · black neck',(0,0,ht+12*u),13*u,26*u,'bp_black',24,bevel=2*u)
    # A heart outline (the classic parametric heart), 87mm across, extruded
    # 55mm outward from each side of the hub.
    outline=[]
    for i in range(56):
        t=i*math.tau/56
        hx=16*math.sin(t)**3;hy=13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t)
        outline.append((hx*43.5*u/16,(hy+2.5)*43.5*u/16))
    n=len(outline)
    for side in [-1,1]:
        y0,y1=side*20*u,side*75*u
        verts=[(ox,y0,hz+oz) for ox,oz in outline]+[(ox,y1,hz+oz) for ox,oz in outline]
        faces=[tuple(range(n)) if side>0 else tuple(reversed(range(n))),tuple(reversed(range(n,2*n))) if side>0 else tuple(range(n,2*n))]
        faces+=[(i,(i+1)%n,(i+1)%n+n,i+n) if side>0 else (i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)]
        heart=mesh('Lightstick · pink silicone heart',verts,faces,'bp_glow')
        finish(heart,heart.name,None,4*u)
        for f in heart.data.polygons:f.use_smooth=True
    # Its own pink glow on the shelf around it.
    light('Lightstick · pink glow',(0,-.12*k,hz),(1,.32,.66),5*k,.08*k)
    built=set(bpy.context.scene.objects)-before
    # The head (about 87mm) is thicker than the handle (30mm), so lying down
    # the stick tips a few degrees: heart edge and handle end both touch.
    lay_down(built,'Y',90-math.degrees(math.atan((43.5-15)/(hz/u))))
    place(built,x,y,z,angle)


# The workshop stool, in front of the monitor.
STOOL=(1.17,-1.15)


def half_court():
    """Carter's a Lakers fan, and the workshop's yard is a half-court: a
    poured concrete pad painted Lakers purple with a gold key and white
    lines, a hoop on a black steel pole at its far end, and a cool LED
    floodlight on the pole. The hoop stands about as tall as the shed's roof,
    so the island reads as the workshop with the court from far away. The
    floodlight is on the room's switch (with the task strip, both LEDs)."""
    x0,x1,y0,y1=COURT;cx=(x0+x1)/2;top=.20 if refined('projects','court') else .26
    P['maple']=textured('Court · varnished maple strip',(.20,.10,.035),(.38,.21,.08),'wood',rough=.72,grain=(40,1.2,6))
    P['maple2']=textured('Court · varnished maple strip, darker',(.16,.08,.03),(.31,.17,.065),'wood',rough=.72,grain=(40,1.2,6))
    P['court']=material('Court · Lakers purple border',(.09,.025,.22),rough=.7)
    P['key']=material('Court · Lakers gold key',(.62,.36,.02),rough=.7)
    P['line']=material('Court · white line paint',(.80,.80,.78),rough=.4)
    P['rim']=material('Hoop · orange rim',(.85,.22,.02),metal=.4,rough=.35)
    P['board']=material('Hoop · white backboard',(.78,.80,.82),rough=.3)
    box('Court · poured concrete pad',(cx,(y0+y1)/2,top/2-.06),(x1-x0,y1-y0,top+.12),'stone',.012)
    # A purple border all round, then the playing floor: maple strips (about
    # 6cm wide, like a real court's) running the length of the court.
    box('Court · painted border',(cx,(y0+y1)/2,top+.001),(x1-x0-.02,y1-y0-.02,.002),'court',0)
    inner=x1-x0-.14;strips=round(inner/.10);w=inner/strips;rng=random.Random(2424)
    for i in range(strips):
        sx=x0+.07+w*(i+.5);y=y0+.07
        while y<y1-.07-.01:
            length=min(rng.uniform(.55,1.05),y1-.07-y)
            box('Court · maple strip',(sx,y+length/2,top+.0022),(w-.004,length-.004,.002),'maple' if rng.random()<.6 else 'maple2',0)
            y+=length
    # Baseline under the hoop, sidelines, the key and the free-throw circle.
    base=y1-.10;ft=base-1.35;lz=top+.004;key_width=.86
    def line(a,b,w=.024):
        (ax,ay),(bx,by)=a,b
        box('Court · painted line',((ax+bx)/2,(ay+by)/2,lz),(abs(bx-ax)+w,abs(by-ay)+w,.002),'line',0)
    box('Court · painted key',(cx,(base+ft)/2,top+.003),(key_width,base-ft,.002),'key',0)
    line((x0+.05,base),(x1-.05,base))
    for x in [x0+.05,x1-.05]:line((x,y0+.05),(x,base))
    line((x0+.05,y0+.05),(x1-.05,y0+.05))
    for x in [cx-key_width/2,cx+key_width/2]:line((x,ft),(x,base))
    line((cx-key_width/2,ft),(cx+key_width/2,ft))
    curve('Court · free-throw circle',[(cx+key_width/2*math.cos(a*math.tau/48),ft+key_width/2*math.sin(a*math.tau/48),lz) for a in range(48)],.009,'line',cyclic=True)
    # The three-point arc around the hoop, where it fits on the pad.
    hx,hy=cx,base-.30;radius=1.70;half_width=(x1-x0)/2-.16
    angle=math.acos(half_width/radius)
    arc=[(hx+radius*math.cos(a),hy+radius*math.sin(a),lz)
         for a in [math.pi+angle+i*(math.pi-2*angle)/60 for i in range(61)]]
    curve('Court · three-point arc',arc,.009,'line')
    for x in [cx-half_width,cx+half_width]:
        line((x,hy-radius*math.sin(angle)),(x,base))
    # The hoop: pole behind the baseline, an arm, the board, rim and net.
    px,py=cx,y1+.32;rim_z=3.10 if refined('projects','court') else 3.40
    cylinder('Hoop · concrete footing',(px,py,.12),.16,.30,'stone',24,bevel=.01)
    rod('Hoop · black steel pole',(px,py,.10),(px,py,rim_z+.90),.055,'ink',20)
    rod('Hoop · arm',(px,py,rim_z+.20),(px,base+.08,rim_z+.20),.032,'ink',12)
    board_y=base+.06
    box('Hoop · backboard',(px,board_y,rim_z+.30),(1.20,.035,.74),'board',.01)
    for z,h in [(rim_z+.665,.02),(rim_z-.065,.02)]:box('Hoop · board edge',(px,board_y-.019,z),(1.20,.004,h),'rim',0)
    for x in [px-.59,px+.59]:box('Hoop · board edge',(x,board_y-.019,rim_z+.30),(.02,.004,.74),'rim',0)
    for z,h in [(rim_z+.42,.018),(rim_z+.07,.018)]:box('Hoop · target square',(px,board_y-.019,z),(.44,.004,h),'rim',0)
    for x in [px-.22,px+.22]:box('Hoop · target square',(x,board_y-.019,rim_z+.245),(.018,.004,.37),'rim',0)
    ry=board_y-.02-.30
    box('Hoop · rim bracket',(px,board_y-.08,rim_z),(.18,.13,.03),'rim',.004)
    torus('Hoop · orange rim',(px,ry,rim_z),.28,.018,'rim')
    for k in range(14):
        a=k*math.tau/14;b=a+math.tau/28
        rod('Hoop · net cord',(px+.28*math.cos(a),ry+.28*math.sin(a),rim_z-.01),(px+.17*math.cos(b),ry+.17*math.sin(b),rim_z-.40),.005,'paper',6)
    for z,r in [(rim_z-.20,.225),(rim_z-.39,.175)]:torus('Hoop · net loop',(px,ry,z),r,.004,'paper')
    # A cool-white LED floodlight on top of the pole, aimed down the court.
    P['flood']=material('Court floodlight · LED panel',(.80,.88,1),emission=8)
    # It reaches over the top of the backboard on an arm, so the board
    # doesn't shade the court.
    fy,fz=board_y-.18,rim_z+.88
    rod('Court floodlight · arm',(px,py,rim_z+.86),(px,fy+.06,fz+.02),.022,'ink',10)
    box('Court floodlight · housing',(px,fy,fz),(.30,.12,.18),'ink',.01).rotation_euler.x=math.radians(-50)
    box('Court floodlight · LED panel',(px,fy-.05,fz-.05),(.25,.006,.13),'flood',0).rotation_euler.x=math.radians(-50)
    spot('Court floodlight',(px,fy-.10,fz-.10),(cx,(y0+y1)/2-.2,top),(.84,.86,1) if refined('projects','court') else (.78,.86,1),650 if refined('projects','court') else 2000,78 if refined('projects','court') else 70,.78 if refined('projects','court') else .6,.15 if refined('projects','court') else .10)
    if refined('projects','court'):
        terrain_path('Court · low stone approach',[(3.05,-1.05),(3.55,-1.05)],.48,107,'paving',.25)
    ANCHORS['hoop']=(px,ry,rim_z)


def workshop():
    foundation(107,'lot');landscape('projects',107);floorboards()
    # A practical studio wall, with a small tool rail rather than a giant toy pegboard.
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
    # Carter's a Lakers fan: Kobe's gold #24, framed on the wall above the bench.
    kobe_jersey(-.20,1.80,2.38)
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
    housing=box('Monitor · thin display housing',(sx,sy+.105,(bottom+top)/2),(1.25,.036,.77),'ink',.008)
    housing.rotation_euler.x=math.radians(-4)
    # The display shows the project it opens onto (TaipeiFlix), lit like a
    # real screen at night, the same image the site lays over it.
    image=bpy.data.images.load(str(ROOT/'public'/'project-shots'/'taipei-flix.webp'),check_existing=True)
    if not image.packed_file:image.pack()
    display=material('Monitor · lit display',(.02,.02,.02),rough=.25)
    tex=display.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    bs=display.node_tree.nodes['Principled BSDF']
    display.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    display.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color'])
    bs.inputs['Emission Strength'].default_value=1.4
    glass=mesh('Monitor · screen glass',[screen[0],screen[1],screen[3],screen[2]],[(0,1,2,3)],display)
    uv=glass.data.uv_layers.new(name='Screen coordinates')
    for loop,point in zip(uv.data,[(0,1),(1,1),(1,0),(0,0)]):loop.uv=point
    ANCHORS['screen']=screen;ANCHORS['landmark']=(sx,sy+.085,(bottom+top)/2);ANCHORS['screenGlow']=(sx,sy-.22,sz+.02)
    light('Monitor · reflected screen light',(sx,sy-.18,sz+.72),(.72,.82,1),5,.7,(sx,sy-.50,sz))
    # Carter's iPad Pro on its Magic Keyboard, centred on the bench; its
    # wallpaper is a launch photo (artwork/blender/ipad-wallpaper-launch.jpg).
    ipad_pro(.10,-.48,1.79,math.radians(28),'artwork/blender/ipad-wallpaper-launch.jpg')
    # In Common With's Eave Table Lamp, in black steel, at the back of the
    # bench: a workbench lamp's pool of light.
    eave_table_lamp(-1.50,.60,1.792,80,.8)
    # Different working objects replace the three identical empty cases.
    # Carter asked for a six-watch box on the lower shelf.
    watch_box(-.43,-.14,.5175,math.radians(4))
    # Carter asked for a poker chip set on the lower shelf and blue AirPods
    # Max on the bench.
    poker_chip_case(.45,.02,.5175,math.radians(-5))
    airpods_max(-1.68,-.30,1.792,math.radians(14))
    # Lakers gold: an LED strip along the bench's front edge, washing the
    # drawers and the deck below.
    P['gold_strip']=material('Glow · gold LED strip',(1,.58,.08),emission=4)
    box('Glow · bench edge strip',(0,-.797,1.703),(4.60,.006,.014),'gold_strip',0)
    for bx in [-1.4,1.4]:light('Glow · gold bench wash',(bx,-.86,1.62),(1,.56,.08),12,.8,(bx,-1.45,.2))
    # The shield's lower rim rests on the boards and its upper rim leans
    # against the bench's right apron, clear of the stool and basketball court.
    captain_america_shield(2.28 if refined('projects','shield') else 2.17,-.98 if refined('projects','shield') else -.85,lean=15,yaw=-2 if refined('projects','shield') else 22)
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
    bpy.context.view_layer.update()
    transform_objects(set(bpy.context.scene.objects)-rear_storage,scale=(1,1,.72),origin=(0,0,.16))
    # Unlike the study's finished room, the workshop is an open lean-to shed:
    # a bare timber stud frame with mismatched plywood on its lower half, two
    # patched sheets above, open bays to the sky, no side wall, and a sloping
    # corrugated roof on posts.
    top=3.98
    P['ply']=textured('Workshop · birch plywood sheet',(.30,.22,.13),(.44,.34,.21),'wood',rough=.85,grain=(.6,9,4))
    P['ply2']=textured('Workshop · weathered plywood sheet',(.24,.17,.10),(.37,.27,.16),'wood',rough=.88,grain=(.6,9,4))
    P['osb']=textured('Workshop · oriented strand board',(.26,.18,.09),(.48,.36,.19),'soil',rough=.92)
    P['corrugated']=textured('Workshop · galvanised corrugated steel',(.16,.17,.17),(.30,.31,.30),'metal',metal=.55,rough=.5)
    srng=random.Random(4107)
    def sheet(x0,x1,z0,z1,mat):
        y=2.035+srng.uniform(-.006,.006)
        box('Workshop · screwed sheet',((x0+x1)/2,y,(z0+z1)/2),(x1-x0,.035,z1-z0),mat,.002).rotation_euler.y=srng.uniform(-.008,.008)
        for xx in [x0+.05,(x0+x1)/2,x1-.05]:
            for zz in [z0+.06,(z0+z1)/2,z1-.06]:
                cylinder('Sheet · screw head',(xx,y-.02,zz),.009,.004,'steel',8,bevel=0).rotation_euler.x=math.pi/2
    # Studs at 60cm centres, a sole plate, a top plate and noggins between.
    x=-3.13
    while x<=2.96:
        box('Workshop · stud',(x,2.10,(top+.16)/2),(.075,.13,top-.16),'oak',.003);x+=.608
    box('Workshop · sole plate',(-.09,2.10,.19),(6.16,.13,.06),'oak',.003)
    box('Workshop · top plate',(-.09,2.10,top+.03),(6.16,.13,.06),'oak',.003)
    for zz in [2.30,3.20]:box('Workshop · noggin',(-.09,2.10,zz),(6.08,.06,.075),'oak',.002)
    x=-3.13;splits=[2.20,2.05,2.26,2.12,2.18];mats=['ply','osb','ply2','ply','osb']
    for i in range(5):
        w=min(1.216,2.95-x);sheet(x+.008,x+w-.008,.16,splits[i],mats[i]);x+=w
    # Only two sheets have gone up above: one for the poster, one patch.
    sheet(-3.12,-1.92,2.24,3.62,'ply2')
    sheet(-.70,.55,2.20,3.50,'osb')
    # A lean-to roof: rafters from the top plate down to a beam on two posts,
    # galvanised sheet over them, ribs running down the slope.
    back,front=(2.24,top+.16),(1.32,3.80)
    for xx in [-3.05,2.86]:
        box('Workshop · roof post',(xx,front[0]+.06,(front[1]+.16)/2),(.09,.09,front[1]-.16),'oak',.003)
        box('Post · concrete pad',(xx,front[0]+.06,.17),(.20,.20,.06),'stone',.004)
    box('Workshop · roof beam',(-.09,front[0]+.06,front[1]-.02),(6.10,.09,.12),'oak',.003)
    x=-3.05
    while x<=2.9:
        rod('Workshop · rafter',(x,back[0],back[1]-.05),(x,front[0]-.06,front[1]-.04),.03,'oak',6);x+=.61
    verts=[];faces=[];nx=240
    for i in range(nx+1):
        xx=-3.30+6.45*i/nx;rib=.024*math.sin(i/nx*6.45/.15*math.tau)
        for (yy,zz) in [(back[0]+.10,back[1]+.03),(front[0]-.14,front[1]-.03)]:verts.append((xx,yy,zz+rib))
    for i in range(nx):faces.append((i*2,i*2+2,i*2+3,i*2+1))
    roof=mesh('Workshop · corrugated lean-to roof',verts,faces,'corrugated')
    roof.modifiers.new('Sheet thickness','SOLIDIFY').thickness=.012
    # Lakers purple: LED strips along the front of the roof beam and up both
    # posts frame the shed in neon; their light stays close to the strips.
    # They (with the cool task strip, the screen and the court's floodlight)
    # carry the workshop's light, so from a distance it reads cool beside
    # the study's warm lamplight; its warm lamps are accents.
    P['purple_strip']=material('Glow · purple LED strip',(.46,.12,1),emission=4)
    box('Glow · roof beam strip',(-.09,front[0]+.012,front[1]-.075),(6.0,.008,.016),'purple_strip',0)
    for bx in [-2.0,.2,2.2]:light('Glow · purple wall wash',(bx,front[0]+.12,front[1]-.13),(.45,.14,1),10,.3,(bx,2.0,3.3))
    for px2 in [-3.05,2.86]:
        box('Glow · post strip',(px2,front[0]+.012,(front[1]-.12+.22)/2),(.016,.008,front[1]-.34),'purple_strip',0)
        light('Glow · post wash',(px2,front[0]-.15,2.0),(.45,.14,1),5,.3,(px2,front[0]-.8,1.2))
    deck_glow()
    # In Common With's Luca Wall Sconce on the patched sheet above the tool
    # wall, fanning its light down over the tools.
    luca_wall_sconce(.33,2.017,3.05,90)
    # A string of festoon bulbs swagged along the roof beam.
    P['festoon']=material('Festoon · warm bulb',(1,.74,.44),emission=3.5)
    hangs=[-3.0,-1.0,.95,2.82];fy=front[0]+.0;fz=front[1]-.10
    for a,b in zip(hangs,hangs[1:]):
        pts=[(a+(b-a)*t/8,fy,fz-.16*math.sin(math.pi*t/8)) for t in range(9)]
        curve('Festoon · cable',pts,.004,'ink')
        for t in [1,3,5,7]:
            px2,_,pz2=pts[t]
            sphere('Festoon · bulb',(px2,fy,pz2-.05),(.028,.028,.036),'festoon',2)
    for xx in [-2.0,0,1.9]:light('Festoon · glow',(xx,fy-.15,fz-.25),(1,.72,.42),2.5,.3)
    # A small purple-and-gold pennant for the Lakers, pinned by the prints.
    P['lakers_purple']=material('Felt pennant · purple',(.14,.045,.24),rough=.95)
    P['lakers_gold']=material('Felt pennant · gold',(.62,.40,.07),rough=.95)
    px,pz=-.48,3.40
    mesh('Pennant · felt',[(px,2.012,pz),(px,2.012,pz-.30),(px+.62,2.012,pz-.17)],[(0,1,2)],'lakers_purple')
    mesh('Pennant · gold stripe',[(px,2.010,pz),(px,2.010,pz-.075),(px+.55,2.010,pz-.155)],[(0,1,2)],'lakers_gold')
    box('Pennant · sleeve',(px-.015,2.011,pz-.15),(.04,.006,.32),'lakers_gold',.002)
    cylinder('Pennant · pin',(px-.015,2.000,pz+.005),.014,.008,'brass',16).rotation_euler.x=math.pi/2
    # Carter's Ninebot scooter, on its kickstand in the front yard left of
    # the step, clear of the court; he gets around the city on it.
    ninebot_scooter(-1.20,-2.44 if refined('projects','scooter') else -2.65,math.radians(8))
    # Space things, taped and shelved: a planet poster and a Starship model,
    # the same sky the site floats in. (The top shelf is kept to a few
    # objects: no LED ball or cartons.)
    P['spaceposter']=material('Poster · deep space print',(.012,.018,.045),rough=.7)
    P['planet']=textured('Poster · banded planet',(.36,.20,.09),(.62,.42,.22),'plaster',rough=.8)
    px,pz=-2.50,3.22
    box('Poster · paper',(px,2.012,pz),(.56,.004,.70),'spaceposter',.001)
    planet=cylinder('Poster · planet',(px+.04,2.009,pz+.04),.15,.002,'planet',48,bevel=0);planet.rotation_euler.x=math.pi/2
    ring=torus('Poster · planet ring',(px+.04,2.008,pz+.04),.22,.008,'page',(math.pi/2,0,0));ring.scale=(1,.32,1);ring.rotation_euler=(math.pi/2,.32,0)
    for k in range(26):
        sx2=px+srng.uniform(-.25,.25);sz2=pz+srng.uniform(-.32,.32)
        if math.hypot(sx2-px-.04,sz2-pz-.04)<.18:continue
        box('Poster · star',(sx2,2.008,sz2),(.007,.001,.007),'paper',0)
    box('Poster · title band',(px,2.009,pz-.29),(.44,.002,.03),'page',0)
    for dx,dz in [(-.27,.34),(.27,.34),(-.27,-.34),(.27,-.34)]:
        box('Poster · masking tape',(px+dx,2.006,pz+dz),(.10,.002,.035),'linen',0,rot=0).rotation_euler.y=.6 if dx*dz>0 else -.6
    # The storage rack is squashed to .72 height about z=.16 after it's built.
    shelf=.16+(3.79-.16)*.72+.015
    # Space the four displays for clear gaps from the site camera. Starship
    # stands a little shorter than the shelf's height allows, so its nose
    # reads clear of the roof edge and the festoon bulbs in front of it, and
    # a small display light (on the devices switch) catches its steel.
    starship(2.42,1.60,shelf,.80)
    spot('Starship display light',(2.15,.90,3.50),(2.42,1.60,shelf+.42),(.86,.92,1),55,22,blend=.6,soft=.03)
    # Carter asked for BLACKPINK's official light stick, lit, on the top
    # shelf (on the lower one the stool hid it), turned across the shelf so
    # both pink hearts read side by side. He then asked for it to swap places
    # with the navy JBL: the speaker now sits at the left end, clear of the
    # upright (it is longer than the light stick is wide), and the light
    # stick between it and the Cybertruck.
    blackpink_lightstick(1.40,1.31,shelf,math.radians(90),k=1.2)
    jbl_charge4(.83,1.48,shelf,0)
    # Lugia sits on the open middle shelf, clear of the monitor's screen.
    middle_shelf=.16+(2.98-.16)*.72+.015
    lugia_figurine(2.20,1.48,middle_shelf,math.radians(-18),k=.41)
    # Tesla merch: a stainless Cybertruck model on the shelf.
    cx,cy,cz=1.92,1.60,shelf
    profile=[(-.22,.025),(.22,.025),(.22,.085),(-.03,.14),(-.22,.10)]
    tv=[(cx+u,cy+side*.085,cz+v) for side in [-1,1] for u,v in profile]
    m=len(profile)
    tf=[tuple(range(m)),tuple(reversed(range(m,2*m)))]+[(i,(i+1)%m,(i+1)%m+m,i+m) for i in range(m)]
    mesh('Cybertruck model · stainless body',tv,tf,'steel')
    box('Cybertruck model · light bar',(cx+.222,cy,cz+.083),(.004,.15,.008),'light',0)
    for u in [-.14,.14]:
        for side in [-1,1]:
            cylinder('Cybertruck model · wheel',(cx+u,cy+side*.08,cz+.035),.034,.026,'ink',16,bevel=.002).rotation_euler.x=math.pi/2
    # A Wilson Evolution game ball rests on the court with its print visible.
    wilson_evolution(COURT[0]+.42 if refined('projects','court') else COURT[0]+.32,.62,(.202 if refined('projects','court') else .262)+.24)
    # A small telescope on its tripod in the yard, aimed up past the roof.
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    ground=bpy.data.objects['Island · eroded basalt escarpment']
    gtree=BVHTree.FromObject(ground,bpy.context.evaluated_depsgraph_get())
    tx,ty=-2.85,-2.35
    hit=gtree.ray_cast(ground.matrix_world.inverted()@Vector((tx,ty,10)),Vector((0,0,-1)))[0]
    tz=(ground.matrix_world@hit).z if hit is not None else .1
    apex=Vector((tx,ty,tz+.78))
    for k in range(3):
        a=k*math.tau/3+.4
        rod('Telescope · tripod leg',(tx+math.cos(a)*.30,ty+math.sin(a)*.30,tz),tuple(apex),.012,'wood',8)
    cylinder('Telescope · mount',tuple(apex+Vector((0,0,.04))),.035,.08,'ink',16,bevel=.004)
    aim=Vector((.45,.55,.70)).normalized()
    base_pt=apex+Vector((0,0,.10))-aim*.30;tip=apex+Vector((0,0,.10))+aim*.42
    rod('Telescope · white tube',tuple(base_pt),tuple(tip),.055,'paper',24)
    rod('Telescope · dew shield',tuple(tip),tuple(tip+aim*.10),.062,'ink',24)
    rod('Telescope · eyepiece',tuple(base_pt+aim*.08),tuple(base_pt+aim*.08+Vector((0,0,.09))),.014,'ink',12)
    rod('Telescope · finder',tuple(base_pt+aim*.25+Vector((0,0,.07))),tuple(base_pt+aim*.48+Vector((0,0,.07))),.012,'steel',12)
    # A low stool with metal legs and a modest padded seat.
    # It stands in front of the monitor (the bench is turned 9 degrees, so
    # that's at about (1.17, -1.15) here), where you'd sit to work.
    stx,sty=STOOL
    for xx in [-.27,.27]:
        for yy in [-.27,.27]:rod('Stool · splayed steel leg',(stx+xx*1.25,sty+yy*1.25,.16),(stx+xx,sty+yy,1.08),.021,'teal',20)
    cylinder('Stool · padded seat',(stx,sty,1.10),.37,.085,'leather',64,bevel=.020)
    torus('Stool · foot ring',(stx,sty,.43),.33,.012,'steel')
    # Under-shelf task strip provides a soft local pool of light.
    box('Workshop · practical LED strip',(1.56,1.44,1.61),(2.04,.025,.015),'light',.003)
    ANCHORS['bulbs']=[(1.10,1.44,1.61),(2.0,1.44,1.61)]
    light('Workshop · task strip',(1.56,1.35,1.58),(.80,.88,1),26,1.0,(1.1,.6,1.1))
    plant(-2.98,.95,.16,.64)
    half_court()


def unseen_lights(scene):
    """Lamps light the scene but are never seen themselves: through the
    study's clear window the rim lights behind the island would show."""
    for obj in scene.objects:
        if obj.type=='LIGHT':obj.visible_camera=False


def repeatable(scene):
    """Same scene in, same pixels out: a fixed sampling seed and the CPU
    denoiser, so re-rendering an unchanged island yields byte-identical
    assets (and the same fingerprinted file names visitors already have)."""
    scene.cycles.seed=0
    scene.cycles.use_animated_seed=False
    if hasattr(scene.cycles,'denoising_use_gpu'):scene.cycles.denoising_use_gpu=False


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
    if refined('shared','silhouette'):
        # Filter subpixel foliage and narrow roof ribs at the existing render
        # resolution; no larger texture or browser filter is required.
        scene.render.filter_size=1.8
        # Cycles owns a separate reconstruction filter; render.filter_size
        # alone leaves its default unchanged.
        scene.cycles.filter_width=1.8
    scene.render.fps=12
    scene.frame_start=1; scene.frame_end=48
    # The islands hang in the site's night sky (#030611), so the only ambient
    # light is that deep navy; the moon and the islands' own lamps do the rest.
    scene.world=bpy.data.worlds.new('Night sky ambience')
    scene.world.use_nodes=True
    background=scene.world.node_tree.nodes['Background']
    background.inputs[0].default_value=(.010,.016,.040,1)
    background.inputs[1].default_value=1
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.55
    if engine=='CYCLES':
        scene.cycles.samples=samples
        scene.cycles.use_denoising=True
        scene.cycles.max_bounces=6
        repeatable(scene)
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
        # Beam haze is air, not part of the island's silhouette.
        if obj.type not in {'MESH','CURVE'} or '· haze' in obj.name:continue
        coords.extend(inverse@(obj.matrix_world@Vector(v)) for v in obj.bound_box)
    xmin,xmax=min(c.x for c in coords),max(c.x for c in coords)
    ymin,ymax=min(c.y for c in coords),max(c.y for c in coords)
    target=rotation@Vector(((xmin+xmax)/2,(ymin+ymax)/2,0))
    distance=max((xmax-xmin),1.5*(ymax-ymin))/.83/(36/70)
    camera.location=target+direction*(distance+3)
    # Night: a cool moon from high on the left models every form with crisp
    # shadows; a blue rim from behind lifts the silhouette off the navy sky;
    # warm practicals (lamps, screens, windows) carry the story.
    moon=bpy.data.lights.new('Moon · cool key','SUN')
    # The study and workshop sit in more open dark than the lit city, so their
    # moon and backlight are a little stronger to hold their silhouettes.
    moon.color=(.72,.80,1);moon.energy=1.7 if city_scene else 2.2;moon.angle=math.radians(1.2)
    key=bpy.data.objects.new('Moon · cool key',moon);bpy.context.collection.objects.link(key)
    key.rotation_euler=Vector((.55,-.62,-.58)).to_track_quat('-Z','Y').to_euler()
    light('Moon · sky fill',(-3,-9,6),(.55,.66,1),60,10,(0,0,.6))
    light('Rim · behind the island',(3,9,4.5),(.50,.66,1),1500 if city_scene else 2100,6,(0,0,.4))
    if not city_scene:scene.view_settings.exposure=.68
    light('Rim · left cliff edge',(-9,3,1),(.45,.60,1),700,5,(0,0,-1.2))
    # The lip overhangs the cliff, so a low, cool bounce models its beds and
    # roots the way a little moonlit cloud cover would.
    light('Cliff · low moon bounce',(1.5,-9,-4.5),(.55,.66,1),520,9,(0,0,-1.6))
    light('Cliff · right edge',(9,-2,-1),(.62,.70,1),450,5,(0,0,-1.4))
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


# What stays on when a room's lights are switched off: the moonlit night rig,
# the night through the windows, screens, and the clock's softly illuminated
# face and phosphorescent indexes. Night lights ("Glow ·") go dark.
STAYS_LIT=('Moon','Rim','Cliff','Sky','Monitor','Night ·','City')
UNSWITCHED_MATERIALS=('Screen','Monitor','Window','display','backlight','Omega clock ·')
# What dims rather than staying at full brightness with the lights off: the
# iPad's screen (to a faint glow, its glass dark so the spotlight cannot
# light its picture) and its Magic Keyboard's backlight.
DIMMED={'iPad Pro · Screen display':.06,'Magic Keyboard · key backlight':.06}
# With the lights off, one spotlight picks out what each room is about: the
# open notebook on the study's desk, the computer on the workshop's bench.
# Points are in each turned furniture group's own space (see writing() and
# workshop()), with where the lamp hangs relative to them.
SPOTLIGHT={'writing':('Study · gently turned desk',(.16,-.80,1.614),(0,-.9,3.4),30,180),
           'projects':('Workshop · turned workbench',(.90,.05,1.85),(0,-1.5,3.1),26,200)}
if refined('writing','notebook_focus'):
    SPOTLIGHT['writing']=('Study · gently turned desk',(.16,-.80,1.614),(-1.6,1.8,3.4),38,150)


def subject_spotlight(world):
    """The spotlight that picks out a room's subject with its lights off."""
    if world not in SPOTLIGHT:return
    group,point,offset,cone,energy=SPOTLIGHT[world]
    target=bpy.data.objects[group].matrix_world@Vector(point)
    data=bpy.data.lights.new('Spotlight · '+world,'SPOT')
    data.color=(1,.90,.76);data.energy=energy;data.spot_size=math.radians(cone);data.spot_blend=.45;data.shadow_soft_size=.08
    if world=='writing' and refined('writing','notebook_focus'):
        data.color=(.70,.80,1);data.spot_blend=.78;data.shadow_soft_size=.18
    spot=bpy.data.objects.new('Spotlight · '+world,data);bpy.context.collection.objects.link(spot)
    spot.location=target+Vector(offset)
    spot.rotation_euler=(target-spot.location).to_track_quat('-Z','Y').to_euler()


def switched(mat):
    """Whether switching the room's lights off changes this material's glow."""
    if not mat or not mat.use_nodes:return False
    if mat.name in DIMMED:return True
    if any(word in mat.name for word in UNSWITCHED_MATERIALS):return False
    bs=mat.node_tree.nodes.get('Principled BSDF')
    return bool(bs and bs.inputs['Emission Strength'].default_value>0)


def lights_out(scene,world):
    """The same night with the room's lights switched off: lamps, bulbs,
    festoons, night lights and their glow go dark; moonlight, windows and
    screens stay (the iPad's and its keyboard backlight dim), and a
    spotlight falls on the room's subject."""
    for obj in list(scene.objects):
        if (obj.type=='LIGHT' and not obj.name.startswith(STAYS_LIT)) or '· haze' in obj.name:
            bpy.data.objects.remove(obj,do_unlink=True)
    subject_spotlight(world)
    for mat in bpy.data.materials:
        if mat.name in DIMMED:
            bs=mat.node_tree.nodes['Principled BSDF']
            bs.inputs['Emission Strength'].default_value*=DIMMED[mat.name]
            # Only the glow carries the picture; the glass itself stays dark.
            for link in list(bs.inputs['Base Color'].links):mat.node_tree.links.remove(link)
            bs.inputs['Base Color'].default_value=(.02,.02,.022,1)
            continue
        if not mat.use_nodes or any(word in mat.name for word in UNSWITCHED_MATERIALS):continue
        bs=mat.node_tree.nodes.get('Principled BSDF')
        if bs and bs.inputs['Emission Strength'].default_value>0:
            bs.inputs['Emission Strength'].default_value=0
            # An unlit bulb is frosted glass, not a white-hot one.
            bs.inputs['Base Color'].default_value=(.32,.30,.27,1)


# What a room's switch turns on and off, grouped as the site times them
# (lib/light-switch.ts), each by the names its lights and glowing parts start
# with. 'spot' is the lights-off spotlight on the room's subject.
LIGHT_SOURCES={
    'writing':[('lamp',('Arundel lamp','Lamp · frosted diffuser')),('sconce',('Up Down Sconce',)),
               ('shelves',('Bookshelf',)),('lava',('Glow · lava lamp','Lava lamp')),
               ('tree',('Tree uplight',)),('spot',('Spotlight',))],
    'projects':[('lamp',('Eave lamp',)),('luca',('Luca sconce',)),('purple',('Glow · purple','Glow · post','Glow · roof beam')),
                ('gold',('Glow · gold','Glow · bench edge')),('festoon',('Festoon',)),
                ('task',('Workshop · task strip','Workshop · practical LED strip','Court floodlight')),('ball',('Lightstick',)),
                ('devices',('iPad Pro','Magic Keyboard','Cybertruck model','Scooter','Shadow box','Starship display')),('spot',('Spotlight',))],
}


def light_masks(scene,world,output):
    """Each light source's share of the room's light, pixel by pixel, so one
    switch can bring each fixture on in its own way: the site eases every
    pixel between the lights-on and lights-off stills at the pace of the
    sources lighting it. Every source group is rendered alone (its lamps
    and glowing parts on, everything else dark), and its share is its
    luminance over all the groups', smoothed. Written as RGB PNGs, three
    groups each, with a JSON list of the groups in channel order."""
    import numpy as np
    subject_spotlight(world)
    groups=LIGHT_SOURCES[world]
    group_of=lambda name:next((g for g,prefixes in groups if name.startswith(prefixes)),None)
    # Flickers are keyframed; each group is rendered at its frame-1 strength.
    scene.frame_set(1)
    lights,glows={},{}
    for obj in scene.objects:
        if obj.type=='LIGHT' and not obj.name.startswith(STAYS_LIT):lights[obj]=obj.data.energy
        elif obj.type in {'MESH','CURVE'}:
            for slot in obj.material_slots:
                if not switched(slot.material):continue
                # A copy for this object alone, so each glow can be lit alone.
                mat=slot.material.copy();slot.link='OBJECT';slot.material=mat
                if mat.node_tree.animation_data:mat.node_tree.animation_data_clear()
                bs=mat.node_tree.nodes['Principled BSDF'];glows.setdefault(obj,[]).append((bs,bs.inputs['Emission Strength'].default_value))
    for obj in lights:
        if obj.data.animation_data:obj.data.animation_data_clear()
    unassigned=sorted({o.name.split('.')[0] for o in [*lights,*glows] if group_of(o.name) is None})
    if unassigned:raise ValueError('Light sources with no group in LIGHT_SOURCES: '+', '.join(unassigned))
    # Everything else is dark: the night rig, the sky and every other glow.
    for obj in scene.objects:
        if obj.type=='LIGHT' and obj not in lights:obj.hide_render=True
    background=scene.world.node_tree.nodes.get('Background') if scene.world and scene.world.use_nodes else None
    if background:background.inputs[1].default_value=0
    owned={bs for parts in glows.values() for bs,_ in parts}
    for mat in bpy.data.materials:
        bs=mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
        if bs and bs not in owned:bs.inputs['Emission Strength'].default_value=0
    unseen_lights(scene)
    scene.render.image_settings.file_format='OPEN_EXR';scene.render.image_settings.color_depth='32'
    luminance=[]
    for name,_ in groups:
        for obj,energy in lights.items():obj.data.energy=energy if group_of(obj.name)==name else 0
        for obj,parts in glows.items():
            for bs,strength in parts:bs.inputs['Emission Strength'].default_value=strength if group_of(obj.name)==name else 0
        path=output/f'{world}-light-{name}.exr'
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        image=bpy.data.images.load(str(path))
        w,h=image.size
        pixels=np.array(image.pixels[:],dtype=np.float32).reshape(h,w,4)[::-1]
        bpy.data.images.remove(image)
        l=np.clip(pixels[...,0]*.2126+pixels[...,1]*.7152+pixels[...,2]*.0722,0,None)
        # A few box passes: the shares are read as soft regions, not grain.
        for _ in range(3):
            padded=np.pad(l,2,mode='edge')
            l=sum(padded[dy:dy+h,dx:dx+w] for dy in range(5) for dx in range(5))/25
        luminance.append(l)
    total=sum(luminance)
    floor=.03*float(np.percentile(total[total>0],99)) if (total>0).any() else 1
    shares=[l/np.maximum(total,floor) for l in luminance]
    files=[]
    for i in range(0,len(shares),3):
        chunk=shares[i:i+3]+[np.zeros_like(shares[0])]*(3-len(shares[i:i+3]))
        rgba=np.dstack([*chunk,np.ones_like(chunk[0])])[::-1].astype(np.float32)
        image=bpy.data.images.new(f'{world}-light-masks-{i//3}',w,h,alpha=False)
        image.colorspace_settings.name='Non-Color'
        image.pixels[:]=rgba.ravel()
        path=output/f'{world}-light-masks-{i//3}.png'
        image.filepath_raw=str(path);image.file_format='PNG';image.save()
        files.append(path.name)
    (output/f'{world}-light-masks.json').write_text(json.dumps({'sources':[g for g,_ in groups],'files':files},indent=2)+'\n')
    print(f'MASKS {world}: {", ".join(g for g,_ in groups)}',flush=True)


def daylight(scene):
    """Re-light a finished scene for a clear Taipei afternoon."""
    # A physically based clear sky lights the scene and is what the glass
    # reflects; the sun lamp carries the direct light and crisp shadows.
    world=scene.world.node_tree;background=world.nodes['Background']
    sky=world.nodes.new('ShaderNodeTexSky')
    try: sky.sky_type='MULTIPLE_SCATTERING'
    except Exception: pass
    sky.sun_elevation=math.radians(37);sky.sun_rotation=math.radians(-132);sky.sun_disc=False
    sky.altitude=200;sky.air_density=1.0;sky.aerosol_density=1.4
    world.links.new(sky.outputs['Color'],background.inputs[0]);background.inputs[1].default_value=.24
    scene.view_settings.exposure=-.2
    for obj in list(scene.objects):
        if obj.type=='LIGHT' or obj.name.startswith(('Traffic · light trail','Night · ')):
            bpy.data.objects.remove(obj,do_unlink=True)
    # A lower, warmer afternoon sun: long crisp shadows give the blocks depth.
    sun=bpy.data.lights.new('Sun · afternoon','SUN');sun.color=(1,.92,.80);sun.energy=4.8;sun.angle=math.radians(1.2)
    key=bpy.data.objects.new('Sun · afternoon',sun);bpy.context.collection.objects.link(key)
    key.rotation_euler=Vector((.55,.62,-.42)).to_track_quat('-Z','Y').to_euler()
    light('Sky · cool fill',(-4,-9,7),(.62,.74,1),120,10,(0,0,.5))
    light('Cliff · ground bounce',(1.5,-9,-4.5),(.75,.72,.62),380,9,(0,0,-1.6))
    # Lit glazing becomes daytime glass; lamps and trails switch off.
    glass={'Warm occupied offices':(.07,.12,.12),'Cool occupied offices':(.09,.14,.15),'Dim occupied offices':(.08,.11,.11),
           'City · lamplit apartment':(.10,.12,.13),'City · lit arcade shopfront':(.14,.13,.11),
           'Taipei 101 · evenly lit glazing':(.055,.118,.112)}
    for mat in bpy.data.materials:
        if not mat.use_nodes:continue
        bs=mat.node_tree.nodes.get('Principled BSDF')
        if not bs:continue
        bs.inputs['Emission Strength'].default_value=0
        if mat.name in glass:
            bs.inputs['Base Color'].default_value=(*glass[mat.name],1)
            bs.inputs['Metallic'].default_value=.45;bs.inputs['Roughness'].default_value=.18
        elif mat.name.startswith(('City · sodium','Taipei 101 · gold','Xiangshan · lamplit','Warm practical')):
            bs.inputs['Base Color'].default_value=(.32,.33,.32,1)
    if refined('work','day_materials'):
        road=textured('City · charcoal asphalt',(.018,.022,.025),(.04,.044,.046),'stone',rough=.95)
        for obj in scene.objects:
            if obj.type=='MESH' and obj.name.startswith('Street · asphalt'):
                obj.data.materials.clear();obj.data.materials.append(road)
        for mat in bpy.data.materials:
            if mat.name.startswith('City · grey mineral'):
                # Keep the weathering graph: its unlinked source colour feeds
                # the facade, rather than the now-connected BSDF default.
                for node in mat.node_tree.nodes:
                    if node.type=='HUE_SAT' and not node.inputs['Color'].is_linked:
                        node.inputs['Color'].default_value=(.25,.235,.20,1)
            if mat.name.startswith(('Blue green architectural','Taipei · green architectural')):
                mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.20


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
    # Work also has a daytime version, toggled on the site; same camera and
    # geometry, so its interaction anchors are identical to the night render.
    # Day (Work's clear afternoon) and dark (a room with its lights off) both
    # relight the saved night scene, so they share its geometry and camera.
    # lifted and lifted-dark are the study with its notebook lifted away (lights
    # on or off): what stays on the desk while the Writing entry carries it off.
    # masks renders each light source alone for the site's light switch.
    parser.add_argument('--time',choices=['night','day','dark','lifted','lifted-dark','masks'],default='night')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    args.output.mkdir(parents=True,exist_ok=True)
    sources=ROOT/'artwork'/'blender'
    sources.mkdir(parents=True,exist_ok=True)
    for world in (['work','writing','projects'] if args.world=='all' else [args.world]):
        if args.time!='night':
            # Day and dark relight the saved night scene itself, so they share
            # exactly the same geometry, camera and therefore interaction anchors.
            bpy.ops.wm.open_mainfile(filepath=str(sources/f'{world}.blend'))
            scene=bpy.context.scene
            scene.render.resolution_x=args.width;scene.render.resolution_y=round(args.width*2/3)
            scene.cycles.samples=args.samples
            if args.device=='METAL':
                prefs=bpy.context.preferences.addons['cycles'].preferences
                prefs.compute_device_type='METAL';prefs.get_devices()
                for dev in prefs.devices: dev.use=dev.type=='METAL'
                scene.cycles.device='GPU'
            if args.time=='day':daylight(scene)
            if args.time.startswith('lifted'):
                for obj in list(scene.objects):
                    if obj.name.startswith('Notebook'):bpy.data.objects.remove(obj,do_unlink=True)
            if args.time.endswith('dark'):lights_out(scene,world)
            repeatable(scene)
            if args.time=='masks':
                light_masks(scene,world,args.output)
                continue
            scene.render.filepath=str(args.output/f'{world}.png')
            unseen_lights(scene)
            bpy.ops.render.render(write_still=True)
            print(f'COMPLETED {world} {args.time}',flush=True)
            continue
        ANCHORS.clear(); WINDOWS.clear(); ANIMATED.clear()
        scene=setup(world,args.width,args.samples,args.engine,args.device)
        {'work':city,'writing':writing,'projects':workshop}[world]()
        scene.frame_set(1)
        sys.path.insert(0,str(Path(__file__).parent))
        from island_refinements import apply
        apply(world,globals())
        camera_and_lights(scene)
        if args.time=='day':daylight(scene)
        scene.frame_set(1)
        export_anchors(scene,world,args.output/f'{world}.json')
        scene.render.filepath=str(args.output/f'{world}.png')
        unseen_lights(scene)
        if args.time=='night':bpy.ops.wm.save_as_mainfile(filepath=str(sources/f'{world}.blend'),compress=True)
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
                unseen_lights(scene)
            bpy.ops.render.render(write_still=True)
        print(f'COMPLETED {world}',flush=True)


if __name__=='__main__':
    main()
