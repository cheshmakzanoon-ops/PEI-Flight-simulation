#!/usr/bin/env python3
"""Build a compact linear photometric map from CC0 Poly Haven Sparse Grass."""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image
PINS={
 'sparse_grass_diff_1k.jpg':'ae94f2b34597b9108eefd88217f55eccaec6d6b382e858a478ee92df90e66617',
 'sparse_grass_mask_1k.jpg':'5aa90936943e5ad518dc916497e9695112c0c4eaef0e54546abd08f14b06e572',
 'sparse_grass_nor_gl_1k.jpg':'1c840a24807346ddaaf94a5057aee4078fcec3a4cd84bfe45da7d3b480ef460b',
}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--input',required=True,type=Path);p.add_argument('--output',required=True,type=Path);r=p.parse_args()
 arrays=[]
 for (name,expected),mode in zip(PINS.items(),('RGB','L','RGB')):
  q=r.input/name
  if sha(q)!=expected:raise ValueError('Unrecognized licensed input bytes: '+name)
  arrays.append(np.asarray(Image.open(q).convert(mode).resize((384,384),Image.Resampling.LANCZOS),dtype=np.float32)/255)
 diffuse,mask,normal=arrays
 lum=diffuse@[.2126,.7152,.0722];broad=gaussian_filter(lum,384/28,mode='wrap')
 rel=np.clip(.5+.98*np.log(np.maximum(.005,lum)/np.maximum(.005,broad)),.025,.975)
 out=np.stack([normal[:,:,0],normal[:,:,1],rel,np.clip(mask,0,1)],axis=2)
 Image.fromarray(np.rint(out*255).astype(np.uint8),'RGBA').save(r.output,optimize=True)
 print(sha(r.output),r.output.stat().st_size)
if __name__=='__main__':main()
