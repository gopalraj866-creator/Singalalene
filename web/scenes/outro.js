// OUTRO: Earth's 1960s broadcasts form a 63 light-year bubble that is only now reaching Beta Pictoris; end card with CTA.
import * as THREE from 'three';
import { makeStars, earthMaterial, atmosphereMaterial, glow, clamp, smooth, lerp, easeInOut, lineMat } from '../lib.js';

export default function create(ctx) {
  const k = ctx.k, portrait = ctx.portrait;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(ctx.fov(40), ctx.aspect, 0.05, 2000);
  const bg = makeStars({ n: 6000, rMin: 300, rMax: 700, seed: 121, size: [1.3, 3.4] }); scene.add(bg);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), earthMaterial(new THREE.Vector3(1, 0.3, 0.6))); earth.rotation.z = 0.41; scene.add(earth);
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 32), atmosphereMaterial(0x4f9bff, 3, 1.3)));
  const RB = 16; // distance to Beta Pictoris in scene units (stands for 63 ly)
  const bp = glow(0xdff0ff, 2.4, 1); bp.position.set(RB * 0.8, RB * 0.25, -RB * 0.55); scene.add(bp);
  const bpc = glow(0xffffff, 0.8, 1); bpc.position.copy(bp.position); scene.add(bpc);
  const dist = bp.position.length();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(0xff7fe6) }, uO: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; uniform vec3 uC; uniform float uO; void main(){ float f = pow(1.0-abs(dot(vN,vV)), 2.2); gl_FragColor = vec4(uC*f*1.4, f*uO); }',
  })); scene.add(shell);
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 24, 16)), lineMat(0xff7fe6, 0.0)); scene.add(wire);
  const hit = glow(0xff7fe6, 3, 0); hit.position.copy(bp.position); scene.add(hit);
  const cam = new THREE.Vector3();

  return {
    scene, camera, post: { bloom: 0.95, threshold: 0.5, radius: 0.7 },
    labels: {
      bubble: { cls: 'p-lt', tone: 'mg', html: '<div class="k">Broadcasts from the 1960s</div><div class="v">≈ 63 light-years out</div><div class="s">only now reaching Beta Pictoris · far too faint to notice</div>' },
      cta: { cls: 'p-c', sticky: true, html: `<div class="kicker">What do you think?</div><div class="big sm">WILL WE EVER HEAR<br>A <span class="cy">REAL MESSAGE?</span></div><div class="s" style="text-align:center;margin-top:calc(var(--u)*26)">Tell me in the comments · <b style="color:var(--am)">Subscribe</b> for more space science</div>` },
    },
    update(s) {
      const t = s.t, D = s.D;
      bg.userData.mat.uniforms.uPx.value = ctx.px; bg.userData.mat.uniforms.uTime.value = t;
      earth.material.uniforms.uTime.value = t; earth.rotation.y = t * 0.15;
      const t0 = s.at('bubble', 0.8), t1 = (s.endAt('bubble', D * 0.4)) ;
      const p = easeInOut(clamp((t - t0) / Math.max(4, t1 - t0 - 0.8)));
      const R = lerp(1.3, dist, p); shell.scale.setScalar(R); wire.scale.setScalar(R);
      shell.material.uniforms.uO.value = 0.8 * smooth(t0 - 0.2, t0 + 0.6, t); wire.material.opacity = 0.05 * smooth(t0 - 0.2, t0 + 0.6, t);
      const arrive = smooth(0.96, 1.0, p); hit.material.opacity = arrive * (0.6 + 0.4 * Math.sin(t * 8)); hit.scale.setScalar(3 + 4 * arrive);
      const tc = s.at('cta', D * 0.7); const back = smooth(t0, t1, t);
      const az = 0.4 + t * 0.03; const dd = Math.max(4.2, R * 3.3 + 4) * k;
      cam.set(Math.sin(az) * dd, lerp(0.6, dd * 0.28, back), Math.cos(az) * dd); camera.position.copy(cam);
      camera.lookAt(lerp(0, bp.position.x * 0.35, back), lerp(0, bp.position.y * 0.3, back), lerp(0, bp.position.z * 0.35, back));
    },
  };
}
