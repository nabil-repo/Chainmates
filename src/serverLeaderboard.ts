/**
 * serverLeaderboard.ts
 * Authoritative Leaderboard Client for Chainmates
 * Powered by Authoritative REST Backend on Render (https://chainmates-leaderboard.onrender.com)
 *
 * Architecture:
 *  - On world startup -> fetchPersistentLeaderboard() loads Top 50 global Squad & Solo rankings
 *  - On game over     -> submitScoreToServer() validates & records the completed run
 *  - Offline Safety   -> Automatic fallback to in-memory state with zero gameplay lag
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
  soloLeaderboard?: ServerLeaderboardItem[]
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

      if (data.success) {
        if (data.squadLeaderboard && data.squadLeaderboard.length > 0) {
          const mapped = mapServerToClient(data.squadLeaderboard)
          mergeIntoBoard(gameState.leaderboard, mapped)
        }
        if (data.soloLeaderboard && data.soloLeaderboard.length > 0) {
          const mapped = mapServerToClient(data.soloLeaderboard)
          mergeIntoBoard(gameState.soloLeaderboard, mapped)
        }

        gameState.onLeaderboardUpdate?.(gameState.leaderboard)
        console.log(`[Chainmates] Authoritative Leaderboard loaded (${gameState.leaderboard.length} squad, ${gameState.soloLeaderboard.length} solo) ✓`)
      }
    } catch (e) {
      console.log('[Chainmates] Authoritative server connecting in background...')
    }
  })
}

/**
 * Submit the completed run score to the authoritative Render server.
 */
export function pushPersistentLeaderboard() {
  executeTask(async () => {
    try {
      const isSolo = gameState.isPracticeMode || !gameState.partnerId || gameState.partnerId === '__SOLO__'
      const teamName = isSolo
        ? (gameState.localName || 'Solo Climber')
        : `${gameState.localName || 'Player 1'} & ${gameState.partnerName || 'Player 2'}`

      const payload = {
        mode: isSolo ? 'SOLO' : 'SQUAD',
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
        if (data.success) {
          if (data.squadLeaderboard) mergeIntoBoard(gameState.leaderboard, mapServerToClient(data.squadLeaderboard))
          if (data.soloLeaderboard) mergeIntoBoard(gameState.soloLeaderboard, mapServerToClient(data.soloLeaderboard))
          gameState.onLeaderboardUpdate?.(gameState.leaderboard)
          console.log('[Chainmates] Score submitted to Authoritative Server ✓')
        }
      }
    } catch (e) {
      console.log('[Chainmates] Could not push to server (in-memory leaderboard active)')
    }
  })
}
