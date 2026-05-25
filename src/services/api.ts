// API service — connects frontend to the FastAPI GEE backend

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface GeoJSONGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][]
}

export interface NDVIRequest {
  geometry: GeoJSONGeometry
  start_date: string
  end_date: string
  cloud_threshold?: number
}

export interface FloodRequest {
  geometry: GeoJSONGeometry
  flood_start: string
  flood_end: string
  pre_flood_start: string
  pre_flood_end: string
}

export interface LULCRequest {
  geometry: GeoJSONGeometry
  mode: 'quick' | 'custom'
  year?: number
}

export interface AnalysisResult {
  success: boolean
  tile_url?: string
  pre_flood_tile_url?: string
  analysis_type?: string
  dataset?: string
  statistics?: Record<string, any>
  class_statistics?: any[]
  area_km2?: number
  total_area_km2?: number
  scenes_used?: number
  pre_flood_scenes?: number
  flood_scenes?: number
  interpretation?: string
  message?: string
  error?: string
}

async function request<T>(endpoint: string, body: object): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.detail?.message || data?.message || 'Analysis failed')
  }
  return data
}

export const api = {
  health: () => fetch(`${API_URL}/api/health`).then(r => r.json()),
  ndvi: (body: NDVIRequest) => request<AnalysisResult>('/api/ndvi', body),
  flood: (body: FloodRequest) => request<AnalysisResult>('/api/flood', body),
  lulc: (body: LULCRequest) => request<AnalysisResult>('/api/lulc', body),
}
