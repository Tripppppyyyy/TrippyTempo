import './style.css'
import * as THREE from 'three'
import { redirectToSpotify, fetchToken } from './spotify.js'

// --- 1. STATE & VORTEX TUNING ---
let token = localStorage.getItem('access_token');
let songBeats = [];
let currentPosition = 0;
let lastUpdate = Date.now();
let isPlaying = false;

// Physics Config
const baseScale = 1.0;
const beatExtreme = 4.2;    // Increased for a truly "extreme" bass impact
const springStrength = 0.15; // Controls the "snap" back to base size
const rotationSpeedIdle = 0.004; 
const rotationSpeedActive = 0.012;

// --- 2. AUTHENTICATION ---
async function handleAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (code) {
    const data = await fetchToken(code);
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      window.history.pushState({}, null, "/"); 
      location.reload();
    }
  }
}

// --- 3. SPOTIFY PLAYER SETUP ---
window.onSpotifyWebPlaybackSDKReady = () => {
  if (!token) return;
  const player = new Spotify.Player({
    name: 'TrippyTempo Visualizer',
    getOAuthToken: cb => { cb(token); },
    volume: 0.6
  });

  player.addListener('ready', ({ device_id }) => {
    document.getElementById('spotify-login').innerText = "VORTEX SYNCED";
  });

  player.addListener('player_state_changed', state => {
    if (!state) {
      isPlaying = false;
      return;
    }
    currentPosition = state.position / 1000;
    lastUpdate = Date.now();
    isPlaying = !state.paused;
    fetchBeatData(state.track_window.current_track.id);
  });

  player.connect();
};

async function fetchBeatData(trackId) {
  try {
    const cleanId = trackId.split(':').pop();
    const res = await fetch(`https://api.spotify.com/v1/audio-analysis/${cleanId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    // Confidence filtering ensures only the strongest bass hits trigger the extreme scale
    songBeats = data.beats || [];
  } catch (e) { console.error("Sync Error", e); }
}

// --- 4. THREE.JS WORLD (Vortex & Starfield) ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#visuals'), antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Vortex Geometries
const knotGeo = new THREE.TorusKnotGeometry(10, 3, 150, 20);
const crystalGeo = new THREE.IcosahedronGeometry(14, 1);
const palettes = [{ main: 0x00f2ff, accent: 0xff00ff }, { main: 0x00ffaa, accent: 0xffcc00 }];
let paletteIdx = 0;

const material = new THREE.MeshBasicMaterial({ color: palettes[0].main, wireframe: true, transparent: true, opacity: 0.7 });
let heroShape = new THREE.Mesh(knotGeo, material);
scene.add(heroShape);

// --- SPACE BACKGROUND (Starfield) ---
const starGeometry = new THREE.BufferGeometry();
const starCount = 4000;
const posArray = new Float32Array(starCount * 3);

for (let i = 0; i < starCount * 3; i++) {
  posArray[i] = (Math.random() - 0.5) * 1000; // Large spread for deep space feel
}

starGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starMaterial = new THREE.PointsMaterial({ size: 0.7, color: 0xffffff, transparent: true, opacity: 0.8 });
const starField = new THREE.Points(starGeometry, starMaterial);
scene.add(starField);

camera.position.z = 50;

// --- 5. ANIMATION LOOP (The Physics Engine) ---
function animate() {
  requestAnimationFrame(animate);

  if (isPlaying) {
    const now = Date.now();
    currentPosition += (now - lastUpdate) / 1000;
    lastUpdate = now;
  }

  let intensity = 0;
  
  // BASS DETECTION
  if (isPlaying && songBeats.length > 0) {
    // Look for a beat within a slightly wider window to ensure impact
    const beat = songBeats.find(b => Math.abs(b.start - currentPosition) < 0.08);
    if (beat) {
      // Use the confidence of the beat to determine the "strength" of the scale
      intensity = beat.confidence > 0.2 ? 1.0 : 0.4;
    }
  }

  // SPRING MECHANISM
  const targetScale = baseScale + (intensity * (beatExtreme - baseScale));
  // Use lerp for the "Spring" feel
  heroShape.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), springStrength);

  // ROTATION LOGIC
  const currentRotation = isPlaying ? rotationSpeedActive : rotationSpeedIdle;
  heroShape.rotation.x += currentRotation;
  heroShape.rotation.y += currentRotation * 1.5;
  
  // Rotating the starfield gives the illusion of flying through space
  starField.rotation.y += 0.0005;
  starField.rotation.z += 0.0002;

  // COLOR SHIFT ON BASS
  const p = palettes[paletteIdx];
  if (intensity > 0.5) {
    heroShape.material.color.setHex(p.accent);
    // Add "Camera Kick" on high bass
    camera.position.x = (Math.random() - 0.5) * 1.5;
    camera.position.y = (Math.random() - 0.5) * 1.5;
  } else {
    heroShape.material.color.setHex(p.main);
    camera.position.set(0, 0, 50);
  }

  renderer.render(scene, camera);
}

// --- 6. GHOST UI LOGIC ---
handleAuth();
animate();

let idleTimer;
const uiLayer = document.getElementById('ui-layer');

function showUI() {
  uiLayer.style.opacity = '1';
  uiLayer.style.pointerEvents = 'auto';
  document.body.style.cursor = 'default';
  
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    uiLayer.style.opacity = '0';
    uiLayer.style.pointerEvents = 'none';
    document.body.style.cursor = 'none';
  }, 3000);
}

window.addEventListener('mousemove', showUI);
window.addEventListener('mousedown', showUI);

// Button Listeners
document.getElementById('spotify-login').onclick = () => { if(!token) redirectToSpotify(); };
document.getElementById('change-shape').onclick = () => {
  heroShape.geometry = heroShape.geometry === knotGeo ? crystalGeo : knotGeo;
};
document.getElementById('change-color').onclick = () => {
  paletteIdx = (paletteIdx + 1) % palettes.length;
};
document.getElementById('fullscreen-btn').onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});