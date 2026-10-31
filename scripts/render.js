#!/usr/bin/env node
// Frame-accurate WebGL renderer: drives web/index.html in headless Chromium, captures each frame and pipes it to ffmpeg.
//
//   node scripts/render.js --profile 1080p                       # whole video (video only, no audio)
//   node scripts/render.js --profile 4k --start 0 --end 600      # one chunk (used by the GitHub Actions matrix)
//   node scripts/render.js --profile preview --stills 5,60,200   # PNG stills for quick visual checks
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { startServer } from './server.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PROFILES = {
  preview:       { w: 960,  h: 540,  dsf: 1, timeline: 'long',  fps: 15, crf: 22, preset: 'veryfast', msaa: 2 },
  'preview-short': { w: 540, h: 960, dsf: 1, timeline: 'short', fps: 15, crf: 22, preset: 'veryfast' },
  '1080p':       { w: 1920, h: 1080, dsf: 1, timeline: 'long',  fps: 30, crf: 14, preset: 'medium' },
  '4k':          { w: 1920, h: 1080, dsf: 2, timeline: 'long',  fps: 30, crf: 13, preset: 'medium', msaa: 2 },
  shorts:        { w: 1080, h: 1920, dsf: 1, timeline: 'short', fps: 30, crf: 14, preset: 'medium' },
};

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v === undefined || v.startsWith('--') ? true : v;
}

const profileName = arg('profile', '1080p');
const P = { ...(PROFILES[profileName] || (() => { throw new Error('unknown profile ' + profileName); })()) };
if (arg('fps')) P.fps = +arg('fps');
if (arg('msaa') !== undefined) P.msaa = +arg('msaa');
const outPath = arg('out', path.join(ROOT, 'build', `video_${profileName}.mp4`));
const stills = arg('stills', null);
const jpeg = arg('jpeg', false) === true;
const captions = arg('captions', null);

const tlFile = path.join(ROOT, 'build', `timeline_${P.timeline}.json`);
if (!fs.existsSync(tlFile)) { console.error(`Missing ${tlFile}. Run: python3 scripts/build_audio.py first.`); process.exit(1); }
const TL = JSON.parse(fs.readFileSync(tlFile, 'utf8'));
const totalFrames = Math.round(TL.total * P.fps);
const start = +arg('start', 0), end = Math.min(+arg('end', totalFrames), totalFrames);

const { server, port } = await startServer(0);
const launchArgs = [
  '--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-vsync', '--hide-scrollbars', '--force-color-profile=srgb',
  '--disable-dev-shm-usage', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
];
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || undefined, args: launchArgs, protocolTimeout: 600000 });
const page = await browser.newPage();
await page.setViewport({ width: P.w, height: P.h, deviceScaleFactor: P.dsf });
page.on('pageerror', (e) => console.error('[page error]', e.message));
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) console.error(`[page ${m.type()}]`, m.text()); });
let url = `http://127.0.0.1:${port}/web/index.html?w=${P.w}&h=${P.h}&dsf=${P.dsf}&timeline=${P.timeline}` + (P.msaa !== undefined ? `&msaa=${P.msaa}` : '');
if (captions !== null) url += `&captions=${captions === '0' ? 0 : 1}`;
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction('window.__ready === true', { timeout: 120000 });
const shot = async () => page.screenshot(jpeg ? { type: 'jpeg', quality: 96 } : { type: 'png', optimizeForSpeed: true });
const frameAt = async (t) => { await page.evaluate((tt) => window.__frame(tt), t); };

if (stills) {
  const dir = arg('outdir', path.join(ROOT, 'build', 'stills')); fs.mkdirSync(dir, { recursive: true });
  for (const s of String(stills).split(',')) {
    const t = parseFloat(s); const t0 = Date.now();
    await frameAt(t); fs.writeFileSync(path.join(dir, `${profileName}_${String(t).padStart(7, '0')}.png`), await shot());
    console.log(`still t=${t}s  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
  await browser.close(); server.close(); process.exit(0);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
const gop = P.fps * 2;
const ff = spawn('ffmpeg', [
  '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(P.fps), '-c:v', jpeg ? 'mjpeg' : 'png', '-i', '-',
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p',
  '-c:v', 'libx264', '-preset', P.preset, '-crf', String(P.crf), '-profile:v', 'high', '-g', String(gop), '-bf', '2',
  '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-an', outPath,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = new Promise((res, rej) => { ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))); ff.on('error', rej); });

const t0 = Date.now();
console.log(`[render] profile=${profileName} ${P.w * P.dsf}x${P.h * P.dsf}@${P.fps} frames ${start}..${end} of ${totalFrames} (${TL.total.toFixed(1)}s)`);
for (let f = start; f < end; f++) {
  await frameAt(f / P.fps);
  const buf = await shot();
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  const n = f - start + 1;
  if (n % 25 === 0 || f === end - 1) {
    const el = (Date.now() - t0) / 1000, fps = n / el, eta = (end - f - 1) / fps;
    console.log(`[render] ${n}/${end - start}  ${fps.toFixed(2)} fps  elapsed ${el.toFixed(0)}s  eta ${eta.toFixed(0)}s`);
  }
}
ff.stdin.end();
await ffDone;
await browser.close(); server.close();
console.log(`[render] done -> ${outPath}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
