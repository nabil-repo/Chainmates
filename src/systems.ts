/**
 * systems.ts
 * ECS systems for:
 *  - Endless Platform Dynamic Recycling (creates infinite procedural climbing)
 *  - Rising Molten Lava animation
 *  - Kinetic moving platform oscillations (with neon trim sync)
 */

import { engine, Transform, TextShape } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { MovingPlatform } from './components'
import { gameState } from './gameState'
import {
  platformPool,
  lavaEntity,
  PLATFORM_SPACING_Y,
  POOL_SIZE,
  SPIRAL_POINTS,
  repositionTrim
} from './course'

/** Recycles lower platforms above the players as they climb higher into the sky */
export function endlessPlatformRecycleSystem(_dt: number) {
  if (gameState.phase !== 'RUNNING') return

  const localTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!localTransform) return

  const playerY = localTransform.position.y

  // Find the highest platform Y currently in the pool
  let highestPoolY = 0
  for (const p of platformPool) {
    if (p.baseY > highestPoolY) {
      highestPoolY = p.baseY
    }
  }

  // Recycle platforms that have fallen too far below the player
  for (const p of platformPool) {
    if (p.baseY < playerY - 4.5) {
      const newY = highestPoolY + PLATFORM_SPACING_Y
      highestPoolY = newY
      p.baseY = newY

      const slot = SPIRAL_POINTS[p.slotIndex]
      const transform = Transform.getMutable(p.entity)
      transform.position = Vector3.create(slot.x, newY, slot.z)

      const labelTransform = Transform.getMutable(p.labelEntity)
      labelTransform.position = Vector3.create(slot.x, newY + 1.2, slot.z)

      const labelShape = TextShape.getMutable(p.labelEntity)
      labelShape.text = `🏔️ ${Math.round(newY - 2.0)}m`

      // Keep neon trim strips positioned correctly on the recycled platform
      repositionTrim(p.trimEntities, slot.x, newY, slot.sx, slot.z, slot.sz)

      // Reset moving platform origin so oscillation is centered on new slot
      if (p.isMoving && MovingPlatform.has(p.entity)) {
        const mp = MovingPlatform.getMutable(p.entity)
        mp.originX = slot.x
        mp.originZ = slot.z
        // Keep elapsed running (staggered phase survives recycle)
      }
    }
  }
}

/** Updates rising molten lava position */
export function lavaSystem(_dt: number) {
  if (!lavaEntity) return

  const transform = Transform.getMutable(lavaEntity)
  transform.position = Vector3.create(8.0, gameState.lavaHeight, 8.0)
}

/** Oscillates all MovingPlatform entities back and forth on the X-axis,
 *  and keeps their neon trim strips in lock-step. */
export function movingPlatformSystem(dt: number) {
  for (const [entity, mp] of engine.getEntitiesWith(MovingPlatform)) {
    const data = MovingPlatform.getMutable(entity)
    data.elapsed += dt

    const phase = (2 * Math.PI * data.elapsed) / data.period
    const offsetX = data.amplitude * Math.sin(phase)
    const newX = data.originX + offsetX

    const transform = Transform.getMutable(entity)
    transform.position = Vector3.create(newX, transform.position.y, data.originZ)

    // Synchronise neon trim strips with the platform's new X position
    const poolEntry = platformPool.find(p => p.entity === entity)
    if (poolEntry && poolEntry.trimEntities.length >= 4) {
      const slot = SPIRAL_POINTS[poolEntry.slotIndex]
      repositionTrim(
        poolEntry.trimEntities,
        newX,
        poolEntry.baseY,
        slot.sx,
        data.originZ,
        slot.sz
      )
    }
  }
}

