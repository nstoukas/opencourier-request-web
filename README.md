# opencourier-request-web

Standalone manual request web interface for OpenCourier.

## Runtime connection

- This app is standalone from `opencourier-adminweb`.
- It connects directly to `opencourier-backend` via `NEXT_PUBLIC_API_URL`.
- Local backend default: `http://localhost:3000`.

## Manual request auth + routing

- `NEXT_PUBLIC_MANUAL_REQUEST_API_MODE` (optional): `admin` (default) or `partner`.
	- `admin` uses `/api/admin/v1/manual-request`.
	- `partner` uses `/api/partner/v1`.
- `NEXT_PUBLIC_MANUAL_REQUEST_BASE_PATH` (optional): explicit override for API base path.
- `NEXT_PUBLIC_MANUAL_REQUEST_AUTH_MODE` (optional): `bearer` (default), `api-key`, or `none`.
	- `bearer`: sends `Authorization: Bearer <token>`.
	- `api-key`: sends `x-api-key: <api key>`.
	- `none`: skips bearer token and hides debug auth UI.
- `NEXT_PUBLIC_MANUAL_REQUEST_DEFAULT_PARTNER_ID` (optional): pre-fills `Request Details -> Partner ID`.
- `NEXT_PUBLIC_MANUAL_REQUEST_API_KEY`: partner API key for `api-key` auth mode.

### Debug auth workflow

- In `bearer` mode: use `Login & Set Token` and validate against `/api/admin/v1/auth/me`.
- In `api-key` mode: set partner key and validate against `/api/partner/v1/auth/me`.
- `Token Source` shows whether active credential comes from `localStorage` or env.
- If credential validation fails, refresh JWT/API key before testing quote/delivery APIs.

### Partner-first sign in workflow

- Use `Sign In Partner` with partner username/password.
- If the partner account does not exist, use `Sign Up Partner` to create it.
- The backend returns the partner `apiKey` associated with that account, and request-web stores it for subsequent manual request API calls.
- Keep local env aligned:
	- `NEXT_PUBLIC_MANUAL_REQUEST_API_KEY=<your partner key>`

## Address autofill

- The form currently uses OpenStreetMap (Nominatim) for address search + coordinate autofill.
- International addresses are supported via `Country Code`, `State / Province / Region`, and `Postal Code` fields.
- Google Maps autocomplete can be integrated later using `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and Places API setup.
