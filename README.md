🌌 TrippyTempo

An immersive, high-performance 3D music visualizer that breathes and pulses to your music. Built using Three.js and the Spotify Web Playback SDK, it transforms real-time audio analysis into a cinematic “Vortex” visual experience.

---

🚀 Live Demo
Try it here:
https://trippy-tempo.vercel.app

---

✨ Features

🎵 Real-Time Spotify Sync
Connects directly to your Spotify account and acts as an active playback device, allowing visuals to react to the currently playing track.

🌀 Vortex Physics Engine
A custom spring-based scaling system where the 3D geometry:

* Expands dramatically on heavy bass hits
* Smoothly settles back to its original scale
* Creates a breathing, organic motion effect

🌠 Cinematic Space Background
A 4,000-particle rotating starfield creates a deep-space environment for immersive visuals.

👻 Ghost UI (Mouse Tracking)
The interface fades away after 3 seconds of mouse inactivity, creating a distraction-free visual experience. Moving the mouse instantly brings the controls back.

🎛️ Interactive Controls

* Shape Toggle: Switch between a Torus Knot and an Icosahedron
* Color Palette Switcher: Instantly change the visual theme
* Fullscreen Mode: One-click immersive experience

---

🛠️ Tech Stack

Three.js — 3D rendering and animation
Spotify Web Playback SDK — Playback device + audio data
Spotify Web API — Track and playback metadata
Vite — Frontend development environment
Vercel — Deployment and hosting

---

⚙️ Technical Setup

Prerequisites

* Spotify Premium account (required by the Web Playback SDK)
* Node.js installed on your machine

---

📦 Installation

1. Clone the Repository

git clone https://github.com/Tripppppyn/TrippyTempo.git
cd TrippyTempo

2. Install Dependencies

npm install

3. Configure Spotify API

Go to the Spotify Developer Dashboard.

Create a new App and add the following Redirect URI:

http://localhost:5173/

Copy your Client ID into:

src/spotify.js

4. Run the Development Server

npm run dev

Then open:

http://localhost:5173

---

🎮 How to Use

1. Authenticate
   Click “Connect Spotify” and authorize the application.

2. Initialize
   Once the button shows VORTEX SYNCED, open Spotify on your phone or desktop.

3. Connect Device
   Open the Devices menu in Spotify and select:

TrippyTempo Visualizer

4. Start Playing
   Play any track. Songs with heavy bass or percussion create the best visual effects.

5. Immersive Mode
   Stop moving the mouse to hide the UI and enjoy the visualizer.

---

📂 Project Structure (Simplified)

TrippyTempo

src

* main.js
* spotify.js
* visualizer.js
* styles.css

public
index.html
package.json
README.md

---

📜 License

Distributed under the MIT License.
See LICENSE for more information.

---

⭐ Support the Project

If you enjoy the visualizer:

* Star the repository
* Fork it
* Experiment with new visual effects

---

👨‍💻 Author

Aarya Tripathi
