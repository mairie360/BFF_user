# BFF_user — Technical documentation

[Module overview](module.md) · [Français](../fr/technical.md) · [README](../../README.md)

## Architecture and request handling

Express 5.2.1 server written in TypeScript. Zod schemas and their OpenAPI registry describe exchanged objects; routers adapt upstream services to interface needs.

The `auth`, `session`, `user` and `admin` routers are mounted in `src/app.ts`, which exports the Express app; `src/index.ts` is the entry point (`.env`, startup check, `listen`). Validation, upstream error mapping, `/check_apis`, security headers and rate limiters come from `@mairie360/bffs-lib`. `src/clients/coreClient.ts` normalizes the Core address and supplies its generated client. Adapters preserve Core responses; administration schemas define list and group envelopes.

## Data and persistence

Core supplies identity and session operations. The BFF SQL repositories also read users and roles and perform some password and group mutations. The first-sign-in flow uses PostgreSQL and Redis. Data access is therefore a mixture of HTTP and direct database operations.

Monitoring, backups, application logs and system policy described in administration requirements are not guaranteed by this contract. SQL access requires a compatible schema, including `group_members`; this name differs from `group_users` used in other contracts.

## Installation and local startup

Use Node.js 24 (as the CI jobs and the images) to reproduce the contract job and npm with the committed lockfile. Other job and Docker versions are detailed below.

Private `@mairie360/*` dependencies require GitHub Packages access. Set `NODE_AUTH_TOKEN` in the environment to a token allowed to read these packages, as configured in `.npmrc`. Do not commit its value.

```bash
npm ci
```

Create `.env` in the repository root. Local HTTP configuration example to adapt to the running services:

```dotenv
PORT=4000
CORE_API_URL=http://localhost:3000
JWT_SECRET=<the secret of the local Core API>
```

`.env` is loaded by the first line of `src/index.ts` (`import 'dotenv/config'`), before any other module. The server refuses to start (one error naming every missing variable) when `CORE_API_URL` is missing or invalid or `JWT_SECRET` is missing: there is no `localhost` default.

The BFF needs no database or Redis: everything goes through Core API. The variables and any secrets listed below still need to be supplied; the HTTP example prepares no data.

```bash
npm run start
```

`PORT` is optional; the `src/index.ts` fallback is `4000`.

Check the process, then open the interactive documentation:

```bash
curl --fail --silent --show-error http://localhost:4000/health
```

Swagger UI: `http://localhost:4000/docs`. JSON specification: `/openapi.json`, with `/swagger.json` as an alias. `/health` checks the process; `/check_apis` is a separate dependency diagnostic.

## Configuration

Values below are local examples or explicitly described behavior, not production credentials.

| Variable or precedence | Example / stated fallback | Purpose |
| --- | --- | --- |
| `PORT` | 4000 | Port used by this local example. |
| `CORE_API_URL` | http://core-api:3000 | **Required**, no default. Core address (scheme optional, `http` by default), read on every call: the server does not start without it, and a route calling Core answers 503 if it disappears. |
| `CORE_API_PORT` | 3000 | Port appended when the address has none. |
| `JWT_SECRET` | — | **Required**: Core deployment secret for the local administrator checks; the server does not start without it (503 on `/bff/admin/*` if it disappears). |
| `COOKIE_DOMAIN` | — | Shared cookie domain; omit for a host-only cookie. |
| `TRUST_PROXY` | unset (no proxy trusted) | Express `trust proxy`: hop count (`1`), `true`, or trusted addresses/subnets (`loopback, 10.0.0.0/8`). Set it behind the ingress so rate limits apply per client and not per proxy; while it is unset, per-IP limiting is disabled (warning at startup). |
| `AUTH_RATE_LIMIT_ENABLED` | `true` | `false` disables the authentication rate limits (load tests only). |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Rate-limit window (15 minutes). |
| `AUTH_RATE_LIMIT_MAX` | `10` | Failed logins per account e-mail per window, and failed refreshes per refresh token, whatever the client IP. |
| `AUTH_RATE_LIMIT_IP_MAX` | `100` | Failed attempts per client IP per window, over `/auth/login`, `/auth/force_change_password` and `/auth/refresh`; only applied when `TRUST_PROXY` is set and the request carries `X-Forwarded-For` (a front calling server side without it shares its pod IP with every user). |
| `KEYCLOAK_REALM_URL` | https://auth.mairie360.fr/realms/mairie360 | Public URL of the Keycloak realm, as the browser reaches it. With `KEYCLOAK_CLIENT_ID`, enables the single logout. |
| `KEYCLOAK_CLIENT_ID` | mairie360 | OIDC client the fronts sign in with (the same as Core's). |
| `KEYCLOAK_POST_LOGOUT_REDIRECT_URI` | https://login.mairie360.fr/ | Default page Keycloak sends the browser to after the logout; the client must list it. |

## Routes and data contract

Inventory extracted from `contracts/openapi.json`. Replace brace parameters with real identifiers. Detailed types, required fields, responses and any examples are defined in that contract; table statuses are the declared statuses, not an exhaustive list of transport or validation errors.

| Method | Path | Declared body | Declared statuses |
| --- | --- | --- | --- |
| GET | `/health` | — | 200 |
| GET | `/check_apis` | — | 200, 502 |
| POST | `/auth/login` | application/json | 200, 400, 401, 412, 429, 500, 502 |
| POST | `/auth/keycloak` | application/json | 200, 400, 401, 403, 500, 502, 503 |
| POST | `/auth/force_change_password` | application/json | 204, 400, 401, 403, 429, 500, 502 |
| POST | `/auth/refresh` | application/json | 200, 400, 401, 429, 500, 502 |
| POST | `/auth/logout` | application/json (optional) | 200, 400, 500 |
| GET | `/user/{userId}/about` | — | 200, 400, 401, 404, 500, 502 |
| GET | `/bff/admin/users` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| POST | `/bff/admin/users` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| PATCH | `/bff/admin/users/{userId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| DELETE | `/bff/admin/users/{userId}` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| PATCH | `/bff/admin/users/{userId}/password` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| POST | `/bff/admin/users/{userId}/roles` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| DELETE | `/bff/admin/users/{userId}/roles/{roleId}` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/bff/admin/roles` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| POST | `/bff/admin/roles` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| PUT | `/bff/admin/roles/{roleId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| PATCH | `/bff/admin/roles/{roleId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| DELETE | `/bff/admin/roles/{roleId}` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/bff/admin/groups` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| POST | `/bff/admin/groups` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/bff/admin/groups/{groupId}` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| PATCH | `/bff/admin/groups/{groupId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| DELETE | `/bff/admin/groups/{groupId}` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/bff/admin/groups/{groupId}/users` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| POST | `/bff/admin/groups/{groupId}/users` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| DELETE | `/bff/admin/groups/{groupId}/users/{userId}` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/bff/admin/sessions` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| GET | `/bff/admin/sessions/history` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| POST | `/bff/admin/sessions/revoke` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/me` | — | 200, 401, 502 |
| GET | `/session/me` | — | 200, 401, 502 |

## Session, permissions and errors

Authentication routes handle their own flow: login bodies are validated before reaching Core. There is no public self-registration: accounts are created by administrators through `/bff/admin/users`. `/auth/keycloak` completes the Keycloak single sign-on: it forwards the authorization code (with `redirect_uri`, and the PKCE `code_verifier` and `nonce` when used) to Core's public `POST /api/v1/auth/keycloak`, which redeems it and opens a session for the account with the same verified e-mail; the session is then set exactly like login (HttpOnly `accessToken` and `refreshToken` cookies), so roles and the other BFFs are unchanged. Core's `503` (Keycloak not configured) is kept so the front can fall back to the password login, which stays available during the transition. `/auth/login` and `/auth/force_change_password` are rate limited (failed attempts only, 429 + `Retry-After`; in-memory counters per replica). Without `TRUST_PROXY` every client shares the front pods' IP, so only the per-e-mail limit applies: a per-IP limit would let one attacker lock every user out. The same holds per request when `TRUST_PROXY` is set: a request without `X-Forwarded-For` (a front calling server side) skips the per-IP limit. Sign-in delivers the session only in HttpOnly, `SameSite=Strict` cookies: `accessToken` (the access JWT, path `/`) and `refreshToken` (path `/auth`); no token is returned in the body or in a response header. `/auth/force_change_password` requires an 8 to 255 character password, like the admin routes. `/auth/refresh` exchanges the refresh token (body `refresh_token`, else the `refreshToken` cookie) for a new access JWT through Core's public `POST /api/v1/sessions/refresh` (no session forwarded, so an expired JWT can be renewed) and sets it like login (cookie only); its failed attempts are limited per refresh token (SHA-256), and per client IP when `TRUST_PROXY` is set. `/auth/logout` revokes the Core session (`POST /api/v1/sessions/revoke`) when it receives both the session and the refresh token (body or `refreshToken` cookie), which makes Core reject the access JWT immediately; it always clears both cookies, even when Core fails, and reports the outcome in `session_revoked`. With `KEYCLOAK_REALM_URL` and `KEYCLOAK_CLIENT_ID` set, `/auth/logout` also returns `logout_url`, the realm's OpenID Connect end-session URL (`/protocol/openid-connect/logout`) that the front must send the browser to: Keycloak then closes the single sign-on session and, through its front-channel or back-channel logout, the sessions of the other tools of the realm (n8n). Core keeps no Keycloak token, so the URL carries `client_id` rather than `id_token_hint` and Keycloak asks the user to confirm; the `post_logout_redirect_uri` comes from the optional body, else from `KEYCLOAK_POST_LOGOUT_REDIRECT_URI`, and must be allowed on the client. Every `/bff/admin/*` request body is validated against a Zod schema mirroring the Core API view it is forwarded to (unknown fields stripped, `<` and `>` refused in stored labels, the path identifier wins over the body's `user_id`/`group_id`, no password in a user update); invalid bodies answer 400 without reaching Core. Every `/bff/admin/*` route goes through `requireAdmin`, which verifies the session with `JWT_SECRET` and the database role before anything else, because Core API v1.1.1 does not check the administrator role. Other adapters forward the caller's session to Core and never use a default token; the session is read from the `Authorization: Bearer` header only, which the fronts' proxy builds from the `accessToken` cookie (the `accessToken` cookie, the `x-session-token` header, the `session` cookie and other schemes are ignored, `/auth/logout` and the admin check included); session-bound routes answer 401 before any validation or Core call without it, and every `/auth`, `/me`, `/session`, `/user` and `/bff/admin` answer carries `Cache-Control: no-store`. Read routes (`/me`, admin lists) only return the fields of their contract schema: anything else Core adds is dropped, and a Core answer that does not match is a 502; `/me` and `/user/{userId}/about` answer 401 without a session, and `/user/{userId}/about` only returns public fields (`phone` may be `null`). `/bff/admin/sessions/refresh` was removed: it replaced the administrator's own cookie with the refreshed session's JWT, and Core publishes no revocation by session id. A missing `CORE_API_URL` answers 503 on every route that calls Core (declared in the contract), and a missing `JWT_SECRET` answers 503 on `/bff/admin/*`; the startup check normally prevents both. Neither the tokens nor the outgoing Core URLs are logged. Every error answers the envelope shared by all the BFFs (`@mairie360/bffs-lib`), `{ "error": { "code", "message", "details" } }`, declared as `ErrorResponse` in the contract: `code` follows the status (`BAD_REQUEST`, `UNAUTHORIZED`, `CONFLICT`, `BAD_GATEWAY`...), and a 400 (`Validation failed`) lists the invalid fields in `details` (`{ "path": "body.email", "message" }`). Core reads (GET) are retried once on a transient failure (no answer, 502, 503, 504), writes never. Only the Core 4xx a route declares are kept, with a generic message (`/user/{userId}/about` keeps 401 and 404, admin writes also keep 409); any other Core status and an unreachable Core answer 502, and the Core body is never relayed. The first sign-in 412 of `/auth/login` is not an error: it only carries the one-time `token`. Unexpected errors answer a generic 500, whatever `NODE_ENV`; `/check_apis` never returns network details. Cookie behavior depends on `COOKIE_DOMAIN` and `NODE_ENV`; interface permissions do not replace server checks.

## Synchronization and verification

```bash
npm run contracts:generate
npm run contracts:check
npm test -- --runInBand
npm run lint
npm run build
```

Tests in `tests/user.upstream-mocks.test.ts` run the whole application and the real Core API client against a local HTTP mock driven by the Core API contract, rebuilt from the installed `@mairie360/core-api-openapi` package (orval types, version pinned in `package.json`): every request (path, parameters, JSON body) and every mocked success response is validated against that contract, and every BFF response against `contracts/openapi.json`. Bumping the package is enough to test against its new contract; error statuses are not typed by orval and are simulated explicitly. PostgreSQL and Redis repositories stay mocked with `jest.mock`. Routes served by Core API v1.1.1 but missing from the published contract are listed, with their reason, in `tests/support/core-fixtures.ts`.

`contracts:generate` exports the runtime registry to `contracts/openapi.json` and regenerates `contracts/bff.d.ts`. `contracts:check` fails when the contract or types are stale. Then run `npm run contracts:sync` in each associated web service and deliver contract changes together.

The type generator is pinned to `openapi-typescript@7.10.1` in `scripts/contracts.mjs` and runs through npm. For documentation-only changes, check links, accuracy in both languages and `git diff --check`; do not regenerate contracts without changing their source.

## CI/CD and Docker execution

The `contracts.yml` job uses Node.js 24, `actions/checkout@v7` and `actions/setup-node@v7`. It runs on pushes, pull requests and manual dispatch; it installs with `npm ci`, checks contracts and runs the associated tests.

`cicd.yml` calls `mairie360/CICD/.github/workflows/BFFs-cicd.yml@v3.2.0`, with `cicd_version: v3.2.0` and `node_version: "24"`. Reusable steps and GitHub environments determine actual checks, publications and deployments.

The `Dockerfile` (build and runtime) and `development.Dockerfile` use `node:24-alpine` pinned by digest, the same Node.js as the CI jobs; the production image command is `["node", "dist/index.js"]` (the `@mairie360/*-openapi` packages are bundled by esbuild, nothing is compiled at runtime) and the development image runs `npm run start` (`tsx watch`).

`security_test.sh` and `performance_test.sh` test the image named by `IMAGE_REF`: in CI, the image `release-dev` has just published, the same artifact that is then promoted to staging and prod. When `IMAGE_REF` is empty (local use), they first build `bff-user:local` from `development.Dockerfile`, which needs `NODE_AUTH_TOKEN` and `./.npmrc`.

`security_test.sh` runs the OWASP ZAP stack of `docker-compose-security.yml`: ZAP replays every operation of `/openapi.json` with a static admin JWT (`sub=1`, HS256, `JWT_SECRET=b"secret"`) and fills bodies and path parameters from the contract examples. `init-test.sql` seeds the resources those examples name (users 1, 2, 10, 11, 42, roles and groups 10 and 11, two sessions); keep examples and seed in sync when adding a route.

Both stacks carry the OpenAPI coverage gate of `mairie360/CICD` (`tests/zap/zap_hooks.py`, `tests/k6/coverage.js`), checked out as `cicd-repo/` by the CI jobs and cloned there by the scripts at the pinned `cicd_version` (`CICD_VERSION` overrides it). After the scan, the ZAP hook fails when an operation of the contract was never reached, or when an operation that requires `bearerAuth` only got 401/403; public operations declare `security: []` in their `registerPath`. `load-test.js` holds one handler per operation of `contracts/openapi.json`: k6 aborts at init when one is missing and fails its `operations_uncovered` threshold when a handler does not send its request. **Adding a route means adding its handler in `load-test.js`** (and `security: []` when it is public).

`load-test.js` runs two scenarios. `crud` (2 VUs) calls every handler once per iteration, writes included, as one self-contained admin scenario that deletes what it creates. `reads` (ramp to 20 VUs) replays only the GET handlers against the fixtures seeded by `init-test.sql`. Every operation has a `p(95)` threshold set by its family: 50 ms for `/health`, 150 ms for `/check_apis`, 500 ms for reads, 800 ms for `/auth/*` and admin writes; `http_req_failed` must stay below 1 %.

Before running Docker, check service variables, build secrets and networks in the repository files. Green CI validates its jobs; it does not prove business-service availability in a remote environment.

## Troubleshooting

If sign-in works but administration fails, check `JWT_SECRET`, the stored role and SQL access. If first-sign-in password change fails, check Redis, the temporary token and PostgreSQL.

## Repository reference

- [src/app.ts](../../src/app.ts)
- [src/index.ts](../../src/index.ts)
- [src/routes/auth.ts](../../src/routes/auth.ts)
- [src/routes/session.ts](../../src/routes/session.ts)
- [src/routes/admin.ts](../../src/routes/admin.ts)
- [src/routes/admin_schemas.ts](../../src/routes/admin_schemas.ts)
- [src/repositories/adminRepository.ts](../../src/repositories/adminRepository.ts)
- [src/repositories/firstConnectionRepository.ts](../../src/repositories/firstConnectionRepository.ts)
- [src/clients/coreClient.ts](../../src/clients/coreClient.ts)
- [contracts/openapi.json](../../contracts/openapi.json)
- [contracts/bff.d.ts](../../contracts/bff.d.ts)
- [scripts/contracts.mjs](../../scripts/contracts.mjs)
- [package.json](../../package.json)
- [.github/workflows/contracts.yml](../../.github/workflows/contracts.yml)
- [.github/workflows/cicd.yml](../../.github/workflows/cicd.yml)
- [Dockerfile](../../Dockerfile)
- [docker-compose.yml](../../docker-compose.yml)

Historical supplements: [CONTRACT.md](../../CONTRACT.md). Proposed requirements must remain distinct from implemented behavior.
