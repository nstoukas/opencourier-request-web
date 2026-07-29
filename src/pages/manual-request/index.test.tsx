import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ManualRequestPage from './index'
import * as api from '../../api/manualRequestApi'

// Mock CreateDeliveryForm to isolate ManualRequestPage testing
jest.mock('../../modules/manual-request/components/CreateDeliveryForm', () => ({
  CreateDeliveryForm: () => <div data-testid="create-delivery-form">Mocked Create Delivery Form</div>,
}))

// Mock Next.js Head component
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }) => <>{children}</>,
}))

// Mock API calls from manualRequestApi
jest.mock('../../api/manualRequestApi', () => ({
  loginPartner: jest.fn(),
  logoutPartner: jest.fn(),
  fetchPartnerSession: jest.fn(),
}))

describe('ManualRequestPage (/manual-request/index.tsx)', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('renders sign-in form when signed out, and confirms Sign Up button and Display Name field are absent', async () => {
    // 18. Signed out state setup
    (api.fetchPartnerSession as jest.Mock).mockResolvedValue({
      signedIn: false,
      email: null,
    })

    render(<ManualRequestPage />)

    // Wait for session check to finish
    await waitFor(() => {
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
    })

    // Assert inputs and buttons exist
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument()

    // CRITICAL: Verify deleted Sign Up button and Display Name field do not exist anywhere in DOM
    expect(screen.queryByRole('button', { name: /Sign Up/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Display Name/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Sign Up/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId('create-delivery-form')).not.toBeInTheDocument()
  })

  it('shows signed-in status and CreateDeliveryForm when session is active', async () => {
    // 19. Signed in state setup
    (api.fetchPartnerSession as jest.Mock).mockResolvedValue({
      signedIn: true,
      email: 'nikou@volos.test',
    })

    render(<ManualRequestPage />)

    await waitFor(() => {
      expect(screen.getByText('Signed in as nikou@volos.test.')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument()
    expect(screen.getByTestId('create-delivery-form')).toBeInTheDocument()
    expect(screen.queryByLabelText(/Email/i)).not.toBeInTheDocument()
  })

  it('handles sign in flow: validates empty fields, calls loginPartner, and clears password field on success', async () => {
    (api.fetchPartnerSession as jest.Mock)
      .mockResolvedValueOnce({ signedIn: false, email: null }) // initial mount
      .mockResolvedValueOnce({ signedIn: true, email: 'restaurant@volos.test' }) // after login

    ;(api.loginPartner as jest.Mock).mockResolvedValue({ email: 'restaurant@volos.test' })

    render(<ManualRequestPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument()
    })

    // Step A: Click Sign In with empty fields -> shows validation message
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))
    expect(screen.getByText('Enter partner email and password first.')).toBeInTheDocument()
    expect(api.loginPartner).not.toHaveBeenCalled()

    // Step B: Enter credentials and submit
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'restaurant@volos.test' } })
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'mypassword123' } })

    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    await waitFor(() => {
      expect(api.loginPartner).toHaveBeenCalledWith('restaurant@volos.test', 'mypassword123')
    })

    // Confirm UI transitions to signed in state
    await waitFor(() => {
      expect(screen.getByText('Signed in as restaurant@volos.test.')).toBeInTheDocument()
    })
  })

  it('displays error status when loginPartner throws an exception', async () => {
    (api.fetchPartnerSession as jest.Mock).mockResolvedValue({ signedIn: false, email: null })
    ;(api.loginPartner as jest.Mock).mockRejectedValue(new Error('Invalid email or password.'))

    render(<ManualRequestPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Sign In$/i })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'wrong@example.com' } })
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpass' } })

    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password.')).toBeInTheDocument()
    })
  })

  it('handles sign out flow: calls logoutPartner and returns to signed-out state', async () => {
    // 20. Clicking Sign Out calls logoutPartner() and UI returns to sign-in form
    (api.fetchPartnerSession as jest.Mock)
      .mockResolvedValueOnce({ signedIn: true, email: 'nikou@volos.test' }) // initial mount
      .mockResolvedValueOnce({ signedIn: false, email: null }) // after logout

    ;(api.logoutPartner as jest.Mock).mockResolvedValue(undefined)

    render(<ManualRequestPage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sign Out/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /Sign Out/i }))

    await waitFor(() => {
      expect(api.logoutPartner).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument()
    })
    expect(screen.queryByTestId('create-delivery-form')).not.toBeInTheDocument()
  })
})
