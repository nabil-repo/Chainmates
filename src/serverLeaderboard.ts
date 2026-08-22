/**
 * serverLeaderboard.ts
 * Authoritative Leaderboard Client for Chainmates (Co-op Squad Rankings)
 * Powered by Authoritative REST Backend on Render (https://chainmates-leaderboard.onrender.com)
 *
 * Robust Cold-Start & Sleep Mitigation:
 *  1. Immediate Warm-up Ping on world load to wake up Render before gameplay starts
 *  2. Keep-Alive Heartbeat System (pings every 5 mins while players are active)
 *  3. Automatic Score Submission Retry with Exponential Backoff (3 attempts)
 *  4. Optimistic Local State Update for instantaneous UI responsiveness
 */

import { executeTask } from '@dcl/sdk/ecs'
import { gameState, LeaderboardEntry } from './gameState'

// ─── Render Server Config ─────────────────────────────────────────────────────
export const RENDER_SERVER_URL = 'https://chainmates-leaderboard.onrender.com'

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
  squadLeaderboard?: ServerLeaderboardItem[]
}

let isServerAwake = false
let heartbeatTimer = 0
const HEARTBEAT_INTERVAL = 300 // ping every 5 minutes to keep Render alive

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

/**
 * Immediate warm-up ping on world load.
 * Wakes up Render free-tier server if asleep and loads initial scores once awake.
 */
export function warmupServer() {
  executeTask(async () => {
    try {
      console.log('[Chainmates] Waking up Authoritative Leaderboard Server on Render...')
      const res = await fetch(`${RENDER_SERVER_URL}/health`, { method: 'GET' })
      if (res.ok) {
        isServerAwake = true
        console.log('[Chainmates] Authoritative Server is HOT & READY ⚡')
        fetchPersistentLeaderboard()
      }
    } catch (e) {
      console.log('[Chainmates] Server warm-up initiated in background (waking up from cold sleep)...')
      // Retry leaderboard fetch after 15s cold-start grace period
      setTimeout(() => {
        fetchPersistentLeaderboard()
      }, 15000)
    }
  })
}

/**
 * Fetch authoritative rankings from the Render backend.
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
        console.log(`[Chainmates] Leaderboard fetch status: ${res.status}`)
        return
      }

      const data = await res.json() as ServerLeaderboardResponse

      if (data.success && data.squadLeaderboard && data.squadLeaderboard.length > 0) {
        isServerAwake = true
        const mapped = mapServerToClient(data.squadLeaderboard)
        mergeIntoBoard(gameState.leaderboard, mapped)
        gameState.onLeaderboardUpdate?.(gameState.leaderboard)
        console.log(`[Chainmates] Authoritative Squad Leaderboard synchronized (${gameState.leaderboard.length} entries) ✓`)
      }
    } catch (e) {
      console.log('[Chainmates] Authoritative server still starting up...')
    }
  })
}

/**
 * Submit the completed co-op squad run score to the authoritative Render server.
 * Retries up to 3 times with exponential backoff if the server is in cold sleep.
 */
export function pushPersistentLeaderboard() {
  executeTask(async () => {
    const isSolo = gameState.isPracticeMode || !gameState.partnerId || gameState.partnerId === '__SOLO__'
    if (isSolo) {
      // Solo runs are practice-only; do not write to persistent co-op leaderboard
      return
    }

    const teamName = `${gameState.localName || 'Player 1'} & ${gameState.partnerName || 'Player 2'}`
    const payload = {
      mode: 'SQUAD',
      teamName,
      score: gameState.teamScore,
      altitude: Math.round(gameState.maxAltitude),
      partnerName: gameState.partnerName,
      playerId: gameState.localId
    }

    // Try submitting with auto-retry
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
          if (data.success && data.squadLeaderboard) {
            isServerAwake = true
            mergeIntoBoard(gameState.leaderboard, mapServerToClient(data.squadLeaderboard))
            gameState.onLeaderboardUpdate?.(gameState.leaderboard)
            console.log('[Chainmates] Squad score confirmed on Authoritative Server ✓')
            return
          }
        }
      } catch (e) {
        console.log(`[Chainmates] Score submit attempt ${attempt}/${maxRetries} connecting...`)
      }

      // Exponential backoff delay before next attempt: 3s, 6s, 12s
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(() => resolve(null), attempt * 3000))
      }
    }
  })
}

/**
 * ECS Keep-Alive Heartbeat System
 * Sends a lightweight health ping every 5 minutes while players are inside the scene,
 * preventing Render free-tier instances from going to sleep during active gameplay.
 */
export function serverHeartbeatSystem(dt: number) {
  heartbeatTimer += dt
  if (heartbeatTimer >= HEARTBEAT_INTERVAL) {
    heartbeatTimer = 0
    executeTask(async () => {
      try {
        await fetch(`${RENDER_SERVER_URL}/health`, { method: 'GET' })
        isServerAwake = true
      } catch (e) {
        // Silent background keepalive
      }
    })
  }
}
