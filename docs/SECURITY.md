# Security

Start here: [security rules](SECURITY_RULES.md) · [login rules](LOGIN_RULES.md) · [data rules](DATA_RULES.md) · [threat map](THREAT_MAP.md) · [launch checklist](LAUNCH_CHECKLIST.md)

## What is checked automatically (every `npm test` / `npm run test:e2e`)
- `src/test/security.test.js` (24 checks): no service-role or secret key in the app or native projects; the content security policy (scripts only from the app, no inline script, no eval, network only to the app, its Supabase project and the audio host, the hosting headers equal the build's policy); no `eval` / `innerHTML` / `dangerouslySetInnerHTML` / `http://` calls in the code; the app's sign-in link accepts only its own exact address; Android has no backups, no cleartext traffic, one exported screen, only the permissions in use; iOS has no App Transport Security exceptions and explains every permission; Capacitor loads only the bundled app; every database table has row level security and every `security definer` function pins its `search_path`; no admin/chat/call function is granted to anonymous visitors.
- `tests/e2e/security.spec.js`: the main screens and a lesson run with **zero** policy violations in en/ar/id; an injected inline script, a script from another site, a tracking image and an `onerror` handler are all blocked; the app cannot send data to an unlisted host; URL text is never run as markup; tokens in the address are never logged.
- `supabase/tests/*.test.sql`: who may read or write what, including that students cannot reach other students' data, admins cannot write inside chats, nobody can listen to calls.

## Push notifications and Sign in with Apple
- Apple sign-in: the native sheet returns a signed token that contains the SHA-256 of a one-time random value; Supabase checks it against the raw value, so a stolen token cannot be replayed. Only the Apple "Services"/bundle id that you list in Supabase can sign in.
- Push: device tokens live in a table nobody can read from the app (only register/remove your own, at most 10 per person; a token moves if another person signs in on that phone). The database tells the Edge Function through a shared secret (checked in constant time before anything is read); keys (`.p8`, Firebase) exist only as Edge Function secrets. Notifications never contain message text; a tap can only open `/chat`, `/chat/<id>` or `/notifications`. A push failure can never block the original action. Checked by `supabase/tests/push.test.sql` (39), `src/test/push-function.test.js` (15), `src/test/push.test.js` (22) and the checks in `src/test/security.test.js`.

## Account deletion
The Edge Function takes the person from their own sign-in token (never from the request) and checks it itself with Supabase Auth (the platform's "Verify JWT" switch is off for it because it only understands legacy-secret tokens and this project uses ES256 keys; a missing header, the public anon key and a garbage token are all refused with 401). The database helpers can be called only by the service role (tested: signed-in people, admins and visitors are refused). The last administrator cannot be deleted. Only well-formed chat file paths are removed from storage. Apple's token is revoked when the Apple secrets are configured. See `docs/ACCOUNT_DELETION.md`; checks in `supabase/tests/account_deletion.test.sql`, `src/test/delete-account.test.js`, `src/test/security.test.js`, `tests/e2e/delete-account.spec.js`.

## Headers (website)
`public/_headers` (Cloudflare) and `netlify.toml` send: Content-Security-Policy (same policy as the build, plus `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, Referrer-Policy, Permissions-Policy. Change the policy only in `scripts/csp.mjs`; the test fails if the headers drift from it.

## Dependencies (`npm audit`)
Shipped code: 2 moderate advisories in `react-router` (a server-side-rendering bug; this app has no server rendering, so it does not apply; fixing it needs a major upgrade to React Router 7, planned separately). Build and test tools only (vitest, vite dev server, esbuild, sharp, glob): not part of what users run. Re-run `npm audit` before each release.

## Not covered (be honest)
No penetration test by a human, no test against the live Supabase project from outside, no mobile-device security test (jailbreak/root, TLS pinning), no check of the Google OAuth consent screen. (The Google client secret that was exposed earlier has been replaced.) Calls use public STUN servers and no TURN relay.
