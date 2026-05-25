'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { api, AnalysisResult } from '@/services/api'

const Map = dynamic(() => import('@/components/Map'), { ssr: false, loading: () => (
  <div className="w-full h-full flex items-center justify-center bg-[#080f0c]">
    <div className="text-emerald-600 text-sm font-mono tracking-wider">Initializing map engine...</div>
  </div>
)})

const ANALYSES = [
  { id: 'ndvi',  label: 'NDVI',          desc: 'Vegetation health',        color: '#16a34a', dataset: 'Sentinel-2' },
  { id: 'flood', label: 'Flood Mapping', desc: 'SAR water detection',      color: '#2563eb', dataset: 'Sentinel-1 SAR' },
  { id: 'lulc',  label: 'LULC',          desc: 'Land use classification',  color: '#7c3aed', dataset: 'ESA WorldCover 10m' },
]

const STEPS: Record<string, string[]> = {
  ndvi:  ['Loading Sentinel-2 imagery...','Masking clouds...','Computing NDVI...','Generating tiles...'],
  flood: ['Loading Sentinel-1 SAR...','Comparing pre/post flood...','Thresholding water...','Generating tiles...'],
  lulc:  ['Loading ESA WorldCover...','Classifying land cover...','Computing statistics...','Generating tiles...'],
}

export default function Dashboard() {
  const [analysis, setAnalysis]         = useState('ndvi')
  const [aoi, setAoi]                   = useState<any>(null)
  const [startDate, setStartDate]       = useState('2024-01-01')
  const [endDate, setEndDate]           = useState('2024-03-31')
  const [preStart, setPreStart]         = useState('2024-06-01')
  const [preEnd, setPreEnd]             = useState('2024-07-31')
  const [floodStart, setFloodStart]     = useState('2024-08-01')
  const [floodEnd, setFloodEnd]         = useState('2024-08-15')
  const [result, setResult]             = useState<AnalysisResult | null>(null)
  const [loading, setLoading]           = useState(false)
  const [step, setStep]                 = useState('')
  const [error, setError]               = useState('')
  const [geeOk, setGeeOk]             = useState<boolean | null>(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [mapCenter, setMapCenter]       = useState<[number,number] | undefined>()
  const [searching, setSearching]       = useState(false)
  const fileRef                         = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.health().then(d => setGeeOk(d.gee_connected)).catch(() => setGeeOk(false))
  }, [])

  const handleAOI = useCallback((g: any) => { setAoi(g); setResult(null); setError('') }, [])

  // Location search via OpenStreetMap Nominatim
  const searchLocation = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`)
      const data = await res.json()
      setSearchResults(data)
    } catch { setError('Search failed. Check internet connection.') }
    finally { setSearching(false) }
  }

  const selectLocation = (item: any) => {
    setMapCenter([parseFloat(item.lat), parseFloat(item.lon)])
    setSearchResults([])
    setSearchQuery(item.display_name.split(',').slice(0,2).join(','))
  }

  // Shapefile upload
  const handleShapefile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const shpjs = await import('shpjs')
      const buffer = await file.arrayBuffer()
      const geojson = await (shpjs as any).default(buffer)
      if ((window as any).__setMapAOI) (window as any).__setMapAOI(geojson)
      setError('')
    } catch {
      setError('Could not read shapefile. Make sure it is a .zip file containing .shp, .dbf, and .prj files.')
    }
    e.target.value = ''
  }

  const run = async () => {
    if (!aoi) { setError('Draw or upload an area first.'); return }
    setLoading(true); setError(''); setResult(null)
    const steps = STEPS[analysis]
    for (let i = 0; i < steps.length - 1; i++) {
      setStep(steps[i])
      await new Promise(r => setTimeout(r, 900))
    }
    setStep(steps[steps.length - 1])
    try {
      let res: AnalysisResult
      if (analysis === 'ndvi') res = await api.ndvi({ geometry: aoi, start_date: startDate, end_date: endDate })
      else if (analysis === 'flood') res = await api.flood({ geometry: aoi, flood_start: floodStart, flood_end: floodEnd, pre_flood_start: preStart, pre_flood_end: preEnd })
      else res = await api.lulc({ geometry: aoi, mode: 'quick', year: 2021 })
      setResult(res)
    } catch (e: any) { setError(e.message || 'Analysis failed.') }
    finally { setLoading(false); setStep('') }
  }

  const cur = ANALYSES.find(a => a.id === analysis)!

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#080f0c' }}>

      {/* ── SIDEBAR ── */}
      <aside className="w-[260px] flex-shrink-0 flex flex-col border-r border-[#1a3328]/60" style={{ background: '#0a1510' }}>

        {/* Logo */}
        <div className="px-4 pt-4 pb-3 border-b border-[#1a3328]/60 flex-shrink-0">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg,#1a4a35,#2d8463)' }}>🌍</div>
            <div>
              <div className="text-[13px] font-semibold text-white tracking-tight">GeoSense</div>
              <div className="text-[10px] text-emerald-700 tracking-wider uppercase">Remote Sensing</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${geeOk === null ? 'bg-yellow-500 pulse' : geeOk ? 'bg-emerald-400' : 'bg-red-500'}`} />
            <span className="text-[10px] font-mono text-emerald-700">
              {geeOk === null ? 'Connecting...' : geeOk ? 'GEE Connected' : 'GEE Offline'}
            </span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* Search */}
          <div className="px-3 py-3 border-b border-[#1a3328]/60">
            <div className="text-[10px] font-mono text-emerald-800 uppercase tracking-widest mb-2">Search Location</div>
            <div className="flex gap-1.5">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchLocation()}
                placeholder="City, country..."
                className="flex-1 bg-[#080f0c] border border-[#1a3328] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-emerald-900 focus:outline-none focus:border-emerald-700"
              />
              <button onClick={searchLocation} disabled={searching}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-900/40 border border-emerald-800/40 text-emerald-400 text-[11px] hover:bg-emerald-800/40 transition-colors">
                {searching ? '...' : '🔍'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1.5 bg-[#080f0c] border border-[#1a3328] rounded-lg overflow-hidden">
                {searchResults.map((r, i) => (
                  <button key={i} onClick={() => selectLocation(r)}
                    className="w-full text-left px-3 py-2 text-[11px] text-emerald-300 hover:bg-[#1a3328] border-b border-[#1a3328]/40 last:border-0 transition-colors">
                    {r.display_name.split(',').slice(0, 3).join(', ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Analysis type */}
          <div className="px-3 py-3 border-b border-[#1a3328]/60">
            <div className="text-[10px] font-mono text-emerald-800 uppercase tracking-widest mb-2">Analysis</div>
            {ANALYSES.map(a => (
              <button key={a.id} onClick={() => { setAnalysis(a.id); setResult(null); setError('') }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1.5 text-left transition-all border ${
                  analysis === a.id
                    ? 'bg-[#0f2019] border-[#2d8463]/60 text-white'
                    : 'border-transparent text-emerald-700 hover:bg-[#0f2019]/60 hover:text-emerald-400'
                }`}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: analysis === a.id ? a.color : '#1a3328' }} />
                <div>
                  <div className="text-[12px] font-medium">{a.label}</div>
                  <div className="text-[10px] opacity-60">{a.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* AOI */}
          <div className="px-3 py-3 border-b border-[#1a3328]/60">
            <div className="text-[10px] font-mono text-emerald-800 uppercase tracking-widest mb-2">Area of Interest</div>
            <div className={`text-[11px] flex items-center gap-2 mb-2 ${aoi ? 'text-emerald-400' : 'text-emerald-800'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${aoi ? 'bg-emerald-400' : 'bg-emerald-900'}`} />
              {aoi ? 'AOI selected ✓' : 'Use draw tools on map →'}
            </div>
            <button onClick={() => fileRef.current?.click()}
              className="w-full py-2 rounded-lg border border-dashed border-[#1a3328] text-[11px] text-emerald-700 hover:border-emerald-700 hover:text-emerald-400 transition-colors flex items-center justify-center gap-2">
              📁 Upload Shapefile (.zip)
            </button>
            <input ref={fileRef} type="file" accept=".zip" onChange={handleShapefile} className="hidden" />
          </div>

          {/* Dates */}
          <div className="px-3 py-3 border-b border-[#1a3328]/60">
            <div className="text-[10px] font-mono text-emerald-800 uppercase tracking-widest mb-2">
              {analysis === 'flood' ? 'Pre-flood Period' : 'Date Range'}
            </div>
            {analysis !== 'flood' ? (
              <div className="space-y-2">
                {[['From', startDate, setStartDate], ['To', endDate, setEndDate]].map(([l, v, s]: any) => (
                  <div key={l}>
                    <label className="text-[10px] text-emerald-800 block mb-1">{l}</label>
                    <input type="date" value={v} onChange={e => s(e.target.value)}
                      className="w-full bg-[#080f0c] border border-[#1a3328] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-700" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-[10px] text-emerald-800 mb-1.5">Pre-flood</div>
                  <input type="date" value={preStart} onChange={e => setPreStart(e.target.value)} className="w-full bg-[#080f0c] border border-[#1a3328] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-700 mb-1.5" />
                  <input type="date" value={preEnd} onChange={e => setPreEnd(e.target.value)} className="w-full bg-[#080f0c] border border-[#1a3328] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-700" />
                </div>
                <div>
                  <div className="text-[10px] text-emerald-800 mb-1.5">Flood event</div>
                  <input type="date" value={floodStart} onChange={e => setFloodStart(e.target.value)} className="w-full bg-[#080f0c] border border-[#1a3328] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-700 mb-1.5" />
                  <input type="date" value={floodEnd} onChange={e => setFloodEnd(e.target.value)} className="w-full bg-[#080f0c] border border-[#1a3328] rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-700" />
                </div>
              </div>
            )}
          </div>

          {/* Dataset */}
          <div className="px-3 py-3">
            <div className="text-[10px] font-mono text-emerald-800 uppercase tracking-widest mb-2">Dataset</div>
            <div className="bg-[#080f0c] rounded-lg px-3 py-2 border border-[#1a3328]">
              <div className="text-[12px] text-white font-medium">{cur.dataset}</div>
              <div className="text-[10px] text-emerald-800 mt-0.5">Auto-selected for {cur.label}</div>
            </div>
          </div>
        </div>

        {/* Run button — always visible at bottom */}
        <div className="px-3 py-3 border-t border-[#1a3328]/60 flex-shrink-0">
          {error && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-red-950/50 border border-red-900/50 text-red-400 text-[11px]">
              {error}
            </div>
          )}
          <button onClick={run} disabled={loading || !aoi || !geeOk}
            className={`w-full py-3 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-center gap-2 ${
              loading || !aoi || !geeOk
                ? 'bg-[#0f2019] text-emerald-800 cursor-not-allowed'
                : 'text-white cursor-pointer'
            }`}
            style={!loading && aoi && geeOk ? { background: `linear-gradient(135deg, #1a4a35, ${cur.color})`, boxShadow: `0 4px 20px ${cur.color}30` } : {}}>
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full spinner" />Processing...</>
              : <><span>▶</span> Run Analysis</>}
          </button>
          {!aoi && !loading && (
            <div className="text-[10px] text-center text-emerald-900 mt-1.5">Draw an area or upload shapefile</div>
          )}
        </div>
      </aside>

      {/* ── MAP + STATS ── */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 relative">
          <Map onAOIChange={handleAOI} tileUrl={result?.tile_url} center={mapCenter} />

          {/* Processing overlay */}
          {loading && (
            <div className="absolute inset-0 z-[2000] flex items-center justify-center" style={{ background: 'rgba(8,15,12,0.75)', backdropFilter: 'blur(8px)' }}>
              <div className="rounded-2xl p-8 flex flex-col items-center gap-4 border border-[#1a3328]" style={{ background: '#0a1510' }}>
                <div className="w-12 h-12 rounded-full border-2 border-[#1a3328] border-t-emerald-400 spinner" />
                <div className="text-[13px] text-white text-center">{step}</div>
                <div className="text-[10px] text-emerald-800 font-mono">Google Earth Engine</div>
              </div>
            </div>
          )}

          {/* Result badge */}
          {result && !loading && (
            <div className="absolute top-3 left-3 z-[1000] glass rounded-xl px-4 py-2.5 border border-[#1a3328] fade-up">
              <div className="text-[10px] text-emerald-700 uppercase tracking-widest">{result.analysis_type}</div>
              <div className="text-[12px] text-white font-medium mt-0.5">{result.dataset}</div>
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="h-[72px] border-t border-[#1a3328]/60 flex items-stretch flex-shrink-0" style={{ background: '#0a1510' }}>
          {result && !loading ? (
            <div className="flex items-stretch w-full">
              {analysis === 'ndvi' && result.statistics && <>
                <Stat label="Mean NDVI" value={result.statistics.mean_ndvi?.toFixed(3)} />
                <Stat label="Area" value={`${result.area_km2} km²`} />
                <Stat label="Scenes" value={result.scenes_used} />
                <Stat label="Interpretation" value={result.interpretation} wide />
              </>}
              {analysis === 'flood' && result.statistics && <>
                <Stat label="Flooded Area" value={`${result.statistics.flooded_area_km2} km²`} />
                <Stat label="AOI Area" value={`${result.statistics.total_aoi_km2} km²`} />
                <Stat label="Flood %" value={`${result.statistics.flood_percentage}%`} />
                <Stat label="Interpretation" value={result.interpretation} wide />
              </>}
              {analysis === 'lulc' && result.class_statistics && <>
                <Stat label="Total Area" value={`${result.total_area_km2} km²`} />
                <Stat label="Dominant Class" value={result.class_statistics[0]?.class_name} />
                <Stat label="Classes" value={result.class_statistics.length} />
                <Stat label="Interpretation" value={result.interpretation} wide />
              </>}
            </div>
          ) : (
            <div className="flex items-center justify-center w-full text-[11px] font-mono text-emerald-900">
              {loading ? step : '— Draw an area → select analysis → run —'}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Stat({ label, value, wide }: { label: string; value: any; wide?: boolean }) {
  return (
    <div className={`flex flex-col justify-center px-4 border-r border-[#1a3328]/60 fade-up ${wide ? 'flex-1' : 'min-w-[130px]'}`}>
      <div className="text-[9px] font-mono text-emerald-800 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-[12px] text-white font-medium leading-tight truncate">{value ?? '—'}</div>
    </div>
  )
}
