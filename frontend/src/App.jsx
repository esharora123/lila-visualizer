import { useState, useEffect, useRef } from 'react'
import MapView from './components/MapView'
import Sidebar from './components/Sidebar'
import Timeline from './components/Timeline'
import './App.css'

export default function App() {
  const [matches, setMatches]             = useState([])
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [matchData, setMatchData]         = useState(null)
  const [selectedMap, setSelectedMap]     = useState('AmbroseValley')
  const [activeLayer, setActiveLayer]     = useState('traffic')
  const [showHeatmap, setShowHeatmap]     = useState(false)
  const [heatmapData, setHeatmapData]     = useState(null)
  const [loading, setLoading]             = useState(false)

  // Timeline state
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying]     = useState(false)
  const [playSpeed, setPlaySpeed]     = useState(1)
  const [duration, setDuration]       = useState(0)
  const animFrameRef                  = useRef(null)
  const lastTickRef                   = useRef(null)

  // Load matches index on startup
  useEffect(() => {
    fetch('/data/matches_index.json')
      .then(r => r.json())
      .then(data => {
        setMatches(data)
        const hero = data.find(m => m.match_id.startsWith('b3550292'))
        if (hero) setSelectedMatch(hero.match_id)
      })
      .catch(err => console.error('Failed to load index:', err))
  }, [])

  // Load match data when selection changes
  useEffect(() => {
    if (!selectedMatch) return
    setLoading(true)
    setIsPlaying(false)
    setCurrentTime(0)

    fetch(`/data/matches/${selectedMatch}.json`)
      .then(r => r.json())
      .then(data => {
        setMatchData(data)
        setSelectedMap(data.map_id)

        // Calculate duration from events (more reliable than positions)
        const posTs    = data.positions.map(p => p.ts_ms).filter(t => t > 0)
        const eventTs  = data.events.map(e => e.ts_ms).filter(t => t > 0)
        // Duration is always 300,000ms (normalized in pipeline)
        setDuration(data.meta.duration_ms || 300000)
        setCurrentTime(maxTs) // start showing full match
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
      .then(setHeatmapData)
      .catch(() => {})
  }, [selectedMap])

  // Playback engine — runs every animation frame when playing
  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animFrameRef.current)
      lastTickRef.current = null
      return
    }

    const tick = (timestamp) => {
      if (lastTickRef.current === null) {
        lastTickRef.current = timestamp
      }

      const elapsed = timestamp - lastTickRef.current
      lastTickRef.current = timestamp

      setCurrentTime(prev => {
        const next = prev + elapsed * playSpeed * 8
        if (next >= duration) {
          setIsPlaying(false)
          return duration
        }
        return next
      })

      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isPlaying, playSpeed, duration])

  const handlePlayPause = () => {
    // If at end, restart from beginning
    if (currentTime >= duration) setCurrentTime(0)
    setIsPlaying(p => !p)
  }

  const handleSeek = (ms) => {
    setCurrentTime(ms)
    lastTickRef.current = null
  }

  const handleRestart = () => {
    setCurrentTime(0)
    setIsPlaying(true)
    lastTickRef.current = null
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-left">
          <div className="header-logo">
            <img 
              src="https://lilagames.com/wp-content/uploads/2023/05/LILA-LOGO-1-77x77.png"
              alt="Lila Games"
              style={{ height: 28, width: 28, objectFit: 'contain' }}
            />
            <span className="logo">LILA BLACK</span>
          </div>
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
              {matchData.meta.storm_deaths > 0 && (
                <span className="pill storm">
                  🌪️ {matchData.meta.storm_deaths} storm
                </span>
              )}
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
            currentTime={currentTime}
          />

          {matchData && (
            <Timeline
              duration={duration}
              currentTime={currentTime}
              isPlaying={isPlaying}
              playSpeed={playSpeed}
              matchData={matchData}
              onSeek={handleSeek}
              onPlayPause={handlePlayPause}
              onRestart={handleRestart}
              onSpeedChange={setPlaySpeed}
            />
          )}
        </main>
      </div>
    </div>
  )
}