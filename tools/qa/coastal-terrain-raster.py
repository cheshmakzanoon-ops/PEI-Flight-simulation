"""Read bounded public NRCan windows. Retain private chips; summaries only externally."""
import argparse,json,hashlib,math,runpy
from pathlib import Path
import numpy as np
p=argparse.ArgumentParser()
p.add_argument('--sites',default='docs/qa/coastal-terrain-intake-sites.json',type=Path)
p.add_argument('--out',default='private-native',type=Path)
a=p.parse_args();a.out.mkdir(exist_ok=True)
reader=runpy.run_path(str(Path(__file__).with_name('roof-fit-pilot.py')))
_,terrain,gt,fromWGS=reader['open_models']()
m={}
for loc in json.loads(a.sites.read_text()):
 xy=fromWGS.TransformPoint(loc['lon'],loc['lat'])[:2]
 x=math.floor(xy[0]-gt[0])-179;y=math.floor(gt[3]-xy[1])-179;k=359
 z=terrain.GetRasterBand(1).ReadAsArray(x,y,k,k).astype('<f4')
 assert z.shape==(k,k) and 1<=k<=360
 s=hashlib.sha256(z.tobytes()).hexdigest()
 off=[gt[0]+x,gt[3]-y]
 np.savez_compressed(a.out/(loc['id']+'.npz'),height=z,offset=off)
 m[loc['id']]={'sha256':s,'arrayShape':[k,k],'sourceSelection':'NRCan HRDEM national 1m mosaic, local coverage; capture year not accepted from mosaic alone.'}
 (a.out/'chips.json').write_text(json.dumps(m,indent=2)+'\n')
 print(loc['id'],s,flush=True)
