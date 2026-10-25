"""Optional, baked art direction. Switches live in island-refinements.json.

These edits run before camera fitting, anchor export and saving the scene.
Flight exports retain their existing mesh budget. No new browser lighting
or animation systems are introduced.
"""
import math

import bpy
from mathutils import Vector


def surfaces(prefix):
    return [mat for mat in bpy.data.materials if mat.name.startswith(prefix) and mat.use_nodes]


def tune(prefix, **values):
    for mat in surfaces(prefix):
        bs = mat.node_tree.nodes.get('Principled BSDF')
        if bs:
            for name, value in values.items():
                if not bs.inputs[name].is_linked:
                    bs.inputs[name].default_value = value


def lights(prefix, factor=1, size=None, blend=None):
    for obj in bpy.context.scene.objects:
        if obj.type != 'LIGHT' or not obj.name.startswith(prefix):
            continue
        obj.data.energy *= factor
        if size is not None:
            if obj.data.type == 'AREA':
                obj.data.size = size
            else:
                obj.data.shadow_soft_size = size
        if blend is not None and obj.data.type == 'SPOT':
            obj.data.spot_blend = blend


def assign(prefix, material):
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj.name.startswith(prefix):
            obj.data.materials.clear()
            obj.data.materials.append(material)


def jersey_relief():
    """Curve the cloth and every marking together; keep the genuine artwork."""
    import bmesh
    parts = [o for o in bpy.context.scene.objects if o.name.startswith('Jersey ·')]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.convert(target='MESH')
    for obj in [o for o in bpy.context.selected_objects if o.type == 'MESH']:
        if 'gold body' in obj.name or 'side panel' in obj.name:
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            bmesh.ops.triangulate(bm, faces=list(bm.faces))
            bmesh.ops.subdivide_edges(bm, edges=list(bm.edges), cuts=3, use_grid_fill=True)
            bm.to_mesh(obj.data)
            bm.free()
        inverse = obj.matrix_world.inverted()
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            point.y -= .010 + .004 * math.sin((point.x + .20) * 32) * math.sin((point.z - 1.99) * 4)
            vertex.co = inverse @ point
        for poly in obj.data.polygons:
            poly.use_smooth = True


def apply(world, api):
    on = lambda detail: api['refined'](world, detail)
    material, textured, box = api['material'], api['textured'], api['box']
    if world == 'projects':
        if on('screen_focus'):
            backing = material('Storage · charcoal screen backdrop', (.025, .031, .030), rough=.92)
            box('Storage · screen backdrop', (1.58, 1.86, 2.08), (2.14, .025, 1.28), backing, .006)
            lights('Monitor · reflected screen light', 2.8, .9)
            lights('Workshop · task strip', .65, 1.35)
            lights('Eave lamp · pool', .75, .10, .75)
        if on('collectibles'):
            shelf = material('Storage · satin graphite steel', (.12, .14, .15), metal=.6, rough=.55)
            assign(('Storage · steel shelf', 'Storage · shelf upright'), shelf)
            tune('Lugia', **{'Roughness': .58})
            # Keep the top-shelf order and all requested collectibles.
            for obj in bpy.context.scene.objects:
                if obj.name.startswith('Cybertruck model'):
                    obj.location.x += .06
                elif obj.name.startswith('JBL'):
                    obj.location.x -= .035
            lights('Lightstick', .7)
        if on('shield'):
            tune('Captain America shield · crimson', **{'Roughness': .46, 'Base Color': (.34, .015, .025, 1)})
            tune('Captain America shield · brushed silver', **{'Roughness': .43, 'Base Color': (.48, .53, .58, 1)})
            tune('Captain America shield · navy', **{'Roughness': .43})
        if on('jersey'):
            jersey_relief()
            lights('Shadow box · display light', .8, .35)
            glazing = material('Shadow box · quiet protective glazing', (.24, .27, .29), rough=.18)
            glazing.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = .035
            box('Shadow box · protective glazing', (-.20, 1.765, 2.38), (.70, .002, .94), glazing, 0)
        if on('roof'):
            roof = textured('Workshop · softly weathered zinc', (.075, .085, .086), (.19, .21, .21),
                            'metal', metal=.32, rough=.72, grain=(3, 18, 2))
            assign('Workshop · corrugated lean-to roof', roof)
            for obj in bpy.context.scene.objects:
                if obj.name.startswith('Workshop · corrugated lean-to roof'):
                    for polygon in obj.data.polygons:
                        polygon.use_smooth = True
            for x in [-3.0, -1.8, -.6, .6, 1.8, 2.95]:
                for y, z in [(2.23, 4.18), (1.38, 3.82)]:
                    api['sphere']('Roof · weathered fixing', (x, y, z), (.012, .012, .006), 'teal', 1)
        if on('scooter'):
            tune('Scooter · dark grey aluminium', **{'Base Color': (.085, .093, .105, 1), 'Roughness': .48})
        if on('device_materials'):
            tune('iPad Pro · Screen display', **{'Emission Strength': .7, 'Roughness': .22})
            tune('AirPods Max', **{'Roughness': .56})
            keys = material('Workstation · satin keycaps', (.024, .030, .035), rough=.62)
            assign('Workstation · key', keys)
        if on('court'):
            tune('Court · Lakers gold key', **{'Base Color': (.37, .19, .018, 1), 'Roughness': .83})
            tune('Court · white line paint', **{'Base Color': (.58, .58, .54, 1), 'Roughness': .75})
    elif world == 'writing':
        if on('notebook_focus'):
            # A broad reflected component from the same lamp group; all light
            # masks and the light switch inherit it automatically.
            group = bpy.data.objects['Study · gently turned desk']
            position = group.matrix_world @ Vector((-.55, -.40, 2.28))
            target = group.matrix_world @ Vector((.16, -.80, 1.65))
            api['light']('Arundel lamp · soft page bounce', position, api['WARM'], 23, .85, target)
            tune('Notebook · absorbed charcoal', **{'Base Color': (.012, .011, .009, 1)})
            practical = bpy.data.objects.get('Arundel lamp · pool of light')
            if practical:
                practical.data.spot_blend = .8
                practical.data.shadow_soft_size = .12
        if on('bookshelves'):
            page = material('Library · aged warm paper edges', (.55, .50, .40), rough=.96)
            assign('Library · page block', page)
            lights('Bookshelf · LED wash', .82, .10)
        if on('sconce'):
            lights('Up Down Sconce · beam up', .48, .10, .85)
            lights('Up Down Sconce · beam down', .75, .08, .75)
        if on('garden'):
            tune('Reading maple · maple_leaf', **{'Roughness': .91, 'Specular IOR Level': .16})
            lights('Tree uplight', .78, .09)
        if on('lounge'):
            # Subtle stretched grain adds cushion creases without more meshes.
            for mat in surfaces('Lounge chair · supple'):
                for node in mat.node_tree.nodes:
                    if node.type == 'VECT_MATH' and node.operation == 'MULTIPLY':
                        node.inputs[1].default_value = (2, 14, 3)
    elif world == 'work':
        if on('glazing'):
            tune('Warm occupied offices', **{'Emission Strength': .74})
            tune('Cool occupied offices', **{'Emission Strength': .56})
            tune('Taipei 101 · evenly lit glazing', **{'Metallic': .25, 'Roughness': .31})
        if on('traffic_hierarchy'):
            tune('Traffic · headlight trail', **{'Emission Strength': 2.8})
            tune('Traffic · taillight trail', **{'Emission Strength': 2.3})
        if on('hill'):
            tune('Xiangshan · lamplit stair trail', **{'Emission Strength': .6})
    if api['refined']('shared', 'geology'):
        # Narrow mineral accents and stronger depth falloff preserve detail
        # at the lip while letting the base recede into the site's sky.
        for mat in surfaces(('Weathered shale', 'Ochre mineral', 'Deep mineral')):
            api['fade_with_depth'](mat, bottom=-2.7, floor=.72)
    if api['refined']('shared', 'roots'):
        for obj in bpy.context.scene.objects:
            if obj.type == 'CURVE' and obj.name.startswith(('Cliff · exposed', 'Cliff · branching')):
                for spline in obj.data.splines:
                    for i, point in enumerate(spline.bezier_points):
                        point.radius = 1 - .88 * i / max(1, len(spline.bezier_points)-1)
