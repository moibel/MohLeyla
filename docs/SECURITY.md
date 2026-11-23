# Security

## What is checked automatically (every `npm test` / `npm run test:e2e`)
- `src/test/security.test.js` (24 checks): no service-role or secret key in the app or native projects; the content security policy (scripts only from the app, no inline script, no eval, network only to the app, its Supabase project and the audio host, the hosting headers equal the build's policy); no `eval` / `innerHTML` / `dangerouslySetInnerHTML` / `http://` calls in the code; the app's sign-in link accepts only its own exact address; Android has no backups, no cleartext traffic, one exported screen, only the permissions in use; iOS has no App Transport Security exceptions and explains every permission; Capacitor loads only the bundled app; every database table has row level security and every `security definer` function pins its `search_path`; no admin/chat/call function is granted to anonymous visitors.
- `tests/e2e/security.spec.js`: the main screens and a lesson run with **zero** policy violations in en/ar/id; an injected inline script, a script from another site, a tracking image and an `onerror` handler are all blocked; the app cannot send data to an unlisted host; URL text is never run as markup; tokens in the address are never logged.
- `supabase/tests/*.test.sql`: who may read or write what, including that students cannot reach other students' data, admins cannot write inside chats, nobody can listen to calls.

## Headers (website)
`public/_headers` (Cloudflare) and `netlify.toml` send: Content-Security-Policy (same policy as the build, plus `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, Referrer-Policy, Permissions-Policy. Change the policy only in `scripts/csp.mjs`; the test fails if the headers drift from it.

## Dependencies (`npm audit`)
Shipped code: 2 moderate advisories in `react-router` (a server-side-rendering bug; this app has no server rendering, so it does not apply; fixing it needs a major upgrade to React Router 7, planned separately). Build and test tools only (vitest, vite dev server, esbuild, sharp, glob): not part of what users run. Re-run `npm audit` before each release.

## Not covered (be honest)
No penetration test by a human, no test against the live Supabase project from outside, no mobile-device security test (jailbreak/root, TLS pinning), no check of the Google OAuth consent screen. The Google client secret that was exposed earlier should still be rotated. Calls use public STUN servers and no TURN relay.
