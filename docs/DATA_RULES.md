# Data rules

## Principles
1. Collect only what a feature needs. No ads, analytics or trackers.
2. Practice recordings never leave the device.
3. Say what is true: any change to what is stored or who can see it updates `public/privacy.html` (ar, en, id), this file, `ios/App/App/PrivacyInfo.xcprivacy` and the store privacy forms in the same change.
4. Accounts are for ages 13 and up.
5. Real people's data is never copied into tests, issues or chat.

## Inventory
| Data | Where | Who can read | Kept until |
|---|---|---|---|
| Email, name, sign-in method and dates, Google picture link | Supabase Auth | the person; admins; their class teacher (name, email); chat partners (name) | account deletion |
| Set-up answers (13+, terms version and time, languages, levels) | Auth metadata; `terms` record | the person; server checks | account deletion |
| Learning progress | `progress` | the person; summaries for their class teacher and admins | "delete cloud data" or account deletion |
| Role, classes, memberships, class bans, join attempts | database | self, class teacher, admins as needed | removal; attempts about a day |
| Chat text, read marks | database | the two people; admins | account deletion of either person |
| Chat photos, voice notes | private storage | the two people and admins, for 90 days | daily purge (90 days, removed messages, unsent uploads after 24 h) |
| Call records / connection details (may include IP) | database | the two people | records with the chat; details deleted at call end or within about a day |
| Reports (with message text snapshot), blocks, suspension | database | admins (reports); the blocker | reports are kept for safety after chat or account deletion, with the account link removed |
| Removed messages | database (marked removed) | admins | with the chat |
| Rewards, announcements | database | recipient, admins | account deletion (for those addressed to the email) |
| Push token, platform, language | database | server only | sign-out, notifications off, account deletion |
| On the device: session, progress, caches, set-aside progress of another user | browser / app storage | anyone with technical access to the device | sign-out (session, caches), reset, or clearing the app |

## Requests from people
- **See or correct:** answer from `mohleyla.support@gmail.com` only to the address on the account.
- **Delete:** in the app (Settings → Account), or by email from the account's address (delete it from Supabase after checking the sender).
- **Child under 13:** delete the account.
- **A breach or leaked key:** replace keys, revoke sessions in Supabase, check logs, tell affected people and any authority your law requires.

## Backups
Supabase keeps backups according to your plan. Check what your plan keeps and for how long, and make your own export before applying a database migration.
