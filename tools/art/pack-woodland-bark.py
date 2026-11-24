"""Convert four openly licensed matched bark photos into normalized appearance/occlusion channels."""
import argparse,gzip,hashlib,json
import numpy as np
from PIL import Image
from pathlib import Path
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args()
a,b=args.input,args.out
b.mkdir(parents=True,exist_ok=True)
source={'bark_brown_01':'Rob Tuytel','pine_bark':'Dimitrios Savva'}
S=256
layers=[];occ=[];receipt=[]
PIN={'bark_brown_01-Diffuse': '4213441aebcb72b9911f5a860e9ce74a61a8f6ce3b9c23d1f204173e7e7f6066', 'bark_brown_01-AO': '665069474c3a28d170bbdaf508a8e88c5bfa3fe3823716280038ad2d0c81a198', 'pine_bark-Diffuse': '89ddfbff0388d30caff902ba600cdf75eb1e651ca71ece6594b5a9b27abb47ab', 'pine_bark-AO': '10dc4aba5e505b28ed3cfafa7c44309b87a97aa03ad4ed99280361a77c10bb44'}
for id,author in source.items():
 img=[]; files=[]
 for k in ['Diffuse','AO']:
  p=a/f'{id}-{k}.jpg';raw=p.read_bytes()
  meta=json.loads((a/f'{id}.json').read_text())[k]['1k']['jpg']
  if len(raw)!=meta['size'] or hashlib.sha256(raw).hexdigest()!=PIN[id+'-'+k]:raise ValueError(p.name)
  x=np.array(Image.open(p).convert('RGB').resize((S,S),Image.Resampling.LANCZOS)).astype('f8')/255
  img.append(x);files.append(dict(kind=k,url=meta['url'],bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()))
 d=img[0];d=np.where(d<=.04045,d/12.92,((d+.055)/1.055)**2.4)
 y=d@np.array([.2126,.7152,.0722]);lo,hi=np.quantile(y,[.025,.975])
 # Match overall surface exposure without claiming site-specific reflectance.
 l=np.clip((y-lo)/(hi-lo),0,1)
 alpha=np.clip(img[1].mean(axis=2),0,1)
 layers.append(np.rint(l*255).astype('u1'));occ.append(np.rint(alpha*255).astype('u1'))
 receipt.append(dict(id=id,author=author,licence='CC0',source=f'https://polyhaven.com/a/{id}',files=files))
raw=np.stack([*layers,*occ],axis=-1).tobytes();pack=gzip.compress(raw,compresslevel=9,mtime=0)
(b/'wood-v1.rgba.gz').write_bytes(pack)
m=dict(width=S,height=S,channels=['broad diffuse','needle diffuse','broad AO','needle AO'],decodedBytes=len(raw),decodedSha256=hashlib.sha256(raw).hexdigest(),packBytes=len(pack),packSha256=hashlib.sha256(pack).hexdigest(),references=receipt)
(b/'sources.json').write_text(json.dumps(m,indent=2)+'\n')
print(m['packBytes'],m['packSha256'],m['decodedSha256'])
