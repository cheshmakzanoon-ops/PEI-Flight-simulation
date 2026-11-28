#!/usr/bin/env bash
set -euo pipefail
if (( $# != 1 )); then
  printf 'Usage: %s NEW_OUTPUT_DIRECTORY\n' "$0" >&2
  exit 2
fi
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
out=$1
if [[ -e "$out" || -L "$out" ]]; then
  printf 'Refusing to overwrite: %s\n' "$out" >&2
  exit 2
fi
node --experimental-transform-types "$here/render-packet.mjs" |
  PYTHONOPTIMIZE=0 PYTHONDONTWRITEBYTECODE=1 LIBGL_ALWAYS_SOFTWARE=1 python3 "$here/studio.py" "$out"
