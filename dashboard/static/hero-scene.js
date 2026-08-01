// Live interactive particle field behind the hero title. Unlike everything
// under composer/src/effects/three/, this is NOT frame-pure -- there's no
// "render this exact frame in isolation" constraint here, a real person is
// watching it continuously, so requestAnimationFrame + real delta-time is
// the correct approach, not something to avoid.
import * as THREE from "three";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

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
const TEXT_TILT_MAX = 0.22; // radians -- subtle, not a full look-at
const TEXT_EASE = 0.06;

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

  // Lighting for the 3D text mesh -- points/ShaderMaterial above doesn't
  // need it (unlit, additive), but MeshStandardMaterial does.
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const keyLight = new THREE.PointLight(0xffffff, 90, 0, 2);
  keyLight.position.set(-10, 6, 14);
  scene.add(keyLight);
  const rimLight = new THREE.PointLight(ACCENT_COLOR, 60, 0, 2);
  rimLight.position.set(12, -4, 10);
  scene.add(rimLight);

  // 3D "zhiying" wordmark -- same extrude/bevel/center recipe as
  // composer/src/effects/three/TextIntro3D.tsx, ported to vanilla Three.js
  // since this runs in the browser directly, not through Remotion. Reuses
  // the same font asset (copied into dashboard/static/fonts/).
  let textMesh = null;
  const targetTilt = new THREE.Vector2(0, 0);
  const smoothedTilt = new THREE.Vector2(0, 0);
  const fontLoader = new FontLoader();
  fontLoader.load(
    "/static/fonts/helvetiker_bold.typeface.json",
    (font) => {
      const textGeo = new TextGeometry("zhiying", {
        font,
        size: 6.4,
        depth: 1.6,
        curveSegments: 8,
        bevelEnabled: true,
        bevelThickness: 0.14,
        bevelSize: 0.12,
        bevelSegments: 3,
      });
      textGeo.computeBoundingBox();
      const box = textGeo.boundingBox;
      textGeo.translate(-(box.max.x - box.min.x) / 2, -(box.max.y - box.min.y) / 2, 0);

      const textMaterial = new THREE.MeshStandardMaterial({
        color: 0xf2f2ee,
        metalness: 0.25,
        roughness: 0.35,
      });
      textMesh = new THREE.Mesh(textGeo, textMaterial);
      // Roughly where the flat HTML title used to sit: left-of-center,
      // upper portion of the hero. Hand-tuned against screenshots rather
      // than derived from the HTML title's exact box -- this is a hero
      // flourish, not a layout that needs pixel-perfect handoff.
      textMesh.position.set(-16, 4, 0);
      scene.add(textMesh);

      const heroTitle = document.querySelector(".hero-title");
      if (heroTitle) heroTitle.style.visibility = "hidden";
    },
    undefined,
    (err) => console.warn("hero-scene: font load failed, keeping flat HTML title.", err),
  );

  const targetMouse = new THREE.Vector2(9999, 9999);
  const smoothedMouse = new THREE.Vector2(9999, 9999);

  const onPointerMove = (event) => {
    const rect = container.getBoundingClientRect();
    const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const { width: w, height: h } = visibleSizeAtZ0(camera);
    targetMouse.set(ndcX * (w / 2), ndcY * (h / 2));
    targetTilt.set(ndcY * TEXT_TILT_MAX, ndcX * TEXT_TILT_MAX);
  };
  const onPointerLeave = () => {
    targetMouse.set(9999, 9999);
    targetTilt.set(0, 0);
  };

  container.addEventListener("pointermove", onPointerMove);
  container.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("resize", resize);

  const clock = new THREE.Clock();
  let rafId;
  const tick = () => {
    const t = clock.getElapsedTime();
    smoothedMouse.lerp(targetMouse, MOUSE_EASE);
    material.uniforms.uTime.value = t;
    material.uniforms.uMouse.value.copy(smoothedMouse);

    if (textMesh) {
      smoothedTilt.lerp(targetTilt, TEXT_EASE);
      textMesh.rotation.x = smoothedTilt.x;
      textMesh.rotation.y = smoothedTilt.y + Math.sin(t * 0.15) * 0.03;
    }

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
    if (textMesh) {
      textMesh.geometry.dispose();
      textMesh.material.dispose();
    }
    renderer.dispose();
    const heroTitle = document.querySelector(".hero-title");
    if (heroTitle) heroTitle.style.visibility = "";
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
