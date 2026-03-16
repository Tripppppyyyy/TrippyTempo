import './style.css'
import * as THREE from 'three'
import { loginUrl, getTokenFromUrl } from './spotify.js'

// --- 1. SPOTIFY CONFIG ---
const token = getTokenFromUrl().access_token;
let spotifyPlayer;
let songBeats = [];
let currentPosition = 0;

// Redirect to login if no token is found
if (!token) {
  document.getElementById('spotify-login').style.display = 'block';
} else {
  document.getElementById('spotify-login').style.display = 'none';
  window.history.pushState({}, null, "/"); // Clean the URL
}

// --- 2. THREE.JS WORLD SETUP ---
const canvas = document.querySelector('#visuals');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const knotGeo = new THREE.TorusKnotGeometry(10, 3, 150, 20);
const crystalGeo = new THREE.IcosahedronGeometry(14, 1);
let currentShapeType = 0;

const palettes = [
  { main: 0x00f2ff, accent: 0xff00ff },
  { main: 0x00ffaa, accent: 0xffcc00 },
  { main: 0xff4444, accent: 0x00f2ff },
  { main: 0x7700ff, accent: 0x00ffaa }
];
let paletteIdx = 0;

const material = new THREE.MeshBasicMaterial({ color: palettes[0].main, wireframe: true, transparent: true, opacity: 0.6 });
let heroShape = new THREE.Mesh(knotGeo, material);
scene.add(heroShape);

const starMesh = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.8, color: 0xffffff, transparent: true, opacity: 0.7 }));
const posArray = new Float32Array(3000 * 3);
for(let i = 0; i < 3000 * 3; i++) posArray[i] = (Math.random() - 0.5) * 800;
starMesh.geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
scene.add(starMesh);

camera.position.z = 45;

// --- 3. SPOTIFY BEAT SYNC LOGIC ---
async function fetchBeatData(trackId) {
  const res = await fetch(`https://developer.spotify.com/dashboard7`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  songBeats = data.beats; // This is our "Beat Map"
}

// --- 4. INITIALIZE SPOTIFY PLAYER ---
window.onSpotifyWebPlaybackSDKReady = () => {
  spotifyPlayer = new Spotify.Player({
    name: 'TrippyTempo Visualizer',
    getOAuthToken: cb => { cb(token); },
    volume: 0.5
  });

  spotifyPlayer.addListener('ready', ({ device_id }) => {
    console.log('Ready with Device ID', device_id);
  });

  spotifyPlayer.addListener('player_state_changed', state => {
    if (!state) return;
    currentPosition = state.position / 1000; // Convert to seconds
    const trackId = state.track_window.current_track.id;
    fetchBeatData(trackId);
  });

  spotifyPlayer.connect();
};

// --- 5. ANIMATION LOOP ---
function animate() {
  requestAnimationFrame(animate);

  // Determine "Intensity" based on if current time matches a beat start
  let intensity = 0;
  const currentBeat = songBeats.find(b => Math.abs(b.start - currentPosition) < 0.1);
  if (currentBeat) intensity = 200; // Fake "Bass" hit on beat

  // Smooth Scaling
  const targetScale = 1 + (intensity / 255) * 1.2;
  const s = THREE.MathUtils.lerp(heroShape.scale.x, targetScale, 0.1);
  heroShape.scale.set(s, s, s);

  heroShape.rotation.x += 0.005; 
  heroShape.rotation.y += 0.008;
  starMesh.rotation.y += 0.0004;

  const p = palettes[paletteIdx];
  if (intensity > 150) {
    heroShape.material.color.setHex(p.accent);
    camera.position.x = (Math.random() - 0.5) * 0.5;
    camera.position.y = (Math.random() - 0.5) * 0.5;
  } else {
    heroShape.material.color.setHex(p.main);
    camera.position.set(0, 0, 45);
    currentPosition += 0.016; // Guess progress between Spotify updates (~60fps)
  }

  renderer.render(scene, camera);
}
animate();

// --- 6. UI LISTENERS ---
document.getElementById('spotify-login').onclick = () => window.location.href = loginUrl;
document.getElementById('change-shape').onclick = () => {
  currentShapeType = (currentShapeType + 1) % 2;
  heroShape.geometry = currentShapeType === 0 ? knotGeo : crystalGeo;
};
document.getElementById('change-color').onclick = () => {
  paletteIdx = (paletteIdx + 1) % palettes.length;
};
document.getElementById('fullscreen-btn').onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};