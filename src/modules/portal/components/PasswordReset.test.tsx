import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { createI18n } from '../../../i18n/createI18n'
import { PasswordReset } from './PasswordReset'
import * as api from '../../../api/manualRequestApi'

// Mock API calls
jest.mock('../../../api/manualRequestApi', () => ({
  requestPasswordResetCode: jest.fn(),
  resetPartnerPassword: jest.fn(),
}))

describe('PasswordReset component (Row 153)', () => {
  const onBackMock = jest.fn()
  const i18nEn = createI18n('en')
  const i18nEl = createI18n('el')

  beforeEach(() => {
    jest.resetAllMocks()
  })

  describe('Step 1: Ask for code (email input)', () => {
    it('renders with initial email and email button', () => {
      render(
        <I18nextProvider i18n={i18nEn}>
          <PasswordReset initialEmail="chef@restaurant.com" onBack={onBackMock} />
        </I18nextProvider>,
      )

      expect(screen.getByText('Enter your sign in email. If it has a restaurant login, we email you a code.')).toBeInTheDocument()
      const emailInput = screen.getByLabelText(/^Email/i)
      expect(emailInput).toHaveValue('chef@restaurant.com')
      expect(screen.getByRole('button', { name: 'Email me a code' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Back to sign in' })).toBeInTheDocument()
    })

    it('rejects empty or malformed email client-side without calling API (proof check 4)', async () => {
      render(
        <I18nextProvider i18n={i18nEn}>
          <PasswordReset initialEmail="" onBack={onBackMock} />
        </I18nextProvider>,
      )

      // Try empty submission
      fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
      expect(screen.getByText('Enter your sign in email, then press Email me a code.')).toBeInTheDocument()
      expect(api.requestPasswordResetCode).not.toHaveBeenCalled()

      // Try malformed email without @ or domain
      const emailInput = screen.getByLabelText(/^Email/i)
      fireEvent.change(emailInput, { target: { value: 'not-an-email' } })
      fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
      expect(screen.getByText('Enter your sign in email, then press Email me a code.')).toBeInTheDocument()
      expect(api.requestPasswordResetCode).not.toHaveBeenCalled()

      // Try email missing TLD
      fireEvent.change(emailInput, { target: { value: 'test@localhost' } })
      fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
      expect(screen.getByText('Enter your sign in email, then press Email me a code.')).toBeInTheDocument()
      expect(api.requestPasswordResetCode).not.toHaveBeenCalled()
    })

    it('submits valid email, trims whitespace, calls requestPasswordResetCode and moves to code step', async () => {
      ;(api.requestPasswordResetCode as jest.Mock).mockResolvedValue(undefined)

      render(
        <I18nextProvider i18n={i18nEn}>
          <PasswordReset initialEmail="  chef@restaurant.com  " onBack={onBackMock} />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))

      await waitFor(() => {
        expect(api.requestPasswordResetCode).toHaveBeenCalledWith('chef@restaurant.com')
      })

      // Advanced to step 2 ('code')
      expect(await screen.findByText('If that email has a restaurant login, a 6 digit code is on its way. It works for 15 minutes.')).toBeInTheDocument()
      expect(screen.getByLabelText('Code from the email')).toBeInTheDocument()
      expect(screen.getByLabelText('New password')).toBeInTheDocument()
    })

    it('shows rate limit error on 429 status', async () => {
      const rateLimitErr = Object.assign(new Error('Rate limit exceeded'), { statusCode: 429 })
      ;(api.requestPasswordResetCode as jest.Mock).mockRejectedValue(rateLimitErr)

      render(
        <I18nextProvider i18n={i18nEn}>
          <PasswordReset initialEmail="chef@restaurant.com" onBack={onBackMock} />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))

      expect(await screen.findByText('Too many tries in a row. Wait a minute, then try again.')).toBeInTheDocument()
      expect(screen.getByText('Could not reset the password')).toBeInTheDocument()
    })

    it('shows server failure error when requestPasswordResetCode fails with network or 500 error', async () => {
      const serverErr = Object.assign(new Error('Backend unreachable.'), { statusCode: 502, code: 'NO_ANSWER' })
      ;(api.requestPasswordResetCode as jest.Mock).mockRejectedValue(serverErr)

      render(
        <I18nextProvider i18n={i18nEn}>
          <PasswordReset initialEmail="chef@restaurant.com" onBack={onBackMock} />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))

      expect(await screen.findByText("The co-op's server didn't answer. Check your internet connection and try again in a minute.")).toBeInTheDocument()
    })

    it('calls onBack with trimmed email when back button is pressed', () => {
      render(
        <I18nextProvider i18n={i18nEn}>
          <PasswordReset initialEmail="  chef@restaurant.com  " onBack={onBackMock} />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Back to sign in' }))
      expect(onBackMock).toHaveBeenCalledWith('chef@restaurant.com')
    })
  })

  describe('Step 2: Code and new password', () => {
    async function goToCodeStep(initialEmail = 'chef@restaurant.com') {
      ;(api.requestPasswordResetCode as jest.Mock).mockResolvedValue(undefined)
      render(
        <I18nextProvider i18n={i18nEn}>
          <PasswordReset initialEmail={initialEmail} onBack={onBackMock} />
        </I18nextProvider>,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
      await screen.findByText('If that email has a restaurant login, a 6 digit code is on its way. It works for 15 minutes.')
    }

    it('validates 6-digit code format client-side before sending', async () => {
      await goToCodeStep()

      const passwordInput = screen.getByLabelText('New password')
      fireEvent.change(passwordInput, { target: { value: 'validPassword123' } })

      const submitBtn = screen.getByRole('button', { name: 'Set new password' })

      // Case 1: 5 digits
      const codeInput = screen.getByLabelText('Code from the email')
      fireEvent.change(codeInput, { target: { value: '12345' } })
      fireEvent.click(submitBtn)
      expect(screen.getByText('The code is the 6 digits from the email.')).toBeInTheDocument()
      expect(api.resetPartnerPassword).not.toHaveBeenCalled()

      // Case 2: letters
      fireEvent.change(codeInput, { target: { value: 'abcdef' } })
      fireEvent.click(submitBtn)
      expect(screen.getByText('The code is the 6 digits from the email.')).toBeInTheDocument()
      expect(api.resetPartnerPassword).not.toHaveBeenCalled()
    })

    it('validates password length (8 to 72 characters) client-side before sending', async () => {
      await goToCodeStep()

      const codeInput = screen.getByLabelText('Code from the email')
      fireEvent.change(codeInput, { target: { value: '123456' } })

      const passwordInput = screen.getByLabelText('New password')
      const submitBtn = screen.getByRole('button', { name: 'Set new password' })

      // Too short: 7 characters
      fireEvent.change(passwordInput, { target: { value: 'short12' } })
      fireEvent.click(submitBtn)
      expect(screen.getByText('The new password must be 8 to 72 characters.')).toBeInTheDocument()
      expect(api.resetPartnerPassword).not.toHaveBeenCalled()

      // Too long: 73 characters
      fireEvent.change(passwordInput, { target: { value: 'a'.repeat(73) } })
      fireEvent.click(submitBtn)
      expect(screen.getByText('The new password must be 8 to 72 characters.')).toBeInTheDocument()
      expect(api.resetPartnerPassword).not.toHaveBeenCalled()
    })

    it('submits valid code and password, trims code and email, advances to done step', async () => {
      ;(api.resetPartnerPassword as jest.Mock).mockResolvedValue({ apiKeyRemoved: false })
      await goToCodeStep('  chef@restaurant.com  ')

      fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '  123456  ' } })
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'brandNewSecret123' } })

      fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))

      await waitFor(() => {
        expect(api.resetPartnerPassword).toHaveBeenCalledWith('chef@restaurant.com', '123456', 'brandNewSecret123')
      })

      // Done step
      expect(await screen.findByText('Password changed')).toBeInTheDocument()
      expect(screen.getByText('Sign in with your new password.')).toBeInTheDocument()
      expect(screen.queryByText(/Your API key was switched off/)).not.toBeInTheDocument()
    })

    it('words server refusal through serverMessage on invalid or expired code', async () => {
      const refusalErr = Object.assign(new Error('The code is wrong or expired.'), {
        statusCode: 400,
        message: 'The code is wrong or expired.',
      })
      ;(api.resetPartnerPassword as jest.Mock).mockRejectedValue(refusalErr)
      await goToCodeStep()

      fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '123456' } })
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'brandNewSecret123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))

      expect(await screen.findByText('The code is wrong or expired.')).toBeInTheDocument()
      expect(screen.getByText('Could not reset the password')).toBeInTheDocument()
    })

    it('"Send a new code" button clears old code and error, and returns to ask step', async () => {
      await goToCodeStep()

      const codeInput = screen.getByLabelText('Code from the email')
      fireEvent.change(codeInput, { target: { value: '123' } })

      // Trigger validation error
      fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))
      expect(screen.getByText('The code is the 6 digits from the email.')).toBeInTheDocument()

      // Click "Send a new code"
      fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }))

      // Returned to step 1
      expect(screen.getByText('Enter your sign in email. If it has a restaurant login, we email you a code.')).toBeInTheDocument()
      expect(screen.queryByText('The code is the 6 digits from the email.')).not.toBeInTheDocument()

      // When advancing to code step again, code is empty
      ;(api.requestPasswordResetCode as jest.Mock).mockResolvedValue(undefined)
      fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
      const freshCodeInput = await screen.findByLabelText('Code from the email')
      expect(freshCodeInput).toHaveValue('')
    })
  })

  describe('Step 3: Done screen', () => {
    it('shows apiKeyRemoved note when apiKeyRemoved is true', async () => {
      ;(api.requestPasswordResetCode as jest.Mock).mockResolvedValue(undefined)
      ;(api.resetPartnerPassword as jest.Mock).mockResolvedValue({ apiKeyRemoved: true })

      render(
        <I18nextProvider i18n={i18nEn}>
          <PasswordReset initialEmail="chef@restaurant.com" onBack={onBackMock} />
        </I18nextProvider>,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
      await screen.findByLabelText('Code from the email')

      fireEvent.change(screen.getByLabelText('Code from the email'), { target: { value: '123456' } })
      fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'securePass99' } })
      fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))

      expect(await screen.findByText('Password changed')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(
        'Sign in with your new password. Your API key was switched off. Ask the co-op for a new one.'
      )

      // Sign In button calls onBack with the email
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
      expect(onBackMock).toHaveBeenCalledWith('chef@restaurant.com')
    })
  })

  describe('Greek language parity (Row 153)', () => {
    it('renders all password reset steps and messages in Greek', async () => {
      ;(api.requestPasswordResetCode as jest.Mock).mockResolvedValue(undefined)
      ;(api.resetPartnerPassword as jest.Mock).mockResolvedValue({ apiKeyRemoved: true })

      render(
        <I18nextProvider i18n={i18nEl}>
          <PasswordReset initialEmail="chef@restaurant.gr" onBack={onBackMock} />
        </I18nextProvider>,
      )

      // Step 1 in Greek
      expect(screen.getByText('Γράψτε το email σύνδεσης. Αν ανήκει σε κατάστημα, θα σας στείλουμε κωδικό.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Στείλτε μου κωδικό' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Πίσω στη σύνδεση' })).toBeInTheDocument()

      // Client validation in Greek
      const emailInput = screen.getByLabelText(/^Email/i)
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
      fireEvent.click(screen.getByRole('button', { name: 'Στείλτε μου κωδικό' }))
      expect(screen.getByText('Γράψτε το email σύνδεσης και πατήστε Στείλτε μου κωδικό.')).toBeInTheDocument()

      // Submit valid email
      fireEvent.change(emailInput, { target: { value: 'chef@restaurant.gr' } })
      fireEvent.click(screen.getByRole('button', { name: 'Στείλτε μου κωδικό' }))

      // Step 2 in Greek
      expect(await screen.findByText('Αν το email ανήκει σε κατάστημα, ένας εξαψήφιος κωδικός έρχεται. Ισχύει για 15 λεπτά.')).toBeInTheDocument()
      expect(screen.getByLabelText('Κωδικός από το email')).toBeInTheDocument()
      expect(screen.getByLabelText('Νέος κωδικός πρόσβασης')).toBeInTheDocument()
      expect(screen.getByText('8 έως 72 χαρακτήρες.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Ορισμός νέου κωδικού' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Αποστολή νέου κωδικού' })).toBeInTheDocument()

      // Code validation in Greek
      fireEvent.change(screen.getByLabelText('Κωδικός από το email'), { target: { value: '12' } })
      fireEvent.click(screen.getByRole('button', { name: 'Ορισμός νέου κωδικού' }))
      expect(screen.getByText('Ο κωδικός είναι τα 6 ψηφία από το email.')).toBeInTheDocument()

      // Password length validation in Greek
      fireEvent.change(screen.getByLabelText('Κωδικός από το email'), { target: { value: '123456' } })
      fireEvent.change(screen.getByLabelText('Νέος κωδικός πρόσβασης'), { target: { value: '123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Ορισμός νέου κωδικού' }))
      expect(screen.getByText('Ο νέος κωδικός πρέπει να έχει 8 έως 72 χαρακτήρες.')).toBeInTheDocument()

      // Submit valid
      fireEvent.change(screen.getByLabelText('Νέος κωδικός πρόσβασης'), { target: { value: 'validSecret99' } })
      fireEvent.click(screen.getByRole('button', { name: 'Ορισμός νέου κωδικού' }))

      // Step 3 in Greek
      expect(await screen.findByText('Ο κωδικός άλλαξε')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(
        'Συνδεθείτε με τον νέο σας κωδικό. Το κλειδί API σας απενεργοποιήθηκε. Ζητήστε νέο από τον συνεταιρισμό.'
      )
      expect(screen.getByRole('button', { name: 'Σύνδεση' })).toBeInTheDocument()
    })
  })
})
