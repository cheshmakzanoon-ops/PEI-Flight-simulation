"""Detached neutral roof fitting. Footprint and height evidence only, no land use or facades inferred."""
from pathlib import Path
from collections import Counter
import argparse,gzip,hashlib,json,math
import numpy as np
from scipy.spatial import ConvexHull,QhullError
cli=argparse.ArgumentParser(description=__doc__)
cli.add_argument('--root',type=Path,default=Path.cwd())
cli.add_argument('--scratch',type=Path,required=True)
cli.add_argument('--region',choices=['kings','prince','queens'],default='kings')
arg=cli.parse_args()
west=arg.region=='prince'
P=arg.root/'public/world/buildings'
W=arg.scratch;W.mkdir(parents=True,exist_ok=True)
index=json.loads((P/'index.json').read_text());pack=(P/'tiles.pack').read_bytes()
assert hashlib.sha256(pack).hexdigest()==index['sha256']
d=math.pi/180.;m=6378137*d;k=1-.00669437999014*math.sin(46.5*d)**2
S=np.array([m*math.cos(46.5*d)/math.sqrt(k),-m*(1-.00669437999014)/k**1.5]);orig=np.array([-63.2,46.5])
town=dict(Souris=(-62.252,46.354),Montague=(-62.649,46.167),Georgetown=(-62.534,46.183),Morell=(-62.711,46.416),MurrayHarbour=(-62.527,46.007),SaintPeters=(-62.578,46.416))
if west:town={'Tignish':(-64.031,46.949),'Alberton':(-64.066,46.815),
 'OLeary':(-64.231,46.709),'Wellington':(-64.003,46.455),
 'BordenCarleton':(-63.692,46.253),'Kensington':(-63.648,46.437)}

if arg.region=='queens':town={'Victoria':(-63.4884,46.2143),'NorthRustico':(-63.3139,46.4570),
 'HunterRiver':(-63.3499,46.3561),'Cornwall':(-63.2192,46.2418),
 'Stratford':(-63.0881,46.2190),'Charlottetown':(-63.1277,46.23845)}
c={n:(np.array(ll)-orig)*S for n,ll in town.items()}
homes=(arg.root/'src/render/home-envelopes.generated.ts').read_text()
d0=json.loads(homes.split('export const HOME_FORMS=',1)[1].split(' as const')[0])
keep={(tile,r[0])for tile,rr in d0.items() for r in rr}
lookup={n:[] for n in c}
for tile in index['tiles']:
    x,y,z,w=tile['bounds']
    if not any(x-.014<lon<z+.014 and y-.010<lat<w+.010 for lon,lat in town.values()): continue
    o,l=tile['offset'],tile['bytes']; members=json.loads(gzip.decompress(pack[o:o+l]))['features']
    for i,b in enumerate(members):
        if (tile['id'],i) in keep or b.get('holes') or not 4<=len(b['footprint'])<=10 or 'minHeight' not in b:continue
        if not 3.4<b['height']<16 or b['height']-b['minHeight']<1.22:continue
        ll=np.asarray(b['footprint']);ctr=ll.mean(0); q=(ll-orig)*S;world=q.mean(0)
        hit=sorted((np.linalg.norm(world-u),n)for n,u in c.items())[0]
        if hit[0]>1000:continue
        area=abs(np.sum(q[:,0]*np.roll(q[:,1],-1)-q[:,1]*np.roll(q[:,0],-1)))*.5
        if not 63<=area<=400:continue
        try:h=ConvexHull(q)
        except (ValueError,QhullError):continue
        if h.volume>1.072*area:continue
        seq=q[h.vertices];e=np.diff(np.r_[seq,seq[:1]],axis=0);u=e/np.linalg.norm(e,axis=1)[:,None];v=u[:,::-1]*[-1,1]
        a,bw=np.ptp(q@u.T,axis=0),np.ptp(q@v.T,axis=0);j=int(np.argmin(a*bw))
        width,length=sorted((a[j],bw[j]))
        if not 6.2<width<20 or not 8.4<length<32 or area/(width*length)<.88:continue
        axis=u[j] if a[j]>bw[j] else v[j]
        row=dict(tile=tile['id'],i=i,ctr=ctr.tolist(),fp=ll.tolist(),world=world.tolist(),county=arg.region.upper(),
                 city=hit[1],length=float(length),width=float(width),area=float(area),
                 axis=axis.tolist(),h=b['height'],lo=b['minHeight'],distance=float(hit[0]))
        lookup[hit[1]].append(row)
rows=[]
for n,a in lookup.items():
    a.sort(key=lambda r:(r['distance']/25-2.*min(1.,(r['area']-63)/180),r['tile'],r['i']))
    # Avoid clusters becoming merely a pair of detailed rows: cap selected sites by ~110m block.
    count=Counter()
    for p in a:
        key=tuple((np.asarray(p['world'])//110).astype(int))
        if count[key]>=6 or sum(count.values())>=(30 if arg.region=='kings' else 24):continue
        count[key]+=1;rows.append(p)
    print(n,len(a),sum(count.values()))
(W/'candidate-shells.json').write_text(json.dumps(rows,separators=(',',':'))+'\n')
