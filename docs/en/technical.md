# BFF_user — Technical documentation

[Module overview](module.md) · [Français](../fr/technical.md) · [README](../../README.md)

## Architecture and request handling

Express 5.2.1 server written in TypeScript. Zod schemas and their OpenAPI registry describe exchanged objects; routers adapt upstream services to interface needs.

The `auth`, `session`, `user` and `admin` routers are mounted in `src/index.ts`. `src/clients/coreClient.ts` normalizes the Core address and supplies its generated client. Adapters preserve Core responses; administration schemas define list and group envelopes.

## Data and persistence

Core supplies identity and session operations. The BFF SQL repositories also read users and roles and perform some password and group mutations. The first-sign-in flow uses PostgreSQL and Redis. Data access is therefore a mixture of HTTP and direct database operations.

Monitoring, backups, application logs and system policy described in administration requirements are not guaranteed by this contract. SQL access requires a compatible schema, including `group_members`; this name differs from `group_users` used in other contracts.

## Installation and local startup

Use Node.js 22 to reproduce the contract job and npm with the committed lockfile. Other job and Docker versions are detailed below.

Private `@mairie360/*` dependencies require GitHub Packages access. Set `NODE_AUTH_TOKEN` in the environment to a token allowed to read these packages, as configured in `.npmrc`. Do not commit its value.

```bash
npm ci
```

Create `.env` in the repository root. Local HTTP configuration example to adapt to the running services:

```dotenv
PORT=4000
CORE_API_URL=http://localhost:3000
```

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
| `CORE_API_URL` | http://localhost:3000 | Core address including the HTTP(S) scheme. |
| `CORE_API_PORT` | 3000 | Port appended when the address has none. |
| `JWT_SECRET` | — | Core deployment secret required for local administrator checks. |
| `COOKIE_DOMAIN` | — | Shared cookie domain; omit for a host-only cookie. |
| `TRUST_PROXY` | unset (no proxy trusted) | Express `trust proxy`: hop count (`1`), `true`, or trusted addresses/subnets (`loopback, 10.0.0.0/8`). Set it behind the ingress so rate limits apply per client and not per proxy; while it is unset, per-IP limiting is disabled (warning at startup). |
| `AUTH_RATE_LIMIT_ENABLED` | `true` | `false` disables the authentication rate limits (load tests only). |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Rate-limit window (15 minutes). |
| `AUTH_RATE_LIMIT_MAX` | `10` | Failed logins per account e-mail per window (per client IP + e-mail when `TRUST_PROXY` is set), and failed refreshes per refresh token. |
| `AUTH_RATE_LIMIT_IP_MAX` | `100` | Failed attempts per client IP per window, over `/auth/login`, `/auth/force_change_password` and `/auth/refresh`; only applied when `TRUST_PROXY` is set. |

## Routes and data contract

Inventory extracted from `contracts/openapi.json`. Replace brace parameters with real identifiers. Detailed types, required fields, responses and any examples are defined in that contract; table statuses are the declared statuses, not an exhaustive list of transport or validation errors.

| Method | Path | Declared body | Declared statuses |
| --- | --- | --- | --- |
| GET | `/health` | — | 200 |
| GET | `/check_apis` | — | 200, 502 |
| POST | `/auth/login` | application/json | 200, 400, 401, 412, 429, 500, 502 |
| POST | `/auth/force_change_password` | application/json | 204, 400, 401, 403, 429, 500, 502 |
| POST | `/auth/refresh` | application/json | 200, 400, 401, 429, 500, 502 |
| POST | `/auth/logout` | application/json (optional) | 200, 500 |
| GET | `/user/{userId}/about` | — | 200, 400, 401, 500, 502 |
| GET | `/bff/admin/users` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| POST | `/bff/admin/users` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| PATCH | `/bff/admin/users/{userId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| DELETE | `/bff/admin/users/{userId}` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| PATCH | `/bff/admin/users/{userId}/password` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| POST | `/bff/admin/users/{userId}/roles` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| DELETE | `/bff/admin/users/{userId}/roles/{roleId}` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| GET | `/bff/admin/roles` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| POST | `/bff/admin/roles` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| PUT | `/bff/admin/roles/{roleId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| PATCH | `/bff/admin/roles/{roleId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| DELETE | `/bff/admin/roles/{roleId}` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| GET | `/bff/admin/groups` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| POST | `/bff/admin/groups` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| GET | `/bff/admin/groups/{groupId}` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| PATCH | `/bff/admin/groups/{groupId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| DELETE | `/bff/admin/groups/{groupId}` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| GET | `/bff/admin/groups/{groupId}/users` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| POST | `/bff/admin/groups/{groupId}/users` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| DELETE | `/bff/admin/groups/{groupId}/users/{userId}` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| GET | `/bff/admin/sessions` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| GET | `/bff/admin/sessions/history` | — | 200, 201, 204, 400, 401, 403, 404, 502 |
| POST | `/bff/admin/sessions/refresh` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| POST | `/bff/admin/sessions/revoke` | application/json | 200, 201, 204, 400, 401, 403, 404, 502 |
| GET | `/me` | — | 200, 401, 502 |
| GET | `/session/me` | — | 200, 401, 502 |

## Session, permissions and errors

Authentication routes handle their own flow: login bodies are validated before reaching Core. There is no public self-registration: accounts are created by administrators through `/bff/admin/users`. `/auth/login` and `/auth/force_change_password` are rate limited (failed attempts only, 429 + `Retry-After`; in-memory counters per replica). Without `TRUST_PROXY` every client shares the front pods' IP, so only the per-e-mail limit applies: a per-IP limit would let one attacker lock every user out. `/auth/refresh` exchanges the login `refresh_token` for a new access JWT through Core's public `POST /api/v1/sessions/refresh` (no session forwarded, so an expired JWT can be renewed) and returns it like login (header and cookie); its failed attempts are limited per refresh token (SHA-256), and per client IP when `TRUST_PROXY` is set. `/auth/logout` revokes the Core session (`POST /api/v1/sessions/revoke`) when it receives both the session and the `refresh_token` returned by login, which makes Core reject the access JWT immediately; it always clears the cookie, even when Core fails, and reports the outcome in `session_revoked`. Every `/bff/admin/*` route goes through `requireAdmin`, which verifies the session with `JWT_SECRET` and the database role before anything else, because Core API v1.1.1 does not check the administrator role. Other adapters forward the caller's session to Core and never use a default token; `/me` and `/user/{userId}/about` answer 401 without a session, and `/user/{userId}/about` only returns public fields (`phone` may be `null`). `/bff/admin/sessions/refresh` relays the refreshed JWT like login (header and cookie). Error details are only exposed when `NODE_ENV=development`; `/check_apis` never returns network details. Cookie behavior depends on `COOKIE_DOMAIN` and `NODE_ENV`; interface permissions do not replace server checks.

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

The `contracts.yml` job uses Node.js 22, `actions/checkout@v7` and `actions/setup-node@v7`. It runs on pushes, pull requests and manual dispatch; it installs with `npm ci`, checks contracts and runs the associated tests.

`cicd.yml` calls `mairie360/CICD/.github/workflows/BFFs-cicd.yml@v1.13.2`, with `cicd_version: v1.13.2` and `node_version: "22"`. Reusable steps and GitHub environments determine actual checks, publications and deployments.

The Dockerfile currently uses `node:20-alpine` for build and runtime; the image command is `["node", "dist/index.js"]`. That version is separate from the Node.js 22 contract job.

Before running Docker, check service variables, build secrets and networks in the repository files. Green CI validates its jobs; it does not prove business-service availability in a remote environment.

## Troubleshooting

If sign-in works but administration fails, check `JWT_SECRET`, the stored role and SQL access. If first-sign-in password change fails, check Redis, the temporary token and PostgreSQL.

## Repository reference

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
