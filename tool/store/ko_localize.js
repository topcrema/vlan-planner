// Cancel current submission, add Korean (ko) app info + version localizations.
const jwt = require('jsonwebtoken');
const fs = require('fs');
const KEY_ID = 'MLH9LUFU55';
const ISSUER_ID = '73703d1f-3734-4650-aef2-9e7b77169939';
const APP_ID = '6804422979';
const SUB_ID = '563cee51-778a-4b72-98ec-c14e3a11f778';
const BASE = 'https://api.appstoreconnect.apple.com';
const P8 = process.env.ASC_P8;
const KO = JSON.parse(fs.readFileSync('C:\\ctrwork\\vlan-planner\\store\\listing.ko.json', 'utf8'));

function token() {
  return jwt.sign({}, P8, {
    algorithm: 'ES256', expiresIn: '15m', audience: 'appstoreconnect-v1',
    issuer: ISSUER_ID, header: { kid: KEY_ID, typ: 'JWT' },
  });
}
async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 700)}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  // 1. Cancel pending submission
  try {
    await api('PATCH', `/v1/reviewSubmissions/${SUB_ID}`, {
      data: { type: 'reviewSubmissions', id: SUB_ID, attributes: { canceled: true } },
    });
    console.log('submission canceled');
  } catch (e) {
    console.log('cancel note:', e.message.slice(0, 200));
  }

  // 2. ko appInfoLocalization (name/subtitle/privacy URL)
  const infos = await api('GET', `/v1/apps/${APP_ID}/appInfos`);
  const info = infos.data.find((i) => (i.attributes.appStoreState || i.attributes.state) === 'PREPARE_FOR_SUBMISSION') || infos.data[0];
  const iLocs = await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`);
  let iKo = iLocs.data.find((l) => l.attributes.locale === 'ko');
  if (!iKo) {
    try {
      const created = await api('POST', '/v1/appInfoLocalizations', {
        data: { type: 'appInfoLocalizations', attributes: {
          locale: 'ko', name: 'VLAN Planner', subtitle: KO.subtitle,
          privacyPolicyUrl: 'https://topcrema.github.io/vlan-planner/privacy.html',
        }, relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } } },
      });
      iKo = created.data;
      console.log('ko appInfoLocalization created');
    } catch (e) {
      console.log('ko appInfoLocalization SKIPPED:', e.message.slice(0, 160));
    }
  } else {
    console.log('ko appInfoLocalization exists');
  }

  // 3. ko appStoreVersionLocalization (description/keywords/promo/support)
  const vers = await api('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
  const ver = vers.data.find((v) => v.attributes.appStoreState === 'PREPARE_FOR_SUBMISSION') || vers.data[0];
  const vLocs = await api('GET', `/v1/appStoreVersions/${ver.id}/appStoreVersionLocalizations`);
  let vKo = vLocs.data.find((l) => l.attributes.locale === 'ko');
  const keywords = 'ip,넷마스크,ipv4,ccna,네트워크,라우팅,서브네팅,와일드카드,계산기,게이트웨이,브로드캐스트,경로요약,오프라인,noc,supernet';
  if (!vKo) {
    const created = await api('POST', '/v1/appStoreVersionLocalizations', {
      data: { type: 'appStoreVersionLocalizations', attributes: {
        locale: 'ko', description: KO.description, keywords,
        promotionalText: KO.promotionalText,
        supportUrl: 'https://github.com/topcrema/vlan-planner',
      }, relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } } } },
    });
    vKo = created.data;
    console.log('ko version localization created:', vKo.id);
  } else {
    console.log('ko version localization exists:', vKo.id);
  }
  console.log('KO_LOC_ID=' + vKo.id);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
