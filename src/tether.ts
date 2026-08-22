/**
 * tether.ts
 * The core mechanic of Chainmates.
 *
 * Every frame:
 *  1. Find the local player's position and their tethered partner's position.
 *  2. If distance > MAX_CHAIN_LENGTH, trigger a yank (nudge + stun + broadcast).
 *  3. Update the chain mesh — a cylinder with a seamless chain-link texture
 *     wrapped around it. Y-tiling is scaled to the chain length so links always
 *     appear correctly sized. AlbedoColor tints the texture for tension feedback.
 *     - SLACK  → neutral metal tint
 *     - TAUT   → warm gold tint
 *     - YANKED → red danger flash
 */

import { engine, Transform, MeshRenderer, Material, VisibilityComponent, TextureWrapMode, TextureFilterMode, MaterialTransparencyMode } from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { movePlayerTo } from '~system/RestrictedActions'
import { gameState, broadcastYank } from './gameState'
import { getProxyEntity } from './playerSync'
import { playYankSound } from './audio'

// ─── Config ───────────────────────────────────────────────────────────────────
const MAX_CHAIN_LENGTH = 4.0    // max chain length in meters
const PULL_INTERVAL = 0.25   // seconds between continuous elastic pulls
const CHAIN_RADIUS = 0.18   // visual chain width (each plane = CHAIN_RADIUS * 2 wide)

// ─── Texture Sources ──────────────────────────────────────────────────────────
const CHAIN_TEXTURE_SRC = 'assets/textures/Chain.png'
const ROPE_TEXTURE_SRC = 'assets/textures/Rope.png'
const NEON_TEXTURE_SRC = 'assets/textures/Neon.png'
const LINKS_PER_METER = 1.8  // link-pairs per metre of chain

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

// ─── Chain visual entities: two crossed flat planes for all-angle visibility ──
// Plane A is wide on X (visible when looking from ±Z)
// Plane B is wide on Z (visible when looking from ±X)
// Together they form a cross that shows the chain from every horizontal angle.
type ChainEntity = ReturnType<typeof engine.addEntity>
let chainPlaneA: ChainEntity | null = null
let chainPlaneB: ChainEntity | null = null
let pullCooldownTimer = 0

// Material update caching to avoid per-frame PBR material allocations
let lastAppliedTension: string = ''
let lastAppliedSkin: number = -1
let lastAppliedTilingY: number = -1

const PLANE_DEPTH = 0.018  // thin axis of each plane — just enough to prevent z-fighting

function createChainPlane(): ChainEntity {
  const e = engine.addEntity()
  Transform.create(e, { position: Vector3.create(8, 1, 8), scale: Vector3.create(1, 1, 1) })
  MeshRenderer.setBox(e)
  Material.setPbrMaterial(e, {
    texture: Material.Texture.Common({
      src: CHAIN_TEXTURE_SRC,
      wrapMode: TextureWrapMode.TWM_REPEAT,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      tiling: { x: 1, y: LINKS_PER_METER }
    }),
    albedoColor: Color4.create(1, 1, 1, 1),
    metallic: 0.6,
    roughness: 0.35,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
  })
  VisibilityComponent.create(e, { visible: false })
  return e
}

function ensureChainPlanes() {
  if (!chainPlaneA) chainPlaneA = createChainPlane()
  if (!chainPlaneB) chainPlaneB = createChainPlane()
}

function setChainPlanesVisible(visible: boolean) {
  if (chainPlaneA) VisibilityComponent.getMutable(chainPlaneA).visible = visible
  if (chainPlaneB) VisibilityComponent.getMutable(chainPlaneB).visible = visible
}

function applyChainMaterial(mat: Parameters<typeof Material.setPbrMaterial>[1]) {
  if (chainPlaneA) Material.setPbrMaterial(chainPlaneA, mat)
  if (chainPlaneB) Material.setPbrMaterial(chainPlaneB, mat)
}

// ─── Public state readable by HUD ────────────────────────────────────────────
export const tetherState = {
  tension: 'SLACK' as 'SLACK' | 'TAUT' | 'YANKED',
  distanceToPartner: 0
}

// ─── System ───────────────────────────────────────────────────────────────────
export function tetherSystem(dt: number) {
  ensureChainPlanes()

  // Tick pull timer
  if (pullCooldownTimer > 0) {
    pullCooldownTimer -= dt
  }

  // Render tether whenever we have a partner or practice droid (LOBBY, COUNTDOWN, RUNNING, PRACTICE)
  if (!gameState.partnerId) {
    setChainPlanesVisible(false)
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

  // ── Position & orient the two chain planes ───────────────────────────────
  setChainPlanesVisible(true)

  // Attachment points (waist/chest for humans, center for Ball Droid)
  const myChest = Vector3.create(myPos.x, myPos.y + 1.1, myPos.z)
  const isDroid = gameState.partnerId === '__SOLO__'
  const partnerAttachY = isDroid ? partnerPos.y + 0.3 : partnerPos.y + 1.1
  const partnerChest = Vector3.create(partnerPos.x, partnerAttachY, partnerPos.z)

  const dist = Vector3.distance(myChest, partnerChest)
  tetherState.distanceToPartner = dist

  const midpoint = Vector3.scale(Vector3.add(myChest, partnerChest), 0.5)
  const dir = Vector3.subtract(partnerChest, myChest)

  // Base rotation: aligns local Y to chain direction
  let baseRot = Quaternion.Identity()
  if (Vector3.lengthSquared(dir) > 0.0001) {
    const lookRot = Quaternion.lookRotation(Vector3.normalize(dir), Vector3.Up())
    baseRot = Quaternion.multiply(lookRot, Quaternion.fromEulerDegrees(-90, 0, 0))
  }

  // Plane A: wide on X, thin on Z  → visible when looking from ±Z
  const tfA = Transform.getMutable(chainPlaneA!)
  tfA.position = midpoint
  tfA.rotation = baseRot
  tfA.scale = Vector3.create(CHAIN_RADIUS * 2, Math.max(dist, 0.1), PLANE_DEPTH)

  // Plane B: wide on Z, thin on X  → visible when looking from ±X
  // We rotate it 90° around the chain axis (local Y) so it's perpendicular to Plane A
  const tfB = Transform.getMutable(chainPlaneB!)
  tfB.position = midpoint
  tfB.rotation = Quaternion.multiply(baseRot, Quaternion.fromEulerDegrees(0, 90, 0))
  tfB.scale = Vector3.create(CHAIN_RADIUS * 2, Math.max(dist, 0.1), PLANE_DEPTH)

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

  // ── Apply material only when tension, skin, or tiling changes significantly ──
  const tilingY = Math.round(Math.max(dist, 0.1) * LINKS_PER_METER * 2) / 2 // round to 0.5 step

  const shouldUpdateMat =
    tetherState.tension !== lastAppliedTension ||
    skin !== lastAppliedSkin ||
    Math.abs(tilingY - lastAppliedTilingY) >= 0.5

  if (shouldUpdateMat) {
    lastAppliedTension = tetherState.tension
    lastAppliedSkin = skin
    lastAppliedTilingY = tilingY

    if (skin === 0) {
      // Chain skin — texture with emissive tension overlay
      const tensionEmissive = dist >= MAX_CHAIN_LENGTH
        ? Color4.create(1.0, 0.05, 0.05, 1)
        : ratio > 0.7
          ? Color4.create((ratio - 0.7) / 0.3 * 0.8, (ratio - 0.7) / 0.3 * 0.4, 0, 1)
          : Color4.create(0, 0, 0, 0)
      const tensionEmissiveIntensity = dist >= MAX_CHAIN_LENGTH ? 2.5 : ratio > 0.7 ? 1.2 : 0

      applyChainMaterial({
        texture: Material.Texture.Common({
          src: CHAIN_TEXTURE_SRC,
          wrapMode: TextureWrapMode.TWM_REPEAT,
          filterMode: TextureFilterMode.TFM_BILINEAR,
          tiling: { x: 1, y: tilingY }
        }),
        albedoColor: Color4.create(1, 1, 1, 1),
        metallic: 0.75,
        roughness: 0.25,
        transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
        emissiveColor: tensionEmissive,
        emissiveIntensity: tensionEmissiveIntensity
      })
    } else if (skin === 1) {
      // Rope skin — woven braided climbing cord with alpha cutout
      applyChainMaterial({
        texture: Material.Texture.Common({
          src: ROPE_TEXTURE_SRC,
          wrapMode: TextureWrapMode.TWM_REPEAT,
          filterMode: TextureFilterMode.TFM_BILINEAR,
          tiling: { x: 1, y: tilingY }
        }),
        albedoColor: Color4.create(1, 1, 1, 1),
        metallic: 0.0,
        roughness: 0.85,
        transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
        emissiveColor: emissive,
        emissiveIntensity: dist >= MAX_CHAIN_LENGTH ? 2.0 : 0.2
      })
    } else {
      // Neon skin — glowing cyber laser energy beam with transparent alpha blend
      applyChainMaterial({
        texture: Material.Texture.Common({
          src: NEON_TEXTURE_SRC,
          wrapMode: TextureWrapMode.TWM_REPEAT,
          filterMode: TextureFilterMode.TFM_BILINEAR,
          tiling: { x: 1, y: tilingY }
        }),
        emissiveTexture: Material.Texture.Common({
          src: NEON_TEXTURE_SRC,
          wrapMode: TextureWrapMode.TWM_REPEAT,
          filterMode: TextureFilterMode.TFM_BILINEAR,
          tiling: { x: 1, y: tilingY }
        }),
        albedoColor: Color4.create(1, 1, 1, 1),
        transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
        emissiveColor: Color4.create(chainColor.r, chainColor.g, chainColor.b, 1),
        emissiveIntensity: dist >= MAX_CHAIN_LENGTH ? 4.0 : 2.5,
        metallic: 0.1,
        roughness: 0.1
      })
    }
  }

  // ── Responsive Elastic Tether & Dangling Physics ─────────────────────────
  const yDiff = myPos.y - partnerPos.y

  if (dist > MAX_CHAIN_LENGTH && pullCooldownTimer <= 0) {
    pullCooldownTimer = PULL_INTERVAL
    tetherState.tension = 'YANKED'
    playYankSound()

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
  lastAppliedSkin = -1
}

/** Called on finish or reset — hides the chain */
export function hideChain() {
  setChainPlanesVisible(false)
  tetherState.tension = 'SLACK'
  pullCooldownTimer = 0
  lastAppliedSkin = -1
  lastAppliedTension = ''
}
