import { useState } from 'react'

const MAPS = ['AmbroseValley', 'GrandRift', 'Lockdown']

const HEATMAP_LAYERS = [
  { key: 'traffic', label: '🚶 Traffic',    desc: 'Where players spend time' },
  { key: 'kills',   label: '⚔️ Kills',      desc: 'Kill hotspots' },
  { key: 'deaths',  label: '💀 Deaths',     desc: 'Death zones' },
  { key: 'loot',    label: '📦 Loot',       desc: 'Popular loot spots' },
  { key: 'storm',   label: '🌪️ Storm',      desc: 'Storm death locations' },
]

export default function Sidebar({
  matches, selectedMatch, onSelectMatch,
  selectedMap, onSelectMap,
  showHeatmap, onToggleHeatmap,
  activeLayer, onSelectLayer,
  matchData,
}) {
  const [mapFilter, setMapFilter]     = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredMatches = matches
    .filter(m => mapFilter === 'All' || m.map_id === mapFilter)
    .filter(m => searchQuery === '' || 
      m.match_id.toLowerCase().includes(searchQuery.toLowerCase()))
    .slice(0, 150) // cap for performance

  return (
    <aside style={{
      width: 280,
      background: '#0f0f1a',
      borderRight: '1px solid #1e1e3a',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
    }}>

      {/* ── Map Filter ── */}
      <section style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e3a' }}>
        <div style={{ 
          fontSize: 10, color: '#555', 
          textTransform: 'uppercase', 
          letterSpacing: 1, marginBottom: 8 
        }}>
          Map
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['All', ...MAPS].map(map => (
            <button key={map}
              onClick={() => { 
                setMapFilter(map)
                if (map !== 'All') onSelectMap(map)
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 20,
                border: '1px solid',
                fontSize: 11,
                cursor: 'pointer',
                transition: 'all 0.15s',
                borderColor: mapFilter === map ? '#00d4ff' : '#2a2a3a',
                background:  mapFilter === map ? '#00d4ff22' : 'transparent',
                color:       mapFilter === map ? '#00d4ff' : '#666',
              }}>
              {map === 'AmbroseValley' ? 'Ambrose' : map}
            </button>
          ))}
        </div>
      </section>

      {/* ── Heatmap Controls ── */}
      <section style={{ padding: '14px 16px', borderBottom: '1px solid #1e1e3a' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 10,
        }}>
          <div style={{ 
            fontSize: 10, color: '#555', 
            textTransform: 'uppercase', letterSpacing: 1 
          }}>
            Heatmap Overlay
          </div>
          <button
            onClick={() => onToggleHeatmap(!showHeatmap)}
            style={{
              padding: '3px 10px',
              borderRadius: 20,
              border: '1px solid',
              fontSize: 11,
              cursor: 'pointer',
              borderColor: showHeatmap ? '#00d4ff' : '#333',
              background:  showHeatmap ? '#00d4ff22' : 'transparent',
              color:        showHeatmap ? '#00d4ff' : '#555',
            }}>
            {showHeatmap ? 'ON' : 'OFF'}
          </button>
        </div>

        {HEATMAP_LAYERS.map(layer => (
          <div key={layer.key}
            onClick={() => { onSelectLayer(layer.key); onToggleHeatmap(true) }}
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              marginBottom: 4,
              cursor: 'pointer',
              transition: 'all 0.15s',
              background: activeLayer === layer.key && showHeatmap 
                ? '#1a2a3a' : 'transparent',
              border: '1px solid',
              borderColor: activeLayer === layer.key && showHeatmap 
                ? '#00d4ff44' : 'transparent',
            }}>
            <div style={{ fontSize: 12, color: '#ccc' }}>{layer.label}</div>
            <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>
              {layer.desc}
            </div>
          </div>
        ))}
      </section>

      {/* ── Match List ── */}
      <section style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        flex: 1, 
        overflow: 'hidden',
        padding: '14px 16px 0',
      }}>
        <div style={{ 
          fontSize: 10, color: '#555', 
          textTransform: 'uppercase', 
          letterSpacing: 1, marginBottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>Matches</span>
          <span style={{ color: '#333' }}>{filteredMatches.length}</span>
        </div>

        <input
          placeholder="Search match ID..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            background: '#0a0a14',
            border: '1px solid #1e1e3a',
            borderRadius: 6,
            padding: '6px 10px',
            color: '#aaa',
            fontSize: 12,
            marginBottom: 8,
            outline: 'none',
            width: '100%',
          }}
        />

        <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 16 }}>
          {filteredMatches.map(match => (
            <MatchCard
              key={match.match_id}
              match={match}
              selected={match.match_id === selectedMatch}
              onClick={() => onSelectMatch(match.match_id)}
            />
          ))}
        </div>
      </section>
    </aside>
  )
}

function MatchCard({ match, selected, onClick }) {
  const mapShort = {
    AmbroseValley: 'AV',
    GrandRift: 'GR', 
    Lockdown: 'LK',
  }
  const mapColor = {
    AmbroseValley: '#00d4ff',
    GrandRift: '#ff6b35',
    Lockdown: '#7fff00',
  }
  const color = mapColor[match.map_id] || '#aaa'

  return (
    <div onClick={onClick} style={{
      padding: '8px 10px',
      borderRadius: 6,
      marginBottom: 4,
      cursor: 'pointer',
      border: '1px solid',
      transition: 'all 0.15s',
      borderColor: selected ? color : '#1e1e3a',
      background:  selected ? color + '15' : 'transparent',
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 4,
      }}>
        <span style={{ 
          fontSize: 10, fontWeight: 700, 
          color, letterSpacing: 1 
        }}>
          {mapShort[match.map_id]}
        </span>
        <span style={{ fontSize: 10, color: '#666' }}>
          {match.day?.replace('February_', 'Feb ')}
        </span>
      </div>
      <div style={{ 
        fontSize: 10, color: '#888', 
        fontFamily: 'monospace',
        marginBottom: 5,
      }}>
        {match.match_id.slice(0, 18)}...
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
        <span style={{ color: '#7fff00' }}>👤{match.human_count}</span>
        <span style={{ color: '#cc44ff' }}>⚔️{match.bot_kills}</span>
        <span style={{ color: '#ffd700' }}>📦{match.loot_count}</span>
        {match.storm_deaths > 0 && (
          <span style={{ color: '#00ffff' }}>🌪️{match.storm_deaths}</span>
        )}
      </div>
    </div>
  )
}