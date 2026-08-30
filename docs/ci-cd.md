# CI/CD

GitHub Actions pipeline for the ViroVision app. Two long-lived branches: `staging` (default; every
PR lands here and ships as ViroVision β) and `main` (production; reached by a `staging → main` PR).

## Workflows

| Workflow | File | Trigger | Does |
|----------|------|---------|------|
| **CI** | `.github/workflows/ci.yml` | PRs to `main`, pushes to feature branches | `npm ci` (install), lint, typecheck, test, then bundle the app for iOS + Android (build check) and upload the bundle artifact. |
| **TestFlight** | `.github/workflows/testflight.yml` | push to `staging` or `main` (changes under `app/`), manual from any branch | macOS runner: lint/typecheck/test → prebuild → archive → upload → assign to a TestFlight group and submit to Beta App Review. `staging` → **ViroVision β** (`com.virovision.app.beta`, internal testers, no review); `main` → **ViroVision** (external public link). See [`dev-build-ios.md`](dev-build-ios.md). |
| **EAS Update (preview)** | `.github/workflows/eas-update.yml` | push to `main`, manual | Publishes an OTA **EAS Update** to the `preview` branch so main can be previewed as an update group. |
| **EAS Build (iOS)** | `.github/workflows/eas-build-ios.yml` | manual (`workflow_dispatch`) | Starts a native **iOS build** on EAS Build (cloud). Manual because it uses build credits + Apple credentials. |

CI runs today with no configuration. The two EAS workflows are **gated on `vars.EAS_ENABLED == 'true'`**
and are skipped (not failed) until EAS is set up — so nothing blocks merging before then.

## Suggested branch protection for `main`

- Require a pull request before merging.
- Require the **CI** status checks to pass: _Lint · Typecheck · Test_ and _Bundle (build check)_.
- (Optional) require branches to be up to date before merging.

## TestFlight

Distribution to testers goes through **TestFlight uploaded with Xcode tooling** — locally
(`npm run ios:testflight`) or from the `TestFlight` workflow on every merge to `main`. No
third-party build service: the App Store Connect API key lives in repo secrets and Xcode's cloud
signing does the rest. The EAS workflows below stay gated and optional.

## Enabling the EAS workflows (optional)

`app/eas.json` is already committed with three build profiles, each bound to an EAS Update channel:

| Profile | Channel | Distribution | iOS |
|---------|---------|--------------|-----|
| `development` | `development` | internal | simulator + dev client |
| `preview` | `preview` | internal | **simulator** (no Apple account needed) |
| `production` | `production` | store | device (Apple Developer account, available since 2026-08) |

Channels map to update branches, so `eas update --branch preview` (the deploy workflow) is served to
`preview`-channel builds.

Interactive one-time setup (run locally — these need your Expo login; in this session you can run
them via `! npx eas-cli login` etc.):

1. `cd app && npx eas-cli login`
2. `npx eas-cli init` — creates the EAS project and writes `extra.eas.projectId` into `app.json`.
3. `npx eas-cli update:configure` — installs `expo-updates` and sets `updates.url` + a `runtimeVersion`
   policy (fingerprint) so OTA updates resolve correctly.
4. Create an Expo access token (expo.dev → account → access tokens) and add it as the repo **secret**
   `EXPO_TOKEN`.
5. Set the repo **variable** `EAS_ENABLED` to `true`.
6. For **production/device iOS** builds only: connect the Apple Developer account so EAS can manage
   signing.

Then: pushes to `main` publish a preview update, and _Actions → EAS Build (iOS) → Run workflow_
starts an iOS build.
