from pathlib import Path
from sys import argv
from osgeo import osr
import json,numpy as np
o=Path(argv[1]).resolve();q=np.load(o/'native.npz')
def crs(i):
 s=osr.SpatialReference();s.ImportFromEPSG(i);s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return s
osr.UseExceptions()
T=osr.CoordinateTransformation(crs(3979),crs(4326))
grid=np.c_[q['xAbs'][q['fit']],q['yAbs'][q['fit']]]
blocks=np.floor(grid/3).astype(int);h=(blocks[:,0]*7+blocks[:,1]*3+1)%5==0
w=np.array(T.TransformPoints(grid[h].tolist()))[:,:2]
reg=json.loads((o/'native.json').read_text())
(o/'hangar-holdout.json').write_text(json.dumps(dict(plan=reg['assertedAEBFootprint'],points=np.c_[w,q['dsm'][q['fit']][h]].tolist()),separators=(',',':'))+'\n')
