<p align="center">
  <img src="assets/images/thumbnail.png" alt="Chainmates Logo" width="560" />
</p>

<h1 align="center">⛓️ Chainmates — Endless Co-Op Climb</h1>

<p align="center">
  <strong>A Mobile-First Co-Op Tether Climbing Experience for Decentraland</strong>
</p>

<p align="center">
  <a href="https://decentraland.org/play/world/overlookhotel.dcl.eth"><img src="https://img.shields.io/badge/Play%20Live-OverlookHotel.dcl.eth-ff2d55?style=for-the-badge&logo=decentraland&logoColor=white" alt="Play Live World"/></a>
  <a href="https://docs.decentraland.org/creator/"><img src="https://img.shields.io/badge/DCL-SDK7-ff2d55?style=for-the-badge&logo=decentraland&logoColor=white" alt="DCL SDK7"/></a>
  <img src="https://img.shields.io/badge/Platform-Mobile%20First-00d2ff?style=for-the-badge&logo=android&logoColor=white" alt="Mobile First"/>
  <a href="https://chainmates.onrender.com/health"><img src="https://img.shields.io/badge/Backend-Render%20Live-00ff88?style=for-the-badge&logo=render&logoColor=white" alt="Live Server"/></a>
  <a href="https://youtu.be/2_w7LrtoAqk"><img src="https://img.shields.io/badge/YouTube-Demo%20Video-red?style=for-the-badge&logo=youtube&logoColor=white" alt="Demo Video"/></a>
  <img src="https://img.shields.io/badge/Multiplayer-DCL%20MessageBus-b400ff?style=for-the-badge" alt="Multiplayer"/>
  <img src="https://img.shields.io/badge/License-MIT-ffd700?style=for-the-badge" alt="MIT License"/>
</p>

## 📑 Table of Contents

- [🎮 Play Live World](#-play-live-world)
- [🎥 Gameplay Demo Video](#-gameplay-demo-video)
- [🌟 Project Overview](#-project-overview)
- [🏆 What Makes Chainmates Unique](#-what-makes-chainmates-unique)
- [🏛️ Interactive Lobby & Squad Matchmaking](#️-interactive-lobby--squad-matchmaking)
- [♾️ Endless Procedural Course & Infinite Recycling](#️-endless-procedural-course--infinite-recycling)
- [⚡ Dynamic Obstacle Course & Kinetic Hazards](#-dynamic-obstacle-course--kinetic-hazards)
- [📱 Optimal Performance for Mobile Devices (60 FPS)](#-optimal-performance-for-mobile-devices-60-fps)
- [🛡️ Anti-Cheat & Authoritative Server Leaderboard](#️-anti-cheat--authoritative-server-leaderboard)
- [🎮 Core Game Mechanics](#-core-game-mechanics)
  - [1. Dynamic 7.0m Elastic Tether](#1-dynamic-70m-elastic-tether)
  - [2. Solo Practice Mode & AI Ball Droid](#2-solo-practice-mode--ai-ball-droid)
  - [3. The Rising Electric Void Abyss](#3-the-rising-electric-void-abyss)
  - [4. Cyber-Gems & Continuous Scoring Engine](#4-cyber-gems--continuous-scoring-engine)
  - [5. Rapid Rematch Loop](#5-rapid-rematch-loop)
- [📱 Mobile-First UX & Ergonomics](#-mobile-first-ux--ergonomics)
- [🕹️ Controls Reference](#️-controls-reference)
- [🏗️ System Architecture](#️-system-architecture)
  - [Codebase Structure](#codebase-structure)
  - [Multiplayer Network Architecture](#multiplayer-network-architecture)
  - [Authoritative Leaderboard Backend](#authoritative-leaderboard-backend)
- [🎨 Visuals & Audio Design](#-visuals--audio-design)
- [🚀 Getting Started & Local Development](#-getting-started--local-development)
  - [Prerequisites](#prerequisites)
  - [Installation & Preview](#installation--preview)
  - [Building for Production](#building-for-production)
- [📋 Buildathon & Scene Specifications](#-buildathon--scene-specifications)
- [📜 License](#-license)

---

## 🎮 Play Live World

> 🌐 **Direct Play URL:** [https://decentraland.org/play/world/overlookhotel.dcl.eth](https://decentraland.org/play/world/overlookhotel.dcl.eth)  
> Jump straight into the live Decentraland World instance on desktop or mobile browser to test solo AI droid climbing or 2-player co-op squad climbing!

---

## 🎥 Gameplay Demo Video

[![Chainmates Gameplay Demo Video](assets/images/thumbnail.png)](https://youtu.be/2_w7LrtoAqk)

> 📺 **Watch Full Gameplay Video on YouTube:** [https://youtu.be/2_w7LrtoAqk](https://youtu.be/2_w7LrtoAqk)  
> *Walkthrough showcasing mobile-first matchmaking, 7.0m dynamic tether physics, procedural endless climb, and solo AI companion mode.*

---

## 🌟 Project Overview

**Chainmates** is a high-octane, physics-driven co-op platformer engineered from the ground up for the Decentraland Mobile client. Two players are physically linked by an elastic, 7.0-metre tether and must coordinate their movements to scale an infinite, procedurally generated vertical tower of kinetic platforms while outrunning a rising **Electric Void Abyss**.

Every jump requires teamwork: leap together to cross wide gaps, anchor your partner when they slip, and keep the chain within safe tension boundaries. If one player falls into the void, both are pulled down into the abyss!

---

## 🏆 What Makes Chainmates Unique (The Competitive Edge)

Unlike traditional metaverse mini-games that rely on static obstacle courses or "parallel play" (where players merely run in the same room without affecting each other), **Chainmates introduces seven breakthrough innovations**:

| # | Breakthrough Feature | Why It's Unique & Game-Changing |
|---|---|---|
| 1️⃣ | **🏛️ Interactive Lobby & Matchmaking** | Dynamic player discovery, 1-tap squad invite/accept handshake over DCL MessageBus, isolated squad channels, and 3D in-world holographic leaderboards. |
| 2️⃣ | **♾️ Endless Procedural Recycling** | An infinite vertical obstacle course using zero-memory-leak entity pooling that dynamically teleports recycled platforms ahead of climbers. |
| 3️⃣ | **⚡ Dynamic Kinetic Obstacle Course** | Sinusoidal oscillating platforms, rotating hazard cylinders, and a dynamic accelerating Electric Void Abyss. |
| 4️⃣ | **📱 60 FPS Mobile Optimization** | Pre-allocated entity pooling, PBR material caching, 10 FPS lerped proxy syncing, and touch-first ergonomics with virtual joystick clearance. |
| 5️⃣ | **🛡️ Anti-Cheat Authoritative Leaderboard** | High-availability Render REST backend with IP rate-limiting, mathematical sanity validation, strict duo vs solo score segregation, and offline resilience. |
| 6️⃣ | **🤝 True Physical Interdependence** | Avatars bound by a 7.0m elastic tether with **3 live tension states** (Slack, Taut, Yanked) applying real elastic momentum impulses. |
| 7️⃣ | **🤖 Autonomous AI Ball Droid Companion** | Solves the #1 flaw of multiplayer hackathon entries: *unplayability when tested solo*. With 1 tap, an autonomous hover droid binds to you. |

---

## 🏛️ Interactive Lobby & Squad Matchmaking

Chainmates features a seamless, frictionless social lobby engineered for instant multiplayer discovery and zero-hassle pairing:

- **📡 Automatic Player Discovery:** On entering the parcel lounge, the lobby UI displays all active players currently in the scene with real-time ping and availability status.
- **🤝 1-Tap Squad Handshake:** Players can send or accept tether invitations with a single tap. A decentralized two-way handshake over `DCL MessageBus` pairs the squad, locks in their session, and spawns the physical tether.
- **🔒 Isolated Squad Channels (`teamId`):** Multiple squads can pair up and climb simultaneously in the same parcel without interference. Message payloads are deterministically keyed to the squad's unique channel.
- **🎨 In-Lobby Customization Lounge:** Players can preview and select between 3 visual tether skins (Steel Chain, Braided Hemp, Neon Laser) with real-time swatch feedback before launching.
- **🏆 3D Holographic Leaderboard Podium:** An in-world floating 3D holographic leaderboard is stationed directly in the lobby lounge, showcasing the top global Squad and Solo records fetched live from the backend.

---

## ♾️ Endless Procedural Course & Infinite Recycling

Rather than a static parkour course that ends after a few jumps, Chainmates features an **infinite vertical ascent engine**:

- **🔄 Zero-Leak Dynamic Platform Recycling:** A pre-allocated entity pool of spiral platforms continuously teleports ahead of players as they climb. Platforms below the climbers are recycled above them, guaranteeing infinite ascent without ever exhausting parcel memory.
- **🌈 8 Dynamic Altitude Biomes:** Platforms transition through 8 progressive neon trim palettes as squads reach higher altitudes:
  `Cyber Cyan (0-20m)` ➔ `Radiant Violet (20-40m)` ➔ `Electric Magenta (40-60m)` ➔ `Hyper Gold (60-80m)` ➔ `Emerald Matrix (80-100m)` ➔ `Solar Amber (100-120m)` ➔ `Quantum Indigo (120-140m)` ➔ `Ultra Plasma (140m+)`.
- **🌌 Altitude Skybox & Lighting Synchronization:** Real-time emissive intensity and skybox hues shift dynamically as climbers reach upper atmospheric tiers.

---

## ⚡ Dynamic Obstacle Course & Kinetic Hazards

Every climb is dynamic, unpredictable, and exciting:

- **〰️ Sinusoidal Kinetic Platforms:** Floating platforms swing horizontally on the X-axis using smooth sinusoidal oscillations with randomized initial phase offsets, preventing repetitive movement patterns.
- **⚠️ Procedural Hazard Cylinders:** Rotating vertical hazard barriers spawn dynamically on platforms (50% probability), requiring squads to time their jumps in perfect synchronization.
- **⚡ Escalating Electric Void Abyss:** A surging ocean of electric plasma rises relentlessly from the tower base. Its velocity escalates dynamically based on squad altitude:
  $$\text{Ascent Velocity} = 0.15 + \left(\frac{\text{Altitude}}{100}\right) \times 0.08\text{ m/s}$$
- **💎 Cyber-Gems Scoring:** Floating collectible gems (+250 PTS) spawn on platforms, creating risk-reward choices where squads can push for risky jumps to boost their score.

---

## 📱 Optimal Performance for Mobile Devices (60 FPS)

Chainmates is architected to achieve rock-solid **60 FPS** performance on mobile devices running the Decentraland Mobile client:

- **🚀 PBR Material & Texture Caching:** Materials, textures, and shader states are pre-compiled and reused, eliminating runtime GPU stalls and garbage-collection frame drops.
- **📡 10 FPS Interpolated Network Proxies:** Partner position updates are broadcasted at a lightweight 10 FPS and smoothly lerped client-side, reducing network overhead by 80% while preserving silky-smooth visual tracking.
- **🛡️ 80m Perimeter Forcefield Containment:** Invisible collision forcefields encircle the 16×16m parcel boundary, preventing avatars from falling out of bounds and eliminating off-parcel rendering lag.
- **📱 Touchscreen Ergonomics (`screenInset: 'interactable'`):** All HUD elements are positioned with safe zone margins to prevent overlap with native on-screen virtual joysticks, jump buttons, and phone notches.
- **🎯 48–58px Touch Targets:** Every interactive UI button adheres to mobile accessibility standards with large hit targets and 25 Lucide outline vector icons.

---

## 🛡️ Anti-Cheat & Authoritative Server Leaderboard

To ensure high-score integrity and prevent fraudulent client-side tampering, Chainmates operates an **authoritative Node.js/Express backend service on Render** with multi-layer security and anti-cheat validation:

- **🔒 Multi-Tier Rate Limiting (`express-rate-limit` & `helmet`):**
  - **Score Submission Limiter:** Maximum 6 score submissions per minute per IP address.
  - **Leaderboard Query Limiter:** Maximum 60 fetches per minute per IP to prevent DDoS/scraping.
  - **Global Burst Guard:** 120 requests per 15-minute window with `trust proxy` client-IP validation.
- **🧮 Mathematical Sanity & Bounds Checks:**
  - The server verifies submitted scores against maximum possible survival time, altitude reach, and gem density ($\text{Score} \approx \text{Alt} \times 100 + \text{Time} \times 10 + \text{Gems} \times 250$).
  - Negative values, impossible instantaneous altitude jumps, and spoofed metrics are automatically dropped.
- **👥 Strict Co-Op Duo vs. Solo Segregation:**
  - Ensures co-op leaderboards remain 100% authentic: solo AI companion practice runs are identified and segregated so only verified two-player human squads rank on the global Duo board.
- **🧹 Sanitization & XSS Prevention:**
  - Player display names and team strings are trimmed, length-capped (36 chars max), and strictly sanitized before disk persistence.
- **⚡ 24/7 Availability & Offline Auto-Sync Queue:**
  - **Zero Cold-Starts:** Automated background warmup on scene load plus 5-minute health check pings (`GET /health`).
  - **Offline Fault Tolerance:** If internet connectivity fluctuates, completed scores are optimistically cached client-side and automatically flushed to the server upon reconnection.

---

## 🎮 Core Game Mechanics

### 1. Dynamic 7.0m Elastic Tether
- **Physical Link**: Both avatars are bound by a 7.0-metre elastic tether rendered using crossed billboard quads with real-time UV coordinate animation.
- **Tension State Machine**:
  - 🟢 **SLACK (`< 5.0m`)**: Ample slack. Full freedom of movement.
  - 🟡 **TAUT (`5.0m – 7.0m`)**: Tension warning. Players feel elastic resistance.
  - 🔴 **YANKED (`> 7.0m`)**: Overstretched! Elastic impulse kicks in, pulling overextended players back toward their partner with visual warning flashes and audio cues.
- **Customizable Skins**:
  - ⛓ **Iron Chain** (Industrial linked steel)
  - 🪢 **Rope Fiber** (Braided mountaineering hemp)
  - ✨ **Neon Beam** (Cyan energy plasma laser)

### 2. Solo Practice Mode & AI Ball Droid
- Enables instant single-player runs without needing a second player present.
- Spawns a floating 3D Ball Droid companion (`assets/asset-packs/ball_droid`) featuring:
  - Autonomous hovering and spring-follow physics.
  - Authentic tether drag, tension strain, and elastic pull response.
  - Dedicated **Solo Leaderboard** tracking individual high scores.

### 3. The Rising Electric Void Abyss
- A sea of surging, glowing electric energy accelerates upward from the base of the tower.
- **Dynamic Speed Ramp**: Base velocity starts at `0.15 m/s` and scales continuously with altitude:
  $$\text{Speed} = 0.15 + \left(\frac{\text{Altitude}}{100}\right) \times 0.08\text{ m/s}$$
- **Live HUD Feedback**: The running HUD displays both real-time void gap clearance and upward velocity (e.g. `2.4m ↑0.23`).
- **Lava Cloaking**: The void mesh remains hidden in the lobby and appears only when the countdown reaches zero.

### 4. Cyber-Gems & Continuous Scoring Engine
- Floating Cyber-Gems (+250 PTS each) spawn probabilistically on platforms with hovering animations and particle collection fanfare.
- Continuous scoring formula guarantees every metre climbed, second survived, and gem collected counts:
  $$\text{Score} = \lfloor(\text{MaxAltitude} \times 100) + (\text{SurvivalSeconds} \times 10) + (\text{GemsCollected} \times 250)\rfloor$$

### 5. Rapid Rematch Loop
- On run failure, squads can hit **⚡ REMATCH SQUAD** to instantly restart the climb without breaking their tether link or returning to the lobby.

---

## 📱 Mobile-First UX & Ergonomics

Chainmates was specifically architected to deliver a tier-one experience on mobile touchscreens running the Decentraland Mobile client:

- **Virtual Joystick Clearance (`screenInset: 'interactable'`)**: UI elements are positioned away from native on-screen thumbsticks and buttons.
- **Accessible Touch Targets**: Every button and toggle has a minimum hit-box size of **48–58px** for easy tapping.
- **Lucide Vector Iconography**: 25 custom outline icons provide clear, instant visual affordance without cluttering the screen.
- **Modular HUD Ribbon**: Displays Team Score, Altitude, Void Gap with Ascent Velocity, Gems Collected, Elapsed Time, and Tether Status in a compact top bar.
- **High-Contrast Dark Theme**: Deep charcoal surfaces (`rgba(8,12,22,0.95)`) paired with radiant neon accents ensure crystal-clear visibility under bright sunlight or dark mobile screens.

---

## 🕹️ Controls Reference

| Action | Mobile Client | Desktop Browser |
|---|---|---|
| **Move** | Left Virtual Joystick | `W` `A` `S` `D` / Arrow Keys |
| **Jump** | Right On-Screen Jump Button | `Spacebar` |
| **Look / Camera** | Drag screen surface | Mouse Drag / Right-Click Drag |
| **Interact / UI** | Direct Touch Tap | Left Click |
| **Toggle Audio** | Tap Music Button in Menu | Click Music Button in Menu |

---

## 🏗️ System Architecture

### Codebase Structure

```
Chainmates/
├── assets/
│   ├── asset-packs/ball_droid/ # 3D AI companion model for solo practice
│   ├── icons/                  # 25 Lucide outline vector UI icons (music, trophy, etc.)
│   ├── images/thumbnail.png    # High-resolution scene navigation thumbnail
│   ├── logo.png                # Official Chainmates branding logo & scene favicon
│   ├── sounds/                 # Cyberpunk BGM (MP3) and spatial SFX (WAV)
│   └── textures/               # Tether skins (Chain, Rope, Neon), Void, and Fog
├── server/
│   ├── index.js                # Authoritative Node.js/Express leaderboard REST server
│   ├── package.json            # Server dependencies (Express, CORS, Helmet)
│   └── render.yaml             # 1-click infrastructure-as-code for Render.com
├── src/
│   ├── index.ts                # Scene bootstrap, system registration, & lifecycle
│   ├── gameState.ts            # Central state machine, scoring, & DCL MessageBus
│   ├── tether.ts               # Elastic tether physics, tension states, & skin shaders
│   ├── course.ts               # Infinite platform pool, neon trims, & void geometry
│   ├── systems.ts              # Endless recycling, kinetic oscillation, & hazard logic
│   ├── practiceBot.ts          # AI Ball Droid companion autonomous follow logic
│   ├── playerSync.ts           # 10 FPS avatar position broadcast & proxy lerping
│   ├── serverLeaderboard.ts    # REST backend sync client with offline queue & warmup
│   ├── lobbyLeaderboard.ts     # In-world 3D holographic leaderboard podium
│   ├── audio.ts                # Spatial audio manager & BGM controller
│   ├── checkpoints.ts          # Boundary collision & void fall detection
│   ├── components.ts           # Custom ECS component definitions
│   └── ui.tsx                  # React-ECS responsive HUD, Lobby, & modal UI
├── scene.json                  # Decentraland DCL SDK7 scene manifest
└── package.json                # Project dependencies and SDK build scripts
```

### Multiplayer Network Architecture

Chainmates utilizes Decentraland's native peer-to-peer `MessageBus` for zero-latency communication across parcel instances:

```
[ Local Player ] ───(cm:pos @ 10 FPS)───► [ Remote Partner ]  (Lerped Proxies)
[ Local Player ] ───(cm:invite / accept)─► [ Remote Partner ]  (Squad Pairing)
[ Local Player ] ───(cm:phase)──────────► [ Remote Partner ]  (Lobby/Run Sync)
[ Local Player ] ───(cm:game_over)──────► [ Remote Partner ]  (Score Submission)
```

- **Isolated Squad Channels**: Message payloads include deterministic `teamId` keys, allowing multiple squads to climb simultaneously in the same parcel without interference.
- **Interpolated Proxies (`playerSync.ts`)**: Remote player transforms are lerped at 10 FPS to guarantee silky smooth visual tracking without network spam.

### Authoritative Leaderboard Backend

The leaderboard is hosted on a high-availability Node.js/Express service deployed on Render with an integrated anti-cheat engine:

- **Live URL**: `https://chainmates.onrender.com`
- **Security & Anti-Cheat Stack**:
  - `helmet` security headers & strict CORS policies.
  - `express-rate-limit` per-IP request throttling (6 score submissions/min, 60 leaderboard fetches/min).
  - Mathematical sanity validation checking score-to-altitude ratios, timestamp delta, and gem collection bounds.
  - Automated segregation of solo practice runs from verified co-op duo high-score tables.
- **REST Endpoints**:
  - `GET /health` — Keep-alive heartbeat & uptime reporting
  - `GET /api/leaderboard` — Returns Top 50 global Squad and Solo rankings
  - `POST /api/score` — Submits and validates completed run scores
- **Offline Resilience & Keep-Alive**:
  - Automatic warmup call on scene load.
  - Heartbeat pings sent every 5 minutes to prevent free-tier cold-starts.
  - Local optimistic cache with background retry queue for seamless offline tolerance.

---

## 🎨 Visuals & Audio Design

- **PBR Material Caching**: Eliminates per-frame GPU shader instantiation for silky-smooth 60 FPS mobile rendering.
- **Cyberpunk Audio Stack**:
  - High-tempo background synth track (`bg_music.mp3`) at balanced 0.7 volume with in-game mute toggle.
  - Spatial sound effects for countdown ticks (`tick.wav`), launch fanfare (`go.wav`), gem collection (`gem.wav`), tether strain alerts (`yank.wav`), altitude milestones (`milestone.wav`), and void falls (`void_fall.wav`).

---

## 🚀 Getting Started & Local Development

### Prerequisites
- [Node.js](https://nodejs.org/) (version 16.x or 18.x recommended)
- [Decentraland CLI](https://docs.decentraland.org/creator/development-guide/sdk7/installation-guide/) (`npm install -g @dcl/sdk`)

### Installation & Preview

1. Clone the repository:
   ```bash
   git clone https://github.com/nabil-repo/Chainmates.git
   cd Chainmates
   ```

2. Install scene dependencies:
   ```bash
   npm install
   ```

3. Launch the local Decentraland preview:
   ```bash
   npm run start
   ```

4. *(Optional)* Run two browser tabs side-by-side to test live two-player tether climbing and invite syncing!

### Building for Production

Compile TypeScript and build the production bundle:
```bash
npm run build
```

---

## 📋 Buildathon & Scene Specifications

- **Competition**: Decentraland Friendzone Mobile Buildathon 2026
- **Live World URL**: [https://decentraland.org/play/world/overlookhotel.dcl.eth](https://decentraland.org/play/world/overlookhotel.dcl.eth)
- **World Name**: `OverlookHotel.dcl.eth`
- **Parcel Footprint**: 1×1 Parcel (`0,0` — 16m × 16m)
- **Vertical Reach**: 80+ Metres procedural climbing height
- **SDK Version**: Decentraland SDK7 (`runtimeVersion: "7"`)
- **Required Permissions**:
  - `ALLOW_TO_TRIGGER_AVATAR_EMOTE`
  - `ALLOW_TO_MOVE_PLAYER_INSIDE_SCENE`
  - `ALLOW_MEDIA_HOSTNAMES` (`*.onrender.com`, `api.jsonbin.io`)
- **Creator Address**: `0xad0d520fdae7b1ed9a41d2078dbf75a9c5b55129`

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

<p align="center">
  <sub>Built with ⛓️ and 💜 for the Decentraland Community.</sub>
</p>
