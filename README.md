# ⛓ Chainmates — Endless Co-Op Climb

> **A Mobile-First Co-Op Tether Climbing Experience for Decentraland**  
> Built for the **Friendzone Mobile Buildathon 2026** ($8,000 MANA Prize Pool).

[![DCL SDK7](https://img.shields.io/badge/DCL-SDK7-red)](https://docs.decentraland.org/creator/)
[![Mobile First](https://img.shields.io/badge/Mobile-First-blue)]()
[![Persistent Leaderboard](https://img.shields.io/badge/Leaderboard-JSONBin.io-purple)]()
[![Open Source](https://img.shields.io/badge/License-MIT-green)]()

---

## 🌟 Overview & Core Mechanics

**Chainmates** reimagines social multiplayer in the open metaverse. Two players are bound by a physical, elastic tether and must cooperate to ascend an infinitely procedural tower of oscillating kinetic platforms while escaping a rising **Electric Void Abyss**.

### ✨ Key Features

1. **⛓ Dynamic 4.0m Physical Tether**
   - True spatial cooperation: jumping too far apart triggers elastic yanks.
   - Hoist and drag physics assist dangling partners.
   - 3 customizable tether skins: *Industrial Chain*, *Climbing Rope*, and *Cyber Neon*.

2. **🤖 AI Ball Droid Companion (Solo Practice Mode)**
   - Judges and solo players can jump in immediately without waiting for a partner.
   - A floating 3D Ball Droid companion (`assets/asset-packs/ball_droid`) tethers to you, simulating authentic co-op tension and physics.

3. **🌌 Rising Electric Void Abyss**
   - Molten liquid energy accelerates upward from the ground as your squad climbs higher.
   - Dynamic danger alerts and distance indicators keep the adrenaline pumping.

4. **🏔️ Infinite Procedural Platform Recycling**
   - Kinetic platforms oscillate on X/Z axes and automatically recycle upward into the sky as you ascend.

5. **🏆 Persistent Cross-Session Leaderboard**
   - Backed by JSONBin.io REST backend.
   - Top team scores and solo practice records survive server restarts and persist across all players.

6. **📱 Intentional Mobile-First UX**
   - Built with `ReactEcsRenderer` using `screenInset: 'interactable'` to clear native virtual joysticks.
   - Touch targets ≥58px, high-contrast typography, and dedicated **How To Play** interactive guide.
   - Optimized PBR material caching to guarantee smooth 60 FPS on mobile GPUs.

---

## 🎮 How to Play

```
   [ Squad Lounge ] ───(Link Tether or Solo Practice)───> [ 3-2-1 Countdown ]
                                                                   │
   [ Global High Score ] <───(Game Over / Fall) <─── [ Endless Kinetic Climb ]
```

1. **Lounge & Pairing:**
   - Step into the **Squad Lounge**.
   - Tap **"LINK TETHER"** on an available player to form a squad, OR tap **"SOLO PRACTICE RUN"** to climb with the Ball Droid.
2. **Ascend Together:**
   - Coordinate your jumps across oscillating platforms.
   - Keep the chain in **SLACK** (Green) or **TAUT** (Gold) range (<4.0m). Avoid red **YANKED** snaps!
3. **Outrun the Void:**
   - Stay above the rising purple void. Falling into the abyss ends the run and submits your squad's altitude & score to the global leaderboard.

---

## 🕹️ Controls

| Action | Mobile Device | Desktop Browser |
|---|---|---|
| **Movement** | Virtual Joystick (Left Thumb) | `W` `A` `S` `D` / Arrow Keys |
| **Jump** | Native Jump Button (Right Thumb) | `Spacebar` |
| **Look / Camera** | Drag screen surface | Mouse Drag |
| **Interact / UI** | Direct Touch (Large Touch Targets) | Left Click |

---

## 🏗️ Architecture & Tech Stack

- **Decentraland SDK7 (ECS)** — TypeScript Entity Component System.
- **React-ECS UI** — Reactive declarative HUD, responsive modals, and touch-optimized navigation.
- **REST Leaderboard** — JSONBin.io integration with graceful offline fallback.
- **Restricted Actions** — `movePlayerTo` for elastic tether physics.
- **PBR Caching System** — Eliminates per-frame GPU shader rebinds for buttery-smooth mobile gameplay.

```
src/
├── index.ts              # Scene bootstrap, system registration, & lifecycle
├── gameState.ts          # Central singleton, phase machine, scoring, & message bus
├── practiceBot.ts        # 3D Ball Droid AI companion & hover follow mechanics
├── tether.ts             # Elastic tether physics, crossed planes, & material caching
├── course.ts             # Infinite platform pool, neon trims, & Electric Void abyss
├── systems.ts            # Endless platform recycling & kinetic oscillation systems
├── checkpoints.ts        # Dynamic void collision & fall detection
├── serverLeaderboard.ts  # JSONBin.io persistent REST leaderboard client
└── ui.tsx                # React-ECS HUD, Squad Lobby, Leaderboard, & How-To-Play modals
```

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Run local preview
npm run start

# Build and validate bundle
npm run build
```

---

## 📜 License

MIT License — Created for the Decentraland Friendzone Mobile Buildathon 2026.