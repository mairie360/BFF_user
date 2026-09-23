# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`bff-user` is a Backend-for-Frontend for the Mairie360 platform. It centralizes sign-in,
session context, and account/role/group administration for the Mairie360 frontends by
adapting the upstream **Core API**. It is an Express 5 + TypeScript HTTP service with no
UI of its own.

Codebase comments, log lines, and user-facing messages are a mix of French and English;
docs under `docs/` are bilingual (en/fr). Match the surrounding language when editing.

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
`npm test -- --runInBand` on Node 22. `cicd.yml` delegates to the reusable
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

`src/clients/coreClient.ts` builds the Core base URL from `CORE_API_URL`/`CORE_API_PORT` and wraps the
generated client from `@mairie360/core-api-openapi`. It re-exports grouped sub-clients (`coreAuthClient`,
`coreAdminUsersClient`, `coreGroupsClient`, `coreSessionsClient`, `coreUsersClient`, ...) that the routes
consume. There is **no fallback bearer**: routes forward only the caller's session (Core's `/api/v1/auth/*`
is exempt from its JWT middleware, so login/register/force_change_password go anonymous).

The BFF has **no database or Redis access**: the admin user list/search + pagination comes from
`GET /api/v1/admin/users/`, the admin password reset (which also revokes the sessions) from
`PATCH /api/v1/admin/users/{userId}/password`, group updates from `PATCH /api/v1/groups/{groupId}/`,
group membership from `/api/v1/groups/{groupId}/users/` (+ the admin listing filtered by `group_id` for
the member details), and the first-sign-in password flow from `POST /api/v1/auth/force_change_password`,
which validates the one-time token, saves the password and consumes the token. The admin role of the
caller is read from `GET /api/v1/user/me/` before every `/bff/admin` route.

`registerGeneratedOpenApi.ts` (imported first by `coreClient.ts`) registers `ts-node` at
runtime so the generated packages' `.ts` sources load without a build step; `npm run build` type-checks
with `tsc --noEmit` then bundles `dist/index.js` with esbuild (`scripts/build.mjs`), inlining those
packages so the production image runs `node dist/index.js`.

### Routing (`src/index.ts`)

Routers: `/health`, `/check_apis`, `/auth`, `/user`, `/session`, `/bff/admin`. The
`session` router is **mounted twice** — at `/session` and at `/` — so both `/session/me`
and the legacy `/me` resolve.

### Auth model

- **`/auth/login`**: Core returns the access JWT in the `Authorization` response header
  and a `refresh_token` in the body. The BFF stores the access token in an httpOnly
  `accessToken` cookie (`src/utils/cookieUtils.ts`) and re-exposes it via the
  `Authorization` header + `Access-Control-Expose-Headers`. `/bff/admin/sessions/refresh`
  does the same with the refreshed JWT (502 if Core omits it). Login and register bodies are
  validated with Zod (unknown fields stripped) before reaching Core; register uses Core's public
  `POST /api/v1/auth/register`.
- **`/auth/keycloak`**: Keycloak SSO. Forwards the OIDC authorization code to Core's public
  `POST /api/v1/auth/keycloak` and sets the session exactly like `/auth/login`; Core's 503
  (Keycloak not configured) is kept so the front can fall back to password login. That Core route
  is absent from `@mairie360/core-api-openapi` 1.2.0, so `coreClient.ts` calls it by hand
  (`keycloakLogin`) and the upstream-mock test cannot cover it: switch to the generated function
  and add it to `upstream-contracts.test.ts` once the package that ships it is installed.
- **`/auth/logout`**: clears the `accessToken` cookie, never calls Core. Single logout (MAIR-143):
  when `KEYCLOAK_REALM_URL` + `KEYCLOAK_CLIENT_ID` are set (`src/config/keycloak.ts`, read on every
  call), the response adds `logout_url`, the realm's OIDC end-session URL
  (`/protocol/openid-connect/logout?client_id=…&post_logout_redirect_uri=…`) that the front must
  navigate to so Keycloak closes the SSO session and, via front/back-channel logout, the other
  tools (n8n). Core keeps no Keycloak token, hence `client_id` instead of `id_token_hint` (Keycloak
  shows a confirmation page). The redirect comes from the optional body
  `post_logout_redirect_uri`, else `KEYCLOAK_POST_LOGOUT_REDIRECT_URI`; Keycloak only accepts it
  if the client lists it. Without Keycloak the response is unchanged (no `logout_url`).
- **`/bff/admin/*`**: `requireAdmin` in `src/routes/admin.ts` verifies the caller's JWT
  *locally* — HS256 signature against `JWT_SECRET`, `exp`, `sub` — then checks the `admin`
  role in the DB (`isAdministrationUserAdmin`). It is a `router.use` guard on **every**
  admin route, before parameter validation: Core API v1.1.1 has its `AdminMiddleware`
  commented out, so Core-proxied admin routes must not rely on Core to check the role.
- **Everything else**: `bearerToken()` (`admin_helpers.ts`) pulls the credential from the
  `Authorization` header, `x-session-token` header, or `accessToken`/`session` cookie and
  forwards it to Core unchanged; `/me` and `/user/{userId}/about` answer 401 without one.
  `/user/{userId}/about` only returns the public fields of its contract (no role/groups).

### Error handling

Route handlers catch and call `handleUnknownError` (there are two near-identical copies —
`core_helpers.ts` and `admin_helpers.ts`), which maps Axios errors to the Core status +
body. A global `errorHandler` middleware (`src/middleware/errorHandler.ts`) is the final
catch-all and only exposes error detail when `NODE_ENV === 'development'`.

## Environment variables

`CORE_API_URL` (+ optional `CORE_API_PORT`), `JWT_SECRET` (must match Core, required for
admin checks), `COOKIE_DOMAIN` (omit for host-only
cookie), `PORT` (default 4000), `NODE_ENV`. Keycloak single logout (all optional, unset = no
`logout_url`): `KEYCLOAK_REALM_URL` (public realm URL as the browser reaches it, e.g.
`https://auth.<domain>/realms/mairie360`, not Core's in-cluster one), `KEYCLOAK_CLIENT_ID` (the
fronts' OIDC client, same as Core's), `KEYCLOAK_POST_LOGOUT_REDIRECT_URI`.

## Docker

`docker compose up` uses `development.Dockerfile` (ts-node-dev, `develop.watch` sync on
`src/`) and brings up postgres, redis, liquibase migrations, the Core API image, and
nginx. The production `Dockerfile` is a `node:20-alpine` multi-stage build running
`node dist/index.js` with the heap capped at 180 MB for a 256 MB K8s limit.

## Tests with a contract-driven Core API mock

`tests/user.upstream-mocks.test.ts` imports the **whole app** (`src/index.ts`) with the **real** axios
client and serves Core API from a local HTTP server (`tests/support/contract-mock-server.ts`). Its
contract is rebuilt at test time from the **installed** `@mairie360/core-api-openapi` dependency
(`tests/support/orval-contract.ts` parses the orval `endpoints/*.ts` + `model/*.ts` with the TypeScript
compiler API; the package ships no `openapi.json`), so bumping it is enough to test against a new Core
contract. The mock rejects paths, methods, params and bodies absent from the contract and validates mocked
success responses; orval does not type errors, so mocked error replies need `outOfContract: true`. Every
BFF response is checked against `contracts/openapi.json`.

- `coreClient` reads `CORE_API_URL` at module load: the app is imported in `beforeAll` after
  `CORE_API_URL` and `JWT_SECRET` are set (`check_apis` rebuilds the URL on every call).
- `jest.config.ts` lets ts-jest compile `node_modules/@mairie360/*` and skips diagnostics on
  `src/clients/coreClient.ts` (spurious axios `.d.ts`/`.d.cts` clash; `npm run build` still type-checks it).
- `openapi-contract.ts`, `contract-mock-server.ts` and `orval-contract.ts` are shared verbatim with
  `BFF_Calendar` and `BFF_Dashboard`; keep the copies identical.

## Conventions

- ESLint: `@typescript-eslint/no-explicit-any` is an **error**. Unused args must be
  `_`-prefixed.
- Tests use `supertest`. Unit tests (`auth`, `session`, `admin`, ...) mount one router on a bare
  Express app and `jest.mock` `coreClient` (upstream-mock tests: see the section above).
- Prefer adding schemas to `openapi-registry.ts` / `admin_schemas.ts` and letting types
  flow from Zod (`z.infer`) rather than hand-writing interfaces.
