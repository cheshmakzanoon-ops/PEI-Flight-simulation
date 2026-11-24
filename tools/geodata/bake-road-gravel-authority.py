#!/usr/bin/python3
"""Replay PEI NRN 22_1 exactly; derive an opt-in, no-geometry gravel authority."""
import argparse,base64,gzip,hashlib,importlib.util,json,math,struct,sys
from collections import Counter
from pathlib import Path
from osgeo import ogr,osr
ogr.UseExceptions()

ROOT=Path(__file__).absolute().parents[2]
SOURCE_SHA='47dbfc17f20846fc1f077e214d0e6ac3f2676dfa2f79b754a2cd941e768a7e6a'
NRN_SHA='72528a1b26b68ee345e5047f30f2c9b49a3c18edeaccaf3e759ead296d3276c1'
# Individual study sites, not county divisions. Nearby rows are diagnostic
# nominations only, not a separate source classification or traffic claim.
AREAS=[('Prince: Tyne Valley',-63.923,46.573),('Prince: West Cape',-64.316,46.640),
 ('Queens: Brookvale',-63.438,46.288),('Queens: Rustico',-63.308,46.438),
 ('Kings: New Harmony',-62.221,46.380),('Kings: Souris West',-62.298,46.344)]
M=6378137*math.pi/180; E2=6.69437999014e-3; P=math.radians(46.5); DEN=1-E2*math.sin(P)**2
def metres(x,y):return ((x+63.2)*M*math.cos(P)/math.sqrt(DEN),(46.5-y)*M*(1-E2)/DEN**1.5)
def run(source,root,out):
    h=lambda a:hashlib.sha256(a).hexdigest()
    assert h(source.read_bytes())==SOURCE_SHA
    manifest=json.loads((root/'public/world/roads.json').read_text())
    packed=gzip.decompress((root/'public/world/roads.bin.gz').read_bytes())
    assert NRN_SHA==manifest['sha256']==h(packed)
    magic,version,count=struct.unpack_from('>4sHI',packed)
    assert (magic,version,count)==(b'PEIR',1,19465)
    loader=importlib.util.spec_from_file_location('build',root/'tools/geodata/build_roads.py')
    mod=importlib.util.module_from_spec(loader);loader.loader.exec_module(mod)
    ds=ogr.Open(str(source)); layer=ds.GetLayerByName(manifest['layer'])
    frm=layer.GetSpatialRef();frm.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    to=osr.SpatialReference();to.ImportFromEPSG(4326);to.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    trans=osr.CoordinateTransformation(frm,to)
    o=10;ordinal=0;bits=bytearray((count+7)//8);classes=Counter();picked=[];unknown=[]
    target=[(name,metres(x,y)) for name,x,y in AREAS]
    points_mins={k:(0.,[]) for k,p in target}
    for feature in layer:
        geometry=feature.GetGeometryRef().Clone();geometry.Transform(trans);geometry=geometry.Simplify(.000022)
        pts=[]
        for x,y,*_ in geometry.GetPoints():
            node=round((x+65)*1e5),round((y-45)*1e5)
            if not pts or pts[-1]!=node:pts.append(node)
        if len(pts)<2:continue
        flags=mod.CLASSES.get(feature['ROADCLASS'],0)
        if feature['PAVSTATUS']=='Paved':flags|=8
        if feature['STRUCTTYPE']=='Bridge':flags|=16
        row=struct.pack('>HB',len(pts),flags)+b''.join(struct.pack('>II',*u) for u in pts)
        assert row==packed[o:o+len(row)],ordinal
        status,surface=feature['PAVSTATUS'],feature['UNPAVSURF']
        classes['|'.join([status,surface,'bridge' if flags&16 else 'ground'])]+=1
        if status=='Unpaved' and surface=='Gravel' and not flags&24:
            bits[ordinal>>3]|=1<<(ordinal&7)
            wgs=[(x/1e5-65,y/1e5+45) for x,y in pts];xy=[metres(x,y) for x,y in wgs]
            dists=[math.dist(a,b) for a,b in zip(xy,xy[1:])]
            length=sum(dists)
            rec={'ordinal':ordinal,'roadID':feature['ROADSEGID'],'roadName':feature['L_STNAME_C'],
                 'place':feature['L_PLACENAM'],'flags':flags,'gameLength':round(length,3),'assetPoints':wgs}
            picked.append(rec)
            for i,(a,b) in enumerate(zip(xy,xy[1:])):
                m=[(u+v)*.5 for u,v in zip(a,b)]
                for name,p in target:
                    if math.dist(m,p)>=3800:continue
                    total,rs=points_mins[name];points_mins[name]=(total+dists[i],rs)
                    if dists[i]<100 or not isinstance(feature['L_STNAME_C'],str) or feature['L_STNAME_C'] in ('None','Unknown'):continue
                    rs.append(dict(ordinal=ordinal,roadName=feature['L_STNAME_C'],sourcePlace=feature['L_PLACENAM'],
                        arc=round(dists[i],2),ends=[wgs[i],wgs[i+1]],startZ=round(m[1],1)))
        elif status=='Unknown' and not flags&16:unknown.append(ordinal)
        ordinal+=1;o+=len(row)
    assert (ordinal,o)==(count,len(packed)) and len(picked)==2651
    out.mkdir(exist_ok=True,parents=True)
    (out/'gravel.generated.ts').write_text('// Derived from pinned NRN PEI 22_1; run tools/geodata/bake-road-gravel-authority.py. Canada OGL 2.0.\n'
              f'export const GRAVEL_SOURCE_SHA256 = {NRN_SHA!r};\nexport const GRAVEL_SOURCE_COUNT = {count};\n'
              f'export const GRAVEL_SOURCE_BITS = {base64.b64encode(bits).decode()!r};\n')
    (out/'eligible-rows.json').write_text(json.dumps(picked,separators=(',',':'))+'\n')
    metrics={'rowsReplayExact':ordinal,'sourceSHA256':SOURCE_SHA,'decodedNetworkSHA256':NRN_SHA,
      'authorityBytes':len(bits),'authoritySHA256':h(bits),'classes':dict(classes),'selected':len(picked),
      'distanceGameMetres':round(sum(x['gameLength'] for x in picked),3),'protectedUnknownOrdinals':unknown,
      'siteCensus':{n:{'studyRadiusGameMetres':3800,'arcMidpointGameMetres':round(alen,2),
        'segmentsByLength':sorted(rows,key=lambda r:r['arc'],reverse=True)[:9]} for n,(alen,rows) in points_mins.items()}}
    (out/'source-census.json').write_text(json.dumps(metrics,indent=2)+'\n')
    print(json.dumps(metrics,indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,required=True);p.add_argument('--repo',type=Path,default=ROOT)
    p.add_argument('--out',type=Path,required=True);a=p.parse_args();run(a.source,a.repo,a.out)
