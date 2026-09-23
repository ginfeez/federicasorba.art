#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Double-click to compress every MP4 / MOV video in the folder
# where this file sits (and all its subfolders).
#
# Requirements: ffmpeg  →  brew install ffmpeg
# ─────────────────────────────────────────────────────────────

CRF=26          # 22 = higher quality · 26 = balanced · 30 = smallest
MAX_HEIGHT=1080 # videos taller than this get scaled down

# Make Homebrew tools visible when launched from Finder
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Work in the folder this file lives in
cd "$(dirname "$0")" || exit 1
ROOT="$(pwd)"

finish() {
  echo ""
  read -n 1 -s -r -p "Press any key to close this window..."
  echo ""
  exit "$1"
}

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is not installed."
  echo "Open Terminal and run:  brew install ffmpeg"
  finish 1
fi

echo "Compressing videos in: $ROOT"
echo "Settings: CRF $CRF · max ${MAX_HEIGHT}p · audio removed"
echo "─────────────────────────────────────────────"

count=0
saved_kb=0

while IFS= read -r -d '' src; do
  case "$src" in *_tmp_compressed.mp4) continue ;; esac

  dest="${src%.*}.mp4"
  tmp="${src%.*}_tmp_compressed.mp4"
  count=$((count + 1))

  echo ""
  echo "[$count] ${src#$ROOT/}"

  if ! ffmpeg -nostdin -y -loglevel error -stats -i "$src" \
      -c:v libx264 -crf "$CRF" -preset slow \
      -vf "scale=-2:'min(ih,$MAX_HEIGHT)'" \
      -pix_fmt yuv420p -movflags +faststart -an \
      "$tmp"; then
    rm -f "$tmp"
    echo "    ✗ failed, original kept"
    continue
  fi

  old_kb=$(du -k "$src" | cut -f1)
  new_kb=$(du -k "$tmp" | cut -f1)
  old_h=$(du -h "$src" | cut -f1 | tr -d ' ')
  new_h=$(du -h "$tmp" | cut -f1 | tr -d ' ')

  if [ "$new_kb" -lt "$old_kb" ]; then
    ext=$(echo "${src##*.}" | tr '[:upper:]' '[:lower:]')
    mv "$tmp" "$dest"
    [ "$ext" = "mov" ] && rm -f "$src"
    saved_kb=$((saved_kb + old_kb - new_kb))
    echo "    ✓ $old_h → $new_h  (-$(( (old_kb - new_kb) * 100 / old_kb ))%)"
  else
    rm -f "$tmp"
    echo "    – already small ($old_h), kept original"
  fi
done < <(find "$ROOT" -type f \( -iname "*.mp4" -o -iname "*.mov" \) -print0)

echo ""
echo "─────────────────────────────────────────────"
if [ "$count" -eq 0 ]; then
  echo "No videos found."
else
  echo "Done: $count video(s) processed, $((saved_kb / 1024)) MB saved."
fi
finish 0
