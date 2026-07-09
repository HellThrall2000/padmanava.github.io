import './style.css';
import * as THREE from 'three';
import Swup from 'swup';

/* ------------------------------------------------------------------ */
/*  Swup page transitions                                              */
/* ------------------------------------------------------------------ */
const swup = new Swup({ containers: ['#swup'] });

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */
const canvas = document.querySelector('#webgl-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d14);

/* Depth fog — particles fade into darkness at the edges */
scene.fog = new THREE.FogExp2(0x0a0d14, 0.053);

/* Slightly wider FOV for depth impression */
const camera = new THREE.PerspectiveCamera(
  62,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0, 0, 7);

const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: false,
  antialias: true,
  preserveDrawingBuffer: import.meta.env.DEV,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

/* ------------------------------------------------------------------ */
/*  Shared assets                                                      */
/* ------------------------------------------------------------------ */

/* Programmatic glow sprite — a soft radial gradient */
function makeGlowTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.15, 'rgba(220,235,250,0.9)');
  gradient.addColorStop(0.5, 'rgba(111,143,169,0.35)');
  gradient.addColorStop(1, 'rgba(111,143,169,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
const glowTexture = makeGlowTexture();

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ------------------------------------------------------------------ */
/*  1. Main particle network (enhanced)                               */
/* ------------------------------------------------------------------ */
const networkGroup = new THREE.Group();
scene.add(networkGroup);

const nodeCount = 160;      // bumped from 128
const fieldSize = 8.5;
const basePositions = new Float32Array(nodeCount * 3);
const nodePositions = new Float32Array(nodeCount * 3);
const nodeSeeds = new Float32Array(nodeCount);
const nodeSpeeds = new Float32Array(nodeCount);       // per-node speed multiplier
const nodeColors = new Float32Array(nodeCount * 3);  // per-node colour offset

for (let i = 0; i < nodeCount; i += 1) {
  const idx = i * 3;
  const radiusBias = 0.35 + Math.random() * 0.65;

  basePositions[idx]     = (Math.random() - 0.5) * fieldSize * radiusBias;
  basePositions[idx + 1] = (Math.random() - 0.5) * fieldSize * 0.75 * radiusBias;
  basePositions[idx + 2] = (Math.random() - 0.5) * fieldSize * 0.88;

  nodeSeeds[i]  = Math.random() * Math.PI * 2;
  nodeSpeeds[i] = 0.6 + Math.random() * 0.8;
  nodeColors[i]     = 0.45 + Math.random() * 0.55;  // R offset
  nodeColors[i + 1] = 0.50 + Math.random() * 0.50;  // G offset
  nodeColors[i + 2] = 0.55 + Math.random() * 0.45;  // B offset

  nodePositions[idx]     = basePositions[idx];
  nodePositions[idx + 1] = basePositions[idx + 1];
  nodePositions[idx + 2] = basePositions[idx + 2];
}

/* --- particles (glow sprites) --- */
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));

const particleMaterial = new THREE.PointsMaterial({
  map: glowTexture,
  color: 0x6f8fa9,
  size: 0.38,
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
  sizeAttenuation: true,
  blending: THREE.AdditiveBlending,
});

const particleMesh = new THREE.Points(particleGeometry, particleMaterial);
networkGroup.add(particleMesh);

/* --- proximity connections --- */
const proximityPairs = [];
for (let i = 0; i < nodeCount; i += 1) {
  for (let j = i + 1; j < nodeCount; j += 1) {
    const ax = basePositions[i * 3];
    const ay = basePositions[i * 3 + 1];
    const az = basePositions[i * 3 + 2];
    const bx = basePositions[j * 3];
    const by = basePositions[j * 3 + 1];
    const bz = basePositions[j * 3 + 2];
    const dist = Math.hypot(ax - bx, ay - by, az - bz);
    if (dist < 2.0) proximityPairs.push([i, j, dist]);
  }
}
proximityPairs.sort((a, b) => a[2] - b[2]);
const connections = proximityPairs.slice(0, 300);
const linePositions = new Float32Array(connections.length * 6);
const lineGeometry = new THREE.BufferGeometry();
lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

const lineMaterial = new THREE.LineBasicMaterial({
  color: 0x6f8fa9,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});
const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
networkGroup.add(lineMesh);

/* ------------------------------------------------------------------ */
/*  2. Central wireframe icosahedron                                   */
/* ------------------------------------------------------------------ */
const icosahedronGroup = new THREE.Group();
scene.add(icosahedronGroup);

const icoGeo = new THREE.IcosahedronGeometry(1.5, 0);
const icoWire = new THREE.EdgesGeometry(icoGeo);

const icoLines = new THREE.LineSegments(
  icoWire,
  new THREE.LineBasicMaterial({
    color: 0x6f8fa9,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
  }),
);

/* Inner glow ring — a slightly smaller, brighter wireframe */
const icoInner = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.3, 0)),
  new THREE.LineBasicMaterial({
    color: 0x8fafc9,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
  }),
);

icosahedronGroup.add(icoLines);
icosahedronGroup.add(icoInner);

/* Small emitted particles orbiting the icosahedron */
const orbitCount = 48;
const orbitPos = new Float32Array(orbitCount * 3);
const orbitGeo = new THREE.BufferGeometry();
orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPos, 3));
const orbitMat = new THREE.PointsMaterial({
  map: glowTexture,
  color: 0x8fafc9,
  size: 0.08,
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true,
});
const orbitMesh = new THREE.Points(orbitGeo, orbitMat);
icosahedronGroup.add(orbitMesh);

const orbitData = [];
for (let i = 0; i < orbitCount; i += 1) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const radius = 1.9 + Math.random() * 0.8;
  orbitData.push({
    theta,
    phi,
    radius,
    speed: 0.15 + Math.random() * 0.25,
    phase: Math.random() * Math.PI * 2,
  });
}

/* ------------------------------------------------------------------ */
/*  3. Background starfield — tiny dim specks far away                 */
/* ------------------------------------------------------------------ */
const starCount = 600;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount * 3; i += 1) {
  starPos[i] = (Math.random() - 0.5) * 50;
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({
  color: 0x8fafc9,
  size: 0.04,
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
  sizeAttenuation: true,
});
const starMesh = new THREE.Points(starGeo, starMat);
scene.add(starMesh);

/* ------------------------------------------------------------------ */
/*  Pointer tracking                                                   */
/* ------------------------------------------------------------------ */
let pointerX = 0;
let pointerY = 0;
let targetPointerX = 0;
let targetPointerY = 0;
let viewportHalfX = window.innerWidth / 2;
let viewportHalfY = window.innerHeight / 2;

window.addEventListener('pointermove', (event) => {
  targetPointerX = (event.clientX - viewportHalfX) / viewportHalfX;
  targetPointerY = (event.clientY - viewportHalfY) / viewportHalfY;
});
window.addEventListener('pointerleave', () => {
  targetPointerX = 0;
  targetPointerY = 0;
});

/* ------------------------------------------------------------------ */
/*  Swup lifecycle — runs on every page view (initial + Swup swap)    */
/* ------------------------------------------------------------------ */
const initPageView = () => {
  /* 1. Scroll to top — Swup does not reset scroll position */
  window.scrollTo({ top: 0, behavior: 'instant' });

  /* 2. Update nav active state */
  const currentPath = window.location.pathname;
  const normalizedCurrent = currentPath === '/index.html' ? '/' : currentPath;
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const linkPath = new URL(link.href).pathname;
    const normalizedLink = linkPath === '/index.html' ? '/' : linkPath;
    const isActive = normalizedCurrent === normalizedLink;
    link.classList.toggle('is-active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });
};
swup.hooks.on('page:view', initPageView);
initPageView();

/* ------------------------------------------------------------------ */
/*  Tick / animation loop                                              */
/* ------------------------------------------------------------------ */
const updateOrbitPositions = (elapsedTime, ms) => {
  const mScale = reducedMotionQuery.matches ? 0.25 : 1;
  const positions = orbitMesh.geometry.attributes.position.array;

  for (let i = 0; i < orbitCount; i += 1) {
    const d = orbitData[i];
    const t = elapsedTime * d.speed + d.phase;
    const idx = i * 3;
    positions[idx]     = Math.sin(t + d.theta) * Math.cos(t * 0.7 + d.phi) * d.radius;
    positions[idx + 1] = Math.sin(t * 0.8 + d.phi) * Math.cos(t + d.theta * 0.6) * d.radius * 0.7;
    positions[idx + 2] = Math.cos(t * 0.6 + d.theta) * d.radius * 0.6;
  }
  orbitMesh.geometry.attributes.position.needsUpdate = true;

  /* Pulse inner wireframe opacity */
  const pulse = 0.5 + Math.sin(elapsedTime * 0.4) * 0.5;
  icoInner.material.opacity = 0.04 + pulse * 0.06;
};

const updateNodePositions = (elapsedTime) => {
  const mScale = reducedMotionQuery.matches ? 0.25 : 1;
  const ms = reducedMotionQuery.matches ? 0.25 : 1;

  for (let i = 0; i < nodeCount; i += 1) {
    const idx = i * 3;
    const seed = nodeSeeds[i];
    const spd = nodeSpeeds[i];
    const depthInf = 1 - Math.min(Math.abs(basePositions[idx + 2]) / fieldSize, 0.9);

    const drift  = Math.sin(elapsedTime * 0.6 * spd + seed) * 0.10 * ms;
    const rise   = Math.cos(elapsedTime * 0.42 * spd + seed * 0.7) * 0.08 * ms;
    const wobble = Math.sin(elapsedTime * 0.3 * spd + seed) * 0.06 * ms;

    /* Mouse-repulsion effect — particles drift away from pointer */
    const repX = pointerX * depthInf * 0.22;
    const repY = -pointerY * depthInf * 0.18;

    nodePositions[idx]     = basePositions[idx] + drift + repX;
    nodePositions[idx + 1] = basePositions[idx + 1] + rise + repY;
    nodePositions[idx + 2] = basePositions[idx + 2] + wobble;
  }
  particleGeometry.attributes.position.needsUpdate = true;
};

const updateLinePositions = () => {
  connections.forEach(([from, to], ci) => {
    const li = ci * 6;
    const fi = from * 3;
    const ti = to * 3;
    linePositions[li]     = nodePositions[fi];
    linePositions[li + 1] = nodePositions[fi + 1];
    linePositions[li + 2] = nodePositions[fi + 2];
    linePositions[li + 3] = nodePositions[ti];
    linePositions[li + 4] = nodePositions[ti + 1];
    linePositions[li + 5] = nodePositions[ti + 2];
  });
  lineGeometry.attributes.position.needsUpdate = true;
};

const tick = (time) => {
  const elapsed = time * 0.001;
  const motionScale = reducedMotionQuery.matches ? 0.35 : 1;

  /* Smooth pointer interpolation */
  pointerX += (targetPointerX - pointerX) * 0.055;
  pointerY += (targetPointerY - pointerY) * 0.055;

  /* Update particle network */
  updateNodePositions(elapsed);
  updateLinePositions();

  /* Rotate network group */
  networkGroup.rotation.y = elapsed * 0.025 * motionScale + pointerX * 0.12;
  networkGroup.rotation.x = pointerY * 0.06;
  networkGroup.rotation.z = Math.sin(elapsed * 0.06) * 0.02 * motionScale;

  /* Rotate icosahedron (independent, slower) */
  icosahedronGroup.rotation.x = elapsed * 0.08 * motionScale;
  icosahedronGroup.rotation.y = elapsed * 0.12 * motionScale + pointerX * 0.06;
  icosahedronGroup.rotation.z = Math.sin(elapsed * 0.04) * 0.04 * motionScale;

  /* Orbit particles update */
  updateOrbitPositions(elapsed);

  /* Slowly rotate starfield */
  starMesh.rotation.y += 0.00015 * motionScale;

  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
};

window.requestAnimationFrame(tick);

/* ------------------------------------------------------------------ */
/*  Scroll-reveal (IntersectionObserver)                               */
/* ------------------------------------------------------------------ */

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08, rootMargin: '0px 0px -30px 0px' },
);

/* Observe existing reveal elements and re-run after Swup page navigations */
const observeReveals = () => {
  document.querySelectorAll('.reveal:not(.revealed)').forEach((el) => {
    revealObserver.observe(el);
  });
};
swup.hooks.on('page:view', observeReveals);
observeReveals();

/* ------------------------------------------------------------------ */
/*  Resize handler                                                     */
/* ------------------------------------------------------------------ */
window.addEventListener('resize', () => {
  viewportHalfX = window.innerWidth / 2;
  viewportHalfY = window.innerHeight / 2;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});
