// AURORA: Earth's aurora -> Jupiter -> Beta Pictoris b; electrons spiral along field lines and emit beamed radio waves (ECMI).
import * as THREE from 'three';
import { makeStars, gasGiantMaterial, earthMaterial, atmosphereMaterial, auroraShells, fieldLines, dipolePoint, glow, pointsMat, rng, clamp, smooth, lerp, easeInOut } from '../lib.js';

function electrons(parent, { count, Ls, color, size, seed, rho }) {
  const r = rng(seed); const A = [];
  for (let i = 0; i < count; i++) A.push({ L: Ls[Math.floor(r() * Ls.length)], phi: r() * 6.283, ph: r(), sp: 0.08 + r() * 0.1, hp: r() * 6.283, hs: 10 + r() * 8 });
  const geo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  const mat = pointsMat(color, size, 1); const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; parent.add(pts);
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), tan = new THREE.Vector3(), n1 = new THREE.Vector3(), n2 = new THREE.Vector3();
  return {
    mat,
    update(t) {
      const a = geo.attributes.position;
      A.forEach((e, i) => {
        const th0 = Math.asin(Math.sqrt(1 / e.L)); const tri = Math.abs(((e.ph + e.sp * t) % 1) * 2 - 1);
        const th = th0 + (Math.PI - 2 * th0) * tri; dipolePoint(e.L, e.phi, th, p0); dipolePoint(e.L, e.phi, th + 0.01, p1);
        tan.copy(p1).sub(p0).normalize(); n1.set(0, 1, 0).cross(tan).normalize(); if (n1.lengthSq() < 0.1) n1.set(1, 0, 0); n2.copy(tan).cross(n1);
        const rr = rho * (0.5 + 0.5 * Math.sin(th)); const ang = e.hp + t * e.hs;
        a.setXYZ(i, p0.x + (n1.x * Math.cos(ang) + n2.x * Math.sin(ang)) * rr, p0.y + (n1.y * Math.cos(ang) + n2.y * Math.sin(ang)) * rr, p0.z + (n1.z * Math.cos(ang) + n2.z * Math.sin(ang)) * rr);
      });
      a.needsUpdate = true;
    },
  };
}

export default function create(ctx) {
  const k = ctx.k;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ctx.fov(40), ctx.aspect, 0.05, 3000);
  const bg = makeStars({ n: 5000, rMin: 400, rMax: 700, seed: 61, size: [1.3, 3.2] }); scene.add(bg);
  const light = new THREE.Vector3(1, 0.15, 0.5);
  const sunGlow = glow(0xfff0d0, 90, 0.8); sunGlow.position.set(260, 60, 140); scene.add(sunGlow);

  const XE = -14, XJ = 0, XB = 16;
  // Earth
  const earthG = new THREE.Group(); earthG.position.set(XE, 0, 0); scene.add(earthG);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), earthMaterial(light)); earth.rotation.z = 0.41; earthG.add(earth);
  earthG.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), atmosphereMaterial(0x4f9bff, 3, 1.2)));
  const eAur = auroraShells(new THREE.Color(0.2, 1.0, 0.5), { colat: 0.38, width: 0.12, strength: 1.5 }); eAur.rotation.z = 0.41; earthG.add(eAur);
  const eFL = fieldLines({ Ls: [2.0, 3.0, 4.4], nPhi: 10, color: 0x7fffb0, opacity: 0.16 }); eFL.rotation.z = 0.41; earthG.add(eFL);
  const eEl = electrons(eFL, { count: 160, Ls: [2.0, 3.0, 4.4], color: 0x9fffd0, size: 3.0, seed: 3, rho: 0.05 });
  // Jupiter
  const jup = new THREE.Mesh(new THREE.SphereGeometry(2.4, 96, 72), gasGiantMaterial({ colA: [0.78, 0.6, 0.42], colB: [0.42, 0.26, 0.16], colC: [0.95, 0.9, 0.8], emit: 0, bands: 16, light })); jup.position.set(XJ, 0, 0); jup.rotation.z = 0.05; scene.add(jup);
  const jAur = auroraShells(new THREE.Color(0.5, 0.6, 1.0), { colat: 0.26, width: 0.09, strength: 1.4 }); jup.add(jAur);
  // Beta Pictoris b
  const bG = new THREE.Group(); bG.position.set(XB, 0, 0); scene.add(bG);
  const bp = new THREE.Mesh(new THREE.SphereGeometry(2.6, 96, 72), gasGiantMaterial({ colA: [0.62, 0.34, 0.17], colB: [0.3, 0.12, 0.07], colC: [0.85, 0.62, 0.38], emit: 0.16, bands: 13, light })); bp.rotation.z = 0.3; bG.add(bp);
  bG.add(new THREE.Mesh(new THREE.SphereGeometry(2.9, 48, 32), atmosphereMaterial(0xff9a5a, 3.2, 0.9)));
  const bAur = auroraShells(new THREE.Color(1.0, 0.25, 0.85), { colat: 0.3, width: 0.1, strength: 1.6 }); bp.add(bAur);
  const bFL = fieldLines({ Ls: [1.6, 2.2, 3.0, 4.2], nPhi: 12, color: 0xff8be8, opacity: 0.0 }); bFL.scale.setScalar(2.6); bp.add(bFL);
  const bEl = electrons(bFL, { count: 420, Ls: [1.6, 2.2, 3.0, 4.2], color: 0xffd0f6, size: 3.2, seed: 9, rho: 0.07 });
  // radio beams (hollow cones from each pole's aurora ring)
  const coneGeo = new THREE.ConeGeometry(2.4, 9, 48, 1, true); coneGeo.translate(0, -4.5, 0); coneGeo.rotateX(Math.PI);
  const mkCone = (sign, az) => { const m = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xff5fd2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); const piv = new THREE.Group(); piv.rotation.set(0, az, sign * 0.55); piv.position.set(0, sign * 2.6 * Math.cos(0.3) * 0.95, 0); piv.add(m); bp.add(piv); return m; };
  const cones = [mkCone(1, 0.0), mkCone(1, 3.2), mkCone(-1, 1.6), mkCone(-1, 4.8)];

  const F = new THREE.Vector3(), cam = new THREE.Vector3();
  return {
    scene, camera, post: { bloom: 1.0, threshold: 0.5, radius: 0.7 },
    labels: {
      earth: { cls: 'p-lt', tone: 'gr', html: '<div class="k">Earth</div><div class="v">Northern &amp; southern lights</div>' },
      particles: { cls: 'p-lt', tone: 'gr', html: '<div class="k">Charged particles</div><div class="v">funneled to the poles</div><div class="s">they glow — and give off radio waves we can’t see</div>' },
      jupiter: { cls: 'p-lt', html: '<div class="k">Jupiter</div><div class="v">Radio auroras</div><div class="s">strong enough for amateur radio astronomers to detect</div>' },
      bpic: { cls: 'p-lt', tone: 'mg', html: '<div class="k">Beta Pictoris b</div><div class="v">A radio aurora on a whole new scale</div>' },
      ecmi: { cls: 'p-tc', html: '<div class="kicker">The physics</div><div class="big sm">ELECTRON CYCLOTRON<br><span class="mg">MASER INSTABILITY</span></div>' },
      spiral: { cls: 'p-lt', tone: 'mg', html: '<div class="k">Electrons spiral along field lines</div><div class="v">→ beamed radio waves</div>', sticky: true },
    },
    update(s) {
      const t = s.t, D = s.D;
      bg.userData.mat.uniforms.uPx.value = ctx.px; bg.userData.mat.uniforms.uTime.value = t;
      [earth, jup, bp].forEach((m) => (m.material.uniforms.uTime.value = t));
      [eAur, jAur, bAur].forEach((g) => g.userData.mats.forEach((m) => (m.uniforms.uTime.value = t)));
      earth.rotation.y = t * 0.12; jup.rotation.y = t * 0.3; bp.rotation.y = t * 0.55;
      const tj = s.at('jupiter', D * 0.5), tb = s.at('bpic', D * 0.62), ts = s.at('spiral', D * 0.8), tp = s.at('particles', D * 0.15);
      eEl.update(t); bEl.update(t);
      const flE = smooth(tp - 0.3, tp + 1.2, t) * (1 - smooth(tj - 0.6, tj + 0.4, t)); eFL.children.forEach((l) => (l.material.opacity = 0.16 * Math.max(flE, 0.25 * (1 - smooth(tj, tj + 1, t)))));
      eEl.mat.uniforms.uOp.value = flE;
      const sp = smooth(ts - 0.5, ts + 1.2, t);
      bFL.children.forEach((l) => (l.material.opacity = 0.34 * sp)); bEl.mat.uniforms.uOp.value = sp;
      bAur.userData.mats.forEach((m) => (m.uniforms.uAmt.value = 0.6 + 1.0 * sp));
      cones.forEach((c, i) => (c.material.opacity = 0.09 * sp * (0.7 + 0.3 * Math.sin(t * 4 + i))));
      // camera focus: Earth -> Jupiter -> b -> closer on b
      const a1 = easeInOut(smooth(tj - 1.0, tj + 1.6, t)), a2 = easeInOut(smooth(tb - 1.0, tb + 1.8, t));
      F.set(XE, 0, 0).lerp(new THREE.Vector3(XJ, 0, 0), a1).lerp(new THREE.Vector3(XB, 0, 0), a2);
      const rad = lerp(lerp(1, 2.4, a1), 2.6, a2), zoomIn = smooth(ts - 1, ts + 3, t);
      const dist = rad * lerp(6.2, 4.6, zoomIn) * k;
      const az = 0.55 + t * 0.05; const el = lerp(0.25, 0.42, a2);
      cam.set(F.x + Math.sin(az) * Math.cos(el) * dist, F.y + Math.sin(el) * dist * 0.8, F.z + Math.cos(az) * Math.cos(el) * dist);
      camera.position.copy(cam); camera.lookAt(F);
    },
  };
}
