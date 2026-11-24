import argparse, functools, http.server, json, threading
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
from playwright.sync_api import sync_playwright
class Silent(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*a): pass
parser = argparse.ArgumentParser(description='Capture the detached Covehead Three.js studio. Run from the study directory.')
parser.add_argument('--dist', type=Path, default=Path('dist'))
parser.add_argument('--out', type=Path, default=Path('output'))
parser.add_argument('--chromium', type=Path, required=True)
args = parser.parse_args()
assert (args.dist/'index.html').is_file()
H=functools.partial(Silent,directory=str(args.dist.resolve()))
with http.server.ThreadingHTTPServer(('127.0.0.1',0),H)as s,sync_playwright()as p:
 threading.Thread(target=s.serve_forever,daemon=True).start()
 out=args.out;out.mkdir(parents=True,exist_ok=True)
 with p.chromium.launch(executable_path=args.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])as b:
  pg=b.new_page(viewport={'width':680,'height':700})
  results={};errors=[]
  pg.on('pageerror',lambda e:errors.append(str(e)))
  for name,q in [('front',''),('reverse','?reverse'),('lantern','?lantern'),('flight','?flight')]:
   pg.goto(f'http://127.0.0.1:{s.server_port}/{q}',wait_until='domcontentloaded')
   pg.wait_for_function('window.review')
   pg.locator('canvas').screenshot(path=str(out/(name+'.png')))
   results[name]=pg.evaluate('window.review')
  s.shutdown()
 assert not errors,errors
 (out/'studio-observed.json').write_text(json.dumps(results,indent=2)+'\n')
 def place(name,xy,size):
  im=Image.open(out/(name+'.png')).convert('RGB')
  im.thumbnail(size,Image.Resampling.LANCZOS)
  page.paste(im,xy)
 page=Image.new('RGB',(1500,800),(26,32,37))
 D=ImageDraw.Draw(page)
 base='/usr/share/fonts/truetype/dejavu/DejaVuSans'
 large=ImageFont.truetype(base+'-Bold.ttf',34);small=ImageFont.truetype(base+'.ttf',19)
 D.text((34,24),'Covehead Harbour Lighthouse',font=large,fill='#f8f3e7')
 D.text((35,76),'2020 survey-era exterior study  /  Detached model, not in the live simulator',font=small,fill='#becbd3')
 for name,caption,x in [('front','01  Entry and gallery',34),('reverse','02  Reverse elevation',514),('lantern','03  Hip roof and lantern',994)]:
  place(name,(x,128),(467,590));D.text((x,625),caption,font=small,fill='#e4ebed')
 page=page.crop((0,0,1500,675));page.save(out/'covehead-studio.webp',quality=91,method=6)
