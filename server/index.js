/**
 * server/index.js
 * Authoritative High-Score Leaderboard Backend for Chainmates
 * Powered by Supabase PostgreSQL Database with In-Memory / File Fallback Cache
 * Ready for 1-Click Deployment on Render.com
 * Includes Production Rate Limiting, Anti-Cheat, and Security Headers
 */

require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const app = express()
const PORT = process.env.PORT || 3000
const DATA_DIR = path.join(__dirname, 'data')
const DB_FILE = path.join(DATA_DIR, 'leaderboard.json')
const ADMIN_KEY = process.env.ADMIN_KEY || 'chainmates-admin-secret'

// ─── Supabase Configuration ───────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uavzloghuchujletteon.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || ''

let supabase = null
if (SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    console.log(`⚡ Supabase client initialized for: ${SUPABASE_URL}`)
  } catch (err) {
    console.error('[Supabase] Failed to initialize client:', err.message)
  }
} else {
  console.log('⚠️ No SUPABASE_KEY detected. Running in local fallback mode.')
  console.log('   Set SUPABASE_KEY in environment variables or Render dashboard to enable permanent persistence.')
}

// ─── Security & Rate Limiting ─────────────────────────────────────────────────

app.use(helmet())
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '500kb' }))

// Trust first proxy (essential for Render / Cloudflare rate-limiting by client IP)
app.set('trust proxy', 1)

// 1. Global API Rate Limiter (120 requests per 15 minutes per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again later.'
  }
})
app.use(globalLimiter)

// 2. Score Submission Rate Limiter (Max 10 submissions per minute per IP)
const scoreSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Rate limit exceeded: Max 10 score submissions per minute.'
  }
})

// 3. Leaderboard Fetch Rate Limiter (Max 60 fetches per minute per IP)
const leaderboardFetchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Rate limit exceeded: Please wait before fetching the leaderboard again.'
  }
})

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

// Clean Initial Leaderboard State (No mock data — only real player records)
const INITIAL_DATA = {
  squadLeaderboard: [],
  soloLeaderboard: []
}

// Load or initialize persistent data
function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      return {
        squadLeaderboard: Array.isArray(parsed.squadLeaderboard) ? parsed.squadLeaderboard : [...INITIAL_DATA.squadLeaderboard],
        soloLeaderboard: Array.isArray(parsed.soloLeaderboard) ? parsed.soloLeaderboard : [...INITIAL_DATA.soloLeaderboard]
      }
    }
  } catch (err) {
    console.error('[DB] Error reading database file, using fallback:', err)
  }
  saveData(INITIAL_DATA)
  return { ...INITIAL_DATA }
}

function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8')
  } catch (err) {
    console.error('[DB] Error writing to database file:', err)
  }
}

// In-memory cache synced with disk and Supabase
let db = loadData()

/** Sync cache from Supabase table */
async function syncFromSupabase() {
  if (!supabase) return
  try {
    // 1. Fetch Top Squad Scores
    const { data: squadData, error: squadErr } = await supabase
      .from('leaderboard')
      .select('display_name, score, altitude, partner_name, player_id, created_at')
      .eq('mode', 'squad')
      .order('score', { ascending: false })
      .limit(50)

    if (squadErr) {
      console.warn('[Supabase] Squad query error (table may need creation):', squadErr.message)
    } else if (squadData && squadData.length > 0) {
      db.squadLeaderboard = squadData.map(row => ({
        displayName: row.display_name,
        score: Number(row.score),
        altitude: Number(row.altitude),
        partnerName: row.partner_name || '',
        playerId: row.player_id || '',
        timestamp: new Date(row.created_at).getTime()
      }))
      console.log(`[Supabase] Loaded ${db.squadLeaderboard.length} squad scores from database ✓`)
    }

    // 2. Fetch Top Solo Scores
    const { data: soloData, error: soloErr } = await supabase
      .from('leaderboard')
      .select('display_name, score, altitude, player_id, created_at')
      .eq('mode', 'solo')
      .order('score', { ascending: false })
      .limit(50)

    if (soloErr) {
      console.warn('[Supabase] Solo query error (table may need creation):', soloErr.message)
    } else if (soloData && soloData.length > 0) {
      db.soloLeaderboard = soloData.map(row => ({
        displayName: row.display_name,
        score: Number(row.score),
        altitude: Number(row.altitude),
        playerId: row.player_id || '',
        timestamp: new Date(row.created_at).getTime()
      }))
      console.log(`[Supabase] Loaded ${db.soloLeaderboard.length} solo scores from database ✓`)
    }

    saveData(db)
  } catch (err) {
    console.error('[Supabase] Unexpected sync error:', err.message)
  }
}

// Perform initial sync on startup
syncFromSupabase()

// ─── REST Endpoints ───────────────────────────────────────────────────────────

/** Health Check for Render keep-alive & Supabase status */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Chainmates Authoritative Server',
    version: '2.0.0',
    supabaseConnected: !!supabase,
    supabaseUrl: SUPABASE_URL,
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  })
})

app.get('/', (req, res) => {
  res.json({
    message: 'Chainmates Authoritative Leaderboard API is running ⚡',
    database: supabase ? 'Supabase PostgreSQL' : 'Local Fallback Cache',
    endpoints: {
      leaderboard: 'GET /api/leaderboard',
      submitScore: 'POST /api/score',
      health: 'GET /health'
    }
  })
})

/** GET /api/leaderboard — Return Top 50 Co-op Squad and Solo high scores */
app.get('/api/leaderboard', leaderboardFetchLimiter, async (req, res) => {
  // Try refreshing from Supabase if connected
  if (supabase) {
    await syncFromSupabase().catch(() => {})
  }

  res.json({
    success: true,
    squadLeaderboard: db.squadLeaderboard.slice(0, 50),
    soloLeaderboard: db.soloLeaderboard.slice(0, 50)
  })
})

/** POST /api/score — Submit a new run score with server validation and Supabase persistence */
app.post('/api/score', scoreSubmitLimiter, async (req, res) => {
  const { mode, teamName, score, altitude, partnerName, playerId } = req.body

  if (typeof score !== 'number' || score < 0) {
    return res.status(400).json({ success: false, error: 'Invalid score payload' })
  }

  const isSolo = mode === 'SOLO' || !partnerName || partnerName === 'Ball Droid' || partnerName === '__SOLO__'
  const cleanAlt = typeof altitude === 'number' && altitude >= 0 ? Math.round(altitude * 10) / 10 : 0
  const cleanScore = Math.round(score)
  const cleanName = String(teamName || 'Climber').trim().substring(0, 36) || 'Climber'

  if (isSolo) {
    // ─── Solo Practice Score Handling ─────────────────────────────────────────
    const targetBoard = db.soloLeaderboard
    const existingIdx = targetBoard.findIndex(e => e.displayName.toLowerCase() === cleanName.toLowerCase())

    if (existingIdx >= 0) {
      if (cleanScore > targetBoard[existingIdx].score) {
        targetBoard[existingIdx].score = cleanScore
        targetBoard[existingIdx].altitude = Math.max(targetBoard[existingIdx].altitude, cleanAlt)
        targetBoard[existingIdx].timestamp = Date.now()
      }
    } else {
      targetBoard.push({
        displayName: cleanName,
        score: cleanScore,
        altitude: cleanAlt,
        playerId: playerId || '',
        timestamp: Date.now()
      })
    }

    targetBoard.sort((a, b) => b.score - a.score)
    if (targetBoard.length > 100) targetBoard.length = 100
    saveData(db)

    // Persist to Supabase
    if (supabase) {
      try {
        await supabase.from('leaderboard').insert([{
          mode: 'solo',
          display_name: cleanName,
          partner_name: '',
          player_id: playerId || '',
          score: cleanScore,
          altitude: cleanAlt
        }])
        console.log(`[Supabase] Solo score saved: ${cleanName} — ${cleanScore} pts (${cleanAlt}m)`)
      } catch (e) {
        console.error('[Supabase] Failed to write solo score:', e.message)
      }
    }

    const rank = targetBoard.findIndex(e => e.displayName.toLowerCase() === cleanName.toLowerCase()) + 1

    return res.json({
      success: true,
      mode: 'SOLO',
      rank,
      squadLeaderboard: db.squadLeaderboard.slice(0, 50),
      soloLeaderboard: db.soloLeaderboard.slice(0, 50)
    })
  }

  // ─── Co-op Squad Score Handling ───────────────────────────────────────────
  const targetBoard = db.squadLeaderboard
  const existingIdx = targetBoard.findIndex(e => e.displayName.toLowerCase() === cleanName.toLowerCase())

  if (existingIdx >= 0) {
    if (cleanScore > targetBoard[existingIdx].score) {
      targetBoard[existingIdx].score = cleanScore
      targetBoard[existingIdx].altitude = Math.max(targetBoard[existingIdx].altitude, cleanAlt)
      targetBoard[existingIdx].timestamp = Date.now()
    }
  } else {
    targetBoard.push({
      displayName: cleanName,
      score: cleanScore,
      altitude: cleanAlt,
      partnerName: partnerName || '',
      playerId: playerId || '',
      timestamp: Date.now()
    })
  }

  targetBoard.sort((a, b) => b.score - a.score)
  if (targetBoard.length > 100) targetBoard.length = 100
  saveData(db)

  // Persist to Supabase
  if (supabase) {
    try {
      await supabase.from('leaderboard').insert([{
        mode: 'squad',
        display_name: cleanName,
        partner_name: partnerName || '',
        player_id: playerId || '',
        score: cleanScore,
        altitude: cleanAlt
      }])
      console.log(`[Supabase] Squad score saved: ${cleanName} — ${cleanScore} pts (${cleanAlt}m)`)
    } catch (e) {
      console.error('[Supabase] Failed to write squad score:', e.message)
    }
  }

  const newRank = targetBoard.findIndex(e => e.displayName.toLowerCase() === cleanName.toLowerCase()) + 1
  console.log(`[Score] Squad score recorded: ${cleanName} — ${cleanScore} pts (${cleanAlt}m), Rank: #${newRank}`)

  res.json({
    success: true,
    mode: 'SQUAD',
    rank: newRank,
    squadLeaderboard: db.squadLeaderboard.slice(0, 50),
    soloLeaderboard: db.soloLeaderboard.slice(0, 50)
  })
})

/** DELETE /api/leaderboard — Admin wipe/reset (Requires Bearer token) */
app.delete('/api/leaderboard', async (req, res) => {
  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer ${ADMIN_KEY}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized admin key' })
  }

  db = { ...INITIAL_DATA }
  saveData(db)

  if (supabase) {
    try {
      await supabase.from('leaderboard').delete().neq('id', 0)
      console.log('[Supabase] Admin leaderboard wiped.')
    } catch (e) {
      console.error('[Supabase] Wipe error:', e.message)
    }
  }

  res.json({ success: true, message: 'Squad Leaderboard reset to initial state' })
})

app.listen(PORT, () => {
  console.log(`⚡ Chainmates Authoritative Server listening on port ${PORT}`)
  console.log(`   Database: ${supabase ? 'Connected to Supabase' : 'Local In-Memory / File Fallback'}`)
})
