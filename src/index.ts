/**
 * index.ts — Chainmates entry point
 *
 * Wires together:
 *  - gameState: MessageBus listeners + callbacks
 *  - playerSync: position broadcast + proxy system
 *  - tether: chain visual + yank system
 *  - checkpoints: Z-threshold + fall detection
 *  - systems: moving platform oscillator
 *  - hud: in-world 3D HUD
 *  - course: obstacle course geometry
 *  - ui: React-DCL overlay UI
 */

import { engine, executeTask, EngineInfo, AssetLoad, inputSystem, InputAction, PointerEventType, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

import {
  gameState,
  updateGameState,
  updateControlsForPhase,
  bus
} from './gameState'

import { playerSyncSystem } from './playerSync'
import { tetherSystem } from './tether'
import { practiceBotSystem } from './practiceBot'
import { checkpointSystem } from './checkpoints'
import {
  endlessPlatformRecycleSystem,
  lavaSystem,
  movingPlatformSystem,
  gemCollectionSystem,
  hazardObstacleSystem,
  fogAnimationSystem,
  platformTypeSystem
} from './systems'
import { setupHud, hudSystem } from './hud'
import { buildCourse } from './course'
import { update3DLeaderboard } from './lobbyLeaderboard'
import {
  setupUi,
  setUiPhase,
  setUiCountdown,
  setUiLeaderboard,
  setUiSoloLeaderboard,
  setUiYankFlash,
  tickUi,
  updateUiEach
} from './ui'
import {
  warmupServer,
  fetchPersistentLeaderboard,
  pushPersistentLeaderboard,
  serverHeartbeatSystem
} from './serverLeaderboard'
import { startBgMusic, playYankSound, unlockAudio } from './audio'

// ─── Yank flash timer & UI throttle ──────────────────────────────────────────
let yankFlashTimer = 0
const YANK_FLASH_DURATION = 1.2  // seconds
let uiThrottleTimer = 0

export function main() {
  // 1. Wire UI callbacks into gameState
  gameState.onPhaseChange = (phase) => {
    setUiPhase(phase)
  }
  gameState.onCountdownTick = (n) => {
    setUiCountdown(n)
  }
  gameState.onLeaderboardUpdate = (board) => {
    setUiLeaderboard(board)
    update3DLeaderboard(board)
    // Persist every leaderboard update to JSONBin
    pushPersistentLeaderboard()
  }
  gameState.onSoloLeaderboardUpdate = (board) => {
    setUiSoloLeaderboard(board)
    pushPersistentLeaderboard()
  }
  gameState.onYankReceived = () => {
    yankFlashTimer = YANK_FLASH_DURATION
    setUiYankFlash(true)
    playYankSound()
  }

  // 2. Fetch local player identity asynchronously
  executeTask(async () => {
    try {
      // Use getRealm to get a stable client ID (userId not always available)
      // We generate a session-local ID from Date.now() as fallback
      const sessionId = `player_${Math.floor(Date.now()).toString(36)}`
      gameState.localId = sessionId
      gameState.localName = `Player-${sessionId.slice(-4)}`

      // Try to get the realm name to confirm we're connected
      const { getRealm } = await import('~system/Runtime' as any)
      const realm = await getRealm({})
      if (realm?.realmInfo?.realmName) {
        console.log(`[Chainmates] Connected to realm: ${realm.realmInfo.realmName}`)
      }
    } catch (e) {
      console.error('[Chainmates] Could not fetch realm info', e)
    }
  })

  // 3. Build the world & disable movement controls until active climb
  buildCourse()
  setupHud()
  setupUi()
  updateControlsForPhase('LOBBY')

  // Preload companion 3D model, textures, and spatial SFX for zero-stutter Android mobile experience
  AssetLoad.createOrReplace(engine.RootEntity, {
    assets: [
      'assets/asset-packs/ball_droid/Droid_01/Droid_01.glb',
      'assets/textures/void.jpg',
      'assets/textures/fog.png',
      'assets/textures/Chain.png',
      'assets/textures/Rope.png',
      'assets/textures/Neon.png',
      'assets/textures/ui_panel_bg.jpg',
      'assets/textures/ui_header_bg.jpg',
      'assets/sounds/bg_music.mp3',
      'assets/sounds/gem.wav',
      'assets/sounds/yank.wav',
      'assets/sounds/tick.wav',
      'assets/sounds/go.wav',
      'assets/sounds/milestone.wav',
      'assets/sounds/void_fall.wav'
    ]
  })

  // 4. Warm up Render server & load persistent leaderboard & start music
  warmupServer()
  startBgMusic()

  // Auto-unlock audio as soon as player interacts (bypasses browser autoplay & mobile touch constraints)
  let audioUnlocked = false
  let lastPlayerPos = Vector3.Zero()
  let mobileTimer = 0
  function audioAutoplayUnlockSystem(dt: number) {
    if (audioUnlocked) return

    // 1. Desktop / Keyboard / Gamepad input triggers
    if (
      inputSystem.isTriggered(InputAction.IA_ANY, PointerEventType.PET_DOWN) ||
      inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN) ||
      inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN) ||
      inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN) ||
      inputSystem.isTriggered(InputAction.IA_FORWARD, PointerEventType.PET_DOWN) ||
      inputSystem.isTriggered(InputAction.IA_BACKWARD, PointerEventType.PET_DOWN) ||
      inputSystem.isTriggered(InputAction.IA_JUMP, PointerEventType.PET_DOWN)
    ) {
      audioUnlocked = true
      unlockAudio()
      engine.removeSystem(audioAutoplayUnlockSystem)
      return
    }

    // 2. Mobile Android Virtual Joystick: player moved from spawn
    const playerT = Transform.getOrNull(engine.PlayerEntity)
    if (playerT) {
      if (lastPlayerPos.x === 0 && lastPlayerPos.y === 0 && lastPlayerPos.z === 0) {
        lastPlayerPos = Vector3.clone(playerT.position)
      } else if (Vector3.distance(playerT.position, lastPlayerPos) > 0.3) {
        audioUnlocked = true
        unlockAudio()
        engine.removeSystem(audioAutoplayUnlockSystem)
        return
      }
    }

    // 3. Mobile fallback: once asset buffer has loaded (~2.5s), trigger audio
    mobileTimer += dt
    if (mobileTimer > 2.5) {
      audioUnlocked = true
      unlockAudio()
      engine.removeSystem(audioAutoplayUnlockSystem)
    }
  }
  engine.addSystem(audioAutoplayUnlockSystem, 1, 'AudioAutoplayUnlockSystem')

  // 5. Register all systems
  //    Priority: lower number = runs earlier
  engine.addSystem(playerSyncSystem, 10, 'PlayerSyncSystem')
  engine.addSystem(practiceBotSystem, 15, 'PracticeBotSystem')
  engine.addSystem(tetherSystem, 20, 'TetherSystem')
  engine.addSystem(checkpointSystem, 30, 'CheckpointSystem')
  engine.addSystem(gemCollectionSystem, 32, 'GemCollectionSystem')
  engine.addSystem(platformTypeSystem, 33, 'PlatformTypeSystem')
  engine.addSystem(hazardObstacleSystem, 34, 'HazardObstacleSystem')
  engine.addSystem(endlessPlatformRecycleSystem, 35, 'EndlessRecycleSystem')
  engine.addSystem(lavaSystem, 40, 'LavaSystem')
  engine.addSystem(movingPlatformSystem, 45, 'MovingPlatformSystem')
  engine.addSystem(fogAnimationSystem, 48, 'FogAnimationSystem')
  engine.addSystem(hudSystem, 50, 'HudSystem')
  engine.addSystem(serverHeartbeatSystem, 55, 'ServerHeartbeatSystem')
  engine.addSystem(mainUpdateSystem, 60, 'MainUpdateSystem')
}

// ─── Main update system ───────────────────────────────────────────────────────
function mainUpdateSystem(dt: number) {
  // Tick game state (countdown timer, run timer, stale player cleanup)
  updateGameState(dt)

  // Push UI updates at 10 FPS max (prevents 60fps React-ECS virtual DOM thrashing)
  uiThrottleTimer += dt
  if (uiThrottleTimer >= 0.1) {
    const elapsed = uiThrottleTimer
    uiThrottleTimer = 0
    if (gameState.phase === 'RUNNING' || gameState.phase === 'PRACTICE') {
      updateUiEach(gameState.currentElapsedMs)
    }
    // Tick UI state (auto-dismiss alerts & throttled radar)
    tickUi(elapsed)
  }
}
