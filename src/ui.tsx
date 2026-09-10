/**
 * ui.tsx — Chainmates Endless Co-op Climb
 * Ultra-Polished Gaming UI/UX with Crisp, Large Lucide Iconography & Readable Fonts.
 *
 * Design features:
 *  - High-visibility typography & scaled touch/readability targets
 *  - Crisp vector Lucide outline icons rendered via Texture assets
 *  - Gaming typography: clean sans-serif for UI chrome & monospace for numbers
 *  - Main Menu Squad Leaderboard button & dedicated popup modal
 *  - Dynamic Tether Tension indicator & Danger HUD ribbons
 */

import ReactEcs, { ReactEcsRenderer, UiEntity, Label, Button } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import {
  gameState,
  GamePhase,
  LeaderboardEntry,
  SoloLeaderboardEntry,
  formatTime,
  startRun,
  startPractice,
  resetToLobby,
  rematchRun,
  requestTether,
  acceptTether,
  leaveSquad
} from './gameState'
import { setChainSkin, tetherState, MAX_CHAIN_LENGTH } from './tether'
import { toggleBgMusic, isBgMusicPlaying, unlockAudio } from './audio'

// ─── Texture Assets ───────────────────────────────────────────────────────────
const TEXTURES = {
  panelBg: 'assets/textures/ui_panel_bg.jpg',
  headerBg: 'assets/textures/ui_header_bg.jpg'
}

// ─── Design Tokens & Theme ───────────────────────────────────────────────────
const C = {
  // Backgrounds & Panels
  bgBackdrop: Color4.create(0.01, 0.02, 0.05, 0.92),
  cardBg: Color4.create(0.04, 0.06, 0.12, 0.98),
  cardHeader: Color4.create(0.06, 0.09, 0.18, 1.0),
  panelBg: Color4.create(0.03, 0.05, 0.10, 0.96),
  subPanel: Color4.create(0.05, 0.08, 0.16, 0.94),
  insetBg: Color4.create(0.01, 0.02, 0.04, 0.98),

  // Accents & Borders
  cyan: Color4.create(0.12, 0.85, 1.0, 1.0),
  cyanDim: Color4.create(0.08, 0.28, 0.44, 1.0),
  cyanGlow: Color4.create(0.12, 0.85, 1.0, 0.25),
  borderCyan: Color4.create(0.12, 0.85, 1.0, 0.45),
  gold: Color4.create(1.0, 0.82, 0.15, 1.0),
  goldDim: Color4.create(0.40, 0.32, 0.05, 1.0),
  borderGold: Color4.create(1.0, 0.82, 0.15, 0.45),
  emerald: Color4.create(0.10, 0.95, 0.50, 1.0),
  emeraldDim: Color4.create(0.05, 0.35, 0.18, 1.0),
  borderEmerald: Color4.create(0.10, 0.95, 0.50, 0.45),
  red: Color4.create(1.0, 0.22, 0.22, 1.0),
  redDark: Color4.create(0.35, 0.04, 0.04, 0.95),
  orange: Color4.create(1.0, 0.52, 0.12, 1.0),
  purple: Color4.create(0.72, 0.28, 1.0, 1.0),
  borderPurple: Color4.create(0.72, 0.28, 1.0, 0.45),

  // Text colors
  textWhite: Color4.White(),
  textDim: Color4.create(0.80, 0.86, 0.95, 1.0),
  textMuted: Color4.create(0.55, 0.63, 0.74, 1.0),
  transparent: Color4.create(0, 0, 0, 0)
}

// ─── Lucide Icon Component ────────────────────────────────────────────────────
export const Icon = (props: {
  src: string
  size?: number
  color?: Color4
  margin?: { right?: number; left?: number; top?: number; bottom?: number }
}) => {
  const s = props.size ?? 24
  return (
    <UiEntity
      uiTransform={{
        width: s,
        height: s,
        margin: props.margin
      }}
      uiBackground={{
        textureMode: 'stretch',
        texture: { src: props.src },
        color: props.color ?? Color4.White()
      }}
    />
  )
}

// ─── Reactive UI State ────────────────────────────────────────────────────────
let uiState = {
  phase: 'LOBBY' as GamePhase,
  countdown: 3,
  leaderboard: [] as LeaderboardEntry[],
  soloLeaderboard: [] as SoloLeaderboardEntry[],
  selectedSkin: 0,
  elapsedFormatted: '0:00.00',
  yankFlash: false,
  playerCount: 1,
  renderTick: 0,
  showLeaderboardModal: false,
  showHowToPlayModal: false,
  leaderboardTab: 'squad' as 'squad' | 'solo',
  musicEnabled: true
}

let yankFlashTimer = 0

export function setUiPhase(phase: GamePhase) { uiState.phase = phase }
export function setUiCountdown(n: number) { uiState.countdown = n }
export function setUiLeaderboard(board: LeaderboardEntry[]) { uiState.leaderboard = [...board] }
export function setUiSoloLeaderboard(board: SoloLeaderboardEntry[]) { uiState.soloLeaderboard = [...board] }
export function setUiYankFlash(v: boolean) {
  uiState.yankFlash = v
  if (v) yankFlashTimer = 1.8
}
export function tickUi(dt: number) {
  if (yankFlashTimer > 0) {
    yankFlashTimer -= dt
    if (yankFlashTimer <= 0) {
      uiState.yankFlash = false
    }
  }
}
export function updateUiEach(ms: number) { uiState.elapsedFormatted = formatTime(ms) }

// ─── Milestone Tier Calculator ────────────────────────────────────────────────
function getTierInfo(alt: number) {
  if (alt >= 200) return { icon: 'assets/icons/diamond.png', title: 'DIAMOND ESCAPERS', badge: 'TIER IV', color: C.cyan }
  if (alt >= 100) return { icon: 'assets/icons/trophy.png', title: 'GOLD CLIMBERS', badge: 'TIER III', color: C.gold }
  if (alt >= 50) return { icon: 'assets/icons/medal.png', title: 'SILVER CLIMBERS', badge: 'TIER II', color: C.textDim }
  if (alt >= 25) return { icon: 'assets/icons/mountain.png', title: 'BRONZE CLIMBERS', badge: 'TIER I', color: C.orange }
  return { icon: 'assets/icons/user.png', title: 'ROOKIE SQUAD', badge: 'NOVICE', color: C.textMuted }
}

// ─── Reusable Stat Box (HUD & GameOver) ───────────────────────────────────────
const StatBox = (props: { icon: string; label: string; value: string; color: Color4; isMono?: boolean }) => (
  <UiEntity
    uiTransform={{
      flexDirection: 'column',
      alignItems: 'center',
      padding: { left: 18, right: 18, top: 10, bottom: 10 }
    }}
    uiBackground={{ color: C.panelBg }}
  >
    <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { bottom: 4 } }}>
      <Icon src={props.icon} size={20} color={props.color} margin={{ right: 8 }} />
      <Label value={props.label} fontSize={14} color={C.textMuted} font='sans-serif' />
    </UiEntity>
    <Label
      value={props.value}
      fontSize={26}
      color={props.color}
      font={props.isMono ? 'monospace' : 'sans-serif'}
    />
  </UiEntity>
)

// ─── Reusable Vertical Separator ──────────────────────────────────────────────
const VDivider = () => (
  <UiEntity
    uiTransform={{ width: 2, height: '75%', margin: { left: 4, right: 4 }, alignSelf: 'center' }}
    uiBackground={{ color: Color4.create(0.15, 0.85, 1.0, 0.25) }}
  />
)

// ─── Standalone Leaderboard Modal ─────────────────────────────────────────────
const LeaderboardModal = () => (
  <UiEntity
    uiTransform={{
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}
    uiBackground={{ color: C.bgBackdrop }}
  >
    <UiEntity
      uiTransform={{
        width: 640,
        flexDirection: 'column',
        alignItems: 'center'
      }}
      uiBackground={{ color: C.cardBg }}
    >
      {/* Textured Header */}
      <UiEntity
        uiTransform={{
          width: '100%',
          flexDirection: 'column',
          alignItems: 'center',
          padding: { top: 22, bottom: 16, left: 24, right: 24 }
        }}
        uiBackground={{
          texture: { src: TEXTURES.headerBg },
          textureMode: 'stretch'
        }}
      >
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { bottom: 4 } }}>
          <Icon src='assets/icons/crown.png' size={34} color={C.gold} margin={{ right: 12 }} />
          <Label value='SQUAD LEADERBOARD' fontSize={34} color={C.gold} font='sans-serif' />
        </UiEntity>
        <Label
          value='ALL-TIME CO-OP SURVIVAL & ALTITUDE RECORDS'
          fontSize={15}
          color={C.textDim}
          font='sans-serif'
        />
        {/* Tab switcher */}
        <UiEntity uiTransform={{ flexDirection: 'row', margin: { top: 14 } }}>
          <UiEntity
            uiTransform={{ width: 150, height: 38, alignItems: 'center', justifyContent: 'center', margin: { right: 10 } }}
            uiBackground={{ color: uiState.leaderboardTab === 'squad' ? C.cyan : C.cyanDim }}
            onMouseDown={() => { uiState.leaderboardTab = 'squad' }}
          >
            <Label value='⛓ SQUAD' fontSize={15} color={uiState.leaderboardTab === 'squad' ? C.insetBg : C.textWhite} font='sans-serif' />
          </UiEntity>
          <UiEntity
            uiTransform={{ width: 150, height: 38, alignItems: 'center', justifyContent: 'center' }}
            uiBackground={{ color: uiState.leaderboardTab === 'solo' ? C.purple : Color4.create(0.20, 0.10, 0.30, 1.0) }}
            onMouseDown={() => { uiState.leaderboardTab = 'solo' }}
          >
            <Label value='🤖 SOLO' fontSize={15} color={uiState.leaderboardTab === 'solo' ? C.textWhite : C.textMuted} font='sans-serif' />
          </UiEntity>
        </UiEntity>
      </UiEntity>

      {/* Content */}
      <UiEntity
        uiTransform={{
          width: '100%',
          flexDirection: 'column',
          padding: { left: 24, right: 24, top: 20, bottom: 24 }
        }}
      >
        {/* Leaderboard Table */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'column',
            padding: { left: 16, right: 16, top: 14, bottom: 14 },
            margin: { bottom: 20 }
          }}
          uiBackground={{ color: C.panelBg }}
        >
          {uiState.leaderboardTab === 'squad' ? (
            uiState.leaderboard.length === 0 ? (
              <Label
                value='No squad records yet. Form a squad and climb to claim #1!'
                fontSize={16}
                color={C.textMuted}
                font='sans-serif'
                uiTransform={{ margin: { top: 16, bottom: 16 } }}
              />
            ) : (
              uiState.leaderboard.slice(0, 6).map((entry, i) => {
                const entryColor = i === 0 ? C.gold : i === 1 ? C.cyan : i === 2 ? C.orange : C.textWhite
                const medalIcon =
                  i === 0
                    ? 'assets/icons/crown.png'
                    : i === 1 || i === 2
                      ? 'assets/icons/medal.png'
                      : 'assets/icons/user.png'
                return (
                  <UiEntity
                    key={`modal-lb-${i}`}
                    uiTransform={{
                      width: '100%',
                      height: 44,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: { top: 8, bottom: 8, left: 10, right: 10 }
                    }}
                    uiBackground={{ color: i % 2 === 1 ? Color4.create(0.08, 0.12, 0.22, 0.55) : C.transparent }}
                  >
                    <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Icon src={medalIcon} size={22} color={entryColor} margin={{ right: 10 }} />
                      <Label value={`#${i + 1}  ${entry.displayName}`} fontSize={17} color={entryColor} font='sans-serif' />
                    </UiEntity>
                    <Label
                      value={`${entry.teamScore} PTS  (${entry.maxAltitude}M)`}
                      fontSize={17}
                      color={i === 0 ? C.gold : C.textDim}
                      font='monospace'
                    />
                  </UiEntity>
                )
              })
            )
          ) : (
            uiState.soloLeaderboard.length === 0 ? (
              <Label
                value='No solo records yet. Start a practice run to set the first!'
                fontSize={16}
                color={C.textMuted}
                font='sans-serif'
                uiTransform={{ margin: { top: 16, bottom: 16 } }}
              />
            ) : (
              uiState.soloLeaderboard.slice(0, 6).map((entry, i) => {
                const entryColor = i === 0 ? C.purple : i === 1 ? C.cyan : C.textWhite
                return (
                  <UiEntity
                    key={`solo-lb-${i}`}
                    uiTransform={{
                      width: '100%',
                      height: 44,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: { top: 8, bottom: 8, left: 10, right: 10 }
                    }}
                    uiBackground={{ color: i % 2 === 1 ? Color4.create(0.12, 0.06, 0.22, 0.55) : C.transparent }}
                  >
                    <Label value={`#${i + 1}  ${entry.displayName}`} fontSize={17} color={entryColor} font='sans-serif' />
                    <Label
                      value={`${entry.soloScore} PTS  (${entry.maxAltitude}M)`}
                      fontSize={17}
                      color={i === 0 ? C.purple : C.textDim}
                      font='monospace'
                    />
                  </UiEntity>
                )
              })
            )
          )}
        </UiEntity>

        {/* Close Button */}
        <UiEntity
          uiTransform={{
            width: '100%',
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          uiBackground={{ color: C.cyan }}
          onMouseDown={() => {
            uiState.showLeaderboardModal = false
          }}
        >
          <Icon src='assets/icons/x.png' size={22} color={C.insetBg} margin={{ right: 10 }} />
          <Label value='CLOSE LEADERBOARD' fontSize={18} color={C.insetBg} font='sans-serif' />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  </UiEntity>
)

// ─── Standalone How To Play Modal ─────────────────────────────────────────────
const HowToPlayModal = () => (
  <UiEntity
    uiTransform={{
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }}
    uiBackground={{ color: C.bgBackdrop }}
  >
    <UiEntity
      uiTransform={{
        width: 640,
        flexDirection: 'column',
        alignItems: 'center'
      }}
      uiBackground={{ color: C.cardBg }}
    >
      {/* Textured Header */}
      <UiEntity
        uiTransform={{
          width: '100%',
          flexDirection: 'column',
          alignItems: 'center',
          padding: { top: 24, bottom: 18, left: 24, right: 24 }
        }}
        uiBackground={{
          texture: { src: TEXTURES.headerBg },
          textureMode: 'stretch'
        }}
      >
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { bottom: 4 } }}>
          <Icon src='assets/icons/info.png' size={32} color={C.cyan} margin={{ right: 12 }} />
          <Label value='HOW TO PLAY CHAINMATES' fontSize={30} color={C.cyan} font='sans-serif' />
        </UiEntity>
        <Label
          value='MASTER CO-OP CLIMBING & OUTRUN THE ELECTRIC VOID'
          fontSize={15}
          color={C.textDim}
          font='sans-serif'
        />
      </UiEntity>

      {/* Content: 3 Step Cards */}
      <UiEntity
        uiTransform={{
          width: '100%',
          flexDirection: 'column',
          padding: { left: 24, right: 24, top: 18, bottom: 22 }
        }}
      >
        {/* Step 1 */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            padding: { left: 16, right: 16, top: 14, bottom: 14 },
            margin: { bottom: 12 }
          }}
          uiBackground={{ color: C.panelBg }}
        >
          <Icon src='assets/icons/users.png' size={32} color={C.emerald} margin={{ right: 16 }} />
          <UiEntity uiTransform={{ flexDirection: 'column', width: '85%' }}>
            <Label value='1. PAIR UP OR PRACTICE SOLO' fontSize={17} color={C.emerald} font='sans-serif' />
            <Label
              value='Invite any player in the lounge to form a tether squad, or tap SOLO PRACTICE to climb with the AI Ball Droid.'
              fontSize={15}
              color={C.textDim}
              font='sans-serif'
            />
          </UiEntity>
        </UiEntity>

        {/* Step 2 */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            padding: { left: 16, right: 16, top: 14, bottom: 14 },
            margin: { bottom: 12 }
          }}
          uiBackground={{ color: C.panelBg }}
        >
          <Icon src='assets/icons/link.png' size={32} color={C.gold} margin={{ right: 16 }} />
          <UiEntity uiTransform={{ flexDirection: 'column', width: '85%' }}>
            <Label value={`2. RESPECT THE ${MAX_CHAIN_LENGTH.toFixed(1)}M TETHER`} fontSize={17} color={C.gold} font='sans-serif' />
            <Label
              value={`You are physically chained! Coordinate jumps across oscillating platforms. Exceeding ${MAX_CHAIN_LENGTH.toFixed(1)}m triggers an elastic yank.`}
              fontSize={15}
              color={C.textDim}
              font='sans-serif'
            />
          </UiEntity>
        </UiEntity>

        {/* Step 3 */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            padding: { left: 16, right: 16, top: 14, bottom: 14 },
            margin: { bottom: 18 }
          }}
          uiBackground={{ color: C.panelBg }}
        >
          <Icon src='assets/icons/zap.png' size={32} color={C.purple} margin={{ right: 16 }} />
          <UiEntity uiTransform={{ flexDirection: 'column', width: '85%' }}>
            <Label value='3. ESCAPE THE ELECTRIC VOID' fontSize={17} color={C.purple} font='sans-serif' />
            <Label
              value='Molten void energy accelerates upward as you climb. Falling into the void ends your run and posts your team score.'
              fontSize={15}
              color={C.textDim}
              font='sans-serif'
            />
          </UiEntity>
        </UiEntity>

        {/* Got It Button */}
        <UiEntity
          uiTransform={{
            width: '100%',
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          uiBackground={{ color: C.cyan }}
          onMouseDown={() => {
            uiState.showHowToPlayModal = false
          }}
        >
          <Icon src='assets/icons/play.png' size={20} color={C.insetBg} margin={{ right: 10 }} />
          <Label value="GOT IT — LET'S CLIMB!" fontSize={18} color={C.insetBg} font='sans-serif' />
        </UiEntity>
      </UiEntity>
    </UiEntity>
  </UiEntity>
)

// ─── 1. LOBBY SCREEN ──────────────────────────────────────────────────────────
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
        padding: 20
      }}
    >
      {/* Central Modal Card */}
      <UiEntity
        uiTransform={{
          width: 640,
          flexDirection: 'column',
          alignItems: 'center'
        }}
        uiBackground={{ color: C.cardBg }}
      >
        {/* Textured Header */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            padding: { top: 22, bottom: 18, left: 24, right: 24 }
          }}
          uiBackground={{
            texture: { src: TEXTURES.headerBg },
            textureMode: 'stretch'
          }}
        >
          <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { bottom: 4 } }}>
            <Icon src='assets/icons/link.png' size={36} color={C.cyan} margin={{ right: 12 }} />
            <Label value='CHAINMATES' fontSize={40} color={C.cyan} font='sans-serif' />
          </UiEntity>
          <Label
            value='CO-OP ENDLESS CLIMB // SQUAD HAVEN'
            fontSize={20}
            color={C.textDim}
            font='sans-serif'
          />
        </UiEntity>

        {/* Card Content Area */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'column',
            padding: { left: 24, right: 24, top: 20, bottom: 24 }
          }}
        >
          {/* Incoming Invite Notification */}
          {gameState.pendingInvite && !isPaired && (
            <UiEntity
              uiTransform={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: { left: 16, right: 14, top: 12, bottom: 12 },
                margin: { bottom: 16 }
              }}
              uiBackground={{ color: Color4.create(0.04, 0.28, 0.14, 0.98) }}
            >
              <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon src='assets/icons/bell.png' size={26} color={C.emerald} margin={{ right: 12 }} />
                <UiEntity uiTransform={{ flexDirection: 'column' }}>
                  <Label value='SQUAD INVITATION' fontSize={13} color={C.emerald} font='sans-serif' />
                  <Label value={`from ${gameState.pendingInvite.fromName}`} fontSize={18} color={C.textWhite} font='sans-serif' />
                </UiEntity>
              </UiEntity>

              <Button
                value='ACCEPT'
                variant='primary'
                uiTransform={{ width: 124, height: 46 }}
                uiBackground={{ color: C.emerald }}
                fontSize={16}
                color={C.insetBg}
                onMouseDown={() => acceptTether(gameState.pendingInvite!.fromId)}
              />
            </UiEntity>
          )}

          {/* Squad Status or Partner Browser */}
          {isPaired ? (
            <UiEntity
              uiTransform={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: { left: 18, right: 16, top: 14, bottom: 14 },
                margin: { bottom: 18 }
              }}
              uiBackground={{ color: Color4.create(0.04, 0.22, 0.12, 0.95) }}
            >
              <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
                <Icon src='assets/icons/link.png' size={28} color={C.emerald} margin={{ right: 12 }} />
                <UiEntity uiTransform={{ flexDirection: 'column' }}>
                  <Label value='SQUAD LINKED' fontSize={13} color={C.emerald} font='sans-serif' />
                  <Label
                    value={`${gameState.localName} & ${gameState.partnerName}`}
                    fontSize={19}
                    color={C.textWhite}
                    font='sans-serif'
                  />
                </UiEntity>
              </UiEntity>

              <Button
                value='DISCONNECT'
                variant='primary'
                uiTransform={{ width: 130, height: 44 }}
                uiBackground={{ color: C.red }}
                fontSize={15}
                color={C.textWhite}
                onMouseDown={leaveSquad}
              />
            </UiEntity>
          ) : (
            <UiEntity
              uiTransform={{
                width: '100%',
                flexDirection: 'column',
                padding: { left: 16, right: 16, top: 14, bottom: 14 },
                margin: { bottom: 18 }
              }}
              uiBackground={{ color: C.panelBg }}
            >
              <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { bottom: 10 } }}>
                <Icon src='assets/icons/users.png' size={20} color={C.cyan} margin={{ right: 8 }} />
                <Label
                  value={
                    gameState.outgoingInviteTo
                      ? `INVITE SENT: WAITING FOR ${gameState.outgoingInviteTo.name.toUpperCase()}...`
                      : 'AVAILABLE CLIMBERS IN SCENE'
                  }
                  fontSize={14}
                  color={gameState.outgoingInviteTo ? C.gold : C.cyan}
                  font='sans-serif'
                />
              </UiEntity>

              {availablePlayers.length === 0 ? (
                <Label
                  value='No other players nearby. Waiting for climbers to enter scene...'
                  fontSize={15}
                  color={C.textMuted}
                  font='sans-serif'
                  uiTransform={{ margin: { top: 6, bottom: 6 } }}
                />
              ) : (
                availablePlayers.slice(0, 3).map((p) => {
                  const invited = gameState.outgoingInviteTo?.id === p.id
                  return (
                    <UiEntity
                      key={`p-${p.id}`}
                      uiTransform={{
                        width: '100%',
                        height: 48,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: { top: 4, bottom: 4 }
                      }}
                    >
                      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Icon src='assets/icons/user.png' size={20} color={C.textDim} margin={{ right: 10 }} />
                        <Label value={p.displayName} fontSize={17} color={C.textWhite} font='sans-serif' />
                      </UiEntity>
                      <Button
                        value={invited ? 'INVITED...' : 'LINK TETHER'}
                        variant='primary'
                        uiTransform={{ width: 130, height: 42 }}
                        uiBackground={{ color: invited ? C.cyanDim : C.cyan }}
                        fontSize={14}
                        color={invited ? C.textMuted : C.insetBg}
                        onMouseDown={() => requestTether(p.id)}
                      />
                    </UiEntity>
                  )
                })
              )}
            </UiEntity>
          )}

          {/* Tether Skin Selector */}
          <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { bottom: 8 } }}>
            <Icon src='assets/icons/palette.png' size={18} color={C.textMuted} margin={{ right: 8 }} />
            <Label value='TETHER MATERIAL' fontSize={14} color={C.textMuted} font='sans-serif' />
          </UiEntity>

          <UiEntity
            uiTransform={{
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'space-between',
              margin: { bottom: 16 }
            }}
          >
            {[
              { icon: 'assets/icons/link.png', label: 'IRON CHAIN', idx: 0, swatch: Color4.create(0.65, 0.65, 0.65, 1) },
              { icon: 'assets/icons/rope.png', label: 'ROPE FIBER', idx: 1, swatch: Color4.create(0.60, 0.38, 0.18, 1) },
              { icon: 'assets/icons/sparkles.png', label: 'NEON BEAM', idx: 2, swatch: Color4.create(0.12, 0.85, 1.00, 1) }
            ].map((s) => (
              <UiEntity
                key={`skin-${s.idx}`}
                uiTransform={{
                  width: 180,
                  height: 50,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: { left: 8, right: 8 }
                }}
                uiBackground={{ color: uiState.selectedSkin === s.idx ? C.cyan : C.cyanDim }}
                onMouseDown={() => {
                  uiState.selectedSkin = s.idx
                  gameState.tetherSkinIndex = s.idx
                  setChainSkin(s.idx)
                }}
              >
                {/* Color swatch dot */}
                <UiEntity
                  uiTransform={{ width: 14, height: 14, margin: { right: 8 } }}
                  uiBackground={{ color: s.swatch }}
                />
                <Label
                  value={s.label}
                  fontSize={15}
                  color={uiState.selectedSkin === s.idx ? C.insetBg : C.textWhite}
                  font='sans-serif'
                />
              </UiEntity>
            ))}
          </UiEntity>

          {/* Rules & Gameplay Quick-Tip */}
          <UiEntity
            uiTransform={{
              width: '100%',
              flexDirection: 'row',
              alignItems: 'center',
              padding: { left: 16, right: 16, top: 10, bottom: 10 },
              margin: { bottom: 18 }
            }}
            uiBackground={{ color: C.subPanel }}
          >
            <Icon src='assets/icons/info.png' size={20} color={C.gold} margin={{ right: 10 }} />
            <Label
              value={`Max chain reach is ${MAX_CHAIN_LENGTH.toFixed(1)}m. Coordinate jumps to prevent yanks & avoid the rising void!`}
              fontSize={14}
              color={C.textDim}
              font='sans-serif'
            />
          </UiEntity>

          {/* Action Row: Leaderboard Button & Start Button */}
          <UiEntity
            uiTransform={{
              width: '100%',
              flexDirection: 'column',
              margin: { bottom: 4 }
            }}
          >
            {/* Utility Row: Leaderboard, How To Play & Music Toggle Buttons */}
            <UiEntity
              uiTransform={{
                width: '100%',
                flexDirection: 'row',
                justifyContent: 'space-between',
                margin: { bottom: 12 }
              }}
            >
              {/* Leaderboard Button */}
              <UiEntity
                uiTransform={{
                  width: '38%',
                  height: 50,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                uiBackground={{ color: C.panelBg }}
                onMouseDown={() => {
                  uiState.showLeaderboardModal = true
                }}
              >
                <Icon src='assets/icons/crown.png' size={20} color={C.gold} margin={{ right: 8 }} />
                <Label value='LEADERBOARD' fontSize={14} color={C.gold} font='sans-serif' />
              </UiEntity>

              {/* How To Play Button */}
              <UiEntity
                uiTransform={{
                  width: '34%',
                  height: 50,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                uiBackground={{ color: C.panelBg }}
                onMouseDown={() => {
                  unlockAudio()
                  uiState.showHowToPlayModal = true
                }}
              >
                <Icon src='assets/icons/info.png' size={18} color={C.cyan} margin={{ right: 8 }} />
                <Label value='GUIDE' fontSize={14} color={C.cyan} font='sans-serif' />
              </UiEntity>

              {/* Music Toggle Button */}
              <UiEntity
                uiTransform={{
                  width: '24%',
                  height: 50,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                uiBackground={{ color: C.panelBg }}
                onMouseDown={() => {
                  uiState.musicEnabled = toggleBgMusic()
                }}
              >
                <Icon
                  src={uiState.musicEnabled ? 'assets/icons/music.png' : 'assets/icons/music-off.png'}
                  size={20}
                  color={uiState.musicEnabled ? C.emerald : C.textMuted}
                  margin={{ right: 8 }}
                />
                <Label
                  value={uiState.musicEnabled ? 'ON' : 'OFF'}
                  fontSize={14}
                  color={uiState.musicEnabled ? C.emerald : C.textMuted}
                  font='sans-serif'
                />
              </UiEntity>
            </UiEntity>

            {/* Primary Co-op Action Button */}
            <Button
              value={
                isPaired
                  ? 'START SQUAD CLIMB'
                  : gameState.outgoingInviteTo
                    ? 'WAITING FOR PARTNER TO ACCEPT...'
                    : 'LINK WITH A PARTNER TO CLIMB'
              }
              variant='primary'
              uiTransform={{ width: '100%', height: 62, margin: { bottom: 12 } }}
              uiBackground={{ color: isPaired ? C.emerald : Color4.create(0.16, 0.20, 0.30, 0.6) }}
              fontSize={20}
              color={isPaired ? C.insetBg : C.textMuted}
              onMouseDown={() => {
                unlockAudio()
                if (isPaired) startRun()
              }}
            />

            {/* Solo Practice Button — always available */}
            <UiEntity
              uiTransform={{
                width: '100%',
                height: 52,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              uiBackground={{ color: Color4.create(0.10, 0.08, 0.22, 0.92) }}
              onMouseDown={() => {
                unlockAudio()
                startPractice()
              }}
            >
              <Icon src='assets/icons/user.png' size={20} color={C.purple} margin={{ right: 10 }} />
              <Label value='SOLO PRACTICE RUN' fontSize={17} color={C.purple} font='sans-serif' />
            </UiEntity>
          </UiEntity>
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

// ─── 2. COUNTDOWN SCREEN ──────────────────────────────────────────────────────
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
    <UiEntity
      uiTransform={{
        flexDirection: 'column',
        alignItems: 'center',
        padding: { left: 80, right: 80, top: 40, bottom: 40 }
      }}
      uiBackground={{ color: C.cardBg }}
    >
      <Label value='GET READY TO CLIMB' fontSize={20} color={C.textMuted} font='sans-serif' uiTransform={{ margin: { bottom: 8 } }} />
      <Label
        value={uiState.countdown > 0 ? `${uiState.countdown}` : 'CLIMB!'}
        fontSize={uiState.countdown > 0 ? 128 : 76}
        color={uiState.countdown > 0 ? C.gold : C.emerald}
        font='sans-serif'
      />
      <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { top: 14 } }}>
        <Icon src='assets/icons/flame.png' size={24} color={C.orange} margin={{ right: 10 }} />
        <Label
          value='VOID IS RISING — STAY CHAINED & ASCEND!'
          fontSize={18}
          color={C.orange}
          font='sans-serif'
        />
      </UiEntity>
      {gameState.partnerName !== '' && (
        <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { top: 10 } }}>
          <Icon src='assets/icons/link.png' size={20} color={C.textDim} margin={{ right: 8 }} />
          <Label
            value={`${gameState.localName} & ${gameState.partnerName}`}
            fontSize={16}
            color={C.textDim}
            font='sans-serif'
          />
        </UiEntity>
      )}
    </UiEntity>
  </UiEntity>
)

// ─── Static Tokens & Styles for Plain Vertical Void Gauge (Zero Allocation) ───
const BAR_TRACK_BG = Color4.create(0.02, 0.04, 0.10, 0.75)
const BAR_FILL_CYAN = Color4.create(0.12, 0.85, 1.0, 0.90)
const BAR_FILL_AMBER = Color4.create(1.0, 0.65, 0.10, 0.95)
const BAR_FILL_RED = Color4.create(1.0, 0.18, 0.22, 0.98)

const BG_TRACK = { color: BAR_TRACK_BG }
const BG_FILL_CYAN = { color: BAR_FILL_CYAN }
const BG_FILL_AMBER = { color: BAR_FILL_AMBER }
const BG_FILL_RED = { color: BAR_FILL_RED }

const VOID_BAR_ROOT_STYLE = {
  positionType: 'absolute' as const,
  position: { right: 14, top: 200 },
  flexDirection: 'column' as const,
  alignItems: 'center' as const
}

const VOID_BAR_LABEL_STYLE = { margin: { bottom: 4 } }

const VOID_BAR_TRACK_STYLE = {
  width: 14,
  height: 140,
  flexDirection: 'column' as const,
  justifyContent: 'flex-end' as const,
  alignItems: 'center' as const,
  padding: 1
}

// ─── Plain Vertical Neon Void Progress Bar with Zero-Allocation Styles ────────
const PlainVerticalVoidBar = (props: { voidGap: number; isNear: boolean }) => {
  // Map void gap (0m to 8m) to vertical fill height (6px to 134px out of 140px track)
  const normalizedGap = Math.max(0, Math.min(props.voidGap / 8.0, 1.0))
  const fillHeight = Math.round(((1.0 - normalizedGap) * 128 + 6) / 4) * 4

  const fillBg = props.isNear
    ? BG_FILL_RED
    : props.voidGap < 4.0
      ? BG_FILL_AMBER
      : BG_FILL_CYAN

  return (
    <UiEntity uiTransform={VOID_BAR_ROOT_STYLE}>
      {/* Top Label */}
      <Label
        value='VOID'
        fontSize={14}
        color={C.textMuted}
        font='monospace'
        uiTransform={VOID_BAR_LABEL_STYLE}
      />

      {/* Track & Dynamic Fill */}
      <UiEntity
        uiTransform={VOID_BAR_TRACK_STYLE}
        uiBackground={BG_TRACK}
      >
        <UiEntity
          uiTransform={{
            width: 12,
            height: fillHeight
          }}
          uiBackground={fillBg}
        />
      </UiEntity>
    </UiEntity>
  )
}

// ─── 3. RUNNING HUD ───────────────────────────────────────────────────────────
const RunningHud = () => {
  const lavaDist = Math.max(0, Math.round((gameState.currentAltitude + 2.0 - gameState.lavaHeight) * 10) / 10)
  const lavaNear = lavaDist < 2.2 && gameState.currentElapsedMs > 6000
  // const tension = tetherState.tension

  // Tension badge info
  // const tensionInfo =
  //   tension === 'YANKED'
  //     ? { icon: 'assets/icons/zap.png', label: 'TETHER YANKED', color: C.red, bg: C.redDark }
  //     : tension === 'TAUT'
  //       ? { icon: 'assets/icons/alert-triangle.png', label: 'TETHER TAUT', color: C.gold, bg: Color4.create(0.35, 0.25, 0.02, 0.95) }
  //       : { icon: 'assets/icons/check.png', label: 'SLACK (OK)', color: C.emerald, bg: Color4.create(0.02, 0.20, 0.08, 0.85) }

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: { top: 16 }
      }}
    >

      {/* Plain Minimalist Vertical Void Gauge (2 Nodes / 0 Text) */}
      <PlainVerticalVoidBar voidGap={lavaDist} isNear={lavaNear} />

      {/* Main Top Modular HUD Ribbon */}
      <UiEntity
        uiTransform={{
          flexDirection: 'row',
          alignItems: 'stretch',
          padding: { left: 8, right: 8, top: 6, bottom: 6 }
        }}
        uiBackground={{ color: C.cardBg }}
      >
        <StatBox icon='assets/icons/trophy.png' label='TEAM SCORE' value={`${gameState.teamScore}`} color={C.gold} isMono={true} />
        <VDivider />
        <StatBox icon='assets/icons/mountain.png' label='ALTITUDE' value={`${gameState.currentAltitude} M`} color={C.cyan} isMono={true} />
        <VDivider />
        <StatBox icon='assets/icons/star.png' label='GEMS' value={`💎 ${gameState.gemsCollected || 0}`} color={C.emerald} isMono={true} />
        <VDivider />
        <StatBox icon='assets/icons/clock.png' label='TIME' value={uiState.elapsedFormatted} color={C.textWhite} isMono={true} />
      </UiEntity>

      {/* Yank Danger Flash Banner with High-Contrast Alert */}
      {uiState.yankFlash && (
        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: { left: 28, right: 28, top: 12, bottom: 12 },
            margin: { top: 10 }
          }}
          uiBackground={{ color: Color4.create(0.88, 0.08, 0.15, 0.98) }}
        >
          <Icon src='assets/icons/zap.png' size={24} color={C.textWhite} margin={{ right: 12 }} />
          <Label value='⚡ TETHER OVERSTRETCHED // REGROUP & JUMP TOGETHER!' fontSize={17} color={C.textWhite} font='sans-serif' />
        </UiEntity>
      )}

      {/* Lava Warning Banner */}
      {lavaNear && (
        <UiEntity
          uiTransform={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: { left: 24, right: 24, top: 10, bottom: 10 },
            margin: { top: 10 }
          }}
          uiBackground={{ color: Color4.create(0.55, 0.08, 0.04, 0.98) }}
        >
          <Icon src='assets/icons/flame.png' size={22} color={C.orange} margin={{ right: 10 }} />
          <Label value='DANGER: VOID RISING // CLIMB HIGHER NOW!' fontSize={17} color={C.textWhite} font='sans-serif' />
        </UiEntity>
      )}
    </UiEntity>
  )
}

// ─── 4. GAME OVER & RESULTS SCREEN ────────────────────────────────────────────
const GameOverScreen = () => {
  const tier = getTierInfo(gameState.finalAltitude)
  const isFinished = uiState.phase === 'FINISHED'
  const isSolo = gameState.isPracticeMode || gameState.partnerId === '__SOLO__' || gameState.gameOverReason?.includes('Solo')

  return (
    <UiEntity
      uiTransform={{
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20
      }}
    >
      <UiEntity
        uiTransform={{
          width: 640,
          flexDirection: 'column',
          alignItems: 'center'
        }}
        uiBackground={{ color: C.cardBg }}
      >
        {/* Textured Header */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            padding: { top: 26, bottom: 20, left: 24, right: 24 }
          }}
          uiBackground={{
            texture: { src: TEXTURES.headerBg },
            textureMode: 'stretch'
          }}
        >
          <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { bottom: 6 } }}>
            <Icon
              src={isFinished ? 'assets/icons/trophy.png' : 'assets/icons/skull.png'}
              size={36}
              color={isFinished ? C.emerald : C.red}
              margin={{ right: 12 }}
            />
            <Label
              value={isFinished ? 'CLIMB COMPLETED' : isSolo ? 'SOLO RUN OVER' : 'TEAM ELIMINATED'}
              fontSize={34}
              color={isFinished ? C.emerald : C.red}
              font='sans-serif'
            />
          </UiEntity>
          <Label
            value={gameState.gameOverReason || (isSolo ? 'Solo run ended in the void' : 'Fell into the electric abyss')}
            fontSize={16}
            color={C.textDim}
            font='sans-serif'
          />
        </UiEntity>

        {/* Content Box */}
        <UiEntity
          uiTransform={{
            width: '100%',
            flexDirection: 'column',
            padding: { left: 24, right: 24, top: 20, bottom: 24 }
          }}
        >
          {/* Stats 2x2 Grid */}
          <UiEntity
            uiTransform={{
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'space-between',
              margin: { bottom: 16 }
            }}
          >
            {/* Stat: Score */}
            <UiEntity
              uiTransform={{
                width: '48%',
                flexDirection: 'column',
                alignItems: 'center',
                padding: { top: 18, bottom: 18 }
              }}
              uiBackground={{ color: C.panelBg }}
            >
              <Icon src='assets/icons/trophy.png' size={34} color={C.gold} margin={{ bottom: 8 }} />
              <Label value={isSolo ? 'SOLO SCORE' : 'FINAL SQUAD SCORE'} fontSize={14} color={C.textMuted} font='sans-serif' />
              <Label value={`${gameState.finalScore} PTS`} fontSize={32} color={C.gold} font='monospace' />
            </UiEntity>

            {/* Stat: Max Altitude */}
            <UiEntity
              uiTransform={{
                width: '48%',
                flexDirection: 'column',
                alignItems: 'center',
                padding: { top: 18, bottom: 18 }
              }}
              uiBackground={{ color: C.panelBg }}
            >
              <Icon src='assets/icons/mountain.png' size={34} color={C.cyan} margin={{ bottom: 8 }} />
              <Label value='MAX ALTITUDE REACHED' fontSize={14} color={C.textMuted} font='sans-serif' />
              <Label value={`${gameState.finalAltitude} M`} fontSize={32} color={C.cyan} font='monospace' />
            </UiEntity>
          </UiEntity>

          {/* Tier Rank Banner */}
          <UiEntity
            uiTransform={{
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: { left: 20, right: 20, top: 14, bottom: 14 },
              margin: { bottom: 16 }
            }}
            uiBackground={{ color: C.panelBg }}
          >
            <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
              <Icon src={tier.icon} size={28} color={tier.color} margin={{ right: 12 }} />
              <Label value={tier.title} fontSize={17} color={tier.color} font='sans-serif' />
            </UiEntity>
            <UiEntity
              uiTransform={{ padding: { left: 14, right: 14, top: 6, bottom: 6 } }}
              uiBackground={{ color: C.insetBg }}
            >
              <Label value={tier.badge} fontSize={14} color={C.textMuted} font='sans-serif' />
            </UiEntity>
          </UiEntity>

          {/* Global Leaderboard */}
          <UiEntity
            uiTransform={{
              width: '100%',
              flexDirection: 'column',
              padding: { left: 16, right: 16, top: 14, bottom: 14 },
              margin: { bottom: 20 }
            }}
            uiBackground={{ color: C.panelBg }}
          >
            <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center', margin: { bottom: 10 } }}>
              <Icon src='assets/icons/crown.png' size={20} color={C.gold} margin={{ right: 8 }} />
              <Label value='TOP SQUAD CLIMBERS' fontSize={15} color={C.cyan} font='sans-serif' />
            </UiEntity>

            {uiState.leaderboard.length === 0 ? (
              <Label value='No squad records yet. Set the first record!' fontSize={15} color={C.textMuted} font='sans-serif' />
            ) : (
              uiState.leaderboard.slice(0, 4).map((entry, i) => {
                const entryColor = i === 0 ? C.gold : C.textWhite
                const medalIcon =
                  i === 0
                    ? 'assets/icons/crown.png'
                    : i === 1 || i === 2
                      ? 'assets/icons/medal.png'
                      : 'assets/icons/user.png'
                return (
                  <UiEntity
                    key={`lb-${i}`}
                    uiTransform={{
                      width: '100%',
                      height: 42,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: { top: 6, bottom: 6, left: 8, right: 8 }
                    }}
                    uiBackground={{ color: i % 2 === 1 ? Color4.create(0.08, 0.12, 0.22, 0.55) : C.transparent }}
                  >
                    <UiEntity uiTransform={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Icon src={medalIcon} size={18} color={entryColor} margin={{ right: 8 }} />
                      <Label value={entry.displayName} fontSize={16} color={entryColor} font='sans-serif' />
                    </UiEntity>
                    <Label
                      value={`${entry.teamScore} PTS (${entry.maxAltitude}M)`}
                      fontSize={16}
                      color={i === 0 ? C.gold : C.textDim}
                      font='monospace'
                    />
                  </UiEntity>
                )
              })
            )}
          </UiEntity>

          {/* Action Buttons: Rematch / Retry & Main Menu */}
          <UiEntity
            uiTransform={{
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'space-between',
              margin: { top: 6 }
            }}
          >
            {/* Main Menu Button */}
            <UiEntity
              uiTransform={{
                width: '48%',
                height: 56,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              uiBackground={{ color: Color4.create(0.12, 0.16, 0.28, 0.95) }}
              onMouseDown={resetToLobby}
            >
              <Icon src='assets/icons/users.png' size={22} color={C.textWhite} margin={{ right: 10 }} />
              <Label value='MAIN MENU' fontSize={18} color={C.textWhite} font='sans-serif' />
            </UiEntity>

            {/* Rematch / Retry Button */}
            <UiEntity
              uiTransform={{
                width: '48%',
                height: 56,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              uiBackground={{ color: isSolo ? C.purple : C.cyan }}
              onMouseDown={() => {
                if (isSolo) {
                  startPractice()
                } else {
                  rematchRun()
                }
              }}
            >
              <Icon src='assets/icons/refresh-cw.png' size={22} color={C.insetBg} margin={{ right: 10 }} />
              <Label
                value={isSolo ? 'RETRY SOLO' : '⚡ REMATCH SQUAD'}
                fontSize={18}
                color={C.insetBg}
                font='sans-serif'
              />
            </UiEntity>
          </UiEntity>
        </UiEntity>
      </UiEntity>
    </UiEntity>
  )
}

// ─── Root UI Container ────────────────────────────────────────────────────────
const ChainmatesUI = () => (
  <UiEntity
    uiTransform={{
      width: '100%',
      height: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}
    uiBackground={{ color: C.transparent }}
  >
    {uiState.showLeaderboardModal && <LeaderboardModal />}
    {uiState.showHowToPlayModal && <HowToPlayModal />}
    {!uiState.showLeaderboardModal && !uiState.showHowToPlayModal && uiState.phase === 'LOBBY' && <LobbyScreen />}
    {!uiState.showLeaderboardModal && !uiState.showHowToPlayModal && uiState.phase === 'COUNTDOWN' && <CountdownScreen />}
    {!uiState.showLeaderboardModal && !uiState.showHowToPlayModal && (uiState.phase === 'RUNNING' || uiState.phase === 'PRACTICE') && <RunningHud />}
    {!uiState.showLeaderboardModal && !uiState.showHowToPlayModal && (uiState.phase === 'GAME_OVER' || uiState.phase === 'FINISHED') && <GameOverScreen />}
  </UiEntity>
)

export function setupUi() {
  ReactEcsRenderer.setUiRenderer(ChainmatesUI, { screenInset: 'interactable' })
}