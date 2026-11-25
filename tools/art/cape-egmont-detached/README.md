# Cape Egmont detached art

From the root, after `npm ci`, run:

```sh
./node_modules/.bin/vite tools/art/cape-egmont-detached --host 127.0.0.1
```

The default view shows the whole tower. Add `?deck` for the lantern and
`?weather` for the original close-up cedar finish. To rebuild and
check all three views with Playwright:

```sh
./node_modules/.bin/vite build tools/art/cape-egmont-detached
python tools/art/cape-egmont-detached/capture.py --dist tools/art/cape-egmont-detached/dist \
  --chromium /path/to/chromium --out /tmp/pei-egmont-studio
```

[Survey, appearance references and limitations](../../../docs/qa/cape-egmont-detached.md).
