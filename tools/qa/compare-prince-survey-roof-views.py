import argparse, hashlib, json
from pathlib import Path
from PIL import Image
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--stock',type=Path,required=True);p.add_argument('--candidate',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args()
stock={x['name']:x for x in json.loads((a.stock/'results.json').read_text())}
new={x['name']:x for x in json.loads((a.candidate/'results.json').read_text())}
assert set(stock)==set(new) and len(stock)==4
results={}
for k,b in stock.items():
 c=new[k];before=a.stock/(k+'.png');after=a.candidate/(k+'.png')
 ap,bp=(np.asarray(Image.open(x).convert('RGB'),dtype=np.int16) for x in (before,after))
 z=np.abs(ap-bp).max(axis=2);v=z>0;yy,xx=np.where(v)
 assert not b['errors'] and not c['errors'] and len(xx)>0
 assert c['diag']['drawCalls']==b['diag']['drawCalls']
 assert c['diag']['triangles']-b['diag']['triangles']==58
 assert c['pose']['fixedEyeY']==b['diag']['eyeY'] and c['pose']['fixedBaseH']==b['diag']['baseH']
 results[k]={'pose':c['pose'],'size':list(z.shape[::-1]),'changedAny':int(v.sum()),'changedAbove2':int((z>2).sum()),
  'inclusiveChangedBBoxXYXY':[int(xx.min()),int(yy.min()),int(xx.max()),int(yy.max())],
  'maximumChannelDelta':int(z.max()),'drawsBoth':b['diag']['drawCalls'],
  'stockTris':b['diag']['triangles'],'candidateTris':c['diag']['triangles'],
  'pngSha256':{k:hashlib.sha256(x.read_bytes()).hexdigest() for k,x in [('stock',before),('candidate',after)]}}
a.out.write_text(json.dumps({'scope':'Independently locked real Chromium/SwiftShader geographic views; bounds are RGB changes, not a claim of independent exact building-ID masking. No hardware benchmark.', 'views':results},indent=2)+'\n')
