#!/bin/bash
set -euo pipefail
if [[ $# != 1 ]]; then printf 'usage: %s NEW_OUTPUT_DIRECTORY\n' "$0" >&2; exit 2; fi
root=$(cd -- "$(dirname -- "$0")" && pwd)
sourceDir="$root/../grain-corn-atlas"
mkdir -- "$1"
cd -- "$1"
export OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 PYTHONDONTWRITEBYTECODE=1
node --experimental-transform-types "$sourceDir/atlas-packet.mjs" > packet.json
python3 "$sourceDir/bake-atlas.py" native-bake-b < packet.json
node "$root/packet-dense-low.mjs" > packet-dense-low-source.json
node "$root/packet-dense-low.mjs" --holdout > packet-dense-low-holdout.json
for mode in source holdout; do
 python3 "$root/bake-far-reference.py" "$mode" "dense-low-$mode-a" < "packet-dense-low-$mode.json"
done
python3 "$root/score-dense-angle.py" dense-low-score-a
node "$root/moving-packets.mjs" > moving-truth-packet.json
node "$root/moving-packets.mjs" --atlas-program > moving-dense-gpu-packet.json
python3 "$root/bake-far-reference.py" moving moving-truth-a < moving-truth-packet.json
python3 "$root/moving-atlas-gpu.py" moving-dense-gpu-a < moving-dense-gpu-packet.json
python3 "$root/score-dense-motion.py" dense-low-motion-score-a
python3 "$root/verify-far-receipt.py" dense-low-score-a/report.json dense-low-motion-score-a/report.json > source-proof.json
