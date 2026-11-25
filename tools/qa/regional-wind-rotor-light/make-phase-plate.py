"""Lay out actual native frames. Does not alter pixel levels or blend frames."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
p=argparse.ArgumentParser();p.add_argument('live',type=Path);p.add_argument('out',type=Path);a=p.parse_args()
fontdir=Path('/usr/share/fonts/truetype/dejavu')
def font(n,b=False):return ImageFont.truetype(str(fontdir/('DejaVuSans-Bold.ttf'if b else 'DejaVuSans.ttf')),n)
rows=[
 ('WCW27-reverse','West Cape','Vestas V80  /  80 m rotor',(235,182,635,350)),
 ('EKW6-reverse','Eastern Kings I','Vestas V90  /  90 m rotor',(278,178,678,346)),
 ('HCS3-reverse','Hermanville','Acciona AW116  /  116 m rotor',(225,177,625,345))]
ink='#17272b';dim='#415658';bg='#f7f6ee';cols=[20,378,736];width=1090
im=Image.new('RGB',(width,713),bg);d=ImageDraw.Draw(im)
d.text((20,16),'Moving turbine shadows',fill=ink,font=font(27,True))
d.text((20,55),'Same simulator camera within each row. The original tower and nacelle shadow stays on in all panels.',fill=dim,font=font(15))
for x,label in zip(cols,['Rotor shadow off   ·   0.619 s','Rotor shadow on   ·   0.619 s','Rotor shadow on   ·   1.342 s']):
 d.text((x,94),label,font=font(14,True),fill=ink)
for h,(name,location,profile,box) in enumerate(rows):
 y=124+h*184;d.line((20,y,width-20,y),fill='#bdc7bc',width=1);d.text((20,y+7),location,font=font(16,True),fill=ink)
 d.text((260,y+9),profile,font=font(14),fill=dim)
 for x,(n,role) in zip(cols,[(1,'off'),(1,'on'),(3,'on')]):
  f=Image.open(a.live/(name+f'-{n}-{role}.png')).convert('RGB')
  assert f.size==(840,540)
  im.paste(f.crop(box).resize((334,140),Image.Resampling.LANCZOS),(x,y+34))
d.text((20,684),'Ground-detail crops of recorded frames, without contrast enhancement. Times are simulator animation time, not playback speed.',font=font(13),fill=dim)
im.save(a.out,'WEBP',quality=93,method=6)
