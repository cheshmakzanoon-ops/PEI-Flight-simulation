#!/usr/bin/env python3
"""Build two calibrated CC0 asphalt micro-surface maps; positions/lane data are not encoded."""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
from PIL import Image
sha=lambda b:hashlib.sha256(b).hexdigest()
INFO={
 'asphalt_track':dict(width=2.,authors=['Dimitrios Savva']),
 'asphalt_07':dict(width=2.5,authors=['Charlotte Baglioni']),
}
def pack(src,out,source_json,typescript=None):
 inp=json.loads(source_json.read_text())
 if isinstance(inp,dict):
  inp=[dict(q,asset=a['id'],local=a['id']+'-'+q['kind']+'.jpg') for a in inp['assets'] for q in a['raw']]
 out.mkdir(parents=True,exist_ok=True); assets=[]
 for name,info in INFO.items():
  pick={q['kind']:q for q in inp if q['asset']==name}
  assert len(pick)==3
  def source(kind,mode):
   p=src/pick[kind]['local'];assert sha(p.read_bytes())==pick[kind]['sha256']
   return np.asarray(Image.open(p).convert(mode).resize((512,512),Image.Resampling.LANCZOS)).astype(float)/255
  col=source('Diffuse','RGB')
  lin=np.where(col<.04045,col/12.92,((col+.055)/1.055)**2.4)
  y=lin@np.array([.2126,.7152,.0722])
  ly=np.log(y+.012)
  # Store contrast, not unrelated sample-site absolute darkness or chroma.
  # Preserve the established geographic road palette and filtered brightness.
  le=np.clip(ly-np.median(ly),-.52,.52)
  norm=source('nor_gl','RGB')
  r=source('Rough','L')
  rgba=np.dstack((.5+le*.875,norm[:,:,0],norm[:,:,1],r))
  rgba=np.asarray(np.clip(np.rint(rgba*255),0,255),dtype=np.uint8)
  file=name+'.webp';Image.fromarray(rgba,'RGBA').save(out/file,'WEBP',lossless=True,method=6,exact=True)
  # Silent normal-channel quantization or transparent-pixel RGB suppression is not acceptable.
  assert np.array_equal(np.asarray(Image.open(out/file)),rgba)
  receipt=[{k:v for k,v in x.items() if k not in ('asset','local')} for x in pick.values()]
  assets.append(dict(id=name,page='https://polyhaven.com/a/'+name,license='https://creativecommons.org/publicdomain/zero/1.0/',
       **info,raw=receipt,file=file,bytes=(out/file).stat().st_size,sha256=sha((out/file).read_bytes())))
 meta=dict(encoding='512x512 lossless WebP RGBA; R=median-centered log-luminance (0.875x plus 0.5); G and B=OpenGL tangent x and y; A=roughness',assets=assets)
 (out/'sources.json').write_text(json.dumps(meta,indent=2)+'\n')
 if typescript is not None:
  rows=[{k:t[k] for k in ('file','sha256','bytes','width')} for t in assets]
  typescript.write_text('// Built by tools/terrain/pack-asphalt-material.py.\n'
     +'export const PAVEMENT_ASSETS='+json.dumps(rows,separators=(',',':'))+' as const;\n')
 print([(t['id'],t['bytes']) for t in assets])
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('source',type=Path);p.add_argument('source_json',type=Path);p.add_argument('out',type=Path)
 p.add_argument('--ts',type=Path)
 a=p.parse_args();pack(a.source,a.out,a.source_json,a.ts)
