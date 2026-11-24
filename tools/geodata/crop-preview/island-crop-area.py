"""Separate native binary area diagnostic; not validation of the crop survey."""
from pathlib import Path
import argparse,json,zipfile
from osgeo import gdal,ogr,osr
import numpy as np
cli=argparse.ArgumentParser(description=__doc__);cli.add_argument('--source',type=Path,required=True);p=cli.parse_args().source.resolve()
gdal.UseExceptions();ogr.UseExceptions()
src=gdal.Open(str(p/'aci_2025_pe_v1.tif'));qual=gdal.Open(str(p/'aci_2025_pe_confidence_v1.tif'))
assert src.GetGeoTransform()==qual.GetGeoTransform()
z=p/'statcan-province-2021.zip'
names=zipfile.ZipFile(z).namelist()
name=next(n for n in names if n.lower().endswith('.shp'))
boundary=ogr.Open(f'/vsizip/{z}/{name}');l=boundary.GetLayer()
l.SetAttributeFilter("PRUID = '11'")
row=l.GetNextFeature();assert row and l.GetNextFeature() is None
ref=src.GetSpatialRef()
shape=row.GetGeometryRef().Clone()
shape.Transform(osr.CoordinateTransformation(l.GetSpatialRef(),ref))
tmp=ogr.GetDriverByName('Memory').CreateDataSource('');t=tmp.CreateLayer('pei',ref,ogr.wkbMultiPolygon)
feat=ogr.Feature(t.GetLayerDefn());feat.SetGeometry(shape);assert t.CreateFeature(feat)==0
mask=gdal.GetDriverByName('MEM').Create('',src.RasterXSize,src.RasterYSize,1,gdal.GDT_Byte)
mask.SetGeoTransform(src.GetGeoTransform());mask.SetProjection(ref.ExportToWkt())
gdal.RasterizeLayer(mask,[1],t,burn_values=[1]);isle=mask.ReadAsArray()>0
a=src.ReadAsArray();q=qual.ReadAsArray();classed=a==177
data={'provinceBoundary':'Statistics Canada 2021 Census cartographic PRUID 11',
'rectangleClass177Cells':int(classed.sum()),'provinceClass177Cells':int((classed&isle).sum()),
'provinceClass177AreaKm2':float((classed&isle).sum())*.0009,
'provinceClass177Acres':float((classed&isle).sum())*900/4046.8564224,
'provinceClass177Minimum80ScoreCells':int((classed&isle&(q>=80)).sum())}
print(json.dumps(data,indent=2));(p/'clipped-native-area.json').write_text(json.dumps(data,indent=2)+'\n')
