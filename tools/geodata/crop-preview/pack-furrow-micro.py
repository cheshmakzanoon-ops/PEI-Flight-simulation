"""Generate a neutral albedo-ratio + tangent-normal map from a cited CC0 scan."""
from pathlib import Path
import argparse,hashlib,json,numpy as np
from scipy.ndimage import gaussian_filter1d
from PIL import Image
cli=argparse.ArgumentParser(description=__doc__);cli.add_argument('--source',type=Path,required=True);p=cli.parse_args().source.resolve()
pins=json.loads((p/'source-farm-furrows.json').read_text())
sources={}
for k in ('Diffuse','nor_gl'):
 source=(p/('ph-farm-'+k+'.jpg')).read_bytes()
 record=pins[k]['1k']['jpg'];assert hashlib.md5(source).hexdigest()==record['md5']
 sources[k]={'url':record['url'],'sha256':hashlib.sha256(source).hexdigest()}
def read(k):
 im=Image.open(p/('ph-farm-'+k+'.jpg')).convert('RGB')
 # Sample only the inner ridged surface. The source's two longitudinal
 # headland margins are real scan content, but repeat as false cross-tracks.
 part=np.asarray(im.crop((188,0,836,1024)).resize((256,512),Image.Resampling.LANCZOS)).astype(float)/255.
 mirror=part[:,::-1].copy()
 if k=='nor_gl':mirror[:,:,0]=1.-mirror[:,:,0]
 return np.concatenate((part,mirror),axis=1)
rgb=read('Diffuse')
linear=np.where(rgb<.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
y=linear@np.array([.2126,.7152,.0722])
columns=gaussian_filter1d(y.mean(axis=0),13.5,mode='wrap')
# Remove the scan's small longitudinal edge seam, not its cross-row relief.
y*=np.clip(np.sqrt(np.median(columns)/np.maximum(columns,.01)),.81,1.18)[None,:]
gain=np.clip(y/np.mean(y),.46,1.54)
normal=read('nor_gl')
encoded=np.stack(((gain-.46)/1.08,normal[:,:,0],normal[:,:,1]),axis=-1)
target=p/'furrow-relief.webp'
Image.fromarray(np.uint8(np.rint(np.clip(encoded,0,1)*255)),'RGB').save(target,format='WEBP',quality=94,method=6)
print(target.stat().st_size,hashlib.sha256(target.read_bytes()).hexdigest())
(p/'furrow-scan.json').write_text(json.dumps({'source':'https://polyhaven.com/a/farm_furrows','licence':'CC0 1.0','materialIsNotFromPEI':True,'photoChannels':sources,'outputSha':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size},indent=2)+'\n')
