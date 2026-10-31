"""Procedural, deterministic sound design (no samples, no licences): cinematic pads, sub bass, bells, heartbeat,
risers, impacts and "sonified" radio bursts. Everything is numpy/scipy and rendered at 48 kHz stereo."""
from __future__ import annotations
import numpy as np
from scipy import signal

SR = 48000
CHORD_LEN = 8.0          # seconds per chord
XFADE = 2.5              # chord cross-fade


def midi(n: float) -> float:
    return 440.0 * 2 ** ((n - 69) / 12)


NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11}


def hz(name: str) -> float:
    n, o = (name[:-1], int(name[-1]))
    return midi(12 * (o + 1) + NOTE[n])


PROG = {
    'mystery': [['D3', 'F3', 'A3', 'D4'], ['Bb2', 'F3', 'Bb3', 'D4'], ['G2', 'D3', 'G3', 'Bb3'], ['A2', 'E3', 'A3', 'C#4']],
    'wonder':  [['D3', 'A3', 'D4', 'F#4', 'E4'], ['C#3', 'E3', 'A3', 'E4'], ['B2', 'F#3', 'B3', 'D4', 'A4'], ['G2', 'D3', 'B3', 'F#4']],
    'tension': [['D2', 'A2', 'D3', 'F3'], ['C3', 'G3', 'D4', 'F4'], ['Bb2', 'F3', 'Bb3', 'D4'], ['A2', 'E3', 'G3', 'C#4']],
    'triumph': [['D3', 'A3', 'D4', 'F#4', 'A4'], ['B2', 'F#3', 'D4', 'F#4'], ['G2', 'D3', 'G3', 'B3', 'D4'], ['A2', 'E3', 'A3', 'C#4', 'E4']],
}
BELLS = ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6']
LOWBELLS = ['D4', 'F4', 'A4', 'C5', 'D5']
GAIN = {'mystery': 0.9, 'wonder': 1.0, 'tension': 1.0, 'triumph': 1.15}


def _fade(n, a, b, sr=SR):
    env = np.ones(n, dtype=np.float32)
    na, nb = min(n, int(a * sr)), min(n, int(b * sr))
    if na: env[:na] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, na))
    if nb: env[-nb:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, nb))
    return env


def _pad_chord(freqs, dur, sr, seed):
    """Warm detuned additive pad (rendered at 24 kHz then upsampled for speed)."""
    r = np.random.default_rng(seed)
    n = int(dur * sr)
    t = np.arange(n, dtype=np.float32) / sr
    L = np.zeros(n, np.float32); R = np.zeros(n, np.float32)
    for f in freqs:
        for k, det in enumerate((-6, 0, 7)):  # cents
            ff = f * 2 ** (det / 1200)
            ph0 = r.uniform(0, 2 * np.pi)
            lfo = 1 + 0.12 * np.sin(2 * np.pi * r.uniform(0.05, 0.18) * t + r.uniform(0, 6))
            sig = np.zeros(n, np.float32)
            for h, a in ((1, 1.0), (2, 0.42), (3, 0.2), (4, 0.09), (5, 0.04)):
                if ff * h < sr / 2 * 0.9:
                    sig += a * np.sin(2 * np.pi * ff * h * t + ph0 * h)
            sig *= lfo
            pan = (k - 1) * 0.35 + r.uniform(-0.1, 0.1)
            L += sig * (0.5 - pan / 2) ** 0.5; R += sig * (0.5 + pan / 2) ** 0.5
    norm = 1.0 / max(1, len(freqs)) ** 0.8 * 0.33
    return L * norm, R * norm


def _sub(freq, dur, sr):
    n = int(dur * sr); t = np.arange(n, dtype=np.float32) / sr
    return (np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * freq * 2 * t)).astype(np.float32) * 0.55


def _bell(freq, dur=4.0, sr=SR, bright=1.0, seed=0):
    n = int(dur * sr); t = np.arange(n, dtype=np.float32) / sr
    idx = 2.2 * bright * np.exp(-t * 2.2)
    mod = np.sin(2 * np.pi * freq * 3.5 * t)
    car = np.sin(2 * np.pi * freq * t + idx * mod) + 0.35 * np.sin(2 * np.pi * freq * 2.001 * t)
    env = np.exp(-t * 1.25) * (1 - np.exp(-t * 400))
    return (car * env).astype(np.float32) * 0.5


def _thump(sr=SR, f0=62, dur=0.55):
    n = int(dur * sr); t = np.arange(n, dtype=np.float32) / sr
    f = f0 * (1 + 1.4 * np.exp(-t * 28))
    ph = 2 * np.pi * np.cumsum(f) / sr
    return (np.sin(ph) * np.exp(-t * 7.5) * (1 - np.exp(-t * 900))).astype(np.float32)


def _noise_sweep(dur, f0, f1, sr=SR, q=1.2, seed=0, curve='exp'):
    r = np.random.default_rng(seed)
    n = int(dur * sr); x = r.standard_normal(n).astype(np.float32)
    # time-varying band-pass through block-wise biquads
    out = np.zeros(n, np.float32); blk = 1024; zi = None
    for i in range(0, n, blk):
        p = i / n
        f = f0 * (f1 / f0) ** p if curve == 'exp' else f0 + (f1 - f0) * p
        f = min(f, sr / 2 * 0.9)
        b, a = signal.iirpeak(f / (sr / 2), q)
        seg = x[i:i + blk]
        if zi is None: zi = np.zeros(max(len(a), len(b)) - 1)
        y, zi = signal.lfilter(b, a, seg, zi=zi)
        out[i:i + blk] = y
    m = np.max(np.abs(out)) or 1
    return out / m


def _add(dst, src, at, gain=1.0):
    i = int(at * SR)
    if i >= len(dst): return
    if i < 0:
        src = src[-i:]; i = 0
    n = min(len(src), len(dst) - i)
    if n > 0: dst[i:i + n] += src[:n] * gain


def _reverb_ir(sr=SR, dur=3.8, seed=7):
    r = np.random.default_rng(seed)
    n = int(dur * sr); t = np.arange(n) / sr
    env = np.exp(-t * 1.9)
    irs = []
    for c in range(2):
        x = r.standard_normal(n) * env
        b, a = signal.butter(2, 5200 / (sr / 2), 'low')  # darker tail
        x = signal.lfilter(b, a, x)
        x[: int(0.012 * sr)] *= np.linspace(0, 1, int(0.012 * sr))
        irs.append(x.astype(np.float32))
    ir = np.stack(irs); ir /= np.sqrt((ir ** 2).sum(axis=1, keepdims=True)) * 0.9
    return ir


def radio_burst(dur=0.9, seed=0, sr=SR):
    """Sonification of an auroral radio burst: a falling chirp with ring-mod crackle and a bright noise sheen."""
    r = np.random.default_rng(seed)
    n = int(dur * sr); t = np.arange(n, dtype=np.float32) / sr
    f = 520 + 2300 * np.exp(-t * 4.2) + 60 * np.sin(2 * np.pi * 9 * t)
    ph = 2 * np.pi * np.cumsum(f) / sr
    tone = np.sin(ph) + 0.4 * np.sin(2.01 * ph)
    gate = (r.random(n // 220 + 1) > 0.35).astype(np.float32)
    gate = np.repeat(gate, 220)[:n]
    crack = r.standard_normal(n).astype(np.float32) * gate
    b, a = signal.butter(2, [1500 / (sr / 2), 9000 / (sr / 2)], 'band')
    crack = signal.lfilter(b, a, crack).astype(np.float32)
    rm = tone * (0.6 + 0.4 * np.sin(2 * np.pi * 47 * t))
    env = (1 - np.exp(-t * 700)) * np.exp(-t * 3.6)
    sig = (0.55 * rm + 0.5 * crack) * env
    return (sig / (np.max(np.abs(sig)) or 1) * 0.8).astype(np.float32)


def render_music(tl: dict, total: float, sr=SR):
    """Returns (music_LR, fx_LR) float32 arrays shaped (2, N)."""
    N = int((total + 6) * sr)
    music = np.zeros((2, N), np.float32); fx = np.zeros((2, N), np.float32)
    scenes = tl['scenes']

    def scene_at(t):
        for sc in scenes:
            if sc['start'] <= t < sc['end']: return sc
        return scenes[-1]

    # ---- pads + sub bass on a global chord grid
    sr_pad = 24000
    nslots = int(np.ceil(total / CHORD_LEN)) + 1
    for k in range(nslots):
        t0 = k * CHORD_LEN
        sc = scene_at(min(t0 + CHORD_LEN / 2, total - 0.01))
        mood = sc.get('music', {}).get('mood', 'wonder')
        prog = PROG[mood]; chord = prog[k % len(prog)]
        freqs = [hz(x) for x in chord]
        dur = CHORD_LEN + 2 * XFADE
        l, r_ = _pad_chord(freqs, dur, sr_pad, seed=1000 + k)
        env = _fade(len(l), XFADE, XFADE, sr_pad)
        l = signal.resample_poly(l * env, 2, 1).astype(np.float32); r_ = signal.resample_poly(r_ * env, 2, 1).astype(np.float32)
        g = GAIN[mood]
        _add(music[0], l, t0 - XFADE, g); _add(music[1], r_, t0 - XFADE, g)
        sub = _sub(hz(chord[0]) / (2 if hz(chord[0]) > 80 else 1), dur, sr) * _fade(int(dur * sr), XFADE, XFADE)
        _add(music[0], sub, t0 - XFADE, 0.42 * g); _add(music[1], sub, t0 - XFADE, 0.42 * g)

    # ---- per-scene colour: bells, heartbeat, ostinato, risers, impacts
    rng = np.random.default_rng(42)
    for si, sc in enumerate(scenes):
        m = sc.get('music', {}); mood = m.get('mood', 'wonder'); s0, s1 = sc['start'], sc['end']
        # bells / twinkles
        dens = {'wonder': 1 / 1.7, 'mystery': 1 / 4.5, 'tension': 1 / 7.0, 'triumph': 1 / 1.2}[mood]
        t = s0 + rng.uniform(0.5, 2.0)
        while t < s1 - 1.0:
            pool = LOWBELLS if mood in ('mystery', 'tension') else BELLS
            note = hz(pool[rng.integers(len(pool))]); pan = rng.uniform(-0.8, 0.8)
            b = _bell(note, 4.0, sr, bright=1.0 if mood != 'mystery' else 0.6)
            amp = rng.uniform(0.10, 0.2) * (1.3 if mood == 'triumph' else 1)
            _add(music[0], b, t, amp * (0.5 - pan / 2) ** 0.5 * 1.4); _add(music[1], b, t, amp * (0.5 + pan / 2) ** 0.5 * 1.4)
            t += rng.exponential(1 / dens) * 0.7 + 0.35
        # heartbeat
        if m.get('pulse'):
            th = _thump(); tt = s0 + 0.6
            while tt < s1 - 0.5:
                _add(music[0], th, tt, 0.5); _add(music[1], th, tt, 0.5)
                _add(music[0], th, tt + 0.26, 0.3); _add(music[1], th, tt + 0.26, 0.3)
                tt += 1.15
        # tension ostinato (filtered saw 8ths)
        if mood == 'tension':
            bpm = 96; step = 60 / bpm / 2; tt = s0 + 0.5; i = 0
            root = [hz('D2'), hz('D2'), hz('F2'), hz('D2'), hz('A2'), hz('D2'), hz('F2'), hz('C3')]
            while tt < s1 - 0.5:
                f = root[i % len(root)]; n = int(0.22 * sr); tcol = np.arange(n) / sr
                saw = signal.sawtooth(2 * np.pi * f * tcol).astype(np.float32)
                cut = 300 + 1600 * ((tt - s0) / (s1 - s0)) ** 1.5
                b_, a_ = signal.butter(2, min(cut, 12000) / (sr / 2), 'low')
                note = signal.lfilter(b_, a_, saw).astype(np.float32) * np.exp(-tcol * 14) * (1 - np.exp(-tcol * 800))
                prog_amp = 0.12 + 0.2 * ((tt - s0) / (s1 - s0))
                _add(music[0], note, tt, prog_amp); _add(music[1], note, tt, prog_amp)
                tt += step; i += 1
        # riser into the end of the scene
        if m.get('riser') or mood == 'tension':
            d = min(6.0, (s1 - s0) * 0.5)
            ns = _noise_sweep(d, 300, 7000, sr, q=0.9, seed=300 + si) * np.linspace(0, 1, int(d * sr)) ** 2.2
            _add(fx[0], ns, s1 - d + 0.4, 0.28); _add(fx[1], ns[::-1][::-1], s1 - d + 0.4, 0.28)
        # impact at scene start
        if m.get('impact'):
            n = int(3.0 * sr); t_ = np.arange(n) / sr
            boom = np.sin(2 * np.pi * 42 * t_ * (1 + 0.8 * np.exp(-t_ * 6))) * np.exp(-t_ * 1.6)
            hit = _noise_sweep(2.0, 6000, 200, sr, q=0.6, seed=77) * np.exp(-np.linspace(0, 1, int(2 * sr)) * 5)
            _add(fx[0], boom.astype(np.float32), s0 + 0.9, 0.7); _add(fx[1], boom.astype(np.float32), s0 + 0.9, 0.7)
            _add(fx[0], hit, s0 + 0.9, 0.35); _add(fx[1], hit, s0 + 0.9, 0.35)
        # scene transition whoosh (end of scene)
        if si < len(scenes) - 1:
            w = _noise_sweep(1.6, 400, 2600, sr, q=0.7, seed=500 + si) * _fade(int(1.6 * sr), 0.8, 0.8) * 0.18
            _add(fx[0], w, s1 - 0.9, 1.0); _add(fx[1], w, s1 - 0.9, 1.0)
        # radio bursts (visual bursts are drawn at the same timestamps)
        for bi, bt in enumerate(sc.get('bursts', [])):
            b = radio_burst(0.9 + 0.2 * (bi % 2), seed=900 + si * 10 + bi)
            pan = [-0.35, 0.3, -0.1, 0.4][bi % 4]
            _add(fx[0], b, s0 + bt, 0.55 * (0.5 - pan / 2) ** 0.5 * 1.4); _add(fx[1], b, s0 + bt, 0.55 * (0.5 + pan / 2) ** 0.5 * 1.4)
        # outro: ring-out of the final chord is handled by the fade below
    # ---- convolution reverb on the music bus (wet 30%)
    ir = _reverb_ir(sr)
    wet = np.stack([signal.oaconvolve(music[c], ir[c], mode='full')[:N] for c in range(2)]).astype(np.float32)
    music = music * 0.78 + wet * 0.30
    # ---- global fades
    music *= np.minimum(1.0, np.arange(N) / (3.5 * sr)).astype(np.float32)
    endfade = np.clip((total - 0.15 - np.arange(N) / sr) / 5.0, 0, 1).astype(np.float32)   # silent exactly at the end of the video
    music *= endfade
    peak = max(np.max(np.abs(music)), 1e-6); music *= 0.9 / peak
    fpeak = max(np.max(np.abs(fx)), 1e-6); fx *= min(1.0, 0.9 / fpeak)
    return music, fx
