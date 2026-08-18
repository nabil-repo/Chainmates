# ⛓ Chainmates

**A co-op tether parkour game for Decentraland** — built for the Friendzone Mobile Buildathon.

[![DCL SDK7](https://img.shields.io/badge/DCL-SDK7-red)](https://docs.decentraland.org/creator/)
[![Mobile First](https://img.shields.io/badge/mobile-first-blue)]()
[![Open Source](https://img.shields.io/badge/license-MIT-green)]()

---

## 🎮 How to Play

1. **Enter the scene** — you spawn at the starting pad.
2. **Find a partner** — when another player joins, you're automatically tethered together.
3. **Pick a chain skin** — Chain, Rope, or Neon (cosmetic only).
4. **Press E** (or the E button on mobile) to ready up — a countdown starts.
5. **Cross all 5 obstacles** as a team:
   - ① Narrow beam — stay aligned
   - ② Gap jump — jump simultaneously
   - ③ Moving platform — time your crossing together
   - ④ Split paths — negotiate which way through the tether
   - 🏁 Finish gate — time stops, leaderboard updates

### The Tether

- You and your partner are linked by a **5-meter chain**.
- Stray too far → the chain **yanks you both back** toward each other.
- The chain color tells you the tension: **grey = slack → gold = taut → red = snap**.
- There's no way to play solo — the tether *is* the mechanic.

### Controls (Mobile + Desktop)

| Action | Mobile | Desktop |
|---|---|---|
| Move | On-screen joystick | WASD |
| Jump | Jump button (bottom right area) | Space |
| Ready up / interact | E button | E key |
| Camera | Drag | Mouse |

> No IA_ACTION_3–6 buttons are used — all core actions work with the standard mobile HUD.

---

## 🏗 Tech Stack

- **Decentraland SDK7** (TypeScript ECS)
- **Creator Hub** project
- **MessageBus** for P2P player position sync (10fps, lerped)
- **movePlayerTo** (`~system/RestrictedActions`) for yank nudge
- **ReactEcsRenderer** with `screenInset: 'interactable'` for mobile safe area
- All geometry uses SDK7 primitives (MeshRenderer) — zero external GLB assets → fast load

---

## 📱 Mobile Checklist

- [x] `screenInset: 'interactable'` — UI clears DCL's left-hand controls
- [x] All touch targets ≥52px height
- [x] No UI in bottom-right corner (reserved for DCL action buttons)
- [x] No IA_ACTION_3–6 bindings
- [x] All meshes are SDK primitives — well under 1M triangle soft limit
- [x] HUD updates at 10fps max (not every frame)
- [x] Test on Samsung Galaxy A54 target device

---

## 🛠 Local Development

```bash
npm install
npm run start
```

Open the preview in two browser windows to test multiplayer locally.

### File Structure

```
src/
├── index.ts        # Entry point — wires all systems
├── components.ts   # Custom ECS component definitions
├── gameState.ts    # State machine + MessageBus + leaderboard
├── playerSync.ts   # Position broadcast + proxy entities (lerped)
├── tether.ts       # Chain visual + yank system
├── course.ts       # Obstacle course (5 obstacles, SDK primitives only)
├── checkpoints.ts  # Z-threshold checkpoint + fall detection
├── systems.ts      # Moving platform oscillator
├── hud.ts          # In-world 3D HUD (timer, tension, count)
└── ui.tsx          # React-DCL overlay UI (lobby/countdown/HUD/finish)
```

---

## 🚀 Deploy

```bash
npm run deploy
```

Then publish to your Decentraland World through Creator Hub.

---

## 📋 Submission

Built for: **DCL Regenesis Labs — Friendzone Mobile Buildathon**  
Submitted via: DoraHacks  
Deadline: September 4, 2026

---

## License

MIT — open source, as required by the buildathon rules.