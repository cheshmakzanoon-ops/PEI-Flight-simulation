#!/usr/bin/env python3
"""Pack PEI's National Road Network road geometry as quantized centreline ribbons.

Requires GDAL's Python bindings. The input is the official PEI NRN GeoPackage
ZIP or the English GeoPackage it contains. Emits gzip and a source manifest.
"""
import argparse
import gzip
import hashlib
import io
import json
import pathlib
import struct
import zipfile
from osgeo import ogr, osr
ogr.UseExceptions()

SOURCE = "https://geo.statcan.gc.ca/nrn_rrn/pe/nrn_rrn_pe_GPKG.zip"
ZIP_SHA = "c39fe4d569cc70090f14706b76a6626db03f1784e77988fe88225442e926f2bd"
LAYER = "NRN_PE_22_1_ROADSEG"
FRAME = ">HI"
ORIGIN = (-65,45)
SCALE = 100000
CLASSES = {"Expressway / Highway":4,"Arterial":3,"Collector":2,"Ramp":2,
           "Local / Street":1,"Local / Strata":1,"Local / Unknown":1}
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('source',type=pathlib.Path)
    p.add_argument('out',type=pathlib.Path)
    ns=p.parse_args()
    source=ns.source
    if source.suffix.lower()=='.zip':
        data=source.read_bytes()
        if hashlib.sha256(data).hexdigest()!=ZIP_SHA:
            raise ValueError('Unexpected upstream ZIP; review it before changing the checksum')
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            entry,=[n for n in z.namelist() if n.endswith('_en.gpkg')]
        source=f'/vsizip/{source.resolve()}/{entry}'
    ds=ogr.Open(str(source)); layer=ds.GetLayerByName(LAYER)
    dst=osr.SpatialReference()
    dst.ImportFromEPSG(4326); dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    src=layer.GetSpatialRef(); src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform=osr.CoordinateTransformation(src,dst)
    records=io.BytesIO(); count=0; points=0
    for f in layer:
        geom=f.GetGeometryRef().Clone()
        geom.Transform(transform); geom=geom.Simplify(.000022)
        q=[]
        for x,y,*_ in geom.GetPoints():
            xy=(round((x-ORIGIN[0])*SCALE),round((y-ORIGIN[1])*SCALE))
            if not q or q[-1]!=xy: q.append(xy)
        if len(q)<2: continue
        flags=CLASSES.get(f['ROADCLASS'],0)
        if f['PAVSTATUS']=='Paved': flags|=8
        if f['STRUCTTYPE']=='Bridge': flags|=16
        records.write(struct.pack('>HB',len(q),flags))
        for xy in q: records.write(struct.pack('>II',*xy))
        count+=1;points+=len(q)
    assert count>19000
    raw=b'PEIR'+struct.pack(FRAME,1,count)+records.getvalue()
    gz=gzip.compress(raw,compresslevel=9,mtime=0)
    ns.out.mkdir(parents=True,exist_ok=True)
    (ns.out/'roads.bin.gz').write_bytes(gz)
    m=dict(version=1,source=SOURCE,sourceZipSha256=ZIP_SHA,layer=LAYER,segments=count,points=points,
      sourceDescription="Statistics Canada National Road Network, PEI, edition 22_1",
      licence="Open Government Licence – Canada 2.0",licenceUrl="https://open.canada.ca/en/open-government-licence-canada",
      sha256=hashlib.sha256(raw).hexdigest(),gzipSha256=hashlib.sha256(gz).hexdigest(),
      notes="Centreline geometry only. Approximate rendered widths, grades and surfaces. Some bridge centrelines not part of NRN PEI may be absent.")
    (ns.out/'roads.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    print(count,points,len(gz))
if __name__=='__main__': main()
