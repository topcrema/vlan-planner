const jwt = require('jsonwebtoken');
const fs = require('fs');

const KEY_ID = 'MLH9LUFU55';
const ISSUER_ID = '73703d1f-3734-4650-aef2-9e7b77169939';
const APP_ID = '6804422979';
const BASE = 'https://api.appstoreconnect.apple.com';

// .p8 now lives only in 1Password; read it from the env var set by the caller.
const P8 = process.env.ASC_P8;
if (!P8) { console.error('ASC_P8 env missing'); process.exit(1); }

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
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : null;
}

(async () => {
  // 1. Team users
  const users = await api('GET', '/v1/users');
  for (const u of users.data) {
    console.log('user:', u.attributes.username, '| roles:', (u.attributes.roles || []).join(','));
  }
  const me = users.data[0];

  // 2. Internal beta group (find or create)
  const groups = await api('GET', `/v1/betaGroups?filter[app]=${APP_ID}`);
  let group = (groups.data || []).find((g) => g.attributes.isInternalGroup);
  if (!group) {
    const created = await api('POST', '/v1/betaGroups', {
      data: {
        type: 'betaGroups',
        attributes: { name: 'Internal', isInternalGroup: true, hasAccessToAllBuilds: true },
        relationships: { app: { data: { type: 'apps', id: APP_ID } } },
      },
    });
    group = created.data;
    console.log('betaGroup: CREATED "Internal"', group.id);
  } else {
    console.log(`betaGroup: exists "${group.attributes.name}"`, group.id);
  }

  // 3. Add the team user as internal tester
  try {
    const tester = await api('POST', '/v1/betaTesters', {
      data: {
        type: 'betaTesters',
        attributes: { email: me.attributes.username, firstName: me.attributes.firstName, lastName: me.attributes.lastName },
        relationships: { betaGroups: { data: [{ type: 'betaGroups', id: group.id }] } },
      },
    });
    console.log('tester: ADDED', tester.data.attributes.email);
  } catch (e) {
    console.log('tester add failed (may need UI):', e.message.slice(0, 300));
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
