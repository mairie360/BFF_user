# BFF_user — Technical documentation

[Module overview](module.md) · [Français](../fr/technical.md) · [README](../../README.md)

## Architecture and request handling

Express 5.2.1 server written in TypeScript. Zod schemas and their OpenAPI registry describe exchanged objects; routers adapt upstream services to interface needs.

The `auth`, `session`, `user` and `admin` routers are mounted in `src/app.ts`, which exports the Express app; `src/index.ts` is the entry point (`.env`, startup check, `listen`). Validation, upstream error mapping, `/check_apis`, security headers and rate limiters come from `@mairie360/bffs-lib`. `src/clients/coreClient.ts` normalizes the Core address and supplies its generated client. Adapters preserve Core responses; administration schemas define list and group envelopes.

## Data and persistence

Core API supplies identity, sessions, users, roles and groups: the BFF has no database or Redis access, and every read or write goes through Core API, first sign-in included.

Monitoring, backups, application logs and system policy described in administration requirements are not guaranteed by this contract.

## Installation and local startup

Use Node.js 26.13.1 (as the CI jobs and the images) to reproduce the contract job and npm with the committed lockfile. Other job and Docker versions are detailed below.

Private `@mairie360/*` dependencies require GitHub Packages access. Set `NODE_AUTH_TOKEN` in the environment to a token allowed to read these packages, as configured in `.npmrc`. Do not commit its value.

```bash
npm ci
```

Create `.env` in the repository root. Local HTTP configuration example to adapt to the running services:

```dotenv
PORT=4000
CORE_API_URL=http://localhost:3000
JWT_PUBLIC_KEY=<the public key of the local Core API (PEM)>
```

`.env` is loaded by the first line of `src/index.ts` (`import 'dotenv/config'`), before any other module. The server refuses to start (one error naming every missing variable) when `CORE_API_URL` is missing or invalid or `JWT_PUBLIC_KEY` is not set (bffs-lib >= 3 ignores `JWT_SECRET`): there is no `localhost` default.

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
| `PROJECT_API_URL`, `CALENDAR_API_URL`, `MESSAGE_API_URL`, `ELEARNING_API_URL` (+ optional `*_PORT`) | http://project-api:3001 | Business APIs read by `GET /search` only, on every call: optional at startup, a module whose address is missing is listed in `unavailable`. |
| `PROJECT_BFF_URL` | http://bff-project:4001 | BFF_Project address, read on every call by `GET /admin/projects-without-group` only: optional at startup, that route answers 503 without it. |
| `PROJECT_BFF_PORT` | 4001 | Port appended when the address has none, or only the default port of its scheme (`:80`, `:443`), which URL parsing drops: leave it unset to keep such an explicit port. |
| `JWT_PUBLIC_KEY` | — | **Required** to verify Core's EdDSA tokens (MAIR-680; bffs-lib >= 3 refuses HS256 tokens and ignores `JWT_SECRET`): Core's Ed25519 public key (PEM; several blocks during a rotation, `\n`-escaped line breaks accepted). Session tokens are verified locally with it (EdDSA, `kid`, `iss`, `aud`); the server does not start without it (503 on `/admin/*` if it disappears). |
| `COOKIE_DOMAIN` | — | Shared cookie domain; omit for a host-only cookie. |
| `TRUST_PROXY` | unset (no proxy trusted) | Express `trust proxy`: hop count (`1`), `true`, or trusted addresses/subnets (`loopback, 10.0.0.0/8`). Set it behind the ingress so rate limits apply per client and not per proxy; while it is unset, per-IP limiting is disabled (warning at startup). |
| `AUTH_RATE_LIMIT_ENABLED` | `true` | `false` disables the authentication rate limits (load tests only). |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Rate-limit window (15 minutes). |
| `AUTH_RATE_LIMIT_MAX` | `10` | Failed logins per account e-mail per window, and failed refreshes per refresh token, whatever the client IP. |
| `AUTH_RATE_LIMIT_IP_MAX` | `100` | Failed attempts per client IP per window, over `/auth/login`, `/auth/force_change_password`, `/auth/forgot_password`, `/auth/reset_password` and `/auth/refresh`; only applied when `TRUST_PROXY` is set and the request carries `X-Forwarded-For` (a front calling server side without it shares its pod IP with every user). |
| `AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX` | `10` | `/auth/forgot_password` requests per client IP and per account e-mail per window, every request counted (the route always answers 200, MAIR-679). The per-IP part follows the same `TRUST_PROXY` / `X-Forwarded-For` rule; the per-e-mail part (SHA-256 of the address) holds across client IPs. The client IP is also relayed to Core API as `X-Forwarded-For` on every anonymous call (sign-in, Keycloak, forgot / reset / forced password change, refresh), so Core's own per-IP budgets count the client, not the BFF pod. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset (telemetry off) | OpenTelemetry collector of the instance, e.g. `http://otel-collector:4318`: traces and HTTP metrics are exported over OTLP (MAIR-504). Only the method, status, parameterised route and upstream host leave the BFF, never a URL, query string, header, id or IP. |
| `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` | `bff-user`; unset | Override the service name; extra resource attributes such as `service.version=<image tag>,deployment.environment.name=prod`. `OTEL_SDK_DISABLED=true` turns telemetry off. |

## Routes and data contract

Inventory extracted from `contracts/openapi.json`. Replace brace parameters with real identifiers. Detailed types, required fields, responses and any examples are defined in that contract; table statuses are the declared statuses, not an exhaustive list of transport or validation errors.

| Method | Path | Declared body | Declared statuses |
| --- | --- | --- | --- |
| GET | `/health` | — | 200 |
| GET | `/check_apis` | — | 200, 502 |
| POST | `/auth/login` | application/json | 200, 400, 401, 412, 429, 500, 502 |
| POST | `/auth/force_change_password` | application/json | 204, 400, 401, 403, 429, 500, 502 |
| POST | `/auth/forgot_password` | application/json | 200, 400, 429, 500, 502 |
| POST | `/auth/reset_password` | application/json | 200, 400, 401, 429, 500, 502 |
| POST | `/auth/refresh` | application/json | 200, 400, 401, 429, 500, 502 |
| POST | `/auth/logout` | application/json (optional) | 200, 400, 500 |
| GET | `/user/{userId}/about` | — | 200, 400, 401, 404, 500, 502 |
| GET | `/admin/users` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| POST | `/admin/users` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| PATCH | `/admin/users/{userId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| DELETE | `/admin/users/{userId}` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| POST | `/admin/users/{userId}/roles` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| DELETE | `/admin/users/{userId}/roles/{roleId}` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/admin/users/{userId}/sessions` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| DELETE | `/admin/users/{userId}/sessions` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| DELETE | `/admin/users/{userId}/sessions/{sessionId}` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| POST | `/admin/users/{userId}/suspend` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| PUT | `/admin/users/{userId}/service` | `AdminUserServiceBody` | 200, 201, 204, 400, 401, 403, 404, 429, 500, 502, 503 |
| GET | `/admin/services` | — | 200, 201, 204, 400, 401, 403, 404, 429, 500, 502, 503 |
| POST | `/admin/services` | `AdminServiceWriteBody` | 200, 201, 204, 400, 401, 403, 404, 409, 429, 500, 502, 503 |
| PATCH | `/admin/services/{serviceId}` | `AdminServiceRenameBody` | 200, 201, 204, 400, 401, 403, 404, 409, 429, 500, 502, 503 |
| DELETE | `/admin/services/{serviceId}` | — | 200, 201, 204, 400, 401, 403, 404, 429, 500, 502, 503 |
| POST | `/admin/users/{userId}/reactivate` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/admin/projects-without-group` | — | 200, 401, 403, 429, 500, 502, 503 |
| GET | `/admin/roles` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| POST | `/admin/roles` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| PUT | `/admin/roles/{roleId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| PATCH | `/admin/roles/{roleId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| DELETE | `/admin/roles/{roleId}` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/admin/groups` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| POST | `/admin/groups` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/admin/groups/{groupId}` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| PATCH | `/admin/groups/{groupId}` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| DELETE | `/admin/groups/{groupId}` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/admin/groups/{groupId}/users` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| POST | `/admin/groups/{groupId}/users` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| DELETE | `/admin/groups/{groupId}/users/{userId}` | — | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/admin/sessions` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| GET | `/admin/sessions/history` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| POST | `/admin/sessions/revoke` | application/json | 200, 201, 204, 400, 401, 403, 404, 409, 500, 502 |
| GET | `/admin/security-alerts` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| GET | `/admin/users/{userId}/connection-logs` | — | 200, 201, 204, 400, 401, 403, 404, 500, 502 |
| POST | `/user/me/sessions/report` | `ReportSessionView` | 200, 400, 401, 429, 500, 502, 503 |
| GET | `/user/me/security-alert` | — | 200, 204, 401, 429, 500, 502, 503 |
| POST | `/user/me/security-alert/{alertId}/acknowledge` | — | 204, 400, 401, 404, 429, 500, 502, 503 |
| GET | `/me` | — | 200, 401, 502 |
| GET | `/session/me` | — | 200, 401, 502 |
| GET | `/search` | — | 200, 400, 401, 500, 503 |

Global search of the shared header: `GET /search?q=&limit=` (`q` 2 to 100 characters once trimmed, `limit` 1 to 20, default 8) is served by `globalSearchHandler` of `@mairie360/bffs-lib`. It queries `GET /api/v1/search` of the five business APIs in parallel with the caller's session (Core API for the agents, then Project, Calendar, Message and E-learning API, from `CORE_API_URL`, `PROJECT_API_URL`, `CALENDAR_API_URL`, `MESSAGE_API_URL`, `ELEARNING_API_URL`), never another BFF, and answers `{ groups: [{ module, items }], unavailable }`: a module whose API fails, times out or is not configured is listed in `unavailable` instead of failing the search, and a session one API refuses is a 401. Nothing is stored or logged but the unavailable modules.

`GET /admin/groups` and `GET /admin/sessions/history` return one page of Core's list, chosen by the front with `limit` (1 to 500) and `offset` (0 to 1000000), Core API's own bounds: a value outside them is a 400, and without them Core answers its first 100 items. The checks the BFF makes itself (the groups of `/me`, the membership read before adding or removing a group member) read Core's largest page, 500 items.



The administration V2 (MAIR-584, MAIR-904): `GET /admin/users` also takes `account_status` (`active`, `invited`, `inactive` = archived, `suspended`), `role_id` and `sort` (`name`, `-name`), relayed to Core, and every row carries `account_status`, `active_sessions` (open sessions), `last_login_at` and `two_factor` (`methods`, `last_verified_at`, never a secret). `GET /admin/users/{userId}/sessions` returns the latest 100 sessions of the user (from Core's user record), `DELETE /admin/users/{userId}/sessions[/{sessionId}]` signs the user out of every device or of one, `POST /admin/users/{userId}/suspend` / `reactivate` suspend the account (its sessions closed, sign-in refused) and end the suspension; Core refuses one's own account with 409.

Stolen sessions (MAIR-773): the fronts' proxies report a use of the session from another device with `POST /user/me/sessions/report` (`level` = `certain` / `possible` / `ip_change`, `ip_address`, `device_info`), relayed to Core with the session: `certain` and `possible` close it (`revoked: true`) and alert the agent and the administrators. `GET /user/me/security-alert` returns the agent's latest unread alert (`204` when none) and `POST /user/me/security-alert/{alertId}/acknowledge` marks it read, for the « Activité inhabituelle » screen of Login. `GET /admin/security-alerts` (30 days, with the agent) and `GET /admin/users/{userId}/connection-logs` (latest 100 lines) feed the Security tab of the administration.

Role modules, services and group colours (MAIR-916, MAIR-923): the role writes take `modules` (`dashboard`, `projects`, `calendar`, `messages`, `training`, `admin`, `settings`), `GET /admin/roles` returns them and `GET /me` / `/session/me` answer the session's `modules` for the shared navigation. `GET` / `POST /admin/services`, `PATCH` / `DELETE /admin/services/{serviceId}` manage the services of the mairie (unique name, 409), `PUT /admin/users/{userId}/service` attaches an agent to one (`service_id`, `null` detaches); the admin rows carry `service`. Groups take a `color` of the charter palette (`blue`, `teal`, `green`, `orange`, `purple`, `pink`, `neutral`, `null` = default) and answer `project_count`.

## Session, permissions and errors


## Synchronization and verification

```bash
npm run contracts:generate
npm run contracts:check
npm test -- --runInBand
npm run lint
npm run build
```

Authentication routes handle their own flow: login bodies are validated before reaching Core. There is no public self-registration: accounts are created by administrators through `/admin/users`. `/auth/login` and `/auth/force_change_password` are rate limited (failed attempts only, 429 + `Retry-After`; in-memory counters per replica). Without `TRUST_PROXY` every client shares the front pods' IP, so only the per-e-mail limit applies: a per-IP limit would let one attacker lock every user out. The same holds per request when `TRUST_PROXY` is set: a request without `X-Forwarded-For` (a front calling server side) skips the per-IP limit. Sign-in delivers the session only in HttpOnly, `SameSite=Strict` cookies: `accessToken` (the access JWT, path `/`) and `refreshToken` (path `/auth`); no token is returned in the body or in a response header. `/auth/force_change_password` requires a 12 to 255 character password, like the admin routes (Core API's CNIL 2022 policy: Core also refuses a commonly used password or one containing the account's e-mail, first name or last name, with a 400 the BFF keeps). `/auth/forgot_password` (`{ email }`) forwards the address to Core's public `POST /api/v1/auth/forgot_password`, which e-mails a reset link (`<PUBLIC_URL>/reset-password?token=…`, valid 15 minutes) when it matches an active account; the answer is the same empty 200 for a known or an unknown address (no account enumeration), and Core's 400 and 429 are kept. `/auth/reset_password` (`{ token, new_password, device_info }`, token a UUID, password 12 to 255 characters) forwards to Core's public `POST /api/v1/auth/reset_password`, which saves the password, revokes the other sessions and opens a new one: the session is set exactly like login (HttpOnly `accessToken` and `refreshToken` cookies); an unknown, expired or already used token answers 401. Both are limited per client IP (failed attempts only) when `TRUST_PROXY` is set and the request carries `X-Forwarded-For`, Core limiting them as well. `/auth/refresh` exchanges the refresh token (body `refresh_token`, else the `refreshToken` cookie) for a new access JWT through Core's public `POST /api/v1/sessions/refresh` (no session forwarded, so an expired JWT can be renewed) and sets it like login (cookie only); Core rotates the refresh token on every refresh, so the new one replaces the `refreshToken` cookie (it never goes to the body); its failed attempts are limited per refresh token (SHA-256), and per client IP when `TRUST_PROXY` is set. `/auth/logout` revokes the Core session: with the refresh token (body or `refreshToken` cookie) through Core's public `POST /api/v1/auth/logout`, which needs no JWT, so an agent whose access JWT has expired is still signed out for good (MAIR-692); and, when it receives the session, from the access JWT through `POST /api/v1/sessions/logout`, both together, so a stale refresh token does not leave the JWT's session open (`session_revoked` is true when either succeeded); either way Core rejects the access JWT immediately; it always clears both cookies, even when Core fails, and reports the outcome in `session_revoked`. Every `/admin/*` request body is validated against a Zod schema mirroring the Core API view it is forwarded to (unknown fields stripped, `<` and `>` refused in stored labels, the path identifier wins over the body's `user_id`/`group_id`, no password in a user update: an administrator never changes the password of an account, the agent changes it from Settings or through the e-mailed link; the phone is forwarded as typed with an optional upper-case ISO 3166-1 alpha-2 `phone_country`, which Core API (MAIR-480) needs for a national number, `+` E.164 numbers need none, and `null` clears it); invalid bodies answer 400 without reaching Core. Every `/admin/*` route goes through `requireAdmin`, which verifies the session with Core's public key `JWT_PUBLIC_KEY` (MAIR-680), then requires the `admin` role among the roles Core returns for the caller, before anything else (defence in depth on top of Core's own administrator check). Other adapters forward the caller's session to Core and never use a default token; the session is read from the `Authorization: Bearer` header only, which the fronts' proxy builds from the `accessToken` cookie (the `accessToken` cookie, the `x-session-token` header, the `session` cookie and other schemes are ignored, `/auth/logout` and the admin check included); session-bound routes answer 401 before any validation or Core call without it, or with a token that Core's public key does not verify (EdDSA signature under Core's `kid`, `iss`, `aud`, expiry, positive `sub`; HS256 always refused), and every `/auth`, `/me`, `/session`, `/user` and `/admin` answer carries `Cache-Control: no-store`. Read routes (`/me`, admin lists) only return the fields of their contract schema: anything else Core adds is dropped, and a Core answer that does not match is a 502; `/me` and `/user/{userId}/about` answer 401 without a session, and `/user/{userId}/about` only returns public fields (`phone` may be `null`). `/admin/sessions/refresh` was removed: it replaced the administrator's own cookie with the refreshed session's JWT, and Core publishes no revocation by session id. A missing `CORE_API_URL` answers 503 on every route that calls Core (declared in the contract), and a missing session key answers 503 on `/admin/*`; the startup check normally prevents both. Neither the tokens nor the outgoing Core URLs are logged. Every error answers the envelope shared by all the BFFs (`@mairie360/bffs-lib`), `{ "error": { "code", "message", "details" } }`, declared as `ErrorResponse` in the contract: `code` follows the status (`BAD_REQUEST`, `UNAUTHORIZED`, `CONFLICT`, `BAD_GATEWAY`...), and a 400 (`Validation failed`) lists the invalid fields in `details` (`{ "path": "body.email", "message" }`). Core reads (GET) are retried once on a transient failure (no answer, 502, 503, 504), writes never. Only the Core 4xx a route declares are kept, with a generic message (`/user/{userId}/about` keeps 401 and 404, admin writes also keep 409); any other Core status and an unreachable Core answer 502, and the Core body is never relayed. The first sign-in 412 of `/auth/login` is not an error: it only carries the one-time `token`. Unexpected errors answer a generic 500, whatever `NODE_ENV`; `/check_apis` never returns network details. Cookie behavior depends on `COOKIE_DOMAIN` and `NODE_ENV`; interface permissions do not replace server checks.

Tests in `tests/user.upstream-mocks.test.ts` run the whole application and the real Core API client against a local HTTP mock driven by the Core API contract, rebuilt from the installed `@mairie360/core-api-openapi` package (orval types, version pinned in `package.json`): every request (path, parameters, JSON body) and every mocked success response is validated against that contract, and every BFF response against `contracts/openapi.json`. Bumping the package is enough to test against its new contract; error statuses are not typed by orval and are simulated explicitly. PostgreSQL and Redis repositories stay mocked with `jest.mock`. Routes served by Core API v1.1.1 but missing from the published contract are listed, with their reason, in `tests/support/core-fixtures.ts`.

`contracts:generate` exports the runtime registry to `contracts/openapi.json` and regenerates `contracts/bff.d.ts`. `contracts:check` fails when the contract or types are stale. Then run `npm run contracts:sync` in each associated web service and deliver contract changes together.

The type generator is pinned to `openapi-typescript@7.10.1` in `scripts/contracts.mjs` and runs through npm. For documentation-only changes, check links, accuracy in both languages and `git diff --check`; do not regenerate contracts without changing their source.

## CI/CD and Docker execution

The `contracts.yml` job uses Node.js 26.13.1, `actions/checkout@v7` and `actions/setup-node@v7`. It runs on pushes, pull requests and manual dispatch; it installs with `npm ci`, checks contracts and runs the associated tests.

`cicd.yml` calls `mairie360/CICD/.github/workflows/BFFs-cicd.yml@v5.14.3`, with `cicd_version: v5.14.3` and `node_version: "26.13.1"`. Reusable steps and GitHub environments determine actual checks, publications and deployments. A push to `main` stops after `release-dev`; staging and prod go through the manual `promote-staging.yml` / `promote-prod.yml` workflows (MAIR-494).

The `Dockerfile` (build and runtime) and `development.Dockerfile` use `node:26.13.1-alpine` pinned by digest, the same Node.js as the CI jobs; the production image command is `["node", "dist/index.js"]` (the `@mairie360/*-openapi` packages are bundled by esbuild, nothing is compiled at runtime) and the development image runs `npm run start` (`tsx watch`).

`integration_test.sh` (MAIR-262) runs the stack of `docker-compose-integration.yml`: the published Core API image, the database with its migrations and `init-test.sql`, Redis, the fake Resend, the BFF image under test and a `newman` service that replays `tests/postman/collection.json` (environment `tests/postman/environment.json`) against the BFF with `--bail`. Its exit code is the exit code of newman. The collection holds working checks (the BFF starts, `/health`, `/check_apis`, `/openapi.json`, the session resolved against Core API for the seeded Admin and agent) and the business journeys of the account lifecycle (creation by an administrator, first sign-in with a password change, sign-in with cookies only, refresh with rotation, roles, groups, sessions, password reset by e-mail through the fake Resend journal (an administrator cannot change a password: the former admin route answers 404), logout, deletion). The seeded accounts are impersonated with EdDSA JWTs that `integration_test.sh` signs like Core with the run's Ed25519 key (`stack_secrets.sh`, MAIR-680) and passes with `--env-var`; the collection checks that an HS256 token and a token signed with another key are refused. The committed environment holds no key or token. In CI this stack is the `integration_tests` gate of the staging promotion: it blocks the promotion on failure and publishes the junit report (`newman-reports/newman.xml`) as job summary and artifact. The jest test `tests/integration-collection.test.ts` checks that every operation of `contracts/openapi.json` has a request in the collection and that every request asserts something.

Split of the tests: jest covers the routes with a mocked Core API (unit tests, upstream-mock tests against the installed contract, token refusals); the newman collection covers the journeys on a real Core API; ZAP and k6 cover security and performance. A bug fix adds its non-regression test at the lowest layer that observes it (jest first, the collection when only a real Core shows it).

`security_test.sh` and `performance_test.sh` test the image named by `IMAGE_REF`: in CI, `release-dev` publishes the `dev-<sha>` image, and `promote-staging.yml` runs both tests against it before that same artifact is promoted to staging and prod (MAIR-494). When `IMAGE_REF` is empty (local use), they first build `bff-user:local` from `development.Dockerfile`, which needs `NODE_AUTH_TOKEN` and `./.npmrc`.

`security_test.sh` runs the OWASP ZAP stack of `docker-compose-security.yml`: ZAP replays every operation of `/openapi.json` with the run's admin JWT (`ADMIN_JWT`, `sub=1`, EdDSA signed by `stack_secrets.sh` with the run's key, MAIR-680) and fills bodies and path parameters from the contract examples. `init-test.sql` seeds the resources those examples name (users 1, 2, 10, 11, 42, roles and groups 10 and 11, two sessions); keep examples and seed in sync when adding a route.

Both stacks carry the OpenAPI coverage gate of `mairie360/CICD` (`tests/zap/zap_hooks.py`, `tests/k6/coverage.js`), checked out as `cicd-repo/` by the CI jobs and cloned there by the scripts at the pinned `cicd_version` (`CICD_VERSION` overrides it). After the scan, the ZAP hook fails when an operation of the contract was never reached, or when an operation that requires `bearerAuth` only got 401/403; public operations declare `security: []` in their `registerPath`. `load-test.js` holds one handler per operation of `contracts/openapi.json`: k6 aborts at init when one is missing and fails its `operations_uncovered` threshold when a handler does not send its request. **Adding a route means adding its handler in `load-test.js`** (and `security: []` when it is public).

`load-test.js` runs two scenarios. `crud` (2 VUs) calls every handler once per iteration, writes included, as one self-contained admin scenario that deletes what it creates. `reads` (ramp to 20 VUs) replays only the GET handlers against the fixtures seeded by `init-test.sql`. Every operation has a `p(95)` threshold set by its family: 50 ms for `/health`, 150 ms for `/check_apis`, 500 ms for reads, 800 ms for `/auth/*` and admin writes; `http_req_failed` must stay below 1 %.

Before running Docker, check service variables, build secrets and networks in the repository files. Green CI validates its jobs; it does not prove business-service availability in a remote environment.

## Logs

Every log is one JSON object per line on stdout (MAIR-531, `@mairie360/bffs-lib` `createLogger`, `src/logger.ts`), the shape of the APIs' `LOG_FORMAT=json`: `timestamp`, `level`, `target` (`bff-user`), `message`, then the fields.

- One `request completed` line per request (`requestLogger`, first middleware of `src/app.ts`): `request_id`, `method`, `path` (the matched route, e.g. `/users/:userId`; never the query string), `status`, `duration_ms`. 5xx are written at `ERROR`; `/health` is not logged.
- `request_id` comes from the `X-Request-Id` header when the caller sends a well-formed one, otherwise it is generated; it is answered in `X-Request-Id` and repeated on every line of the request (`request failed`, `upstream unreachable`...), so one search finds them all.
- `request failed` (5xx) and `upstream unreachable` (`/check_apis`) carry `error` = `describeError(error)`: type, status, upstream method and path, masked message. Never a header, a token, a body or a personal value (MAIR-290).
- `LOG_LEVEL` (`debug`, `info`, `warn`, `error`; default `info`) filters the lines.
- `LOG_FORMAT` (`json` or `text`): unset, the lines are coloured text when stdout is a terminal (`npm run start`), JSON otherwise (containers, tests). `NO_COLOR` / `FORCE_COLOR` control the colours (MAIR-555).

## Troubleshooting

If sign-in works but administration fails, check `JWT_PUBLIC_KEY` (Core's current public key), and the stored role. If the first-sign-in password change fails, check the temporary token and the logs of Core API, which keeps that token in Redis.

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
