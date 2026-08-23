// Attach build to version 1.0, set age rating (4+), set price to Free.
const jwt = require('jsonwebtoken');
const KEY_ID = 'MLH9LUFU55';
const ISSUER_ID = '73703d1f-3734-4650-aef2-9e7b77169939';
const APP_ID = '6804422979';
const BASE = 'https://api.appstoreconnect.apple.com';
const P8 = process.env.ASC_P8;

function token() {
  return jwt.sign({}, P8, {
    algorithm: 'ES256', expiresIn: '15m', audience: 'appstoreconnect-v1',
    issuer: ISSUER_ID, header: { kid: KEY_ID, typ: 'JWT' },
  });
}
async function api(method, path, body, ok404) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    if (ok404 && res.status === 404) return null;
    throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 700)}`);
  }
  return text ? JSON.parse(text) : null;
}

(async () => {
  // 1. Build already attached in previous run — skip.

  // 2. Age rating: everything none -> 4+ (declaration hangs off appInfo now)
  const infos = await api('GET', `/v1/apps/${APP_ID}/appInfos`);
  const info = infos.data.find((i) => (i.attributes.appStoreState || i.attributes.state) === 'PREPARE_FOR_SUBMISSION') || infos.data[0];
  const decl = await api('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`);
  try {
    await api('PATCH', `/v1/ageRatingDeclarations/${decl.data.id}`, {
      data: { type: 'ageRatingDeclarations', id: decl.data.id, attributes: {
        alcoholTobaccoOrDrugUseOrReferences: 'NONE',
        contests: 'NONE',
        gambling: false,
        lootBox: false,
        ageAssurance: false,
        gunsOrOtherWeapons: 'NONE',
        parentalControls: false,
        messagingAndChat: false,
        userGeneratedContent: false,
        advertising: false,
        healthOrWellnessTopics: false,
        gamblingSimulated: 'NONE',
        horrorOrFearThemes: 'NONE',
        matureOrSuggestiveThemes: 'NONE',
        medicalOrTreatmentInformation: 'NONE',
        profanityOrCrudeHumor: 'NONE',
        sexualContentGraphicAndNudity: 'NONE',
        sexualContentOrNudity: 'NONE',
        unrestrictedWebAccess: false,
        violenceCartoonOrFantasy: 'NONE',
        violenceRealistic: 'NONE',
        violenceRealisticProlongedGraphicOrSadistic: 'NONE',
      } },
    });
    console.log('age rating declaration set (all NONE -> 4+)');
  } catch (e) {
    console.log('age rating patch failed:', e.message.slice(0, 400));
  }

  // 3. Price: Free (base territory USA, price point 0)
  try {
    const points = await api('GET', `/v1/apps/${APP_ID}/appPricePoints?filter[territory]=USA&limit=5`);
    const free = points.data.find((p) => parseFloat(p.attributes.customerPrice) === 0);
    if (!free) throw new Error('free price point not found in first page');
    await api('POST', '/v1/appPriceSchedules', {
      data: {
        type: 'appPriceSchedules',
        relationships: {
          app: { data: { type: 'apps', id: APP_ID } },
          baseTerritory: { data: { type: 'territories', id: 'USA' } },
          manualPrices: { data: [{ type: 'appPrices', id: '${price0}' }] },
        },
      },
      included: [{
        id: '${price0}', type: 'appPrices',
        attributes: { startDate: null },
        relationships: { appPricePoint: { data: { type: 'appPricePoints', id: free.id } } },
      }],
    });
    console.log('price schedule set: Free (0.00 USD base)');
  } catch (e) {
    console.log('price set failed (may already be set or needs UI):', e.message.slice(0, 400));
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
