#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ISOLATED=false
STOP_INSTALLED=false

usage() {
  cat <<'EOF'
Run Aonsoku in Electron development mode.

Usage: ./run_dev.sh [options]

Options:
  --isolated        Use an isolated config directory under /tmp.
  --stop-installed  Stop /opt/Aonsoku/aonsoku before starting dev mode.
  -h, --help        Show this help message.

Environment:
  AONSOKU_USER_DATA_DIR   Config directory used by default.
                          Default: ~/.config/Aonsoku
  AONSOKU_DEV_CONFIG_DIR  Config directory used with --isolated.
                          Default: /tmp/aonsoku-dev/Aonsoku
  AONSOKU_DEBUG_LYRICS    Set to 1 to fetch and log diagnostics for the
                          current song once development mode starts.
EOF
}

while (($# > 0)); do
  case "$1" in
    --isolated)
      ISOLATED=true
      ;;
    --stop-installed)
      STOP_INSTALLED=true
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

for command_name in node pnpm pgrep pkill; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command is missing: %s\n' "$command_name" >&2
    exit 1
  fi
done

ELECTRON_MODULE_DIR="$(
  node -p 'require("node:path").dirname(require.resolve("electron"))'
)"
ELECTRON_PATH_FILE="$ELECTRON_MODULE_DIR/path.txt"
ELECTRON_EXECUTABLE="$ELECTRON_MODULE_DIR/dist/electron"

if [[ ! -f "$ELECTRON_PATH_FILE" || ! -x "$ELECTRON_EXECUTABLE" ]]; then
  printf 'Electron runtime is missing; installing it now...\n'
  node "$ELECTRON_MODULE_DIR/install.js"
fi

if [[ ! -f "$ELECTRON_PATH_FILE" || ! -x "$ELECTRON_EXECUTABLE" ]]; then
  printf 'Electron runtime installation did not produce: %s\n' \
    "$ELECTRON_EXECUTABLE" >&2
  exit 1
fi

if [[ "$STOP_INSTALLED" == true ]] &&
  pgrep -f '^/opt/Aonsoku/aonsoku( |$)' >/dev/null 2>&1; then
  printf 'Stopping the installed Aonsoku...\n'
  pkill -TERM -f '^/opt/Aonsoku/aonsoku( |$)'

  for _ in {1..50}; do
    if ! pgrep -f '^/opt/Aonsoku/aonsoku( |$)' >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done
fi

if pgrep -f '^/opt/Aonsoku/aonsoku( |$)' >/dev/null 2>&1; then
  printf 'The installed Aonsoku is still running.\n' >&2
  printf 'Quit it from the system tray or run: ./run_dev.sh --stop-installed\n' >&2
  exit 1
fi

if [[ "$ISOLATED" == true ]]; then
  USER_DATA_DIR="${AONSOKU_DEV_CONFIG_DIR:-/tmp/aonsoku-dev/Aonsoku}"
  printf 'Using isolated Aonsoku config: %s\n' "$USER_DATA_DIR"
else
  USER_DATA_DIR="${AONSOKU_USER_DATA_DIR:-$HOME/.config/Aonsoku}"
  printf 'Using installed Aonsoku config: %s\n' "$USER_DATA_DIR"
fi

mkdir -p "$USER_DATA_DIR"
export AONSOKU_USER_DATA_DIR="$USER_DATA_DIR"

printf 'Starting Aonsoku in Electron development mode...\n'
exec pnpm --ignore-workspace electron:dev
