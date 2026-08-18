/**
 * tether.ts
 * The core mechanic of Chainmates.
 *
 * Every frame:
 *  1. Find the local player's position and their tethered partner's position.
 *  2. If distance > MAX_CHAIN_LENGTH, trigger a yank (nudge + stun + broadcast).
 *  3. Update the chain mesh (a cylinder stretched between the two positions).
 *     - Color shifts: green (slack) → yellow (taut) → red (about to yank)
 */

import { engine, Transform, MeshRenderer, Material, VisibilityComponent } from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { gameState, broadcastYank } from './gameState'
import { getProxyEntity } from './playerSync'

// ─── Config ───────────────────────────────────────────────────────────────────
const MAX_CHAIN_LENGTH = 4.0    // max chain length in meters
const PULL_INTERVAL = 0.25   // seconds between continuous elastic pulls
const CHAIN_RADIUS = 0.06   // visual chain tube radius

// ─── Skin definitions ─────────────────────────────────────────────────────────
const SKIN_SLACK_COLORS: Color4[] = [
  Color4.create(0.6, 0.6, 0.6, 1),   // 0: Chain — grey metal
  Color4.create(0.6, 0.4, 0.2, 1),   // 1: Rope  — brown
  Color4.create(0.0, 1.0, 0.8, 1)    // 2: Neon  — cyan
]
const SKIN_TAUT_COLORS: Color4[] = [
  Color4.create(1.0, 0.7, 0.0, 1),   // 0: Chain — warm gold
  Color4.create(0.9, 0.6, 0.1, 1),   // 1: Rope  — orange
  Color4.create(1.0, 0.9, 0.0, 1)    // 2: Neon  — yellow
]
const SKIN_YANK_COLORS: Color4[] = [
  Color4.create(1.0, 0.1, 0.1, 1),   // 0: Chain — red
  Color4.create(0.9, 0.0, 0.0, 1),   // 1: Rope  — red
  Color4.create(1.0, 0.0, 0.5, 1)    // 2: Neon  — hot pink
]

// ─── Chain visual entity (one per session, recycled) ─────────────────────────
let chainEntity: ReturnType<typeof engine.addEntity> | null = null
let pullCooldownTimer = 0

function ensureChainEntity() {
  if (chainEntity) return
  chainEntity = engine.addEntity()
  Transform.create(chainEntity, {
    position: Vector3.create(8, 1, 8),
    scale: Vector3.create(1, 1, 1)
  })
  
  // Set default cylinder (radius 0.5, diameter 1.0) so our Transform scale 
  // explicitly controls the visual thickness reliably across SDK versions.
  MeshRenderer.setCylinder(chainEntity)
  
  Material.setPbrMaterial(chainEntity, {
    albedoColor: SKIN_SLACK_COLORS[0],
    metallic: 0.6,
    roughness: 0.3,
    emissiveColor: Color4.create(0, 0, 0, 0)
  })
  VisibilityComponent.create(chainEntity, { visible: false })
}

// ─── Public state readable by HUD ────────────────────────────────────────────
export const tetherState = {
  tension: 'SLACK' as 'SLACK' | 'TAUT' | 'YANKED',
  distanceToPartner: 0
}

// ─── System ───────────────────────────────────────────────────────────────────
export function tetherSystem(dt: number) {
  ensureChainEntity()

  // Tick pull timer
  if (pullCooldownTimer > 0) {
    pullCooldownTimer -= dt
  }

  // Render tether whenever we have a partner (in LOBBY, COUNTDOWN, and RUNNING)
  if (!gameState.partnerId) {
    if (chainEntity) {
      const vis = VisibilityComponent.getMutable(chainEntity)
      vis.visible = false
    }
    tetherState.tension = 'SLACK'
    return
  }

  const localTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!localTransform) return

  // Get partner position from proxy or direct remote players map
  let partnerPos: Vector3 | null = null
  const partnerProxy = getProxyEntity(gameState.partnerId)
  if (partnerProxy) {
    const pt = Transform.getOrNull(partnerProxy)
    if (pt) partnerPos = pt.position
  }

  if (!partnerPos) {
    const remote = gameState.remotePlayers.get(gameState.partnerId)
    if (remote) {
      partnerPos = Vector3.create(remote.x, remote.y, remote.z)
    }
  }

  if (!partnerPos) return

  const myPos = localTransform.position
  const dist = Vector3.distance(myPos, partnerPos)
  tetherState.distanceToPartner = dist

  // ── Update chain visual ──────────────────────────────────────────────────
  const chainVis = VisibilityComponent.getMutable(chainEntity!)
  chainVis.visible = true

  // Adjust Y to chest height (~1.25 meters up from feet)
  const myChest = Vector3.create(myPos.x, myPos.y + 1.25, myPos.z)
  const partnerChest = Vector3.create(partnerPos.x, partnerPos.y + 1.25, partnerPos.z)

  const midpoint = Vector3.scale(Vector3.add(myChest, partnerChest), 0.5)

  const chainTransform = Transform.getMutable(chainEntity!)
  chainTransform.position = midpoint

  // Full length cylinder between player chest points
  // Scale X and Z to make the cylinder thin, Y to match distance.
  chainTransform.scale = Vector3.create(CHAIN_RADIUS * 2, Math.max(dist, 0.1), CHAIN_RADIUS * 2)

  // Rotate cylinder: in DCL primitive cylinder default axis is +Y.
  // Rotating -90deg on X maps local +Y to +Z (which lookRotation points along dir).
  // If distance is extremely small, keep previous rotation to avoid snapping issues.
  const dir = Vector3.subtract(partnerChest, myChest)
  if (Vector3.lengthSquared(dir) > 0.0001) {
    const lookRot = Quaternion.lookRotation(Vector3.normalize(dir), Vector3.Up())
    chainTransform.rotation = Quaternion.multiply(
      lookRot,
      Quaternion.fromEulerDegrees(-90, 0, 0)
    )
  }

  // ── Color by tension ────────────────────────────────────────────────────
  const skin = gameState.tetherSkinIndex
  const ratio = Math.min(dist / MAX_CHAIN_LENGTH, 1.0)

  let chainColor: Color4
  let emissive: Color4 = Color4.create(0, 0, 0, 0)

  if (dist >= MAX_CHAIN_LENGTH) {
    // Yanked — flash intense red/danger
    chainColor = SKIN_YANK_COLORS[skin]
    emissive = Color4.create(chainColor.r * 0.8, chainColor.g * 0.2, chainColor.b * 0.2, 0)
    tetherState.tension = 'YANKED'
  } else if (ratio > 0.7) {
    // Taut — interpolate gold warning
    const t = (ratio - 0.7) / 0.3
    const sc = SKIN_SLACK_COLORS[skin]
    const tc = SKIN_TAUT_COLORS[skin]
    chainColor = Color4.create(
      sc.r + (tc.r - sc.r) * t,
      sc.g + (tc.g - sc.g) * t,
      sc.b + (tc.b - sc.b) * t, 1
    )
    tetherState.tension = 'TAUT'
  } else {
    chainColor = SKIN_SLACK_COLORS[skin]
    tetherState.tension = 'SLACK'
  }

  Material.setPbrMaterial(chainEntity!, {
    albedoColor: chainColor,
    metallic: skin === 0 ? 0.8 : 0.1,
    roughness: skin === 1 ? 0.9 : 0.2,
    emissiveColor: emissive
  })

  // ── Responsive Elastic Tether & Dangling Physics ─────────────────────────
  const yDiff = myPos.y - partnerPos.y

  if (dist > MAX_CHAIN_LENGTH && pullCooldownTimer <= 0) {
    pullCooldownTimer = PULL_INTERVAL
    tetherState.tension = 'YANKED'

    const excessDist = dist - MAX_CHAIN_LENGTH

    // If I am dangling below partner: pull me upward & inward toward partner's platform
    if (yDiff < -1.0) {
      const hoistVector = Vector3.scale(dir, Math.min(excessDist * 1.6 + 1.5, 3.8))
      const hoistTarget = Vector3.add(myPos, hoistVector)
      movePlayerTo({
        newRelativePosition: {
          x: hoistTarget.x,
          y: Math.max(hoistTarget.y, partnerPos.y - 0.2), // hoisted toward partner Y level!
          z: hoistTarget.z
        }
      }).catch(() => { })
    }
    // If partner is dangling below me: pull me down & toward the edge (weight drag!)
    else if (yDiff > 1.0) {
      const dragVector = Vector3.scale(dir, Math.min(excessDist * 1.2 + 0.8, 2.5))
      const dragTarget = Vector3.add(myPos, dragVector)
      movePlayerTo({
        newRelativePosition: {
          x: dragTarget.x,
          y: Math.max(dragTarget.y - 0.2, 0.2), // slight downward drag
          z: dragTarget.z
        }
      }).catch(() => { })
    }
    // Standard horizontal tension pull
    else {
      const pullMagnitude = Math.min(excessDist * 1.5 + 1.2, 3.5)
      const pullVector = Vector3.scale(dir, pullMagnitude)
      const pullTarget = Vector3.add(myPos, pullVector)

      movePlayerTo({
        newRelativePosition: {
          x: pullTarget.x,
          y: Math.max(pullTarget.y, 0.2),
          z: pullTarget.z
        }
      }).catch(() => { })
    }

    broadcastYank(gameState.partnerId)
  }
}

/** Called by UI when player picks a chain skin */
export function setChainSkin(index: number) {
  gameState.tetherSkinIndex = index
}

/** Called on finish or reset — hides the chain */
export function hideChain() {
  if (chainEntity) {
    const vis = VisibilityComponent.getMutable(chainEntity)
    vis.visible = false
  }
  tetherState.tension = 'SLACK'
  pullCooldownTimer = 0
}
