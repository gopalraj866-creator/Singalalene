// QUASARS: radio error blob covers star + planets; 9 Gaia quasars anchor the frame; the blob locks onto planet b.
import * as THREE from 'three';
import { makeStars, glow, rng, clamp, smooth, lerp, easeOut, lineMat } from '../lib.js';

export default function create(ctx) {
  const sx = Math.min(1, ctx.aspect / 1.25);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ctx.fov(36), ctx.aspect, 0.1, 400); camera.position.set(0, 0, 30);
  const bg = makeStars({ n: 3000, box: [90, 50, 8], seed: 44, size: [1.0, 2.6] }); bg.position.z = -8; scene.add(bg);

  const P = { star: new THREE.Vector3(-0.2 * sx, 0.2, 0), c: new THREE.Vector3(-1.4 * sx, 0.9, 0), b: new THREE.Vector3(4.2 * sx, -1.1, 0) };
  const star = glow(0xdff0ff, 3.0, 1); star.position.copy(P.star); scene.add(star);
  const starCore = glow(0xffffff, 1.0, 1); starCore.position.copy(P.star); scene.add(starCore);
  const mkDot = (col, size) => { const m = new THREE.Mesh(new THREE.CircleGeometry(size, 32), new THREE.MeshBasicMaterial({ color: col })); scene.add(m); return m; };
  const dc = mkDot(0x9fd0ff, 0.14); dc.position.copy(P.c); const db = mkDot(0xffa060, 0.2); db.position.copy(P.b);
  const bglow = glow(0xff9a5a, 1.4, 0.8); bglow.position.copy(P.b); scene.add(bglow);

  // radio source blob + error ellipse
  const blob = glow(0xff5fd2, 5, 0.0); scene.add(blob);
  const ell = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) => new THREE.Vector3(Math.cos((i / 128) * 6.2832), Math.sin((i / 128) * 6.2832), 0))), lineMat(0xff5fd2, 0.9)); scene.add(ell);
  const lockRing = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.38, 64), new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); lockRing.position.copy(P.b); scene.add(lockRing);

  // quasars (diamond markers) around the field
  const r = rng(12); const Q = [];
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + r() * 0.5, rr = 5.2 + r() * 1.8; Q.push(new THREE.Vector3(Math.cos(a) * rr * 1.25 * sx, Math.sin(a) * rr * 0.62, 0)); }
  const qg = Q.map((p, i) => {
    const grp = new THREE.Group(); grp.position.copy(p);
    const d = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.28, 0), new THREE.Vector3(0.28, 0, 0), new THREE.Vector3(0, -0.28, 0), new THREE.Vector3(-0.28, 0, 0), new THREE.Vector3(0, 0.28, 0)]), lineMat(0x6fdcff, 1)); grp.add(d);
    const gl = glow(0x9fd8ff, 0.9, 0.9); grp.add(gl); scene.add(grp); return grp;
  });
  const qLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 6), 3)), lineMat(0x6fdcff, 0.0)); scene.add(qLines);

  // reference grid (warped until locked)
  const GX = 17, GY = 9, SEG = 36; const gpts = []; const gridLines = [];
  const gm = lineMat(0x6fdcff, 0.22);
  const mkGrid = () => { const g = new THREE.Group(); for (let i = 0; i < GX + GY; i++) { const l = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEG + 1) * 3), 3)), gm); l.frustumCulled = false; g.add(l); gridLines.push(l); } scene.add(g); return g; };
  mkGrid();
  const gridPos = (x, y, warp) => [x + Math.sin(y * 0.9 + 1) * 0.7 * warp, y + Math.cos(x * 0.6) * 0.5 * warp];

  const blobStart = new THREE.Vector3(1.4 * sx, 0.6, 0);
  return {
    scene, camera, post: { bloom: 0.9, threshold: 0.5 },
    labels: {
      tiny: { cls: 'p-lt', tone: 'am', html: '<div class="k">Separation on the sky</div><div class="v">≤ 0.55″</div><div class="s">≈ a coin seen from 7 km away</div>' },
      problem: { cls: 'p-tc', html: '<div class="big sm">PLANET <span class="mg">OR</span> STAR?</div>' },
      quasars: { cls: 'p-lt', html: '<div class="k">Fixed reference points</div><div class="v">9 quasars + 1 calibrator</div><div class="s">positions measured by the Gaia space telescope</div>' },
      lock: { cls: 'p-tc', html: '<div class="kicker">Anchoring the radio image</div><div class="big sm">LOCKED TO THE <span class="cy">SKY</span></div>' },
      result: { cls: 'p-tl', tone: 'gr', html: '<div class="k">Result</div><div class="v">Source = planet b</div><div class="s">the star and planet c are ruled out</div>', sticky: true },
      ls: { cue: ['tiny', 'quasars'], world: P.star, dx: -24, dy: 40, anchor: 't', html: '<div class="s" style="margin:0;color:#dff0ff">Beta Pictoris (star)</div>', sticky: true },
      lc: { cue: ['tiny', 'quasars'], world: P.c, dx: -16, dy: -16, anchor: 'l', html: '<div class="s" style="margin:0;color:#9fd0ff">planet c</div>', sticky: true },
      lb: { cue: ['tiny', 'quasars'], world: P.b, dx: 22, dy: 0, anchor: 'r', html: '<div class="s" style="margin:0;color:#ffa060">planet b</div>', sticky: true },
    },
    update(s) {
      const t = s.t, D = s.D;
      bg.userData.mat.uniforms.uPx.value = ctx.px; bg.userData.mat.uniforms.uTime.value = t;
      const tq = s.at('quasars', D * 0.4), tl = s.at('lock', D * 0.72), tr = s.at('result', D * 0.82);
      const blobIn = smooth(s.at('problem', 0.5) , s.at('problem', 0.5) + 1.2, t) || smooth(0.5, 1.5, t);
      const lock = easeOut(clamp((t - tl) / 2.2));
      const pos = blobStart.clone().lerp(P.b, lock); blob.position.copy(pos); ell.position.copy(pos);
      const rx = lerp(4.6 * sx, 0.32, lock), ry = lerp(2.5, 0.32, lock);
      ell.scale.set(rx * (1 + 0.03 * Math.sin(t * 3)), ry, 1); ell.material.opacity = 0.85 * blobIn;
      blob.material.opacity = (0.28 + 0.5 * lock) * blobIn; blob.scale.setScalar(lerp(8, 1.6, lock));
      lockRing.material.opacity = lock * (0.6 + 0.4 * Math.sin(t * 5)); lockRing.scale.setScalar(1 + (1 - lock) * 0.6);
      bglow.scale.setScalar(1.4 + 1.2 * smooth(tr, tr + 1, t));
      // quasars appear one by one, then connect
      let conn = 0;
      qg.forEach((g, i) => { const a = easeOut(clamp((t - tq - i * 0.38) / 0.6)); g.scale.setScalar(Math.max(0.001, a)); g.rotation.z = (1 - a) * 1.5; conn = Math.max(conn, a); });
      const qa = qLines.geometry.attributes.position; Q.forEach((p, i) => qa.setXYZ(i * 2, p.x, p.y, 0) || qa.setXYZ(i * 2 + 1, P.star.x, P.star.y, 0)); qa.needsUpdate = true;
      qLines.material.opacity = 0.22 * smooth(tq + 3.6, tq + 5, t) * (1 - lock * 0.7);
      // grid: warped before lock, straight after
      const warp = (1 - lock) * smooth(tq - 0.5, tq + 0.5, t) + (1 - smooth(tq - 0.5, tq + 0.5, t)) * 0.0;
      const x0 = -10 * sx, x1 = 10 * sx, y0 = -4.8, y1 = 4.8; let li = 0;
      for (let i = 0; i < GX; i++) { const x = lerp(x0, x1, i / (GX - 1)); const a = gridLines[li++].geometry.attributes.position; for (let j = 0; j <= SEG; j++) { const [px, py] = gridPos(x, lerp(y0, y1, j / SEG), warp); a.setXYZ(j, px, py, -0.1); } a.needsUpdate = true; }
      for (let i = 0; i < GY; i++) { const y = lerp(y0, y1, i / (GY - 1)); const a = gridLines[li++].geometry.attributes.position; for (let j = 0; j <= SEG; j++) { const [px, py] = gridPos(lerp(x0, x1, j / SEG), y, warp); a.setXYZ(j, px, py, -0.1); } a.needsUpdate = true; }
      gm.opacity = 0.2 * smooth(tq - 0.5, tq + 1, t) * (0.7 + 0.3 * lock);
      camera.position.set(Math.sin(t * 0.07) * 0.6, Math.cos(t * 0.05) * 0.3, 30 - 2.5 * smooth(tl, tr + 2, t));
      camera.lookAt(lerp(0, P.b.x * 0.35, lock), 0, 0);
    },
    overlay(g, { W, H, U }, s) {
      const tr = s.at('result', s.D * 0.82); const a = smooth(tr + 0.8, tr + 1.6, s.t); if (a < 0.01) return;
      const project = (v) => { const vv = v.clone().project(camera); return [(vv.x * 0.5 + 0.5) * W, (-vv.y * 0.5 + 0.5) * H]; };
      g.save(); g.globalAlpha = a; g.strokeStyle = '#ff6b6b'; g.lineWidth = 5 * U;
      for (const p of [P.star, P.c]) { const [x, y] = project(p); const r = 26 * U; g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke(); }
      const [bx, by] = project(P.b); g.strokeStyle = '#7dffb0'; g.lineWidth = 6 * U; g.beginPath(); g.moveTo(bx - 26 * U, by); g.lineTo(bx - 8 * U, by + 20 * U); g.lineTo(bx + 30 * U, by - 24 * U); g.stroke(); g.restore();
    },
  };
}
