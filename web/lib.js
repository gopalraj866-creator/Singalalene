// Shared helpers: math, seeded RNG, procedural shaders, star fields, glow sprites.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeOutBack = (t) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Keyframe interpolation (eased) over [[u, value], ...]; value is a number. */
export function kf(u, keys, ease = (t) => t * t * (3 - 2 * t)) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) {
      const [u0, v0] = keys[i - 1], [u1, v1] = keys[i];
      return lerp(v0, v1, ease((u - u0) / (u1 - u0)));
    }
  }
  return keys[keys.length - 1][1];
}
export function kf3(u, keys, out = new THREE.Vector3()) {
  return out.set(kf(u, keys.map(([k, v]) => [k, v[0]])), kf(u, keys.map(([k, v]) => [k, v[1]])), kf(u, keys.map(([k, v]) => [k, v[2]])));
}

// ---------- GLSL chunks ----------
export const NOISE = /* glsl */ `
float hash31(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vnoise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash31(i+vec3(0,0,0)),hash31(i+vec3(1,0,0)),f.x), mix(hash31(i+vec3(0,1,0)),hash31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash31(i+vec3(0,0,1)),hash31(i+vec3(1,0,1)),f.x), mix(hash31(i+vec3(0,1,1)),hash31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5,s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5;} return s; }
`;

let _glow;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.12, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.14)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.03)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  _glow = new THREE.CanvasTexture(c); _glow.colorSpace = THREE.SRGBColorSpace;
  return _glow;
}
export function glow(color = 0xffffff, size = 1, opacity = 1) {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); return s;
}

// ---------- Stars (round soft points with per-star size/colour/twinkle) ----------
export function makeStars({ n = 3000, rMin = 50, rMax = 120, seed = 1, size = [1.2, 3.2], shell = true, box = null, warm = 0.35, uniforms }) {
  const r = rng(seed);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), sz = new Float32Array(n), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (box) {
      pos[i * 3] = (r() - 0.5) * box[0]; pos[i * 3 + 1] = (r() - 0.5) * box[1]; pos[i * 3 + 2] = (r() - 0.5) * box[2];
    } else {
      const th = r() * Math.PI * 2, ph2 = Math.acos(2 * r() - 1), rad = shell ? rMin + r() * (rMax - rMin) : Math.cbrt(r()) * rMax;
      pos[i * 3] = rad * Math.sin(ph2) * Math.cos(th); pos[i * 3 + 1] = rad * Math.cos(ph2); pos[i * 3 + 2] = rad * Math.sin(ph2) * Math.sin(th);
    }
    const k = r(); const c = new THREE.Color();
    if (k < warm) c.setHSL(0.08 + r() * 0.04, 0.6, 0.78); else if (k < warm + 0.3) c.setHSL(0.6, 0.5, 0.85); else c.setHSL(0.58, 0.15, 0.95);
    const b = 0.35 + Math.pow(r(), 3) * 0.9;
    col[i * 3] = c.r * b; col[i * 3 + 1] = c.g * b; col[i * 3 + 2] = c.b * b;
    sz[i] = size[0] + Math.pow(r(), 4) * (size[1] - size[0]);
    ph[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: uniforms || { uPx: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; attribute float aPhase;
      uniform float uPx; uniform float uTime; varying vec3 vC;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv;
        float tw = 0.8+0.2*sin(uTime*(0.8+aPhase*1.5)+aPhase*60.);
        gl_PointSize = max(1.0, aSize*uPx*tw); vC = aColor*tw; }`,
    fragmentShader: /* glsl */ `varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=pow(smoothstep(1.,0.,d),2.0); gl_FragColor=vec4(vC*a*1.6, a); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.userData.mat = m; return p;
}

// ---------- Planet / star materials ----------
export function gasGiantMaterial({ colA = [0.95, 0.55, 0.25], colB = [0.55, 0.22, 0.12], colC = [0.98, 0.82, 0.55], emit = 0.0, bands = 14, light = new THREE.Vector3(1, 0.3, 0.6) } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uLight: { value: light.clone().normalize() },
      uA: { value: new THREE.Vector3(...colA) }, uB: { value: new THREE.Vector3(...colB) }, uC: { value: new THREE.Vector3(...colC) },
      uEmit: { value: emit }, uBands: { value: bands }, uAmbient: { value: 0.06 },
    },
    vertexShader: /* glsl */ `varying vec3 vObj; varying vec3 vNW; varying vec3 vVW;
      void main(){ vObj = position; vNW = normalize(mat3(modelMatrix)*normal); vec4 wp = modelMatrix*vec4(position,1.); vVW = normalize(cameraPosition-wp.xyz);
        gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `${NOISE}
      varying vec3 vObj; varying vec3 vNW; varying vec3 vVW;
      uniform float uTime, uEmit, uBands, uAmbient; uniform vec3 uLight, uA, uB, uC;
      void main(){
        vec3 p = normalize(vObj); float lat = p.y;
        float turb = fbm(vec3(p.x*2.2, lat*5.0, p.z*2.2) + vec3(0., uTime*0.02, 0.));
        float band = sin(lat*uBands + turb*5.5 + 0.8*fbm(p*9.0));
        float fine = fbm(vec3(p.x*10.0, lat*40.0, p.z*10.0));
        vec3 col = mix(uB, uA, smoothstep(-0.8,0.8,band));
        col = mix(col, uC, smoothstep(0.55,1.0,band+fine*0.5)*0.6);
        col *= 0.8 + 0.4*fine;
        float storm = smoothstep(0.78, 0.9, fbm(p*3.0+7.0)); col = mix(col, uC*1.1, storm*0.4);
        float ndl = dot(normalize(vNW), uLight); float lit = smoothstep(-0.15, 0.85, ndl);
        float fres = pow(1.0-max(dot(normalize(vNW), vVW),0.0), 2.5);
        vec3 c = col*(uAmbient + lit*0.78) + col*uEmit*(0.5+0.4*fine) + uA*fres*0.18*(0.3+lit);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

export function earthMaterial(light = new THREE.Vector3(1, 0.2, 0.5)) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLight: { value: light.clone().normalize() } },
    vertexShader: /* glsl */ `varying vec3 vObj; varying vec3 vNW; varying vec3 vVW;
      void main(){ vObj = position; vNW = normalize(mat3(modelMatrix)*normal); vec4 wp = modelMatrix*vec4(position,1.); vVW = normalize(cameraPosition-wp.xyz);
        gl_Position = projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: /* glsl */ `${NOISE}
      varying vec3 vObj; varying vec3 vNW; varying vec3 vVW; uniform float uTime; uniform vec3 uLight;
      void main(){
        vec3 p = normalize(vObj);
        float h = fbm(p*2.3+3.0) + 0.25*fbm(p*8.0);
        float land = smoothstep(0.62,0.66,h);
        vec3 ocean = mix(vec3(0.01,0.05,0.18), vec3(0.03,0.2,0.45), smoothstep(0.35,0.62,h));
        vec3 ground = mix(vec3(0.1,0.28,0.1), vec3(0.45,0.38,0.22), smoothstep(0.66,0.8,h));
        float ice = smoothstep(0.82,0.93,abs(p.y));
        vec3 col = mix(ocean, ground, land); col = mix(col, vec3(0.9,0.95,1.0), ice);
        float cl = smoothstep(0.52,0.78, fbm(p*3.5+vec3(uTime*0.01,0.,0.))); col = mix(col, vec3(1.0), cl*0.85);
        vec3 n = normalize(vNW); float ndl = dot(n, uLight); float lit = smoothstep(-0.1, 0.5, ndl);
        float city = step(0.86, vnoise(p*90.0))*land*(1.0-cl);
        vec3 c = col*(0.03+lit*0.8) + vec3(1.0,0.8,0.45)*city*(1.0-lit)*0.9;
        float spec = pow(max(dot(reflect(-uLight,n), vVW),0.), 40.)*(1.0-land)*lit*0.5; c += spec;
        gl_FragColor = vec4(c,1.0);
      }`,
  });
}

export function atmosphereMaterial(color = 0x66aaff, power = 3.0, intensity = 1.2) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uI: { value: intensity } },
    vertexShader: /* glsl */ `varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */ `varying vec3 vN; uniform vec3 uColor; uniform float uPower, uI; void main(){ float i = pow(clamp(0.78 - dot(vN, vec3(0.,0.,1.)),0.,1.), uPower); gl_FragColor = vec4(uColor*i*uI, i); }`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}

/** Aurora curtain shells that live in the planet's object space (rotate with the planet). */
export function auroraShells(color = new THREE.Color(0.2, 1.0, 0.55), { colat = 0.34, width = 0.1, shells = [1.004, 1.02, 1.04], strength = 1.0 } = {}) {
  const grp = new THREE.Group(); const mats = [];
  shells.forEach((rad, i) => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: color }, uColat: { value: colat }, uWidth: { value: width * (1 + i * 0.25) }, uI: { value: strength * (1 - i * 0.28) }, uAmt: { value: 1 } },
      vertexShader: /* glsl */ `varying vec3 vObj; void main(){ vObj = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: /* glsl */ `${NOISE}
        varying vec3 vObj; uniform float uTime, uColat, uWidth, uI, uAmt; uniform vec3 uColor;
        void main(){ vec3 p = normalize(vObj); float colat = acos(abs(p.y)); float phi = atan(p.z,p.x);
          float n = fbm(vec3(cos(phi)*3.0, sin(phi)*3.0, uTime*0.6)); float n2 = fbm(vec3(cos(phi)*9.0+uTime*0.4, sin(phi)*9.0, uTime*1.3));
          float c = colat + (n-0.5)*0.12; float ring = exp(-pow((c-uColat)/uWidth, 2.0));
          float curtain = 0.25 + 1.6*pow(n2, 1.6);
          float a = ring*curtain*uI*uAmt; gl_FragColor = vec4(uColor*a, a); }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
    });
    mats.push(m); grp.add(new THREE.Mesh(new THREE.SphereGeometry(rad, 96, 64), m));
  });
  grp.userData.mats = mats; return grp;
}

/** Star surface (emissive, noisy). */
export function starSurface(color = new THREE.Color(0.85, 0.92, 1.0)) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: color } },
    vertexShader: /* glsl */ `varying vec3 vObj; varying vec3 vN; void main(){ vObj = position; vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */ `${NOISE} varying vec3 vObj; varying vec3 vN; uniform float uTime; uniform vec3 uColor;
      void main(){ float n = fbm(normalize(vObj)*5.0+uTime*0.05); float limb = pow(max(vN.z,0.),0.5); vec3 c = uColor*(1.1+0.5*n)*(0.55+0.45*limb); gl_FragColor = vec4(c,1.); }`,
  });
}

export function disposeAll(obj) {
  obj.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
}

export function fitFov(baseFov, aspect, ref = 16 / 9) {
  if (aspect >= ref) return baseFov;
  const f = Math.pow(ref / aspect, 0.62);
  return (2 * Math.atan(Math.tan((baseFov * Math.PI) / 360) * f) * 180) / Math.PI;
}

/** Random point in annulus/disk helpers */
export function ringPoints(n, rIn, rOut, thick, seed) {
  const r = rng(seed); const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const th = r() * Math.PI * 2; const rad = rIn + (rOut - rIn) * Math.pow(r(), 0.7);
    a[i * 3] = Math.cos(th) * rad; a[i * 3 + 2] = Math.sin(th) * rad; a[i * 3 + 1] = (r() + r() + r() - 1.5) * thick * (0.3 + rad / rOut);
  }
  return a;
}

export function pointsMat(color = 0xffffff, size = 2, opacity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uPx: { value: 1 }, uColor: { value: new THREE.Color(color) }, uSize: { value: size }, uOp: { value: opacity } },
    vertexShader: /* glsl */ `uniform float uPx, uSize; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = max(1.0,uSize*uPx); }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uOp; void main(){ float d=length(gl_PointCoord-.5)*2.; float a=pow(smoothstep(1.,0.,d),1.5); gl_FragColor=vec4(uColor*a*uOp, a*uOp); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

export function lineMat(color = 0x66ccff, opacity = 0.6) {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
}

/** Dipole magnetic field lines r = L sin^2(theta) (planet radius = 1), in object space (axis = +Y). */
export function dipolePoint(L, phi, th, out = new THREE.Vector3()) {
  const r = L * Math.sin(th) ** 2;
  return out.set(r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi));
}
export function fieldLines({ Ls = [1.7, 2.3, 3.2, 4.4], nPhi = 10, color = 0x7fd8ff, opacity = 0.35, n = 72 } = {}) {
  const grp = new THREE.Group();
  for (const L of Ls) {
    const th0 = Math.asin(Math.sqrt(1 / L));
    for (let j = 0; j < nPhi; j++) {
      const phi = (j / nPhi) * Math.PI * 2; const pts = [];
      for (let i = 0; i <= n; i++) pts.push(dipolePoint(L, phi, th0 + ((Math.PI - 2 * th0) * i) / n));
      grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat(color, opacity)));
    }
  }
  return grp;
}
