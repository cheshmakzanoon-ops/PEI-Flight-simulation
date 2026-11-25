# Beaconsfield in-engine verification

Run in the repository root with its locked npm dependencies, Python Playwright,
NumPy and Pillow, and a supported Chromium binary. The tools only copy the
checkout into scratch: neither camera probes nor test departures ship.

```sh
QA=tools/qa/beaconsfield-contact
DOC=docs/qa/beaconsfield-contact
CHROMIUM=/path/to/chromium
GRADE=beaconsfield-measured-frontage-grade
python "$QA/beaconsfield-flight-fixture.py" --out /tmp/pei-beaconsfield-fixture
npm --prefix /tmp/pei-beaconsfield-fixture run build
bash "$QA/run-compiled-beaconsfield-matrix.sh" \
  /tmp/pei-beaconsfield-fixture/dist /tmp/pei-beaconsfield-flights "$CHROMIUM"
```

The matrix flies an opt-in harbor and a reverse approach, then checks the
existing opt-in preview, missing and corrupt optional data, emulated 15-slot
fragment texture capacity, and ordinary Standard mode. The emulation checks
the application admission branch on the same machine, not a real restricted GPU.
The fixture is independent of public departures.

```sh
python "$QA/beaconsfield-locked-contact.py" --checkout . --chromium "$CHROMIUM" \
  --controls "$DOC/fixed-controls.json" --ground-probes "$DOC/runtime-probe-rings.json" \
  --query 'beaconsfieldReview&stockBeaconsfieldGrade' --forbid-grade "$GRADE" \
  --shadow-layer-witness --out /tmp/pei-beaconsfield-old
python "$QA/beaconsfield-locked-contact.py" --checkout . --chromium "$CHROMIUM" \
  --controls "$DOC/fixed-controls.json" --ground-probes "$DOC/runtime-probe-rings.json" \
  --pose-baseline /tmp/pei-beaconsfield-old/results.json --expected-grade "$GRADE" \
  --project-support --shadow-layer-witness --out /tmp/pei-beaconsfield-new
bash "$QA/collect-beaconsfield-native-frames.sh" /tmp/pei-beaconsfield-old \
  /tmp/pei-beaconsfield-new /tmp/pei-beaconsfield-old /tmp/pei-beaconsfield-frames
```

The projected scope is deliberately conservative and compared against a
matched camera, not a claim of exact per-pixel geographic correspondence.
The shade controls temporarily hide the original and the optional receiver
in the actual browser scene, then check exact restoration on the same tick.
The ray checks compare submitted terrain with the visual and aircraft
samplers. These are in-engine engineering checks, not new survey points.
