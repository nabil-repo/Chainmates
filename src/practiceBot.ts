/**
 * practiceBot.ts
 * AI practice partner for solo runs in Chainmates using the Ball Droid 3D model.
 *
 * A floating Ball Droid companion that follows the player with intentional lag,
 * creating natural tether tension (SLACK / TAUT / YANKED) during practice mode.
 *
 * Architecture:
 *  - createPracticeBot() spawns the Ball Droid GLB model and registers a
 *    RemotePlayer entry in gameState.remotePlayers as '__SOLO__'.
 *  - The tether system connects the tether chain directly to the Ball Droid!
 *  - practiceBotSystem() updates the droid position, rotation, and bobbing every frame.
 *  - destroyPracticeBot() cleans up entities and the map entry.
 */

import {
  engine,
  Transform,
  GltfContainer,
  TextShape,
  Billboard,
  BillboardMode
} from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4 } from '@dcl/sdk/math'
import { gameState } from './gameState'

// ─── Constants ────────────────────────────────────────────────────────────────
const BOT_ID = '__SOLO__'
const BOT_OFFSET_X = 1.5   // tight, comfortable companion distance from player
const BOT_OFFSET_Z = 0.15
const FOLLOW_LERP = 3.8    // responsive horizontal follow
const CLIMB_LERP = 3.2     // responsive vertical follow
const BOB_AMPLITUDE = 0.12 // subtle floating bob
const BOB_SPEED = 3.2      // bob cycle speed

// ─── State ────────────────────────────────────────────────────────────────────
let botEntity: ReturnType<typeof engine.addEntity> | null = null
let labelEntity: ReturnType<typeof engine.addEntity> | null = null

let botX = 0
let botY = 0
let botZ = 0
let botTime = 0

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Spawn the Ball Droid practice companion at the specified coordinates.
 */
export function createPracticeBot(startX: number, startY: number, startZ: number) {
  destroyPracticeBot() // ensure clean state

  botX = startX + BOT_OFFSET_X
  botY = startY + 0.8
  botZ = startZ + BOT_OFFSET_Z
  botTime = 0

  // Register in remotePlayers so tether system connects the chain to the droid
  gameState.remotePlayers.set(BOT_ID, {
    id: BOT_ID,
    displayName: 'Ball Droid',
    x: botX,
    y: botY,
    z: botZ,
    lastSeen: Date.now()
  })

  // ── Ball Droid 3D GLB Model (Ghost companion — 0 physics collision) ─────────
  botEntity = engine.addEntity()
  Transform.create(botEntity, {
    position: Vector3.create(botX, botY, botZ),
    scale: Vector3.create(1.0, 1.0, 1.0),
    rotation: Quaternion.fromEulerDegrees(0, 180, 0)
  })
  GltfContainer.create(botEntity, {
    src: 'assets/asset-packs/ball_droid/Droid_01/Droid_01.glb',
    invisibleMeshesCollisionMask: 0,
    visibleMeshesCollisionMask: 0
  })

  // ── Billboard Holographic Label ───────────────────────────────────────────
  labelEntity = engine.addEntity()
  Transform.create(labelEntity, {
    position: Vector3.create(botX, botY + 0.65, botZ)
  })
  TextShape.create(labelEntity, {
    text: '🤖 BALL DROID',
    fontSize: 1.4,
    textColor: Color4.create(0.15, 0.88, 1.00, 0.95)
  })
  Billboard.create(labelEntity, { billboardMode: BillboardMode.BM_Y })
}

/**
 * Remove the Ball Droid and clean up state.
 */
export function destroyPracticeBot() {
  if (botEntity !== null) {
    engine.removeEntity(botEntity)
    botEntity = null
  }
  if (labelEntity !== null) {
    engine.removeEntity(labelEntity)
    labelEntity = null
  }
  gameState.remotePlayers.delete(BOT_ID)
}

/**
 * Engine system: updates Ball Droid position, hovering, and tether sync.
 */
export function practiceBotSystem(dt: number) {
  if (!gameState.isPracticeMode || botEntity === null) return

  botTime += dt

  // Track player position
  const playerT = Transform.getOrNull(engine.PlayerEntity)
  if (!playerT) return

  const px = playerT.position.x
  const py = playerT.position.y
  const pz = playerT.position.z

  // Target: follow snuggly alongside player with tight offset
  const targetX = px + BOT_OFFSET_X
  const targetY = py + 0.5
  const targetZ = pz + BOT_OFFSET_Z

  // Adaptive catch-up speed if droid falls behind
  const dx = targetX - botX
  const dz = targetZ - botZ
  const horizDist = Math.sqrt(dx * dx + dz * dz)
  const currentLerp = horizDist > 2.0 ? FOLLOW_LERP * 2.0 : FOLLOW_LERP

  botX += dx * Math.min(1, currentLerp * dt)
  botY += (targetY - botY) * Math.min(1, CLIMB_LERP * dt)
  botZ += dz * Math.min(1, currentLerp * dt)

  // Floating hover animation
  const bob = Math.sin(botTime * BOB_SPEED) * BOB_AMPLITUDE
  const hoverY = botY + bob

  // Slight tilt / gentle spin
  const angleY = (botTime * 30) % 360

  // Update droid entity
  if (botEntity !== null) {
    const bt = Transform.getMutable(botEntity)
    bt.position = Vector3.create(botX, hoverY, botZ)
    bt.rotation = Quaternion.fromEulerDegrees(Math.sin(botTime * 2) * 6, angleY, Math.cos(botTime * 2) * 6)
  }

  // Update label entity
  if (labelEntity !== null) {
    const lt = Transform.getMutable(labelEntity)
    lt.position = Vector3.create(botX, hoverY + 0.65, botZ)
  }

  // Keep remotePlayers updated so tether connects perfectly
  const entry = gameState.remotePlayers.get(BOT_ID)
  if (entry) {
    entry.x = botX
    entry.y = hoverY
    entry.z = botZ
    entry.lastSeen = Date.now()
  }
}
