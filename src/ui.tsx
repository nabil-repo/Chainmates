/**
 * ui.tsx
 * Ultra-Polished, Responsive UI for Chainmates Endless Co-op Climb.
 *
 * Design features:
 *  - Modern gaming typography (clean labels, no noisy emoji artifacts)
 *  - Responsive glassmorphism cards with crisp contrast
 *  - Clear stat grid & leaderboard hierarchy
 *  - Mobile-first layout with ≥54px touch targets & screenInset: 'interactable'
 */

import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import {
  gameState,
  GamePhase,
  LeaderboardEntry,
  formatTime,
  startRun,
  resetToLobby,
  requestTether,
  acceptTether,
  leaveSquad
} from './gameState'
import { setChainSkin, tetherState } from './tether'

// ─── Design Tokens & Theme ───────────────────────────────────────────────────
const THEME = {
  bgOverlay: Color4.create(0.02, 0.03, 0.08, 0.88),
  cardBg: Color4.create(0.06, 0.08, 0.16, 0.96),
  cardHeader: Color4.create(0.09, 0.12, 0.22, 1.0),
  statBoxBg: Color4.create(0.04, 0.05, 0.11, 0.90),
  rowAltBg: Color4.create(0.10, 0.14, 0.26, 0.50),
  borderCyan: Color4.create(0.15, 0.85, 1.0, 0.8),

  // Accents
  cyan: Color4.create(0.15, 0.85, 1.0, 1),
  cyanDim: Color4.create(0.10, 0.35, 0.55, 1),
  gold: Color4.create(1.0, 0.80, 0.15, 1),
  emerald: Color4.create(0.15, 1.0, 0.55, 1),
  red: Color4.create(1.0, 0.22, 0.22, 1),
  orange: Color4.create(1.0, 0.45, 0.10, 1),

  // Typography
  textPrimary: Color4.White(),
  textSecondary: Color4.create(0.70, 0.75, 0.85, 1),
  textMuted: Color4.create(0.45, 0.50, 0.62, 1),
  transparent: Color4.create(0, 0, 0, 0)
}

// ─── UI State ─────────────────────────────────────────────────────────────────
let uiState = {
  phase: 'LOBBY' as GamePhase,
  countdown: 3,
  leaderboard: [] as LeaderboardEntry[],
  selectedSkin: 0,
  elapsedFormatted: '0:00.00',
  yankFlash: false,
  playerCount: 1,
  renderTick: 0
}

export function setUiPhase(phase: GamePhase) { uiState.phase = phase }
export function setUiCountdown(n: number) { uiState.countdown = n }
export function setUiLeaderboard(board: LeaderboardEntry[]) { uiState.leaderboard = [...board] }
export function setUiYankFlash(v: boolean) { uiState.yankFlash = v }
export function updateUiEach(ms: number) { uiState.elapsedFormatted = formatTime(ms) }

// ─── Milestone Tier Calculator ────────────────────────────────────────────────
function getTierInfo(alt: number) {
  if (alt >= 200) return { title: 'DIAMOND ESCAPERS', badge: 'TIER IV', color: THEME.cyan }
  if (alt >= 100) return { title: 'GOLD CLIMBERS', badge: 'TIER III', color: THEME.gold }
  if (alt >= 50) return { title: 'SILVER CLIMBERS', badge: 'TIER II', color: THEME.textSecondary }
  if (alt >= 25) return { title: 'BRONZE CLIMBERS', badge: 'TIER I', color: THEME.orange }
  return { title: 'ROOKIE SQUAD', badge: 'NOVICE', color: THEME.textMuted }
}

// ─── UI Components ────────────────────────────────────────────────────────────

/** 1. Lobby Screen with Player Selection & Squad Pairing */
const LobbyScreen = () => {
  const isPaired = !!gameState.partnerId
  const availablePlayers = Array.from(gameState.remotePlayers.values())

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      {/* Main Card Modal */}
      <UiEntity
        uiTransform={{
          width: 480,
          flexDirection: 'column',
          alignItems: 'center',
          padding: 22
        }}
        uiBackground={{ color: THEME.cardBg }}
      >
        {/* Category Pill */}
        <UiEntity
          uiTransform={{
            padding: { left: 12, right: 12, top: 4, bottom: 4 },
            margin: { bottom: 6 }
          }}
          uiBackground={{ color: THEME.statBoxBg }}
        >
          <Label value='CO-OP SURVIVAL // SQUAD LOBBY' fontSize={11} color={THEME.cyan} />
        </UiEntity>

        {/* Main Title */}
        <Label
          value='CHAINED TOGETHER'
          fontSize={26}
          color={THEME.textPrimary}
          uiTransform={{ margin: { bottom: 2 } }}
        />
        <Label
          value='Pair up with a partner in the scene to climb together.'
          fontSize={12}
          color={THEME.textSecondary}
          uiTransform={{ margin: { bottom: 14 } }}
        />

        {/* Incoming Invite Alert if any */}
        {gameState.pendingInvite && !isPaired && (
          <UiEntity
            uiTransform={{
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: { left: 12, right: 12, top: 8, bottom: 8 },
              margin: { bottom: 12 }
            }}
            uiBackground={{ color: Color4.create(0.1, 0.4, 0.2, 0.9) }}
          >
            <Label value={`INVITE: ${gameState.pendingInvite.fromName}`} fontSize={12} color={THEME.textPrimary} />
            <Button
              value='ACCEPT'
              variant='primary'
              uiTransform={{ width: 90, height: 36 }}
              uiBackground={{ color: THEME.emerald }}
              fontSize={12}
              color={THEME.cardBg}
              onMouseDown={() => acceptTether(gameState.pendingInvite!.fromId)}
            />
          </UiEntity>
        )}

        {/* Squad Status / Active Partner */}
        {isPaired ? (
          <UiEntity
            uiTransform={{
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: { left: 14, right: 14, top: 10, bottom: 10 },
              margin: { bottom: 14 }
            }}
            uiBackground={{ color: THEME.statBoxBg }}
          >
            <UiEntity uiTransform={{ flexDirection: 'column' }}>
              <Label value='LINKED SQUAD' fontSize={10} color={THEME.textMuted} />
              <Label value={`🔗 ${gameState.localName} & ${gameState.partnerName}`} fontSize={14} color={THEME.emerald} />
            </UiEntity>
            <Button
              value='DISCONNECT'
              variant='primary'
              uiTransform={{ width: 110, height: 38 }}
              uiBackground={{ color: THEME.red }}
              fontSize={11}
              color={THEME.textPrimary}
              onMouseDown={leaveSquad}
            />
          </UiEntity>
        ) : (
          /* Player Selection List */
          <UiEntity
            uiTransform={{
              width: '100%',
              flexDirection: 'column',
              padding: { left: 12, right: 12, top: 8, bottom: 8 },
              margin: { bottom: 14 }
            }}
            uiBackground={{ color: THEME.statBoxBg }}
          >
            <Label
              value={gameState.outgoingInviteTo
                ? `INVITE SENT: WAITING FOR ${gameState.outgoingInviteTo.name.toUpperCase()} TO ACCEPT...`
                : 'SELECT PARTNER IN SCENE'}
              fontSize={11}
              color={gameState.outgoingInviteTo ? THEME.gold : THEME.cyan}
              uiTransform={{ margin: { bottom: 6 } }}
            />

            {availablePlayers.length === 0 ? (
              <Label
                value='Waiting for another player to enter the scene...'
                fontSize={12}
                color={THEME.textMuted}
                uiTransform={{ margin: { top: 4, bottom: 4 } }}
              />
            ) : (
              availablePlayers.slice(0, 3).map((player) => {
                const isInvited = gameState.outgoingInviteTo?.id === player.id
                return (
                  <UiEntity
                    key={`p-${player.id}`}
                    uiTransform={{
                      width: '100%',
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: { top: 4, bottom: 4 }
                    }}
                  >
                    <Label value={`👤 ${player.displayName}`} fontSize={13} color={THEME.textPrimary} />
                    <Button
                      value={isInvited ? 'INVITED...' : 'LINK TETHER'}
                      variant='primary'
                      uiTransform={{ width: 120, height: 34 }}
                      uiBackground={{ color: isInvited ? THEME.cyanDim : THEME.cyan }}
                      fontSize={11}
                      color={isInvited ? THEME.textMuted : THEME.cardBg}
                      onMouseDown={() => requestTether(player.id)}
                    />
                  </UiEntity>
                )
              })
            )}
          </UiEntity>
        )}

        {/* Skin Selector */}
        <Label value='TETHER MATERIAL' fontSize={11} color={THEME.textMuted} uiTransform={{ margin: { bottom: 6 } }} />
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 16 } }}>
          {[
            { label: 'CHAIN', idx: 0 },
            { label: 'ROPE', idx: 1 },
            { label: 'NEON', idx: 2 }
          ].map((item) => (
            <Button
              key={`skin-${item.idx}`}
              value={item.label}
              variant='primary'
              uiTransform={{ width: 130, height: 42 }}
              uiBackground={{ color: uiState.selectedSkin === item.idx ? THEME.cyan : THEME.cyanDim }}
              fontSize={12}
              color={THEME.textPrimary}
              onMouseDown={() => {
                uiState.selectedSkin = item.idx
                gameState.tetherSkinIndex = item.idx
                setChainSkin(item.idx)
              }}
            />
          ))}
        </UiEntity>

        {/* Start Action */}
        <Button
          value={
            isPaired
              ? 'START SQUAD CLIMB ▶'
              : gameState.outgoingInviteTo
                ? '(WAITING FOR PARTNER TO ACCEPT...)'
                : '(LINK A PARTNER TO START)'
          }
          variant='primary'
          uiTransform={{ width: '100%', height: 48 }}
          uiBackground={{ color: isPaired ? THEME.emerald : Color4.create(0.18, 0.22, 0.32, 0.6) }}
          fontSize={14}
          color={isPaired ? THEME.cardBg : THEME.textMuted}
          onMouseDown={() => {
            if (isPaired) startRun()
          }}
        />
      </UiEntity>
    </UiEntity>
  )
}

/** 2. Countdown Screen */
const CountdownScreen = () => (
  <UiEntity
    uiTransform={{
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}
  >
    <Label
      value={uiState.countdown > 0 ? `${uiState.countdown}` : 'CLIMB!'}
      fontSize={uiState.countdown > 0 ? 84 : 64}
      color={uiState.countdown > 0 ? THEME.gold : THEME.emerald}
    />
    <Label
      value='LAVA IS RISING — MOVE TOGETHER'
      fontSize={15}
      color={THEME.orange}
      uiTransform={{ margin: { top: 6 } }}
    />
  </UiEntity>
)

/** 3. Active In-Game Running HUD */
const RunningHud = () => {
  const lavaDist = Math.max(0, Math.round((gameState.currentAltitude + 2.0 - gameState.lavaHeight) * 10) / 10)
  const lavaNear = lavaDist < 2.5

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: { top: 12 }
      }}
    >
      {/* Top Modular Stats Strip */}
      <UiEntity
        uiTransform={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: { left: 16, right: 16, top: 8, bottom: 8 }
        }}
        uiBackground={{ color: THEME.cardBg }}
      >
        {/* Score Badge */}
        <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'flex-start', margin: { right: 18 } }}>
          <Label value='TEAM SCORE' fontSize={10} color={THEME.textMuted} />
          <Label value={`${gameState.teamScore}`} fontSize={20} color={THEME.gold} />
        </UiEntity>

        {/* Altitude Badge */}
        <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'flex-start', margin: { right: 18 } }}>
          <Label value='ALTITUDE' fontSize={10} color={THEME.textMuted} />
          <Label value={`${gameState.currentAltitude} M`} fontSize={20} color={THEME.cyan} />
        </UiEntity>

        {/* Lava Threat Badge */}
        <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'flex-start', margin: { right: 18 } }}>
          <Label value='LAVA LEVEL' fontSize={10} color={lavaNear ? THEME.red : THEME.textMuted} />
          <Label value={`-${lavaDist} M`} fontSize={20} color={lavaNear ? THEME.red : THEME.orange} />
        </UiEntity>

        {/* Timer */}
        <UiEntity uiTransform={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <Label value='SURVIVAL TIME' fontSize={10} color={THEME.textMuted} />
          <Label value={uiState.elapsedFormatted} fontSize={18} color={THEME.textPrimary} />
        </UiEntity>
      </UiEntity>

      {/* Action Alerts */}
      {uiState.yankFlash && (
        <UiEntity
          uiTransform={{ padding: { left: 14, right: 14, top: 4, bottom: 4 }, margin: { top: 8 } }}
          uiBackground={{ color: THEME.red }}
        >
          <Label value='TETHER TENSION CRITICAL // YANKED' fontSize={14} color={THEME.textPrimary} />
        </UiEntity>
      )}

      {lavaNear && (
        <UiEntity
          uiTransform={{ padding: { left: 14, right: 14, top: 4, bottom: 4 }, margin: { top: 6 } }}
          uiBackground={{ color: THEME.cardBg }}
        >
          <Label value='WARNING: LAVA IMMINENT // ASCEND NOW' fontSize={13} color={THEME.red} />
        </UiEntity>
      )}
    </UiEntity>
  )
}

/** 4. Game Over / Team Eliminated Screen */
const GameOverScreen = () => {
  const tier = getTierInfo(gameState.finalAltitude)

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <UiEntity
        uiTransform={{
          width: 480,
          flexDirection: 'column',
          alignItems: 'center',
          padding: 22
        }}
        uiBackground={{ color: THEME.cardBg }}
      >
        {/* Header Tag */}
        <Label
          value='TEAM ELIMINATED'
          fontSize={24}
          color={THEME.red}
          uiTransform={{ margin: { bottom: 2 } }}
        />
        <Label
          value={gameState.gameOverReason || 'Plunged into the molten abyss'}
          fontSize={13}
          color={THEME.textMuted}
          uiTransform={{ margin: { bottom: 14 } }}
        />

        {/* 2-Column Stat Grid */}
        <UiEntity uiTransform={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', margin: { bottom: 12 } }}>
          {/* Stat 1: Final Score */}
          <UiEntity
            uiTransform={{
              width: '48%',
              flexDirection: 'column',
              alignItems: 'center',
              padding: { top: 10, bottom: 10 }
            }}
            uiBackground={{ color: THEME.statBoxBg }}
          >
            <Label value='FINAL TEAM SCORE' fontSize={11} color={THEME.textMuted} />
            <Label value={`${gameState.finalScore} PTS`} fontSize={22} color={THEME.gold} />
          </UiEntity>

          {/* Stat 2: Peak Altitude */}
          <UiEntity
            uiTransform={{
              width: '48%',
              flexDirection: 'column',
              alignItems: 'center',
              padding: { top: 10, bottom: 10 }
            }}
            uiBackground={{ color: THEME.statBoxBg }}
          >
            <Label value='MAX ALTITUDE' fontSize={11} color={THEME.textMuted} />
            <Label value={`${gameState.finalAltitude} M`} fontSize={22} color={THEME.cyan} />
          </UiEntity>
        </UiEntity>

        {/* Milestone Tier Badge */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: { left: 14, right: 14, top: 8, bottom: 8 },
            margin: { bottom: 14 }
          }}
          uiBackground={{ color: THEME.statBoxBg }}
        >
          <Label value={tier.title} fontSize={13} color={tier.color} />
          <Label value={tier.badge} fontSize={12} color={THEME.textMuted} />
        </UiEntity>

        {/* Global Leaderboard Table */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'column',
            padding: { left: 12, right: 12, top: 8, bottom: 8 },
            margin: { bottom: 16 }
          }}
          uiBackground={{ color: THEME.statBoxBg }}
        >
          <Label
            value='GLOBAL SQUAD LEADERBOARD'
            fontSize={11}
            color={THEME.cyan}
            uiTransform={{ margin: { bottom: 6 } }}
          />

          {uiState.leaderboard.length === 0 ? (
            <Label value='No squad records yet' fontSize={12} color={THEME.textMuted} />
          ) : (
            uiState.leaderboard.slice(0, 4).map((entry, i) => (
              <UiEntity
                key={`lb-${i}`}
                uiTransform={{
                  width: '100%',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  padding: { top: 4, bottom: 4 }
                }}
                uiBackground={{ color: i % 2 === 1 ? THEME.rowAltBg : THEME.transparent }}
              >
                <Label
                  value={`${i + 1}. ${entry.displayName}`}
                  fontSize={12}
                  color={i === 0 ? THEME.gold : THEME.textPrimary}
                />
                <Label
                  value={`${entry.teamScore} PTS  (${entry.maxAltitude}M)`}
                  fontSize={12}
                  color={i === 0 ? THEME.gold : THEME.textSecondary}
                />
              </UiEntity>
            ))
          )}
        </UiEntity>

        {/* Action Button */}
        <Button
          value='RETRY CLIMB ▶'
          variant='primary'
          uiTransform={{ width: '100%', height: 50 }}
          uiBackground={{ color: THEME.cyan }}
          fontSize={15}
          color={THEME.cardBg}
          onMouseDown={resetToLobby}
        />
      </UiEntity>
    </UiEntity>
  )
}

// ─── Root Container ───────────────────────────────────────────────────────────
const ChainmatesUI = () => (
  <UiEntity
    uiTransform={{
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}
    uiBackground={{ color: THEME.transparent }}
  >
    {uiState.phase === 'LOBBY' && <LobbyScreen />}
    {uiState.phase === 'COUNTDOWN' && <CountdownScreen />}
    {uiState.phase === 'RUNNING' && <RunningHud />}
    {uiState.phase === 'GAME_OVER' && <GameOverScreen />}
    {uiState.phase === 'FINISHED' && <GameOverScreen />}
  </UiEntity>
)

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(ChainmatesUI, { screenInset: 'interactable' })
}