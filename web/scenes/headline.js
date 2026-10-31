// HEADLINE: inside the celestial sphere, find Beta Pictoris in the southern sky; show who/what/caveat.
import * as THREE from 'three';
import { makeStars, glow, clamp, smooth, lerp, lineMat } from '../lib.js';

export default function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ctx.fov(58), ctx.aspect, 0.1, 400);
  const stars = makeStars({ n: 7000, rMin: 48, rMax: 52, seed: 21, size: [1.3, 3.4] }); scene.add(stars);

  // coordinate grid on the celestial sphere
  const R = 46, grid = new THREE.Group();
  const gm = lineMat(0x4aa8d8, 0.16);
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = []; for (let i = 0; i <= 128; i++) { const a = (i / 128) * Math.PI * 2; const la = (lat * Math.PI) / 180; pts.push(new THREE.Vector3(R * Math.cos(la) * Math.cos(a), R * Math.sin(la), R * Math.cos(la) * Math.sin(a))); }
    grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gm));
  }
  for (let lon = 0; lon < 360; lon += 30) {
    const pts = []; for (let i = 0; i <= 96; i++) { const la = -Math.PI / 2 + (i / 96) * Math.PI; const a = (lon * Math.PI) / 180; pts.push(new THREE.Vector3(R * Math.cos(la) * Math.cos(a), R * Math.sin(la), R * Math.cos(la) * Math.sin(a))); }
    grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gm));
  }
  scene.add(grid);

  // target: Beta Pictoris is far in the southern sky (Dec about -51 deg)
  const dec = (-51 * Math.PI) / 180, az = 2.2;
  const markerDir = new THREE.Vector3(Math.cos(dec) * Math.cos(az), Math.sin(dec), Math.cos(dec) * Math.sin(az)).normalize();
  const marker = markerDir.clone().multiplyScalar(44);
  const star = glow(0xdff0ff, 3.2, 1); star.position.copy(marker); scene.add(star);
  const core = glow(0xffffff, 1.0, 1); core.position.copy(marker); scene.add(core);
  const reticle = new THREE.Group(); reticle.position.copy(marker);
  const rg = new THREE.RingGeometry(1.9, 2.0, 96);
  const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x6fdcff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  reticle.add(ring);
  for (let i = 0; i < 4; i++) {
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.8), ring.material); const a = (i * Math.PI) / 2;
    tick.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0); tick.rotation.z = a + Math.PI / 2; reticle.add(tick);
  }
  scene.add(reticle);
  const pulses = Array.from({ length: 3 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 96), new THREE.MeshBasicMaterial({ color: 0xff5fd2, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.position.copy(marker); scene.add(m); return m; });

  const startDir = new THREE.Vector3(-0.6, 0.35, -0.7).normalize();
  const look = new THREE.Vector3();

  return {
    scene, camera, post: { bloom: 0.85, threshold: 0.5 },
    labels: {
      team: { cls: 'p-lt', html: '<div class="k">Paper led by</div><div class="v">Kevin N. Ortiz Ceballos</div><div class="s">Center for Astrophysics | Harvard &amp; Smithsonian<br>with the University of Oregon</div>' },
      first: { cls: 'p-tc', tone: 'am', html: '<div class="kicker" style="color:var(--am)">A world first</div><div class="big sm">RADIO WAVES TRACED TO<br><em>AN EXOPLANET</em></div>', post: 0.3 },
      planetitself: { cls: 'p-bc', html: '<div class="big sm"><span class="cy">THE PLANET</span> ITSELF</div>', post: 0.3 },
      name: { world: marker, dx: 60, dy: -10, anchor: 'r', cls: '', html: '<div class="k">Target</div><div class="v">Beta Pictoris b</div><div class="s">≈ 63 light-years · southern sky</div>', sticky: true },
      preprint: { cls: 'p-lt chip am', tone: 'am', html: '<div class="k">Preprint · not yet peer reviewed</div><div class="note" style="font-style:italic;margin-top:8px">“Discovery of radio emission from the exoplanet β Pictoris b”</div><div class="s">K. N. Ortiz Ceballos et al. · arXiv:2609.16720<br>Posted 15 September 2026</div>', sticky: true },
    },
    update(s) {
      const t = s.t, D = s.D;
      stars.userData.mat.uniforms.uPx.value = ctx.px; stars.userData.mat.uniforms.uTime.value = t;
      const tPan0 = 0.5, tPan1 = s.at('planetitself', D * 0.5);
      const pan = smooth(tPan0, tPan1 + 1.0, t);
      look.copy(startDir).lerp(markerDir, pan).normalize();
      const sway = Math.sin(t * 0.3) * 0.02;
      camera.position.set(0, 0, 0);
      camera.lookAt(look.x + sway, look.y, look.z);
      const zoom = smooth(tPan1 - 0.5, tPan1 + 2.5, t);
      camera.fov = ctx.fov(lerp(58, 24, zoom)); camera.updateProjectionMatrix();

      reticle.lookAt(0, 0, 0); reticle.rotation.z = t * 0.5;
      const pulse = 0.85 + 0.15 * Math.sin(t * 3);
      star.scale.setScalar(3.2 * pulse * (1 + 0.8 * zoom)); ring.material.opacity = smooth(tPan1 - 1.5, tPan1, t) * 0.9;
      const f = s.at('first', D * 0.3);
      pulses.forEach((m, i) => {
        const age = ((t - f) - i * 0.9); const a = age / 2.6; m.lookAt(0, 0, 0);
        if (t >= f && age >= 0 && age < 2.6) { m.visible = true; m.scale.setScalar(2.2 + 14 * Math.pow(a, 0.7)); m.material.opacity = Math.pow(1 - a, 1.5) * 0.9; } else m.visible = false;
      });
    },
  };
}
