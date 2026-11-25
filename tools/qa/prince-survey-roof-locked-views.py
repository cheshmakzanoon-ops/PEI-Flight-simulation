import argparse, importlib.util, json
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--checkout',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--chromium',required=True)
p.add_argument('--controls',type=Path,required=True);p.add_argument('--baseline',type=Path)
a=p.parse_args();a.deps=None;a.void_probe=False;a.pose_baseline=a.baseline;a.size='840x540'
spec=importlib.util.spec_from_file_location('fixed',a.checkout/'tools/qa/fixed-scenery.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
views=json.loads(a.controls.read_text())['views']
b.VIEWS={v:{**q,'nearDist':q['dist'],'nearAgl':q['agl']}for v,q in views.items()}
a.views=','.join(v+'-close'for v in b.VIEWS)
b.run(a)
