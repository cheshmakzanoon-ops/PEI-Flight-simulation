#!/usr/bin/env bash
set -euo pipefail
here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$here/install-browser-replay.sh"
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT
mkdir "$tmp/approved" "$tmp/vendor" "$tmp/untrusted"
cat >"$tmp/ubuntu.sources" <<'EOF'
Types: deb
URIs: http://azure.archive.ubuntu.com/ubuntu/
Suites: noble noble-updates
Components: main universe
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: http://security.ubuntu.com/ubuntu/
Suites: noble-security
Components: main universe
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
EOF
config="$(prepare_replay_apt_config "$tmp/ubuntu.sources" "$tmp/approved")"
cmp "$tmp/ubuntu.sources" "$tmp/approved/sources/ubuntu.sources"
# --print-uris resolves APT's configuration and prints the fetch plan
# without downloading archives, calling sudo or modifying system files.
APT_CONFIG="$config" apt-get --print-uris update > "$tmp/plan"
grep -Fq 'azure.archive.ubuntu.com/ubuntu/' "$tmp/plan"
grep -Fq 'security.ubuntu.com/ubuntu/' "$tmp/plan"
! grep -Eq 'microsoft.com|debian.org' "$tmp/plan"
sed 's#azure.archive.ubuntu.com#packages.microsoft.com#' "$tmp/ubuntu.sources" > "$tmp/vendor.sources"
if prepare_replay_apt_config "$tmp/vendor.sources" "$tmp/vendor" > /dev/null 2>&1; then
  echo 'Unexpected vendor archive acceptance' >&2
  exit 1
fi
sed '/^Signed-By:/d' "$tmp/ubuntu.sources" > "$tmp/untrusted.sources"
if prepare_replay_apt_config "$tmp/untrusted.sources" "$tmp/untrusted" > /dev/null 2>&1; then
  echo 'Unexpected unsigned archive configuration' >&2
  exit 1
fi
echo 'Replay APT source selection and refusal controls passed.'
