import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { PriceSendBar, BarPhase } from './PriceSendBar'
import { ManualRequestQuoteDto } from '../types'

describe('PriceSendBar (spec 0006, AC-12, AC-13)', () => {
  const sampleQuote: ManualRequestQuoteDto = {
    id: 'quote-100',
    quoteRangeFrom: 350,
    quoteRangeTo: 450,
    currency: 'EUR',
    duration: 15,
    distance: 2.4,
    distanceUnit: 'km',
    expiresAt: '2026-10-27T12:30:00.000Z',
    dropoffEta: null,
    createdAt: '2026-10-27T12:00:00.000Z',
  }

  const defaultProps = {
    phase: 'needs-price' as BarPhase,
    quote: null,
    pricedAddress: null,
    error: null,
    disabled: false,
    onSend: jest.fn(),
    onHeightChange: jest.fn(),
  }

  it('renders "Get price" button in needs-price phase with submit type', () => {
    render(<PriceSendBar {...defaultProps} phase="needs-price" />)
    const btn = screen.getByRole('button', { name: 'Get price' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('type', 'submit')
    expect(btn).not.toBeDisabled()
  })

  it('renders "Getting price…" in pricing phase, disabled with spinner', () => {
    render(<PriceSendBar {...defaultProps} phase="pricing" />)
    const btn = screen.getByRole('button', { name: /Getting price…/i })
    expect(btn).toBeDisabled()
  })

  it('renders "Send order" in priced phase, displaying price, ETA, distance, priced address and valid until', () => {
    render(
      <PriceSendBar
        {...defaultProps}
        phase="priced"
        quote={sampleQuote}
        pricedAddress="Iasonos 45, Volos, 38221, GR"
      />,
    )
    const btn = screen.getByRole('button', { name: 'Send order' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('type', 'button')

    // Price range
    expect(screen.getByText(/3[.,]50.*–.*4[.,]50/)).toBeInTheDocument()
    // ETA and distance
    expect(screen.getByText(/ETA ~15 min.*2[.,]4 km/i)).toBeInTheDocument()
    // Priced drop off address
    expect(screen.getByText('To: Iasonos 45, Volos, 38221, GR')).toBeInTheDocument()
    // Valid until
    expect(screen.getByText(/Valid until/i)).toBeInTheDocument()
  })

  it('renders single price when quoteRangeFrom equals quoteRangeTo', () => {
    const singlePriceQuote = { ...sampleQuote, quoteRangeFrom: 350, quoteRangeTo: 350 }
    render(<PriceSendBar {...defaultProps} phase="priced" quote={singlePriceQuote} pricedAddress={null} />)
    expect(screen.getByText(/3[.,]50/)).toBeInTheDocument()
    expect(screen.queryByText(/–/)).not.toBeInTheDocument()
  })

  it('AC-12: quote with no expiresAt shows no "valid until"', () => {
    const quoteNoExpiry = { ...sampleQuote, expiresAt: null }
    render(<PriceSendBar {...defaultProps} phase="priced" quote={quoteNoExpiry} pricedAddress={null} />)
    expect(screen.queryByText(/Valid until/i)).not.toBeInTheDocument()
  })

  it('AC-12: renders "This price has expired" and "Get a new price" in expired phase', () => {
    render(<PriceSendBar {...defaultProps} phase="expired" quote={sampleQuote} pricedAddress={null} />)
    expect(screen.getByText('This price has expired')).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: 'Get a new price' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('type', 'submit')
  })

  it('renders "Sending…" in sending phase, disabled', () => {
    render(<PriceSendBar {...defaultProps} phase="sending" quote={sampleQuote} pricedAddress={null} />)
    const btn = screen.getByRole('button', { name: /Sending…/i })
    expect(btn).toBeDisabled()
  })

  it('AC-13: renders error message with role="alert" in plain words', () => {
    render(
      <PriceSendBar
        {...defaultProps}
        phase="needs-price"
        error="The price could not be worked out. Try again."
      />,
    )
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('The price could not be worked out. Try again.')
  })

  it('disabled prop disables button', () => {
    render(<PriceSendBar {...defaultProps} phase="needs-price" disabled={true} />)
    expect(screen.getByRole('button', { name: 'Get price' })).toBeDisabled()
  })

  it('clicking Send order calls onSend', () => {
    const onSend = jest.fn()
    render(<PriceSendBar {...defaultProps} phase="priced" quote={sampleQuote} pricedAddress={null} onSend={onSend} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send order' }))
    expect(onSend).toHaveBeenCalledTimes(1)
  })
})
