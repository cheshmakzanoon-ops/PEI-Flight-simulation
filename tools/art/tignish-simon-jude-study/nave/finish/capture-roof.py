from pathlib import Path
import argparse,base64,hashlib,json,re,sys
from playwright.sync_api import sync_playwright
from PIL import Image
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--binary',required=True);p.add_argument('--out',type=Path,required=True)
a=p.parse_args();a.out.mkdir(exist_ok=False,parents=True);origin='http://127.0.0.1:4715'
rejected=[];errors=[];rows=[]
with sync_playwright() as api:
 b=api.chromium.launch(executable_path=a.binary,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
 page=b.new_page(viewport={'width':960,'height':640},device_scale_factor=1,service_workers='block')
 def refuse(r):rejected.append(r.request.url);r.abort()
 page.route(re.compile(r'^(?!'+re.escape(origin)+r'/)https?://'),refuse)
 page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  page.goto(origin+'/',wait_until='domcontentloaded')
  page.wait_for_function("()=>typeof window.peiNativeRoofFinish==='function'",timeout=60000)
  for variant in ('south','north','middle','overcast'):
   q=page.evaluate("(x)=>window.peiNativeRoofFinish(x)",variant)
   info=q['metadata'];values={};pngsha={}
   for label,uri in q['images'].items():
    assert uri.startswith('data:image/png;base64,')
    raw=base64.b64decode(uri.split(',',1)[1],validate=True);path=a.out/f'{variant}-{label}.png'
    path.write_bytes(raw);pngsha[label]=hashlib.sha256(raw).hexdigest()
    values[label]=np.asarray(Image.open(path)).astype(np.int16)
    assert values[label].shape==(640,960,4)
   assert not any(info['errors']) and info['rgbaBits']==[8]*4 and info['samples']==4
   assert len(set(map(tuple,info['stats'])))==1 and 0<info['stats'][0][1]<=58
   s,f,w,k,r=[values[x] for x in ('stock','finished','white-role','black-role','restore')]
   assert np.array_equal(s,r) and np.array_equal(s[:,:,3],f[:,:,3])
   scope=np.max(w[:,:,:3]-k[:,:,:3],axis=2)>0
   diff=np.max(abs(f[:,:,:3]-s[:,:,:3]),axis=2)
   assert not np.any((diff>0)&~scope) and scope.sum()>8000
   proof={k:int(v) for k,v in zip(('visible','changed','strong','exterior','alpha','restore'),
    (scope.sum(),(diff>0).sum(),(diff>3).sum(),((diff>0)&~scope).sum(),0,0))}
   assert proof==info['sum'],(proof,info['sum'])
   assert proof['strong']>max(300,scope.sum()*.025)
   out={**info,'pngSHA256':pngsha,'status':'detached scope and readback PASS, aesthetic review separate'}
   (a.out/f'{variant}.json').write_text(json.dumps(out,indent=2)+'\n')
   rows.append(variant);print(variant,proof,flush=True)
  assert not rejected and not errors,(rejected,errors)
 except BaseException as e:
  problem=repr(e);raise
 finally:
  (a.out/'index.json').write_text(json.dumps({'results':rows,'held':locals().get('problem'),'refused':rejected,'errors':errors},indent=2)+'\n')
  b.close()
