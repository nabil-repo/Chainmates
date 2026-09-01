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
  BillboardMode,
  TextureWrapMode,
  TextureFilterMode,
  VisibilityComponent,
  MaterialTransparencyMode,
  Tween,
  TextureMovementType,
  ParticleSystem,
  PBParticleSystem_BlendMode,
  PBParticleSystem_SimulationSpace,
  CameraModeArea,
  CameraType,
  SkyboxTime
} from '@dcl/sdk/ecs'
import { Vector3, Color4, Quaternion, Vector2 } from '@dcl/sdk/math'
import { MovingPlatform } from './components'
import { gameState } from './gameState'
import { build3DLeaderboard } from './lobbyLeaderboard'

// ─── Color Palette ────────────────────────────────────────────────────────────
export const COL_FLOATING_STONE = Color4.create(0.12, 0.14, 0.24, 1)
export const COL_NEON_CYAN = Color4.create(0.15, 0.85, 1.0, 1)
export const COL_NEON_GOLD = Color4.create(1.0, 0.78, 0.15, 1)
export const COL_NEON_MAGENTA = Color4.create(0.9, 0.25, 0.85, 1)
export const COL_NEON_GREEN = Color4.create(0.15, 1.0, 0.55, 1)
export const COL_NEON_PURPLE = Color4.create(0.75, 0.35, 1.0, 1)

/** Dynamic Altitude Biome Color Function */
export function getAltitudeBiomeColor(altitude: number): Color4 {
  if (altitude < 30) {
    return COL_NEON_CYAN // 0-30m: Cyber Cyan
  } else if (altitude < 80) {
    return COL_NEON_MAGENTA // 30-80m: Synthwave Magenta
  } else if (altitude < 150) {
    return COL_NEON_GOLD // 80-150m: Hyper Gold
  } else if (altitude < 250) {
    return COL_NEON_GREEN // 150-250m: Acid Green
  } else {
    return COL_NEON_PURPLE // 250m+: Celestial Diamond
  }
}

/** Cycling palette for platform neon trim */
const NEON_TRIM_COLORS = [COL_NEON_CYAN, COL_NEON_MAGENTA, COL_NEON_GOLD, COL_NEON_GREEN]

/** Every Nth platform in the pool oscillates on the X-axis (skip index 0) */
const MOVING_PLATFORM_INTERVAL = 3

// ─── Platform Pool Configuration ──────────────────────────────────────────────
export const POOL_SIZE = 8
export const PLATFORM_SPACING_Y = 1.8 // smooth parkour step & 14.4m spiral headroom
export const SPIRAL_POINTS = [
  { x: 8.0, z: 5.6, sx: 5.4, sz: 3.0 },  // [0] South (cleanly in front of launchpad at z=2.3)
  { x: 11.6, z: 6.8, sx: 4.4, sz: 3.8 }, // [1] South-East
  { x: 12.6, z: 9.4, sx: 3.8, sz: 4.6 }, // [2] East
  { x: 11.6, z: 12.0, sx: 4.4, sz: 3.8 },// [3] North-East
  { x: 8.0, z: 12.8, sx: 5.4, sz: 3.0 }, // [4] North
  { x: 4.4, z: 12.0, sx: 4.4, sz: 3.8 }, // [5] North-West
  { x: 3.4, z: 9.4, sx: 3.8, sz: 4.6 },  // [6] West
  { x: 4.4, z: 6.8, sx: 4.4, sz: 3.8 }   // [7] South-West
]

export interface RecycledPlatform {
  entity: ReturnType<typeof engine.addEntity>
  labelEntity: ReturnType<typeof engine.addEntity>
  gemEntity: ReturnType<typeof engine.addEntity>
  hasGem: boolean
  obstacleEntity: ReturnType<typeof engine.addEntity>
  hasObstacle: boolean
  obstaclePhase: number
  /** Four neon trim entities: [rightX, leftX, farZ, nearZ] */
  trimEntities: ReturnType<typeof engine.addEntity>[]
  baseY: number
  slotIndex: number
  altitudeTier: number
  isMoving: boolean
  type: 'normal' | 'fragile' | 'bouncy'
  fragileTimer: number
}

export const platformPool: RecycledPlatform[] = []
export const platformEntityMap = new Map<ReturnType<typeof engine.addEntity>, RecycledPlatform>()
export let lavaEntity: ReturnType<typeof engine.addEntity> | null = null
export let lavaOverlayEntity: ReturnType<typeof engine.addEntity> | null = null

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
  //  buildAtmosphericFog()
  buildStartIsland()
  buildInfinitePlatformPool()
  build3DLeaderboard()

  // 6. Mobile 3rd-Person Camera Enforcement Zone
  // Ensures mobile touch climbers retain optimal 3rd-person spatial awareness of partner and jumps
  const cameraZone = engine.addEntity()
  Transform.create(cameraZone, { position: Vector3.create(8.0, 150.0, 8.0) })
  CameraModeArea.create(cameraZone, {
    area: Vector3.create(16.0, 300.0, 16.0),
    mode: CameraType.CT_THIRD_PERSON
  })

  // 7. Fixed Midnight Skybox (deep cyber void atmosphere)
  SkyboxTime.createOrReplace(engine.RootEntity, {
    fixedTime: 0
  })
}

// ─── Rising Electric Void Abyss & Perimeter Containment ───────────────────────
function buildMoltenLavaAbyss() {
  // 1. Solid Ground Floor with Collider across entire 16x16 parcel
  const groundFloor = engine.addEntity()
  Transform.create(groundFloor, {
    position: Vector3.create(8.0, 0.0, 8.0),
    scale: Vector3.create(16.0, 0.1, 16.0)
  })
  MeshRenderer.setBox(groundFloor)
  MeshCollider.setBox(groundFloor)
  Material.setPbrMaterial(groundFloor, {
    albedoColor: Color4.create(0.01, 0.01, 0.02, 1),
    metallic: 0.0,
    roughness: 1.0
  })

  // 2. Vast Horizon Void Base (Visual-only expansive void stretching into distance)
  // const horizonVoid = engine.addEntity()
  // Transform.create(horizonVoid, {
  //   position: Vector3.create(8.0, -0.05, 8.0),
  //   scale: Vector3.create(48.0, 0.1, 48.0)
  // })
  // MeshRenderer.setBox(horizonVoid)
  // Material.setPbrMaterial(horizonVoid, {
  //   texture: Material.Texture.Common({
  //     src: 'assets/textures/void.jpg',
  //     wrapMode: TextureWrapMode.TWM_REPEAT,
  //     filterMode: TextureFilterMode.TFM_TRILINEAR
  //   }),
  //   emissiveTexture: Material.Texture.Common({
  //     src: 'assets/textures/void.jpg',
  //     wrapMode: TextureWrapMode.TWM_REPEAT,
  //     filterMode: TextureFilterMode.TFM_TRILINEAR
  //   }),
  //   emissiveColor: Color4.create(0.60, 0.20, 0.90, 1),
  //   emissiveIntensity: 1.8,
  //   metallic: 0.0,
  //   roughness: 1.0
  // })

  // 3. 80-Meter Tall Invisible Boundary Collision Forcefields
  // Surrounds the 16x16 parcel so players can NEVER fall outside the scene into world terrain
  const wallConfigs = [
    { pos: Vector3.create(0.05, 40.0, 8.0), scale: Vector3.create(0.1, 80.0, 16.0) }, // West
    { pos: Vector3.create(15.95, 40.0, 8.0), scale: Vector3.create(0.1, 80.0, 16.0) }, // East
    { pos: Vector3.create(8.0, 40.0, 0.05), scale: Vector3.create(16.0, 80.0, 0.1) }, // South
    { pos: Vector3.create(8.0, 40.0, 15.95), scale: Vector3.create(16.0, 80.0, 0.1) }  // North
  ]
  for (const cfg of wallConfigs) {
    const wall = engine.addEntity()
    Transform.create(wall, { position: cfg.pos, scale: cfg.scale })
    MeshCollider.setBox(wall)
  }

  // 4. Rising Electric Neon Void Abyss (GPU-Accelerated Dual-Layer Moving Plasma)
  lavaEntity = engine.addEntity()
  Transform.create(lavaEntity, {
    position: Vector3.create(8.0, 0.05, 8.0),
    scale: Vector3.create(50.8, 0.25, 50.8)
  })
  MeshRenderer.setBox(lavaEntity)
  Material.setPbrMaterial(lavaEntity, {
    texture: Material.Texture.Common({
      src: 'assets/textures/void.jpg',
      wrapMode: TextureWrapMode.TWM_REPEAT,
      filterMode: TextureFilterMode.TFM_TRILINEAR,
      tiling: { x: 5, y: 5 }
    }),
    emissiveTexture: Material.Texture.Common({
      src: 'assets/textures/void.jpg',
      wrapMode: TextureWrapMode.TWM_REPEAT,
      filterMode: TextureFilterMode.TFM_TRILINEAR,
      tiling: { x: 5, y: 5 }
    }),
    emissiveColor: Color4.create(0.80, 0.25, 1.00, 1), // Radiant electric violet base
    emissiveIntensity: 3.2,
    metallic: 0.2,
    roughness: 0.3
  })

  // Primary GPU UV scrolling: Deep cosmic void flows south-east
  Tween.setTextureMoveContinuous(
    lavaEntity,
    Vector2.create(0.08, 0.04),
    0.14,
    TextureMovementType.TMT_OFFSET
  )

  // Secondary GPU Layer: Translucent Neon Cyan Energy Shimmer Mesh (Parented to move automatically)
  lavaOverlayEntity = engine.addEntity()
  Transform.create(lavaOverlayEntity, {
    position: Vector3.create(0, 0.14, 0),
    scale: Vector3.create(1.0, 0.01, 1.0),
    parent: lavaEntity
  })
  MeshRenderer.setBox(lavaOverlayEntity)
  Material.setPbrMaterial(lavaOverlayEntity, {
    texture: Material.Texture.Common({
      src: 'assets/textures/Neon.png',
      wrapMode: TextureWrapMode.TWM_REPEAT,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      tiling: { x: 14, y: 14 }
    }),
    emissiveTexture: Material.Texture.Common({
      src: 'assets/textures/Neon.png',
      wrapMode: TextureWrapMode.TWM_REPEAT,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      tiling: { x: 14, y: 14 }
    }),
    albedoColor: Color4.create(0.1, 0.9, 1.0, 0.85),
    emissiveColor: Color4.create(0.0, 0.95, 1.0, 0.9), // Radiant cyber cyan glow
    emissiveIntensity: 2.8,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND,
    metallic: 0.1,
    roughness: 0.1
  })

  // Counter-flowing GPU UV scrolling: Cyan plasma grid flows north-west (creates dual-layer shimmering interference)
  Tween.setTextureMoveContinuous(
    lavaOverlayEntity,
    Vector2.create(-0.06, 0.09),
    0.18,
    TextureMovementType.TMT_OFFSET
  )

  // Mobile-safe rising plasma embers (capped to 35 live particles for 60fps on Android)
  ParticleSystem.create(lavaEntity, {
    active: true,
    rate: 18,
    maxParticles: 35,
    lifetime: 1.8,
    gravity: -0.75, // Float upward
    shape: ParticleSystem.Shape.Box({ size: Vector3.create(14, 0.1, 14) }),
    initialSize: { start: 0.12, end: 0.28 },
    initialColor: { start: Color4.create(0.85, 0.2, 1.0, 0.85), end: Color4.create(0.2, 0.85, 1.0, 0.85) },
    colorOverTime: { start: Color4.create(1, 0.4, 0.9, 1), end: Color4.create(0.1, 0.2, 0.8, 0) },
    blendMode: PBParticleSystem_BlendMode.PSB_ADD,
    simulationSpace: PBParticleSystem_SimulationSpace.PSS_WORLD
  })

  // Hidden until a run starts
  VisibilityComponent.create(lavaEntity, { visible: false })
  VisibilityComponent.create(lavaOverlayEntity, { visible: false })
}

/**
 * Keeps skybox fixed to deep midnight void (fixedTime: 0 / 12:00 AM)
 */
export function updateAltitudeSkybox(_altitude?: number) {
  SkyboxTime.createOrReplace(engine.RootEntity, {
    fixedTime: 0
  })
}

export const fogEntities: ReturnType<typeof engine.addEntity>[] = []

/** Builds volumetric atmospheric mist curtains around the perimeter & horizontal swirling cloud layers */
function buildAtmosphericFog() {
  const fogMat = {
    texture: Material.Texture.Common({
      src: 'assets/textures/fog.png',
      wrapMode: TextureWrapMode.TWM_REPEAT,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      tiling: { x: 2, y: 2 }
    }),
    emissiveTexture: Material.Texture.Common({
      src: 'assets/textures/fog.png',
      wrapMode: TextureWrapMode.TWM_REPEAT,
      filterMode: TextureFilterMode.TFM_BILINEAR,
      tiling: { x: 2, y: 2 }
    }),
    albedoColor: Color4.create(1, 1, 1, 1),
    emissiveColor: Color4.create(0.60, 0.30, 0.95, 0.9),
    emissiveIntensity: 2.4,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_BLEND
  }

  // 1. Four Distant Horizon Fog Curtains (Placed far in the background around the scene)
  const distantHorizonConfigs = [
    { pos: Vector3.create(-12.0, 24.0, 8.0), scale: Vector3.create(48.0, 48.0, 1.0), rot: Quaternion.fromEulerDegrees(0, 90, 0) },   // Far West
    { pos: Vector3.create(28.0, 24.0, 8.0), scale: Vector3.create(48.0, 48.0, 1.0), rot: Quaternion.fromEulerDegrees(0, -90, 0) },   // Far East
    { pos: Vector3.create(8.0, 24.0, -12.0), scale: Vector3.create(48.0, 48.0, 1.0), rot: Quaternion.fromEulerDegrees(0, 0, 0) },     // Far South
    { pos: Vector3.create(8.0, 24.0, 28.0), scale: Vector3.create(48.0, 48.0, 1.0), rot: Quaternion.fromEulerDegrees(0, 180, 0) }    // Far North
  ]
  for (const cfg of distantHorizonConfigs) {
    const wallFog = engine.addEntity()
    Transform.create(wallFog, { position: cfg.pos, scale: cfg.scale, rotation: cfg.rot })
    MeshRenderer.setPlane(wallFog)
    Material.setPbrMaterial(wallFog, {
      ...fogMat,
      emissiveIntensity: 1.0
    })
    fogEntities.push(wallFog)
  }

  // 2. High-Altitude Stratosphere Cloud Layers (Only at 28m and 55m — far above lounge)
  const highCloudConfigs = [
    { y: 28.0, rotY: 45, scale: 32.0 },
    { y: 55.0, rotY: 90, scale: 32.0 }
  ]
  for (const cfg of highCloudConfigs) {
    const layer = engine.addEntity()
    Transform.create(layer, {
      position: Vector3.create(8.0, cfg.y, 8.0),
      scale: Vector3.create(cfg.scale, cfg.scale, 1.0),
      rotation: Quaternion.fromEulerDegrees(90, cfg.rotY, 0)
    })
    MeshRenderer.setPlane(layer)
    Material.setPbrMaterial(layer, {
      ...fogMat,
      emissiveIntensity: 0.8
    })
    fogEntities.push(layer)
  }
}

/** Instantly snaps the rising void back down to ground level (Y = 0.05) and hides it */
export function resetLavaPosition() {
  if (lavaEntity) {
    const t = Transform.getMutable(lavaEntity)
    t.position = Vector3.create(8.0, 0.05, 8.0)
    VisibilityComponent.createOrReplace(lavaEntity, { visible: false })
  }
  if (lavaOverlayEntity) {
    VisibilityComponent.createOrReplace(lavaOverlayEntity, { visible: false })
  }
}

/** Show or hide the lava entity (shown only during active runs) */
export function setLavaVisible(visible: boolean) {
  if (lavaEntity) {
    VisibilityComponent.createOrReplace(lavaEntity, { visible })
  }
  if (lavaOverlayEntity) {
    VisibilityComponent.createOrReplace(lavaOverlayEntity, { visible })
  }
}

// ─── Lobby Waiting Lounge & Course Launchpad ──────────────────────────────────
function buildStartIsland() {
  // 1. Lobby Waiting Lounge (where unassigned / pre-game players hang out)
  makePlatform(8.0, 1.0, 0.4, 9.0, 0.4, 2.0, Color4.create(0.08, 0.10, 0.20, 1))
  // Neon trim on the lounge platform
  makeNeonTrim(8.0, 1.0, 0.4, 9.0, 2.0, COL_NEON_CYAN)

  // Waiting Lounge Holographic Sign
  const loungeSign = engine.addEntity()
  Transform.create(loungeSign, { position: Vector3.create(8.0, 2.6, 0.1) })
  TextShape.create(loungeSign, {
    text: 'SQUAD LOUNGE // PAIR & START',
    fontSize: 1.8,
    textColor: Color4.create(0.2, 0.85, 1.0, 0.9)
  })
  Billboard.create(loungeSign, { billboardMode: BillboardMode.BM_Y })

  // 2. Active Course Launchpad (where the squad spawns when the run starts)
  makePlatform(8.0, 1.8, 2.3, 7.0, 0.4, 2.0, COL_FLOATING_STONE)
  // Neon trim on launchpad — gold accent
  makeNeonTrim(8.0, 1.8, 2.3, 7.0, 2.0, COL_NEON_GOLD)

  // Launchpad Gateway Pylons
  makePlatform(4.6, 3.2, 1.4, 0.3, 2.6, 0.3, COL_NEON_CYAN)
  makePlatform(11.4, 3.2, 1.4, 0.3, 2.6, 0.3, COL_NEON_CYAN)
  makePlatform(8.0, 4.5, 1.4, 7.1, 0.3, 0.3, COL_NEON_CYAN)

  const header = engine.addEntity()
  Transform.create(header, { position: Vector3.create(8.0, 5.2, 1.4) })
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
    const initialY = 2.6 + i * PLATFORM_SPACING_Y
    const isMoving = i !== 0 && (i % MOVING_PLATFORM_INTERVAL) === 0
    const neonColor = NEON_TRIM_COLORS[i % NEON_TRIM_COLORS.length]

    const entity = engine.addEntity()
    Transform.create(entity, {
      position: Vector3.create(slot.x, initialY, slot.z),
      scale: Vector3.create(slot.sx, 0.35, slot.sz)
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
        amplitude: 1.1,   // ±1.1 m swing (keeps jumps reachable & clear)
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

    // Floating Cyber-Gem on platform
    const gem = engine.addEntity()
    Transform.create(gem, {
      position: Vector3.create(slot.x, initialY + 0.9, slot.z),
      scale: Vector3.create(0.38, 0.38, 0.38),
      rotation: Quaternion.fromEulerDegrees(45, 45, 0)
    })
    MeshRenderer.setBox(gem)
    Material.setPbrMaterial(gem, {
      albedoColor: Color4.create(0.1, 1.0, 0.8, 1),
      emissiveColor: Color4.create(0.2, 1.0, 0.9, 1),
      emissiveIntensity: 3.5,
      metallic: 0.8,
      roughness: 0.1
    })
    const hasGem = i !== 0 && (i % 2 === 1)
    VisibilityComponent.create(gem, { visible: hasGem })

    // Native continuous gem rotation (evaluated by client engine, 0 CPU overhead)
    Tween.setRotateContinuous(gem, Quaternion.fromEulerDegrees(0, 1, 0), 75)

    // Vertical Left-to-Right Moving Hazard Cylinder Obstacle (Visual + Programmatic Zap)
    const obstacle = engine.addEntity()
    Transform.create(obstacle, {
      position: Vector3.create(slot.x, initialY + 0.95, slot.z),
      scale: Vector3.create(0.55, 1.4, 0.55),
      rotation: Quaternion.fromEulerDegrees(0, 0, 0)
    })
    MeshRenderer.setCylinder(obstacle, 1, 1)
    Material.setPbrMaterial(obstacle, {
      albedoColor: Color4.create(1.0, 0.15, 0.25, 1),
      emissiveColor: Color4.create(1.0, 0.20, 0.35, 1),
      emissiveIntensity: 3.5,
      metallic: 0.8,
      roughness: 0.15
    })
    const hasObstacle = i !== 0 && (i % 3 === 2)
    VisibilityComponent.create(obstacle, { visible: hasObstacle })

    const entry: RecycledPlatform = {
      entity,
      labelEntity: label,
      gemEntity: gem,
      hasGem,
      obstacleEntity: obstacle,
      hasObstacle,
      obstaclePhase: i * 1.2,
      trimEntities,
      baseY: initialY,
      slotIndex: i,
      altitudeTier: 0,
      isMoving,
      type: 'normal',
      fragileTimer: 0
    }
    platformPool.push(entry)
    platformEntityMap.set(entity, entry)
  }
}

/** Resets all recycled platforms back to their starting positions */
export function resetPlatformPool() {
  for (let i = 0; i < platformPool.length; i++) {
    const p = platformPool[i]
    const slot = SPIRAL_POINTS[p.slotIndex]
    const initialY = 2.6 + i * PLATFORM_SPACING_Y

    p.baseY = initialY
    p.altitudeTier = 0
    p.hasGem = i !== 0 && (i % 2 === 1)
    p.hasObstacle = i !== 0 && (i % 3 === 2)
    p.obstaclePhase = i * 1.2
    p.type = 'normal'
    p.fragileTimer = 0

    VisibilityComponent.createOrReplace(p.entity, { visible: true })
    MeshCollider.setBox(p.entity)
    Material.setPbrMaterial(p.entity, {
      albedoColor: COL_FLOATING_STONE,
      metallic: 0.5,
      roughness: 0.4
    })

    const transform = Transform.getMutable(p.entity)
    transform.position = Vector3.create(slot.x, initialY, slot.z)

    const labelTransform = Transform.getMutable(p.labelEntity)
    labelTransform.position = Vector3.create(slot.x, initialY + 1.2, slot.z)

    const labelShape = TextShape.getMutable(p.labelEntity)
    labelShape.text = `${Math.round(initialY - 2.0)}m`

    // Reset gem position and visibility
    const gemTransform = Transform.getMutable(p.gemEntity)
    gemTransform.position = Vector3.create(slot.x, initialY + 0.9, slot.z)
    VisibilityComponent.createOrReplace(p.gemEntity, { visible: p.hasGem })

    // Reset obstacle position and visibility
    const obsTransform = Transform.getMutable(p.obstacleEntity)
    obsTransform.position = Vector3.create(slot.x, initialY + 0.95, slot.z)
    p.obstaclePhase = i * 1.2
    VisibilityComponent.createOrReplace(p.obstacleEntity, { visible: p.hasObstacle })

    // Reset trim strips back to initial slot positions
    repositionTrim(p.trimEntities, slot.x, initialY, slot.sx, slot.z, slot.sz)
    for (const trim of p.trimEntities) {
      VisibilityComponent.createOrReplace(trim, { visible: true })
    }

    // Reset moving platform oscillation state
    if (p.isMoving && MovingPlatform.has(p.entity)) {
      const mp = MovingPlatform.getMutable(p.entity)
      mp.originX = slot.x
      mp.originZ = slot.z
      mp.elapsed = i * 0.7
    }
  }
}
