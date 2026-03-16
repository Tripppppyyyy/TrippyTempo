import './style.css'
import * as THREE from 'three'
import { redirectToSpotify, fetchToken } from './spotify.js'

// --- 1. STATE ---
let token = localStorage.getItem('access_token');
let songBeats = [];
let currentPosition = 0;
let lastUpdate = Date.now();
let isPlaying = false;
let latencyOffset = -0.05; // Adjust this if beats feel early or late

// --- 2. AUTH ---
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

// --- 3. SPOTIFY SDK ---
window.onSpotifyWebPlaybackSDKReady = () => {
  if (!token) return;
  
  const player = new Spotify.Player({
    name: 'TrippyTempo Visualizer',
    getOAuthToken: cb => { cb(token); },
    volume: 0.5
  });

  player.addListener('ready', ({ device_id }) => {
    console.log('Device Ready:', device_id);
    document.getElementById('spotify-login').innerText = "START THE TRIP";
  });

  player.addListener('player_state_changed', state => {
    if (!state) return;
    
    // Sync current time with Spotify's server time
    currentPosition = state.position / 1000;
    lastUpdate = Date.now();
    isPlaying = !state.paused;

    const trackId = state.track_window.current_track.id;
    fetchBeatData(trackId);
  });

  // Reconnection Logic
  player.addListener('account_error', () => {
    localStorage.removeItem('access_token');
    redirectToSpotify();
  });

  player.connect();
};

async function fetchBeatData(trackId) {
  try {
    const res = await fetch(`https://api.spotify.com/v1/audio-analysis/${trackId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    songBeats = data.beats || [];
    document.getElementById('spotify-login').innerText = "SYNCED";
  } catch (e) { console.error("Sync Error:", e); }
}

// --- 4. THREE.JS ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#visuals'), antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

const knotGeo = new THREE.TorusKnotGeometry(10, 3, 150, 20);
const crystalGeo = new THREE.IcosahedronGeometry(14, 1);
const palettes = [{ main: 0x00f2ff, accent: 0xff00ff }, { main: 0x00ffaa, accent: 0xffcc00 }];
let paletteIdx = 0;

const material = new THREE.MeshBasicMaterial({ color: palettes[0].main, wireframe: true, transparent: true, opacity: 0.6 });
let heroShape = new THREE.Mesh(knotGeo, material);
scene.add(heroShape);
camera.position.z = 45;

// --- 5. PULSE ENGINE ---
function animate() {
  requestAnimationFrame(animate);

  if (isPlaying) {
    const now = Date.now();
    const dt = (now - lastUpdate) / 1000;
    currentPosition += dt;
    lastUpdate = now;
  }

  let intensity = 0;
  // Use high-precision matching
  const beat = songBeats.find(b => {
    const diff = (b.start) - (currentPosition + latencyOffset);
    return diff > -0.04 && diff < 0.04; 
  });
  
  if (beat) {
    intensity = 255;
    // Snap position to prevent drift
    currentPosition = beat.start - latencyOffset;
  } else {
    intensity = Math.sin(Date.now() * 0.003) * 20 + 30;
  }

  const s = THREE.MathUtils.lerp(heroShape.scale.x, 1 + (intensity / 255) * 1.5, 0.2);
  heroShape.scale.set(s, s, s);

  const p = palettes[paletteIdx];
  heroShape.material.color.setHex(intensity > 150 ? p.accent : p.main);
  heroShape.rotation.y += 0.01;

  renderer.render(scene, camera);
}

handleAuth();
animate();

// --- 6. UI ---
document.getElementById('spotify-login').onclick = () => { if(!token) redirectToSpotify(); };
document.getElementById('change-shape').onclick = () => {
  heroShape.geometry = heroShape.geometry === knotGeo ? crystalGeo : knotGeo;
};
document.getElementById('change-color').onclick = () => {
  paletteIdx = (paletteIdx + 1) % palettes.length;
};