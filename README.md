# Radio signals from 63 light-years away — "not an alien message" (Three.js video project)

An 8-minute (8:00) YouTube video, **rendered from real-time WebGL simulations (Three.js)**, with a neural-voice narration,
a procedurally composed score + sound design, SRT subtitles, and a GitHub Actions workflow that renders
**4K (3840×2160)**, **1080p** and **Shorts (1080×1920, 56 s, big burned-in captions)**.

Topic (researched on the web, Oct 2026): astronomers traced radio bursts to the exoplanet **Beta Pictoris b** (~63 ly, ~12 Jupiter masses)
using South Africa's **MeerKAT** — a radio *aurora* from a magnetic field of **≥ 1,250 gauss**, not an alien message. Sources are listed at the bottom.

## What you get

| Path | What |
|---|---|
| `web/` | The Three.js stage + 12 simulation scenes (`web/scenes/*.js`): hook · headline · 63-ly journey · star system · MeerKAT array · quasar localisation · aurora physics · magnetic-field comparison · power sources · "why not aliens" · what's next · outro |
| `scripts/script_long.json`, `script_short.json` | Narration text (+ `cues` that trigger on-screen labels/animation at the exact spoken moment) |
| `scripts/build_audio.py` | Narration (Kokoro offline neural TTS, or Edge neural voices) → timeline → SRT → score/SFX → mix → master |
| `scripts/audio_synth.py` | Procedural score (pads, sub bass, bells, heartbeat, risers, impacts) and "sonified" radio bursts (synced to the visual flashes) |
| `scripts/render.js` | Deterministic frame-accurate renderer (headless Chromium + WebGL → ffmpeg, H.264, BT.709) |
| `.github/workflows/render.yml` | One-click cloud render: parallel chunks → final MP4s |
| `deliverables/` | Already-built **audio (M4A 320 kbps + MP3 320 kbps), SRT subtitles, chapters, description** for the long video and the Short |

## Render on GitHub (recommended)

1. Create a new GitHub repo, push this folder (`git init && git add . && git commit -m init && git push`).
2. **Actions → "Render video" → Run workflow**. Options:
   * `profiles`: any of `1080p`, `4k`, `shorts` (comma separated, e.g. `1080p,4k,shorts`)
   * `tts_engine`: `kokoro` (offline, default, very reliable) or `edge` (Microsoft neural voices)
   * `voice`: e.g. Kokoro `af_heart` (default) / `am_michael` / `bf_emma` / `bm_george`; Edge `en-US-AndrewMultilingualNeural`, `en-IN-PrabhatNeural`
   * `publish_release`: also attach files to a Release (GitHub limit: 2 GB per file — 4K may exceed it; use the artifact instead)
3. When it finishes, download the **FINAL-1080p / FINAL-4k / FINAL-shorts** artifacts. Each contains
   `Beta_Pictoris_*.mp4` (H.264 + AAC 320 kbps + soft English subtitles), `.srt`, `.audio.m4a`, `.audio.mp3`, `.audio.master.wav` (24-bit 48 kHz), and `youtube_chapters.txt`.

Rendering uses software WebGL (SwiftShader) on standard runners, so the work is split into chunks and run in parallel
(1080p ≈ 16 jobs, 4K ≈ 40 jobs, Shorts ≈ 2 jobs). On a **public repo** this is free; on a private repo it consumes Actions minutes
(4K is the expensive one — about 40 jobs × ~30-60 min). Start with `shorts` or `1080p` to check the result.

## Render locally

```bash
npm ci                                   # three, puppeteer(+Chrome), fonts
pip install numpy scipy soundfile kokoro-onnx edge-tts   # + ffmpeg on PATH
python3 scripts/build_audio.py           # narration + score + master + SRT + timeline (≈3 min, downloads ~350 MB Kokoro model once)
./scripts/render_all.sh shorts           # or 1080p / 4k   (resumable; outputs dist/Beta_Pictoris_*.mp4)
node scripts/render.js --profile preview --stills 20,85,170,300   # quick PNG stills while editing a scene
```
Without a GPU, expect roughly 0.6 fps at 1080p and 0.15–0.2 fps at 4K per 2 CPU cores — that's why the cloud workflow is chunked.
Set `CHROME_PATH` to use an existing Chrome/Chromium.

## Customise

* **Channel name** on screen: `config.json` → `channelName`. **Voice/speed**: `config.json` → `voice`.
* **Narration**: edit `scripts/script_long.json`; re-run `build_audio.py`. Timeline, SRT, chapters, sound-design and animation cues all re-time automatically
  (the build stretches pauses to land on `target_seconds`; if your text is longer, the video is simply longer).
* **Visuals**: each scene is a pure function of time (`update(s)`), so renders are deterministic and chunkable. Labels appear when their `cue` is spoken.
* Want your own recorded voice? Replace the TTS step output (`build/tts_cache`) or edit `build_audio.py` to read your WAVs; everything else (timeline/SRT/mix) stays.

## Notes on accuracy
* The headline number varies by outlet (60 / 63 / 64 ly). The video says ~63 ly and mentions the rounding.
* The study is a **preprint** (arXiv:2609.16720, posted 15 Sep 2026), not yet peer reviewed — the video says so.
* Diagrams are explanatory: sizes/distances are not to scale; the dynamic-spectrum plot is a *synthetic illustration* (labelled), and the
  orbit of planet c / "7 more planets in 5 systems" layout is illustrative. Jupiter's field is given as a range (≈4–14 G) because sources differ.
* YouTube: disclose "synthetic voice / generated visuals" in the upload form if prompted.

## Sources
* ZME Science — Astronomers Detected a Radio Signal Coming Directly From an Exoplanet for the First Time (22 Sep 2026) — https://www.zmescience.com/space/astronomers-detected-a-radio-signal-coming-directly-from-an-exoplanet-for-the-first-time/
* Ortiz Ceballos et al., *Discovery of radio emission from the exoplanet β Pictoris b* (arXiv:2609.16720, preprint) — https://arxiv.org/abs/2609.16720
* Phys.org — Astronomers detect radio signals coming from an exoplanet for the first time — https://phys.org/news/2026-09-astronomers-radio-exoplanet.html
* Techlicious — Astronomers detect radio signals from a planet 64 light-years away — https://www.techlicious.com/blog/first-radio-signal-exoplanet-beta-pictoris-b/
* Discover Magazine — Radio Emission Detected from Massive Exoplanet… — https://www.discovermagazine.com/radio-emission-detected-from-massive-exoplanet-reveals-a-magnetic-field-far-stronger-than-earth-s-49766
* NewsNation — Radio waves detected on faraway planet — from aliens? (Avi Loeb) — https://www.newsnationnow.com/space/radio-waves-faraway-planet-avi-loeb/
* CTV News — Colossal magnetic field or aliens? — https://www.ctvnews.ca/video/2026/10/02/colossal-magnetic-field-or-aliens-astronomers-detect-radio-signal-in-space-over-60-light-years-away/

Tech: [three.js](https://threejs.org) (MIT), [Puppeteer](https://pptr.dev), [Kokoro-82M](https://github.com/thewh1teagle/kokoro-onnx) (Apache-2.0), ffmpeg, Inter & Space Grotesk fonts (OFL).
