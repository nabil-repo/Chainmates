/**
 * gameState.ts
 * Central singleton for Chainmates Endless Score-Based Co-op Climb.
 * Features:
 *  - 2-way invite/accept squad pairing (Start button only unlocked once accepted)
 *  - Non-interfering squad phase sync (only your paired partner starts/resets)
 *  - Side-by-side launchpad spawning with countdown movement lock
 *  - Real-time team score, altitude, and rising lava progression
 */

import { MessageBus } from '@dcl/sdk/message-bus'
import { EngineInfo, engine, Transform } from '@dcl/sdk/ecs'
import { movePlayerTo } from '~system/RestrictedActions'
import { resetPlatformPool } from './course'

// ─── Types ────────────────────────────────────────────────────────────────────

export type GamePhase = 'LOBBY' | 'COUNTDOWN' | 'RUNNING' | 'FINISHED' | 'GAME_OVER'

export interface RemotePlayer {
  id: string
  displayName: string
  x: number
  y: number
  z: number
  lastSeen: number
}

export interface LeaderboardEntry {
  displayName: string
  partnerName: string
  playerId: string
  teamScore: number
  maxAltitude: number
  formattedTime: string
}

// ─── Message Types ────────────────────────────────────────────────────────────

type PosMsg = { id: string; name: string; x: number; y: number; z: number }
type PhaseMsg = { phase: GamePhase; startRuntime: number; teamId: string }
type YankMsg = { targetId: string }
type GameOverMsg = {
  fallerName: string
  teamScore: number
  maxAltitude: number
  timeMs: number
  teamId: string
}
type TetherInviteMsg = { fromId: string; fromName: string; toId: string }
type TetherAcceptMsg = { fromId: string; fromName: string; toId: string }
type TetherLeaveMsg = { fromId: string; toId: string }

// ─── State ────────────────────────────────────────────────────────────────────

export const bus = new MessageBus()

export const gameState = {
  phase: 'LOBBY' as GamePhase,

  // Local player identity (populated async on startup)
  localId: '',
  localName: 'Player',

  // Run timing & scoring
  runStartRuntime: 0,     // engine totalRuntime when run started
  currentElapsedMs: 0,    // updated every frame during RUNNING
  teamScore: 0,           // continuous climbing score
  highScore: 0,           // highest score achieved in session

  // Altitude & Climbing Progress
  currentAltitude: 0,
  maxAltitude: 0,

  // Rising Lava Threat
  lavaHeight: 0.05,       // current lava Y position (starts at ground)
  lavaBaseSpeed: 0.15,    // meters per second base rise speed
  lavaSpeed: 0.15,        // current lava rise speed (scales with altitude)

  // Connected players in scene
  remotePlayers: new Map<string, RemotePlayer>(),

  // Squad / Tether Partner
  partnerId: '',
  partnerName: '',
  pendingInvite: null as { fromId: string; fromName: string } | null,
  outgoingInviteTo: null as { id: string; name: string } | null,
  tetherSkinIndex: 0,     // 0=Chain 1=Rope 2=Neon

  // Leaderboard
  leaderboard: [] as LeaderboardEntry[],

  // Countdown state
  countdownValue: 3,

  // Game over details
  gameOverReason: '',
  finalScore: 0,
  finalAltitude: 0,

  // Callbacks (set by UI)
  onPhaseChange: null as ((phase: GamePhase) => void) | null,
  onLeaderboardUpdate: null as ((board: LeaderboardEntry[]) => void) | null,
  onCountdownTick: null as ((n: number) => void) | null,
  onYankReceived: null as (() => void) | null,
  onSquadUpdate: null as (() => void) | null
}

// ─── Helper: Get Current Squad Team ID ────────────────────────────────────────
function getTeamId(): string {
  if (!gameState.partnerId) return gameState.localId
  return [gameState.localId, gameState.partnerId].sort().join(':')
}

// ─── Helper: Determine side-by-side launchpad spawn slot ───────────────────────
function getLaunchpadSlot(): { x: number; y: number; z: number } {
  const isFirst = !gameState.partnerId || gameState.localId < gameState.partnerId
  return {
    x: isFirst ? 6.8 : 9.2,
    y: 2.6,
    z: 3.0
  }
}

let lockedSpawnPos: { x: number; y: number; z: number } | null = null

// ─── MessageBus Listeners ─────────────────────────────────────────────────────

// Position sync: remote players broadcast their positions at 10fps
bus.on('cm:pos', (data: PosMsg) => {
  if (data.id === gameState.localId) return  // ignore our own echo

  const now = Date.now()
  const existing = gameState.remotePlayers.get(data.id)
  if (existing) {
    existing.x = data.x
    existing.y = data.y
    existing.z = data.z
    existing.lastSeen = now
    existing.displayName = data.name
  } else {
    gameState.remotePlayers.set(data.id, {
      id: data.id,
      displayName: data.name,
      x: data.x, y: data.y, z: data.z,
      lastSeen: now
    })
    gameState.onSquadUpdate?.()
  }
})

// Tether Invite Received
bus.on('cm:tether_invite', (data: TetherInviteMsg) => {
  if (data.toId === gameState.localId) {
    gameState.pendingInvite = { fromId: data.fromId, fromName: data.fromName }
    gameState.onSquadUpdate?.()
  }
})

// Tether Accept Received (Partner accepted our invite!)
bus.on('cm:tether_accept', (data: TetherAcceptMsg) => {
  if (data.toId === gameState.localId) {
    gameState.partnerId = data.fromId
    gameState.partnerName = data.fromName
    gameState.outgoingInviteTo = null
    gameState.pendingInvite = null
    gameState.onSquadUpdate?.()
  }
})

// Tether Leave Received
bus.on('cm:tether_leave', (data: TetherLeaveMsg) => {
  if (data.toId === gameState.localId && gameState.partnerId === data.fromId) {
    gameState.partnerId = ''
    gameState.partnerName = ''
    gameState.outgoingInviteTo = null
    gameState.onSquadUpdate?.()
  }
})

// Phase sync: only react if the message is for our squad
bus.on('cm:phase', (data: PhaseMsg) => {
  if (data.teamId && !data.teamId.includes(gameState.localId)) {
    return // ignore other squads in the world
  }

  gameState.phase = data.phase
  if (data.phase === 'LOBBY') {
    resetClimbState()
    lockedSpawnPos = null
    movePlayerTo({
      newRelativePosition: { x: 8.0, y: 1.6, z: 0.6 },
      cameraTarget: { x: 8.0, y: 2.5, z: 6.0 }
    }).catch(() => { })
  } else if (data.phase === 'COUNTDOWN') {
    resetClimbState()
    // Teleport paired squad side-by-side onto Course Launchpad!
    const slot = getLaunchpadSlot()
    lockedSpawnPos = slot
    movePlayerTo({
      newRelativePosition: slot,
      cameraTarget: { x: slot.x, y: 5.0, z: 10.0 }
    }).catch(() => { })
  } else if (data.phase === 'RUNNING') {
    lockedSpawnPos = null
    gameState.runStartRuntime = data.startRuntime
    resetClimbState()
  }
  gameState.onPhaseChange?.(data.phase)
})

// Game Over sync: only react if for our squad
bus.on('cm:game_over', (data: GameOverMsg) => {
  if (data.teamId && !data.teamId.includes(gameState.localId)) {
    return
  }

  gameState.phase = 'GAME_OVER'
  gameState.gameOverReason = `${data.fallerName} fell into the molten lava!`
  gameState.finalScore = data.teamScore
  gameState.finalAltitude = data.maxAltitude

  // Teleport partner back to Waiting Lounge immediately
  movePlayerTo({
    newRelativePosition: { x: 8.0, y: 1.6, z: 0.6 },
    cameraTarget: { x: 8.0, y: 2.5, z: 6.0 }
  }).catch(() => { })

  const partnerName = gameState.partnerName || 'Partner'
  addTeamToLeaderboard(gameState.localName, partnerName, data.teamScore, data.maxAltitude, data.timeMs)

  gameState.onPhaseChange?.('GAME_OVER')
})

// Yank: partner broadcasts a yank event targeting us
bus.on('cm:yank', (data: YankMsg) => {
  if (data.targetId === gameState.localId) {
    gameState.onYankReceived?.()
  }
})

// ─── Public Squad / Lobby Management API ───────────────────────────────────────

/** Send a tether invite / link with a specific player */
export function requestTether(targetPlayerId: string) {
  const target = gameState.remotePlayers.get(targetPlayerId)
  if (!target) return

  // Do NOT set partnerId yet — wait for accept!
  gameState.outgoingInviteTo = { id: targetPlayerId, name: target.displayName }
  gameState.partnerId = ''
  gameState.partnerName = ''
  gameState.pendingInvite = null

  bus.emit('cm:tether_invite', {
    fromId: gameState.localId,
    fromName: gameState.localName,
    toId: targetPlayerId
  } as TetherInviteMsg)

  gameState.onSquadUpdate?.()
}

/** Accept an incoming tether invite */
export function acceptTether(requesterPlayerId: string) {
  const target = gameState.remotePlayers.get(requesterPlayerId)
  gameState.partnerId = requesterPlayerId
  gameState.partnerName = target?.displayName ?? gameState.pendingInvite?.fromName ?? 'Partner'
  gameState.outgoingInviteTo = null
  gameState.pendingInvite = null

  bus.emit('cm:tether_accept', {
    fromId: gameState.localId,
    fromName: gameState.localName,
    toId: requesterPlayerId
  } as TetherAcceptMsg)

  gameState.onSquadUpdate?.()
}

/** Leave current squad pairing */
export function leaveSquad() {
  if (gameState.partnerId) {
    bus.emit('cm:tether_leave', {
      fromId: gameState.localId,
      toId: gameState.partnerId
    } as TetherLeaveMsg)
  }
  gameState.partnerId = ''
  gameState.partnerName = ''
  gameState.outgoingInviteTo = null
  gameState.pendingInvite = null
  gameState.onSquadUpdate?.()
}

/** Broadcast our position to all other players */
export function broadcastPosition(x: number, y: number, z: number) {
  bus.emit('cm:pos', {
    id: gameState.localId,
    name: gameState.localName,
    x, y, z
  } as PosMsg)
}

let countdownTimer = 0

/** Explicit Start Button Click */
export function startRun() {
  if (gameState.phase !== 'LOBBY') return
  if (!gameState.partnerId) return // must have chosen and accepted partner!

  gameState.phase = 'COUNTDOWN'
  gameState.countdownValue = 3
  countdownTimer = 0
  gameState.onPhaseChange?.('COUNTDOWN')
  gameState.onCountdownTick?.(3)

  bus.emit('cm:phase', {
    phase: 'COUNTDOWN',
    startRuntime: 0,
    teamId: getTeamId()
  } as PhaseMsg)

  // Teleport to active course launchpad slot
  const slot = getLaunchpadSlot()
  lockedSpawnPos = slot
  movePlayerTo({
    newRelativePosition: slot,
    cameraTarget: { x: slot.x, y: 5.0, z: 10.0 }
  }).catch(() => { })
}

/** Called every frame from mainUpdateSystem */
export function updateGameState(dt: number) {
  // Movement lock & Countdown ticker (1s per tick: 3 -> 2 -> 1 -> GO!)
  if (gameState.phase === 'COUNTDOWN') {
    // Keep player frozen at starting line
    if (lockedSpawnPos) {
      const transform = Transform.getOrNull(engine.PlayerEntity)
      if (transform) {
        const dx = Math.abs(transform.position.x - lockedSpawnPos.x)
        const dz = Math.abs(transform.position.z - lockedSpawnPos.z)
        if (dx > 0.2 || dz > 0.2) {
          movePlayerTo({
            newRelativePosition: lockedSpawnPos,
            cameraTarget: { x: lockedSpawnPos.x, y: 5.0, z: 10.0 }
          }).catch(() => { })
        }
      }
    }

    countdownTimer += dt
    if (countdownTimer >= 1.0) {
      countdownTimer = 0
      gameState.countdownValue -= 1
      gameState.onCountdownTick?.(gameState.countdownValue)

      if (gameState.countdownValue <= 0) {
        gameState.phase = 'RUNNING'
        lockedSpawnPos = null
        const engineInfo = EngineInfo.getOrNull(engine.RootEntity)
        gameState.runStartRuntime = engineInfo ? engineInfo.totalRuntime : 0
        resetClimbState()
        bus.emit('cm:phase', {
          phase: 'RUNNING',
          startRuntime: gameState.runStartRuntime,
          teamId: getTeamId()
        } as PhaseMsg)
        gameState.onPhaseChange?.('RUNNING')
      }
    }
  }

  // Active Endless Run Loop
  if (gameState.phase === 'RUNNING') {
    const engineInfo = EngineInfo.getOrNull(engine.RootEntity)
    if (engineInfo) {
      gameState.currentElapsedMs =
        (engineInfo.totalRuntime - gameState.runStartRuntime) * 1000
    }

    // Altitude calculation from starting height (Y = 2.0)
    const localTransform = Transform.getOrNull(engine.PlayerEntity)
    if (localTransform) {
      const alt = Math.max(0, Math.round((localTransform.position.y - 2.0) * 10) / 10)
      gameState.currentAltitude = alt
      if (alt > gameState.maxAltitude) {
        gameState.maxAltitude = alt
      }
    }

    // Rising Lava Dynamics
    gameState.lavaSpeed = gameState.lavaBaseSpeed + (gameState.maxAltitude / 100) * 0.08
    gameState.lavaHeight += dt * gameState.lavaSpeed

    // Continuous Team Score
    const timeSec = Math.floor(gameState.currentElapsedMs / 1000)
    gameState.teamScore = Math.floor(gameState.maxAltitude * 100 + timeSec * 10)
    if (gameState.teamScore > gameState.highScore) {
      gameState.highScore = gameState.teamScore
    }
  }

  // Prune stale remote players (gone for >60s)
  const now = Date.now()
  for (const [id, player] of gameState.remotePlayers) {
    if (now - player.lastSeen > 60_000) {
      gameState.remotePlayers.delete(id)
      if (gameState.partnerId === id && gameState.phase === 'LOBBY') {
        gameState.partnerId = ''
        gameState.partnerName = ''
        gameState.outgoingInviteTo = null
        gameState.onSquadUpdate?.()
      }
    }
  }
}

/** Called when either player plunges into the rising lava */
export function triggerGameOver() {
  if (gameState.phase !== 'RUNNING') return
  gameState.phase = 'GAME_OVER'
  gameState.gameOverReason = `${gameState.localName} plunged into the molten lava!`
  gameState.finalScore = gameState.teamScore
  gameState.finalAltitude = gameState.maxAltitude

  // Teleport local player back to Waiting Lounge immediately
  movePlayerTo({
    newRelativePosition: { x: 8.0, y: 1.6, z: 0.6 },
    cameraTarget: { x: 8.0, y: 2.5, z: 6.0 }
  }).catch(() => { })

  const partnerName = gameState.partnerName || 'Partner'
  addTeamToLeaderboard(gameState.localName, partnerName, gameState.teamScore, gameState.maxAltitude, gameState.currentElapsedMs)

  bus.emit('cm:game_over', {
    fallerName: gameState.localName,
    teamScore: gameState.teamScore,
    maxAltitude: gameState.maxAltitude,
    timeMs: gameState.currentElapsedMs,
    teamId: getTeamId()
  } as GameOverMsg)

  gameState.onPhaseChange?.('GAME_OVER')
}

/** Reset back to lobby after a run or game over */
export function resetToLobby() {
  gameState.phase = 'LOBBY'
  resetClimbState()

  // Teleport back to waiting lounge
  movePlayerTo({
    newRelativePosition: { x: 8.0, y: 1.6, z: 0.6 },
    cameraTarget: { x: 8.0, y: 2.5, z: 6.0 }
  }).catch(() => { })

  bus.emit('cm:phase', {
    phase: 'LOBBY',
    startRuntime: 0,
    teamId: getTeamId()
  } as PhaseMsg)

  gameState.onPhaseChange?.('LOBBY')
}

function resetClimbState() {
  gameState.currentElapsedMs = 0
  gameState.teamScore = 0
  gameState.currentAltitude = 0
  gameState.maxAltitude = 0
  gameState.lavaHeight = 0.05
  gameState.lavaSpeed = gameState.lavaBaseSpeed

  // Reset procedural platforms back to original low positions
  resetPlatformPool()
}

/** Broadcast a yank event to our partner */
export function broadcastYank(targetId: string) {
  bus.emit('cm:yank', { targetId } as YankMsg)
}

function addTeamToLeaderboard(player1: string, player2: string, teamScore: number, maxAltitude: number, timeMs: number) {
  const teamLabel = `${player1} & ${player2}`
  const existing = gameState.leaderboard.findIndex(e => e.displayName === teamLabel)
  const entry: LeaderboardEntry = {
    displayName: teamLabel,
    partnerName: player2,
    playerId: gameState.localId,
    teamScore,
    maxAltitude,
    formattedTime: formatTime(timeMs)
  }

  if (existing >= 0) {
    if (teamScore > gameState.leaderboard[existing].teamScore) {
      gameState.leaderboard[existing] = entry
    }
  } else {
    gameState.leaderboard.push(entry)
  }

  // Sort descending by highest team score, keep top 10
  gameState.leaderboard.sort((a, b) => b.teamScore - a.teamScore)
  if (gameState.leaderboard.length > 10) gameState.leaderboard.length = 10
  gameState.onLeaderboardUpdate?.(gameState.leaderboard)
}

export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  const centiseconds = Math.floor((ms % 1000) / 10)
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}
