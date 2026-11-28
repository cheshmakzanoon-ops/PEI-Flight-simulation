#!/usr/bin/python3
"""Screen the exact 12 East Point ordinary wall owners for measurable roof shapes."""
import argparse,gzip,hashlib,json,math,runpy
from pathlib import Path
from urllib.request import Request,urlopen
import numpy as np
from osgeo import gdal,osr
def sha(v):return hashlib.sha256(v).hexdigest()
cli=argparse.ArgumentParser(description=__doc__)
cli.add_argument('repository',type=Path);cli.add_argument('output',type=Path)
cli.add_argument('--cached',type=Path,help='verified local source crop directory')
args=cli.parse_args();root,out=args.repository,args.output
out.mkdir(parents=True,exist_ok=False)
osr.UseExceptions()
atlas=root/'public/world/buildings'
idx=json.loads((atlas/'index.json').read_bytes())
archive=(atlas/idx['file']).read_bytes()
assert sha(archive)==idx['sha256']=='538bcf3cb372be782e6f29d1c9226ca9d05cea9f3a0ac173b9844cc5174fe557'
item=next(q for q in idx['tiles'] if q['id']=='q1333')
at,c=item['offset'],item['bytes']
assert (at,c)==(3260377,9073)
chunk=archive[at:at+c]
assert sha(chunk)==item['sha256']=='bcc9434d46fb77c23f15b94c02f0a7758f3dcfcf61cfa96f6336055347f83279'
features=json.loads(gzip.decompress(chunk))['features']
roles=json.loads((root/'tools/art/east-point-ordinary-walls/fixture/source-geometry-pins.json').read_bytes())['pinnedRoles']
ordinals=[r['ordinal'] for r in roles]
assert ordinals==[12,20,27,29,33,48,49,84,136,156,162,193]
p1,p2=osr.SpatialReference(),osr.SpatialReference()
for p,k in ((p1,4326),(p2,3979)):
 p.ImportFromEPSG(k);p.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
project=osr.CoordinateTransformation(p1,p2)
rings={i:np.array([project.TransformPoint(float(x),float(y))[:2] for x,y in features[i]['footprint']]) for i in ordinals}
A=np.vstack(list(rings.values()))
x0,y0=math.floor(min(A[:,0]))-2,math.floor(min(A[:,1]))-2
x1,y1=math.ceil(max(A[:,0]))+2,math.ceil(max(A[:,1]))+2
w,h=x1-x0,y1-y0
assert 0<w<=680 and 0<h<=680,(w,h)
pins={}
gdal.UseExceptions()
for k,v in {'GDAL_DISABLE_READDIR_ON_OPEN':'EMPTY_DIR','CPL_VSIL_CURL_ALLOWED_EXTENSIONS':'.tif',
 'GDAL_HTTP_TIMEOUT':'35','GDAL_HTTP_MAX_RETRY':'1','GDAL_HTTP_MULTIRANGE':'YES',
 'CPL_VSIL_CURL_CHUNK_SIZE':'65536','CPL_VSIL_CURL_CACHE_SIZE':'16777216'}.items():gdal.SetConfigOption(k,v)
gdal.SetCacheMax(16*1024*1024)
RAW_WINDOW_SHA={
 'dsm':'9d9511d2d2b525008c0061e3ef802b58d51ae5225b4dcb77cb5ab0500d96de44',
 'dtm':'b3ce6bb56133403b234cc4ad618069c5a3857b245c9879c80b66958a7ffee0db',
}
assert (x0,y1,w,h)==(2450629,366291,250,227)
def raster(meta,kind):
 raw=json.loads((root/'data/north-cape-lighthouse-study'/meta).read_bytes())
 pin=raw['source'] if kind=='dtm' else raw
 url,tag=pin['asset'],pin['etag']
 if args.cached:
  wire=(args.cached/(kind+'.f32le.gz')).read_bytes()
  raw=gzip.decompress(wire)
  assert len(raw)==w*h*4 and sha(raw)==RAW_WINDOW_SHA[kind]
  pins[kind]={'url':url,'etag':tag,'first4096SHA256':pin['first4096SHA256'],'localExactF32SHA256':sha(raw)}
  (out/(kind+'.f32le.gz')).write_bytes(wire)
  return np.frombuffer(raw,'<f4').reshape(h,w)
 r=Request(url,headers={'Range':'bytes=0-4095','If-Match':f'"{tag}"'})
 with urlopen(r,timeout=35) as f:
  assert f.status==206 and f.headers['Content-Range'].startswith('bytes 0-4095/') and f.headers['ETag'].strip('"')==tag
  assert sha(f.read(4097))==pin['first4096SHA256']
 gdal.SetConfigOption('GDAL_HTTP_HEADERS',f'If-Match: "{tag}"')
 src=gdal.Open('/vsicurl/'+url)
 assert src.GetSpatialRef().GetAuthorityCode('PROJCS')=='3979'
 assert src.GetGeoTransform()==(2000000.,1.,0.,500000.,0.,-1.)
 band=src.GetRasterBand(1)
 assert band.DataType==gdal.GDT_Float32 and band.GetNoDataValue()==-32767
 a=band.ReadAsArray(x0-2000000,500000-y1,w,h,buf_xsize=w,buf_ysize=h)
 assert a.shape==(h,w) and a.dtype==np.float32
 assert sha(a.astype('<f4').tobytes())==RAW_WINDOW_SHA[kind]
 pins[kind]={'url':url,'etag':tag,'first4096SHA256':pin['first4096SHA256'],'localExactF32SHA256':sha(a.astype('<f4').tobytes())}
 (out/(kind+'.f32le.gz')).write_bytes(gzip.compress(a.astype('<f4').tobytes(),mtime=0))
 src=None
 return a
roof=raster('surface-source.json','dsm')
ground=raster('source.json','dtm')
X,Y=np.meshgrid(x0+np.arange(w)+.5,y1-np.arange(h)-.5)
classify=runpy.run_path(str(root/'tools/qa/roof-fit-pilot.py'))['classify']
rows=[]
for i in ordinals:
 ring=rings[i]
 inside=np.zeros(X.shape,dtype=bool);dist=np.full(X.shape,np.inf)
 for a,b in zip(ring,np.roll(ring,-1,axis=0)):
  dx,dy=b-a
  if dx==dy==0:continue
  if dy!=0:inside^=((a[1]>Y)!=(b[1]>Y))&(X<(Y-a[1])*dx/dy+a[0])
  u=np.clip(((X-a[0])*dx+(Y-a[1])*dy)/(dx**2+dy**2),0,1)
  dist=np.minimum(dist,np.hypot(X-a[0]-u*dx,Y-a[1]-u*dy))
 elig=inside&(dist>1.5)&np.isfinite(roof)&np.isfinite(ground)&(roof!=-32767)&(ground!=-32767)&(roof-ground>1)&(roof-ground<100)
 r=classify(X[elig],Y[elig],roof[elig].astype(float),ring)
 r['ordinal']=i;r['footprintVertices']=len(ring);r['centresInsidePolygon']=int(inside.sum())
 r['stockReportedHeightM']=features[i].get('height')
 r['retainedRoofAboveBareEarthMinMaxM']=[round(float((roof-ground)[elig].min()),4),round(float((roof-ground)[elig].max()),4)] if np.any(elig) else None
 rows.append(r)
 print(json.dumps(r),flush=True)
result={'scope':'Exact source screening only; derived DSM surface and dated atlas, no current roof survey or runtime change.',
 'worldAtlasSHA':idx['sha256'],'wireTileSHA':item['sha256'],'packedTile':'q1333','sourcePins':pins,
 'registration':{'crs':'EPSG:3979; orthometric heights CGVD2013 documented by mosaic','grid':[x0,1,0,y1,0,-1],'dimensions':[w,h]},
 'architectureCondition':'Same inboard 1.5m / four spatial holdouts and paired single-slope / flat controls used by roof-fit-pilot.py. Dataset is independently fixed, not four independent surveys.',
 'licence':'https://open.canada.ca/en/open-government-licence-canada','results':rows}
(out/'roof-scout.json').write_text(json.dumps(result,indent=2)+'\n')
