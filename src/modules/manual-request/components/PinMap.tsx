// The drop off pin the restaurant confirms on a map (spec 0016, AC-4): the map, a line of help, an optional
// message (an address the lookup did not find), and the confirm button. Used by the order form and the
// saved customer dialog.
'use client'

import React from 'react'
import dynamic from 'next/dynamic'
import { CheckCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../../admin-web-components'
import { cn } from '../../../ui-shared-utils'
import { GeoPoint, PIN_MAP_ZOOM } from '../utils/orderForm'

// next/dynamic with ssr: false = load the Leaflet map only in the browser (Leaflet needs `window`).
const PinMapCanvas = dynamic(() => import('./PinMapCanvas').then((module) => module.PinMapCanvas), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full rounded-md border bg-muted" aria-hidden="true" />,
})

// The translation keys of the pin's three fixed texts.
export const CONFIRM_PIN_LABEL = 'pin.confirm'
export const PIN_CONFIRMED_TEXT = 'pin.confirmed'
export const PIN_HELP_TEXT = 'pin.help'

export interface PinMapProps {
  center: GeoPoint
  confirmed: boolean
  // The restaurant dragged the map: the drop off point is now `center` (and no longer confirmed).
  onMove: (center: GeoPoint) => void
  onConfirm: () => void
  // Shown above the map, already translated, e.g. "Address not found. Move the map to the customer's entrance."
  message?: string | null
  // 48 px controls in the order form (spec 0006, AC-3); the dialog keeps its own sizes.
  large?: boolean
}

export const PinMap = React.forwardRef<HTMLDivElement, PinMapProps>(function PinMap(
  { center, confirmed, onMove, onConfirm, message, large = false },
  ref,
) {
  const { t } = useTranslation()
  return (
    <div ref={ref} className="space-y-2" data-testid="pin-map">
      {message ? (
        <p role="status" className="text-sm font-medium">
          {message}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">{t(PIN_HELP_TEXT)}</p>
      <PinMapCanvas center={center} zoom={PIN_MAP_ZOOM} onUserMove={onMove} />
      {confirmed ? (
        <p className={cn('flex items-center gap-2 text-sm font-medium', large && 'min-h-12 text-base')} role="status">
          <CheckCircle className="size-5 text-primary" weight="fill" aria-hidden="true" />
          {t(PIN_CONFIRMED_TEXT)}
        </p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className={cn('w-full', large && 'h-12 text-base')}
          onClick={onConfirm}
        >
          {t(CONFIRM_PIN_LABEL)}
        </Button>
      )}
    </div>
  )
})
