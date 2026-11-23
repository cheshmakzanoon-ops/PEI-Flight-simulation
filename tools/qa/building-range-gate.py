#!/usr/bin/env python3
"""Exercise the unmodified production player on range-honoring AND simple static HTTP hosts."""
import argparse
import functools
import json
import math
import re
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock, Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

FLAGS = ["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader",
         "--disable-dev-shm-usage","--ignore-gpu-blocklist"]
ROUTES = [("cavendish", None),("harbour-low","Charlottetown waterfront · low pass"),
          ("summerside","Summerside"),("montague","Montague River")]


def run(args):
    dist = args.dist.resolve()
    if not (dist / "index.html").is_file():
        raise ValueError("--dist must be an existing production build.")
    atlas = dist / "world" / "buildings"
    pack = (atlas / "tiles.pack").read_bytes()
    tiles = json.loads((atlas / "index.json").read_text())["tiles"]
    valid = {(t["offset"],t["offset"]+t["bytes"]-1) for t in tiles}
    requests, lock = [], Lock()
    def snapshot():
        with lock:
            return list(requests)

    class Server(SimpleHTTPRequestHandler):
        def log_message(self, *ignored):
            pass

        def do_GET(self):
            if urlsplit(self.path).path != "/world/buildings/tiles.pack":
                return super().do_GET()
            header = self.headers.get("Range","")
            match = re.fullmatch(r"bytes=(\d+)-(\d+)",header)
            if not match or tuple(map(int,match.groups())) not in valid:
                self.send_error(416,"Expected one exact indexed member")
                return
            lo, hi = map(int, match.groups())
            partial = args.mode == "206"
            status = 206 if partial else 200
            body = memoryview(pack)[lo:hi+1] if partial else memoryview(pack)
            # A delayed first load permits overlapped tile readers. Intentionally
            # omit Accept-Ranges to test behavior, not an advisory header.
            if not snapshot():
                time.sleep(.12)
            self.send_response(status)
            self.send_header("Content-Type","application/octet-stream")
            self.send_header("Cache-Control","no-store")
            if partial:
                self.send_header("Content-Range",f"bytes {lo}-{hi}/{len(pack)}")
            self.send_header("Content-Length",str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            with lock:
                requests.append({"first":lo,"last":hi,"status":status,"bodyBytes":len(body)})

    with ThreadingHTTPServer(("127.0.0.1",0),functools.partial(Server,directory=str(dist))) as http:
        Thread(target=http.serve_forever,daemon=True).start()
        url=f"http://127.0.0.1:{http.server_port}"
        try:
            with sync_playwright() as pw:
                browser=pw.chromium.launch(executable_path=args.chromium,args=FLAGS)
                page=browser.new_page(viewport={"width":800,"height":480},device_scale_factor=1)
                page.set_default_timeout(45000)
                errors = []
                page.on("pageerror",lambda err:errors.append(str(err)))
                page.on("console",lambda m:errors.append(m.text) if m.type=="error" or "Building tile unavailable" in m.text else None)
                page.on("response",lambda r:errors.append(f"{r.status} {r.url}") if r.status>=400 else None)
                page.goto(f"{url}/?diagnostics",wait_until="domcontentloaded")
                rows=[]
                for site,label in ROUTES:
                    if label:
                        page.locator("#site").select_option(label=label)
                    try:
                        page.wait_for_function("""id=>{
                          const d=window.islandAirDiagnostics,b=d?.buildingTiles;
                          return d?.site===id && d.mode==="dispatch" && d.roads && d.mainland &&
                           b?.ready>0 && b.ready===b.wanted && b.pending===0 && b.loading===0 &&
                           d.detail.ready>0 && d.detail.loading===0;
                        }""",arg=site,polling=200)
                    except PlaywrightTimeout:
                        print("TIMEOUT",site,page.evaluate("window.islandAirDiagnostics"),page.locator("body").inner_text()[:450],errors,snapshot()[:3],flush=True)
                        raise
                    d=page.evaluate("window.islandAirDiagnostics")
                    if errors or d["buildingTiles"]["failed"] or d["layerWarnings"]:
                        raise RuntimeError((errors,d))
                    records=snapshot()
                    rows.append({"site":site,"visibleTileMeshes":d["buildingTiles"]["ready"],
                                 "drawCalls":d["drawCalls"],"triangles":d["triangles"],
                                 "requestsSoFar":len(records),"bodyBytesSoFar":sum(r["bodyBytes"] for r in records)})
                    print(site, rows[-1],flush=True)
                # Prove existing visible tile meshes still participate in an actual playable flight.
                page.locator("#start").click()
                page.wait_for_function("window.islandAirDiagnostics?.mode==='flight'")
                a=page.evaluate("window.islandAirDiagnostics")
                page.wait_for_function("""a=>{
                  const d=window.islandAirDiagnostics;return d?.mode==='flight' && d.buildingTiles?.ready>0 &&
                    Math.hypot(d.x-a.x,d.z-a.z)>12;}""",arg=a)
                b=page.evaluate("window.islandAirDiagnostics")
                play_distance=math.hypot(a["x"]-b["x"],a["z"]-b["z"])
                records=snapshot()
                total=sum(x["bodyBytes"] for x in records)
                if args.mode=="200" and (len(records)!=1 or total!=len(pack)):
                    raise AssertionError("Ignored ranges must download exactly one full pack.")
                if args.mode=="206" and not (len(records)>1 and 0<total<len(pack)):
                    raise AssertionError("Range mode did not demonstrate selective transfer.")
                if errors or b["buildingTiles"]["failed"]:
                    raise RuntimeError((errors,b))
                args.out.parent.mkdir(parents=True,exist_ok=True)
                args.out.write_text(json.dumps({"mode":args.mode,"fullPackBytes":len(pack),
                    "bytesForFourDispatchesAndFlightStart":total,"requestCount":len(records),
                    "states":rows,"flightMovementM":round(play_distance,2),"errors":errors,
                    "requests":records},indent=2)+"\n")
                print("PASS",args.mode,len(records),total,flush=True)
                browser.close()
        finally:
            http.shutdown()


if __name__ == "__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dist",required=True,type=Path)
    p.add_argument("--mode",choices=("200","206"),required=True)
    p.add_argument("--chromium",required=True)
    p.add_argument("--out",required=True,type=Path)
    run(p.parse_args())
