#!/usr/bin/env bash
# One-machine render (no GitHub): audio -> frames -> final MP4.   ./scripts/render_all.sh 1080p|4k|shorts
# Software WebGL is slow (hours for 4K). For speed use the GitHub Actions workflow, which renders in parallel chunks.
set -euo pipefail
cd "$(dirname "$0")/.."
PROFILE="${1:-1080p}"
[ -f build/timeline_long.json ] || python3 scripts/build_audio.py
case "$PROFILE" in shorts|preview-short) KIND=short ;; *) KIND=long ;; esac
TOTAL=$(node -e "const t=require('./build/timeline_$KIND.json');console.log(Math.round(t.total*30))")
CHUNK=900; [ "$PROFILE" = 4k ] && CHUNK=360
OUT="build/chunks_$PROFILE"; mkdir -p "$OUT"
i=0
for ((s=0; s<TOTAL; s+=CHUNK)); do
  e=$((s+CHUNK)); [ $e -gt $TOTAL ] && e=$TOTAL
  f="$OUT/chunk_$(printf '%03d' $i).mp4"
  [ -f "$f" ] || node scripts/render.js --profile "$PROFILE" --start $s --end $e --out "$f"   # resumable
  i=$((i+1))
done
mkdir -p dist
scripts/assemble.sh "$PROFILE" "$OUT" "dist/Beta_Pictoris_$PROFILE.mp4"
cp "build/subtitles_$KIND.srt" "dist/Beta_Pictoris_$PROFILE.srt"
echo "done -> dist/Beta_Pictoris_$PROFILE.mp4"
