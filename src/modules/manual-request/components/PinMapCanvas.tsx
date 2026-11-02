// The Leaflet map behind the drop off pin (spec 0016, AC-4). Browser only: Leaflet reads `window` when it
// loads, so PinMap loads this file with next/dynamic and `ssr: false`. Tests mock this file (react-leaflet is
// ESM only and next/jest does not transform it).
'use client'

import React, { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { GeoPoint } from '../utils/orderForm'

export interface PinMapCanvasProps {
  center: GeoPoint
  zoom: number
  // Called only after the restaurant dragged the map, with the new centre (where the pin now sits).
  onUserMove: (center: GeoPoint) => void
}

// Below one millionth of a degree (about 10 cm) two centres are the same place.
const SAME_PLACE = 1e-6

function samePlace(a: GeoPoint, b: GeoPoint): boolean {
  return Math.abs(a.latitude - b.latitude) < SAME_PLACE && Math.abs(a.longitude - b.longitude) < SAME_PLACE
}

// Follows the `center` prop and reports drags. Leaflet fires `moveend` for its own setView too (a pick,
// Edit, the first draw), so only a move that began with a drag is reported: the map placing itself never
// clears the restaurant's confirmation or rewrites the point.
function CenterFollower({ center, onUserMove }: Omit<PinMapCanvasProps, 'zoom'>) {
  const map = useMap()
  const dragging = useRef(false)

  // useMapEvents = react-leaflet's hook that subscribes this component to the map's events.
  useMapEvents({
    dragstart: () => {
      dragging.current = true
    },
    moveend: () => {
      if (!dragging.current) return
      dragging.current = false
      const { lat, lng } = map.getCenter()
      onUserMove({ latitude: lat, longitude: lng })
    },
  })

  useEffect(() => {
    const current = map.getCenter()
    if (!samePlace({ latitude: current.lat, longitude: current.lng }, center)) {
      map.setView([center.latitude, center.longitude], map.getZoom(), { animate: false })
    }
  }, [center, map])

  return null
}

export function PinMapCanvas({ center, zoom, onUserMove }: PinMapCanvasProps) {
  return (
    <div className="relative h-[220px] w-full overflow-hidden rounded-md border">
      {/* Zooming keeps the centre where it is ('center'), so only a drag moves the pin's point. */}
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={zoom}
        scrollWheelZoom="center"
        touchZoom="center"
        doubleClickZoom="center"
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <CenterFollower center={center} onUserMove={onUserMove} />
      </MapContainer>
      {/* The pin stays at the centre; the map moves under it. Its tip marks the point. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 36"
        className="pointer-events-none absolute left-1/2 top-1/2 z-[1000] h-9 w-6 -translate-x-1/2 -translate-y-full"
      >
        <path
          d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"
          className="fill-primary stroke-background"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="12" r="4.5" className="fill-background" />
      </svg>
    </div>
  )
}
