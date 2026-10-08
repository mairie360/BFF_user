# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`bff-user` is a Backend-for-Frontend for the Mairie360 platform. It centralizes sign-in,
session context, and account/role/group administration for the Mairie360 frontends by
adapting the upstream **Core API**. It is an Express 5 + TypeScript HTTP service with no
UI of its own.

Codebase comments, log lines, and user-facing messages are a mix of French and English; write new
text in English (see `../../CLAUDE.md`). Docs under `docs/` are bilingual (en/fr): update both.

## Commands

```bash
npm run start            # dev server, tsx watch on src/index.ts (port 4000)
npm run build             # tsc -> dist/
npm run lint              # eslint . --ext .ts   (npm run lint:fix to autofix)
npm test                  # jest (tests/**/*.test.ts)
npm test -- tests/auth.test.ts          # single file
npm test -- -t "POST /auth/login"       # single test by name
npm test -- --runInBand                 # how CI runs it

npm run contracts:generate  # regenerate contracts/openapi.json + contracts/bff.d.ts from code
npm run contracts:check     # fail if either is stale (CI gate)
```

CI (`.github/workflows/contracts.yml`) runs `npm run contracts:check` then
`npm test -- --runInBand` on Node 24 (`cicd.yml` uses `node_version: "24"` too). `cicd.yml` delegates to the reusable
`mairie360/CICD` workflow.

### Private dependencies

`@mairie360/*` packages come from GitHub Packages. `npm ci` needs `NODE_AUTH_TOKEN` set
to a token with read access (see `.npmrc`). Without it, install and the OpenAPI
generation step fail.

## Architecture

### OpenAPI is generated from the running code — keep it in sync

`src/openapi-registry.ts` exports a single `zod-to-openapi` `registry`. Every route module
(`src/routes/*.ts`) calls `registry.registerPath(...)` and registers its Zod schemas as a
side effect of being imported. `src/openapi.ts` imports all route modules and builds
`openApiDocument` from the registry.

That one document backs **all** of: the `/docs` Swagger UI, `/openapi.json` + `/swagger.json`,
the committed `contracts/openapi.json`, and the generated `contracts/bff.d.ts` types
(via `openapi-typescript`, pinned to `7.10.1` in `scripts/contracts.mjs`).

**After any change to routes, request/response schemas, or status codes, run
`npm run contracts:generate` and commit the results**, or `contracts:check` fails CI.
`CONTRACT.md` also mentions `npm run contracts:sync` for downstream web services — that
script currently has no wired source directory (`source = null` in `scripts/contracts.mjs`).

### One data path: Core API

`src/clients/coreClient.ts` wraps the generated client from `@mairie360/core-api-openapi` on an axios
instance without base URL: every call passes `baseURL: baseUrl('CORE_API')` (`@mairie360/bffs-lib`,
`CORE_API_URL` + optional `CORE_API_PORT`, read per call, no `localhost` default, 503 when missing). It re-exports grouped sub-clients (`coreAuthClient`,
`coreAdminUsersClient`, `coreGroupsClient`, `coreSessionsClient`, `coreUsersClient`, ...) that the routes
consume. There is **no fallback bearer**: routes forward only the caller's session (Core's `/api/v1/auth/*`
is exempt from its JWT middleware, so login/force_change_password go anonymous; `/api/v1/sessions/refresh` is also served outside it). There is no public
self-registration: accounts are created by administrators through `/bff/admin/users`.

The BFF has **no database or Redis access**: the admin user list/search + pagination comes from
`GET /api/v1/admin/users/`, the admin password reset (which also revokes the sessions) from
`PATCH /api/v1/admin/users/{userId}/password`, group updates from `PATCH /api/v1/groups/{groupId}/`,
group membership from `/api/v1/groups/{groupId}/users/` (+ the admin listing filtered by `group_id` for
the member details), and the first-sign-in password flow from `POST /api/v1/auth/force_change_password`,
which validates the one-time token, saves the password and consumes the token. The admin role of the
caller is read from `GET /api/v1/user/me/` before every `/bff/admin` route.
Core ≥ 2.0.0 paginates the groups, group members and session history (`limit` 1-500, 100 by default;
`offset`). `GET /bff/admin/groups` and `/bff/admin/sessions/history` forward the `limit` / `offset` the front
sends (`CorePageQuery`, Core's bounds, 400 outside them); the BFF's own reads (`/me` groups, membership checks)
use `CORE_LARGEST_PAGE` (500) of `coreClient.ts`.

The generated packages ship `.ts` sources: `tsx` (dev), ts-jest (tests) and esbuild (`npm run build`:
`tsc --noEmit`, then `scripts/build.mjs` bundles `dist/index.js` inlining those packages) load them, so the
production image runs `node dist/index.js` and nothing registers `ts-node` at runtime (MAIR-431).

`src/index.ts` starts with `import 'dotenv/config'` and, only when run as the entry point
(`require.main === module`), calls `assertStartupConfiguration()`: `assertConfigured(['CORE_API'])` + a
`JWT_SECRET` check, so a misconfigured instance refuses to start. Tests import the app without it.

### App and entry point (MAIR-430)

Same split as the BFF template: `src/app.ts` builds and exports the Express app (`trust proxy` from
`TRUST_PROXY`, lib `securityHeaders` + `apiOnlyHeaders()`, JSON + cookie parsing, `/docs`, the routers,
`notFoundHandler` + `errorHandler()`); `src/index.ts` (the build entry) loads `.env`, runs the startup check
and listens on `PORT` (default 4000) only under `require.main === module`. Tests import `src/app.ts`.

### Routing (`src/app.ts`)

Routers: `/health`, `/check_apis`, `/auth`, `/user`, `/session`, `/bff/admin`. `/check_apis` is the lib
`checkApis({ core_api })` probing Core's generated `health` operation (`withoutSession('CORE_API', 5_000)`),
answer `CheckApisResponse` (`{ status: 'OK' | 'Error', core_api: 'Connected' | 'Unreachable' }`, 200 / 502). The
`session` router is **mounted twice** — at `/session` and at `/` — so both `/session/me`
and the legacy `/me` resolve.

### Auth model

- **`/auth/login`**: Core returns the access JWT in the `Authorization` response header
  and a `refresh_token` in the body. The BFF only delivers them in HttpOnly, `SameSite=Strict`
  cookies (`src/utils/cookieUtils.ts`): `accessToken` (path `/`) and `refreshToken` (path `/auth`).
  No token goes to the response body or a response header (MAIR-397); the body is
  `{ message }`. Login bodies are validated with Zod (unknown fields stripped) before reaching Core.
  `/auth/force_change_password` requires an 8-255 character password, like the admin routes.
- **`/auth/refresh`** (public) exchanges the login `refresh_token` for a new JWT through Core's
  `POST /api/v1/sessions/refresh`, which Core ≥ 1.2.0 serves outside its JWT middleware: no session
  is forwarded, so an expired JWT can be renewed. The refresh token comes from the body, else the
  `refreshToken` cookie; the JWT is delivered like login (cookie only). Core ≥ 2.0.0 rotates the refresh token
  (the one sent stops working): its replacement, from the JSON body, overwrites the `refreshToken` cookie. `/bff/admin/sessions/refresh`
  was removed (it replaced the admin's own cookie with the refreshed JWT; Core has no revoke-by-session-id).
- **`/auth/logout`** revokes the Core session (`POST /api/v1/sessions/revoke`, which needs the
  caller's JWT **and** the login `refresh_token` in the body) and always clears the cookie.
  Without a `refresh_token` (body or cookie) it revokes the session from the JWT alone through Core ≥ 2.0.0's
  `POST /api/v1/sessions/logout`. Any Core failure is only logged (status only): the cookies are still
  cleared and `session_revoked` is `false`. Without a Bearer session nothing is called.
- **Rate limiting** (`src/middleware/rateLimit.ts`, three lib `createRateLimiter` instances with
  `envPrefix: 'AUTH_RATE_LIMIT'`, 412 counted as a success): failed attempts on
  `/auth/login` (per IP and per e-mail), `/auth/force_change_password` (per IP) and
  `/auth/refresh` (per IP and per SHA-256 of the refresh token) answer 429. The e-mail and refresh-token
  limiters use `perIp: false`: keyed on the account / token alone, they hold across client IPs.
  The IP-only limit (`AUTH_RATE_LIMIT_IP_MAX`) only applies when `TRUST_PROXY` is set **and** the request
  carries `X-Forwarded-For`; otherwise every client shares the front pod's IP (one startup warning when
  `TRUST_PROXY` is unset). The ZAP/k6 stacks set
  `AUTH_RATE_LIMIT_ENABLED=false` on bff-user.
  `createAuthRouter(limiters)` builds a router with its own counters for tests.
- **`/auth/keycloak`**: Keycloak SSO. Forwards the OIDC authorization code to Core's public
  `POST /api/v1/auth/keycloak` and sets the session exactly like `/auth/login`; Core's 503
  (Keycloak not configured) is kept so the front can fall back to password login. `coreClient.ts` still calls it by hand
  (`keycloakLogin`), although `@mairie360/core-api-openapi` 2.0.0 ships it: switching to the generated
  function (and adding it to `upstream-contracts.test.ts`) is left for later.
- **Passkeys** (MAIR-505): `/auth/passkey/options` + `/auth/passkey` (public, `limiters.perIp`) run the
  WebAuthn sign-in through Core's public `POST /api/v1/auth/passkey/options` / `POST /api/v1/auth/passkey`
  and set the session exactly like `/auth/login`; `/user/me/passkeys/options`, `/user/me/passkeys` (POST
  201, GET) and `/user/me/passkeys/{passkeyId}` (DELETE 204) proxy the registration, list and deletion with
  the caller's session (`requireBearer`, Core 404 relayed). The WebAuthn documents (ceremony options,
  `PublicKeyCredential.toJSON()`) are `z.object({}).passthrough()` in the contract and relayed as is:
  Core builds and checks them, the BFF types the envelope only (`PasskeyCeremonyOptionsResponse`,
  `PasskeyLoginView`, `RegisterPasskeyView`, `Passkey`, `PasskeyListResponse`), and reads go through
  `whitelist`. Core's 503 (no WebAuthn relying party: `WEBAUTHN_RP_ID` unset on the instance) is kept
  on every passkey route (`PasskeysNotConfigured`) so the front falls back to the password login. The
  Core calls are hand-written in `coreClient.ts` like `keycloakLogin` (`@mairie360/core-api-openapi`
  2.0.0 predates them): switch to the generated functions and add them to `upstream-contracts.test.ts`
  once a Core contract with them is published. The ZAP/k6 stacks run a Core without relying party, so
  the k6 handlers expect the 503 (and the empty list / 404 of the routes that need none).
- **`/auth/logout`** single logout (MAIR-143):
  when `KEYCLOAK_REALM_URL` + `KEYCLOAK_CLIENT_ID` are set (`src/config/keycloak.ts`, read on every
  call), the response adds `logout_url`, the realm's OIDC end-session URL
  (`/protocol/openid-connect/logout?client_id=…&post_logout_redirect_uri=…`) that the front must
  navigate to so Keycloak closes the SSO session and, via front/back-channel logout, the other
  tools (n8n). Core keeps no Keycloak token, hence `client_id` instead of `id_token_hint` (Keycloak
  shows a confirmation page). The redirect comes from the optional body
  `post_logout_redirect_uri`, else `KEYCLOAK_POST_LOGOUT_REDIRECT_URI`; Keycloak only accepts it
  if the client lists it. Without Keycloak the response is unchanged (no `logout_url`).
- **`/bff/admin/*`**: `requireAdmin` in `src/routes/admin.ts` verifies the caller's JWT
  *locally* — HS256 signature against `JWT_SECRET`, `exp`, `sub` — then reads the roles from Core
  `GET /api/v1/user/me/` and requires `admin` among `roles` (Core ≥ 2.0.0; `role` is only the first one). A missing `JWT_SECRET` answers 503 (declared on every admin route). It is a `router.use` guard on **every**
  admin route, before parameter validation: Core API v1.1.1 has its `AdminMiddleware`
  commented out, so Core-proxied admin routes must not rely on Core to check the role.
- **Everything else** (MAIR-429): the only accepted credential is the `Authorization: Bearer <jwt>`
  header, read with `authorization()` / `requireBearer` / `bearerToken()` of `@mairie360/bffs-lib`
  (the fronts' proxy builds it from the `accessToken` cookie). The `accessToken` cookie, `x-session-token`
  and other schemes are ignored, also by `/auth/logout` and `requireAdmin`; the `refreshToken` cookie of
  `/auth/refresh` and `/auth/logout` is a different credential and is kept. `/me`, `/session/me` and
  `/user/*` answer 401 before any validation or Core call without one, and every `/auth`, `/me`,
  `/session`, `/user` and `/bff/admin` answer carries `Cache-Control: no-store` (lib `noStore`).
  `/user/{userId}/about` only returns the public fields of its contract (no role/groups).
  Read routes (`/me`, admin GET lists) pass Core's answer through `whitelist(schema, data)`: only
  contract fields are returned, a non-matching answer is a 502. Never log tokens or Core URLs.

### Error handling

Every error is `{ error: { code, message, details } }` (`@mairie360/bffs-lib`), registered once as
`ErrorResponse` in `openapi-registry.ts` (`ErrorResponseSchema.clone()`: the lib builds it before
`extendZodWithOpenApi`) and referenced by every 4xx/5xx of the contract. Routes **throw**
(`HttpError`, Express 5 forwards async rejections); `notFoundHandler` + `errorHandler()` close
`src/app.ts`, keep the status and hide unexpected errors behind a generic 500. Everything comes from the lib
(MAIR-430), no local copy: `parseRequest(schema, value, location)` (400 `Validation failed` with one
`{ path: 'body.email', message }` detail per issue), `asCaller('CORE_API', req)` / `withoutSession('CORE_API')`
for the call options, and `callUpstream('CORE_API', call, { declared, retry })` / `upstreamError('CORE_API',
error, declared)`: only the Core 4xx the route declares are kept (generic message), any other status, a network
failure (`The CORE_API service is unavailable.`) or any other failure of the call -> 502, the Core body is never
relayed. `retry: true` (one retry on no answer / 502 / 503 / 504) is only set on Core GETs. Declared per route: login `[400, 401]` (+ the 412 first sign-in, relayed as
`{ token }` only, not an error), keycloak `[400, 401, 403]` (+ 503 kept), passkey sign-in `[400, 401, 429]` and
its options `[429]` (+ 503 kept), passkey management `[401]` / `[400, 401, 409]` / `[401, 404]` (+ 503 kept), force_change_password
`[400, 401, 403]`, refresh `[400, 401]`, `/me` `[401]`, `/user/{id}/about` `[401, 404]`, admin reads
`READ_STATUSES`, admin writes `WRITE_STATUSES` (+ 409). Unit tests mounting one router on a bare app
must add `errorHandler()` after it. The rate limiters answer 429 in the same envelope.

## Environment variables

`CORE_API_URL` (+ optional `CORE_API_PORT`; required, no default), `JWT_SECRET` (must match Core,
required at startup for the admin checks), `COOKIE_DOMAIN` (omit for host-only
cookie), `PORT` (default 4000), `NODE_ENV`, `TRUST_PROXY` (Express `trust proxy`, unset = none) and
`AUTH_RATE_LIMIT_{ENABLED,WINDOW_MS,MAX,IP_MAX}` (see `src/middleware/rateLimit.ts`). Keycloak single logout (all optional, unset = no
`logout_url`): `KEYCLOAK_REALM_URL` (public realm URL as the browser reaches it, e.g.
`https://auth.<domain>/realms/mairie360`, not Core's in-cluster one), `KEYCLOAK_CLIENT_ID` (the
fronts' OIDC client, same as Core's), `KEYCLOAK_POST_LOGOUT_REDIRECT_URI`.

## Docker

`docker compose up` uses `development.Dockerfile` (`npm run start`, i.e. `tsx watch`; `develop.watch`
sync on `src/`) and brings up postgres, redis, liquibase migrations, the Core API image, and
nginx. The production `Dockerfile` is a `node:24-alpine` (pinned by digest, like `development.Dockerfile`)
multi-stage build running `node dist/index.js` with the heap capped at 180 MB for a 256 MB K8s limit.

## Tests with a contract-driven Core API mock

`tests/user.upstream-mocks.test.ts` imports the **whole app** (`src/app.ts`) with the **real** axios
client and serves Core API from a local HTTP server (`tests/support/contract-mock-server.ts`). Its
contract is rebuilt at test time from the **installed** `@mairie360/core-api-openapi` dependency
(`tests/support/orval-contract.ts` parses the orval `endpoints/*.ts` + `model/*.ts` with the TypeScript
compiler API; the package ships no `openapi.json`), so bumping it is enough to test against a new Core
contract. The mock rejects paths, methods, params and bodies absent from the contract and validates mocked
success responses; orval does not type errors, so mocked error replies need `outOfContract: true`. Every
BFF response is checked against `contracts/openapi.json`.

- `CORE_API_URL` is read on every call, so tests can change or delete it between requests (503 tests);
  unit tests that mock `coreClient` set it too, since the options of every call carry `baseURL`.
- `jest.config.ts` lets ts-jest compile `node_modules/@mairie360/*` and skips diagnostics on
  `src/clients/coreClient.ts` (spurious axios `.d.ts`/`.d.cts` clash; `npm run build` still type-checks it).
- `openapi-contract.ts`, `contract-mock-server.ts` and `orval-contract.ts` are shared verbatim with
  `BFF_Calendar` and `BFF_Dashboard`; keep the copies identical.

## ZAP / k6 OpenAPI coverage gate

`security_test.sh` / `performance_test.sh` clone `mairie360/CICD` into `cicd-repo/` (gitignored) at
the pinned `cicd_version` (`CICD_VERSION=<branch>` overrides it). ZAP runs its `zap_hooks.py` with
`--hook`: every operation of the served spec must be reached, and non-public ones with a
non-401/403 answer. The spec declares `bearerAuth` (the only accepted credential) at the top level (`openapi.ts`);
public routes (`/health`, `/check_apis`, `/auth/*`) set `security: []` in `registerPath`.
`load-test.js` builds on `coverage.js` with **one handler per operation** of
`contracts/openapi.json`: a new route without a handler makes k6 abort at init. Two scenarios: `crud`
(2 VUs) runs every handler through `coverage.run()` and carries the gate; `reads` (ramp to 20 VUs)
replays the GET handlers only, so GET handlers must read seeded fixtures, never `state`. Every
operation gets a `p(95)` threshold from its family (`budgetOf`). In `crud`, handlers run path by
path in contract order and, per path, get → put → post → delete → patch, so DELETE handlers work on
a disposable resource and `cleanup()` removes the kept ones. Core API quirks the handlers rely on:
admin-created and self-registered users answer 412 + one-time token on first login, refresh tokens
are rotated by `/auth/refresh` (each refresh needs its own login).

## Conventions

- ESLint: `@typescript-eslint/no-explicit-any` is an **error**. Unused args must be
  `_`-prefixed.
- Tests use `supertest`. Unit tests (`auth`, `session`, `admin`, ...) mount one router on a bare
  Express app and `jest.mock` `coreClient` (upstream-mock tests: see the section above).
- Prefer adding schemas to `openapi-registry.ts` / `admin_schemas.ts` and letting types
  flow from Zod (`z.infer`) rather than hand-writing interfaces.

## Pull request reviewers

Every PR requests a review from the whole team, minus its author: `CarolinHugo`, `LAURETbenjamin`, `MathTek` and `Quentintnrl` (`gh pr create … --reviewer CarolinHugo,LAURETbenjamin,MathTek`). `.github/CODEOWNERS` makes GitHub request them automatically as well.
