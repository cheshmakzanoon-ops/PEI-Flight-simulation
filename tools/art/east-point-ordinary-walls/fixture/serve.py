#!/usr/bin/env python3
"""Private localhost only; alternate q417 compiled app and read-only stock world."""
import argparse, http.server, mimetypes, re, shutil
from pathlib import Path
from urllib.parse import unquote, urlsplit

class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def do_HEAD(self): self.serve(False)
    def do_GET(self): self.serve(True)
    def serve(self, content):
        name = unquote(urlsplit(self.path).path).lstrip('/') or 'index.html'
        seg = name.split('/')
        if any(c in {'', '..', '.'} or '\\' in c for c in seg):
            self.send_error(404); return
        root = self.server.build if name == 'index.html' or seg[0] == 'assets' else self.server.public
        target = (root / name).resolve()
        if not target.is_file() or not target.is_relative_to(root):
            self.send_error(404); return
        b = target.stat().st_size
        rg = self.headers.get('Range')
        base = re.fullmatch(r'bytes=(\d+)-(\d+)', rg) if rg else None
        if rg:
            lo, hi = map(int,base.groups()) if base else (-1,-1)
            if not (0 <= lo <= hi < b):
                self.send_error(416); return
            self.send_response(206)
            self.send_header('Content-Range',f'bytes {lo}-{hi}/{b}')
        else:
            self.send_response(200)
            lo, hi = 0, b-1
        size = hi-lo+1
        mime = {'.gz':'application/octet-stream','.bin':'application/octet-stream','.pack':'application/octet-stream'}
        self.send_header('Content-Type',mime.get(target.suffix) or mimetypes.guess_type(target)[0] or 'application/octet-stream')
        self.send_header('Content-Length',str(size))
        self.send_header('Accept-Ranges','bytes')
        self.send_header('Cache-Control','no-store')
        self.end_headers()
        if not content: return
        with target.open('rb') as f:
            f.seek(lo)
            try:
                while size:
                    data=f.read(min(size,256*1024))
                    if not data: raise EOFError()
                    self.wfile.write(data)
                    size -= len(data)
            except (BrokenPipeError, ConnectionResetError): pass
if __name__=='__main__':
    pa=argparse.ArgumentParser()
    pa.add_argument('--port',type=int,default=4661)
    a=pa.parse_args()
    root=Path(__file__).resolve().parent.parent
    s=http.server.ThreadingHTTPServer(('127.0.0.1',a.port),Handler)
    s.build=(root/'build').resolve();s.public=(root/'app/public').resolve()
    assert (s.build/'index.html').is_file() and (s.public/'world/buildings/index.json').is_file()
    s.serve_forever()
