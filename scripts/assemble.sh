#!/usr/bin/env bash
# Joins rendered chunks (video only) and muxes the mastered audio + soft subtitles.
#   scripts/assemble.sh <profile> <chunks_dir> <out.mp4> [--shortest]
set -euo pipefail
PROFILE="$1"; DIR="$2"; OUT="$3"; EXTRA="${4:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
case "$PROFILE" in shorts|preview-short) KIND=short ;; *) KIND=long ;; esac
LIST="$DIR/list.txt"; : > "$LIST"
for f in $(ls "$DIR"/chunk_*.mp4 | sort); do echo "file '$(realpath "$f")'" >> "$LIST"; done
echo "[assemble] $(wc -l < "$LIST") chunks, kind=$KIND"
ffmpeg -y -loglevel error -f concat -safe 0 -i "$LIST" -c copy "$DIR/joined.mp4"
AUDIO="$ROOT/build/audio_${KIND}_master.wav"; SRT="$ROOT/build/subtitles_${KIND}.srt"
DUR=$(python3 -c "import json;print(json.load(open('$ROOT/build/timeline_${KIND}.json'))['total'])")
TITLE=$(python3 -c "import json;print(json.load(open('$ROOT/build/timeline_${KIND}.json'))['title'])")
ffmpeg -y -loglevel error -i "$DIR/joined.mp4" -i "$AUDIO" -i "$SRT" \
  -map 0:v -map 1:a -map 2:s -c:v copy -c:a aac -b:a 320k -ar 48000 -c:s mov_text \
  -metadata:s:s:0 language=eng -metadata:s:s:0 title=English -metadata title="$TITLE" -t "$DUR" -movflags +faststart $EXTRA "$OUT"
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate -show_entries format=duration -of default=nw=1 "$OUT"
