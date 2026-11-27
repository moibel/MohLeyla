# iOS and Android app

The store apps are the same React app inside a native shell ([Capacitor](https://capacitorjs.com)). One codebase serves the website and both apps.

## Build and run
```bash
npm run build:native   # builds dist-native/ (no service worker, audio not bundled) and copies it into ios/ and android/
npm run ios            # build + open Xcode (pick a simulator or your iPhone, press Run)
npm run android        # build + open Android Studio (needs JDK 21 and the Android SDK)
```
- **Audio** (about 50 MB) is not inside the app: clips are fetched on demand from `https://mohleyla.pages.dev` (set `NATIVE_AUDIO_BASE` to use another host). Without internet the app falls back to the phone's own voices.
- **Sign-in:** the email code works as on the web. "Continue with Google" opens the system browser (Google refuses embedded web views) and returns through the app's own link `com.mohleyla.app://auth`. **Before it works you must add `com.mohleyla.app://auth` to Supabase -> Authentication -> URL Configuration -> Redirect URLs.**
- **Bundle id** `com.mohleyla.app` (iOS and Android). Change it before the first store upload if you want another: it cannot be changed afterwards. Places: `capacitor.config.json`, `ios/App/App.xcodeproj` (PRODUCT_BUNDLE_IDENTIFIER), `android/app/build.gradle`, `src/utils/platform.js` (`NATIVE_AUTH_REDIRECT`), the URL scheme in `Info.plist` and `AndroidManifest.xml`; `src/test/security.test.js` checks they agree.

## What has been tested, and what has not
| Checked | How |
|---|---|
| iOS app builds and starts in the iPhone simulator, shows the sign-in screen, fills the screen, respects the notch | `xcodebuild` + simulator |
| Same code in a browser: all 223 browser tests, 198 unit tests | `npm test`, `npm run test:e2e` |
| **Not yet tested**: Android build (this Mac has no JDK or Android SDK), a real iPhone/Android phone, Google sign-in through the system browser, voice notes, camera and calls inside the apps, store review | needs your devices and accounts |

## Prepared for the stores
- **Icons and splash:** `npm run generate:native-assets` (only when `assets-src/logo-master.png` changes; commit the output). Play listing icon: `android/store-assets/play-icon-512.png`.
- **iOS:** privacy manifest `ios/App/App/PrivacyInfo.xcprivacy` (no tracking; keep it and the store forms in step with `DATA_RULES.md`); permission texts and app languages in en, ar, id; no background modes (notifications are visible alerts only).
- **Android signing:** copy `android/keystore.properties.example` to `android/keystore.properties`, or set `MOHLEYLA_KEYSTORE_FILE`, `MOHLEYLA_KEYSTORE_PASSWORD`, `MOHLEYLA_KEY_ALIAS`, `MOHLEYLA_KEY_PASSWORD`. Without them the release build is unsigned. Keys are git-ignored; never commit them.
- **Android notifications** need `android/app/google-services.json` (git-ignored). Without it the app hides the notification switch. Not yet tried on an Android device.
- **Sign-in, set-up, safety:** the apps require sign-in, then the 13+ and terms set-up; chat has report and block; accounts can be deleted in the app.

## Still to do before a store release
Follow [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md): content filter decision, reviewer sign-in, Android build, accounts and keys, tests on real phones, store forms, native-speaker review and audio licences.
