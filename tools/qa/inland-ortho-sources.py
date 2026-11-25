"""Verify the two current inland rows directly against their unchanged source imagery and signed cover.
Produces a portable 4 × 20 RGB matrix per pair (two original west and two original east columns).
It does not synthesize/remap imagery, guess a seamless ground truth, or independently prove a GPU fix."""
from pathlib import Path
from PIL import Image
import numpy as np, argparse, gzip, hashlib, io, json, math
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--checkout',type=Path,default=Path.cwd());p.add_argument('--out',type=Path,required=True);a=p.parse_args()
world=a.checkout/'public/world';manifestFile=world/'detail/index.json';manifest=json.loads(manifestFile.read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(manifestFile.read_bytes())=='a92bad71e77dfb72cf02c7e4934543a86f9ac528f0cee057ddcdb16c724e1207'
assert [manifest[k]for k in ('columns','rows','tilePixels','bounds')]==[32,22,640,[-64.47,45.94,-61.93,47.1]]
src=(a.checkout/'src/render/inland-ortho-windows.ts').read_text()
plans=json.loads(src.split('export const INLAND_ORTHO_WINDOWS=')[1].split(' as const;')[0])
cells={'west':(8,12,[217,219,235,237]),'central':(11,11,[457,459,475,477])}
coverRaw=gzip.decompress((world/'cover.bin.gz').read_bytes())
assert sha(coverRaw)=='e5055290c88d844b7ec655d33b1336e5ce446cd6a460f7fddd28c81b7d989ea9'
cover=np.frombuffer(coverRaw,np.uint8).reshape(2720,4096,2)
packs={};details={};rows=[]
for plan in plans:
 key=plan['name'];edge,tileY,window=cells[key];lo,c0,c1,hi=window
 assert plan['axis']=='x'and plan['edge']==edge and plan['northRows']==window
 assert [plan['first'],plan['second']]==[f'{edge-1}-{tileY}',f'{edge}-{tileY}'];assert hi-lo==20 and c1-c0==16
 tiles=[];hashes=[]
 for label,expected in [(plan['first'],plan['nsha']),(plan['second'],plan['ssha'])]:
  pin=manifest['tiles'][label];idx=pin['pack'];info=manifest['packs'][idx]
  if idx not in packs:
   data=(world/'detail'/info['file']).read_bytes()
   assert len(data)==info['bytes']and sha(data)==info['sha256'];packs[idx]=data
  data=packs[idx][pin['offset']:pin['offset']+pin['bytes']]
  assert sha(data)==expected==pin['sha256'];hashes.append(expected)
  with Image.open(io.BytesIO(data))as im:
   assert im.size==(640,640);tiles.append(np.array(im.convert('RGB')))
 # Convention independent of GLSL: tile image row zero is north.
 matrix=np.concatenate([tiles[0][lo:hi,638:],tiles[1][lo:hi,:2]],axis=1)
 assert matrix.shape==(20,4,3)
 # The geometric blend/cross support is <=1.25 source texels. Bound both
 # nearest land cover and every hardware-style bilinear coast vertex across
 # the whole continuous rectangle, including fractional perimeter.
 xs=(edge+np.array([-1.25,1.25])/640)*4096/32;zs=(tileY+np.array([lo,hi])/640)*2720/22
 x0,x1=int(np.floor(xs[0]-.5)),int(np.floor(xs[1]-.5))+1
 z0,z1=int(np.floor(zs[0]-.5)),int(np.floor(zs[1]-.5))+1
 x0=min(x0,math.floor(xs[0]));x1=max(x1,math.floor(xs[1]));z0=min(z0,math.floor(zs[0]));z1=max(z1,math.floor(zs[1]))
 assert [x0,z0,x1-x0+1,z1-z0+1]==plan['coverBox']
 rg=cover[z0:z1+1,x0:x1+1];assert rg.flatten().tolist()==plan['coverRG']
 classes={int(i)for i in np.unique(rg[:,:,0])};assert classes<={30,40} and rg[:,:,1].min()>=148
 rgb=matrix.astype('float64');central=rgb[c0-lo:c1-lo]
 norms=lambda a:np.linalg.norm(a,axis=-1);cross=norms(central[:,2]-central[:,1]);inner=.5*(norms(central[:,0]-central[:,1])+norms(central[:,2]-central[:,3]))
 # A continuous 4-column strip maps cross=-.5 and +.5 exactly to the last
 # west / first east centres. Interleaved vertical samples obey linearity too.
 for t in np.linspace(0,19,381):
  j=min(18,int(t));v=t-j;row=rgb[j]*(1-v)+rgb[j+1]*v
  for crossCoord,sourceCol in [(-.5,1),(.5,2)]:
   coord=1.5+crossCoord;i=math.floor(coord);u=coord-i
   assert np.array_equal(row[i]*(1-u)+row[i+1]*u,row[sourceCol])
 lon=-64.47+2.54*edge/32;lat=lambda row:47.10-1.16*(tileY+row/640)/22
 rows.append(dict(name=key,ownerTileIDs=[plan['first'],plan['second']],wireSHA256=hashes,firstNorthRow=lo,
  coreNorthRowsHalfOpen=[c0,c1],windowNorthRows=[lo,hi],sourceRGBColumns=['west638','west639','east0','east1'],sourceRGBRows=matrix.tolist(),
  originalTexelCentresCheckedForAll381VerticalPositionsPerSide=True,westLongitude=lon,northSouthLatitudes=[lat(lo),lat(hi)],
  nativeCoreMedianAcrossRGB8=round(float(np.median(cross)),3),nativeCoreMedianNeighborRGB8=round(float(np.median(inner)),3),
  exactLocalCoverRectangle=plan['coverBox'],dryClasses=sorted(classes),minimumBilinearCoastCode=int(rg[:,:,1].min())))
assert set(cells)=={p['name']for p in plans}
r={'source':'Existing Sentinel WebPs; an actual agricultural boundary can have a large native color step. This receipt demonstrates only the input samples and limited eligible footprint.',
 'sourceManifestSHA256':sha(manifestFile.read_bytes()),'coverDecodedSHA256':sha(coverRaw),'pairs':rows}
a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(r,indent=2)+'\n');print([(q['name'],q['nativeCoreMedianAcrossRGB8'],q['minimumBilinearCoastCode'])for q in rows])
