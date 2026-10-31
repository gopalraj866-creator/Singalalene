// NOT ALIENS: narrowband (technology-like) vs broadband (what we saw); circular polarization helix; theory match; Loeb quote.
import * as THREE from 'three';
import { makeStars, glow, pointsMat, lineMat, rng, clamp, smooth, lerp, easeOut } from '../lib.js';

export default function create(ctx) {
  const k = ctx.k, portrait = ctx.portrait;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ctx.fov(40), ctx.aspect, 0.05, 1000);
  const bg = makeStars({ n: 4500, rMin: 200, rMax: 420, seed: 101, size: [1.2, 3] }); scene.add(bg);

  // circularly polarised wave: a corkscrew travelling along +x
  const HN = 700; const hgeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(HN * 3), 3));
  const hmat = pointsMat(0xff7fe6, 4.0, 1); const helix = new THREE.Points(hgeo, hmat); helix.frustumCulled = false; scene.add(helix);
  const hl = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(HN * 3), 3)), lineMat(0xff5fd2, 0.8)); hl.frustumCulled = false; scene.add(hl);
  // straight (linear) wave for contrast
  const lgeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(HN * 3), 3));
  const ll = new THREE.Line(lgeo, lineMat(0x6fdcff, 0.0)); ll.frustumCulled = false; scene.add(ll);
  const src = glow(0xff9a5a, 3.4, 0.9); src.position.set(-9, 0, 0); scene.add(src);
  const earthDot = glow(0x6fb4ff, 2.2, 0.9); earthDot.position.set(9, 0, 0); scene.add(earthDot);
  const rr = rng(2); const noise = Array.from({ length: 512 }, () => rr());
  const cam = new THREE.Vector3();

  return {
    scene, camera, post: { bloom: 1.0, threshold: 0.5, radius: 0.7 },
    labels: {
      why: { cls: 'p-c', html: '<div class="kicker">The big question</div><div class="big">WHY NOT <em>ALIENS?</em></div>' },
      broad: { cls: 'ck1', tone: 'gr', html: '<div class="check"><i>✓</i>Broadband</div><div class="s" style="margin-left:calc(var(--u)*54)">spread across many frequencies</div>', sticky: true },
      polar: { cls: 'ck2', tone: 'gr', html: '<div class="check"><i>✓</i>Circularly polarized</div><div class="s" style="margin-left:calc(var(--u)*54)">waves corkscrew through space</div>', sticky: true },
      theory: { cls: 'ck3', tone: 'gr', html: '<div class="check"><i>✓</i>Field matches theory</div><div class="s" style="margin-left:calc(var(--u)*54)">for young, massive giant planets</div>', sticky: true },
      loeb: { cls: 'p-lt chip', html: '<div class="quote">“Most likely natural — like Earth’s northern lights.”<span class="by">Avi Loeb · Harvard physicist · paraphrased</span></div>', post: 0.4 },
      amazing: { cls: 'p-c', html: '<div class="kicker">And yet</div><div class="big sm">A PLANET IS <span class="cy">SHOUTING</span><br>ACROSS 63 LIGHT-YEARS</div>', sticky: true },
      cta: { cls: 'p-bc', html: '<div class="big sm" style="color:var(--am)">FOLLOW FOR MORE SPACE NEWS</div>', sticky: true },
    },
    update(s) {
      const t = s.t, D = s.D;
      bg.userData.mat.uniforms.uPx.value = ctx.px; bg.userData.mat.uniforms.uTime.value = t; hmat.uniforms.uPx.value = ctx.px;
      const tp = s.at('polar', D * 0.5), tb = s.at('broad', D * 0.3), ta = s.at('amazing', D * 0.9);
      const hv = smooth(tp - 0.3, tp + 1.0, t) * (1 - smooth(ta - 0.6, ta, t));
      const ga = new Float32Array(0);
      const hp = hgeo.attributes.position, hlp = hl.geometry.attributes.position, lp = lgeo.attributes.position;
      for (let i = 0; i < HN; i++) { const f = i / (HN - 1); const x = lerp(-9, 9, f); const amp = 1.25 * Math.sin(f * Math.PI) ** 0.7; const ph = f * 54 - t * 5;
        hp.setXYZ(i, x, Math.cos(ph) * amp, Math.sin(ph) * amp); hlp.setXYZ(i, x, Math.cos(ph) * amp, Math.sin(ph) * amp); lp.setXYZ(i, x, Math.cos(ph) * amp, 0); }
      hp.needsUpdate = hlp.needsUpdate = lp.needsUpdate = true;
      hmat.uniforms.uOp.value = hv; hl.material.opacity = 0.8 * hv; ll.material.opacity = 0.5 * smooth(tp + 3, tp + 4, t) * hv;
      src.material.opacity = 0.5 + 0.4 * Math.sin(t * 3); earthDot.material.opacity = 0.8;
      const az = 0.55 + t * 0.04; const dist = (portrait ? 28 : 19) * k; cam.set(Math.sin(az) * dist * 0.6 - 2, 3.4, Math.cos(az) * dist); camera.position.copy(cam); camera.lookAt(portrait ? 0 : 1.5, portrait ? -1.5 : 0, 0);
    },
    overlay(g, { W, H, U, portrait: pt }, s) {
      const tb = s.at('broad'); if (tb === null) return;
      const a = smooth(tb + 0.3, tb + 1.1, s.t) * (1 - smooth(s.at('amazing', 1e9) - 0.6, s.at('amazing', 1e9), s.t)); if (a < 0.01) return;
      const pw = pt ? W - 108 * U : W * 0.34, ph = (pt ? 250 : 215) * U, x0 = pt ? 54 * U : W - 90 * U - pw;
      const y1 = pt ? H * 0.5 : H * 0.2, y2 = y1 + ph + (pt ? 70 : 90) * U;
      const draw = (y, title, col, spec) => {
        g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(3,8,22,.72)'; g.strokeStyle = col; g.lineWidth = 2 * U; g.beginPath(); g.roundRect(x0, y, pw, ph, 14 * U); g.fill(); g.stroke();
        g.fillStyle = col; g.font = `600 ${21 * U}px "Space Grotesk"`; g.textAlign = 'left'; g.fillText(title, x0 + 22 * U, y + 36 * U);
        const ix = x0 + 24 * U, iw = pw - 48 * U, base = y + ph - 38 * U, top = y + 66 * U;
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1.5 * U; g.beginPath(); g.moveTo(ix, base); g.lineTo(ix + iw, base); g.stroke();
        g.fillStyle = '#8fa6c4'; g.font = `600 ${17 * U}px "Space Grotesk"`; g.textAlign = 'center'; g.fillText('FREQUENCY →', ix + iw / 2, y + ph - 12 * U);
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2.5 * U; g.shadowColor = col; g.shadowBlur = 12 * U; spec(ix, iw, base, top); g.restore();
      };
      draw(y1, 'NARROWBAND · what alien-technology searches hunt for', '#6fdcff', (ix, iw, base, top) => { const x = ix + iw * (0.5 + 0.02 * Math.sin(s.t * 0.7)); g.beginPath(); g.moveTo(x, base); g.lineTo(x, top); g.stroke(); for (let i = 0; i < 90; i++) { const xx = ix + (i / 90) * iw; g.globalAlpha = a * 0.5; g.beginPath(); g.moveTo(xx, base); g.lineTo(xx, base - 5 * U * noise[i * 3 % 512]); g.stroke(); } });
      draw(y2, 'BROADBAND · what MeerKAT saw', '#ff5fd2', (ix, iw, base, top) => { g.beginPath(); for (let i = 0; i <= 160; i++) { const f = i / 160; const env = Math.exp(-Math.pow((f - 0.55) / 0.3, 2)); const v = (0.35 + 0.65 * env) * (0.65 + 0.35 * noise[(i * 5 + Math.floor(s.t * 8)) % 512]); const x = ix + f * iw, y = base - (base - top) * 0.75 * v; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); g.globalAlpha = a * 0.18; g.lineTo(ix + iw, base); g.lineTo(ix, base); g.fill(); });
    },
  };
}
