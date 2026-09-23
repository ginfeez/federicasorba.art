#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Remove original JPG / JPEG / PNG files that have a WebP twin
# Run AFTER convert_to_webp.sh and update_json_refs.py
# Run from the root of novamediastudio.github.io
# ─────────────────────────────────────────────────────────────

set -e

IMAGES_DIR="assets/img"
removed=0
skipped=0

echo "Scanning for originals with a WebP counterpart..."
echo ""

find "$IMAGES_DIR" -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" \) | sort | while read -r src; do
  webp="${src%.*}.webp"
  if [ -f "$webp" ]; then
    size=$(du -sh "$src" | cut -f1)
    rm "$src"
    echo "  ✓ removed $src ($size)"
  else
    echo "  – kept $src (no WebP found)"
  fi
done

echo ""
echo "Done. Commit the deletions to your repo."
