// Live interactive particle field behind the hero title. Unlike everything
// under composer/src/effects/three/, this is NOT frame-pure -- there's no
// "render this exact frame in isolation" constraint here, a real person is
// watching it continuously, so requestAnimationFrame + real delta-time is
// the correct approach, not something to avoid.
import * as THREE from "https://unpkg.com/three@0.169.0/build/three.module.js";

const PARTICLE_COUNT = 550;
const CAMERA_DISTANCE = 32;
const FOV_DEGREES = 50;
// The visible plane at CAMERA_DISTANCE/FOV_DEGREES is roughly 100x30 world
// units (see visibleSizeAtZ0) -- the first version of these two constants
// (3.2 / 1.6) was tuned as if the field were a handful of units across, so
// the repel zone only ever reached ~14 of 2000 particles: invisible. Scale
// radius/strength to the field's actual size, not arbitrary small numbers.
const REPEL_RADIUS = 16;
const REPEL_STRENGTH = 14;
const MOUSE_EASE = 0.08;
const ACCENT_COLOR = 0x2f5cff;

const vertexShader = `
  attribute float aPhase;
  attribute float aSize;
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uRadius;
  uniform float uStrength;
  varying float vAlpha;

  void main() {
    vec3 pos = position;

    // idle drift -- alive even with no cursor input
    pos.x += sin(uTime * 0.6 + aPhase) * 0.18;
    pos.y += cos(uTime * 0.5 + aPhase * 1.3) * 0.18;

    // repel from (eased, in JS) mouse position
    vec2 toParticle = pos.xy - uMouse;
    float dist = length(toParticle);
    float falloff = smoothstep(uRadius, 0.0, dist);
    if (dist > 0.0001) {
      pos.xy += normalize(toParticle) * falloff * uStrength;
    }

    vAlpha = 0.35 + falloff * 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    float alpha = smoothstep(0.5, 0.0, d) * vAlpha;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function visibleSizeAtZ0(camera) {
  const height = 2 * CAMERA_DISTANCE * Math.tan((FOV_DEGREES / 2) * Math.PI / 180);
  return { width: height * camera.aspect, height };
}

export function initHeroScene(canvas, container) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const camera = new THREE.PerspectiveCamera(FOV_DEGREES, 1, 0.1, 100);
  camera.position.z = CAMERA_DISTANCE;

  const scene = new THREE.Scene();

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  const { width: visW, height: visH } = visibleSizeAtZ0(camera);
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const phases = new Float32Array(PARTICLE_COUNT);
  const sizes = new Float32Array(PARTICLE_COUNT);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * visW * 1.1;
    positions[i * 3 + 1] = (Math.random() - 0.5) * visH * 1.3;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    phases[i] = Math.random() * Math.PI * 2;
    sizes[i] = 1.0 + Math.random() * 2.2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(9999, 9999) },
      uRadius: { value: REPEL_RADIUS },
      uStrength: { value: REPEL_STRENGTH },
      uColor: { value: new THREE.Color(ACCENT_COLOR) },
    },
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const targetMouse = new THREE.Vector2(9999, 9999);
  const smoothedMouse = new THREE.Vector2(9999, 9999);

  const onPointerMove = (event) => {
    const rect = container.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const { width: w, height: h } = visibleSizeAtZ0(camera);
    targetMouse.set(ndcX * (w / 2), ndcY * (h / 2));
  };
  const onPointerLeave = () => targetMouse.set(9999, 9999);

  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  let rafId;
  const tick = () => {
    smoothedMouse.lerp(targetMouse, MOUSE_EASE);
    material.uniforms.uTime.value = clock.getElapsedTime();
    material.uniforms.uMouse.value.copy(smoothedMouse);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  };
  tick();

  return () => {
    cancelAnimationFrame(rafId);
    container.removeEventListener("pointermove", onPointerMove);
    container.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("resize", resize);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}

try {
  const canvas = document.getElementById("hero-canvas");
  const container = document.querySelector(".hero");
  if (canvas && container) {
    initHeroScene(canvas, container);
  }
} catch (err) {
  console.warn("hero-scene: WebGL init failed, falling back to static hero.", err);
}
