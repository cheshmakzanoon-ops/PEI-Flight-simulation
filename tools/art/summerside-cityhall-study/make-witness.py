from pathlib import Path
import json
import numpy as np
from argparse import ArgumentParser
cli=ArgumentParser();cli.add_argument('frame',type=Path);a=cli.parse_args()
d=np.load(a.frame)['points']
q=d[d[:,3]==6,:3]; ids=np.unique(np.floor(q[:,:2]*4).astype(int),axis=0,return_inverse=True)[1]
P=np.array([np.median(q[ids==i],axis=0) for i in np.unique(ids)])
x,z,h=P.T
v=((np.floor(x).astype(int)*5+np.floor(z).astype(int)*3)%7)<2
p={
 'main':(x>0)&(x<17.72)&(z>-4.4)&(z<6.35)&(h>22.9)&(h<23.56),
 'west':(x>-11.22)&(x<-8.85)&(z>-4.64)&(z<1.8)&(h>27.82)&(h<28.35),
}
out={k:P[m&v].round(6).tolist() for k,m in p.items()};out['towerObservedUnclassified']=d[(d[:,3]==1)&(d[:,2]>31.25)&(d[:,2]<34)&(d[:,0]>-15.2)&(d[:,0]<-10.)&(d[:,1]>-4)&(d[:,1]<3),:3].round(6).tolist()
Path('proof').mkdir(exist_ok=True);Path('proof/private-mesh-witness.json').write_text(json.dumps(out,separators=(',',':')))
