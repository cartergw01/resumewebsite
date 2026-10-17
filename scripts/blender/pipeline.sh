#!/usr/bin/env bash
# Rebuild an island's every website asset from scripts/blender/build_islands.py.
#
#   scripts/blender/pipeline.sh work                 # one island
#   scripts/blender/pipeline.sh all                  # all three
#   scripts/blender/pipeline.sh work --quick         # 1440px, 24 samples: a look, not a release
#   scripts/blender/pipeline.sh work --samples 128 --width 2880
#   scripts/blender/pipeline.sh work --cpu           # slower, byte-identical renders
#
# In order, for each island: model and render the night still (this also saves
# artwork/blender/<world>.blend, which the later steps open), crop and publish
# it, record its camera and crop, render and publish Work's daytime still
# (the study's and workshop's lights-off still),
# render the parallax depth map, project the live details, bake the flight
# model(s); then recompress every model with meshopt and delete published
# files nothing references any more.
#
# Exporting a still replaces that island's manifest entry, so the day, depth
# and live-detail steps must always follow it; run them through this script.
# Builds are repeatable: the same script makes the same scene every time, and
# renders use a fixed seed and the CPU denoiser. On the CPU (--cpu) an
# unchanged island re-renders byte-identically, to the same fingerprinted
# files. Metal (the default, much faster) differs by at most one level in a
# few pixels, which is invisible but gives new file names. Rebuilding one island
# never touches another's files. Logs: .blender-build/pipeline/.
set -euo pipefail
cd "$(dirname "$0")/../.."

BLENDER=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
world=${1:-}
shift || true
samples=96 width=2880 device=METAL
while [ $# -gt 0 ]; do
  case $1 in
    --samples) samples=$2; shift 2 ;;
    --width) width=$2; shift 2 ;;
    --quick) samples=24; width=1440; shift ;;
    --cpu) device=CPU; shift ;;
    *) echo "Unknown option $1" >&2; exit 1 ;;
  esac
done
case $world in
  work|writing|projects) worlds=("$world") ;;
  all) worlds=(work writing projects) ;;
  *) echo "Usage: $0 work|writing|projects|all [--quick] [--cpu] [--samples N] [--width N]" >&2; exit 1 ;;
esac
[ -x "$BLENDER" ] || { echo "Blender not found at $BLENDER (set BLENDER=...)" >&2; exit 1; }

out=.blender-build/pipeline
rm -rf "$out"; mkdir -p "$out"
step() { printf '\n== %s\n' "$*"; }
# Run Blender, keep its log, and fail loudly (with the log's tail) on errors.
blender() {
  local log=$1; shift
  if ! "$BLENDER" "$@" >"$out/$log.log" 2>&1 || grep -q "^Traceback" "$out/$log.log"; then
    tail -30 "$out/$log.log" >&2; echo "Blender step failed: $log" >&2; exit 1
  fi
}

for w in "${worlds[@]}"; do
  step "$w: model and render the night still (${width}px, $samples samples)"
  blender "$w-night" -b --factory-startup --python scripts/blender/build_islands.py -- \
    --world "$w" --time night --output "$out/night" --width "$width" --samples "$samples" --device "$device"
  step "$w: crop and publish the still"
  node scripts/blender/prepare_islands.mjs "$out/night" "$out/web" --world "$w" | tee "$out/$w-prepare.log"
  node scripts/blender/export_islands.mjs "$out/web" --world "$w"
  crop=$(sed -nE "s/^$w: cropped ([0-9]+)×([0-9]+) at ([0-9]+),([0-9]+).*/\3 \4 \1 \2/p" "$out/$w-prepare.log")
  step "$w: camera and crop (crop $crop)"
  # shellcheck disable=SC2086
  blender "$w-camera" -b "artwork/blender/$w.blend" --python scripts/blender/export_camera.py -- \
    --world "$w" --crop $crop
  grep "CAMERA" "$out/$w-camera.log"
  if [ "$w" = work ]; then
    step "work: daytime still"
    blender work-day -b --factory-startup --python scripts/blender/build_islands.py -- \
      --world work --time day --output "$out/day" --width "$width" --samples "$samples" --device "$device"
    node scripts/blender/export_variant.mjs "$out/day" work day
  else
    step "$w: lights-off still"
    blender "$w-dark" -b --factory-startup --python scripts/blender/build_islands.py -- \
      --world "$w" --time dark --output "$out/dark" --width "$width" --samples "$samples" --device "$device"
    node scripts/blender/export_variant.mjs "$out/dark" "$w" dark
  fi
  if [ "$w" = writing ]; then
    # The study with its notebook lifted away, lit and dark, for the entry.
    for variant in lifted lifted-dark; do
      step "writing: $variant still"
      blender "writing-$variant" -b --factory-startup --python scripts/blender/build_islands.py -- \
        --world writing --time "$variant" --output "$out/$variant" --width "$width" --samples "$samples" --device "$device"
      node scripts/blender/export_variant.mjs "$out/$variant" writing "$variant"
    done
  fi
  step "$w: depth map"
  blender "$w-depth" -b "artwork/blender/$w.blend" --python scripts/blender/render_depth.py -- --world "$w" --output "$out/depth" --width 1440
  node scripts/blender/export_depth.mjs "$out/depth" "$w"
  step "$w: live details"
  blender "$w-life" -b "artwork/blender/$w.blend" --python scripts/blender/export_life_anchors.py -- --world "$w"
  grep "LIFE" "$out/$w-life.log"
  step "$w: flight model"
  blender "$w-flight" -b "artwork/blender/$w.blend" --python scripts/blender/export_flight.py -- --world "$w"
  grep "FLIGHT.*MiB" "$out/$w-flight.log"
done

step "Compress models, remove unreferenced files"
node scripts/blender/compress_models.mjs
for f in public/blender/*; do
  n=$(basename "$f")
  grep -rq "$n" lib components app || { git rm -q "$f" 2>/dev/null || rm "$f"; echo "removed $n"; }
done
rm -rf cycles_metal_integrator_
step "Done. Check the islands in the browser, then commit public/blender and lib/*.json."
