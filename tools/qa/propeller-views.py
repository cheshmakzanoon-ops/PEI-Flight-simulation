#!/usr/bin/env python3
"""Check the installed Three.js propeller in both camera modes against a running Vite dev server."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright


def run(url, chromium, out):
    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=chromium, args=[
            '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
            '--disable-dev-shm-usage', '--ignore-gpu-blocklist'])
        page = browser.new_page(viewport={'width': 1160, 'height': 740}, device_scale_factor=1)
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        for pose in ['prop-side', 'cockpit', 'chase']:
            for amount in (0, .16, .8):
                page.goto(f"{url.rstrip('/')}/tools/qa/aircraft-preview.html?pose={pose}&prop={amount}")
                page.wait_for_function('window.aircraftPreview')
                d = page.evaluate('window.aircraftPreview')
                assert abs(d['bladeSweepM']-2.0066) < .00001, d
                assert abs(d['clearanceM']-.276225) < .00001, d
                assert d['solidVisible'] == (amount != .8), d
                assert d['sweepVisible'] == (amount != 0), d
                assert d['cockpitVisible'] == (pose == 'cockpit'), d
                assert not errors, errors
                page.screenshot(path=str(out/f'{pose}-{amount}.png'))
                print(pose, amount, d['bladeSweepM'], d['clearanceM'], flush=True)
        browser.close()


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--base-url', default='http://localhost:5173')
    p.add_argument('--chromium', required=True)
    p.add_argument('--out', type=Path, required=True)
    args = p.parse_args()
    run(args.base_url, args.chromium, args.out)
