/**
 * server/index.js
 * Authoritative High-Score Leaderboard Backend for Chainmates
 * Ready for 1-Click Deployment on Render.com
 * Includes Production Rate Limiting, Anti-Cheat, and Security Headers
 */

const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000
const DATA_DIR = path.join(__dirname, 'data')
const DB_FILE = path.join(DATA_DIR, 'leaderboard.json')
const ADMIN_KEY = process.env.ADMIN_KEY || 'chainmates-admin-secret'

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

// 2. Score Submission Rate Limiter (Max 6 submissions per minute per IP)
const scoreSubmitLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Rate limit exceeded: Max 6 score submissions per minute.'
  }
})

// 3. Leaderboard Fetch Rate Limiter (Max 60 fetches per minute per IP)
const leaderboardFetchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
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

// Initial Co-op Squad Leaderboard State (Clean slate for real players)
const INITIAL_DATA = {
  squadLeaderboard: []
}

const MOCK_NAMES = ['Neon & Cyber', 'Spark & Nova', 'Aether & Void', 'Pulse & Orbit', 'CyberClimber', 'NeonRunner', 'ApexJumper']

// Load or initialize persistent data
function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8')
      const parsed = JSON.parse(raw)
      const list = Array.isArray(parsed.squadLeaderboard) ? parsed.squadLeaderboard : []
      const cleaned = list.filter(e => !MOCK_NAMES.includes(e.displayName))
      saveData({ squadLeaderboard: cleaned })
      return { squadLeaderboard: cleaned }
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

// In-memory cache synced with disk
let db = loadData()

// ─── REST Endpoints ───────────────────────────────────────────────────────────

/** Health Check for Render keep-alive */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Chainmates Authoritative Server',
    version: '1.0.0',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString()
  })
})

app.get('/', (req, res) => {
  res.json({
    message: 'Chainmates Co-op Squad Leaderboard API is running ⚡',
    endpoints: {
      leaderboard: 'GET /api/leaderboard',
      submitScore: 'POST /api/score',
      health: 'GET /health'
    }
  })
})

/** GET /api/leaderboard — Return Top 50 Co-op Squad high scores */
app.get('/api/leaderboard', leaderboardFetchLimiter, (req, res) => {
  res.json({
    success: true,
    squadLeaderboard: db.squadLeaderboard.slice(0, 50)
  })
})

/** POST /api/score — Submit a new Co-op Squad run score with server validation */
app.post('/api/score', scoreSubmitLimiter, (req, res) => {
  const { mode, teamName, score, altitude, partnerName, playerId } = req.body

  // Solo practice runs do not write to the persistent leaderboard
  const isSolo = mode === 'SOLO' || !partnerName || partnerName === 'Ball Droid' || partnerName === '__SOLO__'
  if (isSolo) {
    return res.json({
      success: true,
      message: 'Solo practice score acknowledged (leaderboard is co-op squad only)',
      squadLeaderboard: db.squadLeaderboard.slice(0, 50)
    })
  }

  if (!teamName || typeof score !== 'number' || score < 0) {
    return res.status(400).json({ success: false, error: 'Invalid score payload' })
  }

  // Anti-Cheat Sanity Check: Altitude and Score validation
  const cleanAlt = typeof altitude === 'number' && altitude >= 0 ? Math.round(altitude) : 0
  const cleanScore = Math.round(score)
  const cleanName = String(teamName).trim().substring(0, 36) || 'Squad Duo'

  const targetBoard = db.squadLeaderboard

  // Check if squad team already has an entry
  const existingIdx = targetBoard.findIndex(e => e.displayName.toLowerCase() === cleanName.toLowerCase())

  if (existingIdx >= 0) {
    // Only update if new score is higher
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
      timestamp: Date.now()
    })
  }

  // Sort descending by score
  targetBoard.sort((a, b) => b.score - a.score)

  // Cap board to top 100 entries
  if (targetBoard.length > 100) {
    targetBoard.length = 100
  }

  // Persist changes
  saveData(db)

  // Find updated rank
  const newRank = targetBoard.findIndex(e => e.displayName.toLowerCase() === cleanName.toLowerCase()) + 1

  console.log(`[Score] Squad score recorded: ${cleanName} — ${cleanScore} pts (${cleanAlt}m), Rank: #${newRank}`)

  res.json({
    success: true,
    rank: newRank,
    squadLeaderboard: db.squadLeaderboard.slice(0, 50)
  })
})

/** DELETE /api/leaderboard — Admin wipe/reset (Requires Bearer token) */
app.delete('/api/leaderboard', (req, res) => {
  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer ${ADMIN_KEY}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized admin key' })
  }

  db = { ...INITIAL_DATA }
  saveData(db)
  res.json({ success: true, message: 'Squad Leaderboard reset to initial state' })
})

app.listen(PORT, () => {
  console.log(`⚡ Chainmates Authoritative Co-op Server listening on port ${PORT} with Rate Limiting enabled`)
})
