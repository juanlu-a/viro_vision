/**
 * After uploading a build (scripts/testflight.sh): wait for Apple to process it, assign it to a
 * TestFlight group and send it to Beta App Review. It is what turns "I uploaded an .ipa" into "the
 * testers have it".
 *
 * Usage:
 *   node scripts/testflight-distribute.mjs --build-number 202608291230 \
 *     --group "Testers ViroVision" --notes "What changed in this build"        # external group
 *   node scripts/testflight-distribute.mjs --build-number … --group "Equipo ViroVision" --internal
 *
 * One app, two groups (decision of 2026-08-30):
 *   - `staging` → the **internal** group (`--internal`): its testers are App Store Connect users
 *     (the devs), they get every build in minutes and **with no Beta App Review**.
 * Each group shows **a single build** (a team request: "I do not want to see three builds"): when
 * the new one is assigned, the previous ones are removed from the group. In the external one the
 * last approved build is also kept (so the link is not empty while Apple reviews) along with any
 * build under review (removing it mid-review confuses Apple and us).
 *   - `main` → the **external** group with a public link — nobody adds testers by hand — and that is
 *     why every build goes through Beta App Review: the first of each version with a real review,
 *     the following ones approved in minutes.
 * The group and the type are passed by the workflow. `APP_VARIANT=beta` (app.config.js) is reserved
 * for publishing a β as a separate app if it is ever needed; it is not used today.
 */
import { readFileSync } from 'node:fs';

import { asc, AscError } from './asc.mjs';

const FLAGS = new Set(['internal']);
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), FLAGS.has(a.slice(2)) ? 'true' : (arr[i + 1] ?? '')]);
    return acc;
  }, []),
);
const internal = args.internal === 'true';
const buildNumber = args['build-number'];
const groupName = args.group;
const notes = args.notes || `Build ${buildNumber}`;
if (!buildNumber || !groupName) {
  console.error('Usage: --build-number N --group "Name" [--notes "text"]');
  process.exit(2);
}

const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url)));
// A mirror of app.config.js: the beta variant is another app in App Store Connect.
const bundleId = appJson.expo.ios.bundleIdentifier + (process.env.APP_VARIANT === 'beta' ? '.beta' : '');
const locale = 'es-MX';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const apps = await asc('GET', `/v1/apps?filter[bundleId]=${bundleId}`);
const appId = apps.data[0]?.id;
if (!appId) throw new Error(`No app in App Store Connect with bundle ${bundleId}`);

// Apple processes the build between 5 and 20 minutes after it is uploaded. Until it shows up with
// processingState VALID it cannot be assigned to anyone.
let build = null;
const deadline = Date.now() + 40 * 60 * 1000;
while (Date.now() < deadline) {
  const r = await asc(
    'GET',
    `/v1/builds?filter[app]=${appId}&filter[version]=${buildNumber}&fields[builds]=version,processingState,usesNonExemptEncryption`,
  );
  build = r.data[0] ?? null;
  const state = build?.attributes.processingState;
  console.log(`build ${buildNumber}: ${state ?? 'not there yet'}`);
  if (state === 'VALID') break;
  if (state === 'FAILED' || state === 'INVALID') throw new Error(`Apple rejected the processing: ${state}`);
  await sleep(60_000);
}
if (build?.attributes.processingState !== 'VALID') throw new Error('The build did not finish processing within 40 minutes.');

// app.json already declares ITSAppUsesNonExemptEncryption=false; this covers builds from before that.
if (build.attributes.usesNonExemptEncryption == null) {
  await asc('PATCH', `/v1/builds/${build.id}`, {
    data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } },
  });
}

// "What to test": what the testers see in TestFlight. Mandatory for the review.
const locs = await asc('GET', `/v1/builds/${build.id}/betaBuildLocalizations?fields[betaBuildLocalizations]=locale`);
const existing = locs.data.find((l) => l.attributes.locale === locale);
if (existing) {
  await asc('PATCH', `/v1/betaBuildLocalizations/${existing.id}`, {
    data: { type: 'betaBuildLocalizations', id: existing.id, attributes: { whatsNew: notes } },
  });
} else {
  await asc('POST', '/v1/betaBuildLocalizations', {
    data: {
      type: 'betaBuildLocalizations',
      attributes: { locale, whatsNew: notes },
      relationships: { build: { data: { type: 'builds', id: build.id } } },
    },
  });
}

// The group, created if it does not exist: internal with automatic access to every build, or
// external with a public link.
const groups = await asc(
  'GET',
  `/v1/betaGroups?filter[app]=${appId}&fields[betaGroups]=name,publicLink,isInternalGroup,hasAccessToAllBuilds`,
);
let group = groups.data.find((g) => g.attributes.name === groupName);
if (!group) {
  // hasAccessToAllBuilds is false on purpose (and it cannot be changed afterwards: the group has to
  // be recreated): with true, testers see every build and the group stops showing "the" beta.
  const attributes = internal
    ? { name: groupName, isInternalGroup: true, hasAccessToAllBuilds: false, feedbackEnabled: true }
    : { name: groupName, publicLinkEnabled: true, publicLinkLimitEnabled: true, publicLinkLimit: 200, feedbackEnabled: true };
  const created = await asc('POST', '/v1/betaGroups', {
    data: { type: 'betaGroups', attributes, relationships: { app: { data: { type: 'apps', id: appId } } } },
  });
  group = created.data;
}
if (!group.attributes.hasAccessToAllBuilds) {
  await asc('POST', `/v1/betaGroups/${group.id}/relationships/builds`, { data: [{ type: 'builds', id: build.id }] });
}

// A single visible build per group (see the header).
const inGroup = (await asc('GET', `/v1/betaGroups/${group.id}/relationships/builds`)).data.filter((b) => b.id !== build.id);
const keep = new Set();
if (!internal && inGroup.length) {
  const states = await asc(
    'GET',
    `/v1/builds?filter[app]=${appId}&fields[builds]=version,uploadedDate&include=betaAppReviewSubmission&fields[betaAppReviewSubmissions]=betaReviewState&sort=-uploadedDate&limit=50`,
  );
  const stateOf = Object.fromEntries((states.included ?? []).map((s) => [s.id, s.attributes.betaReviewState]));
  const ordered = states.data.filter((b) => inGroup.some((g) => g.id === b.id));
  const lastApproved = ordered.find((b) => stateOf[b.relationships?.betaAppReviewSubmission?.data?.id] === 'APPROVED');
  if (lastApproved) keep.add(lastApproved.id);
  for (const b of ordered) {
    const st = stateOf[b.relationships?.betaAppReviewSubmission?.data?.id];
    if (st === 'WAITING_FOR_REVIEW' || st === 'IN_REVIEW') keep.add(b.id);
  }
}
const toRemove = inGroup.filter((b) => !keep.has(b.id));
if (toRemove.length) {
  await asc('DELETE', `/v1/betaGroups/${group.id}/relationships/builds`, { data: toRemove });
  console.log(`removed ${toRemove.length} previous build(s) from the group`);
}

if (internal) {
  // Internal testers: no Apple review. TestFlight notifies them on its own.
  console.log(`✓ build ${buildNumber} → internal group "${groupName}" (no review; arrives in minutes)`);
  process.exit(0);
}

// Beta App Review. Two answers from Apple that are NOT pipeline failures:
//   - 409: the build had already been submitted.
//   - 422 ANOTHER_BUILD_IN_REVIEW: Apple allows a single build per version under review at a time
//     (it happened on the first automatic run, with the same day's manual build still under review).
//     The build is already in the group; it is submitted by hand —or by the next run— once the
//     previous one finishes. Failing here would turn a build that arrived fine red.
try {
  await asc('POST', '/v1/betaAppReviewSubmissions', {
    data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } },
  });
  console.log('submitted to Beta App Review');
} catch (err) {
  const code = err instanceof AscError ? err.body?.errors?.[0]?.code : undefined;
  if (err instanceof AscError && err.status === 409) {
    console.log('it was already in Beta App Review');
  } else if (code === 'ENTITY_UNPROCESSABLE.ANOTHER_BUILD_IN_REVIEW') {
    console.log('⚠ another build of this version is in Beta App Review; this one stays in the group waiting to be submitted.');
  } else {
    throw err;
  }
}

console.log(`✓ build ${buildNumber} → group "${groupName}" · link: ${group.attributes.publicLink}`);
