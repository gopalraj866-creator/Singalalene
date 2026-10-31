// Deterministic, time-driven render stage. window.__frame(t) renders the video frame for time t (seconds).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { fitFov, clamp, smooth } from './lib.js';
import { SCENES } from './scenes/index.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1920, H = +q.get('h') || 1080, DSF = +q.get('dsf') || 1;
const portrait = H > W;
const TLKIND = q.get('timeline') || (portrait ? 'short' : 'long');
const CAPTIONS = q.has('captions') ? q.get('captions') === '1' : TLKIND === 'short';
const MSAA = q.has('msaa') ? +q.get('msaa') : 4;
const U = portrait ? W / 1080 : H / 1080;
document.documentElement.style.setProperty('--u', U + 'px');
document.body.classList.toggle('portrait', portrait);

const stage = document.getElementById('stage');
stage.style.width = W + 'px'; stage.style.height = H + 'px';
const gl = document.getElementById('gl');
const ov = document.getElementById('ov'); ov.width = W * DSF; ov.height = H * DSF;
const og = ov.getContext('2d');
const labelsEl = document.getElementById('labels');
const fadeEl = document.getElementById('fade');
const capEl = document.getElementById('caption');
const brandEl = document.getElementById('brand');

const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(DSF); renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
gl.style.width = W + 'px'; gl.style.height = H + 'px';

const rt = new THREE.WebGLRenderTarget(W * DSF, H * DSF, { type: THREE.HalfFloatType, samples: MSAA });
const composer = new EffectComposer(renderer, rt);
composer.setPixelRatio(DSF); composer.setSize(W, H);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.8, 0.6, 0.2);
composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(new OutputPass());

const [TL, CFG] = await Promise.all([
  fetch(`/build/timeline_${TLKIND}.json`).then((r) => r.json()),
  fetch('/config.json').then((r) => r.json()).catch(() => ({})),
]);
brandEl.textContent = CFG.channelName || '';
await document.fonts.load('800 40px Inter'); await document.fonts.load('600 40px Inter'); await document.fonts.load('700 40px "Space Grotesk"');
await document.fonts.ready;

const aspect = W / H;
const baseCtx = { THREE, W, H, aspect, portrait, U, px: DSF * U, k: portrait ? 1.6 : 1, fov: (b) => fitFov(b, aspect), cfg: CFG };

const built = new Map();
function ensure(sc) {
  if (built.has(sc.id)) return built.get(sc.id);
  const make = SCENES[sc.id];
  if (!make) throw new Error('No scene module for id ' + sc.id);
  const inst = make({ ...baseCtx, bursts: sc.bursts || [], duration: sc.end - sc.start });
  inst.els = {};
  for (const [key, spec] of Object.entries(inst.labels || {})) {
    const el = document.createElement('div');
    el.className = `lbl ${spec.cls || 'p-c'} ${spec.tone || ''} ${spec.chip ? 'chip' : ''} a-${spec.anchor || 'r'}`;
    el.innerHTML = spec.html; el.style.display = 'none'; if (spec.style) el.style.cssText += spec.style;
    if (spec.world) el.style.transform = 'translate(var(--ax), var(--ay))';
    labelsEl.appendChild(el); inst.els[key] = el;
  }
  built.set(sc.id, inst);
  return inst;
}

let lastActive = null;
const v3 = new THREE.Vector3();

function makeState(sc, t) {
  const lt = t - sc.start, D = sc.end - sc.start;
  const cues = sc.cues || {};
  return {
    t: lt, D, u: clamp(lt / D), abs: t,
    cue: (n) => (cues[n] ? lt - cues[n].start : -1e9),
    cueP: (n, dur = 1) => (cues[n] ? clamp((lt - cues[n].start) / dur) : 0),
    active: (n) => !!cues[n] && lt >= cues[n].start && lt <= cues[n].end + 0.4,
    at: (n, fb = null) => (cues[n] ? cues[n].start : fb),
    endAt: (n, fb = null) => (cues[n] ? cues[n].end : fb),
    seg: (i) => sc.segs[i],
    bursts: sc.bursts || [],
  };
}

function updateLabels(sc, inst, s) {
  const lt = s.t, D = s.D;
  for (const [key, spec] of Object.entries(inst.labels || {})) {
    const el = inst.els[key]; const cn = Array.isArray(spec.cue) ? spec.cue.find((n) => (sc.cues || {})[n]) : (spec.cue || key); const c = (sc.cues || {})[cn];
    if (!c) { el.style.display = 'none'; continue; }
    const t0 = c.start - (spec.pre ?? 0.05), t1 = spec.sticky ? D - 0.5 : (spec.until && (sc.cues || {})[spec.until] ? sc.cues[spec.until].end : c.end) + (spec.post ?? 0.5);
    const fi = smooth(t0, t0 + 0.45, lt), fo = 1 - smooth(t1 - 0.4, t1, lt);
    const a = Math.min(fi, fo);
    if (a <= 0.003) { el.style.display = 'none'; continue; }
    el.style.display = 'block'; el.style.opacity = a.toFixed(3);
    if (spec.world) {
      const wp = typeof spec.world === 'function' ? spec.world(s) : spec.world;
      v3.copy(wp).project(inst.camera);
      if (v3.z > 1 || v3.z < -1) { el.style.display = 'none'; continue; }
      const x = (v3.x * 0.5 + 0.5) * W + (spec.dx || 0) * U, y = (-v3.y * 0.5 + 0.5) * H + (spec.dy || 0) * U;
      el.style.left = x.toFixed(1) + 'px'; el.style.top = y.toFixed(1) + 'px';
    }
    el.style.translate = `0 ${((1 - fi) * 18 * U).toFixed(2)}px`;
  }
}

function updateCaption(sc, lt) {
  if (!CAPTIONS) { capEl.textContent = ''; return; }
  const seg = (sc.segs || []).find((g) => lt >= g.start - 0.05 && lt <= g.end + 0.15);
  if (!seg) { capEl.textContent = ''; return; }
  const words = seg.text.split(/\s+/); const n = TLKIND === 'short' ? 4 : 11;
  const chunks = []; for (let i = 0; i < words.length; i += n) chunks.push(words.slice(i, i + n));
  const lens = chunks.map((c) => c.join(' ').length); const tot = lens.reduce((a, b) => a + b, 0);
  let acc = seg.start, idx = chunks.length - 1;
  for (let i = 0; i < chunks.length; i++) { const dur = (seg.end - seg.start) * (lens[i] / tot); if (lt < acc + dur) { idx = i; break; } acc += dur; }
  capEl.textContent = chunks[idx].join(' ');
}

window.__duration = TL.total;
window.__info = { W, H, DSF, TLKIND, total: TL.total };

window.__frame = (t) => {
  t = clamp(t, 0, TL.total - 1e-4);
  const sc = TL.scenes.find((x) => t >= x.start && t < x.end) || TL.scenes[TL.scenes.length - 1];
  const inst = ensure(sc);
  if (lastActive && lastActive !== inst) for (const el of Object.values(lastActive.els)) el.style.display = 'none';
  lastActive = inst;
  const s = makeState(sc, t);
  inst.update(s);
  renderPass.scene = inst.scene; renderPass.camera = inst.camera;
  const post = inst.post || {};
  bloom.strength = post.bloom ?? 0.8; bloom.radius = post.radius ?? 0.6; bloom.threshold = post.threshold ?? 0.2;
  renderer.toneMappingExposure = post.exposure ?? 1;
  inst.camera.aspect = aspect; inst.camera.updateProjectionMatrix();
  composer.render();
  ov.width = W * DSF; og.setTransform(DSF, 0, 0, DSF, 0, 0);
  if (inst.overlay) inst.overlay(og, { W, H, U, portrait }, s);
  og.setTransform(1, 0, 0, 1, 0, 0); og.fillStyle = `rgba(0,0,0,${(0.004 + (Math.round(t * 1000) % 2) * 0.002).toFixed(3)})`; og.fillRect(0, 0, 2, 2); // forces the compositor to repaint this canvas layer (avoids stale overlay textures)
  updateLabels(sc, inst, s); updateCaption(sc, s.t);
  const idx = TL.scenes.indexOf(sc);
  const fin = idx === 0 ? 1.2 : 0.55, fout = idx === TL.scenes.length - 1 ? 1.6 : 0.55;
  fadeEl.style.opacity = Math.max(1 - smooth(0, fin, s.t), smooth(s.D - fout, s.D, s.t)).toFixed(3);
  return true;
};
window.__ready = true;
