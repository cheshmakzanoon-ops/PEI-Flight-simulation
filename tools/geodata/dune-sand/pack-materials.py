from pathlib import Path
import argparse
from PIL import Image
from scipy.ndimage import gaussian_filter
import numpy as np,hashlib,json
p=argparse.ArgumentParser(description='Pack two attributed CC0 sand looks with explicit input directory.')
p.add_argument('--input',type=Path,required=True);p.add_argument('--out',type=Path,required=True)
a=p.parse_args();root=a.input;out=a.out;out.mkdir(parents=True,exist_ok=True)
AB=[('sand_03','micro',256,2),('coast_sand_02','macro',384,15)]
receipt=[]
for a,tag,n,metric in AB:
 assets={k:next(root.glob(a+'_'+k+'_1k.jpg'))for k in ('diff','nor_gl','rough')}
 photo={k:np.asarray(Image.open(v).convert('RGB' if k!='rough' else 'L').resize((n,n),Image.Resampling.LANCZOS),dtype='f4')/255 for k,v in assets.items()}
 normal=photo['nor_gl'][:,:,:2]
 rgb=photo['diff']
 rgb=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
 lum=rgb@[.2126,.7152,.0722]
 base=gaussian_filter(lum,n/23,mode='wrap')
 relief=np.log(np.maximum(.003,lum)/np.maximum(.003,base))
 z=np.stack([normal[:,:,0],normal[:,:,1],np.clip(.5+.72*relief,.03,.97),photo['rough']],axis=2)
 z=np.uint8(np.rint(255*z));v=out/(tag+'-photometric.png')
 Image.fromarray(z,'RGBA').save(v,optimize=True)
 sha=lambda t:hashlib.sha256(t.read_bytes()).hexdigest()
 receipt.append(dict(name=a,payload=v.name,sourceWidthMetres=metric,style=tag,pixels=n,sha=sha(v),size=v.stat().st_size,
       pinnedInputs={k:{'name':q.name,'sha256':sha(q)}for k,q in assets.items()}))
(out/'sand-texture-payload.json').write_text(json.dumps(receipt,indent=2)+'\n')
for r in receipt:print(r['style'],r['size'],r['sha'])
