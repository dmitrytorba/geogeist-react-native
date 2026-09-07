# Privacy Policy for GeoGeist

**Effective date:** September 7, 2026

GeoGeist ("the app") is provided by Dmitry Torba.

## Information We Collect

When you create an account we store:

- Email address
- A one-way password hash (we never store the password itself)
- Optional display name and guide preferences (interests, tone, length, language)
- Tour transcripts (your messages and the guide replies)
- Coordinates attached to each saved tour

The app also uses:

- Location data when you grant permission, so the map and tour can start near you. If permission is denied, an approximate location may be inferred from IP as a fallback (`/ipcoords/`).
- Device information needed to run the app.

## API keys (bring your own)

To generate tours you paste an OpenAI-compatible API key (optional Google Places/Geocoding key and optional LLM base URL). Those keys:

- Are stored only on your device (Android: encrypted SecureStore) or, on the web, in tab-scoped `sessionStorage`
- Transit `https://tourapi.torb.uk` in memory for the duration of a request
- Are **not** written to our database or server disk
- Are **not** sold

## How We Use Information

We use this information to:

- Sign you in and keep you signed in
- Provide and resume personalized walking tours
- Operate the map and location features you use
- Diagnose crashes and keep the service secure

## Data Sharing

We do not sell personal data.

Tour generation is sent to the LLM provider you configured with your own key (typically OpenAI). If you also provide a Google key, place lookup uses Google. Hosting for the API is on our own server (`tourapi.torb.uk`).

## Data Retention

Account, tour transcripts, and tour coordinates stay on our server until you delete the tour or ask us to delete your account. Device-held keys last until you delete them in the app or uninstall / clear app storage.

## Your Choices

You may:

- Stop using the app at any time
- Log out (clears the session token on device)
- Delete a saved tour in the profile screen
- Delete your LLM/Google keys in the key screen
- Revoke location permission in device settings
- Email us to request account access or deletion

## Children

GeoGeist is not intended for children under 13.

## Security

Passwords are stored with scrypt. Sessions use bearer tokens (native) or an HttpOnly cookie (web). LLM keys never persist on the server.

## Changes to This Policy

We may update this policy from time to time. Material changes will be reflected by updating the effective date.

## Contact

For privacy questions, contact: **dmitrytorba@gmail.com**
