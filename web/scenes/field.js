// FIELD: dynamic spectrum reaching 3.5 GHz -> B >= 1,250 gauss -> log-scale comparison with Earth and Jupiter -> lower limit -> quote.
import * as THREE from 'three';
import { makeStars, gasGiantMaterial, atmosphereMaterial, auroraShells, fieldLines, clamp, smooth, lerp, easeOut, rng } from '../lib.js';

export default function create(ctx) {
  const k = ctx.k, portrait = ctx.portrait;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ctx.fov(38), ctx.aspect, 0.05, 1000);
  const bg = makeStars({ n: 4000, rMin: 200, rMax: 400, seed: 81, size: [1.2, 3] }); scene.add(bg);
  const light = new THREE.Vector3(-1, 0.2, 0.4);
  const pl = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), gasGiantMaterial({ colA: [0.62, 0.34, 0.17], colB: [0.3, 0.12, 0.07], colC: [0.85, 0.62, 0.38], emit: 0.14, bands: 13, light })); pl.rotation.z = 0.3; scene.add(pl);
  pl.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), atmosphereMaterial(0xff9a5a, 3.2, 0.9)));
  const aur = auroraShells(new THREE.Color(1.0, 0.25, 0.85), { colat: 0.3, width: 0.1, strength: 1.5 }); pl.add(aur);
  const fl = fieldLines({ Ls: [1.7, 2.4, 3.4, 4.8], nPhi: 12, color: 0xff8be8, opacity: 0.3 }); pl.add(fl);
  const rr = rng(4); const noise = Array.from({ length: 400 }, () => rr());

  const bursts = ctx.bursts;
  const gaussT = (s) => s.at('gauss', s.D * 0.4);
  const cmpT = (s) => Math.max(s.at('compare', s.D * 0.55), portrait ? gaussT(s) + 3.2 : 0);

  return {
    scene, camera, post: { bloom: 0.9, threshold: 0.5, radius: 0.7 },
    labels: {
      key: { cls: 'p-tc', html: '<div class="kicker">The key</div><div class="big sm">HIGHEST FREQUENCY<br>= <span class="cy">MAGNETIC FIELD STRENGTH</span></div>' },
      lower: { cls: 'p-lt', tone: 'am', html: '<div class="k">Only a lower limit</div><div class="v">could be even stronger</div><div class="s">the telescope stops at 3.5 GHz</div>' },
      first: { cls: 'p-tc', tone: 'am', html: '<div class="kicker" style="color:var(--am)">A first</div><div class="big sm">DIRECT MEASUREMENT OF AN<br><em>EXOPLANET’S MAGNETIC FIELD</em></div>' },
      quote: { cls: 'p-lt chip', html: '<div class="quote">“An incredibly, incredibly strong magnetic field, much stronger than anything in our solar system.”<span class="by">Yvette Cendes · astronomer</span></div>', sticky: true },
    },
    update(s) {
      const t = s.t, D = s.D;
      bg.userData.mat.uniforms.uPx.value = ctx.px; bg.userData.mat.uniforms.uTime.value = t;
      pl.material.uniforms.uTime.value = t; aur.userData.mats.forEach((m) => (m.uniforms.uTime.value = t));
      pl.rotation.y = t * 0.5;
      const flare = bursts.reduce((a, b) => a + (t >= b ? Math.exp(-(t - b) * 2.4) : 0), 0);
      aur.userData.mats.forEach((m) => (m.uniforms.uAmt.value = 0.6 + flare * 1.8));
      fl.children.forEach((l) => (l.material.opacity = 0.1 + 0.15 * Math.min(1, flare)));
      // planet sits low-right (landscape) / top (portrait) so the charts stay clear
      const sc = portrait ? 0.7 : 1;
      pl.scale.setScalar(sc);
      const q = smooth(s.at('quote', D * 0.85) - 1, s.at('quote', D * 0.85) + 1.5, t);
      const px = portrait ? 0 : lerp(2.6, 0, q * 0), py = portrait ? 3.4 : -0.2;
      pl.position.set(px, py, 0);
      const az = 0.4 + t * 0.04; camera.position.set(Math.sin(az) * 10.5 * k, 0.8, Math.cos(az) * 10.5 * k); camera.lookAt(portrait ? 0 : 0.6, portrait ? 1.0 : 0, 0);
    },
    overlay(g, { W, H, U, portrait: pt }, s) {
      const t = s.t, D = s.D;
      const kT = s.at('key', 0.5), fT = s.at('freq', D * 0.2), gT = gaussT(s), cT = cmpT(s), lT = s.at('lower', D * 0.8), qT = s.at('quote', D * 0.9);
      const font = (w, px) => `${w} ${px * U}px "Space Grotesk"`;
      // ---- dynamic spectrum panel (key..gauss)
      const spA = smooth(kT + 0.8, kT + 1.6, t) * (1 - smooth(cT - 0.8, cT, t)); if (spA > 0.01) {
        const pw = (pt ? W - 108 * U : W * 0.5), ph = (pt ? 620 * U : H * 0.46), x0 = pt ? 54 * U : 90 * U, y0 = pt ? 620 * U : H * 0.3;
        g.save(); g.globalAlpha = spA;
        g.fillStyle = 'rgba(3,8,22,.7)'; g.strokeStyle = 'rgba(111,220,255,.4)'; g.lineWidth = 1.5 * U; g.beginPath(); g.roundRect(x0, y0, pw, ph, 14 * U); g.fill(); g.stroke();
        const ix = x0 + 70 * U, iy = y0 + 40 * U, iw = pw - 100 * U, ih = ph - 100 * U;
        g.save(); g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
        const win = 7, tt0 = t - win; const cols = 160;
        for (let c = 0; c < cols; c++) { const tc = tt0 + (c / cols) * win; const x = ix + (c / cols) * iw, w = iw / cols + 1;
          for (let rw = 0; rw < 36; rw++) { const f = rw / 36; const y = iy + ih - (rw + 1) * (ih / 36);
            let v = 0.08 + 0.08 * noise[(c * 7 + rw * 13) % 400];
            for (const b of bursts) { const age = tc - b; if (age > 0 && age < 0.9) { const maxF = 1.0; const edge = maxF - 0.35 * age; const inb = f < edge && f > 0.25 - 0.2 * age ? 1 : 0; v += inb * (0.9 - 0.7 * age) * (0.8 + 0.2 * noise[(c * 3 + rw * 5) % 400]); } }
            if (tc < 0) v = 0; v = Math.min(v, 1.2);
            g.fillStyle = `rgba(${Math.min(255, 70 + v * 230)},${Math.min(255, 20 + v * 150)},${Math.min(255, 140 + v * 110)},${Math.min(1, 0.15 + v * 0.95)})`; g.fillRect(x, y, w, ih / 36 + 1);
          } }
        g.restore();
        g.strokeStyle = '#ffbf5a'; g.setLineDash([10 * U, 8 * U]); g.lineWidth = 2.5 * U; g.beginPath(); g.moveTo(ix, iy + 2); g.lineTo(ix + iw, iy + 2); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#ffbf5a'; g.font = font(600, 20); g.textAlign = 'right'; g.fillText('3.5 GHz · top of MeerKAT’s band', ix + iw, iy - 12 * U);
        g.fillStyle = '#8fa6c4'; g.textAlign = 'left'; g.font = font(600, 18); g.fillText('0', x0 + 40 * U, iy + ih); g.save(); g.translate(x0 + 28 * U, iy + ih / 2 + 60 * U); g.rotate(-Math.PI / 2); g.fillText('FREQUENCY (GHz)', 0, 0); g.restore();
        g.textAlign = 'center'; g.fillText('TIME  →  (synthetic illustration of burst behaviour)', ix + iw / 2, iy + ih + 36 * U);
        g.restore();
      }
      // ---- gauss counter
      const gA = smooth(gT - 0.1, gT + 0.5, t) * (1 - smooth(cT - 0.6, cT, t)); if (gA > 0.01) {
        const v = Math.round(1250 * easeOut(clamp((t - gT) / 1.8)));
        g.save(); g.globalAlpha = gA; g.textAlign = 'center'; g.fillStyle = '#6fdcff'; g.font = font(600, pt ? 30 : 26); g.fillText('M A G N E T I C   F I E L D   ≥', W / 2, pt ? 360 * U : H * 0.22);
        g.fillStyle = '#fff'; g.shadowColor = 'rgba(255,95,210,.9)'; g.shadowBlur = 36 * U; g.font = font(700, pt ? 190 : 170); g.fillText(`${v.toLocaleString('en-US')}`, W / 2, pt ? 530 * U : H * 0.22 + 175 * U);
        g.shadowBlur = 0; g.fillStyle = '#ffbf5a'; g.font = font(700, pt ? 60 : 56); g.fillText('GAUSS', W / 2, pt ? 600 * U : H * 0.22 + 245 * U); g.restore();
      }
      // ---- log-scale comparison bars
      const bA = smooth(cT - 0.1, cT + 0.6, t) * (1 - smooth(qT - 0.8, qT, t)); if (bA > 0.01) {
        const items = [['EARTH', 0.5, '0.5 G', '#7dffb0'], ['JUPITER', 14, '≈ 4–14 G', '#6fdcff'], ['BETA PICTORIS b', 1250, '≥ 1,250 G', '#ff5fd2']];
        const x0 = pt ? 54 * U : 120 * U, wMax = (pt ? W - 108 * U : W * 0.52) , y0 = pt ? 900 * U : H * 0.3, rowH = (pt ? 120 : 120) * U;
        const frac = (v) => (Math.log10(v) + 1) / (Math.log10(3000) + 1);
        g.save(); g.globalAlpha = bA; g.fillStyle = '#8fa6c4'; g.font = font(600, 20); g.textAlign = 'left'; g.fillText('SURFACE / EMISSION-SITE FIELD STRENGTH · LOG SCALE', x0, y0 - 40 * U);
        items.forEach(([name, v, txt, col], i) => {
          const a = smooth(cT + 0.4 + i * 0.7, cT + 1.2 + i * 0.7, t); if (a <= 0) return; const y = y0 + i * rowH; const wBar = wMax * frac(v) * easeOut(clamp((t - cT - 0.4 - i * 0.7) / 1.0));
          g.globalAlpha = bA * a; g.fillStyle = '#eaf4ff'; g.font = font(600, 26); g.fillText(name, x0, y + 4 * U);
          g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x0, y + 16 * U, wMax, 30 * U); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 18 * U; g.fillRect(x0, y + 16 * U, Math.max(2, wBar), 30 * U); g.shadowBlur = 0;
          g.fillStyle = col; g.font = font(700, 30); g.textAlign = 'left'; g.fillText(txt, x0 + Math.max(2, wBar) + 16 * U, y + 44 * U);
        });
        // lower-limit arrow on the last bar
        const la = smooth(lT, lT + 0.8, t); if (la > 0) { const y = y0 + 2 * rowH + 30 * U; const xe = x0 + wMax * frac(1250); g.globalAlpha = bA * la; g.strokeStyle = '#ffbf5a'; g.lineWidth = 5 * U; g.setLineDash([10 * U, 8 * U]); g.beginPath(); g.moveTo(xe + 190 * U, y); g.lineTo(xe + 190 * U + 60 * U * (pt ? 0.4 : 1), y); g.stroke(); g.setLineDash([]); g.fillStyle = '#ffbf5a'; g.font = font(700, 30); g.fillText('?', xe + 190 * U + 70 * U * (pt ? 0.4 : 1), y + 10 * U); }
        g.restore();
      }
    },
  };
}
