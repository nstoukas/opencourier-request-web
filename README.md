# opencourier-request-web

Standalone manual request web interface for OpenCourier.

## Runtime connection

- This app is standalone from `opencourier-adminweb`.
- It proxies partner requests to `opencourier-backend` server-side.
- Local backend default: `http://localhost:3000`.

## Manual request auth + routing

- Sign in with the co-op-issued email and password.
- The access token is stored on the server in an httpOnly cookie and is never exposed to browser JavaScript.
- Accounts are created by an administrator (self-service signup is disabled).
- The server API proxy forwards authenticated requests to the backend partner API (`/api/partner/v1`).

### Environment variables

- `MANUAL_REQUEST_PROXY_TARGET`: backend server URL (server-side only, default `http://localhost:3000`).
- `MANUAL_REQUEST_BASE_PATH`: partner API base path (server-side only, default `/api/partner/v1`).
- `NEXT_PUBLIC_MANUAL_REQUEST_API_MODE`: API mode (`partner`).
- `NEXT_PUBLIC_MANUAL_REQUEST_DEFAULT_PARTNER_ID`: pre-fills partner ID field.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: optional Google Maps API key.

## Address autofill

- The form currently uses OpenStreetMap (Nominatim) for address search + coordinate autofill.
- International addresses are supported via `Country Code`, `State / Province / Region`, and `Postal Code` fields.
- Google Maps autocomplete can be integrated later using `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and Places API setup.
