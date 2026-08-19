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

import { } from '@dcl/sdk/math'
import { engine, executeTask, EngineInfo } from '@dcl/sdk/ecs'

import {
  gameState,
  updateGameState,
  updateControlsForPhase,
  bus
} from './gameState'

import { playerSyncSystem } from './playerSync'
import { tetherSystem } from './tether'
import { checkpointSystem } from './checkpoints'
import { movingPlatformSystem, endlessPlatformRecycleSystem, lavaSystem } from './systems'
import { setupHud, hudSystem } from './hud'
import { buildCourse } from './course'
import {
  setupUi,
  setUiPhase,
  setUiCountdown,
  setUiLeaderboard,
  setUiYankFlash,
  updateUiEach
} from './ui'

// ─── Yank flash timer ─────────────────────────────────────────────────────────
let yankFlashTimer = 0
const YANK_FLASH_DURATION = 1.2  // seconds

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
  }
  gameState.onYankReceived = () => {
    yankFlashTimer = YANK_FLASH_DURATION
    setUiYankFlash(true)
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

  // 4. Register all systems
  //    Priority: lower number = runs earlier
  engine.addSystem(playerSyncSystem, 10, 'PlayerSyncSystem')
  engine.addSystem(tetherSystem, 20, 'TetherSystem')
  engine.addSystem(checkpointSystem, 30, 'CheckpointSystem')
  engine.addSystem(endlessPlatformRecycleSystem, 35, 'EndlessRecycleSystem')
  engine.addSystem(lavaSystem, 40, 'LavaSystem')
  engine.addSystem(movingPlatformSystem, 45, 'MovingPlatformSystem')
  engine.addSystem(hudSystem, 50, 'HudSystem')
  engine.addSystem(mainUpdateSystem, 60, 'MainUpdateSystem')
}

// ─── Main update system ───────────────────────────────────────────────────────
function mainUpdateSystem(dt: number) {
  // Tick game state (countdown timer, run timer, stale player cleanup)
  updateGameState(dt)

  // Push current elapsed time to UI (only during run)
  if (gameState.phase === 'RUNNING') {
    updateUiEach(gameState.currentElapsedMs)
  }

  // Yank flash timer
  if (yankFlashTimer > 0) {
    yankFlashTimer -= dt
    if (yankFlashTimer <= 0) {
      setUiYankFlash(false)
    }
  }

  // Update partner display name in UI state
  // (gameState.remotePlayers is live — UI reads it directly)
  // uiState.playerCount is updated by the reactive map access in UI
}
