#!/usr/bin/env bash
# Chroma-key a generated sprite: remove the solid background by flood-filling
# from all four corners, clean the fringe, trim, and resize.
# Usage: key-sprite.sh <input.png> <output.png>
set -euo pipefail

in="$1"
out="$2"
w=$(identify -format '%w' "$in")
h=$(identify -format '%h' "$in")

convert "$in" -alpha set -fuzz 12% -fill none \
  -draw "matte 0,0 floodfill" \
  -draw "matte $((w - 1)),0 floodfill" \
  -draw "matte 0,$((h - 1)) floodfill" \
  -draw "matte $((w - 1)),$((h - 1)) floodfill" \
  -channel A -morphology erode disk:1 -blur 0x0.5 -level '0,85%' +channel \
  -trim +repage \
  -resize 512x512 \
  "$out"
