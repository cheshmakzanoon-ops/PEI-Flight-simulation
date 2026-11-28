#!/usr/bin/env python3
"""Verify image rollbacks, original/fitted scene isolation, and independent clipped hull."""
from pathlib import Path
from PIL import Image
import argparse,hashlib,json,numpy as np
import project
project.W,project.H=1200,760
p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
a=p.parse_args();b=a.native;sha=lambda data:hashlib.sha256(data).hexdigest()
j=lambda n:json.loads((b/(n+'.json')).read_text())
route=j('route')
assert route['summary']=='READY FOR INDEPENDENT SCORE' and not route['errors'] and not route['outside']
assert route['before']['auth']=='verified' and route['last']['status']=='complete'
assert route['responses'].count({'range':'bytes=3260377-3269449','contentRange':'bytes 3260377-3269449/3844984','code':206})==1
close=j('close');files={}
pins=json.loads(Path(__file__).with_name('source-geometry-pins.json').read_text())
for key,suffix,typ in [('position','.f32','<f4'),('wallFit','.i16','<i2'),('topFlag','.f32','<f4')]:
 p=b/(key+suffix);raw=p.read_bytes();assert sha(raw)==close['packedData'][key]
 assert sha(raw)==pins[{'position':'positionHash','wallFit':'fitHash','topFlag':'topHash'}[key]]
 files[key]=np.frombuffer(raw,dtype=typ).reshape(-1,1 if key=='topFlag' else 3)
pos=files['position'];fit=files['wallFit']
support=np.abs(fit[:,0])>15;whole=support.reshape(-1,3)
assert np.all(whole.sum(1)%3==0)
assert len(pos)==len(fit)==len(files['topFlag'])==close['build']['vertices']==pins['vertices']==11988
assert int(support.sum())==close['build']['fitVertices']==pins['markedVertices']==426
assert not np.any(files['topFlag'][support])
assert close['build']['wire']==pins['owner']
assert len(fit)*6==close['build']['bytes']==pins['fitBytes']==71928
bounded=pos[support];stats={}
for step,h in route['rows']:
 p=b/(step+'.json');assert sha(p.read_bytes())==h
 q=j(step);s=q['passes'];assert set(s)=={'base','neutral','fitted','black','white','restore'} and q['build']==close['build']
 assert q['f']['view']==0 and q['f']['route']=='east-light' and q['f']['mode']=='flight'
 read=lambda k:np.array(Image.open(b/(step+'-'+k+'.png'))).astype(np.int16)
 I={k:read(k) for k in s}
 for k,v in s.items():
  assert I[k].shape==(760,1200,4) and sha((b/(step+'-'+k+'.png')).read_bytes())==v['png']
  assert all(sha((b/(g+'.glsl')).read_bytes())==g for g in v['shaders'])
  assert v['stats']==s['base']['stats'] and v['modelView']==s['base']['modelView']
  assert np.array_equal(I[k][:,:,3],I['base'][:,:,3])
 assert len({tuple(s[k]['shaders']) for k in ('neutral','fitted','black','white')})==1
 assert s['fitted']['shaders']!=s['base']['shaders']==s['restore']['shaders']
 assert np.array_equal(I['neutral'],I['base']) and np.array_equal(I['restore'],I['base'])
 rgb=lambda k:I[k][:,:,:3]
 mark=(rgb('white')-rgb('black')).max(2)>0
 delta=(abs(rgb('fitted')-rgb('base'))).max(2)
 assert not np.any((rgb('white')-rgb('black'))<0)
 proj=project.projected_mask(bounded,s['base']['modelView'],q['projection'],.80)
 assert not np.any((mark|(delta>0))&~proj) and not np.any((delta>0)&~mark)
 row=dict(visible=int(mark.sum()),rgb=int((delta>0).sum()),strong=int((delta>2).sum()))
 assert all(v==q['scores'][k] for k,v in row.items())
 assert row['visible']==row['strong']==0 if step=='negative' else row['strong']>=24
 stats[step]=row
with a.out.open('x') as f:json.dump({'nativeRoute':sha((b/'route.json').read_bytes()),'scope':'Stock real route and exact q1333 building draw; approximate wall art, no terrain, roof, other chunks, mapped apertures, or deployment.','phases':stats},f,indent=2)
print(stats)
