#!/usr/bin/env bash
set -euo pipefail

# Use the hosted Ubuntu runner's existing signed Ubuntu archive definition.
# Playwright's usual all-source apt update can fail on an unrelated vendor
# feed before it even checks the Debian packages Chromium needs.
prepare_replay_apt_config() {
  local ubuntu_sources="$1" scratch="$2" sources="$2/sources" config="$2/apt.conf"
  [[ -r "$ubuntu_sources" ]] || { echo "Missing hosted Ubuntu archive: $ubuntu_sources" >&2; return 1; }
  [[ "$scratch" =~ ^/[a-zA-Z0-9_./-]+$ && -d "$scratch" ]] || return 1
  grep -Fxq 'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg' "$ubuntu_sources" ||
    { echo 'Expected the hosted Ubuntu archive keyring.' >&2; return 1; }
  awk '
    /^URIs:[[:space:]]/ {
      if(NF<2) exit 1
      found++
      for(i=2;i<=NF;i++) if ($i !~ /^https?:\/\/([[:alnum:].-]+\.)?(archive|security)\.ubuntu\.com\/ubuntu\/?$/) exit 1
    }
    END {if(!found) exit 1}
  ' "$ubuntu_sources" || { echo 'Expected only official Ubuntu archive URIs.' >&2; return 1; }
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
