import './style.css'
import * as THREE from 'three'

// --- 1. AUDIO ANALYSIS SETUP ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 512;
const dataArray = new Uint8Array(analyser.frequencyBinCount);
let audioSource = null;

// --- 2. THREE.JS SCENE SETUP ---
const canvas = document.querySelector('#visuals');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Geometries for switching
const knotGeo = new THREE.TorusKnotGeometry(10, 3, 150, 20);
const crystalGeo = new THREE.IcosahedronGeometry(14, 1);
let currentShapeType = 0;

const material = new THREE.MeshBasicMaterial({ 
  color: 0x00f2ff, 
  wireframe: true, 
  transparent: true, 
  opacity: 0.6 
});

let heroShape = new THREE.Mesh(knotGeo, material);
scene.add(heroShape);

// 3. STARFIELD BACKGROUND
const starGeometry = new THREE.BufferGeometry();
const starCount = 3000;
const posArray = new Float32Array(starCount * 3);
for(let i = 0; i < starCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 800; 
}
starGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starMaterial = new THREE.PointsMaterial({
    size: 0.8,
    color: 0xffffff,
    transparent: true,
    opacity: 0.7
});
const starMesh = new THREE.Points(starGeometry, starMaterial);
scene.add(starMesh);

camera.position.z = 45;

// --- 4. UI LOGIC ---
const uiLayer = document.getElementById('ui-layer');
let hideTimeout;

const hideUI = () => uiLayer.classList.add('hidden');
const showUI = () => uiLayer.classList.remove('hidden');

function resetHideTimer() {
  showUI();
  clearTimeout(hideTimeout);
  if (audioSource) {
    hideTimeout = setTimeout(hideUI, 3000);
  }
}

// --- 5. ANIMATION LOOP ---
function animate() {
  requestAnimationFrame(animate);
  analyser.getByteFrequencyData(dataArray);
  
  let bass = 0; 
  for (let i = 0; i < 15; i++) bass += dataArray[i];
  const intensity = bass / 15;

  // Smooth Scaling (Lerp)
  const targetScale = 1 + (intensity / 255) * 1.2;
  const s = THREE.MathUtils.lerp(heroShape.scale.x, targetScale, 0.15);
  heroShape.scale.set(s, s, s);

  // Rotations
  heroShape.rotation.x += 0.005; 
  heroShape.rotation.y += 0.008;
  starMesh.rotation.y += 0.0004;

  // Bass Reactions
  if (intensity > 120) {
    heroShape.material.color.setHex(0xff00ff);
    camera.position.x = (Math.random() - 0.5) * 0.4;
    camera.position.y = (Math.random() - 0.5) * 0.4;
  } else {
    heroShape.material.color.setHex(0x00f2ff);
    camera.position.set(0, 0, 45); 
  }

  renderer.render(scene, camera);
}
animate();

// --- 6. EVENT LISTENERS ---
document.getElementById('change-shape').addEventListener('click', () => {
  currentShapeType = (currentShapeType + 1) % 2;
  heroShape.geometry = currentShapeType === 0 ? knotGeo : crystalGeo;
  resetHideTimer();
});

document.getElementById('audio-upload').addEventListener('change', async (e) => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const file = e.target.files[0];
  if (file) {
    const buffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(buffer);
    if (audioSource) audioSource.stop();
    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = audioBuffer;
    audioSource.connect(analyser);
    analyser.connect(audioCtx.destination);
    hideUI();
    audioSource.start();
    audioSource.onended = () => { showUI(); audioSource = null; };
  }
});

document.getElementById('stop-trip').addEventListener('click', () => {
  if (audioSource) { audioSource.stop(); audioSource = null; }
  showUI();
});

document.getElementById('toggle-ui').addEventListener('click', () => {
  uiLayer.classList.contains('hidden') ? showUI() : hideUI();
});

window.addEventListener('mousemove', resetHideTimer);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});