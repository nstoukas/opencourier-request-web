import React from 'react'
import '@testing-library/jest-dom'
import { render, act, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { createI18n } from '../../../i18n/createI18n'
import { PinMapCanvas } from './PinMapCanvas'

const mockMap = {
  getCenter: jest.fn(),
  getZoom: jest.fn().mockReturnValue(17),
  setView: jest.fn(),
}

let capturedMoveend: (() => void) | null = null

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  ZoomControl: (props: any) => (
    <div
      data-testid="mock-zoom-control"
      data-zoom-in={props.zoomInTitle}
      data-zoom-out={props.zoomOutTitle}
    />
  ),
  useMap: () => mockMap,
  useMapEvents: (handlers: { moveend?: () => void }) => {
    if (handlers.moveend) {
      capturedMoveend = handlers.moveend
    }
    return null
  },
}))

describe('PinMapCanvas (/src/modules/manual-request/components/PinMapCanvas.tsx)', () => {
  const initialCenter = { latitude: 39.3622, longitude: 22.9425 }

  beforeEach(() => {
    jest.clearAllMocks()
    capturedMoveend = null
    mockMap.getZoom.mockReturnValue(17)
  })

  it('spec 0016 & review fix: moveend that ends at the center it set itself is NOT reported', () => {
    const onUserMove = jest.fn()

    render(<PinMapCanvas center={initialCenter} zoom={17} onUserMove={onUserMove} />)

    expect(capturedMoveend).not.toBeNull()

    // Moveend returns the same coordinates as placed
    mockMap.getCenter.mockReturnValue({ lat: 39.3622, lng: 22.9425 })

    act(() => {
      capturedMoveend!()
    })

    expect(onUserMove).not.toHaveBeenCalled()
  })

  it('spec 0016 & review fix: moveend that ends elsewhere is reported once, whether drag or pan', () => {
    const onUserMove = jest.fn()

    render(<PinMapCanvas center={initialCenter} zoom={17} onUserMove={onUserMove} />)

    // User moved the map (via drag, arrow keys pan, etc.) to a new location
    mockMap.getCenter.mockReturnValue({ lat: 39.365, lng: 22.945 })

    act(() => {
      capturedMoveend!()
    })

    expect(onUserMove).toHaveBeenCalledTimes(1)
    expect(onUserMove).toHaveBeenCalledWith({ latitude: 39.365, longitude: 22.945 })

    // Another moveend with the same new location should not fire onUserMove again
    act(() => {
      capturedMoveend!()
    })

    expect(onUserMove).toHaveBeenCalledTimes(1)
  })

  it('spec 0016 & review fix: a new center prop calls setView, the same one does not', () => {
    const onUserMove = jest.fn()

    const { rerender } = render(
      <PinMapCanvas center={initialCenter} zoom={17} onUserMove={onUserMove} />,
    )

    // Initial mount on initialCenter: placed.current matches center, so setView is not called
    expect(mockMap.setView).not.toHaveBeenCalled()

    // Rerender with a NEW center
    const newCenter = { latitude: 39.37, longitude: 22.95 }
    rerender(<PinMapCanvas center={newCenter} zoom={17} onUserMove={onUserMove} />)

    expect(mockMap.setView).toHaveBeenCalledTimes(1)
    expect(mockMap.setView).toHaveBeenCalledWith([39.37, 22.95], 17, { animate: false })

    // Rerender with the SAME coordinates in a new object reference: setView should NOT be called again
    rerender(
      <PinMapCanvas center={{ latitude: 39.37, longitude: 22.95 }} zoom={17} onUserMove={onUserMove} />,
    )

    expect(mockMap.setView).toHaveBeenCalledTimes(1)
  })

  it('passes translated tooltips to ZoomControl in Greek and English (nit finding)', () => {
    const elI18n = createI18n('el')
    const { rerender } = render(
      <I18nextProvider i18n={elI18n}>
        <PinMapCanvas center={initialCenter} zoom={17} onUserMove={jest.fn()} />
      </I18nextProvider>,
    )

    let zoomControl = screen.getByTestId('mock-zoom-control')
    expect(zoomControl).toHaveAttribute('data-zoom-in', 'Μεγέθυνση')
    expect(zoomControl).toHaveAttribute('data-zoom-out', 'Σμίκρυνση')

    const enI18n = createI18n('en')
    rerender(
      <I18nextProvider i18n={enI18n}>
        <PinMapCanvas center={initialCenter} zoom={17} onUserMove={jest.fn()} />
      </I18nextProvider>,
    )

    zoomControl = screen.getByTestId('mock-zoom-control')
    expect(zoomControl).toHaveAttribute('data-zoom-in', 'Zoom in')
    expect(zoomControl).toHaveAttribute('data-zoom-out', 'Zoom out')
  })
})
