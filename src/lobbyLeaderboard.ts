/**
 * lobbyLeaderboard.ts
 * In-World 3D Holographic Leaderboard Podium.
 *
 * Places a high-tech glass billboard in the Squad Lounge on the LEFT of the player's
 * forward camera view, displaying the top all-time squads, their records, and heights.
 */

import { engine, Transform, MeshRenderer, Material, TextShape, Font, TextAlignMode } from '@dcl/sdk/ecs'
import { Vector3, Color4, Color3, Quaternion } from '@dcl/sdk/math'
import { LeaderboardEntry } from './gameState'

let boardTextEntity: ReturnType<typeof engine.addEntity> | null = null

export function build3DLeaderboard() {
  const panelPos = Vector3.create(-0.4, 2.7, 0)
  const panelRot = Quaternion.fromEulerDegrees(0, -80, 0)

  // Root Anchor Entity (Uniform Scale 1,1,1)
  const boardRoot = engine.addEntity()
  Transform.create(boardRoot, {
    position: panelPos,
    rotation: panelRot,
    scale: Vector3.create(1, 1, 1)
  })

  // 1. Pedestal Base Plinth
  const pedestal = engine.addEntity()
  Transform.create(pedestal, {
    parent: boardRoot,
    position: Vector3.create(0, -2.25, 0),
    scale: Vector3.create(5.8, 0.9, 0.8)
  })
  MeshRenderer.setBox(pedestal)
  Material.setPbrMaterial(pedestal, {
    albedoColor: Color4.create(0.03, 0.05, 0.12, 1.0),
    emissiveColor: Color4.create(0.05, 0.15, 0.35, 1.0),
    emissiveIntensity: 0.6,
    metallic: 0.85,
    roughness: 0.25
  })

  // Pedestal Neon Glow Footing
  const pedestalTrim = engine.addEntity()
  Transform.create(pedestalTrim, {
    parent: pedestal,
    position: Vector3.create(0, -0.45, 0),
    scale: Vector3.create(1.04, 0.08, 1.04)
  })
  MeshRenderer.setBox(pedestalTrim)
  Material.setPbrMaterial(pedestalTrim, {
    albedoColor: Color4.create(0.12, 0.85, 1.0, 1.0),
    emissiveColor: Color4.create(0.12, 0.85, 1.0, 1.0),
    emissiveIntensity: 3.5
  })

  // 2. High-Tech Textured Cyber Glass Backing Panel
  const panel = engine.addEntity()
  Transform.create(panel, {
    parent: boardRoot,
    position: Vector3.create(0, 0, 0),
    scale: Vector3.create(5.6, 3.2, 0.1)
  })
  MeshRenderer.setBox(panel)
  Material.setPbrMaterial(panel, {
    texture: Material.Texture.Common({
      src: 'assets/textures/ui_panel_bg.jpg'
    }),
    albedoColor: Color4.create(0.12, 0.18, 0.32, 1.0),
    emissiveTexture: Material.Texture.Common({
      src: 'assets/textures/ui_panel_bg.jpg'
    }),
    emissiveColor: Color4.create(0.06, 0.16, 0.32, 1.0),
    emissiveIntensity: 0.6,
    metallic: 0.85,
    roughness: 0.2
  })

  // 3. Neon Frame Border - Top Gold Accent Strip
  const topTrim = engine.addEntity()
  Transform.create(topTrim, {
    parent: boardRoot,
    position: Vector3.create(0, 1.62, -0.06),
    scale: Vector3.create(5.7, 0.06, 0.06)
  })
  MeshRenderer.setBox(topTrim)
  Material.setPbrMaterial(topTrim, {
    albedoColor: Color4.create(1.0, 0.8, 0.15, 1.0),
    emissiveColor: Color4.create(1.0, 0.8, 0.15, 1.0),
    emissiveIntensity: 3.5
  })

  // Bottom Cyan Accent Strip
  const botTrim = engine.addEntity()
  Transform.create(botTrim, {
    parent: boardRoot,
    position: Vector3.create(0, -1.62, -0.06),
    scale: Vector3.create(5.7, 0.06, 0.06)
  })
  MeshRenderer.setBox(botTrim)
  Material.setPbrMaterial(botTrim, {
    albedoColor: Color4.create(0.12, 0.85, 1.0, 1.0),
    emissiveColor: Color4.create(0.12, 0.85, 1.0, 1.0),
    emissiveIntensity: 3.5
  })

  // Left & Right Neon Vertical Pillars
  const leftTrim = engine.addEntity()
  Transform.create(leftTrim, {
    parent: boardRoot,
    position: Vector3.create(-2.82, 0, -0.06),
    scale: Vector3.create(0.06, 3.28, 0.06)
  })
  MeshRenderer.setBox(leftTrim)
  Material.setPbrMaterial(leftTrim, {
    albedoColor: Color4.create(0.12, 0.85, 1.0, 1.0),
    emissiveColor: Color4.create(0.12, 0.85, 1.0, 1.0),
    emissiveIntensity: 3.0
  })

  const rightTrim = engine.addEntity()
  Transform.create(rightTrim, {
    parent: boardRoot,
    position: Vector3.create(2.82, 0, -0.06),
    scale: Vector3.create(0.06, 3.28, 0.06)
  })
  MeshRenderer.setBox(rightTrim)
  Material.setPbrMaterial(rightTrim, {
    albedoColor: Color4.create(0.12, 0.85, 1.0, 1.0),
    emissiveColor: Color4.create(0.12, 0.85, 1.0, 1.0),
    emissiveIntensity: 3.0
  })

  // 4. In-World Leaderboard Text (Direct child of boardRoot with scale 1,1,1 and forward offset)
  boardTextEntity = engine.addEntity()
  Transform.create(boardTextEntity, {
    parent: boardRoot,
    position: Vector3.create(0, 0.05, -0.10),
    scale: Vector3.create(1, 1, 1)
  })
  TextShape.create(boardTextEntity, {
    text: '🏆 ALL-TIME SQUAD HALL OF FAME\n═══════════════════════════════════\n\n⚡ Synchronizing live leaderboards...',
    fontSize: 1.8,
    font: Font.F_SANS_SERIF,
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER,
    textColor: Color4.create(0.96, 0.98, 1.0, 1.0),
    outlineColor: Color3.create(0.01, 0.02, 0.06),
    outlineWidth: 0.18,
    width: 5.4,
    height: 3.0
  })
}

/** Update the in-world 3D leaderboard display when new data arrives */
export function update3DLeaderboard(entries: LeaderboardEntry[]) {
  if (!boardTextEntity) return

  let content = '🏆 ALL-TIME SQUAD HALL OF FAME\n═══════════════════════════════════\n'

  if (!entries || entries.length === 0) {
    content += '\nNo squads recorded yet.\n\nLink up with a partner & claim #1 rank!\n'
  } else {
    const top = entries.slice(0, 5)
    top.forEach((e, i) => {
      const medal = i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : `#${i + 1} `
      const names = e.partnerName ? `${e.displayName} & ${e.partnerName}` : e.displayName
      const truncated = names.length > 18 ? names.slice(0, 16) + '..' : names.padEnd(18)
      const alt = `${e.maxAltitude.toFixed(1)}m`.padStart(7)
      const score = `★ ${e.teamScore}`.padStart(9)
      content += `${medal} ${truncated}   ${alt}   ${score}\n`
    })
  }

  content += '───────────────────────────────────\n'
  content += '⚡ STEP ON THE LAUNCHPAD TO COMPETE'

  const textComp = TextShape.getMutable(boardTextEntity)
  textComp.text = content
}

