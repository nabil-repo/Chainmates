/**
 * lobbyLeaderboard.ts
 * In-World 3D Holographic Leaderboard Podium.
 *
 * Places a high-tech glass billboard in the Squad Lounge on the LEFT of the player's
 * forward camera view, displaying the top all-time squads, their records, and heights.
 */

import { engine, Transform, MeshRenderer, Material, TextShape, Billboard, BillboardMode } from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion } from '@dcl/sdk/math'
import { LeaderboardEntry } from './gameState'

let boardTextEntity: ReturnType<typeof engine.addEntity> | null = null

export function build3DLeaderboard() {
  // 1. Dark Glass Backing Panel — positioned on the LEFT of the lounge platform (X = 2.4, Z = 0.8)
  // angled at 45 degrees inward toward the player standing in the lounge
  const panel = engine.addEntity()
  Transform.create(panel, {
    position: Vector3.create(2.4, 2.7, 0.8),
    scale: Vector3.create(5.6, 2.9, 0.12),
    rotation: Quaternion.fromEulerDegrees(0, 48, 0)
  })
  MeshRenderer.setBox(panel)
  Material.setPbrMaterial(panel, {
    albedoColor: Color4.create(0.02, 0.04, 0.10, 0.95),
    emissiveColor: Color4.create(0.08, 0.15, 0.35, 1.0),
    emissiveIntensity: 0.8,
    metallic: 0.9,
    roughness: 0.1
  })

  // 2. Neon Frame Border around panel (Top & Bottom accent strips parented to panel)
  const topTrim = engine.addEntity()
  Transform.create(topTrim, {
    parent: panel,
    position: Vector3.create(0, 0.52, -0.08),
    scale: Vector3.create(1.02, 0.03, 0.5)
  })
  MeshRenderer.setBox(topTrim)
  Material.setPbrMaterial(topTrim, {
    albedoColor: Color4.create(0.1, 0.85, 1.0, 1.0),
    emissiveColor: Color4.create(0.1, 0.85, 1.0, 1.0),
    emissiveIntensity: 3.0
  })

  const botTrim = engine.addEntity()
  Transform.create(botTrim, {
    parent: panel,
    position: Vector3.create(0, -0.52, -0.08),
    scale: Vector3.create(1.02, 0.03, 0.5)
  })
  MeshRenderer.setBox(botTrim)
  Material.setPbrMaterial(botTrim, {
    albedoColor: Color4.create(1.0, 0.8, 0.15, 1.0),
    emissiveColor: Color4.create(1.0, 0.8, 0.15, 1.0),
    emissiveIntensity: 3.0
  })

  // 3. Dynamic Text Display (parented to panel so it inherits rotation and position)
  boardTextEntity = engine.addEntity()
  Transform.create(boardTextEntity, {
    parent: panel,
    position: Vector3.create(0, 0.02, -0.12),
    scale: Vector3.create(1 / 5.6, 1 / 2.9, 1)
  })
  TextShape.create(boardTextEntity, {
    text: '🏆 SQUAD LEADERBOARD\n\nLoading top squads...',
    fontSize: 1.4,
    textColor: Color4.create(0.95, 0.98, 1.0, 1.0),
    outlineColor: Color4.create(0.0, 0.0, 0.0, 1.0),
    outlineWidth: 0.15
  })
}

/** Update the in-world 3D leaderboard display when new data arrives */
export function update3DLeaderboard(entries: LeaderboardEntry[]) {
  if (!boardTextEntity) return

  let content = '🏆 ALL-TIME SQUAD LEADERBOARD\n──────────────────────────────\n'

  if (!entries || entries.length === 0) {
    content += '\nNo records yet — be the first squad to climb!'
  } else {
    const top = entries.slice(0, 5)
    top.forEach((e, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
      const names = e.partnerName ? `${e.displayName} & ${e.partnerName}` : e.displayName
      const truncated = names.length > 20 ? names.slice(0, 18) + '..' : names
      content += `${medal}  ${truncated.padEnd(20)} ${e.maxAltitude.toFixed(1)}m  [${e.teamScore} pts]\n`
    })
  }

  const textComp = TextShape.getMutable(boardTextEntity)
  textComp.text = content
}
