import './style.css'
import * as THREE from 'three'
import { redirectToSpotify, fetchToken } from './spotify.js'

// --- 1. AUTHENTICATION HANDSHAKE ---
let token = localStorage.getItem('access_token');

async function handleAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
    const data = await fetchToken(code);
    if (data.access_token) {
      token = data.access_token;
      localStorage.setItem('access_token', token);
      window.history.pushState({}, null, "/"); 
      initSpotifyPlayer(); // Start player after getting token
    }
  } else if (token) {
    initSpotifyPlayer();
  }
}

// --- 2. THREE.JS WORLD ---
const canvas = document.querySelector('#visuals');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const knotGeo = new THREE.TorusKnotGeometry(10, 3, 150, 20);
const crystalGeo = new THREE.IcosahedronGeometry(14, 1);
let currentShapeType = 0;
const palettes = [{ main: 0x00f2ff, accent: 0xff00ff }, { main: 0x00ffaa, accent: 0xffcc00 }, { main: 0xff4444, accent: 0x00f2ff }, { main: 0x7700ff, accent: 0x00ffaa }];
let paletteIdx = 0;

const material = new THREE.MeshBasicMaterial({ color: palettes[0].main, wireframe: true, transparent: true, opacity: 0.6 });
let heroShape = new THREE.Mesh(knotGeo, material);
scene.add(heroShape);

const starGeometry = new THREE.BufferGeometry();
const posArray = new Float32Array(3000 * 3);
for(let i = 0; i < 3000 * 3; i++) posArray[i] = (Math.random() - 0.5) * 800;
starGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const starMesh = new THREE.Points(starGeometry, new THREE.PointsMaterial({ size: 0.8, color: 0xffffff, transparent: true, opacity: 0.7 }));
scene.add(starMesh);
camera.position.z = 45;

// --- 3. SPOTIFY SYNC ---
let songBeats = [];
let currentPosition = 0;

async function fetchBeatData(trackId) {
  try {
    const res = await fetch(`https://api.spotify.com/v1/audio-analysis/${trackId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    songBeats = data.beats || [];
  } catch (e) { console.error("Beat fetch failed", e); }
}

function initSpotifyPlayer() {
  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: 'TrippyTempo Visualizer',
      getOAuthToken: cb => { cb(token); },
      volume: 0.5
    });

    player.addListener('player_state_changed', state => {
      if (!state) return;
      currentPosition = state.position / 1000;
      const trackId = state.track_window.current_track.id;
      fetchBeatData(trackId);
    });

    player.connect();
    document.getElementById('spotify-login').innerText = "Spotify Connected";
  };
}

// --- 4. ANIMATION LOOP ---
function animate() {
  requestAnimationFrame(animate);
  let intensity = 0;
  const margin = 0.05; 
  const currentBeat = songBeats.find(b => Math.abs(b.start - currentPosition) < margin);
  
  if (currentBeat) intensity = 220;

  const targetScale = 1 + (intensity / 255) * 1.3;
  heroShape.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
  heroShape.rotation.x += 0.005; 
  heroShape.rotation.y += 0.008;
  starMesh.rotation.y += 0.0004;

  const p = palettes[paletteIdx];
  if (intensity > 150) {
    heroShape.material.color.setHex(p.accent);
    camera.position.x = (Math.random() - 0.5) * 0.4;
    camera.position.y = (Math.random() - 0.5) * 0.4;
  } else {
    heroShape.material.color.setHex(p.main);
    camera.position.set(0, 0, 45);
    currentPosition += 0.016; // Increment roughly by frame time
  }
  renderer.render(scene, camera);
}

// --- 5. START UP ---
handleAuth();
animate();

// --- 6. UI LISTENERS ---
document.getElementById('spotify-login').onclick = redirectToSpotify;
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