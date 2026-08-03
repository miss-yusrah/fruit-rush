#!/usr/bin/env bash
# Rebuild WebP design posters + fruit spritesheet from archived PNGs.
# Usage: from client/ → bash scripts/optimize-assets.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESIGNS="$ROOT/src/assets/designs"
FRUITS="$ROOT/src/assets/fruits"
CELL=256
COLS=5
ROWS=5

# Phone stage maxes out well under 1170 CSS px — 780w WebP is sharp on 2–3x DPR.
DESIGN_WIDTH="${DESIGN_WIDTH:-780}"

if [[ -d "$DESIGNS/_png_source" ]]; then
  for f in "$DESIGNS/_png_source"/*.png; do
    base=$(basename "$f" .png)
    convert "$f" -resize "${DESIGN_WIDTH}x" -strip -quality 82 "$DESIGNS/${base}.webp"
    echo "design ${base}.webp (${DESIGN_WIDTH}w)"
  done
fi

if [[ -d "$FRUITS/_png_source" ]]; then
  TMP=$(mktemp -d)
  for f in "$FRUITS/_png_source"/*.png; do
    base=$(basename "$f" .png)
    convert "$f" -strip -resize "${CELL}x${CELL}" -background none \
      -gravity center -extent "${CELL}x${CELL}" "$TMP/${base}.png"
  done
  # Montage MUST use the same basename order as sheet.json (Python sorted).
  # Bare shell globs put "apple-half" before "apple", which swaps whole/half frames.
  ORDERED=()
  while IFS= read -r base; do
    ORDERED+=("$TMP/${base}.png")
  done < <(python3 -c "import glob,os; print('\n'.join(sorted(os.path.basename(p)[:-4] for p in glob.glob('$TMP/*.png'))))")
  montage "${ORDERED[@]}" -tile "${COLS}x${ROWS}" -geometry "${CELL}x${CELL}+0+0" \
    -background none -gravity northwest "$TMP/sheet.png"
  convert "$TMP/sheet.png" -background none -extent "$((COLS * CELL))x$((ROWS * CELL))" \
    -strip -quality 85 "$FRUITS/sheet.webp"
  python3 - "$FRUITS/sheet.json" "$TMP" "$CELL" "$COLS" "$ROWS" <<'PY'
import json, os, glob, sys
out, tmp, cell, cols, rows = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5])
files = sorted(os.path.basename(p)[:-4] for p in glob.glob(f"{tmp}/*.png") if not p.endswith("sheet.png"))
frames = {}
for i, name in enumerate(files):
    x, y = (i % cols) * cell, (i // cols) * cell
    frames[name] = {
        "frame": {"x": x, "y": y, "w": cell, "h": cell},
        "rotated": False, "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": cell, "h": cell},
        "sourceSize": {"w": cell, "h": cell},
        "anchor": {"x": 0.5, "y": 0.5},
    }
json.dump({
    "frames": frames,
    "meta": {
        "app": "fruit-rush-optimize", "version": "1.0", "image": "sheet.webp",
        "format": "RGBA8888", "size": {"w": cols * cell, "h": rows * cell}, "scale": "1",
    },
}, open(out, "w"), indent=2)
print(f"sheet {len(frames)} frames → {out}")
PY
  rm -rf "$TMP"
fi
echo "optimize-assets done"
