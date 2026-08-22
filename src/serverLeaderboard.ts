/**
 * serverLeaderboard.ts
 * Authoritative Leaderboard Client for Chainmates (Co-op Squad Rankings)
 * Powered by Authoritative REST Backend on Render (https://chainmates-leaderboard.onrender.com)
 *
 * Architecture:
 *  - On world startup -> fetchPersistentLeaderboard() loads Top 50 global Co-op Squad rankings
 *  - On game over     -> pushPersistentLeaderboard() validates & records co-op squad runs
 *  - Solo mode        -> Pure practice/training mode (no persistent leaderboard submission)
 */

import { executeTask } from '@dcl/sdk/ecs'
import { gameState, LeaderboardEntry } from './gameState'

// ─── Render Server Config ─────────────────────────────────────────────────────
// Replace with your active Render web service URL or keep for production
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
        console.log(`[Chainmates] Authoritative server status: ${res.status}`)
        return
      }

      const data = await res.json() as ServerLeaderboardResponse

      if (data.success && data.squadLeaderboard && data.squadLeaderboard.length > 0) {
        const mapped = mapServerToClient(data.squadLeaderboard)
        mergeIntoBoard(gameState.leaderboard, mapped)
        gameState.onLeaderboardUpdate?.(gameState.leaderboard)
        console.log(`[Chainmates] Authoritative Squad Leaderboard loaded (${gameState.leaderboard.length} entries) ✓`)
      }
    } catch (e) {
      console.log('[Chainmates] Authoritative server connecting in background...')
    }
  })
}

/**
 * Submit the completed co-op squad run score to the authoritative Render server.
 * Solo practice runs are excluded from persistent server leaderboard.
 */
export function pushPersistentLeaderboard() {
  executeTask(async () => {
    try {
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
          mergeIntoBoard(gameState.leaderboard, mapServerToClient(data.squadLeaderboard))
          gameState.onLeaderboardUpdate?.(gameState.leaderboard)
          console.log('[Chainmates] Squad score submitted to Authoritative Server ✓')
        }
      }
    } catch (e) {
      console.log('[Chainmates] Could not push to server (in-memory leaderboard active)')
    }
  })
}
