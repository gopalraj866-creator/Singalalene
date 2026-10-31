// SYSTEM: Beta Pictoris star, edge-on debris disk, orbits of c and b; then a close-up of planet b (mass, spin, magnetism).
import * as THREE from 'three';
import { makeStars, gasGiantMaterial, starSurface, atmosphereMaterial, auroraShells, fieldLines, glow, ringPoints, pointsMat, lineMat, clamp, smooth, lerp, easeInOut } from '../lib.js';

export default function create(ctx) {
  const k = ctx.k;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ctx.fov(40), ctx.aspect, 0.05, 1500);
  const bg = makeStars({ n: 4500, rMin: 300, rMax: 500, seed: 31, size: [1.3, 3.2] }); scene.add(bg);

  const star = new THREE.Mesh(new THREE.SphereGeometry(0.55, 64, 48), starSurface()); scene.add(star);
  const sg1 = glow(0xcfe4ff, 7, 0.9); scene.add(sg1); const sg2 = glow(0xffffff, 2.2, 1); scene.add(sg2);

  // debris disk
  const mk = (n, a, b, th, seed, col, size, op) => { const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ringPoints(n, a, b, th, seed), 3)); const m = pointsMat(col, size, op); const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return m; };
  const dmA = mk(14000, 14, 85, 1.6, 3, 0xffb07a, 1.5, 0.7), dmB = mk(9000, 20, 100, 1.2, 4, 0x9fd0ff, 1.3, 0.5), dmC = mk(3000, 6, 16, 0.6, 5, 0xfff0d0, 1.3, 0.45);

  const orbit = (R, col, op) => { const pts = []; for (let i = 0; i <= 200; i++) { const a = (i / 200) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R)); } const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(col, op)); scene.add(l); return l; };
  const orbB = orbit(10, 0xff9a5a, 0.55), orbC = orbit(2.7, 0x9fd0ff, 0.4), orbS = orbit(9.5, 0x6fdcff, 0.0);

  const light = new THREE.Vector3(1, 0, 0);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), gasGiantMaterial({ colA: [0.62, 0.34, 0.17], colB: [0.3, 0.12, 0.07], colC: [0.85, 0.62, 0.38], emit: 0.16, bands: 13, light })); scene.add(planet);
  const patm = new THREE.Mesh(new THREE.SphereGeometry(1.1, 64, 48), atmosphereMaterial(0xff9a5a, 3.2, 0.9)); planet.add(patm);
  const aur = auroraShells(new THREE.Color(1.0, 0.25, 0.85), { colat: 0.3, width: 0.1, strength: 1.3 }); aur.rotation.x = 0.25; planet.add(aur);
  const fl = fieldLines({ color: 0x7fd8ff, opacity: 0.4 }); fl.rotation.x = 0.25; planet.add(fl);
  const planetC = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 24), new THREE.MeshBasicMaterial({ color: 0x9fd0ff })); scene.add(planetC);
  const bmark = glow(0xffa060, 1.6, 0.9); scene.add(bmark);

  const pos = new THREE.Vector3(), starPos = new THREE.Vector3(), cam = new THREE.Vector3(), tgt = new THREE.Vector3();
  const ang = (t) => 0.6 + t * 0.2;
  const planetPos = (t, out) => out.set(Math.cos(ang(t)) * 10, 0, Math.sin(ang(t)) * 10);

  return {
    scene, camera, post: { bloom: 0.95, threshold: 0.5, radius: 0.7 },
    labels: {
      orbit: { cls: 'p-lt', html: '<div class="k">Orbit</div><div class="v">≈ 10 AU from its star</div><div class="s">roughly Saturn’s distance from our Sun (≈ 9.5 AU)</div>' },
      mass: { cls: 'p-tl', tone: 'mg', html: '<div class="k">Beta Pictoris b</div><div class="v">≈ 12 × Jupiter’s mass</div><div class="s">one orbit takes ≈ 24 years</div>' },
      spin: { cls: 'p-lt', tone: 'am', html: '<div class="k">Spin</div><div class="v">8–9 hours</div><div class="s">for one full rotation</div>' },
      secret: { cls: 'p-tc', html: '<div class="big sm">FAST SPIN <span class="cy">+</span> STRONG MAGNETISM<br><em>= RADIO TRANSMITTER</em></div>' },
      quiet: { cls: 'p-lt', tone: 'gr', html: '<div class="k">Host star</div><div class="v">Magnetically quiet</div><div class="s">so the planet’s radio whisper isn’t drowned out</div>' },
    },
    update(s) {
      const t = s.t, D = s.D;
      bg.userData.mat.uniforms.uPx.value = ctx.px; bg.userData.mat.uniforms.uTime.value = t;
      [dmA, dmB, dmC].forEach((m) => (m.uniforms.uPx.value = ctx.px));
      star.material.uniforms.uTime.value = t; planet.material.uniforms.uTime.value = t; aur.userData.mats.forEach((m) => (m.uniforms.uTime.value = t));
      starPos.set(0, 0, 0); sg1.scale.setScalar(7 + 0.5 * Math.sin(t * 1.3));
      planetPos(t, pos);
      const cA = ang(t) * 3.1; planetC.position.set(Math.cos(cA) * 2.7, 0, Math.sin(cA) * 2.7);
      orbS.material.opacity = 0.45 * smooth(s.at('orbit', 1) , s.at('orbit', 1) + 1.5, t) * (1 - smooth(s.at('mass', D) - 1, s.at('mass', D), t));
      const pr = 0.55; planet.scale.setScalar(pr);
      // planet rotates once per 8.5 s (time-lapse of an 8.5 h day), tilted
      planet.rotation.set(0.25, 0, 0); planet.rotation.y = (t / 8.5) * Math.PI * 2;
      light.copy(starPos).sub(pos).normalize(); planet.material.uniforms.uLight.value.copy(light);
      planet.position.copy(pos); bmark.position.copy(pos); bmark.scale.setScalar(2.2 * (1 - smooth(0, 1, closeUp(s))));
      const secret = smooth(s.at('secret', D * 0.7), s.at('secret', D * 0.7) + 1.2, t);
      fl.children.forEach((l) => (l.material.opacity = 0.42 * secret)); aur.userData.mats.forEach((m) => (m.uniforms.uAmt.value = 0.5 + 1.2 * secret));
      // camera
      const wideAz = 0.9 + t * 0.03, wideEl = lerp(0.1, 0.34, smooth(0, D * 0.35, t));
      const wide = cam.set(Math.sin(wideAz) * Math.cos(wideEl) * 42 * k, Math.sin(wideEl) * 42 * k, Math.cos(wideAz) * Math.cos(wideEl) * 42 * k).clone();
      const u = closeUp(s);
      const radial = pos.clone().normalize(); const tang = new THREE.Vector3(-radial.z, 0, radial.x);
      const dClose = lerp(4.6, 3.6, smooth(0, 1, (t - s.at('mass', 0)) / 12)) * k;
      const close = pos.clone().addScaledVector(radial, dClose * 0.55).addScaledVector(tang, -dClose * 0.8).add(new THREE.Vector3(0, dClose * 0.18, 0));
      const quiet = smooth(s.at('quiet', D * 0.88) - 0.6, s.at('quiet', D * 0.88) + 1.6, t);
      const farBack = new THREE.Vector3(Math.sin(wideAz + 1) * 30 * k, 6 * k, Math.cos(wideAz + 1) * 30 * k);
      cam.copy(wide).lerp(close, easeInOut(u)).lerp(farBack, quiet);
      camera.position.copy(cam);
      tgt.copy(starPos).lerp(pos, easeInOut(u)).lerp(starPos, quiet);
      camera.lookAt(tgt);
    },
    overlay(g, { W, H, U, portrait }, s) {
      const t = s.t;
      // 12 Jupiter masses strip
      const c0 = s.at('mass'); if (c0 !== null) {
        const a = smooth(c0 + 0.6, c0 + 1.4, t) * (1 - smooth(c0 + 11, c0 + 12, t)); if (a > 0.01) {
          const n = 12, r = (portrait ? 30 : 26) * U, gap = r * 2.5, x0 = portrait ? W / 2 - (n - 1) * gap / 2 : W - 90 * U - (n - 1) * gap, y = portrait ? 480 * U : 170 * U;
          g.save(); g.globalAlpha = a;
          for (let i = 0; i < n; i++) {
            const on = smooth(c0 + 1.0 + i * 0.12, c0 + 1.3 + i * 0.12, t); const x = (portrait ? x0 : x0) + i * (portrait ? gap * 0.78 : gap);
            const xx = portrait ? W / 2 - (n - 1) * gap * 0.78 / 2 + i * gap * 0.78 : x;
            g.globalAlpha = a * on; g.fillStyle = i === 0 ? '#ffd9a0' : '#ff9a5a'; g.shadowColor = '#ff9a5a'; g.shadowBlur = 14 * U; g.beginPath(); g.arc(xx, y, r * 0.5 * (portrait ? 0.9 : 1), 0, 7); g.fill();
          }
          g.shadowBlur = 0; g.globalAlpha = a; g.fillStyle = '#8fa6c4'; g.font = `600 ${22 * U}px "Space Grotesk"`; g.textAlign = portrait ? 'center' : 'right';
          g.fillText('1 JUPITER  ×  12', portrait ? W / 2 : W - 90 * U, y + 52 * U); g.restore();
        }
      }
      // rotation dial
      const c1 = s.at('spin'); if (c1 !== null) {
        const a = smooth(c1 + 0.3, c1 + 1.0, t) * (1 - smooth(c1 + 8, c1 + 9, t)); if (a > 0.01) {
          const R = 62 * U, cx = portrait ? W - 130 * U : W - 190 * U, cy = portrait ? 640 * U : H / 2, ph = (t / 8.5) * Math.PI * 2;
          g.save(); g.globalAlpha = a; g.lineWidth = 6 * U; g.strokeStyle = 'rgba(111,220,255,.25)'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
          g.strokeStyle = '#ffbf5a'; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + (ph % (Math.PI * 2)) ); g.stroke();
          g.fillStyle = '#fff'; g.font = `700 ${34 * U}px "Space Grotesk"`; g.textAlign = 'center'; g.fillText(`${((ph % (Math.PI * 2)) / (Math.PI * 2) * 8.5).toFixed(1)} h`, cx, cy + 12 * U);
          g.font = `600 ${18 * U}px "Space Grotesk"`; g.fillStyle = '#8fa6c4'; g.fillText('TIME-LAPSE', cx, cy + R + 34 * U); g.restore();
        }
      }
    },
  };

  function closeUp(s) { return smooth(s.at('mass', 0.1) - 1.0, s.at('mass', 0.1) + 2.6, s.t); }
}
