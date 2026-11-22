import { useState, type FormEvent } from 'react'
import Head from 'next/head'
import { XCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  Input,
  Spinner,
  toast,
} from '../../../admin-web-components'
import { loginPartner, saveAccountLanguage, type SignInError } from '../../../api/manualRequestApi'
import { LanguageSwitch } from '../../../i18n/LanguageSwitch'
import { toLanguage } from '../../../i18n/language'
import { applyLanguage, forgetChosenBeforeSignIn, wasChosenBeforeSignIn } from '../../../i18n/languageChoice'

/**
 * Turns a failed sign in into plain words for the restaurant, as the translation key of the words
 * (the screen translates it with `t`, so this stays a plain function). Never an HTTP code and never
 * the server's own text, which is written for developers ("password must be longer than or
 * equal to 8 characters", "These credentials are incorrect").
 */
export function signInErrorMessage(error: unknown): string {
  // `unknown` means "could be anything": a thrown value is not always an Error, so we check
  // before reading `.status` from it.
  const status = typeof error === 'object' && error !== null ? (error as SignInError).status : undefined
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return 'signIn.wrongCredentials'
  }
  if (status === 429) {
    return 'signIn.tooManyTries'
  }
  // A 5xx, or no status at all (the network failed before the server answered).
  return 'signIn.serverDown'
}

interface SignInScreenProps {
  // Called after the server has set the session cookie, so the frame can check the session again.
  onSignedIn: () => void
  // Why the screen is shown, when the frame knows (spec 0017, AC-5: "Your session ended. Sign in again.").
  notice?: string
}

/**
 * The restaurant's sign in: the design system's Card and Field pattern on the muted ground,
 * after the admin "Sign in" board. The error Alert appears only after a failed attempt.
 */
export function SignInScreen({ onSignedIn, notice }: SignInScreenProps) {
  const { t, i18n } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // The error's translation key, not its words: translated where it is shown, so the language switch
  // right above the card reaches an error already on screen.
  const [errorKey, setErrorKey] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)

  // `FormEvent` is the type of the event a <form> passes to onSubmit.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // Stop the browser's own form post (a full page reload); we send the request ourselves.
    event.preventDefault()
    if (!email.trim() || !password) {
      setErrorKey('signIn.missingFields')
      return
    }

    setIsSigningIn(true)
    setErrorKey('')
    try {
      const account = await loginPartner(email.trim(), password)
      // The language (spec 0054, cross check 2): the one stored on the account wins at sign in, unless the
      // restaurant picked one on this card just now, which is then saved to the account (the same rule as
      // adminweb, decision 47.32). A failed save is told; the page keeps the chosen language (it is in the
      // cookie), only the account keeps its old one.
      if (wasChosenBeforeSignIn()) {
        saveAccountLanguage(toLanguage(i18n.language)).catch(() =>
          toast({ title: t('language.saveFailed'), variant: 'destructive' }),
        )
      } else if (account.language) {
        applyLanguage(i18n, account.language)
      }
      forgetChosenBeforeSignIn()
      setPassword('')
      setIsSigningIn(false)
      onSignedIn()
    } catch (err) {
      setErrorKey(signInErrorMessage(err))
      setIsSigningIn(false)
    }
  }

  return (
    <>
      <Head>
        <title>{t('signIn.title')}</title>
      </Head>
      <main className="flex min-h-dvh items-center justify-center bg-muted px-4 py-10">
        <Card className="w-full max-w-sm rounded-xl">
          <CardHeader className="space-y-2 p-4 sm:p-6">
            {/* The design system's mark (black ink, for white or muted grounds, 48px tall or more), and the
                language switch, so a restaurant can read the sign in in English before signing in. */}
            <div className="flex items-start justify-between gap-4">
              <img src="/opencourier-sign.png" alt={t('common.appName')} width={42} height={48} className="h-12 w-auto" />
              <LanguageSwitch />
            </div>
            <h1 className="pt-2 text-2xl font-semibold tracking-tight">{t('signIn.heading')}</h1>
            <CardDescription className="text-base sm:text-sm">
              {t('signIn.intro')}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {/* noValidate: we show our own message in the Alert instead of the browser's bubble,
                which would follow the computer's language and look different on every phone. */}
            {notice ? (
              <Alert className="mb-6">
                <AlertDescription role="status">{notice}</AlertDescription>
              </Alert>
            ) : null}
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="partner-email">{t('signIn.email')}</FieldLabel>
                  <Input
                    id="partner-email"
                    type="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="h-12 text-base"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="partner-password">{t('signIn.password')}</FieldLabel>
                  <Input
                    id="partner-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    aria-describedby="partner-password-hint"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 text-base"
                  />
                  <FieldDescription id="partner-password-hint">
                    {t('signIn.passwordHint')}
                  </FieldDescription>
                </Field>
              </FieldGroup>

              {errorKey ? (
                <Alert variant="destructive">
                  <XCircle className="size-4" />
                  <AlertTitle>{t('signIn.failedTitle')}</AlertTitle>
                  <AlertDescription>{t(errorKey)}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" size="xl" className="w-full" disabled={isSigningIn}>
                {isSigningIn ? (
                  <>
                    {/* The button's own words say "Signing in…", so the spinner stays silent here. */}
                    <Spinner className="mr-2" aria-hidden />
                    {t('signIn.signingIn')}
                  </>
                ) : (
                  t('signIn.submit')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
