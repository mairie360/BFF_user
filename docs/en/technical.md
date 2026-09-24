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

## Routes and data contract

Inventory extracted from `contracts/openapi.json`. Replace brace parameters with real identifiers. Detailed types, required fields, responses and any examples are defined in that contract; table statuses are the declared statuses, not an exhaustive list of transport or validation errors.

| Method | Path | Declared body | Declared statuses |
| --- | --- | --- | --- |
| GET | `/health` | — | 200 |
| GET | `/check_apis` | — | 200, 502 |
| POST | `/auth/login` | application/json | 200, 400, 401, 412, 500, 502 |
| POST | `/auth/register` | application/json | 201, 400, 409, 500, 502 |
| POST | `/auth/force_change_password` | application/json | 204, 400, 401, 403, 500, 502 |
| POST | `/auth/logout` | — | 200, 500 |
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

Authentication routes handle their own flow: login and register bodies are validated before reaching Core, and register uses Core's public `POST /api/v1/auth/register`. Every `/bff/admin/*` request body is validated against a Zod schema mirroring the Core API view it is forwarded to (unknown fields stripped, `<` and `>` refused in stored labels, the path identifier wins over the body's `user_id`/`group_id`, no password in a user update); invalid bodies answer 400 without reaching Core. Every `/bff/admin/*` route goes through `requireAdmin`, which verifies the session with `JWT_SECRET` and the database role before anything else, because Core API v1.1.1 does not check the administrator role. Other adapters forward the caller's session to Core and never use a default token; `/me` and `/user/{userId}/about` answer 401 without a session, and `/user/{userId}/about` only returns public fields (`phone` may be `null`). `/bff/admin/sessions/refresh` relays the refreshed JWT like login (header and cookie). Error details are only exposed when `NODE_ENV=development`; `/check_apis` never returns network details. Cookie behavior depends on `COOKIE_DOMAIN` and `NODE_ENV`; interface permissions do not replace server checks.

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

`cicd.yml` calls `mairie360/CICD/.github/workflows/BFFs-cicd.yml@v3.0.0`, with `cicd_version: v3.0.0` and `node_version: "22"`. Reusable steps and GitHub environments determine actual checks, publications and deployments.

The Dockerfile currently uses `node:20-alpine` for build and runtime; the image command is `["node", "dist/index.js"]`. That version is separate from the Node.js 22 contract job.

`security_test.sh` and `performance_test.sh` test the image named by `IMAGE_REF`: in CI, the image `release-dev` has just published, the same artifact that is then promoted to staging and prod. When `IMAGE_REF` is empty (local use), they first build `bff-user:local` from `development.Dockerfile`, which needs `NODE_AUTH_TOKEN` and `./.npmrc`.

`security_test.sh` runs the OWASP ZAP stack of `docker-compose-security.yml`: ZAP replays every operation of `/openapi.json` with a static admin JWT (`sub=1`, HS256, `JWT_SECRET=b"secret"`) and fills bodies and path parameters from the contract examples. `init-test.sql` seeds the resources those examples name (users 1, 2, 10, 11, 42, roles and groups 10 and 11, two sessions); keep examples and seed in sync when adding a route.

Both stacks carry the OpenAPI coverage gate of `mairie360/CICD` (`tests/zap/zap_hooks.py`, `tests/k6/coverage.js`), checked out as `cicd-repo/` by the CI jobs and cloned there by the scripts at the pinned `cicd_version` (`CICD_VERSION` overrides it). After the scan, the ZAP hook fails when an operation of the contract was never reached, or when an operation that requires `bearerAuth`/`cookieAuth` only got 401/403; public operations declare `security: []` in their `registerPath`. `load-test.js` holds one handler per operation of `contracts/openapi.json`: k6 aborts at init when one is missing and fails its `operations_uncovered` threshold when a handler does not send its request. **Adding a route means adding its handler in `load-test.js`** (and `security: []` when it is public).

`load-test.js` runs two scenarios. `crud` (2 VUs) calls every handler once per iteration, writes included, as one self-contained admin scenario that deletes what it creates. `reads` (ramp to 20 VUs) replays only the GET handlers against the fixtures seeded by `init-test.sql`. Every operation has a `p(95)` threshold set by its family: 50 ms for `/health`, 150 ms for `/check_apis`, 500 ms for reads, 800 ms for `/auth/*` and admin writes; `http_req_failed` must stay below 1 %.

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
