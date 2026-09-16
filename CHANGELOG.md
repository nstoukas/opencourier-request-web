# Changelog — co-op fork of `opencourier-request-web`

This fork adapts [Princeton-HCI/opencourier-request-web](https://github.com/Princeton-HCI/opencourier-request-web)
for a Greek workers' cooperative. In this fork, request-web is the **restaurant portal**,
where a signed-in restaurant places delivery requests.

Everything below sits on top of upstream `main` on the branch `fix/partial-address-form`
(8 commits, 26 July – 4 August 2026). Each entry names its commit, and the commit message
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

---

## Known open items

- Rotate the leaked partner API key and the Google Maps key, and remove the Maps key from
  the tracked `local.env`.
- The default drop-off country is still `US` and should probably be `GR`.
