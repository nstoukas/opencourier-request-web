# opencourier-request-web

## Overview

The partner (restaurant) facing request UI: Next.js 14, React, Radix UI, Tailwind,
react-hook-form, zod. Dev server on port 3090, using the backend's `partner` API.

**Read the workspace rulebook first: [`../AGENTS.md`](../AGENTS.md).** This repo sits inside the co-op workspace, and that file binds it: co-op values, locked decisions, domain language, boundaries, and the skill workflow every change goes through ("How work gets done here"). Tools that stop at this repo's git root will not find it on their own. This file only adds what is specific to this component.

## Key files

| File | Owns |
|---|---|
| `src/pages/api/partner-auth/` | Server-side login and logout; sets the httpOnly `oc_partner_session` cookie |
| `src/pages/api/partner-proxy/[...path].ts` | Attaches the bearer token server-side and forwards to the backend |
| `src/utils/partnerSession.ts` | Reads `MANUAL_REQUEST_PROXY_TARGET`, the backend address |
| `src/pages/manual-request/` | The request form itself |
| `src/modules/saved-customers/` | Saved customers: the Customers page (`/manual-request/customers`), the order form's picker and save tick (spec 0005) |
| `src/modules/manual-request/utils/geocode.ts` | The address lookup, from the browser to public Nominatim, giving up after 8 s; `addressPinKey` says when a map point no longer fits its address |
| `src/modules/manual-request/utils/orderForm.ts` | The order form's rules (spec 0006): the total and its cents, Ready in, the rider note, price expiry, the search area |
| `src/modules/portal/components/PortalFrame.tsx` | The frame every page sits in, and the sign in gate (there is no `/login` page) |

## Commands

Yarn 1.22, **not Corepack**: run `node node_modules/.bin/next dev -p 3090` and
`node node_modules/.bin/jest`. There is no lint script. Full list in the workspace rulebook.

## Gotchas

- The browser never holds a credential. Never add an API key path, not even as a fallback.
- Money goes to the backend in whole cents: `orderTotalValue` 1250 is 12,50 € (decision 27.5; the column is
  an `Int`, and `formatMoney` divides by 100). Never send a euro decimal.
- cmdk 1.x writes `data-disabled="false"` on every enabled item, so a Tailwind `data-[disabled]:` variant
  matches them all; use `data-[disabled=true]:` (`Command.tsx`). JSDOM applies no Tailwind, so a tap that
  CSS blocks only shows in a real browser: check pickers by tapping, not with Enter.
- A test order with the save tick on and an already saved phone updates that saved customer (spec 0005,
  AC-4). Never reuse a fixture customer's phone in a test order.
- The partner proxy forwards a body only for POST, PATCH and PUT, and only a real one: Next.js turns no
  body into `{}`, which the backend would read as a body it never asked for.
- A dispatch stop (spec 0014): the order page shows the backend's own sentence from `GET /dispatch-state` through the
  partner proxy, read every minute while the tab is visible; a refused quote already carries the same sentence.
- The drop off point is the pin the restaurant confirmed on the map (spec 0016). `confirmedPin` keeps the point and the
  `addressPinKey` it was confirmed for, and `isPinConfirmed` derives the state on every render; an address edit clears the
  point and its full address text. Get price and the dialog's Save never look an address up ("Show on map" does).
- Leaflet loads only through `PinMap`'s `next/dynamic` with `ssr: false` (it needs `window`); react-leaflet is ESM only and
  next/jest does not transform it, so tests mock `PinMapCanvas`. The map's box needs `isolate`, or Leaflet's z-index (up
  to 1000) paints over the sticky header and the fixed Get price bar.
- Floor and doorbell are their own fields (`dropoffFloor`, `dropoffDoorbell`; saved customer `floor`, `doorbell`;
  `addressLine2` is no longer written). `dropoffSellerNotes` is the note alone; `dropoffNotes` keeps "Floor: · Doorbell:"
  for admin, cut to its 255 character column by character (`Array.from`), never splitting an emoji.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
