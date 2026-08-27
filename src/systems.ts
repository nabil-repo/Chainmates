/**
 * systems.ts
 * ECS systems for:
 *  - Endless Platform Dynamic Recycling (creates infinite procedural climbing)
 *  - Rising Molten Lava animation
 *  - Kinetic moving platform oscillations (with neon trim sync)
 */

import { engine, Transform, TextShape, Material, VisibilityComponent, MeshCollider, Physics, KnockbackFalloff, ParticleSystem, PBParticleSystem_BlendMode } from '@dcl/sdk/ecs'
import { Vector3, Quaternion, Color4 } from '@dcl/sdk/math'
import { MovingPlatform } from './components'
import { gameState } from './gameState'
import {
  platformPool,
  platformEntityMap,
  lavaEntity,
  fogEntities,
  PLATFORM_SPACING_Y,
  SPIRAL_POINTS,
  repositionTrim,
  getAltitudeBiomeColor,
  updateAltitudeSkybox,
  COL_FLOATING_STONE
} from './course'
import { playGemSound, playYankSound } from './audio'
import { setUiYankFlash } from './ui'

/** Recycles lower platforms above the players as they climb higher into the sky */
export function endlessPlatformRecycleSystem(_dt: number) {
  if (gameState.phase !== 'RUNNING' && gameState.phase !== 'PRACTICE') return

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

      const alt = Math.max(0, Math.round(newY - 2.0))
      const biomeColor = getAltitudeBiomeColor(alt)

      const slot = SPIRAL_POINTS[p.slotIndex]
      const transform = Transform.getMutable(p.entity)
      transform.position = Vector3.create(slot.x, newY, slot.z)

      const labelTransform = Transform.getMutable(p.labelEntity)
      labelTransform.position = Vector3.create(slot.x, newY + 1.2, slot.z)

      const labelShape = TextShape.getMutable(p.labelEntity)
      labelShape.text = `🏔️ ${alt}m`

      // Respawn Cyber-Gem with 65% probability on recycled platforms
      p.hasGem = Math.random() < 0.65
      const gemTransform = Transform.getMutable(p.gemEntity)
      gemTransform.position = Vector3.create(slot.x, newY + 0.9, slot.z)
      VisibilityComponent.createOrReplace(p.gemEntity, { visible: p.hasGem })

      // Respawn Moving Vertical Hazard Cylinder on recycled platforms (50% chance)
      p.hasObstacle = Math.random() < 0.50
      p.obstaclePhase = Math.random() * Math.PI * 2
      const obsTransform = Transform.getMutable(p.obstacleEntity)
      obsTransform.position = Vector3.create(slot.x, newY + 0.95, slot.z)
      VisibilityComponent.createOrReplace(p.obstacleEntity, { visible: p.hasObstacle })

      // All recycled platforms are normal
      p.type = 'normal'
      VisibilityComponent.createOrReplace(p.entity, { visible: true })
      MeshCollider.setBox(p.entity)
      Material.setPbrMaterial(p.entity, {
        albedoColor: COL_FLOATING_STONE,
        metallic: 0.5,
        roughness: 0.4
      })

      // Keep neon trim strips positioned correctly on the recycled platform & apply altitude biome color
      repositionTrim(p.trimEntities, slot.x, newY, slot.sx, slot.z, slot.sz)
      for (const trim of p.trimEntities) {
        VisibilityComponent.createOrReplace(trim, { visible: true })
        Material.setPbrMaterial(trim, {
          albedoColor: Color4.create(biomeColor.r * 0.2, biomeColor.g * 0.2, biomeColor.b * 0.2, 1),
          emissiveColor: biomeColor,
          emissiveIntensity: 2.5,
          metallic: 0.0,
          roughness: 1.0
        })
      }

      // Reset moving platform origin so oscillation is centered on new slot
      if (p.isMoving && MovingPlatform.has(p.entity)) {
        const mp = MovingPlatform.getMutable(p.entity)
        mp.originX = slot.x
        mp.originZ = slot.z
        // Randomise start phase on recycle so platforms don't all sync up
        mp.elapsed = Math.random() * mp.period
      }
    }
  }
}

let gemRotation = 0

/** Rotates floating gems and detects player collision/collection */
export function gemCollectionSystem(_dt: number) {
  if (gameState.phase !== 'RUNNING' && gameState.phase !== 'PRACTICE') return

  const localTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!localTransform) return

  const playerPos = localTransform.position

  for (const p of platformPool) {
    if (!p.hasGem) continue

    const gemTransform = Transform.get(p.gemEntity)

    // Check distance between player and gem
    const distSq = Vector3.distanceSquared(playerPos, gemTransform.position)
    if (distSq < 2.56) { // 1.6m radius
      p.hasGem = false
      playGemSound()
      gameState.teamScore += 250
      gameState.gemsCollected = (gameState.gemsCollected || 0) + 1

      // 1-shot particle celebration burst (+250 PTS)
      ParticleSystem.createOrReplace(p.gemEntity, {
        active: true,
        loop: false,
        rate: 0,
        bursts: { values: [{ count: 20, time: 0 }] },
        lifetime: 0.55,
        initialVelocitySpeed: { start: 2.0, end: 4.5 },
        shape: ParticleSystem.Shape.Sphere({ radius: 0.25 }),
        initialColor: { start: Color4.create(1, 0.85, 0.1, 1), end: Color4.create(0.2, 1, 0.6, 1) },
        colorOverTime: { start: Color4.create(1, 1, 1, 1), end: Color4.create(1, 0.8, 0, 0) },
        blendMode: PBParticleSystem_BlendMode.PSB_ADD
      })

      VisibilityComponent.createOrReplace(p.gemEntity, { visible: false })
    }
  }
}

let globalElapsed = 0

/** Updates rising molten lava position & synchronizes altitude skybox */
export function lavaSystem(_dt: number) {
  if (!lavaEntity) return
  // Only update lava transform during active runs (prevents unnecessary idle CRDT puts)
  if (gameState.phase !== 'RUNNING' && gameState.phase !== 'PRACTICE') return

  const transform = Transform.getMutable(lavaEntity)
  transform.position = Vector3.create(8.0, gameState.lavaHeight, 8.0)

  // Dynamically shift skybox atmosphere based on current max altitude climbed
  updateAltitudeSkybox(gameState.maxAltitude)
}

/** Oscillates all MovingPlatform entities back and forth on the X-axis,
 *  and keeps their neon trim strips in lock-step. */
export function movingPlatformSystem(dt: number) {
  globalElapsed += dt

  for (const [entity, mp] of engine.getEntitiesWith(MovingPlatform)) {
    const phase = (2 * Math.PI * (globalElapsed + mp.elapsed)) / mp.period
    const offsetX = mp.amplitude * Math.sin(phase)
    const newX = mp.originX + offsetX

    const transform = Transform.getMutable(entity)
    transform.position = Vector3.create(newX, transform.position.y, mp.originZ)

    // Synchronise neon trim strips with the platform's new X position (O(1) lookup)
    const poolEntry = platformEntityMap.get(entity)
    if (poolEntry && poolEntry.trimEntities.length >= 4) {
      const slot = SPIRAL_POINTS[poolEntry.slotIndex]
      repositionTrim(
        poolEntry.trimEntities,
        newX,
        poolEntry.baseY,
        slot.sx,
        mp.originZ,
        slot.sz
      )
    }
  }
}

let obstacleTimer = 0
let obstacleKnockCooldown = 0

/** Moves vertical hazard cylinders left ↔ right across platforms and checks player collision */
export function hazardObstacleSystem(dt: number) {
  if (gameState.phase !== 'RUNNING' && gameState.phase !== 'PRACTICE') return

  obstacleTimer += dt
  if (obstacleKnockCooldown > 0) {
    obstacleKnockCooldown -= dt
  }

  const localTransform = Transform.getOrNull(engine.PlayerEntity)
  const playerPos = localTransform ? localTransform.position : null

  // Scaling speed with max altitude for progressive difficulty
  const speedMult = 1.0 + Math.min(1.2, gameState.maxAltitude / 40)

  for (const p of platformPool) {
    if (!p.hasObstacle) continue

    const slot = SPIRAL_POINTS[p.slotIndex]
    // Slide left and right across platform surface
    const sweepPeriod = 2.8 / speedMult
    const phase = (2 * Math.PI * obstacleTimer) / sweepPeriod + p.obstaclePhase
    const sweepOffset = (slot.sx * 0.35) * Math.sin(phase)

    let basePlatformX = slot.x
    if (p.isMoving && MovingPlatform.has(p.entity)) {
      const platTransform = Transform.getOrNull(p.entity)
      if (platTransform) basePlatformX = platTransform.position.x
    }

    const obsX = basePlatformX + sweepOffset
    const obsY = p.baseY + 0.95
    const obsZ = slot.z

    const obsTransform = Transform.getMutable(p.obstacleEntity)
    obsTransform.position = Vector3.create(obsX, obsY, obsZ)

    // Check player collision with the moving vertical cylinder
    if (playerPos && obstacleKnockCooldown <= 0) {
      const yDiff = Math.abs(playerPos.y - obsY)
      // Vertical check (cylinder is 1.4m tall)
      if (yDiff < 1.0) {
        const dx = playerPos.x - obsX
        const dz = playerPos.z - obsZ
        const distSq = dx * dx + dz * dz
        // Cylinder radius ~0.28m + player radius ~0.35m = ~0.63m (distSq < 0.45)
        if (distSq < 0.45) {
          obstacleKnockCooldown = 0.8
          playYankSound()
          setUiYankFlash(true)

          Physics.applyKnockbackToPlayer(
            Vector3.create(obsX, obsY, obsZ),
            9.0,
            2.0,
            KnockbackFalloff.LINEAR
          )
        }
      }
    }
  }
}

let fogRotation = 0

/** Drifts and slowly rotates atmospheric mist and cloud layers */
export function fogAnimationSystem(dt: number) {
  fogRotation += dt * 0.04

  for (let i = 0; i < fogEntities.length; i++) {
    const fog = fogEntities[i]
    const dir = i % 2 === 0 ? 1 : -1
    const rot = Quaternion.fromEulerDegrees(0, (fogRotation * dir * 180 / Math.PI) + i * 45, 0)
    const t = Transform.getMutable(fog)
    t.rotation = rot
  }
}


/** Handles dynamic platform types (reserved for future platform behaviours) */
export function platformTypeSystem(_dt: number) {
  // No dynamic platform types active
}
