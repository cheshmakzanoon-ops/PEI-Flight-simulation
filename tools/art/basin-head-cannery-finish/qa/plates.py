"""Unscaled authored plates with source/fixture scope on the margins."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys
p=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir()
f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
title=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',19)
cases={'southern-harbour':(105,145,882,597),'northern-harbour':(145,123,906,648)}
for name,xy in cases.items():
 imgs=[Image.open(p/(name+'-'+k+'.png')).convert('RGB').crop(xy) for k in ('stock','finish')]
 w,h=imgs[0].size;sheet=Image.new('RGB',(w*2+30,h+90),(25,34,41));d=ImageDraw.Draw(sheet)
 d.text((12,10),'Basin Head Cannery  /  '+name.replace('-',' '),fill=(247,242,229),font=title)
 for i,label in enumerate(['Current inlet-preview material','Original wood finish • detached']):
  x=10+i*(w+10);d.text((x,42),label,fill=(200,215,216),font=f);sheet.paste(imgs[i],(x,62))
 d.text((12,68+h),'Unscaled EGL, exact Three r187 light LUT • not installed',fill=(200,215,216),font=f)
 with (out/(name+'-matched.png')).open('xb') as handle:sheet.save(handle,format='PNG')
