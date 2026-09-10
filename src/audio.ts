/**
 * audio.ts
 * Spatial Audio, Sound Effects & Background Music Manager for Chainmates.
 */

import { engine, AudioSource, Transform } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'

let sfxEntity: ReturnType<typeof engine.addEntity> | null = null
let musicEntity: ReturnType<typeof engine.addEntity> | null = null
let musicPlaying = true

function getSfxEntity() {
  if (!sfxEntity) {
    sfxEntity = engine.addEntity()
    Transform.create(sfxEntity, {
      position: Vector3.create(0, 1.2, 0),
      parent: engine.PlayerEntity
    })
  }
  return sfxEntity
}

function getMusicEntity() {
  if (!musicEntity) {
    musicEntity = engine.addEntity()
    Transform.create(musicEntity, {
      position: Vector3.create(0, 1.2, 0),
      parent: engine.PlayerEntity
    })
  }
  return musicEntity
}

let audioUnlocked = false

// ─── Background Music ──────────────────────────────────────────────────────────

/** Start or resume looping cyberpunk background music */
export function startBgMusic() {
  const e = getMusicEntity()
  musicPlaying = true
  AudioSource.createOrReplace(e, {
    audioClipUrl: 'assets/sounds/bg_music.mp3',
    playing: true,
    volume: 0.65,
    loop: true,
    global: true
  })
}

/** Pause / Stop background music */
export function stopBgMusic() {
  const e = getMusicEntity()
  musicPlaying = false
  AudioSource.createOrReplace(e, {
    audioClipUrl: 'assets/sounds/bg_music.mp3',
    playing: false,
    volume: 0.65,
    loop: true,
    global: true
  })
}

/** Called on first user interaction (click, keypress, button tap) to unlock browser autoplay */
export function unlockAudio() {
  if (!audioUnlocked) {
    audioUnlocked = true
    if (musicPlaying) {
      startBgMusic()
    }
  }
}

/** Toggle background music on/off */
export function toggleBgMusic(): boolean {
  audioUnlocked = true
  if (musicPlaying) {
    stopBgMusic()
  } else {
    startBgMusic()
  }
  return musicPlaying
}

export function isBgMusicPlaying(): boolean {
  return musicPlaying
}

// ─── Sound Effects ────────────────────────────────────────────────────────────

/** Play short electronic tick blip during countdown */
export function playTickSound() {
  const e = getSfxEntity()
  AudioSource.createOrReplace(e, {
    audioClipUrl: 'assets/sounds/tick.wav',
    playing: true,
    volume: 0.8,
    loop: false,
    global: true
  })
}

/** Play ascending dual chime on countdown GO / climb start */
export function playGoSound() {
  const e = getSfxEntity()
  AudioSource.createOrReplace(e, {
    audioClipUrl: 'assets/sounds/go.wav',
    playing: true,
    volume: 1.0,
    loop: false,
    global: true
  })
}

/** Play electric snap & buzz when the tether yanks */
export function playYankSound() {
  const e = getSfxEntity()
  AudioSource.createOrReplace(e, {
    audioClipUrl: 'assets/sounds/yank.wav',
    playing: true,
    volume: 0.9,
    loop: false,
    global: true
  })
}

/** Play deep descending synth drop on falling into the void */
export function playVoidFallSound() {
  const e = getSfxEntity()
  AudioSource.createOrReplace(e, {
    audioClipUrl: 'assets/sounds/void_fall.wav',
    playing: true,
    volume: 1.0,
    loop: false,
    global: true
  })
}

/** Play celebratory fanfare chord on reaching altitude tiers */
export function playMilestoneSound() {
  const e = getSfxEntity()
  AudioSource.createOrReplace(e, {
    audioClipUrl: 'assets/sounds/milestone.wav',
    playing: true,
    volume: 1.0,
    loop: false,
    global: true
  })
}

/** Play crystal chime on collecting a floating cyber-gem */
export function playGemSound() {
  const e = getSfxEntity()
  AudioSource.createOrReplace(e, {
    audioClipUrl: 'assets/sounds/gem.wav',
    playing: true,
    volume: 0.95,
    loop: false,
    global: true
  })
}
