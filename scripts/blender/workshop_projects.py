"""Add project objects to the existing workshop without replacing its belongings.

Called by build_islands.py for new builds, or run against the saved .blend:
blender -b projects.blend --python scripts/blender/workshop_projects.py -- --output DIR
The direct path preserves and verifies every pre-existing object before saving.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]


def add_projects(api):
    if any(o.get('workshop_project') for o in bpy.context.scene.objects):
        raise RuntimeError('Project objects already exist; use the saved pre-project baseline to revise them.')
    box, cylinder, sphere, rod, mesh, lettering, image_panel = [api[k] for k in
        ('box', 'cylinder', 'sphere', 'rod', 'mesh', 'lettering', 'image_panel')]
    P, material = api['P'], api['material']
    P['arcade_paint'] = material('Arcade · midnight enamel', (.025,.045,.105), metal=.3, rough=.38)
    P['arcade_trim'] = material('Arcade · turquoise trim', (.08,.65,.63), metal=.25, rough=.38)
    P['arcade_display'] = material('Arcade · display lettering', (.55,1,.88), emission=1.3)
    P['project_red'] = material('Project objects · vermilion', (.65,.035,.045), rough=.45)
    P['project_blue'] = material('Project objects · blue enamel', (.045,.085,.22), metal=.25, rough=.35)
    P['project_display'] = material('Project objects · display white', (.76,.90,1), emission=1.1)
    P['project_green'] = material('Project objects · display green', (.12,.8,.43), emission=.8)
    P['project_gold'] = material('Project objects · brass lettering', (.95,.62,.17), metal=.5, rough=.38)
    P['card_white'] = material('Playing cards · ivory stock', (.94,.92,.86), rough=.65)
    bench = bpy.data.objects['Workshop · turned workbench']

    def start(): return set(bpy.context.scene.objects)
    def finish(before, slug, anchor, desk=False):
        parts = set(bpy.context.scene.objects) - before
        root = bpy.data.objects.new('Workshop project · '+slug, None)
        bpy.context.collection.objects.link(root)
        root['workshop_project'] = slug
        root['anchor'] = anchor
        if desk: root.parent = bench
        for part in parts: part.parent = root
        return root

    def display(name, source, center, width, height):
        panel = image_panel(name, source, center, width, height)
        mat = panel.data.materials[0]
        bs = mat.node_tree.nodes['Principled BSDF']
        tex = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE')
        mat.node_tree.links.new(tex.outputs['Color'], bs.inputs['Emission Color'])
        bs.inputs['Emission Strength'].default_value = .75
        mat.name = name+' · display'
        return panel

    # A complete cabinet on the left shoulder, clear of the scooter, timber,
    # telescope and plant. Its silhouette is the familiar recessed CRT arcade.
    before = start()
    x,y,z = -3.86,.55,.10
    box('Arcade · stone footing',(x,y,z-.025),(1.18,1.1,.11),'stone',.035)
    profile = [(-.44,0),(.43,0),(.43,1.98),(-.14,1.98),(-.29,1.77),
               (-.18,1.13),(-.49,1.02),(-.49,.81),(-.32,.72)]
    for side in [-1,1]:
        vertices = [(x+side*.44+thick,y+py,z+pz) for thick in [-.035,.035] for py,pz in profile]
        n = len(profile)
        faces = [tuple(range(n)),tuple(reversed(range(n,2*n)))] + [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        mesh('Arcade · sculpted side panel',vertices,faces,'arcade_paint')
        for a,b in zip(profile,profile[1:]+profile[:1]):
            rod('Arcade · turquoise piping',(x+side*.478,y+a[0],z+a[1]),(x+side*.478,y+b[0],z+b[1]),.012,'arcade_trim')
    box('Arcade · back panel',(x,y+.41,z+.99),(.88,.045,1.98),'arcade_paint',.006)
    box('Arcade · top cap',(x,y+.13,z+1.97),(.88,.58,.035),'arcade_paint',.006)
    box('Arcade · front kickplate',(x,y-.30,z+.37),(.87,.055,.72),'arcade_paint',.012)
    box('Arcade · coin door',(x,y-.334,z+.44),(.22,.015,.27),'ink',.008)
    box('Arcade · coin slot',(x,y-.345,z+.49),(.10,.01,.016),'steel',.002)
    box('Arcade · control deck',(x,y-.30,z+.98),(.88,.40,.065),'arcade_paint',.016)
    rod('Arcade · joystick stem',(x-.22,y-.34,z+1.02),(x-.22,y-.34,z+1.14),.018,'steel')
    sphere('Arcade · red joystick',(x-.22,y-.34,z+1.16),(.055,.055,.055),'project_red',3)
    for dx,dy in [(.12,-.34),(.25,-.28),(.25,-.40)]:
        cylinder('Arcade · play button',(x+dx,y+dy,z+1.025),.036,.019,'arcade_trim',24)
    box('Arcade · recessed screen surround',(x,y-.145,z+1.44),(.86,.12,.68),'ink',.014)
    display('Arcade · Taipei Run game screen','project-shots/taipei-run.jpg',(x,y-.213,z+1.44),.75,.55)
    box('Arcade · illuminated marquee',(x,y-.20,z+1.86),(.87,.09,.19),'arcade_paint',.01)
    lettering('Arcade · TAIPEI RUN','TAIPEI RUN',(x,y-.248,z+1.86),.105,'arcade_display')
    lettering('Arcade · PLAY','PLAY',(x,y-.339,z+.68),.06,'arcade_display')
    finish(before,'taipei-run',(x,y-.25,z+1.43))

    # Keep the face-up desk cards, but use the original chip case for Poker
    # Odds. It already contains the chips, cards and dealer button.
    before = start()
    x,y,z=-.85,-.56,1.802
    for i,(rank,suit) in enumerate([('A','S'),('K','H'),('Q','S')]):
        cx=x+(i-1)*.15; cy=y+abs(i-1)*.028
        card=box('Poker · face-up card '+rank,(cx,cy,z+.006+i*.004),(.205,.30,.009),'card_white',.009)
        # Horizontal ink lies on the upper surface and is readable in camera.
        lettering('Poker · rank '+rank,rank,(cx-.061,cy+.10,z+.013+i*.004),.059,'project_red' if suit=='H' else 'ink',rotation=(0,0,0))
        if suit=='H':
            for dx in [-.023,.023]: sphere('Poker · heart lobe',(cx+dx,cy,z+.016+i*.004),(.033,.033,.0015),'project_red',2)
            mesh('Poker · heart point',[(cx-.054,cy,z+.016+i*.004),(cx+.054,cy,z+.016+i*.004),(cx,cy-.065,z+.016+i*.004)],[(0,1,2)],'project_red')
        else:
            lettering('Poker · spade', '\u2660',(cx,cy-.025,z+.014+i*.004),.13,'ink',rotation=(0,0,0))
    for part in start()-before: part.parent=bench
    case=[o for o in bpy.context.scene.objects if o.name.startswith('Chip case ·')]
    root=bpy.data.objects.new('Workshop project · poker-odds',None)
    bpy.context.collection.objects.link(root)
    root.parent=bench
    root['workshop_project']='poker-odds'
    for part in case: part.parent=root
    bpy.context.view_layer.update()
    tray=bpy.data.objects['Chip case · felt chip tray']
    root['anchor']=tuple(tray.matrix_local.translation+Vector((0,0,.06)))

    # A rising stock chart replaces the Taipei Run print above the tools.
    before=start()
    x,y,z=-1.36,1.80,2.55
    P['stock_grid']=material('Stocker · quiet grid',(.045,.075,.065),rough=.7)
    box('Stocker · wall frame',(x,y,z),(.78,.04,.50),'steel',.008)
    box('Stocker · chart face',(x,y-.025,z),(.72,.012,.44),'ink',.003)
    for dz in [-.14,-.04,.06,.16]:
        rod('Stocker · horizontal grid',(x-.31,y-.033,z+dz),(x+.31,y-.033,z+dz),.002,'stock_grid',6)
    for dx in [-.30,-.15,0,.15,.30]:
        rod('Stocker · vertical grid',(x+dx,y-.033,z-.16),(x+dx,y-.033,z+.16),.002,'stock_grid',6)
    chart=[(x+dx,y-.040,z+dz) for dx,dz in [(-.30,-.14),(-.24,-.11),(-.19,-.13),(-.13,-.04),(-.06,-.06),(.01,.02),(.08,-.01),(.16,.08),(.23,.07),(.30,.16)]]
    for a,b in zip(chart,chart[1:]): rod('Stocker · rising chart',a,b,.008,'project_green',10)
    for p in chart[1:-1]: sphere('Stocker · chart joint',p,(.008,.008,.008),'project_green',1)
    root=finish(before,'stocker',(x,y-.04,z))
    # Project these same vertices for the browser's green hover highlight.
    root['chart']=json.dumps({'screen':[(x-.36,y-.04,z+.22),(x+.36,y-.04,z+.22),(x+.36,y-.04,z-.22),(x-.36,y-.04,z-.22)],'line':chart})

    # Folded map with drawn streets and a red destination pin.
    before=start()
    x,y,z=2.02,.33,1.806
    for i in range(3):
        xx=x+(i-1)*.18
        leaf=box('Taipei guide · map fold',(xx,y,z+(.017 if i==1 else .006)),(.18,.49,.006),'paper',.002)
        leaf.rotation_euler.y=math.radians(7 if i==0 else -7 if i==2 else 0)
    for dx in [-.18,-.05,.10,.22]: rod('Taipei guide · street',(x+dx,y-.21,z+.028),(x+dx,y+.21,z+.028),.005,'brass',6)
    for dy in [-.12,.01,.14]: rod('Taipei guide · street',(x-.25,y+dy,z+.028),(x+.25,y+dy,z+.028),.005,'brass',6)
    lettering('Taipei guide · title','TAIPEI',(x,y-.185,z+.038),.062,'ink',rotation=(0,0,0))
    rod('Taipei guide · destination pin',(x+.10,y+.05,z+.03),(x+.10,y+.05,z+.13),.009,'project_red')
    sphere('Taipei guide · pin head',(x+.10,y+.05,z+.145),(.032,.032,.032),'project_red',2)
    finish(before,'taipei-guide',(x,y,z+.045),desk=True)

    before=start()
    x,y,z=-3.06,1.24,3.12
    box('886 Studios · plaque backing',(x,y,z),(.56,.07,.37),'teal',.012)
    lettering('886 Studios · numerals','886',(x,y-.04,z+.04),.19,'project_gold')
    lettering('886 Studios · name','STUDIOS',(x,y-.04,z-.112),.051,'paper')
    finish(before,'886-studios',(x,y-.04,z))

    before=start()
    x,y,z=-2.10,.37,1.80
    box('Night night Ko · clock foot',(x,y,z+.025),(.29,.20,.05),'project_blue',.02)
    clock=cylinder('Night night Ko · round clock',(x,y,z+.22),.19,.075,'project_blue',64,bevel=.01);clock.rotation_euler.x=math.pi/2
    face=cylinder('Night night Ko · clock face',(x,y-.043,z+.22),.166,.004,'ink',64,bevel=0);face.rotation_euler.x=math.pi/2
    # A raised crescent made from a curved ribbon, rather than obscuring
    # geometry with another disc; its warm surface catches the desk lamp.
    verts=[]
    for i in range(33):
        t=math.pi/2+math.pi*i/32
        verts.extend([(x-.025+.116*math.cos(t),y-.047,z+.24+.116*math.sin(t)),
                      (x+.018+.073*math.cos(t),y-.047,z+.24+.116*math.sin(t))])
    mesh('Night night Ko · crescent',verts,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(32)],'project_gold')
    lettering('Night night Ko · sleep','z z',(x+.058,y-.049,z+.27),.054,'project_display')
    finish(before,'night-night-ko',(x,y-.05,z+.22),desk=True)
    bpy.context.view_layer.update()


def fingerprint(obj):
    return {'matrix':[round(v,7) for row in obj.matrix_world for v in row],
            'data':obj.data.name if obj.data else None,
            'vertices':len(obj.data.vertices) if obj.type=='MESH' else None,
            'materials':[slot.material.name if slot.material else None for slot in obj.material_slots]}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--width',type=int,default=1440)
    parser.add_argument('--samples',type=int,default=24)
    opts=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    sys.path.insert(0,str(Path(__file__).parent))
    import build_islands as build
    scene=bpy.context.scene
    bpy.context.view_layer.update()
    before={o.name:fingerprint(o) for o in scene.objects}
    build.palette()
    add_projects(vars(build))
    for name,state in before.items():
        assert name in scene.objects and fingerprint(scene.objects[name])==state, 'Changed existing object: '+name
    print(f'PRESERVED all {len(before)} existing objects; added {len(scene.objects)-len(before)} project objects',flush=True)
    opts.output.mkdir(parents=True,exist_ok=True)
    scene.render.resolution_x=opts.width;scene.render.resolution_y=round(opts.width*2/3)
    scene.cycles.samples=opts.samples
    prefs=bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type='METAL';prefs.get_devices()
    for device in prefs.devices:device.use=device.type=='METAL'
    scene.cycles.device='GPU'
    build.repeatable(scene)
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'artwork/blender/projects.blend'),compress=True)
    scene.render.filepath=str(opts.output/'projects.png')
    build.unseen_lights(scene)
    bpy.ops.render.render(write_still=True)
