# Launch checklist

`[x]` done in the code. `[ ]` still to do. **Owner** = needs your accounts, keys, money or decision.

## A. Right after merging (website)
- [ ] **Owner:** back up the database (Supabase → Database → Backups or an export).
- [x] `supabase/migrations/014_security_hardening.sql` applied to the live project (27 November 2026)
- [x] `supabase/migrations/015_chat_word_filter.sql` applied and checked on the live project (27 November 2026)
- [x] File clean-up deployed (`purge-files`, "Verify JWT" off), scheduled daily at 03:17 UTC and test run successful (27 November 2026)
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
- [x] Word filter for chat text and captions (015). Photos and voice notes are moderated by report and admin review only; a reviewer may ask about that.
- [ ] **Owner + native speakers:** review the blocked-word list (Admin → Reports → Blocked words) in each language
- [x] Reviewer sign-in built (password button on the sign-in screen, seed script)
- [ ] **Owner:** create the two review accounts and run the seed script, then put the passwords only in the store forms: follow `REVIEW_ACCESS.md`
- [ ] **Owner:** test on a real iPhone and Android phone: email code, Google, Apple, microphone, camera, voice notes, calls, notifications, deletion, Arabic right-to-left
- [ ] **Owner:** screenshots, descriptions, age rating (declare chat and user content), privacy forms (use `DATA_RULES.md`)
- [x] `com.mohleyla.app://auth` added to the Supabase redirect URLs (27 November 2026)

## D. Apple
- [x] Privacy manifest, permission texts in en/ar/id, Sign in with Apple, iOS simulator build succeeds
- [ ] **Owner:** Apple Developer Program (99 USD/year), team and signing in Xcode, App ID with Push and Sign in with Apple
- [ ] **Owner:** keys and secrets from `PUSH_NOTIFICATIONS.md` and `ACCOUNT_DELETION.md`
- [ ] **Owner:** iPad is enabled: test it and add iPad screenshots, or ask to make the app iPhone only
- [ ] Archive, check the exported app has production push, upload to TestFlight

## E. Google Play
- [x] Target API 36, release signing configuration, safe behaviour without Firebase (not yet run on Android)
- [x] Debug build works (Android Studio, `openjdk@21`: Android Studio's own Java is too new for the build tool). Installed on a Galaxy S21 Ultra (Android 15): email and Google sign-in work; the owner reported the app all good
- [ ] Bluetooth earphones in calls: the app does not request `BLUETOOTH_CONNECT`; test it
- [ ] Build the signed release app bundle and test it
- [ ] **Owner:** create and back up the upload keystore (`android/keystore.properties.example`)
- [ ] **Owner:** Firebase project and `google-services.json`, FCM secret (for notifications)
- [ ] **Owner:** Play Console account (25 USD). New personal accounts need 12 testers for 14 days before public release: start early
- [ ] **Owner:** Data safety form, deletion link `https://mohleyla.pages.dev/delete-account.html`, Play icon `android/store-assets/play-icon-512.png`

Store rules change: re-check Apple's and Google's current requirements on the day you submit.
