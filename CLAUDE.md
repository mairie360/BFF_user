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

### Two data paths: Core API proxy + direct DB/Redis

1. **HTTP to Core API.** `src/clients/coreClient.ts` builds the Core base URL from
   `CORE_API_URL`/`CORE_API_PORT` and wraps the generated client from
   `@mairie360/core-api-openapi`. It re-exports grouped sub-clients (`coreAuthClient`,
   `coreAdminUsersClient`, `coreGroupsClient`, `coreSessionsClient`, ...) that the routes
   consume. A request interceptor injects `DEFAULT_JWT_TOKEN` as a fallback bearer for
   every call **except** login, and patches a trailing-slash mismatch on
   `force_change_password`.
2. **Direct PostgreSQL + Redis.** `src/repositories/` talk to the shared Mairie360
   database and Redis directly — used for the admin user list/search + pagination,
   admin password reset (also revokes sessions), group membership
   (`group_members` table — note: some other contracts call it `group_users`), and the
   first-sign-in password flow (Redis one-time token keyed `<token>/first_connection_id`,
   then a `users` table update).

`registerGeneratedOpenApi.ts` (imported first by `coreClient.ts`) registers `ts-node` at
runtime so the generated packages' `.ts` sources load without a build step.

### Routing (`src/index.ts`)

Routers: `/health`, `/check_apis`, `/auth`, `/user`, `/session`, `/bff/admin`. The
`session` router is **mounted twice** — at `/session` and at `/` — so both `/session/me`
and the legacy `/me` resolve.

### Auth model

- **`/auth/login`**: Core returns the access JWT in the `Authorization` response header
  and a `refresh_token` in the body. The BFF stores the access token in an httpOnly
  `accessToken` cookie (`src/utils/cookieUtils.ts`) and re-exposes it via the
  `Authorization` header + `Access-Control-Expose-Headers`.
- **`/bff/admin/*`**: `requireAdmin` in `src/routes/admin.ts` verifies the caller's JWT
  *locally* — HS256 signature against `JWT_SECRET`, `exp`, `sub` — then checks the `admin`
  role in the DB (`isAdministrationUserAdmin`). Note: only some admin routes (the ones
  served from local SQL) gate on `requireAdmin`; the pure Core-proxy admin routes instead
  forward the incoming credential and let Core authorize.
- **Everything else**: `bearerToken()` (`admin_helpers.ts`) pulls the credential from the
  `Authorization` header, `x-session-token` header, or `accessToken`/`session` cookie and
  forwards it to Core unchanged.

### Error handling

Route handlers catch and call `handleUnknownError` (there are two near-identical copies —
`core_helpers.ts` and `admin_helpers.ts`), which maps Axios errors to the Core status +
body. A global `errorHandler` middleware (`src/middleware/errorHandler.ts`) is the final
catch-all and only exposes error detail when `NODE_ENV === 'development'`.

## Environment variables

`CORE_API_URL` (+ optional `CORE_API_PORT`), `JWT_SECRET` (must match Core, required for
admin checks), `DEFAULT_JWT_TOKEN` (dev fallback bearer), `REDIS_URL`,
`DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`, `COOKIE_DOMAIN` (omit for host-only
cookie), `PORT` (default 4000), `NODE_ENV`.

## Docker

`docker compose up` uses `development.Dockerfile` (ts-node-dev, `develop.watch` sync on
`src/`) and brings up postgres, redis, liquibase migrations, the Core API image, and
nginx. The production `Dockerfile` is a `node:20-alpine` multi-stage build running
`node dist/index.js` with the heap capped at 180 MB for a 256 MB K8s limit.

## Conventions

- ESLint: `@typescript-eslint/no-explicit-any` is an **error**. Unused args must be
  `_`-prefixed.
- Tests use `supertest` against a bare Express app with the router under test mounted;
  `coreClient` grouped clients and repository modules are `jest.mock`ed — no real DB/HTTP.
- Prefer adding schemas to `openapi-registry.ts` / `admin_schemas.ts` and letting types
  flow from Zod (`z.infer`) rather than hand-writing interfaces.
