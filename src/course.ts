/**
 * course.ts
 * Endless Ascending Sky Tower with Infinite Procedural Platform Recycling
 * and Rising Molten Lava Lake.
 */

import {
  engine,
  Transform,
  MeshRenderer,
  MeshCollider,
  Material,
  TextShape,
  Billboard,
  BillboardMode
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { MovingPlatform } from './components'
import { gameState } from './gameState'

// ─── Color Palette ────────────────────────────────────────────────────────────
export const COL_FLOATING_STONE = Color4.create(0.12, 0.14, 0.24, 1)
export const COL_NEON_CYAN = Color4.create(0.15, 0.85, 1.0, 1)
export const COL_NEON_GOLD = Color4.create(1.0, 0.78, 0.15, 1)
export const COL_NEON_MAGENTA = Color4.create(0.9, 0.25, 0.85, 1)
export const COL_NEON_GREEN = Color4.create(0.15, 1.0, 0.55, 1)

/** Cycling palette for platform neon trim */
const NEON_TRIM_COLORS = [COL_NEON_CYAN, COL_NEON_MAGENTA, COL_NEON_GOLD, COL_NEON_GREEN]

/** Every Nth platform in the pool oscillates on the X-axis (skip index 0) */
const MOVING_PLATFORM_INTERVAL = 3

// ─── Platform Pool Configuration ──────────────────────────────────────────────
export const POOL_SIZE = 8
export const PLATFORM_SPACING_Y = 1.3 // height increase per step
export const SPIRAL_POINTS = [
  { x: 5.5, z: 5.0, sx: 6.0, sz: 3.0 },
  { x: 10.5, z: 7.5, sx: 6.0, sz: 3.0 },
  { x: 8.0, z: 11.0, sx: 6.5, sz: 3.2 },
  { x: 5.5, z: 13.5, sx: 6.0, sz: 3.0 },
  { x: 10.5, z: 12.0, sx: 6.0, sz: 3.0 },
  { x: 8.0, z: 8.5, sx: 6.5, sz: 3.2 },
  { x: 5.5, z: 4.5, sx: 6.0, sz: 3.0 },
  { x: 10.5, z: 3.5, sx: 6.0, sz: 3.0 },
]

export interface RecycledPlatform {
  entity: ReturnType<typeof engine.addEntity>
  labelEntity: ReturnType<typeof engine.addEntity>
  /** Four neon trim entities: [rightX, leftX, farZ, nearZ] */
  trimEntities: ReturnType<typeof engine.addEntity>[]
  baseY: number
  slotIndex: number
  altitudeTier: number
  isMoving: boolean
}

export const platformPool: RecycledPlatform[] = []
export let lavaEntity: ReturnType<typeof engine.addEntity> | null = null

// ─── Solid Box Platform Helper ────────────────────────────────────────────────
export function makePlatform(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color = COL_FLOATING_STONE
) {
  const e = engine.addEntity()
  Transform.create(e, {
    position: Vector3.create(x, y, z),
    scale: Vector3.create(sx, sy, sz)
  })
  MeshRenderer.setBox(e)
  MeshCollider.setBox(e)
  Material.setPbrMaterial(e, {
    albedoColor: color,
    metallic: 0.4,
    roughness: 0.5
  })
  return e
}

// ─── Neon Trim Helper ────────────────────────────────────────────────────
/**
 * Creates four thin emissive neon strips on the SIDES of a platform.
 * Strips protrude outward from the side faces so the top walking surface
 * is completely unobstructed — players cannot get caught on them.
 * Returns [rightX, leftX, farZ, nearZ] trim entities.
 */
export function makeNeonTrim(
  cx: number,
  platformY: number,
  cz: number,
  sx: number,
  sz: number,
  neonColor: Color4
): ReturnType<typeof engine.addEntity>[] {
  const T = 0.07   // how far strip protrudes from the side face
  const TH = 0.5    // strip height matches platform height (sy = 0.5)
  // Strips sit on the SIDE faces at platform mid-height — NOT on top
  const sideY = platformY

  const mat = {
    albedoColor: Color4.create(neonColor.r * 0.2, neonColor.g * 0.2, neonColor.b * 0.2, 1),
    emissiveColor: neonColor,
    emissiveIntensity: 2.0,
    metallic: 0.0,
    roughness: 1.0
  }

  // Right (+X) side — protrudes outward in +X
  const eR = engine.addEntity()
  Transform.create(eR, {
    position: Vector3.create(cx + sx * 0.5 + T * 0.5, sideY, cz),
    scale: Vector3.create(T, TH, sz)
  })
  MeshRenderer.setBox(eR)
  Material.setPbrMaterial(eR, mat)

  // Left (-X) side — protrudes outward in -X
  const eL = engine.addEntity()
  Transform.create(eL, {
    position: Vector3.create(cx - sx * 0.5 - T * 0.5, sideY, cz),
    scale: Vector3.create(T, TH, sz)
  })
  MeshRenderer.setBox(eL)
  Material.setPbrMaterial(eL, mat)

  // Far (+Z) side — protrudes outward in +Z
  const eF = engine.addEntity()
  Transform.create(eF, {
    position: Vector3.create(cx, sideY, cz + sz * 0.5 + T * 0.5),
    scale: Vector3.create(sx + T * 2, TH, T)
  })
  MeshRenderer.setBox(eF)
  Material.setPbrMaterial(eF, mat)

  // Near (-Z) side — protrudes outward in -Z
  const eN = engine.addEntity()
  Transform.create(eN, {
    position: Vector3.create(cx, sideY, cz - sz * 0.5 - T * 0.5),
    scale: Vector3.create(sx + T * 2, TH, T)
  })
  MeshRenderer.setBox(eN)
  Material.setPbrMaterial(eN, mat)

  return [eR, eL, eF, eN]
}

/**
 * Repositions neon trim strips when a platform is recycled to a new position.
 * trimEntities must be [rightX, leftX, farZ, nearZ] as returned by makeNeonTrim.
 */
export function repositionTrim(
  trimEntities: ReturnType<typeof engine.addEntity>[],
  cx: number,
  platformY: number,
  sx: number,
  cz: number,
  sz: number
) {
  if (!trimEntities || trimEntities.length < 4) return
  const T = 0.07
  const sideY = platformY

  const tR = Transform.getMutable(trimEntities[0])
  tR.position = Vector3.create(cx + sx * 0.5 + T * 0.5, sideY, cz)

  const tL = Transform.getMutable(trimEntities[1])
  tL.position = Vector3.create(cx - sx * 0.5 - T * 0.5, sideY, cz)

  const tF = Transform.getMutable(trimEntities[2])
  tF.position = Vector3.create(cx, sideY, cz + sz * 0.5 + T * 0.5)

  const tN = Transform.getMutable(trimEntities[3])
  tN.position = Vector3.create(cx, sideY, cz - sz * 0.5 - T * 0.5)
}

// ─── Build Course ─────────────────────────────────────────────────────────────
export function buildCourse() {
  buildMoltenLavaAbyss()
  buildStartIsland()
  buildInfinitePlatformPool()
}

// ─── Rising Molten Lava Lake ──────────────────────────────────────────────────
function buildMoltenLavaAbyss() {
  lavaEntity = engine.addEntity()
  Transform.create(lavaEntity, {
    position: Vector3.create(8.0, 0.05, 8.0),
    scale: Vector3.create(60.8, 0.3, 60.8)
  })
  MeshRenderer.setBox(lavaEntity)
  Material.setPbrMaterial(lavaEntity, {
    albedoColor: Color4.create(1.0, 0.25, 0.05, 1),
    emissiveColor: Color4.create(1.0, 0.2, 0.02, 1),
    metallic: 0.1,
    roughness: 0.9
  })
}

// ─── Lobby Waiting Lounge & Course Launchpad ──────────────────────────────────
function buildStartIsland() {
  // 1. Lobby Waiting Lounge (where unassigned / pre-game players hang out)
  makePlatform(8.0, 1.0, 0.6, 9.0, 0.5, 2.4, Color4.create(0.08, 0.10, 0.20, 1))
  // Neon trim on the lounge platform
  makeNeonTrim(8.0, 1.0, 0.6, 9.0, 2.4, COL_NEON_CYAN)

  // Waiting Lounge Holographic Sign
  const loungeSign = engine.addEntity()
  Transform.create(loungeSign, { position: Vector3.create(8.0, 2.6, 0.2) })
  TextShape.create(loungeSign, {
    text: 'SQUAD LOUNGE // PAIR & START',
    fontSize: 1.8,
    textColor: Color4.create(0.2, 0.85, 1.0, 0.9)
  })
  Billboard.create(loungeSign, { billboardMode: BillboardMode.BM_Y })

  // 2. Active Course Launchpad (where the squad spawns when the run starts)
  makePlatform(8.0, 2.0, 3.0, 7.5, 0.5, 2.8, COL_FLOATING_STONE)
  // Neon trim on launchpad — gold accent
  makeNeonTrim(8.0, 2.0, 3.0, 7.5, 2.8, COL_NEON_GOLD)

  // Launchpad Gateway Pylons
  makePlatform(4.6, 3.6, 2.0, 0.3, 3.0, 0.3, COL_NEON_CYAN)
  makePlatform(11.4, 3.6, 2.0, 0.3, 3.0, 0.3, COL_NEON_CYAN)
  makePlatform(8.0, 5.0, 2.0, 7.1, 0.3, 0.3, COL_NEON_CYAN)

  const header = engine.addEntity()
  Transform.create(header, { position: Vector3.create(8.0, 5.8, 2.0) })
  TextShape.create(header, {
    text: '⛓ ENDLESS CLIMB LAUNCHPAD',
    fontSize: 2.2,
    textColor: Color4.create(0.2, 0.9, 1.0, 1)
  })
  Billboard.create(header, { billboardMode: BillboardMode.BM_Y })
}

// ─── Infinite Procedural Platform Pool ────────────────────────────────────────
function buildInfinitePlatformPool() {
  for (let i = 0; i < POOL_SIZE; i++) {
    const slot = SPIRAL_POINTS[i]
    const initialY = 3.2 + i * PLATFORM_SPACING_Y
    const isMoving = i !== 0 && (i % MOVING_PLATFORM_INTERVAL) === 0
    const neonColor = NEON_TRIM_COLORS[i % NEON_TRIM_COLORS.length]

    const entity = engine.addEntity()
    Transform.create(entity, {
      position: Vector3.create(slot.x, initialY, slot.z),
      scale: Vector3.create(slot.sx, 0.5, slot.sz)
    })
    MeshRenderer.setBox(entity)
    MeshCollider.setBox(entity)
    Material.setPbrMaterial(entity, {
      albedoColor: COL_FLOATING_STONE,
      metallic: 0.5,
      roughness: 0.4
    })

    // Neon trim on every platform
    const trimEntities = makeNeonTrim(slot.x, initialY, slot.z, slot.sx, slot.sz, neonColor)

    // Attach MovingPlatform component to oscillating platforms
    if (isMoving) {
      MovingPlatform.create(entity, {
        originX: slot.x,
        originZ: slot.z,
        amplitude: 1.8,   // ±1.8 m X swing
        period: 3.5,   // seconds per full cycle
        elapsed: i * 0.7  // stagger start phase
      })
    }

    // Floating Height Badge above each platform
    const label = engine.addEntity()
    Transform.create(label, {
      position: Vector3.create(slot.x, initialY + 1.2, slot.z)
    })
    TextShape.create(label, {
      text: `${Math.round(initialY - 2.0)}m`,
      fontSize: 1.8,
      textColor: Color4.create(0.9, 0.95, 1.0, 0.9)
    })
    Billboard.create(label, { billboardMode: BillboardMode.BM_Y })

    platformPool.push({
      entity,
      labelEntity: label,
      trimEntities,
      baseY: initialY,
      slotIndex: i,
      altitudeTier: 0,
      isMoving
    })
  }
}

/** Resets all recycled platforms back to their starting positions */
export function resetPlatformPool() {
  for (let i = 0; i < platformPool.length; i++) {
    const p = platformPool[i]
    const slot = SPIRAL_POINTS[p.slotIndex]
    const initialY = 3.2 + i * PLATFORM_SPACING_Y

    p.baseY = initialY
    p.altitudeTier = 0

    const transform = Transform.getMutable(p.entity)
    transform.position = Vector3.create(slot.x, initialY, slot.z)

    const labelTransform = Transform.getMutable(p.labelEntity)
    labelTransform.position = Vector3.create(slot.x, initialY + 1.2, slot.z)

    const labelShape = TextShape.getMutable(p.labelEntity)
    labelShape.text = `${Math.round(initialY - 2.0)}m`

    // Reset trim strips back to initial slot positions
    repositionTrim(p.trimEntities, slot.x, initialY, slot.sx, slot.z, slot.sz)

    // Reset moving platform oscillation state
    if (p.isMoving && MovingPlatform.has(p.entity)) {
      const mp = MovingPlatform.getMutable(p.entity)
      mp.originX = slot.x
      mp.originZ = slot.z
      mp.elapsed = i * 0.7
    }
  }
}
