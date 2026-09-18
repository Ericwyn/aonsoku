#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

INSTALL=true
INSTALL_DEPS=false

usage() {
  cat <<'EOF'
Build an Aonsoku Debian package and install it on the current machine.

Usage: ./build_and_install.sh [options]

Options:
  --build-only    Build the .deb package without installing it.
  --install-deps  Install dependencies before building (skipped by default).
  --skip-deps     Skip dependency installation (kept for compatibility).
  -h, --help      Show this help message.

Environment:
  AONSOKU_INSTALL_DEPS=1  Same as --install-deps.
  AONSOKU_SKIP_DEPS=1     Force dependency installation to be skipped.
EOF
}

while (($# > 0)); do
  case "$1" in
    --build-only)
      INSTALL=false
      ;;
    --install-deps)
      INSTALL_DEPS=true
      ;;
    --skip-deps)
      INSTALL_DEPS=false
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

if [[ "${AONSOKU_INSTALL_DEPS:-0}" == "1" ]]; then
  INSTALL_DEPS=true
fi

if [[ "${AONSOKU_SKIP_DEPS:-0}" == "1" ]]; then
  INSTALL_DEPS=false
fi

if [[ "$(uname -s)" != "Linux" ]]; then
  printf 'This script only supports Linux.\n' >&2
  exit 1
fi

case "$(uname -m)" in
  x86_64 | amd64)
    ELECTRON_ARCH=x64
    DEB_ARCH=amd64
    ;;
  aarch64 | arm64)
    ELECTRON_ARCH=arm64
    DEB_ARCH=arm64
    ;;
  *)
    printf 'Unsupported CPU architecture: %s\n' "$(uname -m)" >&2
    exit 1
    ;;
esac

for command_name in node npx dpkg-deb; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Required command is missing: %s\n' "$command_name" >&2
    exit 1
  fi
done

PACKAGE_MANAGER="$(node -p "require('./package.json').packageManager")"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"

if [[ "$PACKAGE_MANAGER" != pnpm@* ]]; then
  printf 'Unsupported package manager declaration: %s\n' "$PACKAGE_MANAGER" >&2
  exit 1
fi

PNPM_VERSION="${PACKAGE_MANAGER#pnpm@}"
PINNED_PNPM=(npx --yes "pnpm@${PNPM_VERSION}")

if command -v pnpm >/dev/null 2>&1; then
  PNPM_RUN=(pnpm --ignore-workspace)
else
  PNPM_RUN=("${PINNED_PNPM[@]}")
fi

printf 'Building Aonsoku %s for %s...\n' "$PACKAGE_VERSION" "$DEB_ARCH"

if [[ "$INSTALL_DEPS" == true ]]; then
  printf 'Installing dependencies with pnpm %s...\n' "$PNPM_VERSION"
  "${PINNED_PNPM[@]}" install --frozen-lockfile
fi

printf 'Compiling Electron application...\n'
"${PNPM_RUN[@]}" run electron:build

printf 'Checking that main-process dependencies are bundled...\n'
node <<'NODE'
const { builtinModules } = require('node:module')
const { readFileSync, readdirSync } = require('node:fs')
const { join } = require('node:path')

const importPattern = /(?:\bfrom\s*|\bimport\s*)["']([^"']+)["']/g
const builtins = new Set(
  builtinModules.flatMap((name) => [name, name.replace(/^node:/, ''), `node:${name}`]),
)

function listBundles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return listBundles(path)
    return /\.(?:js|mjs)$/.test(entry.name) ? [path] : []
  })
}

for (const bundle of [
  ...listBundles('out/main'),
  ...listBundles('out/preload'),
]) {
  const source = readFileSync(bundle, 'utf8')
  const imports = new Set()
  for (const match of source.matchAll(importPattern)) imports.add(match[1])

  const unexpected = [...imports].filter(
    (name) =>
      !name.startsWith('.') &&
      !name.startsWith('/') &&
      name !== 'electron' &&
      !builtins.has(name),
  )

  if (unexpected.length > 0) {
    console.error(
      `${bundle} contains unpackaged dependencies: ${unexpected.join(', ')}`,
    )
    process.exit(1)
  }
}
NODE

DIST_DIR="$SCRIPT_DIR/dist"
BUILD_MARKER="$(mktemp)"
trap 'rm -f "$BUILD_MARKER"' EXIT

printf 'Creating Debian package...\n'
"${PNPM_RUN[@]}" exec electron-builder \
  --linux deb \
  --"$ELECTRON_ARCH" \
  --publish never

mapfile -d '' DEB_PACKAGES < <(
  find "$DIST_DIR" -maxdepth 1 -type f -name '*.deb' -newer "$BUILD_MARKER" -print0
)

if ((${#DEB_PACKAGES[@]} != 1)); then
  printf 'Expected one newly built .deb package, found %d in %s\n' \
    "${#DEB_PACKAGES[@]}" "$DIST_DIR" >&2
  exit 1
fi

DEB_PACKAGE="${DEB_PACKAGES[0]}"
BUILT_PACKAGE="$(dpkg-deb -f "$DEB_PACKAGE" Package)"
BUILT_VERSION="$(dpkg-deb -f "$DEB_PACKAGE" Version)"
BUILT_ARCH="$(dpkg-deb -f "$DEB_PACKAGE" Architecture)"

if [[ "$BUILT_PACKAGE" != "aonsoku" || "$BUILT_ARCH" != "$DEB_ARCH" ]]; then
  printf 'Unexpected package metadata: package=%s version=%s architecture=%s\n' \
    "$BUILT_PACKAGE" "$BUILT_VERSION" "$BUILT_ARCH" >&2
  exit 1
fi

printf 'Package created: %s\n' "$DEB_PACKAGE"

if [[ "$INSTALL" != true ]]; then
  exit 0
fi

if ! command -v apt-get >/dev/null 2>&1 || ! command -v sudo >/dev/null 2>&1; then
  printf 'Installing the package requires apt-get and sudo.\n' >&2
  exit 1
fi

if pgrep -x aonsoku >/dev/null 2>&1; then
  printf 'Aonsoku is currently running. Restart it after installation to use the new build.\n'
fi

printf 'Installing %s %s...\n' "$BUILT_PACKAGE" "$BUILT_VERSION"
sudo apt-get install --reinstall --yes "$DEB_PACKAGE"

INSTALLED_VERSION="$(dpkg-query -W -f='${Version}' aonsoku)"
INSTALLED_BINARY="$(readlink -f "$(command -v aonsoku)")"

printf 'Installed Aonsoku %s successfully.\n' "$INSTALLED_VERSION"
printf 'Executable: %s\n' "$INSTALLED_BINARY"
printf 'Restart Aonsoku if it was open during installation.\n'
