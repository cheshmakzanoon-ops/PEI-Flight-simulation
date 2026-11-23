"""Require exact negative controls outside the projected union of the changed shells."""
import argparse,json
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter
import numpy as np
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--stock',type=Path,required=True);p.add_argument('--updated',type=Path,required=True)
p.add_argument('--projected',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
a=p.parse_args();a.out.mkdir(exist_ok=True,parents=True)
read=lambda path:json.loads(path.read_text())
A=read(a.stock/'results.json');B=read(a.updated/'results.json');tri=read(a.projected)
report={}
assert [r['name'] for r in A]==[r['name'] for r in B]
for old,new in zip(A,B):
 name=old['name']
 assert set(tri)=={r['name']for r in A}
 for k in ('owners','tiles','drawCalls','x','z','eyeY','baseH','samples'):
  assert old['diag'][k]==new['diag'][k],(name,k,old['diag'][k],new['diag'][k])
 polygonMask=Image.new('L',(old['width'],old['height']))
 brush=ImageDraw.Draw(polygonMask)
 for q in tri[name]['triangles']: brush.polygon([tuple(v)for v in q],fill=255)
 p=np.asarray(polygonMask.filter(ImageFilter.MaxFilter(7)))>0
 x=np.asarray(Image.open(a.stock/(name+'.png')).convert('RGB')).astype(np.int16)
 y=np.asarray(Image.open(a.updated/(name+'.png')).convert('RGB')).astype(np.int16)
 delta=np.abs(y-x).max(2);negative=delta[~p]
 report[name]={'negativeControlPixels':int(negative.size),'changedOutside':int((negative>0).sum()),
               'worstOutside':int(negative.max()),'changedInsideThreshold2':int((delta>2).sum()),
               'atlasTextures':old['diag']['tiles'],'buildingChunks':old['diag']['owners'],
               'draws':[r['diag']['drawCalls'] for r in (old,new)],
               'triangles':[r['diag']['triangles'] for r in (old,new)],
               'msaa':old['diag']['samples']}
 if (negative>0).any():
  q=np.argwhere((delta>0)&~p)
  report[name]['firstOutsideChanges']=q[:12].tolist()
 assert report[name]['changedInsideThreshold2']>80,(name,report[name])
 print(name,report[name])
 img=np.stack((delta.clip(0,100)*2,np.uint8(p)*75,np.uint8(p)*45),axis=-1).astype(np.uint8)
 Image.fromarray(img).save(a.out/(name+'-scope.webp'),quality=92)
(a.out/'pixel-scope.json').write_text(json.dumps(report,indent=2)+'\n')
if any(q['changedOutside']for q in report.values()):raise RuntimeError("diff outside permitted geometry")
