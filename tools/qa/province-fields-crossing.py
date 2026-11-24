"""Fly a real four-shard corner; suppress only one exact lawful range in the fault case."""
import argparse,functools,gzip,http.server,json,math,re,shutil,struct,subprocess,tempfile,threading
from pathlib import Path
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout',type=Path,default=Path.cwd());p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
a=p.parse_args();repo=a.checkout.resolve();out=a.out.resolve();out.mkdir(parents=True,exist_ok=True)
ix=gzip.decompress((repo/'public/world/fields-province/index.fcr.gz').read_bytes())
_,_,packs,rows,_=struct.unpack_from('<4sHHHH',ix)
target=None
for k in range(rows):
 x,z,pk,_,ofs,length=struct.unpack_from('<hhHHII',ix,12+36*packs+80*k)
 if (x,z)==(-7,7):target=(pk,ofs,ofs+length-1);break
assert target
with tempfile.TemporaryDirectory(prefix='pei-field-flight-corner-') as td:
 t=Path(td)
 for n in ('index.html','package.json','package-lock.json','vite.config.ts','tsconfig.json'):shutil.copyfile(repo/n,t/n)
 for n in ('node_modules','public'):(t/n).symlink_to(repo/n,target_is_directory=True)
 shutil.copytree(repo/'src',t/'src')
 r=math.pi/180;radius=6378137*r;phi=46.5*r;e=.00669437999014;k=1-e*math.sin(phi)**2
 sx=radius*math.cos(phi)/math.sqrt(k);sz=radius*(1-e)/k**1.5
 x,z=-7313,7058;heading=math.degrees(math.atan2(290,-220))%360
 site=dict(id='qa-crop-corner',name='Field corner rehearsal',region='Queens County',lon=-63.2+x/sx,lat=46.5-z/sz,heading=heading,height=68,note='Private flight regression')
 m=t/'src/sim/places.ts';v=m.read_text();mark='export const SITES: Site[] = ['
 assert v.count(mark)==1;m.write_text(v.replace(mark,mark+'\n '+json.dumps(site)+','))
 q=t/'vite.config.ts';q.write_text(q.read_text().replace("base:'./',","base:'./',publicDir:false,"))
 with (out/'build.log').open('w')as log:
  subprocess.run(['node','node_modules/vite/bin/vite.js','build'],cwd=t,check=True,stdout=log,stderr=subprocess.STDOUT)
 dist=t/'dist'
 for f in (t/'public').iterdir():(dist/f.name).symlink_to(f.resolve(),target_is_directory=f.is_dir())
 class Server(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*_):pass
  def translate_path(self,path):
   mode=path.split('/',2)
   return super().translate_path('/'+mode[2] if len(mode)==3 and mode[1]in ('stock-range','missing-range')else '/no-file')
  def do_GET(self):
   m=re.search(r'/fields-province/crop-(\d+)\.pack$',self.path)
   if not m:return super().do_GET()
   data=Path(self.translate_path(self.path)).read_bytes()
   rg=re.fullmatch(r'bytes=(\d+)-(\d+)',self.headers.get('Range',''))
   if not rg:return super().do_GET()
   lo,hi=map(int,rg.groups());idx=int(m[1])
   if lo<0 or lo>hi or hi>=len(data):self.send_error(416);return
   if self.path.startswith('/missing-range/')and (idx,lo,hi)==target:self.send_error(404);return
   self.send_response(206);self.send_header('Content-Range',f'bytes {lo}-{hi}/{len(data)}')
   self.send_header('Content-Length',str(hi-lo+1));self.end_headers()
   try:self.wfile.write(data[lo:hi+1])
   except (BrokenPipeError,ConnectionResetError):pass
 with http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Server,directory=str(dist))) as server,sync_playwright()as pw:
  threading.Thread(target=server.serve_forever,daemon=True).start()
  b=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-gpu-blocklist'])
  try:
   rows=[]
   for mode,expected in [('stock-range',4),('missing-range',3)]:
    page=b.new_page(viewport={'width':460,'height':310});page.set_default_timeout(150000)
    errors=[];pack_res=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda e:errors.append(e.text)if e.type=='error'and not(mode=='missing-range'and '/fields-province/crop-'in e.location.get('url',''))else None)
    page.on('response',lambda r:pack_res.append(r.status)if '/fields-province/crop-'in r.url else None)
    page.goto(f'http://127.0.0.1:{server.server_port}/{mode}/?diagnostics&provinceFieldsReview&departure=qa-crop-corner',wait_until='domcontentloaded')
    page.wait_for_function("n=>window.islandAirDiagnostics?.mode==='dispatch'&&window.islandAirDiagnostics?.provinceFields?.ready===n",arg=expected)
    page.get_by_role('button',name='Begin flight').click()
    page.wait_for_function("window.islandAirDiagnostics?.site==='qa-crop-corner'&&window.islandAirDiagnostics.mode==='flight'")
    begin=page.evaluate('window.islandAirDiagnostics')
    page.wait_for_function("""n=>{const d=window.islandAirDiagnostics;return d.mode==='flight'&&d.x>-7142&&d.z>7184&&d.provinceFields?.ready===n&&!d.layerWarnings.length}""",arg=expected,polling=250)
    end=page.evaluate('window.islandAirDiagnostics')
    assert not errors and 206 in pack_res and (404 in pack_res)==(expected==3),(errors,pack_res)
    assert begin['x']<-7168 and begin['z']<7168
    image=out/(mode+'.png');page.screenshot(path=str(image),timeout=95000)
    rows.append({'case':mode,'start':[begin['x'],begin['z']],'end':[end['x'],end['z']],'expectedVisibleLayers':expected,'httpResponses':pack_res,'errors':errors})
    (out/'crossing.json').write_text(json.dumps(rows,indent=2)+'\n')
    print(rows[-1],flush=True);page.close()
  finally:b.close();server.shutdown()
