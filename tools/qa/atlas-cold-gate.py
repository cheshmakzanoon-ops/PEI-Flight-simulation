#!/usr/bin/env python3
"""Cold production browser startup with a controlled delay on each atlas asset."""
import argparse
import functools
import json
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock, Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

FLAGS = ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-dev-shm-usage", "--ignore-gpu-blocklist"]
INDEPENDENT = ["color.webp", "cover.json", "cover.bin.gz", "maritime-sky.webp"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", required=True, type=Path)
    parser.add_argument("--chromium", required=True)
    parser.add_argument("--expect", choices=("original", "parallel"), required=True)
    parser.add_argument("--delay-ms", type=float, default=600)
    args = parser.parse_args()
    dist = args.dist.resolve()
    manifest = json.loads((dist / "world/terrain.json").read_text())
    elevation = manifest["file"]
    paths = {"terrain.json", elevation, *INDEPENDENT}
    events, guard = {}, Lock()
    t0 = time.monotonic()

    class Server(SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_GET(self):
            path = urlsplit(self.path).path.removeprefix("/world/")
            if path not in paths:
                return super().do_GET()
            with guard:
                if path in events:
                    raise RuntimeError(f"Duplicate cold request: {path}")
                events[path] = {"requestMs": (time.monotonic() - t0) * 1000}
            time.sleep(args.delay_ms / 1000)
            with guard:
                events[path]["releaseMs"] = (time.monotonic() - t0) * 1000
            return super().do_GET()

    with ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Server, directory=str(dist))) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(executable_path=args.chromium, args=FLAGS)
                page = browser.new_page(viewport={"width": 800, "height": 480}, device_scale_factor=1)
                errors = []
                page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: errors.append(str(e)))
                page.on("response", lambda r: errors.append(f"{r.status} {r.url}") if r.status >= 400 else None)
                t0 = time.monotonic()
                page.goto(f"http://127.0.0.1:{server.server_port}/?diagnostics", wait_until="domcontentloaded")
                page.locator("#start").wait_for(timeout=45000)
                page.wait_for_function('window.islandAirDiagnostics?.mode==="dispatch"')
                dispatch_ms = (time.monotonic() - t0) * 1000
                page.locator("#start").click()
                page.wait_for_function('window.islandAirDiagnostics?.mode==="flight"')
                assert not errors, errors
                browser.close()
        finally:
            server.shutdown()
    assert set(events) == paths, events
    assert events[elevation]["requestMs"] >= events["terrain.json"]["releaseMs"], events
    if args.expect == "parallel":
        assert all(events[p]["requestMs"] < events["terrain.json"]["releaseMs"] for p in INDEPENDENT), events
    else:
        assert all(events[p]["requestMs"] > events[elevation]["releaseMs"] for p in INDEPENDENT[1:]), events
    print(json.dumps({"status":"flight ready","mode": args.expect,
                      "serverDelayMs": args.delay_ms,"dispatchMs": round(dispatch_ms), "events":events}, indent=2))


if __name__ == "__main__":
    main()
