import { useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { SignOut } from '@phosphor-icons/react'
import { Button, Spinner } from '../../../admin-web-components'
import { cn } from '../../../ui-shared-utils'
import { logoutPartner } from '../../../api/manualRequestApi'
import { usePartnerSession } from '../../../hooks/usePartnerSession'
import { SignInScreen } from './SignInScreen'

// The three places a restaurant goes. `as const` keeps the strings exact instead of widening them to `string`.
const NAV_LINKS = [
  { href: '/manual-request', label: 'New Delivery' },
  { href: '/manual-request/deliveries', label: 'My Orders' },
  { href: '/manual-request/customers', label: 'Customers' },
] as const

interface PortalHeaderProps {
  email: string | null
  onSignOut: () => void
}

/** The sticky 56px header: the co-op's mark, the three pages, and Sign Out. */
function PortalHeader({ email, onSignOut }: PortalHeaderProps) {
  const router = useRouter()
  const navRef = useRef<HTMLElement>(null)

  // On a phone the links scroll sideways; bring the current page's link into view, so it is never
  // the one cut off at the edge. `inline: 'nearest'` moves the row only as far as needed.
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [router.pathname])

  return (
    <header className="sticky top-0 z-20 h-14 border-b bg-background">
      <div className="mx-auto flex h-full w-full max-w-3xl items-center gap-1 px-4">
        <Link href="/manual-request" className="mr-2 flex shrink-0 items-center gap-2 rounded-md font-semibold">
          {/* The app icon (the sign mark needs 48px, more than a 56px header can give it). */}
          <img src="/icon-192.png" alt="" width={28} height={28} className="size-7 rounded-md" />
          {/* On a phone the icon stands alone, so the name is still read out. */}
          <span className="sr-only sm:not-sr-only">OpenCourier</span>
        </Link>

        {/* Three links do not fit beside the mark on a phone: the row scrolls sideways inside the
            header (never the page), and each link stays on one line. */}
        <nav ref={navRef} aria-label="Main" className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] md:shrink-0">
          {NAV_LINKS.map((link) => {
            const isCurrent = router.pathname === link.href
            return (
              // `asChild` makes the Button style its child (the Link) instead of drawing its own
              // <button>, so the result is one plain link and not a button inside a link.
              <Button
                key={link.href}
                asChild
                variant="ghost"
                className={cn('shrink-0 whitespace-nowrap px-3', isCurrent && 'bg-secondary text-secondary-foreground')}
              >
                <Link href={link.href} aria-current={isCurrent ? 'page' : undefined}>
                  {link.label}
                </Link>
              </Button>
            )
          })}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {email ? (
            <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground md:inline" title={email}>
              {email}
            </span>
          ) : null}
          <Button type="button" variant="ghost" className="shrink-0 px-3" onClick={onSignOut}>
            <SignOut className="size-5 sm:mr-2 sm:size-4" />
            <span className="sr-only sm:not-sr-only">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

interface PageHeaderProps {
  title: string
  description?: ReactNode
  // Links or buttons shown beside the title on wide screens and under it on a phone.
  actions?: ReactNode
}

/** A page's h1 (the design system's 30px page title), an optional line under it, and actions. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3 text-sm">{actions}</div> : null}
    </div>
  )
}

/**
 * The frame every request-web page sits in. Every page needs the restaurant's session, so
 * the frame checks it once: while it checks, a spinner; signed out, the sign in screen at
 * the same address (so after signing in you land on the page you asked for); signed in,
 * the sticky header and one centered column, at most 768px wide, with the page inside.
 */
export function PortalFrame({ children }: { children: ReactNode }) {
  const { isSignedIn, email, isLoading, refresh } = usePartnerSession()

  const handleSignOut = async () => {
    await logoutPartner()
    await refresh()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted">
        <Spinner className="size-6 text-muted-foreground" label="Checking your sign in" />
      </div>
    )
  }

  if (!isSignedIn) {
    return <SignInScreen onSignedIn={refresh} />
  }

  return (
    <div className="min-h-dvh bg-background">
      {/* For keyboard users: the first Tab press offers a jump past the header. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-30 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow-sm"
      >
        Skip to content
      </a>
      <PortalHeader email={email} onSignOut={handleSignOut} />
      {/* tabIndex -1 lets the skip link move keyboard focus here, not only the scroll. */}
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl px-4 py-6 outline-none sm:py-8">
        {children}
      </main>
    </div>
  )
}
