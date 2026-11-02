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

// Follows the `center` prop and reports the restaurant's moves. `placed` is the last centre this
// component put the map on (the prop). Leaflet fires `moveend` for that setView too, and for a zoom,
// which keeps the centre: both end where `placed` is, so neither is reported, and the map placing itself
// never clears the restaurant's confirmation. Any other move (a drag, the arrow keys, a shift drag box
// zoom) ends somewhere else and is reported, so the point always follows what the pin shows.
function CenterFollower({ center, onUserMove }: Omit<PinMapCanvasProps, 'zoom'>) {
  const map = useMap()
  const placed = useRef<GeoPoint>(center)

  // useMapEvents = react-leaflet's hook that subscribes this component to the map's events.
  useMapEvents({
    moveend: () => {
      const { lat, lng } = map.getCenter()
      const now = { latitude: lat, longitude: lng }
      if (samePlace(now, placed.current)) return
      placed.current = now
      onUserMove(now)
    },
  })

  // Compared with the last centre set here, not the live one, so a form render during a drag never
  // snaps the map back.
  useEffect(() => {
    if (samePlace(center, placed.current)) return
    placed.current = center
    map.setView([center.latitude, center.longitude], map.getZoom(), { animate: false })
  }, [center, map])

  return null
}

export function PinMapCanvas({ center, zoom, onUserMove }: PinMapCanvasProps) {
  return (
    // `isolate` starts a stacking context, so Leaflet's own z-index values (up to 1000) stay inside this box
    // and never paint over the page's sticky header or the fixed Get price bar.
    <div
      role="group"
      aria-label="Map of the customer's entrance. Drag it, or use the arrow keys, to put the pin on the entrance."
      className="relative isolate h-[220px] w-full overflow-hidden rounded-md border"
    >
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
