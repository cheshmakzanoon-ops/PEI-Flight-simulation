from pathlib import Path
import json,math
import numpy as np
from osgeo import osr
D=Path('.')
a=json.loads((D/'dry-2112-source.json').read_text())
def s(k):
 R=osr.SpatialReference();R.ImportFromEPSG(k);R.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER);return R
east,north=a['pixelEdges'];_,_,W,H=a['crop']
x,y=np.meshgrid(east+.5+np.arange(W),north-.5-np.arange(H))
m=osr.CoordinateTransformation(s(3979),s(4326))
ll=np.asarray(m.TransformPoints(np.stack([x.ravel(),y.ravel()],axis=-1).tolist()))[:,:2]
R=math.pi/180;Q=1-6.69437999014e-3*math.sin(46.5*R)**2
Dx=6378137*R*math.cos(46.5*R)/math.sqrt(Q);Dz=-6378137*R*(1-6.69437999014e-3)/Q**1.5
world=(ll-np.array([-63.2,46.5]))*np.array([Dx,Dz])
world.astype('<f8').tofile('dry-2112-world-centres.f64')
