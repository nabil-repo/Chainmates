/**
 * playerSync.ts
 * Broadcasts the local player's position at 10fps and maintains
 * proxy entities for remote players (lerped to smooth out 10fps updates).
 */

import {
  engine,
  Transform,
  AvatarShape,
  PlayerIdentityData,
  TextShape,
  Billboard,
  BillboardMode
} from '@dcl/sdk/ecs'
import { Vector3, Color4 } from '@dcl/sdk/math'
import { gameState, broadcastPosition } from './gameState'
import { PlayerProxy } from './components'

// How often to broadcast our position (seconds)
const BROADCAST_INTERVAL = 0.1   // 10 fps
// Lerp speed for proxy movement (higher = snappier)
const LERP_SPEED = 10

let broadcastTimer = 0

// Map from playerId → entity used as their proxy
const proxyEntities = new Map<string, ReturnType<typeof engine.addEntity>>()

/** Returns true if native explorer comms has already spawned an avatar entity for other players */
function hasNativeRemoteAvatars(): boolean {
  let count = 0
  for (const [entity] of engine.getEntitiesWith(PlayerIdentityData)) {
    if (entity !== engine.PlayerEntity) {
      count++
    }
  }
  return count > 0
}

let proxyCheckTimer = 0

/** Called every frame. Handles broadcast timing and proxy lerping. */
export function playerSyncSystem(dt: number) {
  // 1. Broadcast local position on interval
  broadcastTimer += dt
  if (broadcastTimer >= BROADCAST_INTERVAL) {
    broadcastTimer = 0
    const localTransform = Transform.getOrNull(engine.PlayerEntity)
    if (localTransform) {
      const p = localTransform.position
      broadcastPosition(Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100)
    }
  }

  // 2. Lerp proxy entities toward their target positions
  for (const [id, proxy] of proxyEntities) {
    const remotePlayer = gameState.remotePlayers.get(id)
    if (!remotePlayer) {
      // Player left — remove proxy
      engine.removeEntity(proxy)
      proxyEntities.delete(id)
      continue
    }

    const transform = Transform.getMutable(proxy)
    transform.position = Vector3.lerp(
      transform.position,
      Vector3.create(remotePlayer.x, remotePlayer.y, remotePlayer.z),
      Math.min(dt * LERP_SPEED, 1)
    )
  }

  // 3. Ensure proxy entities exist (checked at 2 FPS to avoid per-frame entity scans)
  proxyCheckTimer += dt
  if (proxyCheckTimer >= 0.5) {
    proxyCheckTimer = 0
    const nativeCommsActive = hasNativeRemoteAvatars()

    for (const [id, remotePlayer] of gameState.remotePlayers) {
      // Skip internal practice bot (rendered by practiceBot.ts using Ball Droid GLB)
      if (id === '__SOLO__') continue

      if (!proxyEntities.has(id)) {
        const proxy = createProxy(id, remotePlayer.displayName, remotePlayer.x, remotePlayer.y, remotePlayer.z, !nativeCommsActive)
        proxyEntities.set(id, proxy)
      }
    }
  }
}

/** Spawn a proxy entity for a remote player */
function createProxy(id: string, displayName: string, x: number, y: number, z: number, renderAvatar: boolean) {
  const proxy = engine.addEntity()

  Transform.create(proxy, {
    position: Vector3.create(x, y, z),
    scale: Vector3.create(1, 1, 1)
  })

  // If native client didn't spawn an avatar (Desktop multi-instance preview), render full AvatarShape
  if (renderAvatar) {
    AvatarShape.create(proxy, {
      id: id,
      name: displayName,
      bodyShape: 'urn:decentraland:off-chain:base-avatars:BaseMale',
      wearables: [
        'urn:decentraland:off-chain:base-avatars:eyebrows_00',
        'urn:decentraland:off-chain:base-avatars:mouth_00',
        'urn:decentraland:off-chain:base-avatars:eyes_00',
        'urn:decentraland:off-chain:base-avatars:blue_tshirt',
        'urn:decentraland:off-chain:base-avatars:brown_pants',
        'urn:decentraland:off-chain:base-avatars:classic_shoes',
        'urn:decentraland:off-chain:base-avatars:short_hair'
      ],
      hairColor: { r: 0.9, g: 0.7, b: 0.4 },
      skinColor: { r: 0.94, g: 0.85, b: 0.6 },
      emotes: []
    })

    // Floating nametag
    const nameTag = engine.addEntity()
    Transform.create(nameTag, {
      position: Vector3.create(0, 2.2, 0),
      parent: proxy
    })
    TextShape.create(nameTag, {
      text: displayName,
      fontSize: 2.0,
      textColor: Color4.create(0.2, 0.9, 1.0, 1)
    })
    Billboard.create(nameTag, { billboardMode: BillboardMode.BM_Y })
  }

  // Mark as a proxy for position tracking
  PlayerProxy.create(proxy, {
    playerId: id,
    displayName,
    targetX: x, targetY: y, targetZ: z,
    lastUpdateTime: Date.now()
  })

  return proxy
}

/** Call this when leaving or resetting to remove all proxy entities */
export function clearAllProxies() {
  for (const [, proxy] of proxyEntities) {
    engine.removeEntity(proxy)
  }
  proxyEntities.clear()
}

/** Returns the proxy entity for a given player ID (or undefined) */
export function getProxyEntity(playerId: string) {
  return proxyEntities.get(playerId)
}
