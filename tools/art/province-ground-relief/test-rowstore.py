"""Exercise exact LZW block reassembly with typed files, no network."""
import importlib.util,struct,json,unittest
from pathlib import Path
import numpy as np
from osgeo import gdal
P=Path(__file__).with_name('read-paired.py')
q=importlib.util.spec_from_file_location('r',P)
m=importlib.util.module_from_spec(q);q.loader.exec_module(m)
gdal.UseExceptions()
class Test(unittest.TestCase):
 def test_all_small_grid_shapes(self):
  for h,w in [(512,512),(512,1024),(1024,512),(1024,1024)]:
   with self.subTest(h=h,w=w):
    y,x=np.indices((h,w));A=((x%47)*.0125+y*.002+(x//512)*11-(y//512)*62).astype('<f4')
    path='/vsimem/make-blocks.tif';out='/vsimem/rebuilt-blocks.tif'
    d=gdal.GetDriverByName('GTiff').Create(path,w,h,1,gdal.GDT_Float32,
      options=['TILED=YES','BLOCKXSIZE=512','BLOCKYSIZE=512','COMPRESS=LZW','PREDICTOR=1','BIGTIFF=NO'])
    d.GetRasterBand(1).WriteArray(A);d.FlushCache();d=None
    b=bytes(gdal.VSIGetMemFileBuffer_unsafe(path));gdal.Unlink(path)
    p,=struct.unpack_from('<I',b,4);n,=struct.unpack_from('<H',b,p)
    tags={k:s for k,*s in [struct.unpack_from('<HHII',b,p+2+12*i) for i in range(n)]}
    vals=lambda key:[tags[key][2]] if tags[key][1]==1 else struct.unpack_from('<'+'I'*tags[key][1],b,tags[key][2])
    packets=[b[a:a+n] for a,n in zip(vals(324),vals(325))]
    gdal.FileFromMemBuffer(out,m.open_mosaic(packets,w//512,h//512))
    dst=gdal.Open(out);self.assertTrue(np.array_equal(A,dst.ReadAsArray()));dst=None;gdal.Unlink(out)
if __name__=='__main__':unittest.main()
