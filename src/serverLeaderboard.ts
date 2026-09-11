/**
 * serverLeaderboard.ts
 * Authoritative Leaderboard Client for Chainmates (Co-op Squad & Solo Practice Rankings)
 * Powered by Authoritative REST Backend on Render & Supabase PostgreSQL
 *
 * Offline & Local Cache Architecture:
 *  1. Local Cache Fallback: Instantly populates the in-world 3D podium & HUD if offline
 *  2. Optimistic Updates: Scores are immediately recorded locally with zero UI lag
 *  3. Supabase Cloud Sync: Scores persist permanently across server sleep and restarts
 *  4. Offline Sync Queue: Unsubmitted scores are stored in memory and flushed automatically
 *     when the server becomes accessible.
 *  5. Cold-Start Warmup & Heartbeat: Keeps Render active and syncs in background.
 */

import { executeTask } from '@dcl/sdk/ecs'
import { gameState, LeaderboardEntry, SoloLeaderboardEntry } from './gameState'

// ─── Render Server Config ─────────────────────────────────────────────────────
export const RENDER_SERVER_URL = 'https://chainmates.onrender.com'

// ─── Default Local Cache (Clean initial state — real player records only) ───────
const LOCAL_FALLBACK_CACHE: LeaderboardEntry[] = []
const LOCAL_SOLO_FALLBACK_CACHE: SoloLeaderboardEntry[] = []

interface ServerLeaderboardItem {
  displayName: string
  score: number
  altitude?: number
  partnerName?: string
  playerId?: string
  formattedTime?: string
  timestamp?: number
}

interface ServerLeaderboardResponse {
  success: boolean
  mode?: string
  rank?: number
  squadLeaderboard?: ServerLeaderboardItem[]
  soloLeaderboard?: ServerLeaderboardItem[]
}

let isServerAwake = false
let heartbeatTimer = 0
const HEARTBEAT_INTERVAL = 300 // ping every 5 minutes to keep Render alive

// Queue of scores that were saved locally while the server was offline/sleeping
const pendingOfflineSyncQueue: Array<{
  mode: string
  teamName: string
  score: number
  altitude: number
  partnerName: string
  playerId: string
}> = []

function mapServerToClient(entries: ServerLeaderboardItem[]): LeaderboardEntry[] {
  return entries.map(e => ({
    displayName: e.displayName,
    partnerName: e.partnerName || '',
    playerId: e.playerId || '',
    teamScore: e.score,
    maxAltitude: e.altitude || 0,
    formattedTime: e.formattedTime || '0:00.00'
  }))
}

function mapServerToSoloClient(entries: ServerLeaderboardItem[]): SoloLeaderboardEntry[] {
  return entries.map(e => ({
    displayName: e.displayName,
    playerId: e.playerId || '',
    soloScore: e.score,
    maxAltitude: e.altitude || 0,
    formattedTime: e.formattedTime || '0:00.00'
  }))
}

function mergeIntoBoard(target: LeaderboardEntry[], incoming: LeaderboardEntry[]) {
  for (const entry of incoming) {
    const idx = target.findIndex(e => e.displayName.toLowerCase() === entry.displayName.toLowerCase())
    if (idx >= 0) {
      if (entry.teamScore > target[idx].teamScore) {
        target[idx] = entry
      }
    } else {
      target.push(entry)
    }
  }
  target.sort((a, b) => b.teamScore - a.teamScore)
  if (target.length > 20) target.length = 20
}

function mergeIntoSoloBoard(target: SoloLeaderboardEntry[], incoming: SoloLeaderboardEntry[]) {
  for (const entry of incoming) {
    const idx = target.findIndex(e => e.displayName.toLowerCase() === entry.displayName.toLowerCase())
    if (idx >= 0) {
      if (entry.soloScore > target[idx].soloScore) {
        target[idx] = entry
      }
    } else {
      target.push(entry)
    }
  }
  target.sort((a, b) => b.soloScore - a.soloScore)
  if (target.length > 20) target.length = 20
}

/**
 * Initialize local leaderboard from fallback cache.
 * Ensures the 3D podium and UI are never empty.
 */
export function initLocalLeaderboardCache() {
  if (gameState.leaderboard.length === 0) {
    mergeIntoBoard(gameState.leaderboard, LOCAL_FALLBACK_CACHE)
    gameState.onLeaderboardUpdate?.(gameState.leaderboard)
  }
  if (gameState.soloLeaderboard.length === 0) {
    mergeIntoSoloBoard(gameState.soloLeaderboard, LOCAL_SOLO_FALLBACK_CACHE)
    gameState.onSoloLeaderboardUpdate?.(gameState.soloLeaderboard)
  }
}

/**
 * Immediate warm-up ping on world load.
 * Wakes up Render free-tier server if asleep and loads server scores once awake.
 */
export function warmupServer() {
  // 1. Seed with local cache immediately so players see rankings with 0 latency
  initLocalLeaderboardCache()

  // 2. Fire async warmup ping to wake up Render in background
  executeTask(async () => {
    try {
      console.log('[Chainmates] Waking up Authoritative Leaderboard Server on Render...')
      const res = await fetch(`${RENDER_SERVER_URL}/health`, { method: 'GET' })
      if (res.ok) {
        isServerAwake = true
        console.log('[Chainmates] Authoritative Server is HOT & READY ⚡')
        fetchPersistentLeaderboard()
        flushPendingOfflineQueue()
      }
    } catch (e) {
      console.log('[Chainmates] Server warm-up initiated in background (local cache active)...')
      // Retry leaderboard fetch after 15s cold-start grace period
      setTimeout(() => {
        fetchPersistentLeaderboard()
      }, 15000)
    }
  })
}

/**
 * Fetch authoritative rankings from the Render / Supabase backend.
 * Merges scores into gameState and updates the in-world 3D leaderboard.
 */
export function fetchPersistentLeaderboard() {
  executeTask(async () => {
    try {
      const res = await fetch(`${RENDER_SERVER_URL}/api/leaderboard`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      })

      if (!res.ok) {
        console.log(`[Chainmates] Leaderboard fetch status: ${res.status} (using local cache)`)
        return
      }

      const data = await res.json() as ServerLeaderboardResponse

      if (data.success) {
        isServerAwake = true
        if (data.squadLeaderboard && data.squadLeaderboard.length > 0) {
          const mapped = mapServerToClient(data.squadLeaderboard)
          mergeIntoBoard(gameState.leaderboard, mapped)
          gameState.onLeaderboardUpdate?.(gameState.leaderboard)
          console.log(`[Chainmates] Authoritative Squad Leaderboard synchronized (${gameState.leaderboard.length} entries) ✓`)
        }
        if (data.soloLeaderboard && data.soloLeaderboard.length > 0) {
          const soloMapped = mapServerToSoloClient(data.soloLeaderboard)
          mergeIntoSoloBoard(gameState.soloLeaderboard, soloMapped)
          gameState.onSoloLeaderboardUpdate?.(gameState.soloLeaderboard)
          console.log(`[Chainmates] Authoritative Solo Leaderboard synchronized (${gameState.soloLeaderboard.length} entries) ✓`)
        }
      }
    } catch (e) {
      console.log('[Chainmates] Server not accessible — continuing with local cache seamlessly ✓')
    }
  })
}

/**
 * Submit the completed run score (Co-op Squad or Solo Practice) to the authoritative server.
 * If server is offline/sleeping, saves to local cache and queues for background sync.
 */
export function pushPersistentLeaderboard() {
  executeTask(async () => {
    const isSolo = gameState.isPracticeMode || !gameState.partnerId || gameState.partnerId === '__SOLO__'

    const teamName = isSolo
      ? (gameState.localName || 'Solo Climber')
      : `${gameState.localName || 'Player 1'} & ${gameState.partnerName || 'Player 2'}`

    const payload = {
      mode: isSolo ? 'SOLO' : 'SQUAD',
      teamName,
      score: gameState.teamScore,
      altitude: Math.round(gameState.maxAltitude * 10) / 10,
      partnerName: isSolo ? 'Ball Droid' : (gameState.partnerName || ''),
      playerId: gameState.localId
    }

    // 1. Optimistic Local Cache Update
    if (isSolo) {
      const localSolo: SoloLeaderboardEntry = {
        displayName: teamName,
        playerId: gameState.localId,
        soloScore: gameState.teamScore,
        maxAltitude: Math.round(gameState.maxAltitude * 10) / 10,
        formattedTime: '0:00.00'
      }
      mergeIntoSoloBoard(gameState.soloLeaderboard, [localSolo])
      gameState.onSoloLeaderboardUpdate?.(gameState.soloLeaderboard)
    } else {
      const localEntry: LeaderboardEntry = {
        displayName: teamName,
        partnerName: gameState.partnerName,
        playerId: gameState.localId,
        teamScore: gameState.teamScore,
        maxAltitude: Math.round(gameState.maxAltitude * 10) / 10,
        formattedTime: '0:00.00'
      }
      mergeIntoBoard(gameState.leaderboard, [localEntry])
      gameState.onLeaderboardUpdate?.(gameState.leaderboard)
    }

    // 2. Submit to server with retry & offline queueing
    let sent = false
    const maxRetries = 3
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(`${RENDER_SERVER_URL}/api/score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        })

        if (res.ok) {
          const data = await res.json() as ServerLeaderboardResponse
          if (data.success) {
            isServerAwake = true
            if (data.squadLeaderboard) {
              mergeIntoBoard(gameState.leaderboard, mapServerToClient(data.squadLeaderboard))
              gameState.onLeaderboardUpdate?.(gameState.leaderboard)
            }
            if (data.soloLeaderboard) {
              mergeIntoSoloBoard(gameState.soloLeaderboard, mapServerToSoloClient(data.soloLeaderboard))
              gameState.onSoloLeaderboardUpdate?.(gameState.soloLeaderboard)
            }
            console.log(`[Chainmates] ${payload.mode} score confirmed on Authoritative Server ✓`)
            sent = true
            return
          }
        }
      } catch (e) {
        console.log(`[Chainmates] Submit attempt ${attempt}/${maxRetries} connecting...`)
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(() => resolve(null), attempt * 3000))
      }
    }

    // If all immediate retries failed, enqueue for background sync once server wakes up
    if (!sent) {
      console.log('[Chainmates] Server offline: score cached locally & enqueued for sync ✓')
      pendingOfflineSyncQueue.push(payload)
    }
  })
}

/**
 * Flushes any pending scores that were queued while offline.
 */
function flushPendingOfflineQueue() {
  if (pendingOfflineSyncQueue.length === 0) return

  executeTask(async () => {
    console.log(`[Chainmates] Flushing ${pendingOfflineSyncQueue.length} pending offline scores to server...`)
    while (pendingOfflineSyncQueue.length > 0) {
      const payload = pendingOfflineSyncQueue.shift()
      if (!payload) break
      try {
        await fetch(`${RENDER_SERVER_URL}/api/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      } catch (e) {
        console.log('[Chainmates] Sync retry deferred')
        pendingOfflineSyncQueue.unshift(payload)
        break
      }
    }
  })
}

/**
 * Periodic system to keep Render alive and poll latest rankings.
 */
export function serverHeartbeatSystem(dt: number) {
  heartbeatTimer += dt
  if (heartbeatTimer >= HEARTBEAT_INTERVAL) {
    heartbeatTimer = 0
    executeTask(async () => {
      try {
        const res = await fetch(`${RENDER_SERVER_URL}/health`, { method: 'GET' })
        if (res.ok) {
          isServerAwake = true
          fetchPersistentLeaderboard()
          flushPendingOfflineQueue()
        }
      } catch (e) {
        isServerAwake = false
      }
    })
  }
}
