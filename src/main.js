import './style.css'
import * as THREE from 'three'
import { redirectToSpotify, fetchToken } from './spotify.js'

// --- 1. STATE & TUNING ---
let token = localStorage.getItem('access_token');
let songBeats = [];
let currentPosition = 0;
let lastUpdate = Date.now();
let isPlaying = false;

// Tuning Variables (Change these to make it more/less extreme)
const baseScale = 1.0;
const beatExtreme = 2.8; // How big it gets on a beat
const smoothFactor = 0.12; // Lower = more "springy", Higher = snappier
const rotationSpeed = 0.01;

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

// --- 3. SPOTIFY PLAYER ---
window.onSpotifyWebPlaybackSDKReady = () => {
  if (!token) return;
  const player = new Spotify.Player({
    name: 'TrippyTempo Visualizer',
    getOAuthToken: cb => { cb(token); },
    volume: 0.5
  });

  player.addListener('ready', ({ device_id }) => {
    document.getElementById('spotify-login').innerText = "VORTEX READY";
  });

  player.addListener('player_state_changed', state => {
    if (!state) return;
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
    songBeats = data.beats || [];
  } catch (e) { console.error("Sync Error", e); }
}

// --- 4. THREE.JS SCENE ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('#visuals'), antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Geometries
const knotGeo = new THREE.TorusKnotGeometry(10, 3, 150, 20);
const crystalGeo = new THREE.IcosahedronGeometry(14, 1);
const palettes = [{ main: 0x00f2ff, accent: 0xff00ff }, { main: 0x00ffaa, accent: 0xffcc00 }, { main: 0xff4444, accent: 0x00f2ff }];
let paletteIdx = 0;

const material = new THREE.MeshBasicMaterial({ color: palettes[0].main, wireframe: true, transparent: true, opacity: 0.6 });
let heroShape = new THREE.Mesh(knotGeo, material);
scene.add(heroShape);

// Starfield
const starGeometry = new THREE.BufferGeometry();
const posArray = new Float32Array(3000 * 3);
for(let i = 0; i < 3000 * 3; i++) posArray[i] = (Math.random() - 0.5) * 800;
starGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starMesh = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 0.7, color: 0xffffff }));
scene.add(starMesh);

camera.position.z = 45;

// --- 5. THE ANIMATION LOOP (Fixed Vortex Logic) ---
function animate() {
  requestAnimationFrame(animate);

  if (isPlaying) {
    const now = Date.now();
    currentPosition += (now - lastUpdate) / 1000;
    lastUpdate = now;
  }

  let intensity = 0;
  // Precision beat detection
  const beat = songBeats.find(b => Math.abs(b.start - currentPosition) < 0.08);
  
  if (beat) {
    intensity = 1.0; // Max trigger
  } else {
    // Subtle idle breathing
    intensity = Math.sin(Date.now() * 0.005) * 0.1;
  }

  // ENLARGING LOGIC: Lerp toward extreme scale on beat, back to base scale otherwise
  const targetScale = baseScale + (intensity * (beatExtreme - baseScale));
  heroShape.scale.x = THREE.MathUtils.lerp(heroShape.scale.x, targetScale, smoothFactor);
  heroShape.scale.y = THREE.MathUtils.lerp(heroShape.scale.y, targetScale, smoothFactor);
  heroShape.scale.z = THREE.MathUtils.lerp(heroShape.scale.z, targetScale, smoothFactor);

  // VORTEX ROTATION
  heroShape.rotation.x += rotationSpeed;
  heroShape.rotation.y += rotationSpeed * 1.5;
  starMesh.rotation.y += 0.0005;

  // COLOR & SHAKE
  const p = palettes[paletteIdx];
  if (beat) {
    heroShape.material.color.setHex(p.accent);
    camera.position.x = (Math.random() - 0.5) * 0.8; // Violent shake
    camera.position.y = (Math.random() - 0.5) * 0.8;
  } else {
    heroShape.material.color.setHex(p.main);
    camera.position.set(0, 0, 45);
  }

  renderer.render(scene, camera);
}

// --- 6. UI LISTENERS (Restored) ---
handleAuth();
animate();

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

let uiVisible = true;
document.getElementById('toggle-ui').onclick = () => {
  uiVisible = !uiVisible;
  const ui = document.querySelector('.controls');
  const title = document.querySelector('h1');
  ui.style.opacity = uiVisible ? '1' : '0';
  title.style.opacity = uiVisible ? '1' : '0';
  ui.style.pointerEvents = uiVisible ? 'auto' : 'none';
};

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});