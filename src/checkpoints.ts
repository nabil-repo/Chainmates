/**
 * checkpoints.ts
 * Auto-Start and Molten Lava Hazard Detection for Endless Co-op Climb.
 */

import { engine, Transform } from '@dcl/sdk/ecs'
import { movePlayerTo } from '~system/RestrictedActions'
import { gameState, triggerGameOver, startRun } from './gameState'

// ─── Per-frame Lava Hazard Detection ─────────────────────────────────────────
export function checkpointSystem(_dt: number) {
  // Only check hazards during active run
  if (gameState.phase !== 'RUNNING') return

  const localTransform = Transform.getOrNull(engine.PlayerEntity)
  if (!localTransform) return

  const { y } = localTransform.position

  // 2. Rising Lava & Void Fall Detection
  // If player touches the rising lava or falls below it, the team loses!
  if (y <= gameState.lavaHeight + 0.4 || y < 1.0) {
    triggerGameOver()

    // Teleport back to start haven platform
    movePlayerTo({
      newRelativePosition: { x: 8.0, y: 2.6, z: 2.0 },
      cameraTarget: { x: 8.0, y: 5.0, z: 10.0 }
    }).catch(() => { })
  }
}
