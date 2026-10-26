import { useState, type FormEvent } from 'react'
import Head from 'next/head'
import { XCircle } from '@phosphor-icons/react'
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
} from '../../../admin-web-components'
import { loginPartner, type SignInError } from '../../../api/manualRequestApi'

/**
 * Turns a failed sign in into plain words for the restaurant. Never an HTTP code and never
 * the server's own text, which is written for developers ("password must be longer than or
 * equal to 8 characters", "These credentials are incorrect").
 */
export function signInErrorMessage(error: unknown): string {
  // `unknown` means "could be anything": a thrown value is not always an Error, so we check
  // before reading `.status` from it.
  const status = typeof error === 'object' && error !== null ? (error as SignInError).status : undefined
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return "That email and password don't match. Check for typos and try again."
  }
  if (status === 429) {
    return 'Too many tries in a row. Wait a minute, then try again.'
  }
  // A 5xx, or no status at all (the network failed before the server answered).
  return "The co-op's server didn't answer. Check your internet connection and try again in a minute."
}

interface SignInScreenProps {
  // Called after the server has set the session cookie, so the frame can check the session again.
  onSignedIn: () => void
}

/**
 * The restaurant's sign in: the design system's Card and Field pattern on the muted ground,
 * after the admin "Sign in" board. The error Alert appears only after a failed attempt.
 */
export function SignInScreen({ onSignedIn }: SignInScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)

  // `FormEvent` is the type of the event a <form> passes to onSubmit.
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    // Stop the browser's own form post (a full page reload); we send the request ourselves.
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password, then press Sign In.')
      return
    }

    setIsSigningIn(true)
    setError('')
    try {
      await loginPartner(email.trim(), password)
      setPassword('')
      setIsSigningIn(false)
      onSignedIn()
    } catch (err) {
      setError(signInErrorMessage(err))
      setIsSigningIn(false)
    }
  }

  return (
    <>
      <Head>
        <title>Sign In · OpenCourier</title>
      </Head>
      <main className="flex min-h-dvh items-center justify-center bg-muted px-4 py-10">
        <Card className="w-full max-w-sm rounded-xl">
          <CardHeader className="space-y-2 p-4 sm:p-6">
            {/* The design system's mark: black ink, for white or muted grounds, 48px tall or more. */}
            <img src="/opencourier-sign.png" alt="OpenCourier" width={42} height={48} className="h-12 w-auto self-start" />
            <h1 className="pt-2 text-2xl font-semibold tracking-tight">Restaurant Portal</h1>
            <CardDescription className="text-base sm:text-sm">
              Sign in with the email and password the co-op gave your restaurant.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {/* noValidate: we show our own message in the Alert instead of the browser's bubble,
                which would follow the computer's language and look different on every phone. */}
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="partner-email">Email</FieldLabel>
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
                  <FieldLabel htmlFor="partner-password">Password</FieldLabel>
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
                    Forgotten it? Ask the co-op to set a new one.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              {error ? (
                <Alert variant="destructive">
                  <XCircle className="size-4" />
                  <AlertTitle>Could not sign in</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" size="xl" className="w-full" disabled={isSigningIn}>
                {isSigningIn ? (
                  <>
                    {/* The button's own words say "Signing in…", so the spinner stays silent here. */}
                    <Spinner className="mr-2" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
