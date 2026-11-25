#!/usr/bin/env python3
"""Exercise same-identity building caster changes in real Three.js/WebGL."""
from argparse import ArgumentParser
import json
from pathlib import Path
import socket
import subprocess
from tempfile import TemporaryDirectory
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright

p = ArgumentParser(description=__doc__)
p.add_argument('--checkout', default='.', type=Path)
p.add_argument('--chromium', required=True)
p.add_argument('--out', required=True, type=Path)
a = p.parse_args()
checkout = a.checkout.resolve()
recipe = r"""
import * as T from 'three';
import {BuildingShadows} from './local-building-shadows.ts';
const scene = new T.WebGLRenderer({ antialias:false });
scene.setSize(32,32);
const shadow = new BuildingShadows(scene,new T.Vector3(-.60,.74,-.31));
const eye = new T.Vector3(0,24,0);
const stock = new T.BoxGeometry(28,12,19), replacement = new T.BoxGeometry(6,12,19);
const source = new T.Mesh(stock); source.position.set(0,6,0);
const cast = (_x,_z,_r,list) => list.push(source);
const gl=scene.getContext();
let ref, mask;
const grab = async () => {
 const tex=shadow.uniforms.localCastMap.value, target=shadow.target;
 const data = new Uint8Array(tex.image.width*tex.image.height*4);
 scene.readRenderTargetPixels(target,0,0,tex.image.width,tex.image.height,data);
 let marked=0;
 for(let i=0;i<data.length;i+=4) if((data[i]&data[i+1]&data[i+2]&data[i+3])!==255)marked++;
 const h = new Uint8Array(await crypto.subtle.digest('SHA-256',data));
 return {count:marked,sha:[...h].map(v=>v.toString(16).padStart(2,'0')).join('')};
};
window.casterProof = async () => {
 const signal=()=>{shadow.leaseOwnerChanged();shadow.render(eye,0,cast);};
 shadow.render(eye,0,cast); await new Promise(r=>setTimeout(r,160)); shadow.render(eye,0,cast);
 ref=await grab();
 const before=shadow.state.updates;
 source.geometry=replacement; signal(); mask=await grab();
 const after=shadow.state.updates;
 replacement.setDrawRange(0,0); signal(); const clipped=await grab();
 replacement.setDrawRange(0,Infinity);
 source.geometry=stock;signal(); const restored=await grab();
 const restoredUpdates=shadow.state.updates;
 signal(); const noExtraUpdate=shadow.state.updates===restoredUpdates;
 return {ref,mask,clipped,restored,sameIdentityRefresh:after===before+1,noExtraUpdate,error:gl.getError()};
};
"""
with TemporaryDirectory(prefix='pei-caster-swap-') as d:
    root = Path(d)
    (root/'node_modules').symlink_to(checkout/'node_modules', target_is_directory=True)
    # Vite must see the real TS file at a local path. Only the temporary
    # page accesses its TS-private depth target to read validation bytes.
    (root/'local-building-shadows.ts').write_bytes((checkout/'src/render/local-building-shadows.ts').read_bytes())
    (root/'proof.js').write_text(recipe)
    (root/'index.html').write_text('<script type="module" src="./proof.js"></script>')
    with socket.socket() as s:
        s.bind(('127.0.0.1',0)); port=s.getsockname()[1]
    url=f'http://127.0.0.1:{port}'
    proc=subprocess.Popen(['node',str(checkout/'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',str(port),'--strictPort'],
                          cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):
            try:
                urlopen(url,timeout=1).close(); break
            except OSError:
                if proc.poll() is not None: raise RuntimeError('Vite exited before the fixture loaded')
                time.sleep(.15)
        else: raise RuntimeError('Vite never opened the fixture')
        with sync_playwright() as pw:
            b=pw.chromium.launch(executable_path=a.chromium,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
            page=b.new_page()
            errors=[]
            page.on('pageerror',lambda e: errors.append(str(e)))
            page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
            page.goto(url)
            page.wait_for_function('!!window.casterProof')
            proof=page.evaluate('window.casterProof()')
            assert proof['sameIdentityRefresh'] and proof['noExtraUpdate'] and not proof['error'] and not errors, (proof,errors)
            assert proof['ref']['count']>proof['mask']['count']>0 and proof['clipped']['count']==0, proof
            assert proof['ref']==proof['restored'], proof
            a.out.parent.mkdir(parents=True,exist_ok=True)
            a.out.write_text(json.dumps(proof,indent=2)+'\n')
            print(json.dumps(proof,indent=2))
    finally:
        proc.terminate()
        try: proc.wait(timeout=5)
        except subprocess.TimeoutExpired: proc.kill();proc.wait()
