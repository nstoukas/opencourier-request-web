import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import DeliveryStatusPage from '../../pages/manual-request/[deliveryId]/status'
import {
  useGetManualRequestDeliveryQuery,
  useCancelManualRequestDeliveryMutation,
} from '../../api/manualRequestApi'
import { getManualRequestApiMode } from '../../utils/manualRequestAuth'

// Spec 0028 (row 103), AC-6: the order page shows each item's mark next to its name; unmarked items and
// orders sent before row 103 look as today. Rendered from here, since no test lives under src/pages.

jest.mock('next/router', () => ({
  useRouter: () => ({ query: { deliveryId: 'del-items-103' } }),
}))

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

jest.mock('../../api/manualRequestApi', () => ({
  useGetManualRequestDeliveryQuery: jest.fn(),
  useCancelManualRequestDeliveryMutation: jest.fn(),
}))

jest.mock('../../utils/manualRequestAuth', () => ({
  getManualRequestApiMode: jest.fn(),
}))

function renderWithItems(orderItems: unknown) {
  ;(useGetManualRequestDeliveryQuery as jest.Mock).mockReturnValue({
    data: {
      id: 'del-items-103',
      status: 'ACCEPTED',
      orderReference: 'ORD-103',
      createdAt: '2026-11-03T10:00:00Z',
      orderItems,
    },
    isLoading: false,
    error: undefined,
    refetch: jest.fn(),
  })
  return render(<DeliveryStatusPage />)
}

// The item's row, found by its name.
const rowOf = (name: string) => screen.getByText(name, { exact: false }).closest('li') as HTMLElement

describe('order page item marks (spec 0028 AC-6)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(useCancelManualRequestDeliveryMutation as jest.Mock).mockReturnValue([jest.fn(), { isLoading: false }])
    ;(getManualRequestApiMode as jest.Mock).mockReturnValue('partner')
  })

  it('shows a "Drink" badge after a drink and a "Side" badge after a side', () => {
    renderWithItems([
      { name: 'Souvlaki', quantity: 2, size: 'LARGE' },
      { name: 'Cola', quantity: 3, kind: 'DRINK' },
      { name: 'Fries', quantity: 1, kind: 'SIDE' },
    ])

    const cola = rowOf('Cola')
    expect(within(cola).getByText('Drink')).toBeInTheDocument()
    expect(within(cola).queryByText('Side')).not.toBeInTheDocument()
    expect(cola).toHaveTextContent('×3')

    const fries = rowOf('Fries')
    expect(within(fries).getByText('Side')).toBeInTheDocument()
    expect(within(fries).queryByText('Drink')).not.toBeInTheDocument()
  })

  it('places the badge after the name, inside the name\'s own span', () => {
    renderWithItems([{ name: 'Cola', quantity: 1, kind: 'DRINK' }])

    const badge = screen.getByText('Drink')
    const nameSpan = badge.parentElement as HTMLElement
    expect(nameSpan.textContent).toBe('ColaDrink')
    expect(nameSpan.firstChild?.textContent).toBe('Cola')
  })

  it('an unmarked item shows no badge, as today', () => {
    renderWithItems([
      { name: 'Souvlaki', quantity: 2, size: 'LARGE' },
      { name: 'Cola', quantity: 1, kind: 'DRINK' },
    ])

    const souvlaki = rowOf('Souvlaki')
    expect(within(souvlaki).queryByText('Drink')).not.toBeInTheDocument()
    expect(within(souvlaki).queryByText('Side')).not.toBeInTheDocument()
    expect(souvlaki).toHaveTextContent('Souvlaki×2 · LARGE')
  })

  it("an old order (today's single Package item) looks as today: no badge anywhere", () => {
    renderWithItems([{ name: 'Package', quantity: 1, size: 'SMALL' }])

    expect(screen.getByText('Items')).toBeInTheDocument()
    const row = rowOf('Package')
    expect(row).toHaveTextContent('Package×1 · SMALL')
    expect(screen.queryByText('Drink')).not.toBeInTheDocument()
    expect(screen.queryByText('Side')).not.toBeInTheDocument()
    // The name span holds only the name.
    expect(within(row).getByText('Package').children).toHaveLength(0)
  })

  it('an order with no items shows no Items list', () => {
    renderWithItems(undefined)
    expect(screen.queryByText('Items')).not.toBeInTheDocument()
  })
})
