'use client'

import { useEffect, useRef, useState } from 'react'

interface MapProps {
  onAOIChange: (geojson: any) => void
  tileUrl?: string
  center?: [number, number]
}

export default function Map({ onAOIChange, tileUrl, center }: MapProps) {
  const mapRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const drawnItemsRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState({ lat: 33.6844, lng: 73.0479 })

  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current) return
    const L = require('leaflet')
    require('leaflet-draw')

    const map = L.map(containerRef.current!, {
      center: [33.6844, 73.0479],
      zoom: 7,
      zoomControl: true,
    })

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Esri World Imagery', maxZoom: 18,
    }).addTo(map)

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, opacity: 0.7,
    }).addTo(map)

    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)
    drawnItemsRef.current = drawnItems

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: { shapeOptions: { color: '#2d8463', fillColor: '#2d8463', fillOpacity: 0.15, weight: 2 } },
        rectangle: { shapeOptions: { color: '#2d8463', fillColor: '#2d8463', fillOpacity: 0.15, weight: 2 } },
        circle: false, circlemarker: false, marker: false, polyline: false,
      },
      edit: { featureGroup: drawnItems },
    })
    map.addControl(drawControl)

    map.on(L.Draw.Event.CREATED, (e: any) => {
      drawnItems.clearLayers()
      drawnItems.addLayer(e.layer)
      onAOIChange(e.layer.toGeoJSON().geometry)
    })

    map.on('mousemove', (e: any) => {
      setCoords({ lat: parseFloat(e.latlng.lat.toFixed(4)), lng: parseFloat(e.latlng.lng.toFixed(4)) })
    })

    mapRef.current = map
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  // Fly to searched location
  useEffect(() => {
    if (!mapRef.current || !center) return
    mapRef.current.flyTo(center, 10, { duration: 1.5 })
  }, [center])

  // Handle shapefile AOI from outside
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setMapAOI = (geojson: any) => {
        if (!mapRef.current || !drawnItemsRef.current) return
        const L = require('leaflet')
        drawnItemsRef.current.clearLayers()
        const layer = L.geoJSON(geojson, {
          style: { color: '#2d8463', fillColor: '#2d8463', fillOpacity: 0.15, weight: 2 }
        })
        drawnItemsRef.current.addLayer(layer)
        mapRef.current.fitBounds(layer.getBounds(), { padding: [40, 40] })
        onAOIChange(geojson.geometry || geojson)
      }
    }
  }, [onAOIChange])

  // Add GEE result tile layer
  useEffect(() => {
    if (!mapRef.current) return
    const L = require('leaflet')
    if (tileLayerRef.current) { mapRef.current.removeLayer(tileLayerRef.current); tileLayerRef.current = null }
    if (tileUrl) {
      const layer = L.tileLayer(tileUrl, { opacity: 0.82, maxZoom: 18 })
      layer.addTo(mapRef.current)
      tileLayerRef.current = layer
    }
  }, [tileUrl])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <div className="absolute bottom-3 left-3 z-[1000] glass text-[11px] font-mono px-3 py-1.5 rounded-full border border-white/10 text-emerald-400">
        {coords.lat}° N &nbsp; {coords.lng}° E
      </div>
    </div>
  )
}
