"""Call the unchanged runtime GLSL in this app's real browser renderer."""
import argparse,importlib.util,json
from pathlib import Path
from urllib.parse import quote
import shutil
p=Path(__file__).resolve()
s=importlib.util.spec_from_file_location('fixed',p.parent/'fixed-scenery.py')
fixed=importlib.util.module_from_spec(s);s.loader.exec_module(fixed)
seed=fixed.stage
def stage(repo,t,deps,void):
 seed(repo,t,deps,False)
 shutil.copyfile(Path(__file__).with_name('province-field-corner-probe.ts'),t/'src/qa-field-corner-probe.ts')
 m=t/'src/main.ts';text=m.read_text()
 text="import {runFieldCornerProbe} from './qa-field-corner-probe.ts';\n"+text
 anchor=' const [provinceReader,relief,owners]=await Promise.all([provinceJob,reliefJob,ownersJob]);'
 m.write_text(fixed.once(text,anchor,anchor+"\n if(provinceReader)(window as any).fieldCornerQA=()=>runFieldCornerProbe(renderer,provinceReader);"))
def capture(a,b,u):
 p=b.new_page(viewport={'width':500,'height':310},device_scale_factor=1)
 errors=[]
 p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda e:errors.append(e.text)if e.type=='error'else None)
 q=dict(lon=-63.29354354,lat=46.43560867,dist=58,east=.66,south=.75,h=9,agl=36)
 p.goto(u+'/?diagnostics&provinceFieldsReview&qa='+quote(json.dumps(q)),wait_until='domcontentloaded')
 p.wait_for_function('!!window.fieldCornerQA&&typeof window.islandAirDiagnostics===\'object\'',timeout=150000)
 z=p.evaluate('async()=>window.fieldCornerQA()')
 assert not errors,errors
 (a.out/'exact-gpu-corner.json').write_text(json.dumps(z,indent=2)+'\n')
 print(json.dumps(z),flush=True);p.close()
fixed.stage=stage;fixed.capture=capture
q=argparse.ArgumentParser();q.add_argument('--checkout',type=Path,required=True);q.add_argument('--chromium',required=True);q.add_argument('--out',type=Path,required=True)
o=q.parse_args();o.deps=None;o.size='500x310';o.void_probe=False;o.pose_baseline=None;fixed.run(o)
