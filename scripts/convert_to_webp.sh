#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Step 1: Batch convert JPG / JPEG / PNG → WebP
#         Run this from the root of federicasorba.art
# ─────────────────────────────────────────────────────────────
# Requirements: brew install imagemagick

set -e

IMAGES_DIR="assets/img"
QUALITY=82
MAX_PX=2400

echo "Converting images to WebP (quality $QUALITY, max ${MAX_PX}px)..."
echo ""

converted=0
skipped=0

find "$IMAGES_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) | while read -r src; do
  dest="${src%.*}.webp"

  # Skip if WebP already exists and is newer than source
  if [ -f "$dest" ] && [ "$dest" -nt "$src" ]; then
    echo "  SKIP (already converted): $src"
    skipped=$((skipped + 1))
    continue
  fi

  magick "$src" -quality $QUALITY -resize "${MAX_PX}x${MAX_PX}>" "$dest"
  original_size=$(du -sh "$src" | cut -f1)
  new_size=$(du -sh "$dest" | cut -f1)
  echo "  ✓ $src  ($original_size → $new_size)"
  converted=$((converted + 1))
done

echo ""
echo "Done. Review the sizes above, then run step 2 (update_json_refs.py)"
echo "to update projects.json to point to the new .webp files."
