// The portal's English texts (spec 0054, AC-2). The keys are grouped by screen or module; the
// first part of a key ("frame", "form", ...) is its group, and the Greek review list
// (docs/translations/greek-review.md at the workspace root) groups them the same way.
// i18next fills in {{name}} with a value; a key ending in _one or _other is a plural: i18next
// picks the form that fits the number passed as `count`.
// Every key here must exist in el.ts too: el.ts is typed as `Translations`, so TypeScript refuses
// a Greek file with a key missing or added.
export const en = {
  // Words used on more than one screen.
  common: {
    appName: 'OpenCourier',
    optional: '(optional)',
    tryAgain: 'Try again',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    saving: 'Saving…',
    loading: 'Loading…',
    minutes_one: '{{count}} min',
    minutes_other: '{{count}} min',
  },
  language: {
    label: 'Language',
  },
  // The frame around every page: the header, the sign in gate, the session messages.
  frame: {
    navNewDelivery: 'New Delivery',
    navMyOrders: 'My Orders',
    navCustomers: 'Customers',
    navLabel: 'Main',
    signOut: 'Sign Out',
    sessionEnded: 'Your session ended. Sign in again.',
    signOutFailed: 'Could not sign out. Check your connection and try again.',
    sessionCheckFailed: 'Could not check your sign in. Check your connection and try again.',
    checkingSignIn: 'Checking your sign in',
    skipToContent: 'Skip to content',
  },
  signIn: {
    title: 'Sign In · OpenCourier',
    heading: 'Restaurant Portal',
    intro: 'Sign in with the email and password the co-op gave your restaurant.',
    email: 'Email',
    password: 'Password',
    passwordHint: 'Forgotten it? Ask the co-op to set a new one.',
    failedTitle: 'Could not sign in',
    signingIn: 'Signing in…',
    submit: 'Sign In',
    missingFields: 'Enter your email and password, then press Sign In.',
    wrongCredentials: "That email and password don't match. Check for typos and try again.",
    tooManyTries: 'Too many tries in a row. Wait a minute, then try again.',
    serverDown: "The co-op's server didn't answer. Check your internet connection and try again in a minute.",
  },
}

// `typeof en` is the type of the object above: the same keys, each a string.
export type Translations = typeof en
