// MEERKAT: 64 dishes in the Karoo night; slew to Beta Pictoris; interferometry beams and data streams; radio bursts arrive.
import * as THREE from 'three';
import { makeStars, glow, rng, kf3, clamp, smooth, lerp, pointsMat, lineMat } from '../lib.js';

export default function create(ctx) {
  const k = ctx.k;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x02040c); scene.fog = new THREE.FogExp2(0x040a18, 0.00055);
  const camera = new THREE.PerspectiveCamera(ctx.fov(52), ctx.aspect, 0.5, 6000);
  const sky = makeStars({ n: 9000, rMin: 2200, rMax: 2600, seed: 71, size: [1.5, 3.8] }); scene.add(sky);
  // Milky Way band
  { const r = rng(5), n = 9000, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const lon = r() * Math.PI * 2, lat = (r() + r() + r() - 1.5) * 0.28; const v = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)); v.applyAxisAngle(new THREE.Vector3(1, 0, 0), 1.0).multiplyScalar(2300); a.set([v.x, v.y, v.z], i * 3); }
    const m = pointsMat(0x9fb8ff, 1.5, 0.35); m.userData = {}; const p = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(a, 3)), m); p.frustumCulled = false; scene.add(p); scene.userData.mw = m; }

  // ground
  const ground = new THREE.Mesh(new THREE.CircleGeometry(6000, 64), new THREE.MeshLambertMaterial({ color: 0x1a1612 })); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  scene.add(new THREE.HemisphereLight(0x5a78c8, 0x1a120a, 0.9));
  const moon = new THREE.DirectionalLight(0x9fb6ff, 1.4); moon.position.set(-300, 500, 200); scene.add(moon);

  // dish layout (48 in a dense core, 16 far out) via simple Poisson sampling
  const r = rng(17); const P = [];
  const place = (n, rMin, rMax, minD) => { let tries = 0; while (n > 0 && tries++ < 20000) { const a = r() * Math.PI * 2, rr = rMin + (rMax - rMin) * Math.sqrt(r()); const p = [Math.cos(a) * rr, Math.sin(a) * rr]; if (P.every((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) > minD)) { P.push(p); n--; } } };
  place(48, 0, 420, 62); place(16, 900, 3400, 400);
  const prof = []; const Rd = 6.75; for (let i = 0; i <= 14; i++) { const x = (i / 14) * Rd; prof.push(new THREE.Vector2(x, (x * x) / (4 * 5.4))); }
  const bowlGeo = new THREE.LatheGeometry(prof, 36); bowlGeo.computeVertexNormals();
  const bowl = new THREE.InstancedMesh(bowlGeo, new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.35, roughness: 0.42, side: THREE.DoubleSide }), P.length);
  const ped = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1.1, 5.2, 12), new THREE.MeshStandardMaterial({ color: 0x9aa4b0, roughness: 0.6 }), P.length);
  const feed = new THREE.InstancedMesh(new THREE.BoxGeometry(1.0, 1.4, 1.0), new THREE.MeshStandardMaterial({ color: 0x555d68, roughness: 0.5 }), P.length);
  [bowl, ped, feed].forEach((m) => { m.frustumCulled = false; scene.add(m); });
  const phase = P.map(() => r() * 6.28), startAz = P.map(() => r() * 6.28);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3(), S1 = new THREE.Vector3(2.2, 2.2, 2.2), pp = new THREE.Vector3();

  // target direction (south sky) and beams
  const EL = (62 * Math.PI) / 180; const tdir = new THREE.Vector3(0, Math.sin(EL), -Math.cos(EL));
  const FAR = tdir.clone().multiplyScalar(1700);
  const tstar = glow(0xdff0ff, 160, 1); tstar.position.copy(FAR); scene.add(tstar);
  const beamPos = new Float32Array(P.length * 6);
  const beams = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(beamPos, 3)), lineMat(0x6fdcff, 0)); beams.frustumCulled = false; scene.add(beams);
  const NP = P.length * 4; const pulseGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
  const pulseMat = pointsMat(0xff7fe6, 5, 0); const pulses = new THREE.Points(pulseGeo, pulseMat); pulses.frustumCulled = false; scene.add(pulses);
  const gLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.length * 6), 3)), lineMat(0xffbf5a, 0)); gLines.frustumCulled = false; scene.add(gLines);
  const gp = gLines.geometry.attributes.position; P.forEach((p, i) => { gp.set([p[0], 0.4, p[1], 0, 0.4, 0], i * 6); });
  const gpulseGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(P.length * 2 * 3), 3));
  const gpulseMat = pointsMat(0xffd27a, 4.5, 0); const gpulses = new THREE.Points(gpulseGeo, gpulseMat); gpulses.frustumCulled = false; scene.add(gpulses);
  const hub = glow(0xffbf5a, 26, 0); hub.position.set(0, 3, 0); scene.add(hub);

  const camKeys = [[0, [-110 * k, 7, 150 * k]], [0.2, [60 * k, 26, 120 * k]], [0.42, [210 * k, 95, 200 * k]], [0.66, [260 * k, 230 * k, 520 * k]], [0.82, [150 * k, 70 * k, 420 * k]], [1, [60 * k, 8, 260 * k]]];
  const tgtKeys = [[0, [0, 6, 0]], [0.2, [-30, 6, -10]], [0.42, [0, 4, 0]], [0.66, [0, 0, 0]], [0.82, [0, 40, -80]], [1, [0, 600, -1000]]];
  const cp = new THREE.Vector3(), ct = new THREE.Vector3();

  return {
    scene, camera, post: { bloom: 0.8, threshold: 0.5, radius: 0.6, exposure: 1.15 },
    labels: {
      where: { cls: 'p-lt', html: '<div class="k">MeerKAT</div><div class="v">Northern Cape, South Africa</div><div class="s">≈ 90 km outside the town of Carnarvon</div>' },
      dishes: { cls: 'p-tr', html: '<div class="k">Antennas</div><div class="v">64 dishes</div><div class="s">each 13.5 m across · working as one</div>' },
      interf: { cls: 'p-lt', tone: 'am', html: '<div class="k">Interferometry</div><div class="v">64 dishes = 1 giant ear</div><div class="s">combining every signal pinpoints where a radio wave came from</div>' },
      ska: { cls: 'p-lt', html: '<div class="k">A stepping stone to</div><div class="v">Square Kilometre Array</div><div class="s">a future, even more sensitive mega-telescope</div>' },
      four: { cls: 'p-lt', tone: 'am', html: '<div class="k">Observations</div><div class="v">4 × in 2025–2026</div><div class="s">radio emission detected every time</div>' },
      bursts: { cls: 'p-br', tone: 'mg', html: '<div class="k">Detected</div><div class="v">Short radio bursts</div><div class="s">brightening and fading in moments</div>' },
    },
    update(s) {
      const t = s.t, D = s.D, u = s.u;
      sky.userData.mat.uniforms.uPx.value = ctx.px; sky.userData.mat.uniforms.uTime.value = t; scene.userData.mw.uniforms.uPx.value = ctx.px;
      pulseMat.uniforms.uPx.value = ctx.px; gpulseMat.uniforms.uPx.value = ctx.px;
      const slew = smooth(s.at('dishes', D * 0.15) + 0.5, s.at('dishes', D * 0.15) + 6, t);
      const track = Math.sin(t * 0.4) * 0.002;
      P.forEach((p, i) => {
        const az0 = startAz[i], dirStart = d.set(Math.cos(az0) * 0.12, 1, Math.sin(az0) * 0.12).normalize();
        const dir = dirStart.clone().lerp(tdir, slew).normalize(); dir.x += track * Math.sin(phase[i]);
        q.setFromUnitVectors(up, dir.normalize()); pp.set(p[0], 5.4, p[1]);
        M.compose(pp, q, S1); bowl.setMatrixAt(i, M);
        M.compose(new THREE.Vector3(p[0], 2.6, p[1]), new THREE.Quaternion(), S1); ped.setMatrixAt(i, M);
        const fp = pp.clone().addScaledVector(dir, 5.9); M.compose(fp, q, S1); feed.setMatrixAt(i, M);
        // beam line from far target to this dish's feed
        beamPos.set([FAR.x, FAR.y, FAR.z, fp.x, fp.y, fp.z], i * 6);
      });
      [bowl, ped, feed].forEach((m) => (m.instanceMatrix.needsUpdate = true));
      beams.geometry.attributes.position.needsUpdate = true;
      const interf = smooth(s.at('interf', D * 0.4), s.at('interf', D * 0.4) + 1.5, t);
      const burstsOn = ctx.bursts.reduce((a, b) => a + (t >= b ? Math.exp(-(t - b) * 2.2) : 0), 0);
      beams.material.opacity = Math.min(1, 0.06 * slew * (0.35 + interf) + burstsOn * 0.35);
      tstar.material.opacity = 0.55 + 0.45 * Math.min(1, burstsOn); tstar.scale.setScalar(120 + 140 * burstsOn);
      // travelling pulses on beams
      const pa = pulseGeo.attributes.position;
      for (let i = 0; i < P.length; i++) for (let j = 0; j < 4; j++) {
        const f = ((t * 0.35 + j / 4 + phase[i] * 0.1) % 1); const b0 = i * 6; const x = lerp(beamPos[b0], beamPos[b0 + 3], f), y = lerp(beamPos[b0 + 1], beamPos[b0 + 4], f), z = lerp(beamPos[b0 + 2], beamPos[b0 + 5], f);
        pa.setXYZ(i * 4 + j, x, y, z);
      }
      pa.needsUpdate = true; pulseMat.uniforms.uOp.value = 0.9 * slew * (0.2 + burstsOn);
      // data streams to the correlator hub
      gLines.material.opacity = 0.5 * interf;
      const ga = gpulseGeo.attributes.position;
      for (let i = 0; i < P.length; i++) for (let j = 0; j < 2; j++) { const f = (t * 0.5 + j * 0.5 + phase[i]) % 1; ga.setXYZ(i * 2 + j, lerp(P[i][0], 0, f), 0.5, lerp(P[i][1], 0, f)); }
      ga.needsUpdate = true; gpulseMat.uniforms.uOp.value = interf;
      hub.material.opacity = interf * (0.4 + 0.3 * Math.sin(t * 5)); hub.scale.setScalar(26 + 20 * burstsOn);
      // camera
      kf3(u, camKeys, cp); kf3(u, tgtKeys, ct);
      camera.position.copy(cp); camera.lookAt(ct);
      const aer = smooth(0.5, 0.7, u) * (1 - smooth(0.72, 0.84, u)); camera.fov = ctx.fov(lerp(52, 64, aer)); camera.updateProjectionMatrix();
    },
  };
}
