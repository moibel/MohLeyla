# Access for app store reviewers

Reviewers cannot receive your sign-in emails, so they use two **test accounts with a password**. The sign-in screen has a
button, "App reviewer? Sign in with a password". It works only for accounts that were given a password in Supabase. The
app never creates password accounts, and no account or password is built into it or stored in git.

## One-time set-up (owner)
1. Supabase → **Authentication → Users → Add user → Create new user**. Turn **Auto Confirm User** on. Create two:
   - `mohleyla.support+review-teacher@gmail.com`
   - `mohleyla.support+review-student@gmail.com`

   (Gmail delivers `+` addresses to your support inbox.) Give each a **different, random password of at least 20
   characters**, made by a password manager. Keep them there. Never put them in git, chat or screenshots.
2. SQL Editor (the source menu must say **Database**): paste `supabase/seed/review_accounts.sql`, replace the two
   `REPLACE-...` addresses, and run it. It makes the teacher and student, one class, and a chat with a welcome message.
3. Sign in once with each account in the app to check the password works.

## Before every submission
Run the seed script again (it restores anything a reviewer changed: blocks, suspension, class, chat), check both
passwords still work, and check **Admin → Reports**. If a reviewer **deleted** an account, create it again and re-run.

## After the review
Change both passwords, or delete both users, until the next submission.

## What to type in the store forms
Google Play: **App content → App access → All or some functionality is restricted**. Apple: **App Review Information →
Sign-in required** and Notes. Put the passwords only in those fields.

```text
MohLeyla requires sign-in. Normal users sign in with Google, Apple (iPhone) or a one-time email code.
For review, use a test account:
1. On the first screen tap "App reviewer? Sign in with a password" (below the email field).
2. Student: mohleyla.support+review-student@gmail.com   Password: <enter in this form only>
   Teacher: mohleyla.support+review-teacher@gmail.com   Password: <enter in this form only>
3. First sign-in: confirm you are 13 or older, accept the terms, choose languages and level.
Lessons: Home → pick a course → open a lesson. Tap a word to hear it. Speaking practice uses the microphone; recordings
stay on the device.
Chat and safety: open the chat icon. The student has a chat with the teacher. "Report" is at the top of the chat and on each
received message; "Block" is next to it. Messages with offensive words are refused by an automatic filter. Reports are
reviewed by the administrator.
Calls: only teachers (and admins) can start them. Sign in as the teacher on a second device, open the same chat and tap the
voice or video call button while the student has the chat open.
Delete account: Settings → Account → Delete my account. (Please use the student account if you test this.)
```

## Risks and limits
- Anyone with a review password can use that account. The teacher account can create classes and chat only with people who
  join them with the code. Use long random passwords and rotate them after each review.
- Password sign-in was already possible through Supabase's public API for any account that has a password; this screen
  adds no new server door. Do not give real users' or admin accounts a password.
- Calls need two devices; reviewers may not test them.
