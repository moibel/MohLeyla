# Account deletion

Apple (guideline 5.1.1(v)) and Google Play require that people can delete their account from inside the app. **Settings -> Account -> Delete my account** does that, on the website and in both phone apps.

## What the person sees
A dialog lists what is deleted, needs a ticked box ("I understand this cannot be undone"), and then deletes at once. Nothing is removed if the server fails (an error says so and they can try again). Afterwards they are signed out. Progress saved only on their own device stays there (a personal device) or is removed too (a shared device where sign-in is required).

## What is deleted (all tested in `supabase/tests/account_deletion.test.sql`, 25 checks)
Sign-in and profile/role, cloud progress, class memberships, classes they teach (with members and class announcements), phone notification tokens, **every chat they were in with its voice notes, photos and call lines (the other person loses that chat too)**, rewards and announcements addressed to their email, and the chat files in storage. Things they created for other people (announcements, content switches, rewards they gave) stay, with the author left empty.
- **The only administrator cannot delete their account** (an error explains: make someone else an admin first), so the app never ends up without one.
- Admins can read chats; deleting an account therefore also removes that chat from the admin's view.

## How it works
App -> Edge Function **`delete-account`** (`supabase/functions/delete-account`) with the person's own token -> `account_delete_prepare` (refuses the last admin, lists chat files) -> **Apple token revoked** (iPhone, Apple accounts: the app shows Apple's sheet once more to get a fresh code) -> `auth.admin.deleteUser` (everything cascades) -> `account_delete_cleanup` (rewards/announcements by email) -> files removed from the `chat-files` bucket. The person is taken from the token, never from the request. The two database helpers can only be called by the service role.

## Setup
1. Apply `supabase/migrations/012_account_deletion.sql` (SQL editor; additive, needs 002-011).
2. Deploy the function and **turn off the platform's "Verify JWT" check** for it (Dashboard -> Edge Functions -> delete-account -> Settings, or `--no-verify-jwt`). Reason: that check only understands the old legacy-secret signature, and projects on the newer ES256 signing keys (check `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`) would have every real sign-in rejected. This is safe because the function verifies the token itself: it asks Supabase Auth who the token belongs to and refuses anything else (no header, the public anon key, a garbage token: all return 401, tested live).
```bash
supabase functions deploy delete-account --no-verify-jwt
```
3. **Apple accounts only** (so the Apple token is revoked, as the App Store requires): in developer.apple.com create (or reuse) a key with **Sign in with Apple** enabled, then:
```bash
supabase secrets set APPLE_TEAM_ID='<Team ID>' APPLE_KEY_ID='<Key ID>' APPLE_CLIENT_ID='com.mohleyla.app'
supabase secrets set APPLE_KEY_P8="$(cat AuthKey_XXXXXXXXXX.p8)"
```
If these are not set the account is still deleted, but the Apple token is **not** revoked (the function reports `appleRevoked: false`). Set them before submitting to the App Store.
4. Google Play asks for a web link where people can learn how to delete their account: use `https://mohleyla.pages.dev/delete-account.html` (this page is public and needs no sign-in). Add a contact address to it first if you want people who cannot sign in to be able to reach you.

## Known limits
- Not tested against the live Supabase project, a real Apple ID, or a real phone (SQL rules, function logic with real signatures, the app flow with fakes, and the browser flow with a mocked server are tested).
- Deleting is immediate and permanent; there is no grace period or "undo".
- Deleting an account does not delete progress that exists only on other devices that never signed in.
