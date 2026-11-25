"""Fixed real Three.js frames, actual terrain array/ray and collider/old matrix evidence; captures only simulation geometry."""
from pathlib import Path as P
import importlib.util, json, argparse, hashlib, base64, gzip
D = P(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument('--checkout', type=P, required=True)
p.add_argument('--out', type=P, required=True)
p.add_argument('--chromium', required=True)
p.add_argument('--select', nargs='+')
p.add_argument('--flag', action='append', default=[])
p.add_argument('--pose-baseline', type=P)
p.add_argument('--foot', type=P)
a = p.parse_args()
lock = D / 'native-view-locks.json'
data = json.loads(lock.read_bytes())
assert all((t.isalnum() for t in a.flag))
f = importlib.util.spec_from_file_location('PEI', a.checkout / 'tools/qa/fixed-scenery.py')
m = importlib.util.module_from_spec(f)
f.loader.exec_module(m)
stage, settle, quote = (m.stage, m.settle, m.quote)
a.deps = None
a.void_probe = False
a.size = data['size']
names = a.select or list(data['views'])
a.views = ','.join((s + '-close' for s in names))
m.VIEWS = {k: {j: v for j, v in q.items() if j != 'name'} for k, q in data['views'].items()}
m.quote = lambda x: quote(x) + ''.join(('&' + x for x in a.flag))

def st(repo, scratch, deps, vd):
    stage(repo, scratch, deps, vd)
    src = scratch / 'src/main.ts'
    t = src.read_text()
    anc = '  renderer.render(scene,camera);'
    assert t.count(anc) == 1
    insertion = ' try{renderer=new THREE.WebGLRenderer('
    assert t.count(insertion) == 1
    t = t.replace(insertion, (D / 'vbo-capture.ts.txt').read_text() + '\n' + insertion)
    src.write_text(t.replace(anc, (D / 'vbo-readback.ts.txt').read_text() + '\n' + anc))

def settle2(pg, errors):
    _ = settle(pg, errors)
    pg.wait_for_function("typeof window.dalvayOriginalQA==='function' && (()=>{let b=window.islandAirDiagnostics?.buildingTiles;let d=window.islandAirDiagnostics.detail;return !!d&&d.ready>0&&!d.loading&&!d.retrying&&!d.missing&&b&&b.ready>0&&b.ready===b.wanted&&b.loading===0&&b.pending===0&&b.failed===0})()", timeout=90000)
    res = pg.evaluate('(f)=>window.dalvayOriginalQA(f)', json.loads(a.foot.read_bytes()) if a.foot else [])
    for k, typ in [('position', 'f32le'), ('index', 'u16le'), ('position2', 'f32le'), ('index2', 'u16le')]:
        buf = base64.b64decode(res.pop(k))
        dest = a.out / ('terrain-grid-' + ('17-13' if k.endswith('2') else '17-12') + '.' + typ)
        assert not dest.exists() or dest.read_bytes() == buf
        dest.write_bytes(buf)
        res[k + 'SHA256'] = hashlib.sha256(buf).hexdigest()
        res[k + 'Length'] = len(buf)
    out = a.out / 'live-geometry.json'
    arr = json.loads(out.read_bytes()) if out.exists() else []
    arr.append(res)
    out.write_text(json.dumps(arr, indent=2) + '\n')
    g = pg.evaluate('()=>({...window.islandAirDiagnostics,...window.reviewCamera})')
    assert not errors, errors
    return g
m.stage = st
m.settle = settle2
m.run(a)
