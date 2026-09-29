# opencourier-request-web

## Overview

The partner (restaurant) facing request UI: Next.js 14, React, Radix UI, Tailwind,
react-hook-form, zod. Dev server on port 3090, using the backend's `partner` API.

**Read the workspace rulebook first: [`../AGENTS.md`](../AGENTS.md).** This repo sits inside the co-op workspace, and that file binds it: co-op values, locked decisions, domain language, boundaries, and the `aiflow.sh` pipeline every change goes through. Tools that stop at this repo's git root will not find it on their own. This file only adds what is specific to this component.

## Key files

| File | Owns |
|---|---|
| `src/pages/api/partner-auth/` | Server-side login and logout; sets the httpOnly `oc_partner_session` cookie |
| `src/pages/api/partner-proxy/[...path].ts` | Attaches the bearer token server-side and forwards to the backend |
| `src/utils/partnerSession.ts` | Reads `MANUAL_REQUEST_PROXY_TARGET`, the backend address |
| `src/pages/manual-request/` | The request form itself |

## Commands

Yarn 1.22, **not Corepack**: run `node node_modules/.bin/next dev -p 3090` and
`node node_modules/.bin/jest`. There is no lint script. Full list in the workspace rulebook.

## Gotchas

- The browser never holds a credential. Never add an API key path, not even as a fallback.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
