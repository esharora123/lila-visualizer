import { useRef } from 'react'

const SPEED_OPTIONS = [0.25, 0.5, 1, 2]

// Converts milliseconds → "2:34" format
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, '0')}`
}

// Color for each event type on the tick marks
const TICK_COLORS = {
  Kill:          '#ff3333',
  Killed:        '#ff8800',
  BotKill:       '#cc44ff',
  BotKilled:     '#ff44aa',
  KilledByStorm: '#00ffff',
  Loot:          '#ffd700',
}

export default function Timeline({
  duration, currentTime, isPlaying, playSpeed,
  matchData, onSeek, onPlayPause, onRestart, onSpeedChange,
}) {
  const trackRef = useRef(null)

  // 0 to 1 — how far through the match we are
  const progress = duration > 0 ? currentTime / duration : 0

  // ── Click on track → jump to that time ──
  const handleTrackClick = (e) => {
    if (!trackRef.current) return
    const rect  = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1,
      (e.clientX - rect.left) / rect.width
    ))
    onSeek(ratio * duration)
  }

  // ── Drag the scrubber handle ──
  const handleMouseDown = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const move = (ev) => {
      if (!trackRef.current) return
      const rect  = trackRef.current.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1,
        (ev.clientX - rect.left) / rect.width
      ))
      onSeek(ratio * duration)
    }

    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }

    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  // ── Event tick marks — one per event on the track ──
  const eventTicks = (matchData?.events || []).map(ev => ({
    ratio: duration > 0 ? ev.ts_ms / duration : 0,
    type:  ev.event,
  }))

  // ── Live counters — only count events up to currentTime ──
  const visible      = (matchData?.events || []).filter(
    ev => ev.ts_ms <= currentTime
  )
  const visibleKills = visible.filter(
    e => e.event === 'BotKill' || e.event === 'Kill'
  ).length
  const visibleLoot  = visible.filter(
    e => e.event === 'Loot'
  ).length
  const visibleStorm = visible.filter(
    e => e.event === 'KilledByStorm'
  ).length

  return (
    <div style={{
      position:   'absolute',
      bottom:     0,
      left:       0,
      right:      0,
      background: 'linear-gradient(transparent, #0a0a0fdd 30%, #0a0a0f)',
      padding:    '32px 28px 18px',
      zIndex:     20,
    }}>

      {/* ── Live event counters + timestamp ── */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           20,
        marginBottom:  10,
        fontSize:      12,
      }}>
        <span style={{ color: '#cc44ff' }}>⚔️ {visibleKills} kills</span>
        <span style={{ color: '#ffd700' }}>📦 {visibleLoot} loot</span>
        {visibleStorm > 0 && (
          <span style={{ color: '#00ffff' }}>🌪️ {visibleStorm} storm</span>
        )}
        <span style={{ color: '#fff', marginLeft: 'auto' }}>
          {formatTime(currentTime)}
          <span style={{ color: '#fff' }}> / {formatTime(duration)}</span>
        </span>
      </div>

      {/* ── Timeline track ── */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        style={{
          position:     'relative',
          height:       6,
          background:   '#1e1e3a',
          borderRadius: 3,
          cursor:       'pointer',
          marginBottom: 14,
        }}
      >
        {/* Tick marks — one per event */}
        {eventTicks.map((tick, i) => (
          <div key={i} style={{
            position:    'absolute',
            left:        `${tick.ratio * 100}%`,
            top:         -3,
            width:       2,
            height:      12,
            background:  TICK_COLORS[tick.type] || '#555',
            borderRadius: 1,
            opacity:     0.75,
            transform:   'translateX(-50%)',
            pointerEvents: 'none',
          }} />
        ))}

        {/* Progress fill — grows left to right */}
        <div style={{
          position:     'absolute',
          left:         0,
          top:          0,
          bottom:       0,
          width:        `${progress * 100}%`,
          background:   'linear-gradient(90deg, #00d4ff55, #00d4ff)',
          borderRadius: 3,
          pointerEvents: 'none',
        }} />

        {/* Scrubber handle — the draggable circle */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            position:    'absolute',
            left:        `${progress * 100}%`,
            top:         '50%',
            transform:   'translate(-50%, -50%)',
            width:       14,
            height:      14,
            background:  '#00d4ff',
            borderRadius: '50%',
            boxShadow:   '0 0 10px #00d4ff99',
            cursor:      'grab',
            zIndex:      3,
          }}
        />
      </div>

      {/* ── Controls row ── */}
      <div style={{
        display:     'flex',
        alignItems:  'center',
        gap:         8,
      }}>

        {/* Restart button */}
        <RoundBtn onClick={onRestart} title="Restart from beginning">
          ⏮
        </RoundBtn>

        {/* Play / Pause — bigger, highlighted */}
        <RoundBtn onClick={onPlayPause} primary title={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </RoundBtn>

        {/* Speed buttons */}
        <div style={{ display: 'flex', gap: 5, marginLeft: 10 }}>
          {SPEED_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              style={{
                padding:     '3px 9px',
                borderRadius: 4,
                border:      '1px solid',
                fontSize:    11,
                cursor:      'pointer',
                borderColor: playSpeed === s ? '#00d4ff' : '#2a2a3a',
                background:  playSpeed === s ? '#00d4ff22' : 'transparent',
                color:       playSpeed === s ? '#00d4ff' : '#fff',
                transition:  'all 0.15s',
              }}>
              {s}x
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Jump to end */}
        <RoundBtn onClick={() => onSeek(duration)} title="Jump to end">
          ⏭
        </RoundBtn>
      </div>
    </div>
  )
}

// ── Small reusable button component ──
function RoundBtn({ children, onClick, primary, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width:        primary ? 40 : 32,
        height:       primary ? 40 : 32,
        borderRadius: '50%',
        border:       '1px solid',
        borderColor:  primary ? '#00d4ff' : '#2a2a3a',
        background:   primary ? '#00d4ff22' : 'transparent',
        color:        primary ? '#00d4ff' : '#fff',
        fontSize:     primary ? 16 : 13,
        cursor:       'pointer',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        flexShrink:   0,
        transition:   'all 0.15s',
      }}>
      {children}
    </button>
  )
}