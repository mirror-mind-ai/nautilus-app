#!/bin/bash
# CR278: builds the macOS x64 whisper.cpp command-line component the voice manifest names, from the
# pinned upstream commit, so that it starts on the oldest macOS the app supports, and proves it.
#
#   build_whisper_cli_macos.sh <output-directory> [<model.bin>]
#
# Without Accelerate, because whisper.cpp's BLAS backend imports symbols (NEWLAPACK) that macOS 12
# to 13.2 do not have; the ggml kernels with AVX2 are used instead. Deployment target 12.0, the
# floor of config/runtime-compatibility.json. With a model it also transcribes upstream's sample.
# Nothing is published: copying the result to the update host is a separate act the Navigator authorizes.
set -euo pipefail

WHISPER_VERSION=v1.8.3
WHISPER_COMMIT=2eeeba56e9edd762b4b38467bab96c2517163158
EXPECTED_TRANSCRIPT="ask not what your country can do for you"

OUT=${1:?usage: build_whisper_cli_macos.sh <output-directory> [<model.bin>]}
MODEL=${2:-}
HERE=$(cd "$(dirname "$0")" && pwd)
WORK=$OUT/work
mkdir -p "$OUT"

if [ ! -d "$WORK/src/.git" ]; then
  git init -q "$WORK/src"
  git -C "$WORK/src" fetch -q --depth 1 https://github.com/ggml-org/whisper.cpp.git "$WHISPER_COMMIT"
  git -C "$WORK/src" checkout -q FETCH_HEAD
fi
HEAD_COMMIT=$(git -C "$WORK/src" rev-parse HEAD)
[ "$HEAD_COMMIT" = "$WHISPER_COMMIT" ] || { echo "STOP: whisper.cpp is at $HEAD_COMMIT, not $WHISPER_COMMIT" >&2; exit 1; }

# A clean environment: nothing from the caller's shell reaches the compiler or CMake.
CLEAN=(env -i "PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/opt/homebrew/bin" "HOME=$HOME")
"${CLEAN[@]}" cmake -S "$WORK/src" -B "$WORK/build" -G "Unix Makefiles" -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_OSX_DEPLOYMENT_TARGET=12.0 -DCMAKE_OSX_ARCHITECTURES=x86_64 \
  -DBUILD_SHARED_LIBS=OFF -DWHISPER_BUILD_TESTS=OFF -DWHISPER_BUILD_EXAMPLES=ON -DWHISPER_SDL2=OFF \
  -DGGML_NATIVE=OFF -DGGML_AVX=ON -DGGML_AVX2=ON -DGGML_FMA=ON -DGGML_F16C=ON \
  -DGGML_METAL=OFF -DGGML_OPENMP=OFF -DGGML_BLAS=OFF -DGGML_ACCELERATE=OFF
"${CLEAN[@]}" cmake --build "$WORK/build" --target whisper-cli -j "$(sysctl -n hw.ncpu)"

# A new name, not the published whisper-cli-$WHISPER_VERSION-macos-x64: a served artifact is never replaced.
BIN=$OUT/whisper-cli-$WHISPER_VERSION-macos12-x64
cp "$WORK/build/bin/whisper-cli" "$BIN"
file "$BIN" | grep -q "x86_64" || { echo "STOP: not an x86_64 binary" >&2; exit 1; }
node "$HERE/check_whisper_cli_macos.mjs" "$BIN"

if [ -n "$MODEL" ]; then
  TEXT=$("$BIN" -m "$MODEL" -f "$WORK/src/samples/jfk.wav" -nt -np 2>/dev/null)
  echo "transcript:$TEXT"
  case "$TEXT" in *"$EXPECTED_TRANSCRIPT"*) ;; *) echo "STOP: the sample did not transcribe as expected" >&2; exit 1 ;; esac
fi
echo "built $BIN"
shasum -a 256 "$BIN"
stat -f "sizeBytes %z" "$BIN"
