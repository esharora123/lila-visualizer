import { useRef, useEffect, useState } from 'react'

// ── Map config (mirrors Python pipeline) ──────────────
const MAP_CONFIG = {
  AmbroseValley: { scale: 900,  originX: -370, originZ: -473 },
  GrandRift:     { scale: 581,  originX: -290, originZ: -290 },
  Lockdown:      { scale: 1000, originX: -500, originZ: -500 },
}

const MINIMAP_FILES = {
  AmbroseValley: '/minimaps/AmbroseValley_Minimap.png',
  GrandRift:     '/minimaps/GrandRift_Minimap.png',
  Lockdown:      '/minimaps/Lockdown_Minimap.jpg',
}

// Event display config
const EVENT_CONFIG = {
  Kill:           { color: '#ff3333', size: 10, label: '⚔️ Kill' },
  Killed:         { color: '#ff8800', size: 10, label: '💀 Death' },
  BotKill:        { color: '#cc44ff', size: 7,  label: '🤖 Bot Kill' },
  BotKilled:      { color: '#ff44aa', size: 7,  label: '🤖 Killed by Bot' },
  KilledByStorm:  { color: '#00ffff', size: 12, label: '🌪️ Storm Death' },
  Loot:           { color: '#ffd700', size: 6,  label: '📦 Loot' },
}

const HEATMAP_COLORS = {
  kills:   (t) => `rgba(255, ${Math.floor(30*(1-t))}, 30, ${t * 0.9})`,
  deaths:  (t) => `rgba(255, ${Math.floor(140*t)}, 0, ${t * 0.85})`,
  loot:    (t) => `rgba(255, ${Math.floor(180 + 75*t)}, 0, ${t * 0.85})`,
  traffic: (t) => `rgba(30, ${Math.floor(100 + 155*t)}, 255, ${t * 0.8})`,
  storm:   (t) => `rgba(180, 0, 255, ${t * 0.9})`,
}

function worldToCanvas(x, z, mapId, canvasSize) {
  const cfg = MAP_CONFIG[mapId]
  if (!cfg) return { px: 0, py: 0 }
  const u = (x - cfg.originX) / cfg.scale
  const v = (z - cfg.originZ) / cfg.scale
  return {
    px: u * canvasSize,
    py: (1 - v) * canvasSize,
  }
}

export default function MapView({ 
  matchData, mapId, showHeatmap, heatmapData, activeLayer, currentTime 
}) { 
  const canvasRef   = useRef(null)
  const imgRef      = useRef(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [tooltip, setTooltip]     = useState(null)
  const [canvasSize, setCanvasSize] = useState(700)

  // Responsive canvas size
  useEffect(() => {
    const updateSize = () => {
      const container = canvasRef.current?.parentElement
      if (container) {
        const size = Math.min(
          container.clientWidth - 20,
          container.clientHeight - 20
        )
        setCanvasSize(Math.max(400, size))
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // Reload image when map changes
  useEffect(() => {
    setImgLoaded(false)
    const img = new Image()
    img.src = MINIMAP_FILES[mapId] || MINIMAP_FILES.AmbroseValley
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
    }
  }, [mapId])

  // Draw everything on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgLoaded) return
    const ctx = canvas.getContext('2d')
    const S = canvasSize

    canvas.width  = S
    canvas.height = S

    // 1. Draw minimap
    ctx.drawImage(imgRef.current, 0, 0, S, S)

    // 2. Darken slightly for contrast
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.fillRect(0, 0, S, S)

    // 3. Heatmap layer
    if (showHeatmap && heatmapData?.layers?.[activeLayer]) {
      const cells = heatmapData.layers[activeLayer]
      const cellPx = S / 64  // each grid cell in pixels
      const colorFn = HEATMAP_COLORS[activeLayer] || HEATMAP_COLORS.traffic

      cells.forEach(([gx, gy, intensity]) => {
      const cx = gx * cellPx
      const cy = gy * cellPx
      const radius = cellPx * 1.2

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      gradient.addColorStop(0, colorFn(intensity))
      gradient.addColorStop(1, 'transparent')

      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    })
    }

    if (!matchData) return

    // 4. Draw movement trails — only up to currentTime
    const playerPositions = {}
    matchData.positions
    .filter(pos => pos.ts_ms <= currentTime)
    .forEach(pos => {
      if (!playerPositions[pos.user_id]) 
        playerPositions[pos.user_id] = []
      playerPositions[pos.user_id].push(pos)
    })

    const playerColors = {}
    matchData.players.forEach(p => {
      playerColors[p.user_id] = p.color
    })

    // Draw trails
    Object.entries(playerPositions).forEach(([uid, positions]) => {
      const color = playerColors[uid] || '#888'
      const sorted = [...positions].sort((a, b) => a.ts_ms - b.ts_ms)

      if (sorted.length < 2) return

      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = uid.includes('-') ? 2 : 1  // thicker for humans
      ctx.globalAlpha = uid.includes('-') ? 0.8 : 0.35
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      sorted.forEach((pos, i) => {
        const { px, py } = worldToCanvas(pos.x, pos.z, mapId, S)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      })
      ctx.stroke()
      ctx.globalAlpha = 1
    })

    // 5. Draw event markers — only up to currentTime
    matchData.events
    .filter(ev => ev.ts_ms <= currentTime)
    .forEach(ev => {
      const cfg = EVENT_CONFIG[ev.event]
      if (!cfg) return
      const { px, py } = worldToCanvas(ev.x, ev.z, mapId, S)

      // Outer glow
      ctx.beginPath()
      ctx.arc(px, py, cfg.size + 3, 0, Math.PI * 2)
      ctx.fillStyle = cfg.color + '33'
      ctx.fill()

      // Inner dot
      ctx.beginPath()
      ctx.arc(px, py, cfg.size / 2, 0, Math.PI * 2)
      ctx.fillStyle = cfg.color
      ctx.fill()

      // White border
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1
      ctx.stroke()
    })

    // 6. Draw start positions (first position of each human)
    Object.entries(playerPositions).forEach(([uid, positions]) => {
      if (!uid.includes('-')) return // humans only
      const sorted = [...positions].sort((a, b) => a.ts_ms - b.ts_ms)
      if (!sorted.length) return

      const first = sorted[0]
      const { px, py } = worldToCanvas(first.x, first.z, mapId, S)
      const color = playerColors[uid] || '#00d4ff'

      ctx.beginPath()
      ctx.arc(px, py, 6, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
    })

  }, [matchData, mapId, showHeatmap, heatmapData, 
      activeLayer, imgLoaded, canvasSize, currentTime])

  // Tooltip on hover
  const handleMouseMove = (e) => {
    if (!matchData || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const S = canvasSize

    // Check if near any event
    for (const ev of matchData.events) {
      const { px, py } = worldToCanvas(ev.x, ev.z, mapId, S)
      const dist = Math.hypot(px - mx, py - my)
      if (dist < 12) {
        setTooltip({
          x: e.clientX, y: e.clientY,
          event: ev.event,
          label: EVENT_CONFIG[ev.event]?.label || ev.event,
          color: EVENT_CONFIG[ev.event]?.color || '#fff',
        })
        return
      }
    }
    setTooltip(null)
  }

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100%', 
      width: '100%', 
      position: 'relative' 
    }}>
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        style={{ 
          borderRadius: 8, 
          boxShadow: '0 0 40px rgba(0,212,255,0.15)',
          cursor: 'crosshair',
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 12,
          top: tooltip.y - 8,
          background: '#0f0f1a',
          border: `1px solid ${tooltip.color}`,
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 12,
          color: tooltip.color,
          pointerEvents: 'none',
          zIndex: 1000,
          whiteSpace: 'nowrap',
        }}>
          {tooltip.label}
        </div>
      )}

      {/* Legend */}
      <div style={{
        position: 'absolute',
        bottom: 135, right: 16,
        background: '#0f0f1acc',
        border: '1px solid #1e1e3a',
        borderRadius: 8,
        padding: '10px 14px',
        fontSize: 11,
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}>
        {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
          <div key={key} style={{ 
            display: 'flex', alignItems: 'center', gap: 6 
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: cfg.color,
              boxShadow: `0 0 4px ${cfg.color}`,
            }} />
            <span style={{ color: '#aaa' }}>{cfg.label}</span>
          </div>
        ))}
        <div style={{ 
          borderTop: '1px solid #222', 
          marginTop: 3, paddingTop: 5 
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{
              width: 20, height: 2, 
              background: '#00d4ff',
            }} />
            <span style={{ color: '#aaa' }}>Human trail</span>
          </div>
          <div style={{ 
            display:'flex', alignItems:'center', 
            gap:6, marginTop: 4 
          }}>
            <div style={{
              width: 20, height: 2, 
              background: '#888',
            }} />
            <span style={{ color: '#aaa' }}>Bot trail</span>
          </div>
        </div>
      </div>
    </div>
  )
}