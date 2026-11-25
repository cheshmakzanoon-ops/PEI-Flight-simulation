"""Private cross-county shape audit. Do not derive a shoreline from elevation alone."""
from pathlib import Path
import argparse,json,hashlib
import numpy as np
from osgeo import osr

def quant(v):return np.quantile(v,[0,.05,.5,.90,.95,1]).round(4).tolist()if len(v)else[]
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--stock',type=Path,required=True)
p.add_argument('--raster',type=Path,required=True)
p.add_argument('--out',type=Path,required=True)
args=p.parse_args()
A=json.loads(args.stock.read_text())
P=args.raster
F=json.loads((P/'chips.json').read_text())
src=osr.SpatialReference();src.ImportFromEPSG(4326);src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
dst=osr.SpatialReference();dst.ImportFromEPSG(3979);dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
transform=osr.CoordinateTransformation(src,dst)
result={}
for name,g in A['bySite'].items():
 if name not in F:raise ValueError('Missing source window: '+name)
 ar=np.asarray(g['samples']);sx,sz,y,physics,dry,land=ar.T
 p=np.load(P/(name+'.npz'));h=p['height'];o=p['offset']
 assert hashlib.sha256(h.tobytes()).hexdigest()==F[name]['sha256']
 E,N=np.array(transform.TransformPoints(np.c_[sx/76762.59317717304-63.2,46.5-sz/111161.08375388647])).T[:2]
 u=E-o[0]-.5;v=o[1]-N-.5
 K,J=h.shape
 ok=(u>=0)&(v>=0)&(u<J-1)&(v<K-1)
 i=np.clip(u.astype(int),0,J-2);j=np.clip(v.astype(int),0,K-2)
 a=u-i;b=v-j
 neighbors=np.stack([h[j,i],h[j,i+1],h[j+1,i],h[j+1,i+1]])
 ok&=(neighbors.min(0)>-50)&(neighbors.max(0)<145)&np.isfinite(neighbors).all(0)
 z=np.array([(1-a)*(1-b),a*(1-b),(1-a)*b,a*b]);native=(neighbors*z).sum(0)
 diff=native+.12-y
 band={}
 for k,m in [('within 8m of anchor',(sx-g['x'])**2+(sz-g['z'])**2<=64),('mapped inland',(dry>=30)&(land==1)),('mapped edge positive',(dry>=0)&(dry<18)),('mapped wet',dry<0)]:
  m&=ok
  band[k]={'n':int(m.sum()),'sourceNativeM':quant(native[m]),'renderedY':quant(y[m]),'nativeMinusRenderedM':quant(diff[m]),
   'physicsMinusMeshM':quant((physics-y)[m])if k!='mapped wet'else[]}
   # Cover is a plan-view mask; these are contradictions to review, not corrected geometry.
 mismatchedWet=(dry<0)&(native>4)&ok
 mismatchedDry=(dry>1)&(land==1)&(native<-.20)&ok
 result[name]={'owner':g['owner'],'county':g['county'],'stockProbeRays':g['rayChecks'],'stockVisualMaxRayM':g['maxRay'],'bands':band,
   'nativeAbove4mButWetCount':int(mismatchedWet.sum()),'nativeBelowMinus20cmButDryCount':int(mismatchedDry.sum()),'nativeWindowHash':F[name]['sha256']}
D={'source':'Official Natural Resources Canada 1m mosaics and existing game WebGL terrain mesh, no assumption of matched acquisition periods or tree/road treatments.',
 'scope':'Private frame, source eligibility only; does not assert tides, position or measured current coastline.',
 'baseline':A['baseline'],'pins':A['pins'],'regional':result}
args.out.write_text(json.dumps(D,indent=2)+'\n')
for name,g in result.items():
 x=g['bands']['within 8m of anchor']['nativeMinusRenderedM']
 print(name,x[2]if x else None,g['nativeAbove4mButWetCount'],g['nativeBelowMinus20cmButDryCount'])
