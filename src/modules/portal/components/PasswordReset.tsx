import { useState, type FormEvent } from 'react'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  Spinner,
} from '../../../admin-web-components'
import { requestPasswordResetCode, resetPartnerPassword } from '../../../api/manualRequestApi'
import { serverMessage } from '../../../i18n/serverText'

// The backend's limits (spec 0039): a six digit code, a password of 8 to 72 characters (bcrypt's limit).
const CODE_PATTERN = /^\d{6}$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

type Step = 'ask' | 'code' | 'done'

interface PasswordResetProps {
  // The email typed on the sign in card, so the restaurant does not type it twice.
  initialEmail: string
  // Back to the sign in card, with the email to fill in there.
  onBack: (email: string) => void
}

/**
 * Row 153: a restaurant resets its own forgotten password by an emailed code, the riders' flow (spec 0039). Three
 * steps inside the sign in card: ask for a code, type it with a new password, then a note to sign in again. The
 * first answer never says whether the email has a login, so neither does this page.
 */
export function PasswordReset({ initialEmail, onBack }: PasswordResetProps) {
  const { t, i18n } = useTranslation()
  const [step, setStep] = useState<Step>('ask')
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [apiKeyRemoved, setApiKeyRemoved] = useState(false)

  // The server's refusal in the restaurant's language (a wrong code, mail not set up), else this page's own words.
  const failureText = (err: unknown, fallbackKey: string) => {
    const status = (err as { statusCode?: number } | null)?.statusCode
    if (status === 429) return t('signIn.tooManyTries')
    return serverMessage(err as any, i18n) ?? t(fallbackKey)
  }

  const askForCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim()) {
      setError(t('reset.emailMissing'))
      return
    }
    setIsSending(true)
    setError('')
    try {
      await requestPasswordResetCode(email.trim())
      setStep('code')
    } catch (err) {
      setError(failureText(err, 'signIn.serverDown'))
    } finally {
      setIsSending(false)
    }
  }

  const setNewPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // Checked here first, so a typo never spends one of the code's five tries.
    if (!CODE_PATTERN.test(code.trim())) {
      setError(t('reset.codeFormat'))
      return
    }
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      setError(t('reset.passwordLength'))
      return
    }
    setIsSending(true)
    setError('')
    try {
      const answer = await resetPartnerPassword(email.trim(), code.trim(), password)
      setApiKeyRemoved(answer.apiKeyRemoved)
      setPassword('')
      setStep('done')
    } catch (err) {
      setError(failureText(err, 'signIn.serverDown'))
    } finally {
      setIsSending(false)
    }
  }

  const errorAlert = error ? (
    <Alert variant="destructive">
      <XCircle className="size-4" />
      <AlertTitle>{t('reset.failedTitle')}</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null

  const backButton = (
    <Button type="button" variant="link" className="w-full" onClick={() => onBack(email.trim())}>
      {t('reset.back')}
    </Button>
  )

  if (step === 'done') {
    return (
      <div className="space-y-6">
        <Alert>
          <CheckCircle className="size-4" />
          <AlertTitle>{t('reset.doneTitle')}</AlertTitle>
          <AlertDescription role="status">
            {t('reset.doneText')}
            {apiKeyRemoved ? ` ${t('reset.apiKeyRemoved')}` : ''}
          </AlertDescription>
        </Alert>
        <Button type="button" size="xl" className="w-full" onClick={() => onBack(email.trim())}>
          {t('reset.signInNow')}
        </Button>
      </div>
    )
  }

  if (step === 'code') {
    return (
      <form onSubmit={setNewPassword} noValidate className="space-y-6">
        <p className="text-sm text-muted-foreground" role="status">
          {t('reset.codeSent')}
        </p>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="reset-code">{t('reset.code')}</FieldLabel>
            <Input
              id="reset-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              className="h-12 text-base tracking-widest"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="reset-password">{t('reset.newPassword')}</FieldLabel>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              aria-describedby="reset-password-hint"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 text-base"
            />
            <FieldDescription id="reset-password-hint">{t('reset.passwordHint')}</FieldDescription>
          </Field>
        </FieldGroup>
        {errorAlert}
        <Button type="submit" size="xl" className="w-full" disabled={isSending}>
          {isSending ? <Spinner className="mr-2" aria-hidden /> : null}
          {t('reset.setPassword')}
        </Button>
        <Button type="button" variant="link" className="w-full" onClick={() => setStep('ask')}>
          {t('reset.newCode')}
        </Button>
        {backButton}
      </form>
    )
  }

  return (
    <form onSubmit={askForCode} noValidate className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('reset.intro')}</p>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reset-email">{t('signIn.email')}</FieldLabel>
          <Input
            id="reset-email"
            type="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 text-base"
          />
        </Field>
      </FieldGroup>
      {errorAlert}
      <Button type="submit" size="xl" className="w-full" disabled={isSending}>
        {isSending ? <Spinner className="mr-2" aria-hidden /> : null}
        {t('reset.sendCode')}
      </Button>
      {backButton}
    </form>
  )
}
