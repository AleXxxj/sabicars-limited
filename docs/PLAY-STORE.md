# Sabicars on Google Play

How the Android app is made, and the steps to put it on the Play Store. Written 8 November 2026.

## What the app is

The Android app is a thin shell (Google calls it a Trusted Web Activity) that opens
**https://sabicars.com** full screen, with no browser bar, using Chrome's engine on the phone.
There is no second codebase: every change to the website is a change to the app. The app only
needs a new upload when the shell itself changes (name, icon, colours, the address it opens).

Google must be able to prove the app and the website belong to the same owner. The website does
that by serving a small file, `https://sabicars.com/.well-known/assetlinks.json`, that names the
app's package (`com.sabicars.app`) and the fingerprints of the keys that sign it. Without that file,
or with a wrong fingerprint, the app still opens but shows a browser bar at the top.

## Where things live

| What | Where |
|---|---|
| App recipe (name, colours, address, icon) | `android/twa-manifest.json` |
| Generated Android project | `android/` (regenerate with `bubblewrap update`) |
| Verification file served by the site | `web/public/.well-known/assetlinks.json` |
| Upload signing key | `~/sabicars-android/keys/sabicars-upload.keystore` on Alex's Mac, **never in the repo** |
| Key password | `~/sabicars-android/keys/upload-key-password.txt` — copy it into a password manager |
| Build tools (Bubblewrap, Java 17, Android SDK) | `~/sabicars-android/tools`, `~/.bubblewrap/` |

Keep the keystore and its password safe. Google holds the final app signing key, but every upload
must be signed with this upload key. If it is lost, Google can reset it, but that takes a support
request and days.

## Building

```bash
cd /Users/mologstics/sabicars-limited/android
export BUBBLEWRAP_KEYSTORE_PASSWORD="$(cat ~/sabicars-android/keys/upload-key-password.txt)"
export BUBBLEWRAP_KEY_PASSWORD="$BUBBLEWRAP_KEYSTORE_PASSWORD"
~/sabicars-android/tools/node_modules/.bin/bubblewrap build --directory . --skipPwaValidation
```

Output in `android/`:

- `app-release-bundle.aab` — the file to upload to Play.
- `app-release-signed.apk` — for installing straight onto an Android phone to test.

Every new upload needs a higher `appVersionCode` in `twa-manifest.json`; then run
`bubblewrap update --skipVersionUpgrade --directory . --manifest ./twa-manifest.json` and build again.

Testing before switch day: the app opens sabicars.com, which is still the old site until the switch.
A test build that opens `sabicars.vercel.app` instead is at `android/test/sabicars-test-vercel.apk`
(not in git). Send it to an Android phone (WhatsApp, AirDrop-style share, or a cable), open it, allow
"install unknown apps" for that app once, and install. It is signed with the same key, so it opens
full screen with no browser bar as soon as the site serves the verification file. To rebuild it,
change `host` to `sabicars.vercel.app` and `fullScopeUrl` to `https://sabicars.vercel.app/`, update,
build, then change both back and build again.

## Owner's steps (Play Console)

1. **Open a developer account** at https://play.google.com/console in the name of **Inova Creative
   Studio (ICS)**, Alex's studio, which publishes the app for Sabicars (decided 8 November 2026). The
   store will show "Inova Creative Studio" as the developer; the app, its description, icon and
   privacy page stay Sabicars. One-time fee of US$25.
   - If ICS is a registered business, choose **organisation**. Google asks for a D-U-N-S number for
     ICS (free, from Dun & Bradstreet at dnb.com; in Nigeria it can take days to weeks — ask for it
     first), the registered name and address, a company email and phone it can verify, and identity
     documents for the person opening the account.
   - If ICS is not registered, the account is **personal**, in Alex's name. Google shows that name
     publicly, and a new personal account must run a closed test with at least 12 testers for 14 days
     before the app can go public, which adds about three weeks.

2. **Create the app**: name `Sabicars`, app (not game), free, default language English.

3. **Copy the Play signing fingerprint.** In the app go to *Test and release → Setup → App signing*
   (also called App integrity). Copy the SHA-256 of the **App signing key certificate** and send it
   to Alex. It goes into `web/public/.well-known/assetlinks.json` next to the upload-key fingerprint.
   Until that is live, the app installed from Play shows a browser bar.

4. **Store listing** (text below). Needs: app icon 512×512 (`android/store_icon.png`), a feature
   graphic 1024×500, at least two phone screenshots (1080×1920 or similar), privacy policy
   `https://sabicars.com/privacy`, support email and phone.

5. **App content** forms: privacy policy link; ads = no; app access = all features available without
   special access (partner log-in is optional; give test instructions anyway); content rating
   questionnaire = shopping app, no violence or adult content; target audience = 18 and over;
   news app = no; data safety (see below); government app = no; financial features = no loans
   are offered by the app itself (Autochek is a third party reached through the site — answer the
   form truthfully if Google asks about facilitating loans).

6. **Upload** `app-release-bundle.aab` under *Test and release → Production → Create new release*.
   Accept Play App Signing when asked. Add release notes ("First release.").

7. **Send for review.** Google usually answers within a few days; first apps from new accounts can
   take up to a week.

## Store listing text (plain English)

**App name:** Sabicars

**Short description** (under 80 characters):
Toyota Hiace buses, cars and SUVs in Lagos. See prices, chat with us, reserve.

**Full description:**

Sabicars is a car dealer in Lagos, Nigeria. We sell Toyota Hiace buses, cars, SUVs and trucks,
and we help other dealers sell theirs.

What you can do in the app:

- See every vehicle we have, with real photos, the year, the mileage and the price in naira.
- Chat with us about any car and get an answer from a real person.
- Book a time to come and see a car at our park: Amazing Grace, Km 13, Alhaji Ede Bus Stop,
  Lasu Road, Igando, Lagos.
- Reserve a car online so nobody else buys it while you arrange payment.
- Pay 40% on a car from 2010 or newer and let our partner Autochek lend you the rest, if they
  approve you.
- Sell your car to us, or swap it for one of ours and pay the balance.
- Earn money by sharing our cars: partners get a link and branded photos to post, and earn 1.5%
  of the price when a buyer they sent buys from Sabicars.

Sabicars Limited is registered with the Corporate Affairs Commission. Come and see the cars at
our park in Igando, Lagos.

**Category:** Auto & Vehicles. **Tags:** car dealer, Toyota Hiace, buy car Nigeria.

## Data safety answers

Fill these from what the site actually does; check with Alex before answering anything else.

| Data | Collected? | Why | Shared? |
|---|---|---|---|
| Name, phone, email | Yes — when a buyer asks a question, books a viewing, reserves a car, or a partner logs in | Customer service, account | Not sold; sent to Paystack for payments, Resend for email |
| Payment info | Handled by Paystack on Paystack's pages; the app does not store card numbers | Payments | Paystack |
| Messages | Yes — chat with seller | Customer service | No |
| Location | No (the park address is shown, the phone's location is not read) | — | — |
| Photos, contacts, files | No | — | — |

Data is encrypted in transit (HTTPS). Users can ask for their data to be deleted through the contact page.

## Decisions

- Package name `com.sabicars.app`. It can never change once published.
- The app opens `sabicars.com`, not the vercel address, so it is published after switch day.
- Runs on Android 7.0 (2016) or newer; Google's own browser-helper library needs at least that.
- The opening: Android shows a still icon until the site paints, so the site plays a 1.6 s opening of
  its own when launched as an app (`web/src/lib/app-intro.ts`, `web/src/styles/intro.css`). Preview it
  on any browser with `https://sabicars.vercel.app/?intro=1`.
- Portrait and landscape both allowed, so photo galleries can turn.
- Notifications allowed in the shell, for web push later.
- No iPhone version for now: Apple charges US$99 a year and tends to reject plain website wrappers.
