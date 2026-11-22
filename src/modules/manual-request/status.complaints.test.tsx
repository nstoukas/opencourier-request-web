// Spec 0052 (row 83, AC-3, AC-7): the order status page renders the RiderComplaintSection
// under Courier details once the order is delivered or cancelled, or when it has existing complaints.
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import DeliveryStatusPage from '../../pages/manual-request/[deliveryId]/status'
import {
  useGetManualRequestDeliveryQuery,
  useCancelManualRequestDeliveryMutation,
} from '../../api/manualRequestApi'
import { getManualRequestApiMode } from '../../utils/manualRequestAuth'
import { fetchOrderComplaints, PartnerComplaint } from '../../api/complaintsApi'
import { COMPLAINT_TEXT } from '../complaints/complaintText'

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({ query: { deliveryId: 'del-complaints-83' } }),
}))

// Mock next/head
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

// Mock APIs
jest.mock('../../api/manualRequestApi', () => ({
  useGetManualRequestDeliveryQuery: jest.fn(),
  useCancelManualRequestDeliveryMutation: jest.fn(),
  delayDeliveryReady: jest.fn(),
  markDeliveryFoodReady: jest.fn(),
}))

jest.mock('../../utils/manualRequestAuth', () => ({
  getManualRequestApiMode: jest.fn(),
}))

jest.mock('../../api/complaintsApi', () => ({
  ...jest.requireActual('../../api/complaintsApi'),
  fetchOrderComplaints: jest.fn(),
  fileRiderComplaint: jest.fn(),
}))

const mockUseGetDelivery = useGetManualRequestDeliveryQuery as jest.Mock
const mockUseCancelMutation = useCancelManualRequestDeliveryMutation as jest.Mock
const mockFetchOrderComplaints = fetchOrderComplaints as jest.MockedFunction<typeof fetchOrderComplaints>

function setupDelivery(status: string) {
  mockUseGetDelivery.mockReturnValue({
    data: {
      id: 'del-complaints-83',
      status,
      orderReference: 'ORD-83-COMP',
      createdAt: '2026-11-22T02:00:00Z',
      pickupAddress: { formattedAddress: 'Store A, Volos' },
      dropoffAddress: { formattedAddress: 'Customer B, Volos' },
      courier: {
        id: 'courier-1',
        firstName: 'Nikos',
        lastName: 'K.',
        phoneNumber: '+30 6900000000',
      },
    },
    isLoading: false,
    error: undefined,
    refetch: jest.fn(),
  })
}

describe('DeliveryStatusPage rider complaints (spec 0052, AC-3, AC-7)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    ;(getManualRequestApiMode as jest.Mock).mockReturnValue('partner')
    mockUseCancelMutation.mockReturnValue([jest.fn(), { isLoading: false }])
    mockFetchOrderComplaints.mockResolvedValue([])
  })

  it('renders "Complaint about the rider" section on a delivered (DROPPED_OFF) order', async () => {
    setupDelivery('DROPPED_OFF')

    render(<DeliveryStatusPage />)

    await waitFor(() => {
      expect(screen.getByTestId('rider-complaint')).toBeInTheDocument()
    })
    expect(screen.getByText(COMPLAINT_TEXT.sectionTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: COMPLAINT_TEXT.open })).toBeInTheDocument()
  })

  it('renders "Complaint about the rider" section on a CANCELED order', async () => {
    setupDelivery('CANCELED')

    render(<DeliveryStatusPage />)

    await waitFor(() => {
      expect(screen.getByTestId('rider-complaint')).toBeInTheDocument()
    })
    expect(screen.getByText(COMPLAINT_TEXT.sectionTitle)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: COMPLAINT_TEXT.open })).toBeInTheDocument()
  })

  it('does not render "Complaint about the rider" section on an in-flight order with no complaints', async () => {
    setupDelivery('ACCEPTED')

    render(<DeliveryStatusPage />)

    await waitFor(() => {
      expect(mockFetchOrderComplaints).toHaveBeenCalledWith('del-complaints-83')
    })
    expect(screen.queryByTestId('rider-complaint')).not.toBeInTheDocument()
  })

  it('renders "Complaint about the rider" section on an in-flight order if complaints exist', async () => {
    const existing: PartnerComplaint = {
      id: 'c-prev',
      deliveryId: 'del-complaints-83',
      category: 'LATE',
      text: 'Courier late to pickup',
      status: 'OPEN',
      createdAt: '2026-11-22T02:00:00Z',
      outcome: null,
      decidedAt: null,
      withdrawnReason: null,
      withdrawnAt: null,
    }
    mockFetchOrderComplaints.mockResolvedValue([existing])
    setupDelivery('ACCEPTED')

    render(<DeliveryStatusPage />)

    await waitFor(() => {
      expect(screen.getByTestId('rider-complaint')).toBeInTheDocument()
    })
    expect(screen.getByText('Courier late to pickup')).toBeInTheDocument()
  })
})
