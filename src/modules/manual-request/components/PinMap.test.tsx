import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  PinMap,
  CONFIRM_PIN_LABEL,
  PIN_CONFIRMED_TEXT,
  PIN_HELP_TEXT,
} from './PinMap'

// Mock PinMapCanvas so react-leaflet ESM is not imported under jsdom
jest.mock('./PinMapCanvas', () => ({
  PinMapCanvas: ({ center, zoom, onUserMove }: any) => (
    <div
      data-testid="mock-pin-map-canvas"
      data-center={JSON.stringify(center)}
      data-zoom={zoom}
      onClick={() => onUserMove({ latitude: 39.363, longitude: 22.943 })}
    />
  ),
}))

describe('PinMap (/src/modules/manual-request/components/PinMap.tsx)', () => {
  const defaultCenter = { latitude: 39.3622, longitude: 22.9425 }

  it('shows the confirm button "Pin is on the entrance" when not confirmed, and calls onConfirm on click', () => {
    const onConfirm = jest.fn()
    const onMove = jest.fn()

    render(
      <PinMap
        center={defaultCenter}
        confirmed={false}
        onMove={onMove}
        onConfirm={onConfirm}
      />,
    )

    const confirmBtn = screen.getByRole('button', { name: CONFIRM_PIN_LABEL })
    expect(confirmBtn).toBeInTheDocument()
    expect(screen.queryByText(PIN_CONFIRMED_TEXT)).not.toBeInTheDocument()

    fireEvent.click(confirmBtn)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows "Pin confirmed" when confirmed, hiding the confirm button', () => {
    const onConfirm = jest.fn()
    const onMove = jest.fn()

    render(
      <PinMap
        center={defaultCenter}
        confirmed={true}
        onMove={onMove}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByText(PIN_CONFIRMED_TEXT)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: CONFIRM_PIN_LABEL })).not.toBeInTheDocument()
  })

  it('displays message when provided, and omits it when null or undefined', () => {
    const onConfirm = jest.fn()
    const onMove = jest.fn()

    const { rerender } = render(
      <PinMap
        center={defaultCenter}
        confirmed={false}
        onMove={onMove}
        onConfirm={onConfirm}
        message="Address not found. Move the map to the customer's entrance."
      />,
    )

    expect(
      screen.getByText("Address not found. Move the map to the customer's entrance."),
    ).toBeInTheDocument()

    rerender(
      <PinMap
        center={defaultCenter}
        confirmed={false}
        onMove={onMove}
        onConfirm={onConfirm}
        message={null}
      />,
    )

    expect(
      screen.queryByText("Address not found. Move the map to the customer's entrance."),
    ).not.toBeInTheDocument()
  })

  it('renders the help text and forwards canvas moves to onMove', () => {
    const onConfirm = jest.fn()
    const onMove = jest.fn()

    render(
      <PinMap
        center={defaultCenter}
        confirmed={false}
        onMove={onMove}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByText(PIN_HELP_TEXT)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('mock-pin-map-canvas'))
    expect(onMove).toHaveBeenCalledWith({ latitude: 39.363, longitude: 22.943 })
  })

  it('forwards ref to the outer container for scrolling into view', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(
      <PinMap
        ref={ref}
        center={defaultCenter}
        confirmed={false}
        onMove={jest.fn()}
        onConfirm={jest.fn()}
      />,
    )

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current).toHaveAttribute('data-testid', 'pin-map')
  })
})
