#!/usr/bin/env python3
"""Verify two masks on the actual q11220 draw without loading any new artwork."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
from urllib.parse import quote

spec = importlib.util.spec_from_file_location('fixed',Path(__file__).with_name('fixed-scenery.py'))
fixed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixed)
prepare = fixed.stage


def stage(repo, directory, deps, void):
    prepare(repo,directory,deps,void)
    p=directory/'src/main.ts'
    main=p.read_text()
    k='  renderer.render(scene,camera);'
    p.write_text(fixed.once(main,k,k+'''
    (window as any).q11220OwnerCheck=()=>{
     const b=buildings as any, state=b?.georgetownCohort,st=b?.stDavids;
     if(!state||!st?.variant.visible)return null;
     const {owner,mask}=state,original=mask.stockForProof(),old=owner.geometry;
     if(!original||original.index)return null;
     const mock=new THREE.Group();
     scene.add(mock);
     const court=mask.add(mock,[4617,4710],{vertices:31179,start:4617,end:4710});
     if(!court){mock.removeFromParent();return null;}
     const inspect=()=>({
       indices:owner.geometry.index?.count??null,
       neighbour:Array.from((owner.geometry.index?.array??[]) as ArrayLike<number>).filter(i=>i>=22203&&i<22245).length,
       courthouse:Array.from((owner.geometry.index?.array??[]) as ArrayLike<number>).filter(i=>i>=4617&&i<4710).length,
       church:Array.from((owner.geometry.index?.array??[]) as ArrayLike<number>).filter(i=>i>=14070&&i<14136).length,
       attributes:Object.keys(original.attributes).every(k=>owner.geometry.attributes[k]===original.attributes[k]),
       snapshot:mask.stockForProof()===original
     });
     const frame=()=>{
      renderer.render(scene,camera);return renderer.domElement.toDataURL();
     };
     try{
      const before=frame(),justChurch=inspect();
      court.sync(true);
      const both=inspect(); frame(); // upload both views before retiring
      st.variant.sync(false);
      const justCourthouse=inspect(); frame();
      court.sync(false);
      const originalUnindexed=owner.geometry===original&&!original.index;
      st.variant.sync(true);
      court.dispose();mock.removeFromParent();
      const after=frame();
      return {justChurch,both,justCourthouse,originalUnindexed,exactChurchMaskRestore:owner.geometry===old,
        churchRestored:st.variant.visible,maskVertices:original.attributes.position.count,
        imageExactAfterRetirement:before===after,glError:renderer.getContext().getError()};
     }finally{
       court.dispose();mock.removeFromParent();
     }
    };'''))


def capture(args,browser,url):
    pose=dict(lon=-62.5341,lat=46.18205,h=13,dist=75,east=-.5,south=.62,agl=11)
    page=browser.new_page(viewport={'width':576,'height':400})
    page.set_default_timeout(160000)
    errors=[]
    page.on('pageerror',lambda s:errors.append(str(s)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
    page.goto(url+'/?diagnostics&qa='+quote(json.dumps(pose)),wait_until='domcontentloaded')
    page.wait_for_function('window.islandAirDiagnostics?.stDavids===true && window.q11220OwnerCheck')
    d=page.evaluate('()=>window.q11220OwnerCheck()')
    for name,indices,church,court in [('justChurch',31113,0,93),('both',31020,0,0),('justCourthouse',31086,66,0)]:
        assert d[name]==dict(indices=indices,church=church,courthouse=court,neighbour=42,
                             attributes=True,snapshot=True),(name,d)
    assert d['maskVertices']==31179 and d['originalUnindexed'] and d['exactChurchMaskRestore'] and d['churchRestored']
    assert d['imageExactAfterRetirement'] and d['glError']==0,d
    assert not errors,errors
    (args.out/'report.json').write_text(json.dumps(d,indent=2)+'\n')
    print(json.dumps(d),flush=True)
    page.close()


fixed.stage=stage
fixed.capture=capture
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--checkout',type=Path,default=Path.cwd())
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--deps',type=Path)
parser.add_argument('--chromium',default=os.getenv('CHROMIUM','chromium'))
parser.set_defaults(void_probe=False)
fixed.run(parser.parse_args())
