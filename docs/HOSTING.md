# Hosting

**Current production:** Cloudflare **Pages** at `https://mohleyla.pages.dev` (project `mohleyla`, branch `main`, build `npm run build`, output `dist`).
Supabase Site URL = that address; its redirect list holds only `https://mohleyla.pages.dev/**` and `http://localhost:5173/**`.
Netlify builds are stopped (kept as a fallback); the former `workers.dev` Worker was deleted.

MohLeyla is a static site (the Vite build in `dist/`). It runs on **Netlify** (`netlify.toml`) or **Cloudflare** (`wrangler.jsonc` +
`public/_headers`) with the same code. Keep `netlify.toml` and `public/_headers` in sync: both set the security headers, notably
`Permissions-Policy: microphone=(self)` (without it speaking practice cannot record). A unit test checks both.

## Cloudflare (free, no credit counter)

Static assets and bandwidth are free and unlimited on Cloudflare's free plan; builds are limited (about 500 a month).

1. Cloudflare dashboard -> **Workers & Pages -> Create -> Import a repository** -> pick `moibel/MohLeyla`.
   (If the repo is missing, give the *Cloudflare Workers & Pages* GitHub app access to it at github.com/settings/installations.)
2. Settings:
   - Project name: `mohleyla`
   - Build command: `npm run build`
   - Deploy command: `npx wrangler deploy` (reads `wrangler.jsonc`)
   - Production branch: `main`. Preview builds: switch off (saves build minutes).
3. **Build settings come from the repo.** The committed `.env.production` holds the public values (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_REQUIRE_SIGN_IN`, `VITE_GOOGLE_SIGN_IN`), so no dashboard variables are needed. Variables set in a host's
   dashboard override the file. Never put a `service_role` / `sb_secret_` key in it (a unit test fails if one appears).
4. Deploy. The address will be `https://mohleyla.<your-subdomain>.workers.dev` (a custom domain can be attached later).
5. **Update the places that know the address:**
   - Supabase -> Authentication -> URL Configuration: add `https://mohleyla.<your-subdomain>.workers.dev/**` to Redirect URLs
     (and change the Site URL when you cut over).
   - Google Cloud -> Auth Platform -> Clients -> your client: add the new origin to *Authorized JavaScript origins*.
     The redirect URI stays Supabase's `/auth/v1/callback`.
6. Test on the new address: sign in (email and Google), record a word, play audio, open a lesson link directly.
7. Tell learners the new address. Progress lives in their accounts, so they only sign in again (browser storage is per address).

Verified locally with `wrangler dev`: security headers, deep links (`/lesson/ar-01`), audio files with long caching, microphone recording.

## Skipping a Netlify deploy
Add `[skip ci]` to a commit message (for a merge: `gh pr merge --merge --subject "... [skip ci]"`) to avoid spending Netlify build credits
on changes that only matter to another host.
