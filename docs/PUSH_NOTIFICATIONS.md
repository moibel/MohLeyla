# Push notifications and Sign in with Apple: setup

The code for both is finished and tested as far as it can be without your accounts. **Nothing works end to end until you do the steps below**, because they need your Apple Developer, Firebase and Supabase accounts. Until then the app behaves as before: the Settings switch only appears in the phone apps, and nothing is sent because no push address is stored.

## Current state of the live project (23 Nov 2026)
Done and verified: migrations 011 and 012 applied; Edge Functions `push` (Verify JWT off, it uses the shared secret) and `delete-account` deployed from this repo; `pg_net` enabled; `push_config` row created with a database-generated secret that matches the `PUSH_SECRET` Edge Function secret; the server role granted read/delete on `push_tokens`. A test call from the database through pg_net to the function returned `200 {"sent":0,...}` (secret accepted, token lookup working). **Still needed from you:** the Apple, Firebase and `FCM_SERVICE_ACCOUNT` / `APNS_*` / `APPLE_*` secrets (steps below), then a real-device test.

## What people get
- A notification on the phone for: a new chat message, an incoming call, an announcement, a reward.
- It only names the sender ("Sara sent you a message", "Tariq is video calling you") in the person's app language (ar/en/id). **The text of a chat message is never put in a notification.** Rewards say what was received, not why.
- Tapping it opens the right screen (the chat, or Notifications). Only `/chat`, `/chat/<id>` and `/notifications` can be opened this way.
- Each person turns it on in **Settings -> Notifications on this phone** (the phone asks permission then). Signing out stops notifications for that person on that phone.
- An incoming call arrives as a normal notification and rings in the app when opened (within about a minute). A native "phone call" screen (CallKit on iPhone) is a separate piece of work.

## How it works
`register_push_token()` stores the phone's token -> a trigger on new messages / calls / announcements / rewards calls the **Edge Function `push`** (`supabase/functions/push`) through `pg_net` with a shared secret -> the function looks up the tokens and talks to Apple (APNs) and Google (FCM). A failure anywhere never blocks the message, call, announcement or reward itself. Rules are in `supabase/migrations/011_push.sql` (39 checks in `supabase/tests/push.test.sql`); the sending logic is unit-tested in `src/test/push-function.test.js` (real signatures checked with generated keys).

## Setup steps (in this order)
### 1. Apple (needed for iPhone push and Sign in with Apple)
1. developer.apple.com -> Identifiers -> App ID `com.mohleyla.app` -> enable **Push Notifications** and **Sign in with Apple**.
2. Keys -> new key with **Apple Push Notifications service (APNs)** -> download the `.p8` once. Note the **Key ID** and your **Team ID**.
3. Xcode -> the App target -> Signing & Capabilities: pick your team (automatic signing). The two capabilities are already in `App.entitlements`.

### 2. Supabase
1. **Sign in with Apple:** Authentication -> Providers -> Apple -> enable; in **Client IDs** put `com.mohleyla.app` (the app's bundle id; this is what the native sign-in uses). Web/Android Apple sign-in additionally needs a Services ID and a generated client secret (optional; set `VITE_APPLE_SIGN_IN=true` in `.env.production` only after that works).
2. **Redirect URLs** (also needed for Google in the app): add `com.mohleyla.app://auth`.
3. Database -> Extensions -> enable **pg_net**.
4. Apply `supabase/migrations/011_push.sql` (SQL editor). Safe before the function exists.
5. Deploy the function and set its secrets (Supabase CLI, `supabase login` and `supabase link` first):
```bash
supabase functions deploy push --no-verify-jwt
supabase secrets set PUSH_SECRET='<a long random string, at least 24 characters>'
supabase secrets set APNS_TEAM_ID='<Team ID>' APNS_KEY_ID='<Key ID>' APNS_TOPIC='com.mohleyla.app'
supabase secrets set APNS_KEY_P8="$(cat AuthKey_XXXXXXXXXX.p8)"
supabase secrets set APNS_ENV='production'   # use 'sandbox' while testing builds run from Xcode
```
6. Tell the database where the function is (SQL editor, **only you can read this table**):
```sql
insert into public.push_config (url, secret)
values ('https://<project-ref>.supabase.co/functions/v1/push', '<the same PUSH_SECRET>')
on conflict (id) do update set url = excluded.url, secret = excluded.secret;
```
`--no-verify-jwt` is deliberate: the database calls the function, not a signed-in user; the function itself rejects any request without the shared secret.

### 3. Android (Firebase)
1. console.firebase.google.com -> new project -> add an Android app `com.mohleyla.app` -> download **google-services.json** into `android/app/` (the build applies it automatically when present).
2. Project settings -> Service accounts -> generate a private key (JSON) -> `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat service-account.json)"`. **Never commit that file.**

### 4. Test
1. Build the app (`npm run ios`), sign in, Settings -> turn on Notifications on this phone, allow.
2. Check a row appeared: `select platform, lang, created_at from public.push_tokens;`
3. From another account (or the admin), send that person a chat message with the app in the background.
4. Nothing arrives? Supabase -> Edge Functions -> push -> Logs (401 = secrets differ; "skipped" counts = APNs/FCM secrets missing) and `select * from net._http_response order by created DESC limit 5;`.

## Known limits
- Not tested on a real iPhone or Android phone (this was built and tested with fakes, SQL tests and the iPhone simulator). The Apple sign-in sheet opens in the simulator; the full sign-in and the notification delivery need a real Apple ID / device and the accounts above.
- A notification is "best effort": phones in battery saver or with notifications blocked in system settings will not show it. The app notices a blocked permission and switches the setting off.
- Announcements to *everyone* send to every registered phone from one function call (fine for hundreds of people; revisit for many thousands).
- Account deletion (an Apple and Google Play requirement) is built: see `docs/ACCOUNT_DELETION.md`.
