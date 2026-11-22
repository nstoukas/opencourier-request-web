import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { DispatchBanner } from './DispatchBanner'
import { useDispatchStateQuery } from '../../../api/manualRequestApi'
import { createI18n } from '../../../i18n/createI18n'

// Mock useDispatchStateQuery to isolate DispatchBanner rendering logic
jest.mock('../../../api/manualRequestApi', () => ({
  useDispatchStateQuery: jest.fn(),
}))

const mockUseDispatchStateQuery = useDispatchStateQuery as jest.MockedFunction<typeof useDispatchStateQuery>

describe('DispatchBanner (spec 0014, AC-6, AC-12; row 124)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('renders nothing before the first answer (data is undefined)', () => {
    mockUseDispatchStateQuery.mockReturnValue({ data: undefined })

    const { container } = render(<DispatchBanner />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders nothing when both current and next stops are null', () => {
    mockUseDispatchStateQuery.mockReturnValue({
      data: { current: null, next: null },
    })

    const { container } = render(<DispatchBanner />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders destructive alert with "No delivery right now" when a stop is on (current)', () => {
    mockUseDispatchStateQuery.mockReturnValue({
      data: {
        current: {
          reason: 'HEAT',
          startsAt: '2026-11-01T10:00:00.000Z',
          endsAt: '2026-11-01T15:00:00.000Z',
          message: 'Delivery is stopped until 17:00 (heat).',
        },
        next: null,
      },
    })

    render(<DispatchBanner />)

    const alert = screen.getByRole('status')
    expect(alert).toBeInTheDocument()
    expect(screen.getByText('No delivery right now')).toBeInTheDocument()
    expect(screen.getByText('Delivery is stopped until 17:00 (heat).')).toBeInTheDocument()
    // OpenCourier destructive alert variant applies destructive styling
    expect(alert).toHaveClass('text-destructive')
  })

  it('renders alert with "Delivery stops soon" when a stop starts within 12 hours (only next)', () => {
    mockUseDispatchStateQuery.mockReturnValue({
      data: {
        current: null,
        next: {
          reason: 'STORM',
          startsAt: '2026-11-01T16:00:00.000Z',
          endsAt: '2026-11-01T20:00:00.000Z',
          message: 'Delivery stops today 18:00 to 22:00 (storm).',
        },
      },
    })

    render(<DispatchBanner />)

    const alert = screen.getByRole('status')
    expect(alert).toBeInTheDocument()
    expect(screen.getByText('Delivery stops soon')).toBeInTheDocument()
    expect(screen.getByText('Delivery stops today 18:00 to 22:00 (storm).')).toBeInTheDocument()
    // Default alert variant is not destructive
    expect(alert).not.toHaveClass('text-destructive')
  })

  it('prioritizes current over next when both are present', () => {
    // If both current and next are populated, the active stop takes precedence over the upcoming one
    mockUseDispatchStateQuery.mockReturnValue({
      data: {
        current: {
          reason: 'HEAT',
          startsAt: '2026-11-01T10:00:00.000Z',
          endsAt: '2026-11-01T15:00:00.000Z',
          message: 'Delivery is stopped until 17:00 (heat).',
        },
        next: {
          reason: 'STORM',
          startsAt: '2026-11-01T16:00:00.000Z',
          endsAt: '2026-11-01T20:00:00.000Z',
          message: 'Delivery stops today 18:00 to 22:00 (storm).',
        },
      },
    })

    render(<DispatchBanner />)

    const alert = screen.getByRole('status')
    expect(alert).toBeInTheDocument()
    expect(screen.getByText('No delivery right now')).toBeInTheDocument()
    expect(screen.getByText('Delivery is stopped until 17:00 (heat).')).toBeInTheDocument()
    expect(alert).toHaveClass('text-destructive')

    // Must NOT display "Delivery stops soon" when a current stop is active
    expect(screen.queryByText('Delivery stops soon')).not.toBeInTheDocument()
    expect(screen.queryByText('Delivery stops today 18:00 to 22:00 (storm).')).not.toBeInTheDocument()
  })

  it('renders coded dispatch stop sentence in Greek when messageCode is present (row 124)', () => {
    const i18nEl = createI18n('el')
    mockUseDispatchStateQuery.mockReturnValue({
      data: {
        current: {
          reason: 'HEAT',
          startsAt: '2026-11-23T10:00:00.000Z',
          endsAt: '2026-11-23T19:30:00.000Z',
          message: 'Delivery is stopped until 21:30 (heat).',
          messageCode: 'DISPATCH_STOPPED_RESTAURANT',
          messageParams: { until: '2026-11-23T19:30:00.000Z', reason: 'HEAT' },
        },
        next: null,
      },
    })

    render(
      <I18nextProvider i18n={i18nEl}>
        <DispatchBanner />
      </I18nextProvider>,
    )

    const alert = screen.getByRole('status')
    expect(alert).toBeInTheDocument()
    // Greek title
    expect(screen.getByText('Δεν γίνονται διανομές αυτή τη στιγμή')).toBeInTheDocument()
    // Greek description rendered via codedSentenceText from serverEl with Athens time and reason enum
    expect(screen.getByText(/Οι διανομές έχουν σταματήσει.*21:30.*\(καύσωνας\)\./)).toBeInTheDocument()
  })

  it('renders coded dispatch stop sentence in English when messageCode is present (row 124)', () => {
    const i18nEn = createI18n('en')
    mockUseDispatchStateQuery.mockReturnValue({
      data: {
        current: {
          reason: 'STORM',
          startsAt: '2026-11-23T10:00:00.000Z',
          endsAt: null,
          message: 'Delivery is stopped until dispatch restarts (storm).',
          messageCode: 'DISPATCH_STOPPED_RESTAURANT_OPEN',
          messageParams: { reason: 'STORM' },
        },
        next: null,
      },
    })

    render(
      <I18nextProvider i18n={i18nEn}>
        <DispatchBanner />
      </I18nextProvider>,
    )

    const alert = screen.getByRole('status')
    expect(alert).toBeInTheDocument()
    expect(screen.getByText('No delivery right now')).toBeInTheDocument()
    expect(
      screen.getByText('Delivery is stopped until dispatch restarts (storm).'),
    ).toBeInTheDocument()
  })

  it('falls back to server English message if messageCode is unknown (row 124)', () => {
    const i18nEl = createI18n('el')
    mockUseDispatchStateQuery.mockReturnValue({
      data: {
        current: {
          reason: 'OTHER',
          startsAt: '2026-11-23T10:00:00.000Z',
          endsAt: null,
          message: 'English sentence from future backend version.',
          messageCode: 'UNKNOWN_STOP_CODE_999',
          messageParams: {},
        },
        next: null,
      },
    })

    render(
      <I18nextProvider i18n={i18nEl}>
        <DispatchBanner />
      </I18nextProvider>,
    )

    expect(screen.getByText('English sentence from future backend version.')).toBeInTheDocument()
  })
})
