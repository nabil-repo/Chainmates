# ⚡ Chainmates Authoritative Leaderboard Server

A fast, lightweight Node.js/Express backend for the **Chainmates** Decentraland climbing game, designed for 1-click deployment on [Render.com](https://render.com).

---

## 🚀 Quick Start (Local)

1. Navigate to the `server/` directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```
   The server will start on port `3000` (or `PORT` env variable) at `http://localhost:3000`.

---

## 🌐 Deploy to Render (1-Click / Free Tier)

1. Push your repository to **GitHub**.
2. Log into [Render.com](https://render.com) and click **New + > Web Service**.
3. Select your repository.
4. Configure the settings:
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** `Free`
5. Click **Create Web Service**!
6. Copy your Render URL (e.g. `https://chainmates-leaderboard.onrender.com`) and paste it into `src/serverLeaderboard.ts`:
   ```typescript
   export const RENDER_SERVER_URL = 'https://your-app-name.onrender.com'
   ```

---

## 📡 REST API Endpoints

### 1. `GET /health`
Health check for keep-alive pingers.
- **Response:** `{ status: "ok", service: "Chainmates Authoritative Server", uptime: 120 }`

### 2. `GET /api/leaderboard`
Fetches Top 50 global Squad and Solo rankings.
- **Response:**
  ```json
  {
    "success": true,
    "squadLeaderboard": [
      { "displayName": "Neon & Cyber", "score": 3200, "altitude": 82, "timestamp": 1724345000000 }
    ],
    "soloLeaderboard": [
      { "displayName": "CyberClimber", "score": 2100, "altitude": 58, "timestamp": 1724345000000 }
    ]
  }
  ```

### 3. `POST /api/score`
Submits and records a completed run score.
- **Request Body:**
  ```json
  {
    "mode": "SQUAD" | "SOLO",
    "teamName": "Alice & Bob",
    "score": 2450,
    "altitude": 68,
    "partnerName": "Bob",
    "playerId": "0x123..."
  }
  ```
- **Response:** `{ "success": true, "rank": 1, "squadLeaderboard": [...], "soloLeaderboard": [...] }`

### 4. `DELETE /api/leaderboard`
Admin endpoint to reset rankings. Requires `Authorization: Bearer <ADMIN_KEY>`.
