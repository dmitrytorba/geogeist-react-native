# GeoGeist accounts, history, and BYOK

Public users get a profile, saved tours, and personalized guides. The operator does not pay OpenAI or Google Places for strangers. Bring-your-own-key is a ship gate.

Linear project: **GeoGeist**. Backend: `/home/d/ai-tours-py`. Native: `/home/d/geogeist-react-native`. Web (shared API): `/home/d/ai-tours-react`.

Linear document: https://linear.app/botty-torba/document/geogeist-accounts-history-and-byok-design-1812bbcc0253

## Tickets

- **BOT-732** Epic: GeoGeist accounts, history, and BYOK — https://linear.app/botty-torba/issue/BOT-732/epic-geogeist-accounts-history-and-byok
- **BOT-733** API: users, sessions, signup/login/logout/me — https://linear.app/botty-torba/issue/BOT-733/api-users-sessions-signuploginlogoutme
- **BOT-734** API: BYOK hard-gate on /stream/ (no operator keys) — https://linear.app/botty-torba/issue/BOT-734/api-byok-hard-gate-on-stream-no-operator-keys
- **BOT-735** API: persist tours, messages, and guide prefs — https://linear.app/botty-torba/issue/BOT-735/api-persist-tours-messages-and-guide-prefs
- **BOT-736** Native: login and signup screens — https://linear.app/botty-torba/issue/BOT-736/native-login-and-signup-screens
- **BOT-737** Native: BYOK OpenAI key in SecureStore — https://linear.app/botty-torba/issue/BOT-737/native-byok-openai-key-in-securestore
- **BOT-738** Native: profile, guide prefs, and history resume — https://linear.app/botty-torba/issue/BOT-738/native-profile-guide-prefs-and-history-resume
- **BOT-739** Privacy policy and Play Data safety for accounts — https://linear.app/botty-torba/issue/BOT-739/privacy-policy-and-play-data-safety-for-accounts
- **BOT-740** Web: login and BYOK for ai-tours-react — https://linear.app/botty-torba/issue/BOT-740/web-login-and-byok-for-ai-tours-react

## Measured now (2026-09-07)

- Live `POST https://tourapi.torb.uk/stream/` with `{content, user_location, history}` returns **HTTP 200** and ~18.6 KB of SSE (`chat_stream` / `chat_stop`). **No auth header.** Model is operator `ChatOpenAI(model="gpt-4o")` via `OPENAI_API_KEY` in `/home/d/ai-tours-py/.env`.
- Live `GET /ipcoords/` → **HTTP 200** `{"lat":38.5816,"lng":-121.4944}`. No auth.
- CORS `allow_origins=["*"]` on FastAPI.
- Unit: `ai-tours-backend.service` → `uvicorn server:app --host 127.0.0.1 --port 18000`, `EnvironmentFile=-/home/d/ai-tours-py/.env`.
- Native `App.js` keeps `messages` in React state only. Kill the app, history is gone. Each turn POSTs the in-memory list.
- Native has **no** login, **no** `expo-secure-store`. `package.json` is Expo 54 + maps/location/markdown/webview.
- `geocode_tools.py` reverse geocode + Places use `os.environ["GOOGLE_API_KEY"]` on every tool call.
- `PRIVACY.md` already says “Account and authentication data (if you sign in)” — the product promised accounts; the code did not.
- Play: **Location Scan** `com.torba.d.geogeist` 1.0.0 / versionCode 12 is on production. More installs without this epic burn operator keys.
- GeoGeist board at design time: BOT-266 (Play), BOT-674 (streaming run-on). No prior login/BYOK tickets.

## Goals

1. Email + password accounts. Each user has a profile.
2. Server-side tour history so a user can resume yesterday’s guide.
3. User-specific guide behavior (name, interests, tone, length, language).
4. Before any further public ship: `/stream/` must not use operator `OPENAI_API_KEY` or `GOOGLE_API_KEY`.

## Non-goals

- OAuth / Google / Apple Sign-In
- SMTP email verification
- Operator-funded free tier, prepaid credits, or markup
- Storing LLM or Google keys in the database
- Per-user Google Maps SDK keys (the APK still embeds the operator Maps key; separate follow-up)
- iOS
- Cloudflare Access (tourapi is already public HTTP 200)
- Reusing Chores (BOT-709) or Habits (BOT-705 / BOT-707) auth
- Changing the Play application id or listing name

## Architecture

Single FastAPI process, SQLite file `/home/d/ai-tours-py/data/geogeist.sqlite`.

```
Native / Web  --session-->  FastAPI (tourapi.torb.uk)
                 |                 |
                 |  X-LLM-Api-Key  |  ChatOpenAI(api_key=user)
                 |  X-Google-Api-Key?  Places/Geocode only if present
                 v
           Expo SecureStore / web sessionStorage
           (keys never written to SQLite)
```

### Auth

- Public signup. This is a consumer app, not a household.
- Password: `hashlib.scrypt`, min 8 chars, unique email (case-insensitive).
- Native: `Authorization: Bearer gg_u_<token>` (prefix distinct from Chores `fc_u_`). Persist token in SecureStore.
- Web: `gg_session` cookie, `HttpOnly`, `Secure`, `SameSite=Lax`.
- `GET /me`, `POST /auth/signup`, `POST /auth/login`, `POST /auth/logout`.
- Invalid/missing session on `/stream/`, `/tours*`, `/me` → **401** `{"error":"auth_required"}`.
- `/ipcoords/` stays anonymous (location fallback only).

### BYOK (ship gate)

Production unit file must **not** set `ALLOW_OPERATOR_KEYS`.

- No session → 401 `auth_required` — do not call OpenAI
- Session, no `X-LLM-Api-Key` → 401 `llm_key_required` — do not call OpenAI
- Session + LLM key, no Google key → stream with Wikipedia + `move_map` only. **Do not** read env `GOOGLE_API_KEY`
- Session + LLM + Google key → current tools, Google key from the header
- Optional `X-LLM-Base-Url` (default `https://api.openai.com/v1`). OpenAI-compatible only (OpenAI, OpenRouter, compatible proxies).
- Never log `Authorization`, `X-LLM-Api-Key`, `X-LLM-Base-Url`, `X-Google-Api-Key`.
- Never persist those headers.
- Tests must fail if `send_message` constructs `ChatOpenAI()` without a caller-supplied key while `ALLOW_OPERATOR_KEYS` is unset.

### History

Tables:

- `tours(id, user_id, title, lat, lng, created_at, updated_at)`
- `messages(id, tour_id, role, content, created_at)`

API:

- `GET /tours/` — newest first, current user only
- `POST /tours/` — `{lat, lng, title?}` → empty tour
- `GET /tours/{id}` — messages
- `PATCH /tours/{id}` — title
- `DELETE /tours/{id}`
- `POST /stream/` body gains optional `tour_id`. After `chat_stop`, append the human turn + assistant turn. If `tour_id` omitted, create a tour from `user_location`.

Cross-user tour ids → 404, not 403 (no existence leak).

### User-specific guides

`users.display_name` and `users.guide_prefs` JSON:

```json
{"interests": "civil war, food", "tone": "casual", "language": "en", "length": "normal"}
```

`tone`: `casual` | `scholarly` | `kid`. `length`: `short` | `normal` | `long`.

`PATCH /me` updates display name + prefs. System prompt in `server.py` interpolates them. A saved tour **is** a personal guide; v1 does not add a separate persona CMS.

### Native (`geogeist-react-native`)

1. Cold start: map + location still work.
2. Chat disabled until session exists → login/signup.
3. Chat still disabled until SecureStore has an LLM key → “Add your OpenAI API key” with a link to `https://platform.openai.com/api-keys`. Show last 4 chars only.
4. Profile: email, logout, key status, guide prefs, tour list, tap to resume (`history` loaded into `messages`, `tour_id` on the next stream).

Add `expo-secure-store`. Do not put keys in `AsyncStorage` or EAS env.

### Web (`ai-tours-react`)

Same gate. Cookie session + key in `sessionStorage` (tab-scoped; do not use `localStorage` for the LLM key). Required once `/stream/` is locked, or the public web client is dead.

### Privacy / Play

Update `PRIVACY.md`: email, password hash, tour transcripts, and coordinates attached to tours. LLM keys transit the API in memory and are not stored. Play Data safety: account info, location, user-generated content.

## Ship order

1. Users + sessions + signup/login API (BOT-733)
2. BYOK hard-gate on `/stream/` (BOT-734) — money
3. Tours history + guide prefs APIs (BOT-735)
4. Native login (BOT-736)
5. Native BYOK screen (BOT-737)
6. Native profile + history (BOT-738)
7. Privacy + Play data safety (BOT-739)
8. Web login + BYOK (BOT-740)
