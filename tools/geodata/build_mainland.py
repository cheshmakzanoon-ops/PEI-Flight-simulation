#!/usr/bin/env python3
"""Rebuild the low-detail mainland backdrop; requires GDAL Python/OGR, Pillow and NumPy.
The project area is PEI. This secondary, intentionally coarse layer only depicts distant coast
in New Brunswick and Nova Scotia. Flight details, structures and airport operations are out of scope.
Usage: python3 tools/geodata/build_mainland.py --out public/world/mainland --cache /tmp/pei-mainland
Optionally point --sentinel-cache at existing <scene-id>.tif and <scene-id>.scl.tif files.
"""
from pathlib import Path
import argparse,gzip,hashlib,json,urllib.request,urllib.parse,itertools,subprocess
import numpy as np
from osgeo import gdal,ogr,osr
from PIL import Image
gdal.UseExceptions();ogr.UseExceptions()
B=(-65.10,45.57,-61.50,47.28);W,H=1536,1032;WATER=-32768
HR='https://canelevation-dem.s3.ca-central-1.amazonaws.com/hrdem-mosaic-1m/10_3-mosaic-1m-dtm.tif'
STAC='https://datacube.services.geo.ca/stac/api/collections/hrdem-mosaic-1m/items/10_3-mosaic-1m'
ESAS=['https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_'+t+'_Map.tif' for t in ('N45W066','N45W063')]
MR='https://canelevation-dem.s3.ca-central-1.amazonaws.com/mrdem-30/mrdem-30-dtm.tif'
MR_SPEC='https://download-telecharger.services.geo.ca/pub/elevation/dem_mne/MRDEM_MNEMR/CanElevation-MRDEM-Product-Specifications.pdf'
MED_URLS=[f'https://esa-worldcover-s2.s3.eu-central-1.amazonaws.com/rgbnir/2021/N{a}/ESA_WorldCover_10m_2021_v200_N{a}W{b:03}_S2RGBNIR.tif' for a,b in [(45,66),(45,65),(45,64),(45,63),(45,62),(46,66),(46,65),(46,64),(46,62),(47,66),(47,65)]]
ESADOI='https://doi.org/10.5281/zenodo.7254221'
PR_SHA={'12':'0b566caf7d862d0e02d554dc7d99811531457989b8fb607cc58eaf875355ad09','13':'ce3166c86d0c84a0f0144026cd253e60ef2a5a367e234adf3ab6a66265645cc5'}
IDS=['S2B_20TLS_20250904_1_L2A','S2B_20TLT_20250904_1_L2A','S2B_20TMS_20250904_1_L2A','S2B_20TNS_20250904_0_L2A','S2A_20TMT_20250904_0_L2A','S2B_20TNR_20250815_0_L2A','S2C_20TMR_20250807_0_L2A','S2B_20TNS_20250616_0_L2A','S2B_20TMS_20250527_0_L2A']
def sha(b):return hashlib.sha256(b).hexdigest()
def dump(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def prurl(r):return 'https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer/0/query?'+urllib.parse.urlencode({'where':"PRUID='%s'"%r,'outFields':'PRUID','returnGeometry':'true','outSR':'4326','geometryPrecision':'5','maxAllowableOffset':'0.00035','f':'geojson'})
def saturl(i,band):
 _,mgrs,dat,_,_=i.split('_');return 'https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/'+mgrs[:2]+'/'+mgrs[2]+'/'+mgrs[3:]+'/'+dat[:4]+'/'+str(int(dat[4:6]))+'/'+i+'/'+band+'.tif'
def cogs(cache):
 common=['--config','GDAL_DISABLE_READDIR_ON_OPEN','EMPTY_DIR','--config','GDAL_HTTP_TIMEOUT','90','--config','GDAL_HTTP_MULTIRANGE','YES','-q','-t_srs','EPSG:4326','-te',*map(str,B),'-ts',str(W),str(H),'-co','TILED=YES','-co','COMPRESS=DEFLATE']
 ht=cache/'context-dtm.tif';lc=cache/'cover.tif'
 if not ht.exists():subprocess.run(['gdalwarp',*common,'-ovr','6','-r','bilinear','-ot','Float32','-dstnodata',str(WATER),'/vsicurl/'+HR,str(ht)],check=True)
 if not lc.exists():subprocess.run(['gdalwarp',*common,'-ovr','AUTO','-r','near','-ot','Byte','-srcnodata','0','-dstnodata','0',*['/vsicurl/'+u for u in ESAS],str(lc)],check=True)
 mt=cache/'mrdem.tif';med=cache/'median.tif'
 if not mt.exists():subprocess.run(['gdalwarp',*common,'-ovr','AUTO','-r','bilinear','-ot','Float32','-dstnodata',str(WATER),'/vsicurl/'+MR,str(mt)],check=True)
 if not med.exists():subprocess.run(['gdalwarp',*common,'-ovr','AUTO','-r','bilinear','-ot','UInt16','-srcnodata','0','-dstnodata','0',*['/vsicurl/'+u for u in MED_URLS],str(med)],check=True)
 return tuple(gdal.Open(str(i)).ReadAsArray() for i in [ht,lc,mt,med])
def make(out,cache,sc):
 out.mkdir(parents=True,exist_ok=True);cache.mkdir(parents=True,exist_ok=True)
 s=osr.SpatialReference();s.ImportFromEPSG(4326);Q=4;dx=(B[2]-B[0])/W;dy=(B[3]-B[1])/H
 m=gdal.GetDriverByName('MEM').Create('',W*Q,H*Q,1,gdal.GDT_Byte);m.SetGeoTransform((B[0],dx/Q,0,B[3],0,-dy/Q));m.SetProjection(s.ExportToWkt())
 for r,hashv in PR_SHA.items():
  fp=cache/('pr'+r+'.json')
  if not fp.exists():
   with urllib.request.urlopen(prurl(r),timeout=120) as rr:fp.write_bytes(rr.read())
  if sha(fp.read_bytes())!=hashv:raise RuntimeError('Government coast %s changed; review before refreshing hash'%r)
  ds=ogr.Open(str(fp));gdal.RasterizeLayer(m,[1],ds.GetLayer(0),burn_values=[1])
 hi=m.ReadAsArray();m=None;alpha=np.rint(hi.reshape(H,Q,W,Q).mean((1,3))*255).astype('uint8');del hi
 land=alpha>0;dt,lc,mdt,med=cogs(cache);measured=land&(dt!=WATER)&np.isfinite(dt);fill=land&~measured
 mfill=fill&(mdt!=WATER)&np.isfinite(mdt);dt[mfill]=mdt[mfill]
 if np.any(fill&~mfill):raise RuntimeError('National MRDEM unexpectedly missing in mainland backdrop')
 z=np.full((H,W),WATER,dtype='<i2');z[land]=np.rint(dt[land]).astype('<i2');raw=z.tobytes();(out/'height.bin.gz').write_bytes(gzip.compress(raw,compresslevel=9,mtime=0))
 colors={0:(92,104,84),10:(62,85,60),20:(84,101,68),30:(120,132,84),40:(139,129,83),50:(152,146,132),60:(175,153,124),70:(204,204,201),80:(67,100,107),90:(99,111,85),95:(84,105,76),100:(106,107,83)}
 lut=np.tile(np.array(colors[0],np.uint8),(256,1))
 for k,v in colors.items():lut[k]=v
 rgb=lut[lc];used=np.zeros((H,W),bool);info=[]
 for id in IDS:
  urls={k:saturl(id,k) for k in ('TCI','SCL')};a=sc/(id+'.tif');b=sc/(id+'.scl.tif')
  def sample(path,url,algo):
   src=str(path) if path.exists() else '/vsicurl/'+url
   im=gdal.Warp('',src,format='MEM',outputBounds=B,width=W,height=H,dstSRS='EPSG:4326',srcNodata=0,dstNodata=0,resampleAlg=algo);return im.ReadAsArray()
  sat=sample(a,urls['TCI'],'bilinear').transpose(1,2,0);classes=sample(b,urls['SCL'],'near');sel=land&~used&np.isin(classes,[4,5,6,7])&sat.any(2)
  if sel.any():rgb[sel]=sat[sel];used[sel]=True;info.append({'id':id,'naturalColor':urls['TCI'],'sceneClassification':urls['SCL'],'pixelsUsed':int(sel.sum())})
 # Use genuine 2021 photo composite in 2025 gaps. Harmonize B04/R, B03/G, B02/B
 # to 2025 TCI colour via monotone empirical per-band quantiles over common observed land.
 med=med[:3].transpose(1,2,0);v=(med>0).all(2)&land;overlap=used&v
 if overlap.sum()<1000:raise RuntimeError('Inadequate reliable colour overlap')
 supp=v&~used;qs=[0,1,3,8,15,25,40,55,70,82,92,97,99,100]
 for ch in range(3):
  x=np.percentile(med[:,:,ch][overlap],qs);y=np.percentile(rgb[:,:,ch][overlap],qs);distinct=np.r_[True,np.diff(x)>0]
  rgb[:,:,ch][supp]=np.rint(np.interp(med[:,:,ch][supp],x[distinct],y[distinct])).clip(0,255).astype('uint8')
 mask=alpha>0;rgb[~mask]=0
 im=Image.fromarray(np.dstack((rgb,alpha)),'RGBA')
 im.save(out/'color.webp',format='WEBP',quality=84,method=6,exact=True)
 src=[{'product':'Statistics Canada 2021 Census cartographic boundary files','urls':[prurl(r) for r in PR_SHA],'sha256':PR_SHA,'regions':['Nova Scotia','New Brunswick'],'transformation':'Outer WGS84 bounds; 4× supersampled shoreline coverage.'},{'product':'NRCan CanElevation HRDEM 1m mosaic bare-earth DTM','stac':STAC,'url':HR,'etag':'eb6a8f985dbf26b24d503d1502ce589b-2727','resampling':'128 m overview, bilinear warp, rounded metres.'},{'product':'Copernicus Sentinel-2 L2A','scenes':info,'processing':'Clear classes 4, 5, 6, 7; selected in listed order, reprojected to a ~180 m backdrop.'},{'product':'ESA WorldCover 10 m 2021 v200','doi':ESADOI,'urls':ESAS,'transformation':'Where clear scene pixels are unavailable, classes assign representative artist colours. Not photographic in those cells.'}]
 src.extend([{'product':'NRCan CanElevation Medium Resolution Digital Terrain Model (MRDEM-30)','url':MR,'specification':MR_SPEC,'transformation':'National measured/modelled 30 m terrain where HRDEM is unavailable, warped to context grid. No nearest-neighbour extension of distant terrain.'},{'product':'ESA WorldCover Sentinel-2 2021 RGBNIR annual median','urls':MED_URLS,'information':'https://esa-worldcover.org/en/data-access','processing':'RGB bands from annual satellite composite cover 2025 gaps; per-band luminance quantiles matched to observed 2025 overlap. No invented storefront detail.'}])
 idx={'version':1,'dataRevision':2,'scope':'Non-playable mainland context: portions of New Brunswick and Nova Scotia for the PEI horizon and Confederation Bridge landfall. No additional province is simulated.','bounds':B,'width':W,'height':H,'crs':'EPSG:4326, pixel-edge bounds','verticalDatum':'CGVD2013, metres','nominalPixelMetres':182,'nodata':WATER,'file':'height.bin.gz','color':'color.webp','colorEncoding':'north-up sRGB RGBA; alpha is land cover fraction from 4x4 subpixels. Treat nonzero data as partial shore; do not add as playable airports.','encoding':'north-first signed Int16LE, metres, -32768 water.','counts':{'landAndPartialShoreCells':int(land.sum()),'directDtmCells':int(measured.sum()),'mediumResolutionNationalDtm':int(mfill.sum()),'extrapolatedTerrain':0,'clearNaturalColour':int(used.sum()),'annual2021NaturalColour':int(supp.sum()),'classifiedColourFallback':int((land&~used&~supp).sum())},'files':{fn:sha((out/fn).read_bytes()) for fn in ['height.bin.gz','color.webp']},'heightUncompressedSha256':sha(raw),'sources':src,'attribution':'Contains information licensed under the Open Government Licence – Canada (Statistics Canada; Natural Resources Canada). Contains modified Copernicus Sentinel data 2025. © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium. Adapted; background only. MRDEM was produced in part using Copernicus WorldDEM-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA; all rights reserved. The organisations in charge of the Copernicus programme by law or delegation incur no liability for use of the Copernicus WorldDEM-30. Natural Resources Canada retains copyright for HRDEM-derived portions.','licenses':['https://open.canada.ca/en/open-government-licence-canada','https://dataspace.copernicus.eu/terms-and-conditions','https://creativecommons.org/licenses/by/4.0/']}
 dump(out/'context.json',idx);print(idx['counts'],idx['files'],flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,default=Path('public/world/mainland'));p.add_argument('--cache',type=Path,required=True);p.add_argument('--sentinel-cache',type=Path);a=p.parse_args();make(a.out,a.cache,a.sentinel_cache or a.cache)
