import { useState, useEffect } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import './App.css'

export default function App() {
  const [matches, setMatches]           = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [matchData, setMatchData]       = useState(null)
  const [selectedMap, setSelectedMap]   = useState('AmbroseValley')
  const [activeLayer, setActiveLayer]   = useState('traffic') 
  const [showHeatmap, setShowHeatmap]   = useState(false)
  const [heatmapData, setHeatmapData]   = useState(null)
  const [loading, setLoading]           = useState(false)

  // Load matches index on startup
  useEffect(() => {
    fetch('/data/matches_index.json')
      .then(r => r.json())
      .then(data => {
        setMatches(data)
        // Auto-load hero match
        const hero = data.find(m => 
          m.match_id.startsWith('b3550292'))
        if (hero) setSelectedMatch(hero.match_id)
      })
      .catch(err => console.error('Failed to load index:', err))
  }, [])

  // Load match data when selection changes
  useEffect(() => {
    if (!selectedMatch) return
    setLoading(true)
    fetch(`/data/matches/${selectedMatch}.json`)
      .then(r => r.json())
      .then(data => {
        setMatchData(data)
        setSelectedMap(data.map_id)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load match:', err)
        setLoading(false)
      })
  }, [selectedMatch])

  // Load heatmap when map changes
  useEffect(() => {
    fetch(`/data/heatmaps/${selectedMap}.json`)
      .then(r => r.json())
      .then(data => setHeatmapData(data))
      .catch(err => console.error('Failed to load heatmap:', err))
  }, [selectedMap])

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          <span className="logo">⬡ LILA BLACK</span>
          <span className="subtitle">Level Design Analytics</span>
        </div>
        <div className="header-center">
          {matchData && (
            <div className="match-pills">
              <span className="pill map">{matchData.map_id}</span>
              <span className="pill humans">
                👤 {matchData.meta.human_count} humans
              </span>
              <span className="pill kills">
                ⚔️ {matchData.meta.botkill_count} kills
              </span>
              <span className="pill loot">
                📦 {matchData.meta.loot_count} loot
              </span>
            </div>
          )}
        </div>
        <div className="header-right">
          <span className="version">v0.1 · Tech Launch</span>
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          matches={matches}
          selectedMatch={selectedMatch}
          onSelectMatch={setSelectedMatch}
          selectedMap={selectedMap}
          onSelectMap={setSelectedMap}
          showHeatmap={showHeatmap}
          onToggleHeatmap={setShowHeatmap}
          activeLayer={activeLayer}
          onSelectLayer={setActiveLayer}
          matchData={matchData}
        />

        <main className="map-area">
          {loading && (
            <div className="loading-overlay">
              <div className="spinner" />
              <p>Loading match data...</p>
            </div>
          )}
          <MapView
            matchData={matchData}
            mapId={selectedMap}
            showHeatmap={showHeatmap}
            heatmapData={heatmapData}
            activeLayer={activeLayer}
          />
        </main>
      </div>
    </div>
  )
}