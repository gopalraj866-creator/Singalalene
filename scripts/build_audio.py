#!/usr/bin/env python3
"""Builds narration + music + SFX, the master mix, the SRT subtitles and the scene timeline (build/timeline_*.json).

  python3 scripts/build_audio.py                    # long (8 min) + short, Kokoro neural TTS (offline), full mix
  python3 scripts/build_audio.py --kind long
  python3 scripts/build_audio.py --engine edge      # Microsoft Edge neural voices (needs internet)
  python3 scripts/build_audio.py --engine estimate  # silent placeholder narration, only for quick visual testing
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, subprocess, sys, textwrap, urllib.request
from pathlib import Path
import numpy as np
from scipy import signal
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / 'build'
sys.path.insert(0, str(Path(__file__).parent))
import audio_synth as syn  # noqa: E402

SR = 48000
KOKORO_URLS = {
    'kokoro-v1.0.onnx': 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx',
    'voices-v1.0.bin': 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin',
}


def load_config():
    p = ROOT / 'config.json'
    return json.loads(p.read_text()) if p.exists() else {}


# ------------------------------------------------------------------ TTS engines
class TTS:
    def __init__(self, engine, voice, speed, cache_dir):
        self.engine, self.voice, self.speed = engine, voice, speed
        self.cache = cache_dir; self.cache.mkdir(parents=True, exist_ok=True)
        self._k = None

    def _key(self, text):
        return hashlib.sha1(f'{self.engine}|{self.voice}|{self.speed}|{text}'.encode()).hexdigest()[:20]

    def synth(self, text):
        """returns (float32 mono array, samplerate)"""
        f = self.cache / f'{self._key(text)}.wav'
        if f.exists():
            a, sr = sf.read(f, dtype='float32'); return a, sr
        if self.engine == 'kokoro': a, sr = self._kokoro(text)
        elif self.engine == 'edge': a, sr = self._edge(text)
        elif self.engine == 'espeak': a, sr = self._espeak(text)
        elif self.engine == 'estimate':
            n = len(text.split()); a, sr = np.zeros(int(n / 2.55 * 24000), np.float32), 24000
        else: raise SystemExit(f'unknown engine {self.engine}')
        sf.write(f, a, sr, subtype='FLOAT')
        return a, sr

    def _kokoro(self, text):
        if self._k is None:
            from kokoro_onnx import Kokoro
            mdir = ROOT / 'models'; mdir.mkdir(exist_ok=True)
            for name, url in KOKORO_URLS.items():
                if not (mdir / name).exists():
                    print(f'[tts] downloading {name} ...', flush=True)
                    urllib.request.urlretrieve(url, mdir / name)
            self._k = Kokoro(str(mdir / 'kokoro-v1.0.onnx'), str(mdir / 'voices-v1.0.bin'))
        lang = 'en-gb' if self.voice.startswith('b') else 'en-us'
        a, sr = self._k.create(text, voice=self.voice, speed=self.speed, lang=lang)
        return a.astype(np.float32), sr

    def _edge(self, text):
        import asyncio, edge_tts, tempfile
        pct = int(round((self.speed - 1.0) * 100))
        tmp = Path(tempfile.mkstemp(suffix='.mp3')[1])
        async def go():
            await edge_tts.Communicate(text, self.voice, rate=f'{pct:+d}%').save(str(tmp))
        for attempt in range(4):
            try: asyncio.run(go()); break
            except Exception as e:  # network hiccup -> retry
                print('[tts] edge retry', attempt, e);
                if attempt == 3: raise
        wav = tmp.with_suffix('.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(tmp), '-ar', '24000', '-ac', '1', str(wav)], check=True)
        a, sr = sf.read(wav, dtype='float32'); tmp.unlink(); wav.unlink()
        return a, sr

    def _espeak(self, text):
        import tempfile
        wav = Path(tempfile.mkstemp(suffix='.wav')[1])
        subprocess.run(['espeak-ng', '-v', 'en-us', '-s', str(int(150 * self.speed)), '-w', str(wav), text], check=True)
        a, sr = sf.read(wav, dtype='float32'); wav.unlink()
        if a.ndim > 1: a = a[:, 0]
        return a, sr


def trim_silence(a, sr, thr=0.004, keep=0.06):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0: return a
    s = max(0, idx[0] - int(keep * sr)); e = min(len(a), idx[-1] + int(keep * sr))
    return a[s:e]


# ------------------------------------------------------------------ timeline
def build_timeline(script, tts, target, engine, gap_default=0.42):
    scenes, audio_items = [], []
    t = 0.0
    for si, sc in enumerate(script['scenes']):
        S = {'id': sc['id'], 'start': t, 'segs': [], 'music': sc.get('music', {}), '_lead': sc.get('lead', 0.8), '_tail': sc.get('tail', 0.9), '_bursts_f': sc.get('bursts', [])}
        t += S['_lead']
        for gi, sg in enumerate(sc['segs']):
            a, sr = tts.synth(sg['t'])
            a = trim_silence(a, sr)
            dur = len(a) / sr
            S['segs'].append({'text': sg['t'], 'start': t, 'end': t + dur, 'cues': sg.get('cues', []), '_gap': sg.get('pause', gap_default)})
            audio_items.append((t, a, sr))
            t += dur + (S['segs'][-1]['_gap'] if gi < len(sc['segs']) - 1 else 0)
        t += S['_tail']; S['end'] = t
        scenes.append(S)
    return scenes, audio_items, t


def stretch_to_target(scenes, audio_items, total, target):
    """If the narration is shorter than the target, add breathing room (extra pauses between sentences / scene ends)."""
    if total >= target - 0.5 or target <= 0: return scenes, audio_items, total
    slots = []  # (scene idx, seg idx or 'tail', weight, cap)
    for si, S in enumerate(scenes):
        for gi in range(len(S['segs']) - 1): slots.append((si, gi, 1.0, 1.1))
        slots.append((si, 'tail', 2.0, 3.2))
    extra = target - total; add = {}
    for _ in range(4):  # iterative water-filling honouring caps
        wsum = sum(w for (si, k, w, c) in slots if add.get((si, k), 0) < c - 1e-6)
        if wsum <= 0 or extra < 0.05: break
        for (si, k, w, c) in slots:
            cur = add.get((si, k), 0)
            if cur >= c - 1e-6: continue
            d = min(c - cur, extra * w / wsum); add[(si, k)] = cur + d
        extra = target - total - sum(add.values())
    # re-time
    t = 0.0; new_items = []; idx = 0
    for si, S in enumerate(scenes):
        S['start'] = t; t += S['_lead']
        for gi, sg in enumerate(S['segs']):
            dur = sg['end'] - sg['start']
            sg['start'] = t; sg['end'] = t + dur
            new_items.append((t, audio_items[idx][1], audio_items[idx][2])); idx += 1
            t += dur
            if gi < len(S['segs']) - 1: t += sg['_gap'] + add.get((si, gi), 0)
        t += S['_tail'] + add.get((si, 'tail'), 0); S['end'] = t
    return scenes, new_items, t


def finalize(scenes):
    out = []
    for S in scenes:
        cues = {}
        for sg in S['segs']:
            for c in sg['cues']:
                lo, hi = sg['start'] - S['start'], sg['end'] - S['start']
                if c in cues: cues[c]['end'] = hi
                else: cues[c] = {'start': lo, 'end': hi}
        D = S['end'] - S['start']
        out.append({
            'id': S['id'], 'start': round(S['start'], 3), 'end': round(S['end'], 3), 'music': S['music'],
            'bursts': [round(f * D, 3) for f in S['_bursts_f']], 'cues': cues,
            'segs': [{'text': g['text'], 'start': round(g['start'] - S['start'], 3), 'end': round(g['end'] - S['start'], 3), 'cues': g['cues']} for g in S['segs']],
        })
    return out


# ------------------------------------------------------------------ SRT
def split_subtitle(text, max_chars=84):
    """Break a sentence-group into subtitle chunks of at most two ~42-char lines, on punctuation when possible."""
    parts = re.split(r'(?<=[.!?:;])\s+|(?<=,)\s+', text.strip())
    chunks, cur = [], ''
    for p in parts:
        if not p: continue
        if len(cur) + len(p) + 1 <= max_chars: cur = (cur + ' ' + p).strip()
        else:
            if cur: chunks.append(cur)
            while len(p) > max_chars:
                cut = p.rfind(' ', 0, max_chars); chunks.append(p[:cut]); p = p[cut + 1:]
            cur = p
    if cur: chunks.append(cur)
    return chunks


def fmt_ts(x):
    ms = int(round(x * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f'{h:02d}:{m:02d}:{s:02d},{ms:03d}'


def write_srt(tl_scenes, path, max_chars):
    n = 1; lines = []
    for sc in tl_scenes:
        for g in sc['segs']:
            a, b = sc['start'] + g['start'], sc['start'] + g['end']
            chunks = split_subtitle(g['text'], max_chars); tot = sum(len(c) for c in chunks)
            t = a
            for c in chunks:
                d = (b - a) * len(c) / tot
                wrapped = '\n'.join(textwrap.wrap(c, width=max(20, max_chars // 2 + 2)))
                lines += [str(n), f'{fmt_ts(t)} --> {fmt_ts(t + d - 0.04)}', wrapped, '']
                n += 1; t += d
    path.write_text('\n'.join(lines), encoding='utf-8')
    return n - 1


# ------------------------------------------------------------------ mix + master
def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def loudness_master(mix_wav, out_wav, target_i=-14.0, tp=-1.5, lra=11):
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(mix_wav), '-af', f'loudnorm=I={target_i}:TP={tp}:LRA={lra}:print_format=json', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = re.search(r'\{[^{}]*"input_i"[^{}]*\}', p.stderr, re.S)
    d = json.loads(m.group(0))
    af = (f"loudnorm=I={target_i}:TP={tp}:LRA={lra}:measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}"
          f":measured_thresh={d['input_thresh']}:offset={d['target_offset']}:linear=true:print_format=summary")
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(mix_wav), '-af', af + ',alimiter=limit=0.89:level=false', '-ar', str(SR), '-c:a', 'pcm_s24le', str(out_wav)])
    return d


def mix_stems(kind, narr, music, fx, total):
    tmp = BUILD / f'_stems_{kind}'; tmp.mkdir(exist_ok=True)
    n_len = int((total + 4) * SR)
    def fit(x):
        x = x[:, :n_len] if x.ndim == 2 else x[:n_len]
        if x.shape[-1] < n_len: x = np.pad(x, ((0, 0), (0, n_len - x.shape[-1])) if x.ndim == 2 else (0, n_len - x.shape[-1]))
        return x
    sf.write(tmp / 'narration_raw.wav', fit(narr), SR, subtype='FLOAT')
    sf.write(tmp / 'music.wav', fit(music).T, SR, subtype='FLOAT')
    sf.write(tmp / 'fx.wav', fit(fx).T, SR, subtype='FLOAT')
    fc = (
        "[0:a]highpass=f=75,equalizer=f=190:t=q:w=1.0:g=1.8,equalizer=f=420:t=q:w=1.5:g=-1.5,equalizer=f=3400:t=q:w=1.1:g=2.2,"
        "acompressor=threshold=-21dB:ratio=3:attack=6:release=130:makeup=3.5,deesser=i=0.22:m=0.5:f=0.5:s=o,"
        "aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=2[n1][n2];"
        "[1:a]volume=0.62[m];[m][n1]sidechaincompress=threshold=0.035:ratio=7:attack=18:release=520:makeup=1.0[md];"
        "[2:a]volume=0.95[f];"
        "[n2][md][f]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.93[out]"
    )
    mixed = tmp / 'mix.wav'
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(tmp / 'narration_raw.wav'), '-i', str(tmp / 'music.wav'), '-i', str(tmp / 'fx.wav'),
         '-filter_complex', fc, '-map', '[out]', '-ar', str(SR), '-c:a', 'pcm_f32le', str(mixed)])
    return tmp, mixed


def build_kind(kind, args, cfg):
    script = json.loads((Path(__file__).parent / f'script_{kind}.json').read_text())
    voice = args.voice or cfg.get('voice', {}).get(args.engine) or {'kokoro': 'af_heart', 'edge': 'en-US-AndrewMultilingualNeural', 'espeak': 'en-us', 'estimate': 'x'}[args.engine]
    speed = args.speed if args.speed else cfg.get('voice', {}).get('speed', 1.0)
    tts = TTS(args.engine, voice, speed, BUILD / 'tts_cache')
    target = args.target if args.target else script.get('target_seconds', 0)
    print(f'[{kind}] engine={args.engine} voice={voice} speed={speed}', flush=True)
    scenes, items, total = build_timeline(script, tts, target, args.engine)
    print(f'[{kind}] narration timeline {total:.1f}s (target {target}s)')
    scenes, items, total = stretch_to_target(scenes, items, total, target)
    tl_scenes = finalize(scenes)
    tl = {'kind': kind, 'total': round(total, 3), 'title': script['title'], 'scenes': tl_scenes}
    (BUILD / f'timeline_{kind}.json').write_text(json.dumps(tl, indent=1))
    n = write_srt(tl_scenes, BUILD / f'subtitles_{kind}.srt', 84 if kind == 'long' else 40)
    print(f'[{kind}] final length {total:.1f}s ({int(total // 60)}:{int(total % 60):02d}), {n} subtitle cues')
    # YouTube chapters
    if kind == 'long':
        names = {'hook': 'The signal', 'headline': 'What was announced', 'journey': 'A 63 light-year journey', 'system': 'Meet Beta Pictoris b',
                 'meerkat': 'MeerKAT listens', 'quasars': 'Pinning it on a planet', 'aurora': 'A radio aurora', 'field': 'A monster magnetic field',
                 'engine': 'What powers it?', 'notaliens': 'Why it is NOT aliens', 'future': 'What happens next', 'outro': 'Final thoughts'}
        ch = []
        for sc in tl_scenes:
            s = int(sc['start']); ch.append(f"{s // 60}:{s % 60:02d} {names.get(sc['id'], sc['id'])}")
        (BUILD / 'youtube_chapters.txt').write_text('\n'.join(ch) + '\n')
    if args.engine == 'estimate' and args.no_mix:
        return
    # narration track (mono 48 kHz)
    N = int((total + 5) * SR); narr = np.zeros(N, np.float32)
    for (t0, a, sr) in items:
        if sr != SR: a = signal.resample_poly(a, SR // np.gcd(SR, sr), sr // np.gcd(SR, sr)).astype(np.float32)
        act = a[np.abs(a) > 0.01]
        if len(act) > 100:
            rms = np.sqrt(np.mean(act ** 2)); a = a * float(np.clip(0.13 / rms, 0.5, 2.2))
        fade = int(0.012 * SR); a = a.copy(); a[:fade] *= np.linspace(0, 1, fade); a[-fade:] *= np.linspace(1, 0, fade)
        i = int(round(t0 * SR)); narr[i:i + len(a)] += a[:N - i]
    print(f'[{kind}] synthesising score + sfx ...', flush=True)
    music, fx = syn.render_music(tl, total, SR)
    tmp, mixed = mix_stems(kind, narr, music, fx, total)
    out = BUILD / f'audio_{kind}'
    d = loudness_master(mixed, BUILD / f'audio_{kind}_master.wav')
    print(f"[{kind}] loudness before master: {d['input_i']} LUFS -> target -14 LUFS")
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(BUILD / f'audio_{kind}_master.wav'), '-t', f'{total:.3f}', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', str(BUILD / f'audio_{kind}.m4a')])
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(BUILD / f'audio_{kind}_master.wav'), '-t', f'{total:.3f}', '-c:a', 'libmp3lame', '-b:a', '320k', '-ar', '48000', str(BUILD / f'audio_{kind}.mp3')])
    print(f'[{kind}] audio ready -> build/audio_{kind}.m4a / .mp3 / _master.wav')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--kind', default='both', choices=['long', 'short', 'both'])
    ap.add_argument('--engine', default='kokoro', choices=['kokoro', 'edge', 'espeak', 'estimate'])
    ap.add_argument('--voice', default=None); ap.add_argument('--speed', type=float, default=None)
    ap.add_argument('--target', type=float, default=None)
    ap.add_argument('--no-mix', action='store_true', help='with --engine estimate: only write timeline (very fast)')
    args = ap.parse_args()
    BUILD.mkdir(exist_ok=True)
    cfg = load_config()
    for kind in (['long', 'short'] if args.kind == 'both' else [args.kind]):
        build_kind(kind, args, cfg)


if __name__ == '__main__':
    main()
