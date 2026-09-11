import http from 'k6/http';
import { check, sleep, group } from 'k6';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';

// ---------------------------------------------------------------------------
// Test de charge k6 pour le BFF User.
// Cible les routes réellement servies par le BFF : /health et /check_apis (sans
// auth) et les lectures de session /me, /session/me, /user/{id}/about (avec un
// JWT HS256 signé comme le fait Core API).
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
// Doit correspondre au JWT_SECRET des services core-api / bff-user de la stack de test.
const JWT_SECRET = __ENV.JWT_SECRET || 'b"secret"';
// Utilisateur inséré par init-test.sql (sub du token).
const USER_ID = __ENV.PERF_USER_ID || '2';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // montée en charge
    { duration: '1m', target: 20 },  // maintien
    { duration: '10s', target: 0 },  // descente
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],                          // < 1% d'erreurs
    'http_req_duration{endpoint:health}': ['p(95)<50'],      // sonde process
    'http_req_duration{endpoint:connectivity}': ['p(95)<150'], // /check_apis -> core /health
    'http_req_duration{endpoint:session}': ['p(95)<500'],    // agrégation BFF + upstream
  },
};

function b64url(value) {
  return encoding.b64encode(value, 'rawurl');
}

// JWT HS256 minimal accepté par Core API (claims sub + role + exp).
function mintJwt() {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ sub: USER_ID, role: 'user', exp: now + 3600 }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.hmac('sha256', JWT_SECRET, signingInput, 'base64rawurl');
  return `${signingInput}.${signature}`;
}

export function setup() {
  return { token: mintJwt() };
}

export default function (data) {
  const authParams = {
    headers: { Authorization: `Bearer ${data.token}` },
    tags: { endpoint: 'session' },
  };

  group('health', () => {
    const res = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
    check(res, { 'health 200': (r) => r.status === 200 });
  });

  group('connectivity', () => {
    const res = http.get(`${BASE_URL}/check_apis`, { tags: { endpoint: 'connectivity' } });
    check(res, { 'check_apis 200': (r) => r.status === 200 });
  });

  group('session reads', () => {
    const me = http.get(`${BASE_URL}/me`, authParams);
    check(me, { 'me 200': (r) => r.status === 200 });

    const sessionMe = http.get(`${BASE_URL}/session/me`, authParams);
    check(sessionMe, { 'session/me 200': (r) => r.status === 200 });

    const about = http.get(`${BASE_URL}/user/${USER_ID}/about`, authParams);
    check(about, { 'about 200': (r) => r.status === 200 });
  });

  sleep(1);
}
