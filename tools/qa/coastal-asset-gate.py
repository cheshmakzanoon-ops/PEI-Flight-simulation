#!/usr/bin/env python3
"""Verify optional coastal transfer and real lighthouse departures in a production build."""
import argparse
import functools
import json
import math
import time
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock, Thread
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

ROOT = "/world/coastal/v1/"
NAMES = {"east-point.i16.gz", "west-point.i16.gz"}
FLIGHTS = [("east-light", "East Point · lighthouse pass"),
           ("west-light", "West Point · lighthouse pass")]
FLAGS = ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
         "--disable-dev-shm-usage", "--ignore-gpu-blocklist"]


def run(browser, dist, scenario, out):
    requests = []
    guard = Lock()

    class Server(SimpleHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_GET(self):
            path = urlsplit(self.path).path
            name = path.removeprefix(ROOT)
            if name not in NAMES:
                return super().do_GET()
            with guard:
                requests.append(name)
            if scenario == "corrupt-west" and name == "west-point.i16.gz":
                self.send_response(200)
                self.send_header("Content-Length", "12")
                self.end_headers()
                self.wfile.write(b"invalid data")
                return
            if scenario == "timeout-west" and name == "west-point.i16.gz":
                # Longer than the app-local optional seeding budget. Other requests
                # are served on different threads; avoid blocking regular startup.
                time.sleep(15)
            try:
                super().do_GET()
            except (BrokenPipeError, ConnectionResetError):
                pass

    expected = ["east-point", "west-point"] if scenario == "nominal" else ["east-point"]
    with ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Server, directory=str(dist))) as server:
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        context = browser.new_context(viewport={"width": 1200, "height": 760}, device_scale_factor=1)
        try:
            page = context.new_page()
            page.set_default_timeout(60000)
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("response", lambda r: errors.append(f"{r.status} {r.url}") if r.status >= 400 else None)

            page.goto(f"http://127.0.0.1:{server.server_port}/?diagnostics", wait_until="domcontentloaded")
            try:
                page.locator("#start").wait_for(timeout=45000)
                page.wait_for_function("Array.isArray(window.islandAirDiagnostics?.coastalSurveys)", timeout=45000)
            except PlaywrightTimeout as exc:
                text = page.locator("body").inner_text(timeout=1000)[:500]
                raise RuntimeError(f"{scenario}: startup did not finish: {text!r}, browser errors {errors}") from exc
            snapshot = lambda: page.evaluate("window.islandAirDiagnostics")
            before = snapshot()
            assert sorted(before["coastalSurveys"]) == expected, before
            page.locator("#start").click()
            flights = []
            for site, label in FLIGHTS:
                page.locator("#nav-map").click()
                page.locator("#map-site").select_option(label=label)
                page.locator("#fly-here").click()
                page.wait_for_function("""id=>{const d=window.islandAirDiagnostics;
                    return d?.site===id && d.mode==="flight" && d.roads && d.mainland && d.detail.ready>0}""", arg=site)
                a = snapshot()
                page.wait_for_function("""a=>{const d=window.islandAirDiagnostics;
                    return d?.mode==="flight" && Math.hypot(d.x-a.x,d.z-a.z)>30}""", arg=a)
                b = snapshot()
                assert sorted(b["coastalSurveys"]) == expected, b
                assert all(math.isfinite(b[k]) for k in ("x", "z", "altitude", "speed")), b
                if scenario == "nominal":
                    page.screenshot(path=str(out / f"{site}.png"))
                flights.append({"site": site, "movementM": round(math.hypot(b["x"]-a["x"], b["z"]-a["z"]), 2)})
            # Long timeout routes recheck the installed set after the server's late offer.
            if scenario == "timeout-west":
                page.wait_for_timeout(15900)
                assert sorted(snapshot()["coastalSurveys"]) == expected
            assert not errors, errors
            with guard:
                observed = sorted(requests)
            assert observed == sorted(NAMES), observed
            return {"scenario": scenario, "surveys": expected, "requests": observed,
                    "flights": flights, "errors": errors}
        finally:
            context.close()
            server.shutdown()
            worker.join()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dist", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--chromium", required=True)
    parser.add_argument("--scenario", choices=("nominal", "corrupt-west", "timeout-west"), action="append")
    args = parser.parse_args()
    assert (args.dist / "index.html").is_file()
    assert all((args.dist / ROOT.lstrip("/") / name).is_file() for name in NAMES)
    args.out.mkdir(parents=True, exist_ok=True)
    records = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=args.chromium, args=FLAGS)
        for mode in args.scenario or ["nominal", "corrupt-west", "timeout-west"]:
            record = run(browser, args.dist.resolve(), mode, args.out)
            records.append(record)
            print(json.dumps(record), flush=True)
    (args.out / "coastal-asset-gate.json").write_text(json.dumps(records, indent=2) + "\n")


if __name__ == "__main__":
    main()
