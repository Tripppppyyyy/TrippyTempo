import './style.css'
import * as THREE from 'three'
import { redirectToSpotify, fetchToken } from './spotify.js'

let token = localStorage.getItem('access_token');
let songBeats = [];
let currentPosition = 0;
let lastUpdate = Date.now();
let isPlaying = false;

// --- 1. THE "WAKE UP" HANDLER ---
// Browsers block audio data until a click happens. 
async function activateVisualizer() {
  if (!token) return;
  console.log("Visualizer Activated");
  const btn = document.getElementById('spotify-login');
  if (btn) btn.innerText = "SYNCING...";
}
window.addEventListener('click', activateVisualizer, { once: true });

// --- 2. AUTH & PLAYER SETUP ---
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

window.onSpotifyWebPlaybackSDKReady = () => {
  if (!token) return;
  const player = new Spotify.Player({
    name: 'TrippyTempo Visualizer',
    getOAuthToken: cb => { cb(token); },
    volume: 0.5
  });

  player.addListener('ready', ({ device_id }) => {
    console.log('Ready! Device ID:', device_id);
    document.getElementById('spotify-login').innerText = "DEVICE READY";
  });

  player.addListener('player_state_changed', state => {
    if (!state) return;
    
    // Exact Sync from Spotify
    currentPosition = state.position / 1000;
    lastUpdate = Date.now();
    isPlaying = !state.paused;

    const trackId = state.track_window.current_track.id;
    const trackName = state.track_window.current_track.name;
    
    console.log(`Now Playing: ${trackName}`);
    fetchBeatData(trackId);
  });

  player.connect();
};

async function fetchBeatData(trackId) {
  try {
    const res = await fetch(`https://api.spotify.com/v1/audio-analysis/${trackId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.status === 401) {
       localStorage.removeItem('access_token');
       redirectToSpotify();
    }

    const data = await res.json();
    songBeats = data.beats || [];
    console.log(`✅ Beats Loaded: ${songBeats.length}`);
  } catch (e) { 
    console.error("Beat fetch failed", e); 
  }
}

// --- 3. THREE.JS WORLD ---
const canvas = document.querySelector('#visuals');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Knot and Palette Setup
const knotGeo = new THREE.TorusKnotGeometry(10, 3, 150, 20);
const crystalGeo = new THREE.IcosahedronGeometry(14, 1);
let currentShapeType = 0;
const palettes = [{ main: 0x00f2ff, accent: 0xff00ff }, { main: 0x00ffaa, accent: 0xffcc00 }, { main: 0xff4444, accent: 0x00f2ff }, { main: 0x7700ff, accent: 0x00ffaa }];
let paletteIdx = 0;

const material = new THREE.MeshBasicMaterial({ color: palettes[0].main, wireframe: true, transparent: true, opacity: 0.6 });
let heroShape = new THREE.Mesh(knotGeo, material);
scene.add(heroShape);

// Stars
const starGeometry = new THREE.BufferGeometry();
const posArray = new Float32Array(3000 * 3);
for(let i = 0; i < 3000 * 3; i++) posArray[i] = (Math.random() - 0.5) * 800;
starGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starMesh = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 0.8, color: 0xffffff, transparent: true, opacity: 0.7 }));
scene.add(starMesh);

camera.position.z = 45;

// --- 4. ANIMATION LOOP ---
function animate() {
  requestAnimationFrame(animate);

  if (isPlaying && songBeats.length > 0) {
    const now = Date.now();
    const dt = (now - lastUpdate) / 1000;
    currentPosition += dt;
    lastUpdate = now;
  }

  let intensity = 0;
  // Look for a beat within a 100ms window
  const beat = songBeats.find(b => Math.abs(b.start - currentPosition) < 0.1);
  
  if (beat) {
    intensity = 255;
  }

  // Scaling Logic
  const targetScale = 1 + (intensity / 255) * 1.5;
  heroShape.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);
  
  // Rotation
  heroShape.rotation.x += 0.005;
  heroShape.rotation.y += 0.01;
  starMesh.rotation.y += 0.0004;

  // Colors and Camera Shake
  const p = palettes[paletteIdx];
  if (intensity > 150) {
    heroShape.material.color.setHex(p.accent);
    camera.position.x = (Math.random() - 0.5) * 0.5;
    camera.position.y = (Math.random() - 0.5) * 0.5;
  } else {
    heroShape.material.color.setHex(p.main);
    camera.position.set(0, 0, 45);
  }

  renderer.render(scene, camera);
}

// --- 5. START UP ---
handleAuth();
animate();

// --- 6. UI ---
document.getElementById('spotify-login').onclick = redirectToSpotify;
document.getElementById('change-shape').onclick = () => {
  currentShapeType = (currentShapeType + 1) % 2;
  heroShape.geometry = currentShapeType === 0 ? knotGeo : crystalGeo;
};
document.getElementById('change-color').onclick = () => {
  paletteIdx = (paletteIdx + 1) % palettes.length;
};