# CI/CD

GitHub Actions pipeline for the ViroVision app. `main` is the protected, only-environment branch;
all changes land via pull request.

## Workflows

| Workflow | File | Trigger | Does |
|----------|------|---------|------|
| **CI** | `.github/workflows/ci.yml` | PRs to `main`, pushes to feature branches | `npm ci` (install), lint, typecheck, test, then bundle the app for iOS + Android (build check) and upload the bundle artifact. |
| **EAS Update (preview)** | `.github/workflows/eas-update.yml` | push to `main`, manual | Publishes an OTA **EAS Update** to the `preview` branch so main can be previewed as an update group. |
| **EAS Build (iOS)** | `.github/workflows/eas-build-ios.yml` | manual (`workflow_dispatch`) | Starts a native **iOS build** on EAS Build (cloud). Manual because it uses build credits + Apple credentials. |

CI runs today with no configuration. The two EAS workflows are **gated on `vars.EAS_ENABLED == 'true'`**
and are skipped (not failed) until EAS is set up — so nothing blocks merging before then.

## Suggested branch protection for `main`

- Require a pull request before merging.
- Require the **CI** status checks to pass: _Lint · Typecheck · Test_ and _Bundle (build check)_.
- (Optional) require branches to be up to date before merging.

## Enabling the EAS workflows

`app/eas.json` has four build profiles, each bound to an EAS Update channel:

| Profile | Channel | Distribution | iOS |
|---------|---------|--------------|-----|
| `development` | `development` | internal | **device** dev client (ad-hoc; register phones with `eas device:create`) |
| `development-simulator` | `development` | internal | simulator dev client |
| `preview` | `preview` | internal | simulator (no Apple credentials involved) |
| `production` | `production` | store | **TestFlight / App Store** — `autoIncrement` build number (remote version source) |

Channels map to update branches, so `eas update --branch preview` (the deploy workflow) is served to
`preview`-channel builds.

The Apple Developer Program account exists since 2026-08 (Individual, the project's Apple ID; team
`VPNXQ8K2P8`), and `submit.production` in `eas.json` already carries `appleId` + `appleTeamId`.

Interactive one-time setup (run locally — these need your Expo and Apple logins; in a Claude session
run them with the `! ` prefix):

1. `cd app && npx eas-cli login`
2. `npx eas-cli init` — creates the EAS project and writes `extra.eas.projectId` into `app.json`.
3. `npx eas-cli update:configure` — installs `expo-updates` and sets `updates.url` + a `runtimeVersion`
   policy (fingerprint) so OTA updates resolve correctly.
4. `npx eas-cli build --platform ios --profile production` — first run asks for the Apple login,
   registers the bundle ID, creates the App Store Connect app and the distribution certificate.
5. `npx eas-cli submit --platform ios --latest` — uploads to TestFlight. Add the returned
   `ascAppId` to `submit.production.ios` so later submits are non-interactive.
6. Create an Expo access token (expo.dev → account → access tokens) and add it as the repo **secret**
   `EXPO_TOKEN`. Set the repo **variable** `EAS_ENABLED` to `true`.

Then: pushes to `main` publish a preview update, and _Actions → EAS Build (iOS) → Run workflow_
starts an iOS build; with **production** + _submit_ checked it also uploads to TestFlight
(`--auto-submit`), using the Apple credentials EAS stored in step 4.
