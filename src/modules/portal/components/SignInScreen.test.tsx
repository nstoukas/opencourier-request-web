import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SignInScreen, signInErrorMessage } from './SignInScreen'
import * as api from '../../../api/manualRequestApi'

// Mock next/head so head title tags render safely in jsdom
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }) => <>{children}</>,
}))

// Mock API login call
jest.mock('../../../api/manualRequestApi', () => {
  const actual = jest.requireActual('../../../api/manualRequestApi')
  return {
    ...actual,
    loginPartner: jest.fn(),
  }
})

describe('signInErrorMessage() helper', () => {
  it('maps 400, 401, 403, and 404 to wrong credentials wording with no HTTP code digits', () => {
    const statuses = [400, 401, 403, 404]
    for (const status of statuses) {
      const error = new Error('Raw backend error message') as api.SignInError
      error.status = status
      const message = signInErrorMessage(error)
      expect(message).toBe("That email and password don't match. Check for typos and try again.")
      // Pin: plain words and never an HTTP code or digits of an HTTP status
      expect(message).not.toMatch(/\b(400|401|403|404)\b/)
      expect(message).not.toContain('Raw backend error')
    }
  })

  it('maps 429 to rate limit wording with no HTTP code digits', () => {
    const error = new Error('Too Many Requests') as api.SignInError
    error.status = 429
    const message = signInErrorMessage(error)
    expect(message).toBe('Too many tries in a row. Wait a minute, then try again.')
    expect(message).not.toMatch(/\b429\b/)
  })

  it('maps 5xx server errors and network failures to server/network wording with no HTTP code digits', () => {
    const serverStatuses = [500, 502, 503, 504]
    for (const status of serverStatuses) {
      const error = new Error('Internal Server Error') as api.SignInError
      error.status = status
      const message = signInErrorMessage(error)
      expect(message).toBe("The co-op's server didn't answer. Check your internet connection and try again in a minute.")
      expect(message).not.toMatch(/\b(500|502|503|504)\b/)
    }

    // Network failure with no status code
    const networkError = new Error('Failed to fetch')
    expect(signInErrorMessage(networkError)).toBe(
      "The co-op's server didn't answer. Check your internet connection and try again in a minute."
    )

    // Non-object thrown value
    expect(signInErrorMessage('unknown error')).toBe(
      "The co-op's server didn't answer. Check your internet connection and try again in a minute."
    )
    expect(signInErrorMessage(null)).toBe(
      "The co-op's server didn't answer. Check your internet connection and try again in a minute."
    )
  })
})

describe('SignInScreen component', () => {
  const onSignedInMock = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('renders sign in card matching redesign notes: logo, title, email, password, and full width button', () => {
    render(<SignInScreen onSignedIn={onSignedInMock} />)

    // Logo with alt="OpenCourier"
    const logo = screen.getByRole('img', { name: 'OpenCourier' })
    expect(logo).toBeInTheDocument()
    expect(logo).toHaveAttribute('src', '/opencourier-sign.png')

    // Title and description
    expect(screen.getByRole('heading', { name: 'Restaurant Portal', level: 1 })).toBeInTheDocument()
    expect(
      screen.getByText('Sign in with the email and password the co-op gave your restaurant.')
    ).toBeInTheDocument()

    // Email field
    const emailInput = screen.getByLabelText(/^Email/i)
    expect(emailInput).toBeInTheDocument()
    expect(emailInput).toHaveAttribute('type', 'email')
    expect(emailInput).toHaveAttribute('autoComplete', 'username')
    expect(emailInput).toHaveClass('h-12') // 48px touch target

    // Password field with hint linked via aria-describedby
    const passwordInput = screen.getByLabelText(/^Password/i)
    expect(passwordInput).toBeInTheDocument()
    expect(passwordInput).toHaveAttribute('type', 'password')
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password')
    expect(passwordInput).toHaveAttribute('aria-describedby', 'partner-password-hint')
    expect(passwordInput).toHaveClass('h-12') // 48px touch target
    expect(screen.getByText('Forgotten it? Ask the co-op to set a new one.')).toHaveAttribute(
      'id',
      'partner-password-hint'
    )

    // Full width Sign In submit button
    const submitBtn = screen.getByRole('button', { name: /^Sign In$/i })
    expect(submitBtn).toBeInTheDocument()
    expect(submitBtn).toHaveAttribute('type', 'submit')
    expect(submitBtn).toHaveClass('w-full')

    // PINNED: The destructive Alert is absent before any attempt
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/Could not sign in/i)).not.toBeInTheDocument()

    // Confirm deleted Sign Up button and Display Name field do not exist anywhere in DOM
    expect(screen.queryByRole('button', { name: /Sign Up/i })).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Display Name/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Sign Up/i)).not.toBeInTheDocument()
  })

  it('shows destructive Alert when submitted with empty email or password, without calling API', async () => {
    render(<SignInScreen onSignedIn={onSignedInMock} />)

    // Submit empty form
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    // PINNED: Alert shown after failed attempt
    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveClass('text-destructive')
    expect(screen.getByText('Could not sign in')).toBeInTheDocument()
    expect(screen.getByText('Enter your email and password, then press Sign In.')).toBeInTheDocument()

    // API was never called
    expect(api.loginPartner).not.toHaveBeenCalled()
    expect(onSignedInMock).not.toHaveBeenCalled()
  })

  it('shows empty fields message and does not call API when only email is filled', async () => {
    render(<SignInScreen onSignedIn={onSignedInMock} />)

    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'restaurant@volos.test' } })
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveClass('text-destructive')
    expect(screen.getByText('Could not sign in')).toBeInTheDocument()
    expect(screen.getByText('Enter your email and password, then press Sign In.')).toBeInTheDocument()

    expect(api.loginPartner).not.toHaveBeenCalled()
    expect(onSignedInMock).not.toHaveBeenCalled()
  })

  it('shows empty fields message and does not call API when only password is filled', async () => {
    render(<SignInScreen onSignedIn={onSignedInMock} />)

    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'secretpass' } })
    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveClass('text-destructive')
    expect(screen.getByText('Could not sign in')).toBeInTheDocument()
    expect(screen.getByText('Enter your email and password, then press Sign In.')).toBeInTheDocument()

    expect(api.loginPartner).not.toHaveBeenCalled()
    expect(onSignedInMock).not.toHaveBeenCalled()
  })

  it('Enter key submits the form (real form submission)', async () => {
    ;(api.loginPartner as jest.Mock).mockResolvedValue({ email: 'restaurant@volos.test' })

    render(<SignInScreen onSignedIn={onSignedInMock} />)

    const emailInput = screen.getByLabelText(/^Email/i)
    const passwordInput = screen.getByLabelText(/^Password/i)

    fireEvent.change(emailInput, { target: { value: 'restaurant@volos.test' } })
    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } })

    // Submit via form submit event (simulating Enter keypress in input)
    const form = emailInput.closest('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form!)

    await waitFor(() => {
      expect(api.loginPartner).toHaveBeenCalledWith('restaurant@volos.test', 'mypassword123')
    })
    expect(onSignedInMock).toHaveBeenCalledTimes(1)
  })

  it('handles successful sign in: trims email, clears password, calls onSignedIn, and stores no client credentials', async () => {
    ;(api.loginPartner as jest.Mock).mockResolvedValue({ email: 'restaurant@volos.test' })

    render(<SignInScreen onSignedIn={onSignedInMock} />)

    const emailInput = screen.getByLabelText(/^Email/i)
    const passwordInput = screen.getByLabelText(/^Password/i)

    fireEvent.change(emailInput, { target: { value: '  restaurant@volos.test  ' } })
    fireEvent.change(passwordInput, { target: { value: 'secretpass' } })

    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    await waitFor(() => {
      expect(api.loginPartner).toHaveBeenCalledWith('restaurant@volos.test', 'secretpass')
    })

    await waitFor(() => {
      expect(onSignedInMock).toHaveBeenCalledTimes(1)
    })

    // Password field is cleared on success
    expect(passwordInput).toHaveValue('')

    // Alert remains absent
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    // PINNED: Browser never holds a credential in client storage
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('displays plain words Alert with no HTTP digits on 401/403 failure', async () => {
    const error = new Error('These credentials are incorrect') as api.SignInError
    error.status = 401
    ;(api.loginPartner as jest.Mock).mockRejectedValue(error)

    render(<SignInScreen onSignedIn={onSignedInMock} />)

    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'wrong@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'wrongpass' } })

    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.getByText('Could not sign in')).toBeInTheDocument()
    // Plain words message
    expect(
      screen.getByText("That email and password don't match. Check for typos and try again.")
    ).toBeInTheDocument()

    // PINNED: Never an HTTP code or digits of an HTTP status code
    expect(alert.textContent).not.toMatch(/\b(400|401|403|404|429|500)\b/)
    // Never backend's raw text
    expect(alert.textContent).not.toContain('These credentials are incorrect')

    expect(onSignedInMock).not.toHaveBeenCalled()
  })

  it('displays rate limit Alert on 429 status', async () => {
    const error = new Error('Rate limit') as api.SignInError
    error.status = 429
    ;(api.loginPartner as jest.Mock).mockRejectedValue(error)

    render(<SignInScreen onSignedIn={onSignedInMock} />)

    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'chef@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'secret' } })

    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(
      screen.getByText('Too many tries in a row. Wait a minute, then try again.')
    ).toBeInTheDocument()
    expect(alert.textContent).not.toMatch(/\b429\b/)
  })

  it('displays server failure Alert on 500 status or network drop', async () => {
    const error = new Error('Network failure') as api.SignInError
    error.status = 500
    ;(api.loginPartner as jest.Mock).mockRejectedValue(error)

    render(<SignInScreen onSignedIn={onSignedInMock} />)

    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'chef@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'secret' } })

    fireEvent.click(screen.getByRole('button', { name: /^Sign In$/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(
      screen.getByText("The co-op's server didn't answer. Check your internet connection and try again in a minute.")
    ).toBeInTheDocument()
    expect(alert.textContent).not.toMatch(/\b500\b/)
  })
})
