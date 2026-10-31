// HOOK: planet emits radio bursts -> the signal travels 63 light-years (year counter) -> reaches Earth -> "NOT ALIENS" stamp + title.
import * as THREE from 'three';
import { makeStars, gasGiantMaterial, auroraShells, atmosphereMaterial, earthMaterial, glow, clamp, smooth, easeInOut, lerp, lineMat } from '../lib.js';

export default function create(ctx) {
  const k = ctx.k;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ctx.fov(42), ctx.aspect, 0.05, 3000);
  const EX = 420; // Earth distance along +x (scene units)

  const stars = makeStars({ n: 5200, box: [980, 300, 300], seed: 11, size: [1.5, 3.8] }); stars.position.x = EX / 2; scene.add(stars);
  const host = glow(0xcfe3ff, 60, 0.95); host.position.set(-80, 12, -55); scene.add(host);

  const lightDir = new THREE.Vector3(-1, 0.12, -0.55);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), gasGiantMaterial({ colA: [0.62, 0.34, 0.17], colB: [0.3, 0.12, 0.07], colC: [0.85, 0.62, 0.38], emit: 0.16, bands: 13, light: lightDir }));
  planet.rotation.z = 0.35; scene.add(planet);
  const aur = auroraShells(new THREE.Color(1.0, 0.25, 0.85), { colat: 0.3, width: 0.1, strength: 1.4 }); aur.rotation.x = 0.25; planet.add(aur);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(1.1, 64, 48), atmosphereMaterial(0xff9a5a, 3.2, 0.9)); planet.add(atm);

  const earth = new THREE.Mesh(new THREE.SphereGeometry(5.5, 128, 96), earthMaterial(lightDir)); earth.position.set(EX, 0, 0); earth.rotation.z = 0.4; scene.add(earth);
  const eatm = new THREE.Mesh(new THREE.SphereGeometry(5.5 * 1.12, 64, 48), atmosphereMaterial(0x4f9bff, 3.2, 0.8)); eatm.position.copy(earth.position); scene.add(eatm);
  const flash = glow(0xffa6ee, 30, 0); flash.position.set(EX - 5.6, 0, 0); scene.add(flash);

  // path guide
  const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(EX - 6, 0, 0)]), lineMat(0xff5fd2, 0.28)); scene.add(path);

  // burst rings (billboarded around the planet)
  const ringGeo = new THREE.RingGeometry(0.965, 1.0, 128);
  const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xff6fe0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const burstRings = ctx.bursts.map(() => { const m = new THREE.Mesh(ringGeo, ringMat()); scene.add(m); return m; });

  // travelling wavefront train (normal along +x)
  const trainGeo = new THREE.RingGeometry(0.93, 1.0, 96); trainGeo.rotateY(Math.PI / 2);
  const train = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(trainGeo, ringMat()); m.visible = false; scene.add(m); return m; });

  const target = new THREE.Vector3(), cpos = new THREE.Vector3();

  return {
    scene, camera, post: { bloom: 1.0, threshold: 0.5, radius: 0.7 },
    labels: {
      planet: { cls: 'p-lt', html: '<div class="k">The source</div><div class="v">Beta Pictoris b</div><div class="s">A gas giant · 63 light-years away</div>', tone: 'mg', post: 0.4 },
      travel: { cls: 'p-br', html: '<div class="k">Meanwhile on Earth</div><div class="s">1969 · Moon landing<br>1991 · The World Wide Web</div>', post: 0.2 },
      caught: { cls: 'p-lt', html: '<div class="k">Caught by</div><div class="v">MeerKAT</div><div class="s">South Africa · 2025–2026</div>', post: 0.3 },
      alien: { cls: 'p-c', html: '<div class="big sm">A SIGNAL FROM<br><em>ANOTHER WORLD?</em></div>', post: 0.2 },
      no: { cls: 'p-c', html: '<div class="stamp">NOT ALIENS</div>', post: 0.3 },
      title: { cls: 'p-c', sticky: true, html: '<div class="kicker">The real story</div><div class="big">THE SIGNAL FROM<br><span class="cy">BETA PICTORIS b</span></div>' },
    },
    update(s) {
      const t = s.t, D = s.D;
      stars.userData.mat.uniforms.uPx.value = ctx.px; stars.userData.mat.uniforms.uTime.value = t;
      planet.material.uniforms.uTime.value = t; earth.material.uniforms.uTime.value = t; aur.userData.mats.forEach((m) => (m.uniforms.uTime.value = t));
      planet.rotation.y = t * 0.55;

      // bursts: aurora flare + rings
      let flare = 0;
      ctx.bursts.forEach((b, i) => {
        const age = t - b; const m = burstRings[i];
        if (age >= 0) flare += Math.exp(-age * 2.6);
        if (age >= 0 && age < 2.6) {
          const a = age / 2.6; m.visible = true; m.position.set(0, 0, 0); m.quaternion.copy(camera.quaternion);
          m.scale.setScalar(1.25 + 2.6 * Math.pow(a, 0.7)); m.material.opacity = Math.pow(1 - a, 1.6) * 0.9;
        } else m.visible = false;
      });
      aur.userData.mats.forEach((m) => (m.uniforms.uAmt.value = 0.55 + flare * 1.6));

      // signal train timing (follows narration if cues exist)
      const tl = s.at('travel', D * 0.17), ta = s.at('caught') !== null ? s.at('caught') + 3.4 : D * 0.8;
      const p = easeInOut(clamp((t - tl) / (ta - tl)));
      const X = (EX - 6) * p;
      train.forEach((m, i) => {
        const xi = X - i * (4 + 2.2 * i); const on = t > tl && xi > 0.2;
        m.visible = on; if (!on) return;
        const r = Math.min(1 + 0.45 * xi, 2.8);
        m.position.set(xi, 0, 0); m.scale.setScalar(r);
        m.material.opacity = (1 - i / 7) * smooth(0, 6, xi) * (1 - smooth(0.985, 1.0, p));
      });
      path.material.opacity = 0.25 * smooth(tl - 0.5, tl + 1.5, t);
      const hit = clamp((t - ta) / 2.2); flash.material.opacity = hit > 0 && hit < 1 ? Math.sin(hit * Math.PI) * 0.9 : 0; flash.scale.setScalar(20 + 90 * hit);

      // camera
      const orbit = t * 0.06;
      const nearPos = cpos.set(Math.sin(orbit + 0.7) * 3.4 * k, 0.6 + 0.3 * Math.sin(orbit), Math.cos(orbit + 0.7) * 4.6 * k);
      const blend = smooth(tl - 0.2, tl + 2.4, t);
      const travelPos = new THREE.Vector3(X - 20 * k, 2.0, 7.5 * k);
      const endBlend = smooth(ta, ta + 3.0, t);
      const endAng = (t - ta) * 0.1;
      const endPos = new THREE.Vector3(EX - 22 * k + Math.sin(endAng) * 3, 3.5 * Math.cos(endAng * 0.7), 10 * k + Math.cos(endAng) * 3);
      const cp = nearPos.clone().lerp(travelPos, blend).lerp(endPos, endBlend);
      camera.position.copy(cp);
      const tgt = target.set(lerp(0, X + 12, blend), 0, 0).lerp(earth.position.clone().add(new THREE.Vector3(0, 0, 0)), endBlend);
      camera.lookAt(tgt);
    },
    overlay(g, { W, H, U, portrait }, s) {
      const tl = s.at('travel', s.D * 0.17), ta = s.at('caught') !== null ? s.at('caught') + 3.4 : s.D * 0.8;
      const a = smooth(tl, tl + 0.8, s.t) * (1 - smooth(ta + 1.2, ta + 2.2, s.t));
      if (a <= 0.01) return;
      const p = easeInOut(clamp((s.t - tl) / (ta - tl)));
      const yr = Math.floor(1963 + 63 * p + 0.0001);
      g.save(); g.globalAlpha = a; g.textAlign = 'center';
      const cx = W / 2, cy = portrait ? 230 * U : 130 * U;
      g.fillStyle = '#6fdcff'; g.font = `600 ${26 * U}px "Space Grotesk"`; g.fillText('S I G N A L   I N   T R A N S I T', cx, cy - 70 * U);
      g.fillStyle = '#ffffff'; g.shadowColor = 'rgba(255,95,210,.8)'; g.shadowBlur = 30 * U; g.font = `700 ${(portrait ? 150 : 132) * U}px "Space Grotesk"`; g.fillText(String(yr), cx, cy + 46 * U);
      g.shadowBlur = 0; g.fillStyle = '#ffbf5a'; g.font = `600 ${30 * U}px "Space Grotesk"`; g.fillText(`${Math.round(63 * p)} YEARS  ·  ${(63 * p).toFixed(0)} LIGHT-YEARS`, cx, cy + 100 * U);
      g.restore();
    },
  };
}
