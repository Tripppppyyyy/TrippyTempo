import './style.css'
import * as THREE from 'three'

// --- 1. AUDIO SETUP ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 512;
const dataArray = new Uint8Array(analyser.frequencyBinCount);

let isPlaying = false;
let currentStep = 0;
let nextStepTime = 0;
let tempo = 120.0;
const scheduleAheadTime = 0.1;
let audioSource = null;

const instruments = [
  { name: 'BASS', freq: 60, type: 'sine', decay: 0.2 },
  { name: 'SNARE', freq: 200, type: 'square', decay: 0.1 },
  { name: 'HATS', freq: 1000, type: 'triangle', decay: 0.05 },
  { name: 'SYNTH', freq: 440, type: 'sawtooth', decay: 0.3 }
];

// --- 2. GENERATE UI ---
const container = document.getElementById('sequencer-container');
instruments.forEach((inst) => {
  const row = document.createElement('div');
  row.classList.add('grid-row');
  row.dataset.name = inst.name;
  for (let i = 0; i < 16; i++) {
    const step = document.createElement('div');
    step.classList.add('step');
    step.addEventListener('click', () => {
      step.classList.toggle('selected');
      resetHideTimer();
    });
    row.appendChild(step);
  }
  container.appendChild(row);
});

// --- 3. THREE.JS VISUALS ---
const canvas = document.querySelector('#visuals');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const geometry = new THREE.TorusKnotGeometry(12, 4, 150, 20);
const material = new THREE.MeshBasicMaterial({ color: 0x00f2ff, wireframe: true, transparent: true, opacity: 0.6 });
const heroShape = new THREE.Mesh(geometry, material);
scene.add(heroShape);
camera.position.z = 45;

// --- 4. AUDIO LOGIC ---
function playInstrument(instIdx, time) {
  const inst = instruments[instIdx];
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.type = inst.type;
  osc.frequency.setValueAtTime(inst.freq, time);
  if (inst.name === 'BASS') osc.frequency.exponentialRampToValueAtTime(30, time + inst.decay);
  env.gain.setValueAtTime(0.5, time);
  env.gain.exponentialRampToValueAtTime(0.001, time + inst.decay);
  osc.connect(env); env.connect(analyser); analyser.connect(audioCtx.destination);
  osc.start(time); osc.stop(time + inst.decay);
}

function scheduleNote(stepIndex, time) {
  const rows = document.querySelectorAll('.grid-row');
  rows.forEach((row, idx) => {
    const steps = row.querySelectorAll('.step');
    setTimeout(() => {
      if (!isPlaying) return;
      steps.forEach(s => s.classList.remove('active'));
      steps[stepIndex].classList.add('active');
    }, (time - audioCtx.currentTime) * 1000);
    if (steps[stepIndex].classList.contains('selected')) playInstrument(idx, time);
  });
}

// --- 5. UI AUTO-HIDE LOGIC ---
const uiLayer = document.getElementById('ui-layer');
let hideTimeout;

const hideUI = () => uiLayer.classList.add('hidden');
const showUI = () => uiLayer.classList.remove('hidden');

function resetHideTimer() {
  showUI();
  clearTimeout(hideTimeout);
  // Auto-hide after 4 seconds of play or interaction
  if (isPlaying || audioSource) {
    hideTimeout = setTimeout(hideUI, 4000);
  }
}

// --- 6. EVENT LISTENERS ---
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

document.getElementById('play-pause').addEventListener('click', (e) => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  isPlaying = !isPlaying;
  e.target.innerText = isPlaying ? "Pause" : "Start";
  if (isPlaying) {
    nextStepTime = audioCtx.currentTime;
    ticker();
    resetHideTimer();
  } else {
    showUI();
    clearTimeout(hideTimeout);
  }
});

document.getElementById('stop-trip').addEventListener('click', () => {
  isPlaying = false;
  if (audioSource) { audioSource.stop(); audioSource = null; }
  showUI();
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
});

document.getElementById('randomize-beat').addEventListener('click', () => {
  document.querySelectorAll('.step').forEach(s => {
    s.classList.remove('selected');
    if (Math.random() > 0.85) s.classList.add('selected');
  });
  resetHideTimer();
});

document.getElementById('toggle-ui').addEventListener('click', () => {
  uiLayer.classList.contains('hidden') ? showUI() : hideUI();
});

window.addEventListener('mousemove', resetHideTimer);

function ticker() {
  if (isPlaying) {
    while (nextStepTime < audioCtx.currentTime + scheduleAheadTime) {
      scheduleNote(currentStep, nextStepTime);
      nextStepTime += 0.25 * (60.0 / tempo);
      currentStep = (currentStep + 1) % 16;
    }
    requestAnimationFrame(ticker);
  }
}

function animate() {
  requestAnimationFrame(animate);
  analyser.getByteFrequencyData(dataArray);
  let bass = 0; for (let i = 0; i < 15; i++) bass += dataArray[i];
  const intensity = bass / 15;
  const scale = 1 + (intensity / 255) * 1.5;
  heroShape.scale.set(scale, scale, scale);
  heroShape.rotation.x += 0.005; heroShape.rotation.y += 0.008;
  heroShape.material.color.setHex(intensity > 115 ? 0xff00ff : 0x00f2ff);
  renderer.render(scene, camera);
}
animate();

document.getElementById('bpm').addEventListener('input', (e) => {
  tempo = e.target.value;
  document.getElementById('bpm-value').innerText = tempo;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});