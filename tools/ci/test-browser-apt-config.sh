#!/usr/bin/env bash
set -euo pipefail
here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$here/install-browser-replay.sh"
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT
mkdir "$tmp/approved" "$tmp/vendor" "$tmp/untrusted" "$tmp/hosted" "$tmp/bad-mirror" "$tmp/arbitrary" "$tmp/folded" "$tmp/weak"
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
# The hosted Noble image uses a separate stock mirror list.
sed 's#http://azure.archive.ubuntu.com/ubuntu/#mirror+file:/etc/apt/apt-mirrors.txt#' "$tmp/ubuntu.sources" > "$tmp/hosted.sources"
cat > "$tmp/stock-mirrors.txt" <<'EOF'
http://azure.archive.ubuntu.com/ubuntu/ priority:1
http://archive.ubuntu.com/ubuntu/ priority:2
EOF
mirror_config="$(prepare_replay_apt_config "$tmp/hosted.sources" "$tmp/hosted" "$tmp/stock-mirrors.txt")"
test -s "$mirror_config"
cmp "$tmp/hosted.sources" "$tmp/hosted/sources/ubuntu.sources"
sed 's#azure.archive.ubuntu.com#packages.microsoft.com#' "$tmp/stock-mirrors.txt" > "$tmp/vendor-mirrors.txt"
if prepare_replay_apt_config "$tmp/hosted.sources" "$tmp/bad-mirror" "$tmp/vendor-mirrors.txt" >/dev/null 2>&1; then
  echo 'Unexpected non-Ubuntu mirror acceptance' >&2; exit 1
fi
sed 's#/etc/apt/apt-mirrors.txt#/etc/apt/vendor-mirrors.txt#' "$tmp/hosted.sources" > "$tmp/arbitrary.sources"
if prepare_replay_apt_config "$tmp/arbitrary.sources" "$tmp/arbitrary" "$tmp/stock-mirrors.txt" >/dev/null 2>&1; then
  echo 'Unexpected arbitrary mirror-list acceptance' >&2; exit 1
fi
sed '0,/^URIs:/s@^URIs: .*@&\n https://packages.microsoft.com/ubuntu/@' "$tmp/ubuntu.sources" > "$tmp/folded.sources"
if prepare_replay_apt_config "$tmp/folded.sources" "$tmp/folded" >/dev/null 2>&1; then
  echo 'Unexpected folded URI acceptance' >&2; exit 1
fi
sed '0,/^Signed-By:/s@^Signed-By: .*@&\nTrusted: yes@' "$tmp/ubuntu.sources" > "$tmp/weak.sources"
if prepare_replay_apt_config "$tmp/weak.sources" "$tmp/weak" >/dev/null 2>&1; then
  echo 'Unexpected unverified APT trust acceptance' >&2; exit 1
fi
echo 'Replay APT source selection and refusal controls passed.'
