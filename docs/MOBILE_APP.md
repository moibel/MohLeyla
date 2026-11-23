# iOS and Android app

The store apps are the same React app inside a native shell ([Capacitor](https://capacitorjs.com)). One codebase serves the website and both apps.

## Build and run
```bash
npm run build:native   # builds dist-native/ (no service worker, audio not bundled) and copies it into ios/ and android/
npm run ios            # build + open Xcode (pick a simulator or your iPhone, press Run)
npm run android        # build + open Android Studio (needs JDK 17+ and the Android SDK)
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

## Still to do before a store release
1. Test on a real iPhone and a real Android phone (microphone, camera, calls, voice notes, Google sign-in return).
2. Apple: Developer account ($99/year), App Store Connect record, **Sign in with Apple** (required because Google sign-in is offered), an **in-app account deletion** button (required by Apple and Google Play), privacy "nutrition label", screenshots, review notes with a test account.
3. Google Play: developer account ($25 once), Data safety form, release keystore (keep it out of git; `.gitignore` already excludes it).
4. Push notifications (APNs/FCM) for messages and calls, and CallKit for incoming calls: a separate piece of work.
5. Native-speaker review of the beta languages; a decision on the Apple system-voice licence for the audio clips (see README).
