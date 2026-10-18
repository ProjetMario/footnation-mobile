# Free iOS build

This manually dispatched workflow uses a **standard `macos-26` runner in the existing public repository**. It refuses private repositories, uses no EAS build quota and does not submit to Apple automatically. Signing assets, the latest source snapshot, logs and IPA are never published in plaintext.

## Payload contract

Create a tar.gz with the mobile project files at its root, without `.git`, `node_modules`, generated `ios`/`android`, exports, `.env*`, credentials or caches. The only private credentials in this archive belong in:

- `release-private/certificate.p12`: existing Apple Distribution certificate.
- `release-private/profile.mobileprovision`: existing App Store provisioning profile.
- `release-private/signing.json`: `{"teamId":"…","bundleIdentifier":"com.footnation.app","certificatePassword":"…","version":"1.0.4","buildNumber":"16"}`.
- `release-private/build-env.json`: string values keyed by `EXPO_PUBLIC_*`, optionally `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` if error reporting is enabled. Never use a server Supabase key. The runner always forces `EXPO_PUBLIC_SUPPORTERS_ENABLED=false`.

Do not include symbolic/hard links or special files. The extractor rejects them, path traversal, duplicate paths, stray signing keys and generated directories. The runner changes only its temporary `app.json` to the manifest's version/build before prebuild; the developer workspace remains unchanged.

Generate a fresh random 32-byte key, save it privately and set its base64 value as the GitHub secret `FN_IOS_RELEASE_KEY`. Pass it through the environment, never a command-line argument. Encrypt with:

```sh
node scripts/release/envelope.mjs encrypt source.tar.gz ios-source.enc
```

The binary envelope is `FNREL001` + 12-byte random IV + 16-byte authentication tag + AES-256-GCM ciphertext. The header is also authenticated. Decryption verifies the tag before writing any plaintext. The CLI refuses to overwrite an existing output.

Commit only the generic workflow/scripts and ciphertext. Dispatch with `payload_path` (for example `release/ios-source.enc`) and the ciphertext's SHA256 as `payload_sha256`.

## Result and cleanup

The one-day artifact contains `FootNation.ipa.enc` on success, encrypted `logs.tar.gz.enc`, and nonsensitive version/build/digest metadata in `release.json`. Decrypt locally with the same environment key:

```sh
node scripts/release/envelope.mjs decrypt FootNation.ipa.enc FootNation.ipa
node scripts/release/envelope.mjs decrypt logs.tar.gz.enc logs.tar.gz
```

Verify the IPA SHA256 against `release.json`, then submit via the already authorized App Store process. Delete the one-time GitHub secret and artifacts after retrieval. Remove the ciphertext from the branch after completion (it remains encrypted in history). Retain the private key only as long as recovery is needed.

The runner imports signing assets into a temporary keychain, validates the profile's expiry, App Store type, team, application identifier and certificate match, then restores its prior keychain search list and deletes signing files and source. All build output is captured only in the encrypted diagnostics. No account-wide Expo token or Apple API key is needed by this build.

Local verification, without signing credentials or Xcode:

```sh
node --test scripts/release/envelope.test.mjs
python3 scripts/release/safe-extract.test.py
node --check scripts/release/build-ios.mjs
ruby -c scripts/release/Fastfile
```

Official references: [GitHub standard runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Fastlane code signing](https://docs.fastlane.tools/actions/update_code_signing_settings/), [Fastlane build_app](https://docs.fastlane.tools/actions/build_app/).

## Genuine App Store screenshots

`ios-native-screenshots.yml` builds the same app source in Release configuration for iOS Simulator, launches the actual native UI on an iPhone and iPad, signs in through the normal interface with the existing Apple review demonstration account, and captures native PNGs with `xcrun simctl io screenshot`. It does not create mockups or modify the application's behavior. Public discovery screens and a demonstration profile are appropriate; never capture private conversations or personal contact information.

Its separately encrypted payload permits only `release-private/build-env.json` and `release-private/demo.json` (`email`, `password`). It rejects signing assets. Use a new `FN_IOS_SCREENSHOT_KEY` and the same authenticated envelope format. Credentials, native screenshots, simulator app and diagnostics remain encrypted in the public one-day artifacts. The simulator binary can be reused with `reuse_run_id` for a later capture pass without recompilation, using the same artifact encryption key. Human visual review and dimension checks are required before uploading any capture to App Store Connect. Remove the temporary GitHub secret, ciphertext and artifacts after verified local retrieval.

`ios-native-screenshots-rescue.yml` separates compilation from UI capture: its first job uses `ONLY_ACTIVE_ARCH=YES`, archives the native app and provenance before any Maestro action, then two dependent jobs capture iPhone and iPad screens using that preserved binary. `FN_BUILD_ONLY=1` is the helper's compile-only mode. Keep the same encryption key across all jobs and retries. An optional `userId` in the private demo payload permits setting that account's ordinary onboarding preferences. A positive assertion of the demonstration profile is required before accepting authenticated captures.

Local checks:

```sh
node --check scripts/release/capture-ios.mjs
python3 scripts/release/safe-extract-screenshots.test.py
```
