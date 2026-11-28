"""Exact tests for the discrete device sample auditor."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np

m=importlib.util.spec_from_file_location("audit",Path(__file__).with_name("four-sample-audit.py"))
a=importlib.util.module_from_spec(m);m.loader.exec_module(a)
red=np.array([255,41,89]);blue=np.array([28,204,255])


def example():
    old=np.broadcast_to([62,82,41,133],(3,5,4)).copy()
    probes=[]
    for tag in (red,blue):
        f=old.copy()
        for k in range(5):
            f[:,k,:3]=np.rint((tag*k+old[:,k,:3]*(4-k))/4)
        probes.append(f)
    return old,*probes


class SampleTests(unittest.TestCase):
    def test_exact_coverage_codes_unambiguous(self):
        x=a.assess(*example(),red,blue)
        self.assertEqual(x["state"],"integer sample witness")
        self.assertEqual(x["markedSampleHistogram0to4"],[3]*5)

    def test_composition_noninteger_cannot_be_rounded_into_an_approved_class(self):
        old,p,q=example()
        p[1,2,:3]=np.rint(p[1,2,:3]*.74+old[1,2,:3]*.26)
        q[1,2,:3]=np.rint(q[1,2,:3]*.74+old[1,2,:3]*.26)
        x=a.assess(old,p,q,red,blue)
        self.assertEqual(x["unquantizedPixels"],1)
        self.assertEqual(x["unquantizedComponents"],[{"pixels":1,"boxXYXY":[2,1,3,2]}])
        self.assertTrue(x["state"].startswith("HOLD"))

    def test_nonliteral_and_unchanged_dark_world_checks(self):
        old,p,q=example()
        p[0,0,0]+=2;q[0,0,0]+=2
        p[0,4,1]+=2;q[0,4,1]+=2
        p[1,3,3]+=1
        x=a.assess(old,p,q,red,blue)
        self.assertEqual(x["unquantizedPixels"],0)
        self.assertEqual((x["changedZeroCasePixels"],x["nonliteralFullCasePixels"],x["nativeAlphaChanges"]),(1,1,1))
        self.assertTrue(x["state"].startswith("HOLD"))

    def test_refuses_near_identical_mark_palette(self):
        with self.assertRaises(ValueError):
            a.assess(*example(),[194,71,130],[190,74,127])


if __name__=="__main__":
    unittest.main()
