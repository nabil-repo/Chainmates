/**
 * checkpoints.ts
 * Fall Hazard & Out-of-Bounds Detection for Chainmates.
 */

import { engine, Transform } from '@dcl/sdk/ecs'
import { movePlayerTo } from '~system/RestrictedActions'
import { gameState, triggerGameOver } from './gameState'

/** Per-frame Hazard & Fall Protection System */
export function checkpointSystem(_dt: number) {
  const localTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!localTransform) return

  const { x, y, z } = localTransform.position

  // 1. Active Climb Run: Detect plunge into rising void or fall below safety threshold
  if (gameState.phase === 'RUNNING' || gameState.phase === 'PRACTICE') {
    if (y <= gameState.lavaHeight + 0.4 || y < 1.8) {
      triggerGameOver()
      return
    }
  }

  // 2. Global Safety Catch: If player falls off the lounge or wanders out of parcel
  if (y < 0.5 || x < 0.5 || x > 15.5 || z < -0.5 || z > 16.5) {
    movePlayerTo({
      newRelativePosition: { x: 8.0, y: 1.6, z: 0.6 },
      cameraTarget: { x: 8.0, y: 2.5, z: 6.0 }
    }).catch(() => { })
  }
}
