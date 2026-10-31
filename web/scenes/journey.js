// JOURNEY: fly 63.4 light-years from the Sun to Beta Pictoris (1 scene unit = 1 light-year), with a live distance counter.
import * as THREE from 'three';
import { makeStars, glow, rng, clamp, smooth, easeInOut, lerp, ringPoints, pointsMat } from '../lib.js';

export default function create(ctx) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ctx.fov(62), ctx.aspect, 0.02, 400);
  const BP = new THREE.Vector3(2.5, -1.6, -63.4);

  // star tube along the route (points + streak lines)
  const N = 9000, r = rng(5);
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const rad = 1.2 + Math.pow(r(), 0.8) * 34, th = r() * Math.PI * 2;
    pos[i * 3] = Math.cos(th) * rad; pos[i * 3 + 1] = Math.sin(th) * rad * 0.75; pos[i * 3 + 2] = 12 - r() * 90;
    const c = new THREE.Color().setHSL(r() < 0.3 ? 0.08 : 0.6, 0.5, 0.82); const b = 0.4 + r() * 0.8;
    col[i * 3] = c.r * b; col[i * 3 + 1] = c.g * b; col[i * 3 + 2] = c.b * b;
  }
  const lp = new Float32Array(N * 6), lc = new Float32Array(N * 6), le = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) { for (let v = 0; v < 2; v++) { for (let a = 0; a < 3; a++) { lp[i * 6 + v * 3 + a] = pos[i * 3 + a]; lc[i * 6 + v * 3 + a] = col[i * 3 + a]; } le[i * 2 + v] = v; } }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lp, 3)); lg.setAttribute('aColor', new THREE.BufferAttribute(lc, 3)); lg.setAttribute('aEnd', new THREE.BufferAttribute(le, 1));
  const lmat = new THREE.ShaderMaterial({
    uniforms: { uStreak: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 aColor; attribute float aEnd; uniform float uStreak; varying vec3 vC; varying float vE; void main(){ vec3 p = position; p.z += aEnd*uStreak; vC = aColor; vE = aEnd; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `varying vec3 vC; varying float vE; void main(){ float f = 1.0 - vE*0.9; gl_FragColor = vec4(vC*f*0.85, f*0.8); }`,
  });
  const streaks = new THREE.LineSegments(lg, lmat); streaks.frustumCulled = false; scene.add(streaks);
  const bg = makeStars({ n: 3500, rMin: 150, rMax: 200, seed: 8, size: [1.2, 3] }); scene.add(bg);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pg.setAttribute('aColor', new THREE.BufferAttribute(col, 3)); pg.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(N).fill(2.4), 1)); pg.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(N).map((_, i) => (i * 0.618) % 1), 1));
  const pts = new THREE.Points(pg, bg.userData.mat); pts.frustumCulled = false; scene.add(pts);

  const sun = glow(0xffd58a, 3.0, 1); sun.position.set(0, 0, 0); scene.add(sun);
  const sunCore = glow(0xffffff, 0.8, 1); scene.add(sunCore);
  const bstar = glow(0xcfe4ff, 1.0, 1); bstar.position.copy(BP); scene.add(bstar);
  const bcore = glow(0xffffff, 0.35, 1); bcore.position.copy(BP); scene.add(bcore);

  // debris disk around the target (nearly edge-on)
  const dpos = ringPoints(7000, 0.8, 7.5, 0.18, 99);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dm = pointsMat(0xffb070, 1.6, 0.8); const disk = new THREE.Points(dg, dm); disk.position.copy(BP); disk.rotation.set(0.07, 0.4, 0.05); disk.frustumCulled = false; scene.add(disk);
  const dm2 = pointsMat(0x9fd0ff, 1.2, 0.5); const disk2 = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(ringPoints(4000, 2, 9, 0.12, 7), 3)), dm2); disk2.position.copy(BP); disk2.rotation.copy(disk.rotation); disk2.frustumCulled = false; scene.add(disk2);

  const tmpP = new THREE.Vector3();

  const distAt = (s) => {
    const tEnd = s.at('disk', s.D * 0.78) + 1.5;
    const p = easeInOut(clamp((s.t - 0.7) / (tEnd - 0.7)));
    return lerp(-6, 59.0, p);
  };
  return {
    scene, camera, post: { bloom: 0.95, threshold: 0.5, radius: 0.7 },
    labels: {
      lightyear: { cls: 'p-lt', html: '<div class="k">1 light-year</div><div class="v">≈ 9.5 trillion km</div><div class="s">the distance light travels in a year</div>' },
      voyager: { cls: 'p-lt', tone: 'am', html: '<div class="k">Voyager 1 would need</div><div class="v">&gt; 1,000,000 years</div><div class="s">to cover 63 light-years</div>' },
      pictor: { world: BP, dx: 70, dy: -20, anchor: 'r', html: '<div class="k">Constellation Pictor</div><div class="v">Beta Pictoris</div><div class="s">“the Painter’s Easel” · southern sky</div>', sticky: false, post: 3.0 },
      star: { cls: 'p-lt', html: '<div class="k">The star</div><div class="v">23 million years old</div><div class="s">≈ 2× the mass of the Sun · the Sun is 4.5 billion years old</div>' },
      disk: { cls: 'p-br', tone: 'am', html: '<div class="k">Debris disk</div><div class="v">seen edge-on</div><div class="s">leftover rubble of planet-building</div>', sticky: true },
    },
    update(s) {
      const t = s.t;
      const dist = distAt(s);
      const sp = clamp(Math.abs(distAt({ ...s, t: s.t + 0.05 }) - dist) / 0.05, 0, 8);
      lmat.uniforms.uStreak.value = clamp(sp * 0.2, 0, 1.6);
      bg.userData.mat.uniforms.uPx.value = ctx.px; bg.userData.mat.uniforms.uTime.value = t;
      const prog = clamp(dist / 59.0);
      camera.position.z = -dist;
      camera.position.x = lerp(1.4, BP.x + 0.4, Math.pow(prog, 1.5)); camera.position.y = lerp(0.35, BP.y + 0.5, Math.pow(prog, 1.5));
      tmpP.set(lerp(0, BP.x, smooth(0, 0.25, prog)), lerp(0, BP.y, smooth(0, 0.25, prog)), -dist - 10 + prog * 9.5);
      camera.lookAt(prog > 0.97 ? BP : tmpP);
      camera.fov = ctx.fov(lerp(62, 48, smooth(0.8, 1, prog)));
      camera.updateProjectionMatrix();
      sun.scale.setScalar(2.4 + 0.5 * Math.sin(t * 2)); sun.material.opacity = 1 - smooth(8, 30, dist + 6);
      sunCore.position.copy(sun.position); sunCore.material.opacity = sun.material.opacity;
      const near = smooth(15, 62, dist);
      bstar.scale.setScalar(0.8 + 2.4 * near * near); bcore.scale.setScalar(0.25 + 0.5 * near);
      const dk = smooth(s.at('disk', s.D * 0.78) - 0.5, s.at('disk', s.D * 0.78) + 2.5, t);
      dm.uniforms.uOp.value = 0.8 * dk; dm2.uniforms.uOp.value = 0.5 * dk; dm.uniforms.uPx.value = dm2.uniforms.uPx.value = ctx.px;
      disk.rotation.y = 0.4 + t * 0.02; disk2.rotation.y = disk.rotation.y;
    },
    overlay(g, { W, H, U, portrait }, s) {
      const dist = Math.max(0, distAt(s)) * (63.4 / 59.0); const a = smooth(0.4, 1.4, s.t);
      const y = H - (portrait ? 300 : 78) * U, x0 = W * 0.18, x1 = W * 0.82, p = clamp(dist / 63.4);
      g.save(); g.globalAlpha = a;
      g.strokeStyle = 'rgba(111,220,255,.35)'; g.lineWidth = 2 * U; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      g.strokeStyle = '#6fdcff'; g.lineWidth = 3 * U; g.beginPath(); g.moveTo(x0, y); g.lineTo(lerp(x0, x1, p), y); g.stroke();
      g.fillStyle = '#fff'; g.shadowColor = '#6fdcff'; g.shadowBlur = 16 * U; g.beginPath(); g.arc(lerp(x0, x1, p), y, 7 * U, 0, 7); g.fill(); g.shadowBlur = 0;
      g.font = `600 ${22 * U}px "Space Grotesk"`; g.fillStyle = '#8fa6c4'; g.textAlign = 'left'; g.fillText('SUN', x0, y + 38 * U); g.textAlign = 'right'; g.fillText('BETA PICTORIS', x1, y + 38 * U);
      g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.font = `700 ${46 * U}px "Space Grotesk"`; g.fillText(`${dist.toFixed(1)} light-years`, W / 2, y - 26 * U);
      g.restore();
    },
  };
}
