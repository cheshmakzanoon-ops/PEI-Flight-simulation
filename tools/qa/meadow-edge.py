"""Exact live combined opt guard in temporary QA app. Never modifies a checkout."""
from pathlib import Path
import importlib.util,json,hashlib,argparse,base64
from urllib.parse import quote
import numpy as np
from PIL import Image
D=Path(__file__).with_name('fixed-scenery.py')
spec=importlib.util.spec_from_file_location('fixed',D);f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
orig=f.stage
def stage(repo,root,deps,void_probe):
 orig(repo,root,deps,False)
 main=root/'src/main.ts';s=main.read_text()
 a='  if(world.tryonRockState==='
 s=f.once(s,a,'''
 (window as any).independentMeadowGuardQA=()=>{
  let from=(world as any).byId.get('22-12');
  const orth=(world as any).byId.get('22-13')?.local.uniforms;
  const v=world.meadowStrength;
  const capture=()=>{renderer.render(scene,camera);return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,png:renderer.domElement.toDataURL('image/png'),deviceSamples:renderer.getContext().getParameter(renderer.getContext().SAMPLES)}};
  v.value=0;const before=capture();v.value=1;const after=capture();
  let positions=(world as any).tiles as {id:string,lod:number,local:THREE.ShaderMaterial,status:string}[];
  return {before,after,ownerUsesMeadow:!!from?.local.uniforms.meadowStrength,ownerUsesBowley:!!from?.local.uniforms.bowleyViewport,
    tiles:positions.filter(x=>x.status==='ready').map(q=>[q.id,q.lod]).sort((a,b)=>(''+a[0]).localeCompare(''+b[0])),
    neighborSouthGuard:orth?.meadowTileGuard?.value,neighborSouthBounds:orth?.meadowTileBounds?.value?.toArray(),active:world.bowleyPond,requests:performance.getEntriesByType('resource').filter(r=>r.name.includes('bowley-2020-water.r8.gz')).length};
 };
 '''+a)
 main.write_text(s)
f.stage=stage
f.FLAGS+=['--renderer-process-limit=1']
P={
 'south-guard-edge':dict(lon=-62.71165771484375,lat=46.414545454545454,dist=44,east=.915,south=.4035,h=0,agl=14),
}
def go(args,browser,url):
 entries={}
 for name,target in P.items():
  for mode,flags in [('standard',''),('legacy','bowleySurveyPreview&'),('stock','stockBowleyPond&')]:
   tag=name+'-'+mode; page=browser.new_page(viewport={'width':600,'height':382})
   errs=[];req=[];page.on('request',lambda r:req.append(r.url) if r.url.endswith('/bowley-2020-water.r8.gz') else None)
   page.on('pageerror',lambda error:errs.append(str(error)))
   page.on('console',lambda c:errs.append(c.text) if c.type=='error' else None)
   page.set_default_timeout(130000)
   page.goto(url+'/?diagnostics&meadowTexture&'+flags+'qa='+quote(json.dumps(target)),wait_until='domcontentloaded')
   page.wait_for_function("""()=>window.reviewCamera?.frame>13 && window.islandAirDiagnostics?.detail?.ready>0 &&
       window.islandAirDiagnostics.detail.loading===0 && window.islandAirDiagnostics.buildings""")
   j=page.evaluate('window.independentMeadowGuardQA()');arr=[]
   for variant in ['before','after']:
    b=base64.b64decode(j[variant].pop('png').split(',',1)[1]);file=args.out/f'{tag}-{variant}.png';file.write_bytes(b)
    im=np.array(Image.open(file).convert('RGB')).astype(np.int16);arr.append(im);j[variant]['sha256']=hashlib.sha256(b).hexdigest()
   d=abs(arr[1]-arr[0]).max(2);j.update(errors=errs,pixelcount=d.size,anyChanged=int((d>0).sum()),over2=int((d>2).sum()),maxDelta=int(d.max()))
   j['requests']=len(req)
   assert j['requests']==int(mode!='stock') and not errs,j
   assert j['before']['draws']==j['after']['draws'] and j['before']['triangles']==j['after']['triangles'],j
   if mode=='legacy':
    assert j['active']=='bowley-pond-survey-2020' and j['ownerUsesBowley'] and not j['ownerUsesMeadow'] and j['neighborSouthGuard']&1,j
   else:
    assert j['ownerUsesMeadow'] and j['ownerUsesBowley']==(mode=='standard') and j['over2']>1000,j
    assert not(j['neighborSouthGuard']&1),j
   entries[tag]=j; print(tag,j,flush=True);page.close()
   (args.out/'results.json').write_text(json.dumps(entries,indent=2)+'\n')
f.capture=go
p=argparse.ArgumentParser()
p.add_argument('--checkout',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
p.add_argument('--chromium',required=True)
a=p.parse_args();a.deps=None;a.void_probe=False
f.run(a)
