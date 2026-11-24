"""No sockets, source data, local archive, or renderer required."""
import importlib.util,io,json,sys,tempfile,unittest,zipfile
from email.message import Message
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import BaseHandler,Request,build_opener
from urllib.response import addinfourl
import numpy as np
P=Path(__file__).resolve().parent
sp=importlib.util.spec_from_file_location('qa',P/'roof-copc-coherence.py')
qa=importlib.util.module_from_spec(sp);sp.loader.exec_module(qa)

class Geometry(unittest.TestCase):
    def test_whole_plan_positive_and_classified_notch(self):
        w=np.array([[.25,.25],[6.75,.25],[6.75,6.75],[3.75,6.75],[3.75,2.6],[2.25,2.6],[2.25,6.75],[.25,6.75]])
        p=np.array([[3.5,2.5],[1.5,3.5],[3,4],[.5,.5]])
        sign,d=qa.boundary(w,p)
        self.assertEqual(sign.tolist(),[True,True,False,True])
        self.assertAlmostEqual(d[-1],.25)
        sq=qa.full_cells(w)
        self.assertIn((1,3),sq)
        self.assertNotIn((3,2),sq) # inside centre, but its square crosses notch
        self.assertNotIn((0,0),sq) # rounded/photo atlas edge cannot be promoted
        self.assertNotIn((3,4),sq)
    def test_same_sign_face_neighbors_and_robust_median(self):
        d={
            (0,0):[.50,.63,.75],(1,0):[.52,.70,1.07],(2,0):[-.52,-.71,-1.1], # no positive-negative merging
            (2,1):[.14,.22,5.5],(2,-1):[-.55,-.98,-1.17],(0,2):[.4,.40,.401], # median .40 does not fire
            (-1,1):[.62,.76,.9],(.1,9):[.01]}
        ok=qa.coherent_cells({k:v for k,v in d.items() if len(v)>=3})
        self.assertEqual([len(c) for c in ok],[2,2,1])
        self.assertTrue(all(row[2]<0 for row in next(v for v in ok if v[0][0]==2)))
        self.assertTrue(all(row[3]==3 for group in ok for row in group))

class PinAndTransport(unittest.TestCase):
    url=qa.ROOT+'pei_2020_390000_688000.copc.laz'
    tag='"0b7526035272de4dee33b9aee1675a35-6"'
    size=48962513
    def test_redirect_is_not_dispatched(self):
        class Fixture(BaseHandler):
            handler_order=10
            seen=[]
            def https_open(self,r):
                self.seen.append(r.full_url)
                a=Message();a['Location']='https://elsewhere.example/raw'
                answer=addinfourl(io.BytesIO(),a,r.full_url,302);answer.msg='challenge';return answer
        f=Fixture(); o=build_opener(qa.NoRedirect(),f)
        with self.assertRaises(HTTPError) as e:o.open(self.url)
        self.assertEqual(e.exception.code,302)
        self.assertEqual(f.seen,[self.url])
    def test_positive_and_wrong_source_version(self):
        class Fake:
            def __init__(self, resp_etag, resp_size):
                self.etag=resp_etag; self.size=resp_size;self.calls=[]
            def open(self, req, timeout=None):
                self.calls.append([req.full_url,req.get_header('Range'),req.get_header('If-match')])
                a=Message();a['Content-Range']=f'bytes 0-3/{self.size}';a['ETag']=self.etag
                b=addinfourl(io.BytesIO(b'LASF'),a,req.full_url,206);return b
        with self.assertRaises(ValueError):qa.OfficialRange(self.url+'?x=y',{'sourceObjectBytes':self.size,'etag':self.tag})
        for tag,size,ok in [(self.tag,self.size,True),('"f'*1+'a'*32+'"',self.size,False),(self.tag,self.size+1,False)]:
            r=qa.OfficialRange(self.url,{'sourceObjectBytes':self.size,'etag':self.tag})
            r.opener=Fake(tag,size)
            if ok:self.assertEqual(r.read(4),b'LASF')
            else:
                with self.assertRaises(ValueError):r.read(4)
            self.assertEqual(r.opener.calls,[[self.url,'bytes=0-3',self.tag]])
            r.seek(self.size-3)
            with self.assertRaises(ValueError):r.read(4)
            self.assertEqual(len(r.opener.calls),1)

class Disk(unittest.TestCase):
    def test_private_cache_and_escape(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);hole=root/'sub';hole.mkdir()
            buf=io.BytesIO()
            np.savez_compressed(buf,points=np.arange(21,dtype='f8').reshape(3,7));data=buf.getvalue()
            (hole/'okay.npz').write_bytes(data)
            good={'privateWindowFile':'okay.npz','privateWindowSHA256':qa.sha(data)}
            self.assertEqual(qa.cache_read(hole,good).shape,(3,7))
            (root/'external.npz').write_bytes(data)
            (hole/'redir.npz').symlink_to(root/'external.npz')
            for bad in ('../external.npz','redir.npz','./okay.npz','sub/okay.npz','sub\\okay.npz'):
                with self.assertRaises(ValueError):qa.cache_read(hole,dict(good,privateWindowFile=bad))
            self.assertEqual(qa.regular_bytes(hole/'okay.npz',len(data)),data)
            with self.assertRaises(ValueError):qa.regular_bytes(hole/'okay.npz',len(data)-1)
            with self.assertRaises(ValueError):qa.cache_read(hole,dict(good,privateWindowSHA256='0'*64))
            with zipfile.ZipFile(hole/'multiple.npz','w') as z:
                z.writestr('a.npy','x');z.writestr('points.npy','y')
            wrong=dict(good,privateWindowFile='multiple.npz',privateWindowSHA256=qa.sha((hole/'multiple.npz').read_bytes()))
            with self.assertRaises(ValueError):qa.cache_read(hole,wrong)
            bomb=io.BytesIO()
            np.lib.format.write_array_header_1_0(bomb,{'shape':(100_000_000,7),'descr':'<f8','fortran_order':False})
            with zipfile.ZipFile(hole/'overshape.npz','w') as z:z.writestr('points.npy',bomb.getvalue())
            fake=dict(good,privateWindowFile='overshape.npz',privateWindowSHA256=qa.sha((hole/'overshape.npz').read_bytes()))
            with self.assertRaisesRegex(ValueError,'shape or dtype'):qa.cache_read(hole,fake)


if __name__=='__main__':unittest.main(verbosity=2)
