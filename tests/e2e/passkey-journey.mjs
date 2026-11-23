/* global console, fetch */
// Passkey journey of BFF_user on the integration stack (docker-compose-integration.yml, `passkey-journey` service).
//
// Newman cannot sign a WebAuthn answer, so the creation and the sign-in of a passkey are replayed here with a software
// authenticator (ES256, `none` attestation, discoverable credential, user verification) written with node:crypto:
// the requests go through the real BFF to the real Core API, exactly as a browser's would.
//
//   1. an agent with a session creates a passkey (challenge, then label + answer), signs in with it, is refused when the
//      challenge is replayed or the counter goes back, and is refused once the passkey is deleted;
//   2. an agent subject to the mandatory policy gets `2fa_setup_required`, creates a passkey with the enrolment token
//      (no session yet): the session opens, no backup codes, the token is spent, the passkey signs in afterwards.
//
// Environment: BFF_URL, CORE_URL, JWT_ADMIN, JWT_AGENT (EdDSA tokens of the run), RP_ID and RP_ORIGIN (those of Core).

import { Buffer } from 'node:buffer';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import process from 'node:process';

const { BFF_URL, CORE_URL, JWT_ADMIN, JWT_AGENT, RP_ID = 'localhost', RP_ORIGIN = 'http://localhost' } = process.env;
for (const [name, value] of Object.entries({ BFF_URL, CORE_URL, JWT_ADMIN, JWT_AGENT })) {
  if (!value) throw new Error(`${name} must be set`);
}

const AGENT_ID = 2; // plain agent of init-test.sql
const OPTIONAL_POLICY = { required: false, totp_allowed: true, passkey_allowed: false, backup_codes_allowed: true };

// ---------------------------------------------------------------------------------------------------------------
// Software authenticator
// ---------------------------------------------------------------------------------------------------------------
const b64url = (buffer) => Buffer.from(buffer).toString('base64url');
const sha256 = (data) => createHash('sha256').update(data).digest();

/** The few CBOR types an attestation object and a COSE key use. Maps are `Map` instances, byte strings `Buffer`s. */
function cbor(value) {
  const head = (major, length) => {
    if (length < 24) return Buffer.from([(major << 5) | length]);
    if (length < 256) return Buffer.from([(major << 5) | 24, length]);
    return Buffer.from([(major << 5) | 25, length >> 8, length & 255]);
  };
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (typeof value === 'string') {
    const text = Buffer.from(value);
    return Buffer.concat([head(3, text.length), text]);
  }
  if (value instanceof Map) return Buffer.concat([head(5, value.size), ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)])]);
  throw new Error(`unsupported CBOR value ${typeof value}`);
}

class SoftAuthenticator {
  #privateKey;
  #publicJwk;
  #credentialId = randomBytes(32);
  #userHandle;
  counter = 0;

  constructor() {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.#privateKey = privateKey;
    this.#publicJwk = publicKey.export({ format: 'jwk' });
  }

  get credentialId() {
    return b64url(this.#credentialId);
  }

  #clientData(type, challenge) {
    return Buffer.from(JSON.stringify({ type, challenge, origin: RP_ORIGIN, crossOrigin: false }));
  }

  /** `navigator.credentials.create` of the options Core sent: a discoverable credential, user verified. */
  create(creationOptions) {
    const { publicKey } = creationOptions;
    if (publicKey.rp.id !== RP_ID) throw new Error(`rp.id is ${publicKey.rp.id}, expected ${RP_ID}`);
    this.#userHandle = publicKey.user.id;
    const coseKey = new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(this.#publicJwk.x, 'base64url')], [-3, Buffer.from(this.#publicJwk.y, 'base64url')]]);
    const credentialIdLength = Buffer.alloc(2);
    credentialIdLength.writeUInt16BE(this.#credentialId.length);
    const authData = Buffer.concat([
      sha256(RP_ID),
      Buffer.from([0x45]), // user present, user verified, attested credential data
      Buffer.alloc(4),
      Buffer.alloc(16), // AAGUID: unknown authenticator, so Core finds no manager name
      credentialIdLength,
      this.#credentialId,
      cbor(coseKey),
    ]);
    const attestationObject = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key',
      response: { attestationObject: b64url(attestationObject), clientDataJSON: b64url(this.#clientData('webauthn.create', publicKey.challenge)) },
      extensions: {},
    };
  }

  /** `navigator.credentials.get` of the options Core sent. `counter` overrides the signature counter (a clone). */
  get(requestOptions, counter = ++this.counter) {
    const { publicKey } = requestOptions;
    if (publicKey.rpId !== RP_ID) throw new Error(`rpId is ${publicKey.rpId}, expected ${RP_ID}`);
    const counterBytes = Buffer.alloc(4);
    counterBytes.writeUInt32BE(counter);
    const authData = Buffer.concat([sha256(RP_ID), Buffer.from([0x05]), counterBytes]); // user present, user verified
    const clientData = this.#clientData('webauthn.get', publicKey.challenge);
    const signature = sign('sha256', Buffer.concat([authData, sha256(clientData)]), this.#privateKey);
    return {
      id: this.credentialId,
      rawId: this.credentialId,
      type: 'public-key',
      response: { authenticatorData: b64url(authData), clientDataJSON: b64url(clientData), signature: b64url(signature), userHandle: this.#userHandle },
      extensions: {},
    };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Journey
// ---------------------------------------------------------------------------------------------------------------
const failures = [];
function check(name, condition, detail = '') {
  console.log(`${condition ? 'ok  ' : 'FAIL'} ${name}${condition || !detail ? '' : ` (${detail})`}`);
  if (!condition) failures.push(name);
  return condition;
}

async function call(method, url, { token, body, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, json, text, headers: response.headers, cookies: response.headers.getSetCookie() };
}

const bff = (method, path, options) => call(method, `${BFF_URL}${path}`, options);
const cookieValue = (response, name) => response.cookies.map((cookie) => cookie.split(';')[0]).find((pair) => pair.startsWith(`${name}=`))?.slice(name.length + 1);
const setPolicy = (policy) => bff('PUT', '/admin/two-factor-policy', { token: JWT_ADMIN, body: policy });

/** Sign-in by passkey: the challenge, the signed answer. */
async function signIn(authenticator, { counter, replayOf, headers } = {}) {
  const challenge = replayOf ?? (await bff('POST', '/auth/passkey/options', { body: {}, headers }));
  if (!challenge.json?.id) throw new Error(`no challenge: ${challenge.status} ${challenge.text}`);
  const answer = await bff('POST', '/auth/passkey', {
    body: { id: challenge.json.id, credential: authenticator.get(challenge.json.options, counter), device_info: 'passkey-journey' },
    headers,
  });
  return { challenge, answer };
}

async function sessionJourney() {
  console.log('\n== A signed-in agent creates a passkey, then signs in with it');
  const authenticator = new SoftAuthenticator();

  const creation = await bff('POST', '/user/me/passkeys/options', { token: JWT_AGENT, body: {} });
  check('the creation challenge asks for a discoverable credential with user verification', creation.status === 200
    && creation.json?.options?.publicKey?.authenticatorSelection?.residentKey === 'required'
    && creation.json.options.publicKey.authenticatorSelection.userVerification === 'required', `${creation.status} ${creation.text}`);

  const created = await bff('POST', '/user/me/passkeys', { token: JWT_AGENT, body: { label: 'journey', credential: authenticator.create(creation.json.options) } });
  check('the passkey is stored under its label (201), no manager name for an unknown authenticator', created.status === 201
    && created.json?.label === 'journey' && created.json.provider === null && Number.isInteger(created.json.id), `${created.status} ${created.text}`);
  const passkeyId = created.json?.id;

  // MAIR-811: the Login screen saves the name the agent keeps after the creation.
  const renamed = await bff('PATCH', `/user/me/passkeys/${passkeyId}`, { token: JWT_AGENT, body: { label: 'Ordinateur de la mairie' } });
  check('the passkey takes the name the agent keeps (200), the rest unchanged', renamed.status === 200
    && renamed.json?.id === passkeyId && renamed.json.label === 'Ordinateur de la mairie' && renamed.json.provider === null, `${renamed.status} ${renamed.text}`);
  const foreign = await bff('PATCH', `/user/me/passkeys/${passkeyId}`, { token: JWT_ADMIN, body: { label: 'Volée' } });
  check('another account cannot rename it (404)', foreign.status === 404, `${foreign.status} ${foreign.text}`);

  const first = await signIn(authenticator);
  const accessToken = cookieValue(first.answer, 'accessToken');
  check('the passkey signs in: session cookies like the password login, no token in the body', first.answer.status === 200
    && !!accessToken && !!cookieValue(first.answer, 'refreshToken') && first.answer.json?.message === 'Logged in successfully'
    && first.answer.json.passkey_offer === undefined && !first.answer.text.includes(accessToken), `${first.answer.status} ${first.answer.text}`);

  const about = await bff('GET', `/user/${AGENT_ID}/about`, { token: accessToken });
  check('the session opened by the passkey is the agent\'s', about.status === 200 && typeof about.json?.email === 'string', `${about.status} ${about.text}`);

  const replay = await signIn(authenticator, { replayOf: first.challenge });
  check('a replayed challenge is refused with the single 401, no cookie', replay.answer.status === 401 && replay.answer.cookies.length === 0, `${replay.answer.status}`);

  const cloned = await signIn(authenticator, { counter: 0 });
  check('a counter that went back (cloned passkey) is refused with the same 401', cloned.answer.status === 401 && cloned.answer.cookies.length === 0, `${cloned.answer.status}`);

  const again = await signIn(authenticator);
  check('the passkey still signs in after the refusals', again.answer.status === 200, `${again.answer.status} ${again.answer.text}`);

  const removed = await call('DELETE', `${CORE_URL}/api/v1/user/me/passkeys/${passkeyId}/`, { token: JWT_AGENT });
  check('Core deletes the passkey (204)', removed.status === 204, `${removed.status} ${removed.text}`);
  const afterDelete = await signIn(authenticator);
  check('once deleted, the passkey signs in no more', afterDelete.answer.status === 401 && afterDelete.answer.cookies.length === 0, `${afterDelete.answer.status}`);
}

async function enrolmentJourney() {
  console.log('\n== An agent subject to the mandatory policy creates a passkey with the enrolment token');
  const stamp = `${Date.now()}.${randomBytes(3).toString('hex')}`;
  const email = `passkey.journey.${stamp}@mairie360.test`;
  const password = `pw-${randomBytes(9).toString('hex')}`;
  const created = await bff('POST', '/admin/users', { token: JWT_ADMIN, body: { email, first_name: 'Camille', last_name: 'Passkey', password: `pw-${randomBytes(9).toString('hex')}` } });
  if (!check('the account is created', created.status === 201 && Number.isInteger(created.json?.id), `${created.status} ${created.text}`)) return;
  const userId = created.json.id;
  try {
    const reset = await bff('PATCH', `/admin/users/${userId}/password`, { token: JWT_ADMIN, body: { new_password: password } });
    check('its first connection is ended by the administrator (204)', reset.status === 204, `${reset.status} ${reset.text}`);

    const mandatory = await setPolicy({ ...OPTIONAL_POLICY, required: true, passkey_allowed: true });
    check('the administrator makes the second factor mandatory and allows passkeys', mandatory.status === 200 && mandatory.json?.passkey_allowed === true, `${mandatory.status} ${mandatory.text}`);

    const login = await bff('POST', '/auth/login', { body: { email, password, device_info: 'passkey-journey' } });
    check('the password login opens no session: 202 2fa_setup_required with the policy', login.status === 202 && login.json?.status === '2fa_setup_required'
      && login.json.policy?.passkey_allowed === true && login.cookies.length === 0, `${login.status} ${login.text}`);
    const token = login.json?.token;

    const authenticator = new SoftAuthenticator();
    const creation = await bff('POST', '/auth/passkey/setup/options', { body: { token } });
    check('the enrolment token yields the creation challenge', creation.status === 200 && !!creation.json?.options?.publicKey?.challenge, `${creation.status} ${creation.text}`);

    const forged = authenticator.create(creation.json.options);
    forged.response.clientDataJSON = b64url(Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: b64url(randomBytes(32)), origin: RP_ORIGIN, crossOrigin: false })));
    const refused = await bff('POST', '/auth/passkey/setup', { body: { token, label: 'journey', credential: forged } });
    check('an answer to another challenge is refused and opens no session', refused.status === 400 && refused.cookies.length === 0, `${refused.status} ${refused.text}`);

    const retry = await bff('POST', '/auth/passkey/setup/options', { body: { token } });
    const done = await bff('POST', '/auth/passkey/setup', { body: { token, label: 'journey', credential: authenticator.create(retry.json.options) } });
    const accessToken = cookieValue(done, 'accessToken');
    check('the passkey satisfies the policy: the session opens in cookies, no backup codes', done.status === 200 && !!accessToken && !!cookieValue(done, 'refreshToken')
      && done.json?.message === 'Logged in successfully' && done.json.backup_codes === undefined, `${done.status} ${done.text}`);
    const about = await bff('GET', `/user/${userId}/about`, { token: accessToken });
    check('the session is the agent\'s', about.status === 200 && about.json?.email === email, `${about.status} ${about.text}`);

    const spent = await bff('POST', '/auth/passkey/setup/options', { body: { token } });
    check('the enrolment token is single use', spent.status === 401, `${spent.status} ${spent.text}`);

    // Another client address: the refusals above (and the collection's) used up the per-address allowance of Core.
    const next = await signIn(authenticator, { headers: { 'X-Forwarded-For': '203.0.113.77' } });
    check('the next sign-in by passkey passes under the mandatory policy', next.answer.status === 200 && !!cookieValue(next.answer, 'accessToken'), `${next.answer.status} ${next.answer.text}`);
  } finally {
    await setPolicy(OPTIONAL_POLICY);
    await bff('DELETE', `/admin/users/${userId}`, { token: JWT_ADMIN });
  }
}

try {
  const allowed = await setPolicy({ ...OPTIONAL_POLICY, passkey_allowed: true });
  if (allowed.status !== 200) throw new Error(`the policy could not allow passkeys: ${allowed.status} ${allowed.text}`);
  await sessionJourney();
  await enrolmentJourney();
} catch (error) {
  console.error(error);
  failures.push(`crashed: ${error.message}`);
} finally {
  await setPolicy(OPTIONAL_POLICY).catch(() => undefined);
}

console.log(failures.length === 0 ? '\nPasskey journey passed.' : `\n${failures.length} check(s) failed:\n- ${failures.join('\n- ')}`);
process.exit(failures.length === 0 ? 0 : 1);
