import { Schemas, engine } from '@dcl/sdk/ecs'

// ─────────────────────────────────────────────────────────────────────────────
// TetherLink — data stored on the local player's "state" entity
// ─────────────────────────────────────────────────────────────────────────────
export const TetherLink = engine.defineComponent('chainmates:TetherLink', {
  partnerId: Schemas.String,     // address of tethered partner
  maxLength: Schemas.Number,     // max chain length in meters (default 5)
  isYanked: Schemas.Boolean,     // true during yank cooldown
  yankCooldown: Schemas.Number,  // seconds remaining in yank stun
  skinIndex: Schemas.Int         // 0=Chain 1=Rope 2=Neon
})

// ─────────────────────────────────────────────────────────────────────────────
// Checkpoint — placed on trigger-zone entities in the course
// ─────────────────────────────────────────────────────────────────────────────
export const Checkpoint = engine.defineComponent('chainmates:Checkpoint', {
  index: Schemas.Int,            // 0=start, 1-4=obstacles, 5=finish
  isFinish: Schemas.Boolean,
  spawnX: Schemas.Number,
  spawnY: Schemas.Number,
  spawnZ: Schemas.Number
})

// ─────────────────────────────────────────────────────────────────────────────
// PlayerProxy — placed on entities that represent remote players visually
// ─────────────────────────────────────────────────────────────────────────────
export const PlayerProxy = engine.defineComponent('chainmates:PlayerProxy', {
  playerId: Schemas.String,
  displayName: Schemas.String,
  // lerp targets (set from MessageBus updates)
  targetX: Schemas.Number,
  targetY: Schemas.Number,
  targetZ: Schemas.Number,
  lastUpdateTime: Schemas.Number
})

// ─────────────────────────────────────────────────────────────────────────────
// GameRunnerTag — marker for the entity that drives the run timer
// ─────────────────────────────────────────────────────────────────────────────
export const GameRunnerTag = engine.defineComponent('chainmates:GameRunnerTag', {
  startTime: Schemas.Number,  // engine.RootEntity totalRuntime at run start
  isHost: Schemas.Boolean     // true = this client started the run
})

// ─────────────────────────────────────────────────────────────────────────────
// MovingPlatform — drives obstacle 3
// ─────────────────────────────────────────────────────────────────────────────
export const MovingPlatform = engine.defineComponent('chainmates:MovingPlatform', {
  originX: Schemas.Number,
  originZ: Schemas.Number,
  amplitude: Schemas.Number,  // meters each direction
  period: Schemas.Number,     // seconds for one full cycle
  elapsed: Schemas.Number     // accumulated time
})
