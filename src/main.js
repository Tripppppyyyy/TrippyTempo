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
const beatExtreme = 3.8;    // Significant jump for "extreme" feel
const smoothFactor = 0.12;  // Springy return
const rotationSpeedIdle = 0.005; // Elegant slow spin
const rotationSpeedActive = 0.015; // Faster when music plays

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
    volume: 0.5
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
    // Filter for "stronger" beats to avoid the "random jitter" feel
    songBeats = data.beats.filter(b => b.confidence > 0.1) || [];
  } catch (e) { console.error("Sync Error", e); }
}

// --- 4. THREE.JS WORLD ---
const canvas = document.querySelector('#visuals');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const knotGeo = new THREE.TorusKnotGeometry(10, 3, 150, 20);
const crystalGeo = new THREE.IcosahedronGeometry(14, 1);
const palettes = [{ main: 0x00f2ff, accent: 0xff00ff }, { main: 0x00ffaa, accent: 0xffcc00 }];
let paletteIdx = 0;

const material = new THREE.MeshBasicMaterial({ color: palettes[0].main, wireframe: true, transparent: true, opacity: 0.6 });
let heroShape = new THREE.Mesh(knotGeo, material);
scene.add(heroShape);
camera.position.z = 45;

// --- 5. ANIMATION LOOP ---
function animate() {
  requestAnimationFrame(animate);

  if (isPlaying) {
    const now = Date.now();
    currentPosition += (now - lastUpdate) / 1000;
    lastUpdate = now;
  }

  let intensity = 0;
  
  // SYNC LOGIC: Only trigger on actual data
  if (isPlaying && songBeats.length > 0) {
    const beat = songBeats.find(b => Math.abs(b.start - currentPosition) < 0.06);
    if (beat) intensity = 1.0;
  }

  // Vortex Scaling
  const targetScale = baseScale + (intensity * (beatExtreme - baseScale));
  heroShape.scale.x = THREE.MathUtils.lerp(heroShape.scale.x, targetScale, smoothFactor);
  heroShape.scale.y = THREE.MathUtils.lerp(heroShape.scale.y, targetScale, smoothFactor);
  heroShape.scale.z = THREE.MathUtils.lerp(heroShape.scale.z, targetScale, smoothFactor);

  // Rotation Speed Adjustment
  const rSpeed = isPlaying ? rotationSpeedActive : rotationSpeedIdle;
  heroShape.rotation.x += rSpeed;
  heroShape.rotation.y += rSpeed * 1.5;

  // Colors
  const p = palettes[paletteIdx];
  heroShape.material.color.setHex(intensity > 0.5 ? p.accent : p.main);

  renderer.render(scene, camera);
}

// --- 6. GHOST UI LOGIC (Mouse Tracking) ---
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
    document.body.style.cursor = 'none'; // Hide cursor too for full immersion
  }, 3000);
}

// Listen for any mouse activity
window.addEventListener('mousemove', showUI);
window.addEventListener('mousedown', showUI);
window.addEventListener('keydown', showUI);

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