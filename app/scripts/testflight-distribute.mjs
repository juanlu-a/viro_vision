/**
 * Después de subir un build (scripts/testflight.sh): esperar a que Apple lo procese, asignarlo a
 * un grupo de TestFlight y mandarlo a Beta App Review. Es lo que convierte "subí un .ipa" en
 * "los testers lo tienen".
 *
 * Uso:
 *   node scripts/testflight-distribute.mjs --build-number 202608291230 \
 *     --group "Testers ViroVision" --notes "Qué cambió en este build"          # grupo externo
 *   node scripts/testflight-distribute.mjs --build-number … --group "Equipo ViroVision" --internal
 *
 * Una app, dos grupos (decisión del 2026-08-30):
 *   - `staging` → grupo **interno** (`--internal`): sus testers son usuarios de App Store Connect
 *     (los devs), reciben cada build en minutos y **sin Beta App Review**.
 * Cada grupo muestra **un solo build** (pedido del equipo: "no quiero ver tres builds"): al asignar
 * el nuevo se quitan los anteriores del grupo. En el externo se conservan además el último
 * aprobado (para que el link no quede vacío mientras Apple revisa) y cualquier build en revisión
 * (quitarlo a mitad de revisión confunde a Apple y a nosotros).
 *   - `main` → grupo **externo** con link público — nadie agrega testers a mano — y por eso cada
 *     build pasa por Beta App Review: el primero de cada versión con revisión real, los siguientes
 *     se aprueban en minutos.
 * El grupo y el tipo los pasa el workflow. `APP_VARIANT=beta` (app.config.js) queda reservado para
 * publicar una β como app aparte si algún día hace falta; hoy no se usa.
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
  console.error('Uso: --build-number N --group "Nombre" [--notes "texto"]');
  process.exit(2);
}

const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url)));
// Espejo de app.config.js: la variante beta es otra app en App Store Connect.
const bundleId = appJson.expo.ios.bundleIdentifier + (process.env.APP_VARIANT === 'beta' ? '.beta' : '');
const locale = 'es-MX';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const apps = await asc('GET', `/v1/apps?filter[bundleId]=${bundleId}`);
const appId = apps.data[0]?.id;
if (!appId) throw new Error(`No hay app en App Store Connect con bundle ${bundleId}`);

// Apple procesa el build entre 5 y 20 minutos después de subirlo. Hasta que aparece con
// processingState VALID no se puede asignar a nadie.
let build = null;
const deadline = Date.now() + 40 * 60 * 1000;
while (Date.now() < deadline) {
  const r = await asc(
    'GET',
    `/v1/builds?filter[app]=${appId}&filter[version]=${buildNumber}&fields[builds]=version,processingState,usesNonExemptEncryption`,
  );
  build = r.data[0] ?? null;
  const state = build?.attributes.processingState;
  console.log(`build ${buildNumber}: ${state ?? 'todavía no aparece'}`);
  if (state === 'VALID') break;
  if (state === 'FAILED' || state === 'INVALID') throw new Error(`Apple rechazó el procesamiento: ${state}`);
  await sleep(60_000);
}
if (build?.attributes.processingState !== 'VALID') throw new Error('El build no terminó de procesarse en 40 minutos.');

// app.json ya declara ITSAppUsesNonExemptEncryption=false; esto cubre builds anteriores a eso.
if (build.attributes.usesNonExemptEncryption == null) {
  await asc('PATCH', `/v1/builds/${build.id}`, {
    data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } },
  });
}

// "Qué probar": lo que ven los testers en TestFlight. Obligatorio para la revisión.
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

// El grupo, creándolo si no existe: interno con acceso automático a todos los builds, o externo
// con link público.
const groups = await asc(
  'GET',
  `/v1/betaGroups?filter[app]=${appId}&fields[betaGroups]=name,publicLink,isInternalGroup,hasAccessToAllBuilds`,
);
let group = groups.data.find((g) => g.attributes.name === groupName);
if (!group) {
  // hasAccessToAllBuilds en false a propósito (y no se puede cambiar después: hay que recrear el
  // grupo): con true, los testers ven todos los builds y el grupo deja de mostrar "el" beta.
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

// Un solo build visible por grupo (ver el encabezado).
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
  console.log(`quitados del grupo ${toRemove.length} build(s) anteriores`);
}

if (internal) {
  // Testers internos: sin revisión de Apple. TestFlight les avisa solo.
  console.log(`✓ build ${buildNumber} → grupo interno "${groupName}" (sin revisión; llega en minutos)`);
  process.exit(0);
}

// Beta App Review. Dos respuestas de Apple que NO son fallas de la pipeline:
//   - 409: el build ya estaba enviado.
//   - 422 ANOTHER_BUILD_IN_REVIEW: Apple admite un solo build por versión en revisión a la vez
//     (pasó en el primer run automático, con el build manual del mismo día todavía en revisión).
//     El build ya quedó en el grupo; se envía a mano —o lo hace el próximo run— cuando el
//     anterior termine. Fallar acá haría rojo un build que llegó bien.
try {
  await asc('POST', '/v1/betaAppReviewSubmissions', {
    data: { type: 'betaAppReviewSubmissions', relationships: { build: { data: { type: 'builds', id: build.id } } } },
  });
  console.log('enviado a Beta App Review');
} catch (err) {
  const code = err instanceof AscError ? err.body?.errors?.[0]?.code : undefined;
  if (err instanceof AscError && err.status === 409) {
    console.log('ya estaba en Beta App Review');
  } else if (code === 'ENTITY_UNPROCESSABLE.ANOTHER_BUILD_IN_REVIEW') {
    console.log('⚠ otro build de esta versión está en Beta App Review; este queda en el grupo a la espera de ser enviado.');
  } else {
    throw err;
  }
}

console.log(`✓ build ${buildNumber} → grupo "${groupName}" · link: ${group.attributes.publicLink}`);
