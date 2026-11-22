#!/usr/bin/env python3
"""Package 2020 NRCan PEI building survey into adaptive web tiles. Requires GDAL/OGR 3 and Python 3."""
import argparse, gzip, hashlib, io, json, math, tempfile, urllib.request, zipfile
from pathlib import Path
from osgeo import ogr, osr, gdal
URL="https://ftp.maps.canada.ca/pub/nrcan_rncan/extraction/auto_building/gpkg/Autobuilding_PE_Prince_Edward_Island_2020_gpkg.zip"
ARCHIVE_SHA="0d18151396c2a8981de88450670daab5f3495907ff945c7c73c909af1a50912b"
ROOT_BOUNDS=(-64.47,45.94,-61.93,47.10)
def dump(obj):return json.dumps(obj,ensure_ascii=False,separators=(",",":"),allow_nan=False).encode()
def ring(g):
    pts=[]
    for x,y,*_ in g.GetPoints():
        p=[round(x,6),round(y,6)]
        if not pts or p!=pts[-1]: pts.append(p)
    if len(pts)>1 and pts[-1]==pts[0]: pts.pop()
    if len(pts)<3: return []
    return pts
def pack(src,out):
    gdal.UseExceptions(); obr=ogr.Open(str(src));layer=obr.GetLayerByIndex(0); sr=layer.GetSpatialRef(); wgs=osr.SpatialReference(); wgs.ImportFromEPSG(4326)
    for s in (sr,wgs):s.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    trans=osr.CoordinateTransformation(sr,wgs)
    rows=[];holes=0; ringvertices=0; missing=0
    for feat in layer:
        geom=feat.GetGeometryRef().Clone();geom.Transform(trans)
        if geom.GetGeometryName()!="POLYGON":raise ValueError("Unexpected geometry type")
        rings=[ring(geom.GetGeometryRef(i)) for i in range(geom.GetGeometryCount())];sh=rings[0]
        if len(sh)<3:raise ValueError("Invalid outer ring")
        extent=geom.GetEnvelope()
        x,y=(extent[0]+extent[1])/2,(extent[2]+extent[3])/2
        lo=feat.GetField('heightmin');hi=feat.GetField('heightmax')
        val={"footprint":sh}
        if not hi or hi<=0:missing+=1
        else:val["height"]=round(hi,2);val["minHeight"]=max(0,min(val["height"],round(lo or 0,2)))
        if len(rings)>1:
            val["holes"]=[r for r in rings[1:] if r];holes+=len(val["holes"])
        ringvertices+=sum(map(len,rings));rows.append((x,y,val,extent))
    if len(rows)!=85866 or missing!=0:raise ValueError("Upstream geometry or height count changed")
    out.mkdir(parents=True,exist_ok=True)
    entries=[];counts=[];packed=bytearray()
    def emit(records,box,tid):
        if not records:return
        # Typical tiles are small. Split geography into at least 8x8 nominal cells.
        if len(tid)<4 or len(records)>750:
            w,s,e,n=box;cx=(w+e)/2;cy=(s+n)/2;child=[[],[],[],[]];ex=[(w,s,cx,cy),(cx,s,e,cy),(w,cy,cx,n),(cx,cy,e,n)]
            for r in records:child[(1 if r[0]>=cx else 0)+(2 if r[1]>=cy else 0)].append(r)
            for k,rl in enumerate(child):emit(rl,ex[k],tid+str(k))
            return
        # Tight bounds include all vertices, including polygons crossing the subdivision line.
        b=[math.floor(min(r[3][0] for r in records)*1e6)/1e6,math.floor(min(r[3][2] for r in records)*1e6)/1e6,math.ceil(max(r[3][1] for r in records)*1e6)/1e6,math.ceil(max(r[3][3] for r in records)*1e6)/1e6]
        origin=[b[0],b[1]]; blob=dump({"origin":origin,"features":[r[2] for r in records]})
        zipped=gzip.compress(blob,compresslevel=9,mtime=0); offset=len(packed); packed.extend(zipped)
        entries.append({"id":tid,"offset":offset,"bounds":b,"count":len(records),"bytes":len(zipped),"sha256":hashlib.sha256(zipped).hexdigest()});counts.append(len(records))
    emit(rows,ROOT_BOUNDS,"q")
    assert sum(e['count'] for e in entries)==len(rows)
    (out/"tiles.pack").write_bytes(packed)
    metadata={"schema":1,"file":"tiles.pack","bytes":len(packed),"sha256":hashlib.sha256(packed).hexdigest(),"bounds":ROOT_BOUNDS,"count":len(rows),"heightCount":len(rows)-missing,"holes":holes,"vertices":ringvertices,"tileCompression":"gzip","coordinates":"EPSG:4326 lon,lat; 6 decimals; polygon rings unclosed","heightUnit":"metres above local ground; height is highest LiDAR roof return and minHeight the lowest measured height, not an elevation above ground of the building base","survey":"2020-07-15 to 2020-09-15","quality":"Classified as Fair by source. Roof facades, occupancy, names, materials, exact roof shapes, and later development are not measured by this catalog.","source":{"title":"Natural Resources Canada, Automatically Extracted Buildings; PEI 2020 provincial-territorial airborne LiDAR survey","record":"https://open.canada.ca/data/en/dataset/7a5cda52-c7df-427f-9ced-26f19a8a64d6","url":URL,"archiveSha256":ARCHIVE_SHA,"attribution":"Contains information licensed under the Open Government Licence – Canada. Derived from Natural Resources Canada’s Automatically Extracted Buildings, Prince Edward Island 2020.","license":"https://open.canada.ca/en/open-government-licence-canada"},"tiles":entries}
    (out/"index.json").write_bytes(dump(metadata)+b"\n"); print(len(rows),len(entries),min(counts),max(counts),sum(t["bytes"] for t in entries),holes,ringvertices)
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("--out",default="public/world/buildings",type=Path);p.add_argument("--archive",help="Use a locally cached official source ZIP.",type=Path);args=p.parse_args()
    with tempfile.TemporaryDirectory() as tmp:
        dat=args.archive.read_bytes() if args.archive else urllib.request.urlopen(URL,timeout=120).read()
        if hashlib.sha256(dat).hexdigest()!=ARCHIVE_SHA:raise ValueError("Source changed. Audit before updating the hash")
        with zipfile.ZipFile(io.BytesIO(dat)) as z:
            files=[n for n in z.namelist() if n.lower().endswith('.gpkg')];assert len(files)==1
            gpkg=Path(tmp)/'src.gpkg';gpkg.write_bytes(z.read(files[0]))
        pack(gpkg,args.out)
if __name__=="__main__":main()
