#!/usr/bin/env bash
set -euo pipefail

# Use the hosted Ubuntu runner's existing signed Ubuntu archive definition.
# Playwright's usual all-source apt update can fail on an unrelated vendor
# feed before it even checks the Debian packages Chromium needs.
prepare_replay_apt_config() {
  local ubuntu_sources="$1" scratch="$2" sources="$2/sources" config="$2/apt.conf"
  local stock_mirrors="${3:-/etc/apt/apt-mirrors.txt}"
  local stock_mirror_uri='mirror+file:/etc/apt/apt-mirrors.txt'
  local archive_pattern='^https?://([[:alnum:].-]+\.)?(archive|security)\.ubuntu\.com/ubuntu/?$'
  [[ -r "$ubuntu_sources" ]] || { echo "Missing hosted Ubuntu archive: $ubuntu_sources" >&2; return 1; }
  [[ "$scratch" =~ ^/[a-zA-Z0-9_./-]+$ && -d "$scratch" ]] || return 1
  ARCHIVE_PATTERN="$archive_pattern" awk -v stock="$stock_mirror_uri" '
    BEGIN { archive=ENVIRON["ARCHIVE_PATTERN"] }
    function stanza() {
      if (touched && (uris != 1 || keys != 1)) exit 1
      if (touched) valid++
      touched=uris=keys=0
    }
    /^#/ { next }
    /^[[:space:]]*$/ { stanza(); next }
    /^[[:space:]]/ { exit 1 }
    {
      touched=1
      field=tolower($1)
      if (field=="uris:") {
        if (NF<2) exit 1
        uris++
        for(i=2;i<=NF;i++) if ($i!=stock && $i !~ archive) exit 1
      }
      if (field=="signed-by:") {
        if (NF!=2 || $2!="/usr/share/keyrings/ubuntu-archive-keyring.gpg") exit 1
        keys++
      }
      if ((field=="trusted:" || field=="allow-insecure:" ||
           field=="allow-weak:" || field=="allow-downgrade-to-insecure:") &&
          tolower($2)!="no") exit 1
    }
    END { stanza(); if(!valid) exit 1 }
  ' "$ubuntu_sources" || { echo 'Expected signed official Ubuntu archive stanzas.' >&2; return 1; }
  # GitHub's hosted image uses the ordinary apt mirror transport, outside
  # third-party source files. Keep that exact, existing, read-only list;
  # do not allow arbitrary local files or non-Ubuntu mirrors.
  if grep -Fq "$stock_mirror_uri" "$ubuntu_sources"; then
    [[ -r "$stock_mirrors" ]] || { echo "Missing hosted Ubuntu mirror list: $stock_mirrors" >&2; return 1; }
    ARCHIVE_PATTERN="$archive_pattern" awk '
      BEGIN {archive=ENVIRON["ARCHIVE_PATTERN"]}
      NF && $1 !~ /^#/ {
        found++
        if ($1 !~ archive) exit 1
      }
      END {if(!found) exit 1}
    ' "$stock_mirrors" || { echo 'Expected only official Ubuntu mirror entries.' >&2; return 1; }
  fi
  mkdir "$sources"
  cp -- "$ubuntu_sources" "$sources/ubuntu.sources"
  printf 'Dir::Etc::sourcelist "/dev/null";\nDir::Etc::sourceparts "%s";\n' "$sources" > "$config"
  printf '%s\n' "$config"
}

install_browser_replay() (
  scratch="$(mktemp -d)"
  # EXIT covers a failing prepare/install, while keeping all host files intact.
  trap 'rm -rf -- "$scratch"' EXIT
  config="$(prepare_replay_apt_config /etc/apt/sources.list.d/ubuntu.sources "$scratch")"
  dump="$(sudo -n -- env "APT_CONFIG=$config" apt-config dump)"
  grep -Fxq 'Dir::Etc::sourcelist "/dev/null";' <<<"$dump"
  grep -Fxq "Dir::Etc::sourceparts \"$scratch/sources\";" <<<"$dump"
  node_bin="$(command -v node)"
  cli="$PWD/node_modules/playwright/cli.js"
  test -f "$cli"
  sudo -n -- env "APT_CONFIG=$config" "$node_bin" "$cli" install-deps chromium
  "$node_bin" "$cli" install --only-shell chromium
)

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  install_browser_replay
fi
