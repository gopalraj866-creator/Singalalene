// ENGINE: three candidate power sources for the bursts: stellar wind (x), Io-like moon (x), fast spin-driven currents (leading).
import * as THREE from 'three';
import { makeStars, gasGiantMaterial, atmosphereMaterial, auroraShells, fieldLines, glow, pointsMat, lineMat, rng, clamp, smooth, lerp } from '../lib.js';

export default function create(ctx) {
  const k = ctx.k, portrait = ctx.portrait;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ctx.fov(40), ctx.aspect, 0.05, 1000);
  const bg = makeStars({ n: 4000, rMin: 200, rMax: 400, seed: 91, size: [1.2, 3] }); scene.add(bg);
  const light = new THREE.Vector3(-1, 0.1, 0.2);
  const pl = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), gasGiantMaterial({ colA: [0.62, 0.34, 0.17], colB: [0.3, 0.12, 0.07], colC: [0.85, 0.62, 0.38], emit: 0.14, bands: 13, light })); pl.rotation.z = 0.3; scene.add(pl);
  pl.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), atmosphereMaterial(0xff9a5a, 3.2, 0.9)));
  const aur = auroraShells(new THREE.Color(1.0, 0.25, 0.85), { colat: 0.3, width: 0.1, strength: 1.5 }); pl.add(aur);
  const fl = fieldLines({ Ls: [1.8, 2.6, 3.6], nPhi: 10, color: 0x7fd8ff, opacity: 0.28 }); pl.add(fl);
  const sun = glow(0xcfe3ff, 14, 0.7); sun.position.set(-60, 8, -10); scene.add(sun);

  // stellar wind particles
  const N = 900, r = rng(3); const wp = Array.from({ length: N }, () => ({ y: (r() - 0.5) * 9, z: (r() - 0.5) * 9, x: -14 - r() * 28, v: 6 + r() * 4 }));
  const wgeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const wmat = pointsMat(0xbfe0ff, 2.6, 0); const wind = new THREE.Points(wgeo, wmat); wind.frustumCulled = false; scene.add(wind);
  // moon + flux tube
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.17, 32, 24), new THREE.MeshBasicMaterial({ color: 0xcfd6e0 })); scene.add(moon);
  const tube = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), lineMat(0xffd27a, 0)); scene.add(tube);
  const moonGlow = glow(0xffd27a, 0.5, 0); scene.add(moonGlow);
  // spin currents: rings flowing along field lines (animated dashes via points)
  const cur = pointsMat(0xff7fe6, 3.2, 0); const NC = 360; const cgeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(NC * 3), 3)); const cpts = new THREE.Points(cgeo, cur); cpts.frustumCulled = false; pl.add(cpts);
  const cr = rng(8); const cd = Array.from({ length: NC }, () => ({ lat: 0.22 + cr() * 0.3, ph: cr() * 6.283, s: cr() }));
  const arr = []; // spin arrows (ring)
  const spinRing = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.012, 8, 128), new THREE.MeshBasicMaterial({ color: 0xff7fe6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); spinRing.rotation.x = Math.PI / 2; pl.add(spinRing);

  const tgt = new THREE.Vector3(), cam = new THREE.Vector3();
  return {
    scene, camera, post: { bloom: 0.95, threshold: 0.5, radius: 0.7 },
    labels: {
      intro: { cls: 'p-tc', html: '<div class="kicker">What powers the bursts?</div><div class="big sm">THREE SUSPECTS</div>' },
      wind: { cls: 'p-lt', tone: 'am', html: '<div class="k">Suspect 1 · stellar wind</div><div class="v">✗ ≈ 1,000× too weak</div>' },
      moon: { cls: 'p-lt', tone: 'am', html: '<div class="k">Suspect 2 · an Io-like moon</div><div class="v">✗ &gt;10× too weak</div>' },
      spin: { cls: 'p-lt', tone: 'gr', html: '<div class="k">Leading idea · fast spin</div><div class="v">✓ currents between magnetosphere &amp; atmosphere</div>', sticky: true },
      hint: { cls: 'p-tc', html: '<div class="big sm"><span class="cy">BURST 1</span> → <span class="mg">BURST 3</span><br><em>≈ 8 HOURS APART</em></div><div class="s" style="text-align:center">close to the planet’s rotation period · a hint, not proof</div>' },
    },
    update(s) {
      const t = s.t, D = s.D;
      bg.userData.mat.uniforms.uPx.value = ctx.px; bg.userData.mat.uniforms.uTime.value = t;
      [wmat, cur].forEach((m) => (m.uniforms.uPx.value = ctx.px));
      pl.material.uniforms.uTime.value = t; aur.userData.mats.forEach((m) => (m.uniforms.uTime.value = t));
      const tw = s.at('wind', D * 0.2), tm = s.at('moon', D * 0.4), ts = s.at('spin', D * 0.6), th = s.at('hint', D * 0.8);
      const flare = ctx.bursts.reduce((a, b) => a + (t >= b ? Math.exp(-(t - b) * 2.4) : 0), 0);
      const spinPow = smooth(ts, ts + 1.2, t);
      pl.rotation.y = t * (0.4 + 1.6 * spinPow);
      aur.userData.mats.forEach((m) => (m.uniforms.uAmt.value = 0.45 + 1.8 * flare * spinPow + 0.3 * smooth(ts, ts + 2, t)));
      // wind
      const wA = smooth(tw - 0.2, tw + 0.8, t) * (1 - smooth(tm - 0.5, tm + 0.3, t)); wmat.uniforms.uOp.value = wA;
      const wa = wgeo.attributes.position; wp.forEach((p, i) => { let x = p.x + ((t * p.v) % 44); let y = p.y, z = p.z; const rr = Math.hypot(x, y, z), R = 3.4; if (x > -R && x < R * 1.4 && Math.hypot(y, z) < R * 1.1) { const s2 = Math.hypot(y, z) || 0.01; const push = (R * 1.1) / s2; y *= push; z *= push; } wa.setXYZ(i, x, y, z); }); wa.needsUpdate = true;
      // moon
      const mA = smooth(tm - 0.2, tm + 0.8, t) * (1 - smooth(ts - 0.5, ts + 0.3, t)); const ma = t * 0.55;
      moon.position.set(Math.cos(ma) * 3.4, 0.4 * Math.sin(ma * 0.5), Math.sin(ma) * 3.4); moon.visible = mA > 0.01; moon.scale.setScalar(Math.max(mA, 0.001));
      moonGlow.position.copy(moon.position); moonGlow.material.opacity = 0.7 * mA;
      const tp = tube.geometry.attributes.position; tp.setXYZ(0, moon.position.x, moon.position.y, moon.position.z); tp.setXYZ(1, 0, 1.05, 0); tp.needsUpdate = true; tube.material.opacity = 0.7 * mA;
      // spin currents
      cur.uniforms.uOp.value = spinPow; spinRing.material.opacity = 0.5 * spinPow * (0.6 + 0.4 * Math.sin(t * 4));
      const ca = cgeo.attributes.position; cd.forEach((c, i) => { const f = (c.s + t * 0.5) % 1; const th = lerp(c.lat, Math.PI - c.lat, Math.abs(f * 2 - 1)); const L = 2.4; const rr = L * Math.sin(th) ** 2; ca.setXYZ(i, rr * Math.sin(th) * Math.cos(c.ph + t * 0.2), rr * Math.cos(th), rr * Math.sin(th) * Math.sin(c.ph + t * 0.2)); }); ca.needsUpdate = true;
      fl.children.forEach((l) => (l.material.opacity = 0.18 + 0.2 * spinPow));
      pl.scale.setScalar(1);
      const az = 0.9 + t * 0.045; const dist = (portrait ? 11 : 8.4) * k; cam.set(Math.sin(az) * dist, 1.2, Math.cos(az) * dist); camera.position.copy(cam);
      tgt.set(0, portrait ? -0.8 : 0, 0); camera.lookAt(tgt);
    },
    overlay(g, { W, H, U, portrait: pt }, s) {
      const th = s.at('hint'); if (th === null) return; const a = smooth(th + 0.5, th + 1.3, s.t); if (a < 0.01) return;
      const x0 = (pt ? 54 : 180) * U, x1 = W - (pt ? 54 : 180) * U, y = H - (pt ? 520 : 150) * U;
      g.save(); g.globalAlpha = a; g.strokeStyle = 'rgba(111,220,255,.4)'; g.lineWidth = 3 * U; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      const t0 = ctx.bursts[0] ?? 0, t2 = ctx.bursts[2] ?? 1; const span = Math.max(t2 - t0, 0.1);
      const xa = x0 + (x1 - x0) * 0.12, xb = x0 + (x1 - x0) * 0.88;
      const ticks = [[xa, 'BURST 1', ctx.bursts[0]], [lerp(xa, xb, 0.33), '', ctx.bursts[1]], [xb, 'BURST 3', ctx.bursts[2]]];
      ticks.forEach(([x, lab, bt]) => { const on = s.t >= bt ? Math.exp(-(s.t - bt) * 1.2) : 0; g.fillStyle = lab ? '#ff5fd2' : 'rgba(255,95,210,.55)'; g.shadowColor = '#ff5fd2'; g.shadowBlur = (10 + 30 * on) * U; g.beginPath(); g.arc(x, y, (9 + 8 * on) * U, 0, 7); g.fill(); g.shadowBlur = 0; if (lab) { g.fillStyle = '#eaf4ff'; g.font = `600 ${22 * U}px "Space Grotesk"`; g.textAlign = 'center'; g.fillText(lab, x, y + 44 * U); } });
      g.strokeStyle = '#ffbf5a'; g.lineWidth = 3 * U; g.beginPath(); g.moveTo(xa, y - 40 * U); g.lineTo(xa, y - 56 * U); g.lineTo(xb, y - 56 * U); g.lineTo(xb, y - 40 * U); g.stroke();
      g.fillStyle = '#ffbf5a'; g.font = `700 ${30 * U}px "Space Grotesk"`; g.textAlign = 'center'; g.fillText('≈ 8 hours', (xa + xb) / 2, y - 70 * U); g.restore();
    },
  };
}
