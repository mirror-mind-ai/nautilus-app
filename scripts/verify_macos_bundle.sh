#!/bin/bash
# CR300: checks a built macOS bundle before anyone is asked to open it.
#
#   verify_macos_bundle.sh <app> <identifier> <name> <version> <arm64|x86_64> <darwin-arm64|darwin-x64>
#
# It reads the bundle and runs nothing from it: the identity and version in Info.plist, the architecture
# of the main executable and of the embedded Node, and the platform the runtime receipt names. A bundle
# that is the wrong architecture would open on the wrong Mac or not at all, and a runtime laid out for
# another platform would start the app with no host. Nothing is installed, signed or changed.
set -euo pipefail

APP=${1:?usage: verify_macos_bundle.sh <app> <identifier> <name> <version> <arm64|x86_64> <darwin-arm64|darwin-x64>}
IDENTIFIER=${2:?identifier}
NAME=${3:?name}
VERSION=${4:?version}
ARCH=${5:?architecture}
PLATFORM=${6:?runtime platform}

fail() { echo "STOP: $*" >&2; exit 1; }

case "$ARCH" in arm64) OTHER=x86_64 ;; x86_64) OTHER=arm64 ;; *) fail "architecture must be arm64 or x86_64, not $ARCH" ;; esac
[ -d "$APP" ] || fail "no bundle at $APP"
PLIST=$APP/Contents/Info.plist
value() { /usr/libexec/PlistBuddy -c "Print :$1" "$PLIST"; }

[ "$(value CFBundleIdentifier)" = "$IDENTIFIER" ] || fail "identifier is $(value CFBundleIdentifier), not $IDENTIFIER"
[ "$(value CFBundleName)" = "$NAME" ] || fail "name is $(value CFBundleName), not $NAME"
[ "$(value CFBundleShortVersionString)" = "$VERSION" ] || fail "version is $(value CFBundleShortVersionString), not $VERSION"

only_arch() {
  local description
  description=$(file "$1")
  echo "$description"
  case "$description" in *"$ARCH"*) ;; *) fail "$1 is not $ARCH" ;; esac
  case "$description" in *"$OTHER"*) fail "$1 also carries $OTHER; a single architecture was expected" ;; esac
}

EXECUTABLE=$APP/Contents/MacOS/$(value CFBundleExecutable)
NODE=$APP/Contents/Resources/mirror-host/node/bin/node
RECEIPT=$APP/Contents/Resources/mirror-host/pin-receipt.json
only_arch "$EXECUTABLE"
only_arch "$NODE"
[ -f "$RECEIPT" ] || fail "the bundle carries no runtime receipt"
grep -q "\"platform\": \"$PLATFORM\"" "$RECEIPT" || fail "the runtime receipt does not name $PLATFORM"

echo "bundle ok: $NAME $VERSION ($IDENTIFIER), $ARCH, runtime $PLATFORM"
