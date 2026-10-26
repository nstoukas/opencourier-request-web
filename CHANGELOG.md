# Changelog — co-op fork of `opencourier-request-web`

This fork adapts [Princeton-HCI/opencourier-request-web](https://github.com/Princeton-HCI/opencourier-request-web)
for a Greek workers' cooperative. In this fork, request-web is the **restaurant portal**,
where a signed-in restaurant places delivery requests.

Everything below sits on top of upstream `main` on the branch `fix/partial-address-form`
(34 commits, 26 July – 26 October 2026). Each entry names its commit, and the commit message
has the full reasoning and verification notes.

---

## Security

### Partner credential moved out of the browser (Unit 3b) — `202f7ba`
- **Before:** a partner API key was compiled into the browser bundle through
  `NEXT_PUBLIC_MANUAL_REQUEST_API_KEY` and kept in `localStorage`. Anyone with devtools
  could copy it and submit deliveries as that restaurant.
- **After:** the browser never holds a credential.
  - Next.js route handlers under `src/pages/api/partner-auth/` handle login, session and
    logout, and set an **httpOnly** `oc_partner_session` cookie.
  - `src/pages/api/partner-proxy/[...path].ts` attaches the bearer token on the server.
  - The browser only ever talks to its own origin. The `/backend-api` rewrite is deleted.
- The API-key path was removed outright, not kept as a fallback. The "Sign Up" button went
  too, since the backend endpoint was removed (backend `ed3b762`).
- ⚠ The old key is still in this repo's upstream history, and `local.env` still carries
  upstream's Google Maps key. **Both need rotating**; deleting the lines doesn't undo the
  leak.

### Session cookie lifetime — `8859acf`
- The cookie's `Max-Age` was about 100 years for a token that lasts 36.5 days. The
  backend's `expiresIn` is in milliseconds, but `Max-Age` is in seconds. The value is now
  converted and floored so the cookie can never outlive its token.

## Added

### Saved customers for restaurants (scope row 26, spec 0005): `81fddc2` to `f14d9b5`
Built on the branch `feat/saved-customers` and merged on 26 October, together with the backend and
adminweb halves of the row. A restaurant no longer retypes a regular customer: it saves them once,
with their agreement, and picks them on the next order.
- **A Customers page** (a third header link): the restaurant's saved customers, most recently used
  first, 20 at a time with Show more and "N of M". The search waits 300 ms and needs 2 characters,
  and only the latest search's answer is shown. Add and Edit open a dialog with Name, Phone, the
  address (the order form's address search, in a new compact mode) and Notes for the rider; Save
  looks a typed address up first, so a customer always has a map point. Delete asks first.
- **A Saved customer picker on New Delivery**, above the drop off fields. Picking a customer (click,
  or the arrow keys and Enter) fills the recipient, phone, address with its map point, floor and
  notes, and becomes "Saved customer: <name>" with Change. A screen reader hears the pick and the
  change, and focus moves to what replaced the control that had it.
- **"Save this customer for next time (they agreed)"**, a tick at the end of the drop off card, with
  how long an unused customer is kept (the co-op's setting, read through a new server route,
  `/api/partner-metadata`, that passes on only that number). The save runs after the order is
  confirmed, from the details the order was sent with. If it fails, the order stands and the status
  page says why with a short code in its address (`?customerSave=clash`), never a customer's detail.
- **A picked customer stays editable.** Editing the street, city or zip after a pick makes Get
  Estimate look the address up again, so the quote never carries the old point or the old text
  (`9c0310b`). The address lookup now gives up after 8 s (`acafc1e`).
- "Unit / Apt" is now "Floor or flat"; the form's state is optional and its country defaults to
  `GR`; the header's links stay on one line (on a phone the row scrolls sideways inside the header).
- Fixed along the way: the partner proxy forwarded `{}` as the body of every `DELETE` and bodyless
  `POST`, because Next.js turns no body into `{}`. It now forwards a body only for `POST`, `PATCH`
  and `PUT`, and only a real one (`81fddc2`).
- Tests: 114 new (`b8e0af0`, `f14d9b5`), 279 in all; 44 checked by hand by putting their bug back.
  Reviewed by Fable and by agy; every finding ruled in `docs/reviews/2026-10-26-*saved-customers*`.

### Order form scoped to the signed-in restaurant (Unit 4) — `f8f4232`, `69960e3`
- The form loads `GET /api/partner/v1/partner/profile` and shows the restaurant's name,
  phone and pickup address as plain text, not editable inputs. Only a co-op admin can
  change them.
- If the restaurant has no address on file, the form says so and won't submit.
- Pickup values in both payloads are read from the profile, not from form state. This
  avoids sending placeholder values in the moment before the form fills in.
- "My Orders" lists the backend's partner-scoped deliveries without re-filtering them in
  the browser.
- A comment marks where the form schema and the usability check must stay in sync. The
  form is only reset for profiles that pass the check.

### Testing
- Added Jest and React Testing Library via `next/jest` (run with
  `node node_modules/.bin/jest`). The suite has grown to 86 tests. `6f8cf6e`

### Sign in and the page frame, after the redesign (row 92) — `0b09369`, `6fe1ddf`, `8acef14`, `f5177a8`
- Every page sits in one frame: a sticky 56px header (app icon, New Delivery, My Orders with
  the current page marked, Sign Out) over one centered column, at most 768px wide. A skip
  link moves keyboard focus straight to the page.
- Signing in is a gate in that frame, not a card on the order page. A signed out visit to
  any address shows the sign in there, and after signing in you stay on that address; Sign
  Out keeps it too.
- The sign in follows the admin sign in board: a card with the co-op mark, Email and
  Password fields and a full width button. A failed attempt shows an Alert in plain words
  chosen from the HTTP status (wrong details, too many tries, server down, empty fields);
  the backend's own text and the status code are never shown. `loginPartner` now keeps the
  status on the error it throws.
- New `Field` component from the design system. Phones first: no page scrolls sideways at
  320px.
- Tests: 20 more, written by agy (165 in all), including the old order page sign in tests,
  moved out of `src/pages`. `5d28624`, `ca25102`

### The OpenCourier design system (row 64) — `ba8fbf8`, `7ee4c4c`, `94670e3`
- The colours and corner radius come from the co-op's design system
  (`opencourier-design-system/tokens/tokens.json`): the `:root` theme in `globals.css`
  and the Tailwind config. Light theme only, still Tailwind 3.
- Button, Badge and Alert have the OpenCourier variants (`success`, `warning`, `info`).
- New `StatusBadge`, `Spinner` and `DetailList` components. Every delivery status shows
  through `StatusBadge` with a readable name ("Dropped Off", not `DROPPED_OFF`); it replaces
  `statusVariant()`, lucide's loader and the status page's `DetailGrid`.
- Icons come from Phosphor (`@phosphor-icons/react` 2.1.10) instead of `lucide-react`.
  Icons are hidden from screen readers by default; the spinner and the toast close button
  carry their own names, and the address search's clear button is named too.
- Money, dates and distances use Greek formats and the Athens time zone
  (`src/utils/format.ts`, a 24 hour clock).
- The browser tab and phone home screen show the app icon (`favicon.ico`, `icon-192.png`,
  `apple-touch-icon.png`).
- On a phone, a long delivery id wraps instead of pushing the status badge out of its card.
- Tests: 59 more, written by agy (145 in all). They check the theme against `tokens.json`,
  every status label, that no lucide import comes back, and the Greek formats; the theme and
  status tests skip cleanly when the design system or backend folder is not beside this
  repo. `d07e1f2`, `7ffe3ea`, `7a036c8`

## Fixed

- **The default delivery deadline was in the past.** `toISOString()` converted to UTC,
  but `datetime-local` reads local time, so in Athens the default came out as now minus
  two hours. It is now built from local time. `6d43ea3`
- **Partial addresses no longer throw** while the user is still typing.
  `buildManualRequestFormattedAddress` accepts optional fields. `1d465ae`

## Removed

- The "save pickup as default" `localStorage` feature (`manualRequestDefaultPickup.ts`).
  Pickup now comes from the server. `f8f4232`
- The env var that named a single partner. The session cookie now determines the
  restaurant. `f8f4232`
- Browser env vars `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MANUAL_REQUEST_BASE_PATH`,
  `..._AUTH_MODE`, `..._DEFAULT_PARTNER_ID` and `..._API_KEY`. `MANUAL_REQUEST_BASE_PATH`
  is now server-side only. `202f7ba`
- `package-lock.json` (this repo uses Yarn 1). `1d465ae`

## Housekeeping

- Ignored pipeline artifacts (`.aiflow/`, `plan.md`). `2d78cd7`
- `.run-dev.sh`, a local Node 20 helper that is only useful on the author's machine.
  `1d465ae`
- `AGENTS.md`, context for AI coding tools that points at the co-op workspace rulebook, and a
  `CLAUDE.md` that imports it.

---

## Known open items

- Rotate the leaked partner API key and the Google Maps key, and remove the Maps key from
  the tracked `local.env`.
- The customer search sends its words in the query string to this app's own proxy. Nothing here
  logs it, but a reverse proxy put in front of request-web in production would, unless told not
  to for `/api/partner-proxy/customers` (scope row 45, production hosting).
