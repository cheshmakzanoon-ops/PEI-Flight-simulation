"""Generate the stock geometry and approval controls from the processed dry grid."""
import argparse,json
from pathlib import Path
import numpy as np
from pyproj import Transformer
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('qualified',type=Path);p.add_argument('out',type=Path)
a=p.parse_args()
source=np.load(a.qualified,allow_pickle=False)
e,n=source['upper_left_3979'];approved=source['allow']
y,x=np.indices(approved.shape)
lo,la=Transformer.from_crs(3979,4326,always_xy=True).transform(e+x+.5,n-y-.5)
old=source['stock_n112']
bare=source['dtm_ground_lifted']
output=[[lo[j,i],la[j,i],bool(approved[j,i]),float(old[j,i]),float(bare[j,i]) if approved[j,i] else None]
        for j,i in np.ndindex(approved.shape)]
a.out.write_text(json.dumps(output,separators=(',',':'))+'\n')
