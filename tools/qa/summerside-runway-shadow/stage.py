#!/usr/bin/env python3
"""Build a private instrumented copy. Do not start a server outside localhost."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.request import urlopen

here = Path(__file__).resolve().parent
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--checkout', type=Path, default=here.parents[2])
p.add_argument('--out', required=True, type=Path)
p.add_argument('--chromium', default=os.environ.get('CHROMIUM_EXECUTABLE'))
p.add_argument('--mode', choices=('chase', 'inspection', 'controls'), default='chase')
a = p.parse_args()
repo, out = a.checkout.resolve(), a.out.resolve()
if out == repo or repo in out.parents:
    p.error('--out needs to be outside the checkout')
pins = json.loads((here / 'instrument-source.json').read_text())
for rel, expected in pins.items():
    actual = hashlib.sha256((repo / rel).read_bytes()).hexdigest()
    if actual != expected:
        p.error(f'{rel} does not match the input for this recorded replay; use the pinned commit')
deps = (repo / 'node_modules').resolve(strict=True)
out.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='pei-shadow-replay-') as name:
    root = Path(name)
    shutil.copytree(repo / 'src', root / 'src')
    for f in ('index.html', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts'):
        shutil.copy2(repo / f, root / f)
    (root / 'public').symlink_to(repo / 'public', target_is_directory=True)
    (root / 'node_modules').symlink_to(deps, target_is_directory=True)
    if a.mode != 'controls':
        subprocess.run(['git', 'apply', '--unidiff-zero', '--check', str(here / 'instrument.patch')], cwd=root, check=True)
        subprocess.run(['git', 'apply', '--unidiff-zero', str(here / 'instrument.patch')], cwd=root, check=True)
    with (out / 'build.log').open('w') as log:
        subprocess.run(['npm', 'run', 'build'], cwd=root, stdout=log, stderr=log, check=True)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    url = f'http://127.0.0.1:{port}/'
    with (out / 'server.log').open('w') as log:
        proc = subprocess.Popen(['node', str(deps / 'vite/bin/vite.js'), 'preview',
                                 '--host', '127.0.0.1', '--port', str(port), '--strictPort'],
                                cwd=root, stdout=log, stderr=log)
        try:
            for _ in range(100):
                try:
                    with urlopen(url, timeout=1) as response:
                        response.read(1)
                    break
                except OSError:
                    if proc.poll() is not None:
                        raise RuntimeError('Vite failed; see server.log')
                    time.sleep(.15)
            else:
                raise TimeoutError('Vite did not listen on localhost')
            script = 'controls.mjs' if a.mode == 'controls' else 'replay.mjs'
            shutil.copy2(here / script, root / script)
            env = dict(os.environ, URL=url, OUT=str(out), SHADOW_INSPECTION='1' if a.mode == 'inspection' else '0')
            if a.chromium:
                env['CHROMIUM_EXECUTABLE'] = a.chromium
            subprocess.run(['node', str(root / script)], cwd=root, env=env, check=True)
        finally:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
