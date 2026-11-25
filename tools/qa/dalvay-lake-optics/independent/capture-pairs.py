"""Immutable scene comparison. Extra instrumentation never ships."""
from pathlib import Path
from hashlib import sha256
import argparse, base64, importlib.util, json
from PIL import Image
import numpy as np
p = argparse.ArgumentParser()
p.add_argument('--checkout', type=Path, required=True)
p.add_argument('--out', type=Path, required=True)
p.add_argument('--chromium', required=True)
p.add_argument('--views', nargs='+', required=True)
a = p.parse_args()
d = Path(__file__).resolve().parent
baseline = d / 'fixed-poses.json'
records = json.loads(baseline.read_text())
q = {'size': '900x600', 'views': {r['pose']['site']: r['pose'] for r in records}}
assert set(a.views) <= set(q['views'])
spec = importlib.util.spec_from_file_location('fixed', a.checkout / 'tools/qa/fixed-scenery.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
m.VIEWS = {n: {k: x[k] for k in ('lon', 'lat', 'h', 'east', 'south')} | {'nearDist': x['dist'], 'nearAgl': x['agl']} for n, x in q['views'].items()}
a.views = ','.join((x + '-close' for x in a.views))
a.size = q['size']
a.deps = None
a.void_probe = False
a.pose_baseline = baseline
quote = m.quote
m.quote = lambda x: quote(x) + '&dalvayWaterOptics'
stage = m.stage

def inject(repo, root, deps, void):
    stage(repo, root, deps, void)
    f = root / 'src/main.ts'
    s = f.read_text()
    token = '  renderer.render(scene,camera);'
    assert s.count(token) == 1
    s = s.replace(token, token + "\n (window as any).__dalvayPairedPixels=()=>{\n  const o=dalvayVisual;\n  if(!o?.active)return null;\n  const g=renderer.getContext();\n  const row=()=>{const px=new Uint8Array(4);g.readPixels(725,g.drawingBufferHeight-1-303,1,1,g.RGBA,g.UNSIGNED_BYTE,px);return {draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,\n   collisionPixel:Array.from(px),active:o.active,raw:renderer.domElement.toDataURL('image/png').split(',')[1],error:g.getError(),\n   linked:renderer.info.programs?.every(p=>g.getProgramParameter((p as any).program,g.LINK_STATUS))};};\n  const probe=()=>{renderer.render(scene,camera);return row();};\n  const before=probe(),mat0=world.dalvayWaterReceivers()?.map(t=>[t.id,t.stock.uuid,t.mesh.geometry.uuid]);\n  o.update(()=>undefined);const middle=probe();\n  o.update(()=>world.dalvayWaterReceivers());const after=probe();\n  const mat1=world.dalvayWaterReceivers()?.map(t=>[t.id,t.stock.uuid,t.mesh.geometry.uuid]);\n  return {before,middle,after,mat0,mat1};\n };")
    f.write_text(s)
m.stage = inject
settle = m.settle

def observed(page, errors):
    result = settle(page, errors)
    page.wait_for_function('()=>{const d=window.islandAirDiagnostics,t=d?.buildingTiles;return d?.dalvayWaterOptics?.active&&t&&t.wanted>0&&t.ready===t.wanted&&t.loading===0&&t.pending===0&&t.failed===0}', timeout=100000)
    q = page.evaluate("()=>JSON.parse(new URLSearchParams(location.search).get('qa'))")
    n = q['site']
    p = page.evaluate('()=>window.__dalvayPairedPixels()')
    assert p and p['mat0'] == p['mat1'] and (len(p['mat0']) == 2)
    l = []
    for key in ('before', 'middle', 'after'):
        r = p[key]
        assert r['linked'] and r['error'] == 0
        assert r['active'] == (key != 'middle')
        blob = base64.b64decode(r.pop('raw'))
        r['sha256'] = sha256(blob).hexdigest()
        png = a.out / (n + '-' + key + '.png')
        png.write_bytes(blob)
        l.append(np.asarray(Image.open(png).convert('RGB'), dtype=np.int16))
    assert p['before'] == p['after'] and p['before']['draws'] == p['middle']['draws'] and (p['before']['triangles'] == p['middle']['triangles'])
    dg = np.max(np.abs(l[0] - l[1]), axis=2)
    p['pixelsAbove2'] = int(np.count_nonzero(dg > 2))
    p['peak'] = int(dg.max())
    assert p['pixelsAbove2'] >= 1000, (n, p)
    result.update(page.evaluate('()=>({...window.islandAirDiagnostics,...window.reviewCamera})'))
    assert not errors and (not result['layerWarnings'])
    (a.out / (n + '-paired.json')).write_text(json.dumps(p, indent=2) + '\n')
    print(n, p['pixelsAbove2'], p['peak'], flush=True)
    return result
m.settle = observed
m.run(a)
