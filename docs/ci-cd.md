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

## Enabling the EAS workflows (done in the EAS pillar / item 2)

1. `cd app && eas init` — creates the EAS project and adds `projectId` to `app.json`.
2. Add `eas.json` with `development` / `preview` / `production` profiles (incl. an `ios` profile).
3. Create an Expo access token and add it as the repo **secret** `EXPO_TOKEN`.
4. Set the repo **variable** `EAS_ENABLED` to `true`.
5. For iOS builds: connect the Apple Developer account so EAS can manage signing.

Then: pushes to `main` publish a preview update, and _Actions → EAS Build (iOS) → Run workflow_
starts an iOS build.
