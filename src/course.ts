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
  baseY: number
  slotIndex: number
  altitudeTier: number
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
      baseY: initialY,
      slotIndex: i,
      altitudeTier: 0
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
  }
}
