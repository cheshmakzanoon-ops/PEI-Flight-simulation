#!/usr/bin/env python3
"""Pair actual Three.js bridge parapet views with frozen-scene controls."""
from argparse import ArgumentParser
from base64 import b64decode
from importlib.util import spec_from_file_location, module_from_spec
import json
from pathlib import Path
from subprocess import check_output
from urllib.parse import quote

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation

p=ArgumentParser(description=__doc__)
p.add_argument('--checkout', required=True, type=Path)
p.add_argument('--out', required=True, type=Path)
p.add_argument('--deps', type=Path)
p.add_argument('--chromium', required=True)
p.add_argument('--base', default='99af11593f50e9582aaa1833cff3ef25dd859212')
p.add_argument('--views', default='along-deck,pei-crossing,navigation')
p.set_defaults(void_probe=False)
args=p.parse_args()
sp=spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed=module_from_spec(sp)
sp.loader.exec_module(fixed)
stage_baseline=fixed.stage
eyes={
 'along-deck':dict(lon=-63.7168533345945,lat=46.240893519094,dist=38,east=-.632357836,
                  south=.774988753,fixedBaseH=41.27,fixedEyeY=43.05,h=0,agl=0),
 'pei-crossing':dict(lon=-63.70806767978029,lat=46.248696882406826,dist=53,east=1.084728361,
                     south=.231871481,fixedBaseH=28.231421117,fixedEyeY=32.761421117,h=0,agl=0),
 'navigation':dict(lon=-63.753140856209,lat=46.209203912983,dist=79,east=-.443002887,
                   south=-1.016930893,fixedBaseH=59.005357927,fixedEyeY=67.535357927,h=0,agl=0),
}
def stage(repo, root, deps, void):
    stage_baseline(repo,root,deps,void)
    (root/'src/render/qa-bridge-baseline.ts').write_bytes(check_output(
        ['git','show',args.base+':src/render/confederation.ts'],cwd=repo))
    main=root/'src/main.ts'
    code="import {addConfederationBridge as baselineBridge} from './render/qa-bridge-baseline.ts';\n"+main.read_text()
    code=fixed.once(code,' addConfederationBridge(scene);', ''' const baseline=baselineBridge(scene),
      revised=addConfederationBridge(scene),mark=new THREE.MeshBasicMaterial({color:0xff00ef,side:THREE.DoubleSide,toneMapped:false});
      revised.visible=false;''')
    anchor='  renderer.render(scene,camera);'
    code=fixed.once(code,anchor,anchor+'''
      (window as any).bridgeParapetFrames=()=>{
       const shots={};
       try {
        for(const [key,preview,mask] of [
          ['stock',false,false],['new',true,false],['new-mask',true,true],['stock-mask',false,true],['replay',false,false],
        ] as const){
         baseline.visible=!preview;revised.visible=preview;
         const edge=(preview?revised:baseline).children[1] as THREE.Mesh,original=edge.material;
         if(mask)edge.material=mark;
         try{
          renderer.render(scene,camera);
          shots[key]={canvas:renderer.domElement.toDataURL('image/png'),
             calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
         }finally{edge.material=original;}
        }
       }finally{baseline.visible=true;revised.visible=false;}
       return shots;
      };
    ''')
    main.write_text(code)
fixed.stage=stage

def capture(a,browser,url):
    report={}
    for id in a.views.split(','):
        pose=eyes[id]
        page=browser.new_page(viewport={'width':1000,'height':600},device_scale_factor=1)
        errors=[]
        try:
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
            page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
            page.wait_for_function('window.bridgeParapetFrames&&window.islandAirDiagnostics?.mainland&&window.reviewCamera?.frame>21',
                                   timeout=120000)
            result=page.evaluate('window.bridgeParapetFrames()')
            images={}
            for label,item in result.items():
                path=a.out/(id+'-'+label+'.png')
                path.write_bytes(b64decode(item.pop('canvas').split(',',1)[1]))
                images[label]=np.asarray(Image.open(path).convert('RGB'),dtype=np.int16)
            def magenta(label):
                c=images[label]
                return (c[:,:,0]>220)&(c[:,:,1]<24)&(c[:,:,2]>205)
            scope=binary_dilation(magenta('stock-mask')|magenta('new-mask'),iterations=4)
            assert np.array_equal(images['stock'],images['replay']), id
            delta=np.abs(images['stock']-images['new']).max(2)
            changed=int(np.count_nonzero(delta>2))
            outside=int(np.count_nonzero((delta>2)&~scope))
            assert changed>200 and outside==0 and not errors,(id,changed,outside,errors)
            assert result['stock']['calls']==result['new']['calls'],result
            report[id]={'pose':pose,'changedAbove2':changed,'outside':outside,'counts':result}
            (a.out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
            print(id,report[id],flush=True)
        finally:
            page.close()
fixed.capture=capture
fixed.run(args)
