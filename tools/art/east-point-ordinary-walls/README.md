# East Point ordinary wall study

A local-only full-scene comparison for the normal East Point departure.
Twelve stock buildings in the signed q1333 range receive an authored
shader treatment with less uniform window bands and more visible
plaster. This is not a façade survey. Triangle positions, roofs,
terrain, contact and the playable build remain unchanged.

The actual tile submitted 11,988 original positions and a 71,928-byte
wall attribute. Its 426 tagged vertices form 142 wall triangles across
twelve original building ordinals. No roof vertex was tagged. Peer
submissions, total draw counts and alpha were unchanged. The disabled
pass and restore matched the original framebuffer exactly.

| Actual travel from Dispatch | Strong RGB change | Native wall marker |
| --- | ---: | ---: |
| 31.184 m | 0 | 0 |
| 217.800 m | 3,337 | 4,479 |
| 261.266 m | 6,382 | 7,798 |
| 324.245 m | 9,736 | 12,372 |

[Independent score](evidence/native-scope.json): ordinary flight controls,
1200 × 760 with 4× sampling and the signed actual range. The treatment
is noticeably less uniform but still stylistic painted windows, not
measured apertures or a photo match.

## Repeat locally

Use the installed repo dependencies, Node 24, Git, Python with
NumPy/Pillow/Playwright, and a supported Chromium build. From the root:

```sh
node tools/art/east-point-ordinary-walls/prepare.mjs . /tmp/pei-east-new-local
cd /tmp/pei-east-new-local
python3 qa/serve.py --port 4710
# In another terminal inside the same fresh scratch directory:
python3 qa/capture.py --browser /path/to/chromium --out native
python3 qa/score.py --native native --out new-receipt.json
```

The runner requires a fresh directory outside your project and stops
on a mismatched stock source hash. It deliberately makes several
same-frame readbacks, all in your localhost fixture. That test machinery
does not ship in the normal simulator. No external sites or reference
photos are used.
