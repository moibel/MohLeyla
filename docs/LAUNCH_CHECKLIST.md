# Launch checklist

`[x]` done in the code. `[ ]` still to do. **Owner** = needs your accounts, keys, money or decision.

## A. Right after merging (website)
- [ ] **Owner:** back up the database (Supabase → Database → Backups or an export).
- [ ] **Owner:** run `supabase/migrations/014_security_hardening.sql` once in the SQL editor (013 is already applied). Do it right after the new website is live.
- [ ] **Owner:** deploy the file clean-up: set the secret `PURGE_SECRET` (24+ random characters), deploy `supabase/functions/purge-files` (with "Verify JWT" off), enable `pg_cron` and `pg_net`, and run the commented schedule at the end of migration 014. **Until this is done, old chat files are not deleted and the privacy policy is not yet true.** The first run permanently deletes the backlog.
- [ ] **Owner:** check the Supabase settings in `LOGIN_RULES.md` (Confirm email ON, redirect list, templates).
- [ ] **Owner:** check that real users have a confirmed email (Authentication → Users); others stop seeing rewards and personal announcements.
- [ ] Test live: sign in with a new email, finish the set-up, send a chat message, report it, resolve it.
- [ ] **Owner:** open the admin Reports tab daily.

## B. Security and quality
- [x] Row rules, role checks, safe handling of user data, block, report, suspend, rate limits
- [x] PKCE sign-in, safe sign-out, no progress mixing between accounts
- [x] Privacy policy, terms and delete-account page match the code (ar, en, id)
- [ ] **Owner:** have a lawyer or knowledgeable person read the privacy policy and terms for your countries
- [ ] **Owner:** 2-step verification on Supabase, GitHub, Cloudflare, Google (including both Gmail addresses), Apple
- [ ] Outside security test against the live project
- [ ] **Owner:** native-speaker review (all Beta courses; also the Arabic and Indonesian of the new screens and policy)
- [ ] **Owner:** confirm you may distribute the audio made with macOS voices and with ElevenLabs in a store app (check both licences)
- [ ] Own email domain (Resend) if sign-in codes land in spam or you pass Gmail's daily limit

## C. Both app stores
- [x] MohLeyla icons and splash screens; signing files git-ignored
- [x] In-app account deletion and a public deletion page
- [x] Report, block, terms acceptance, 13+, published support email
- [ ] **Decide:** content filtering. Apple guideline 1.2 asks for a way to filter objectionable content; today there is moderation by report and admin review only. A basic word filter for chat is the next thing to build before submitting.
- [ ] **Owner + developer:** a way for store reviewers to sign in (they cannot receive your email codes). Prepare a test student and teacher with an existing chat and written review notes.
- [ ] **Owner:** test on a real iPhone and Android phone: email code, Google, Apple, microphone, camera, voice notes, calls, notifications, deletion, Arabic right-to-left
- [ ] **Owner:** screenshots, descriptions, age rating (declare chat and user content), privacy forms (use `DATA_RULES.md`)
- [ ] **Owner:** add `com.mohleyla.app://auth` to Supabase redirect URLs

## D. Apple
- [x] Privacy manifest, permission texts in en/ar/id, Sign in with Apple, iOS simulator build succeeds
- [ ] **Owner:** Apple Developer Program (99 USD/year), team and signing in Xcode, App ID with Push and Sign in with Apple
- [ ] **Owner:** keys and secrets from `PUSH_NOTIFICATIONS.md` and `ACCOUNT_DELETION.md`
- [ ] **Owner:** iPad is enabled: test it and add iPad screenshots, or ask to make the app iPhone only
- [ ] Archive, check the exported app has production push, upload to TestFlight

## E. Google Play
- [x] Target API 36, release signing configuration, safe behaviour without Firebase (not yet run on Android)
- [ ] **Owner:** install Android Studio and JDK 21; build the app bundle and test it (**Android has never been built**)
- [ ] **Owner:** create and back up the upload keystore (`android/keystore.properties.example`)
- [ ] **Owner:** Firebase project and `google-services.json`, FCM secret (for notifications)
- [ ] **Owner:** Play Console account (25 USD). New personal accounts need 12 testers for 14 days before public release: start early
- [ ] **Owner:** Data safety form, deletion link `https://mohleyla.pages.dev/delete-account.html`, Play icon `android/store-assets/play-icon-512.png`

Store rules change: re-check Apple's and Google's current requirements on the day you submit.
