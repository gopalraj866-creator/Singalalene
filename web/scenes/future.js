// FUTURE: why it matters, failed earlier searches, and 7 more giant planets in 5 nearby systems.
import * as THREE from 'three';
import { makeStars, glow, rng, clamp, smooth, lerp, easeOut, lineMat } from '../lib.js';

export default function create(ctx) {
  const k = ctx.k, portrait = ctx.portrait;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ctx.fov(44), ctx.aspect, 0.1, 1000);
  const bg = makeStars({ n: 5000, rMin: 120, rMax: 300, seed: 111, size: [1.2, 3.2] }); scene.add(bg);
  const r = rng(6);
  // Beta Pictoris at the centre, 5 other systems around it
  const systems = [{ p: new THREE.Vector3(0, 0, 0), n: 1, hero: true }];
  const dirs = [[-9, 3, -4], [8, 4, -6], [-6, -4, 5], [10, -3, 4], [1, 6, 9]];
  const counts = [2, 1, 2, 1, 1]; // + Beta Pic b makes the seven planets listed in the paper's follow-up targets (illustrative layout)
  dirs.forEach((d, i) => systems.push({ p: new THREE.Vector3(d[0] * (portrait ? 0.7 : 1), d[1], d[2]), n: counts[i] }));
  const G = new THREE.Group(); scene.add(G);
  const planets = [], rings = [];
  systems.forEach((S, i) => {
    const st = glow(S.hero ? 0xdff0ff : 0xcfe0ff, S.hero ? 3.2 : 2.4, 1); st.position.copy(S.p); G.add(st);
    const core = glow(0xffffff, S.hero ? 0.8 : 0.5, 1); core.position.copy(S.p); G.add(core);
    for (let j = 0; j < S.n; j++) {
      const orb = 0.9 + j * 0.55 + r() * 0.2; const ring = new THREE.Mesh(new THREE.RingGeometry(orb - 0.012, orb + 0.012, 96), new THREE.MeshBasicMaterial({ color: 0x6fdcff, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.position.copy(S.p); ring.rotation.x = Math.PI / 2 + (r() - 0.5) * 0.5; G.add(ring);
      const pdot = glow(S.hero ? 0xffa060 : 0x9fd8ff, 0.45, 0); G.add(pdot); planets.push({ S, orb, ph: r() * 6.28, sp: 0.4 + r() * 0.3, dot: pdot, ring, idx: planets.length, hero: !!S.hero });
    }
  });
  const ping = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), new THREE.MeshBasicMaterial({ color: 0xff5fd2, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); G.add(ping);
  const cam = new THREE.Vector3();

  const rowsLong = [['2022', 'Very Large Array pilot · 8 directly imaged planets', 'nothing heard', false], ['2024', 'Beta Pictoris b · lower frequencies (250–500 MHz)', 'nothing heard', false], ['2026', 'MeerKAT · Beta Pictoris b', 'detected ✓', true]];
  return {
    scene, camera, post: { bloom: 0.9, threshold: 0.5 },
    labels: {
      matters: { cls: 'p-lt', html: '<div class="k">Why it matters</div><div class="v">Magnetic fields shape atmospheres</div><div class="s">and carry clues about a planet’s deep interior</div>' },
      nodirect: { cls: 'p-lt', tone: 'am', html: '<div class="k">Until now</div><div class="v">No direct way to measure them</div><div class="s">around other stars</div>' },
      heavy: { cls: 'p-lt', tone: 'mg', html: '<div class="k">Why this time?</div><div class="v">A magnetic heavyweight</div><div class="s">may have succeeded where others failed</div>' },
      seven: { cls: 'p-lt', tone: 'gr', html: '<div class="k">Next targets</div><div class="v">7 more giant planets · 5 systems</div><div class="s">needs telescopes ≈ 5–7× more sensitive</div>', sticky: false, post: 1.5 },
      caveat: { cls: 'p-lt chip am', tone: 'am', html: '<div class="k">Remember</div><div class="note">One preprint. <b>Peer review</b> and <b>follow-up observations</b> will put it to the test.</div>', sticky: true },
    },
    update(s) {
      const t = s.t, D = s.D;
      bg.userData.mat.uniforms.uPx.value = ctx.px; bg.userData.mat.uniforms.uTime.value = t;
      const th = s.at('history', D * 0.4), ts = s.at('seven', D * 0.7);
      const showSeven = smooth(ts - 0.5, ts + 1.0, t);
      planets.forEach((p) => {
        const a = p.hero ? 1 : smooth(ts + p.idx * 0.45, ts + p.idx * 0.45 + 0.8, t);
        const ang = p.ph + t * p.sp; const pos = p.S.p.clone().add(new THREE.Vector3(Math.cos(ang) * p.orb, 0, Math.sin(ang) * p.orb));
        const ringRot = p.ring.rotation.x; const e = new THREE.Euler(ringRot - Math.PI / 2, 0, 0); pos.sub(p.S.p).applyEuler(e).add(p.S.p);
        p.dot.position.copy(pos); p.dot.material.opacity = (p.hero ? 1 : a) * (0.6 + 0.4 * Math.sin(t * 3 + p.idx)); p.ring.material.opacity = 0.5 * (p.hero ? smooth(0, 2, t) : a);
      });
      ping.material.opacity = 0;
      G.rotation.y = t * 0.05 - 0.4; G.rotation.x = 0.25;
      const zoom = lerp(9.5, 15, showSeven) * k * (portrait ? 1.1 : 1) ; const hz = lerp(5 * k, 0, smooth(0, 3, t)) ;
      cam.set(0, 4, zoom + hz); camera.position.copy(cam); camera.lookAt(0, 0, 0);
    },
    overlay(g, { W, H, U, portrait: pt }, s) {
      const th = s.at('history'); if (th === null) return; const D = s.D;
      const a = smooth(th - 0.1, th + 0.6, s.t) * (1 - smooth(s.at('heavy', D) - 0.5, s.at('heavy', D) + 0.4, s.t)); if (a < 0.01) return;
      const x0 = pt ? 54 * U : 90 * U, w = pt ? W - 108 * U : W * 0.6, y0 = pt ? H * 0.46 : H * 0.28, rowH = (pt ? 150 : 128) * U;
      g.save(); g.fillStyle = '#8fa6c4'; g.font = `600 ${22 * U}px "Space Grotesk"`; g.textAlign = 'left'; g.globalAlpha = a; g.fillText('EARLIER RADIO SEARCHES', x0, y0 - 36 * U);
      rowsLong.forEach(([yr, what, res, ok], i) => {
        const ra = smooth(th + 0.3 + i * 3.2, th + 1.0 + i * 3.2, s.t); if (ra <= 0) return; const y = y0 + i * rowH; g.globalAlpha = a * ra;
        g.fillStyle = 'rgba(3,8,22,.7)'; g.strokeStyle = ok ? 'rgba(125,255,176,.6)' : 'rgba(255,191,90,.45)'; g.lineWidth = 2 * U; g.beginPath(); g.roundRect(x0, y, w, rowH - 18 * U, 14 * U); g.fill(); g.stroke();
        g.fillStyle = ok ? '#7dffb0' : '#ffbf5a'; g.font = `700 ${46 * U}px "Space Grotesk"`; g.fillText(yr, x0 + 24 * U, y + 62 * U);
        g.fillStyle = '#eaf4ff'; g.font = `500 ${(pt ? 24 : 27) * U}px Inter`; g.fillText(what, x0 + 170 * U, y + 50 * U); g.fillStyle = ok ? '#7dffb0' : '#8fa6c4'; g.font = `600 ${24 * U}px "Space Grotesk"`; g.fillText(res.toUpperCase(), x0 + 170 * U, y + 84 * U);
      });
      g.restore();
    },
  };
}
