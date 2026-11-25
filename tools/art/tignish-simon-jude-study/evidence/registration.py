"""Prove the exact XY-only stock owner and export an original role diagram. No Z inputs."""
from pathlib import Path
import hashlib,json,gzip,numpy as np,argparse,html
from pyproj import Transformer
a=argparse.ArgumentParser();a.add_argument('--checkout',type=Path,default=Path(__file__).resolve().parents[4]);a.add_argument('--out',type=Path,required=True);o=a.parse_args()
D=o.checkout/'public/world/buildings';index=(D/'index.json').read_bytes();manifest=json.loads(index);pack=(D/'tiles.pack').read_bytes()
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(pack)==manifest['sha256']
tile=next(q for q in manifest['tiles']if q['id']=='q221232');chunk=pack[tile['offset']:tile['offset']+tile['bytes']]
assert sha(chunk)=='e463fe9b6df51d4d8ca540dc3074496fbee609a680a206e7b5ce0f5fbf9ecb8d'
source=json.loads(gzip.decompress(chunk))['features'];ordinals=[98,84,278,43]
ll={i:np.asarray(source[i]['footprint'],dtype=float) for i in ordinals}
tf=Transformer.from_crs(4326,2954,always_xy=True)
xy={i:np.asarray(tf.transform(*p.T)).T for i,p in ll.items()}
origin=xy[98].mean(0);owner=xy[98]-origin
d=np.roll(owner,-1,axis=0)-owner;norm=np.linalg.norm(d,axis=1);k=int(np.argmax(norm));U=d[k]/norm[k];U*=np.sign(U[0]);N=np.array([-U[1],U[0]])
rot=np.stack([U,N],axis=1);uv={i:(p-origin)@rot for i,p in xy.items()}
areas={i:abs(float(np.sum(p[:,0]*np.roll(p[:,1],-1)-p[:,1]*np.roll(p[:,0],-1))*.5))for i,p in uv.items()}
assert abs(areas[98]-932.0076)<.006,areas[98]
head=(float(np.degrees(np.arctan2(U[0],U[1])))+360)%360
marks=[
 ('Entrance tower','Compass east / liturgical west',(23.0,-1.7),(460,110)),
 ('Separate porches','Near the compass-east end',(20.1,-13.7),(459,440)),
 ('Nave','Continuous long body',(4.8,-2.8),(286,422)),
 ('Square sanctuary','Compass-west end',(-13.6,.25),(46,226)),
 ('North chapel','Not the south vestry',(-11.7,13.4),(48,111)),
 ('South vestry','Separate west side role',(-16.2,-9.5),(48,391)),
]
r={'baselinePackSHA256':sha(pack),'manifestSHA256':sha(index),'packetSHA256':sha(chunk),'stockOwner':{'tile':tile['id'],'ordinal':98,'pid':6726,'areaM2EPSG2954':areas[98],'vertexCount':len(uv[98])},'keepStock':{'84':'same church parcel, separate footprint','278':'same church parcel, separate footprint','43':'different parcel 454520, not church'},'axis':'Rotated EPSG:2954. U along longest east-going envelope side, towards compass east / ENE. V positive roughly compass north; not liturgical north.','bearingOfEastwardLongestEdgeDegFromGridNorth':head,'approximateOutlineUVMetres':{int(k):q.tolist()for k,q in uv.items()},'primaryRoles':[(x,y)for x,y,_,_ in marks],'meaning':'XY packaging only. Markers provide directional relationships inferred from 2006 firsthand architectural study; they are not surveyed volumes, eaves or wall boundaries. No native numeric Z queried.'}
o.out.mkdir(parents=True,exist_ok=True);(o.out/'xy-plan.json').write_text(json.dumps(r,indent=2)+'\n')
svg=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1050 540" role="img" aria-labelledby="t d"><title id="t">Tignish exact stock-owner outline and directional architectural roles</title><desc id="d">The church is q221232 ordinal 98. The tower is on compass east; three nearby features remain separate and unchanged. This plan contains no measured heights.</desc>','<rect width="1050" height="540" fill="#26231d"/>','<style>text{font-family:system-ui,sans-serif;fill:#ece6da}.title{font-size:30px;font-family:Georgia,serif}.small{font-size:12px}.label{font-weight:600;font-size:15px}.soft{fill:#c8bca8}.highlight{fill:#e6c998}</style>']
def add(x,y,s,k='small'):svg.append(f'<text x="{x}" y="{y}" class="{k}">{html.escape(s)}</text>')
def line(x,y,a,b,c='#e7ba80',w=1.45):svg.append(f'<path d="M{x:.2f} {y:.2f}L{a:.2f} {b:.2f}" stroke="{c}" fill="none" stroke-width="{w}"/>')
def polygon(p,tx,ty,k,col,edge):
 pts=' '.join(f'{tx+k*x:.2f},{ty-k*y:.2f}'for x,y in p);svg.append(f'<polygon points="{pts}" fill="{col}" stroke="{edge}" stroke-width="1.7"/>')
add(28,32,'TIGNISH / FOOTPRINT REGISTRATION','small highlight');add(28,64,'St. Simon & St. Jude · compass plan','title')
line(28,82,1022,82,'#655b4c');line(660,95,660,484,'#655b4c')
tx,ty,k=315,254,7.5
polygon(uv[98],tx,ty,k,'#824a39','#d99b75')
for label,note,(u,v),(x,y) in marks:
 a,b=tx+k*u,ty-k*v;line(a,b,x+8,y+5);svg.append(f'<circle cx="{a:.2f}" cy="{b:.2f}" r="3.5" fill="#edc491"/>')
 svg.append(f'<rect x="{x-6}" y="{y-17}" width="191" height="38" fill="#26231d" rx="3"/>');add(x,y,label,'label');add(x,y+17,note,'small soft')
add(691,115,'STOCK CAMPUS SEPARATION','label highlight')
add(691,139,'Existing masked owner: q221232 / 98','small soft');add(691,163,'U axis east / ENE →     V axis roughly north ↑','small soft')
tx2,ty2,k2=973,215,2.04
for i in (43,278,84,98):
 polygon(uv[i],tx2,ty2,k2,'#824a39'if i==98 else '#63584a','#e3ab7d'if i==98 else'#ad9b84')
 x,y=uv[i].mean(0);add(tx2+k2*x-10,ty2-k2*y+5,f'/{i}','label')
add(695,396,'/98   Church (only recognized building model)')
add(695,419,'/84 and /278   Separate bodies, same parish parcel')
add(695,442,'/43   Separate candidate on another parcel')
line(28,494,1022,494,'#655b4c')
add(28,518,'Original diagram from packaged stock XY. Callouts establish relationships, not exact walls, sub-roofs or spire geometry.','small soft')
svg.append('</svg>');(o.out/'xy-plan.svg').write_text('\n'.join(svg)+'\n')
