#!/usr/bin/env python3
"""Extract the one audited OGL NHN South Lake feature from a local package."""
import argparse
import hashlib
import json
from pathlib import Path
from osgeo import ogr,osr

ROOT=Path(__file__).resolve().parents[2]
PACKAGE_SHA='34d3084e55ee0ca19869dd12bbf95a2e54f619d3270e90cff7ae307737900e35'
NID='d0615df188d74a048e076d40d206ab61'
LAYER='NHN_01CD000_2_0_HD_WATERBODY_2'
def pin(p):
    if hashlib.sha256(p.read_bytes()).hexdigest()!=PACKAGE_SHA:raise ValueError('Unexpected NHN package revision')
    ogr.UseExceptions();osr.UseExceptions()
    ds=ogr.Open(f'/vsizip/{p.resolve()}/{LAYER}.shp');layer=ds.GetLayer(0)
    layer.SetAttributeFilter(f"NID='{NID}'")
    if layer.GetFeatureCount()!=1:raise ValueError('Expected exactly one matching NID')
    f=layer.GetNextFeature();g=f.GetGeometryRef().Clone()
    if f['LAKENAME_1']!='South Lake' or g.GetGeometryName()!='POLYGON' or g.GetGeometryCount()!=1 or not g.IsValid():
        raise ValueError('The audited simple polygon has changed')
    source=layer.GetSpatialRef().Clone();out=osr.SpatialReference();out.ImportFromEPSG(4326)
    for crs in (source,out):crs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    g.Transform(osr.CoordinateTransformation(source,out))
    ring=[[round(lon,9),round(lat,9)] for lon,lat,*_ in g.GetGeometryRef(0).GetPoints()]
    meta=dict(schema=1,name=f['LAKENAME_1'],featureId=NID,sourceLayer=LAYER,sourceDataset='01CD000',
       publisher='Natural Resources Canada',product='National Hydro Network – GeoBase Series',
       catalogue='https://open.canada.ca/data/en/dataset/a4b190fe-e090-4e6d-881e-b87956c07977',
       license='Open Government Licence – Canada',licenseURL='https://open.canada.ca/en/open-government-licence-canada',
       attribution='Contains information licensed under the Open Government Licence – Canada.',
       sourceGeometryDate=f['VALDATE'],nameMetadataDate=f['NAMEDATE'],sourceCRS='EPSG:4617',
       archiveSha256=PACKAGE_SHA,coordinateCRS='EPSG:4326 (longitude, latitude)',
       notes='Historical polygon scopes a visual shelter effect only. It is not an updated shoreline, depth or tide source.')
    report=json.dumps(meta,indent=2)[:-2]+',\n  "ring": [\n'+',\n'.join('    '+json.dumps(p) for p in ring)+'\n  ]\n}\n'
    (ROOT/'data/sheltered-water/south-lake-nhn.json').write_text(report)
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('package',type=Path)
    pin(parser.parse_args().package)
