# BFF_user

Centralize sign-in, session access and account administration for the Mairie360 interfaces. This BFF adapts Core and supplies the user context shared by other modules.

Centraliser la connexion, la session et les opérations d’administration des comptes pour les interfaces Mairie360. Ce BFF adapte Core et fournit le contexte utilisateur partagé par les autres modules.

## Documentation

| Language / Langue | Module | Technical / Technique |
| --- | --- | --- |
| English | [Module overview](docs/en/module.md) | [Technical documentation](docs/en/technical.md) |
| Français | [Présentation du module](docs/fr/module.md) | [Documentation technique](docs/fr/technical.md) |

The sections below are a quick reference in English; the French version of the setup, the routes and the checks is in [docs/fr/technical.md](docs/fr/technical.md).

Les sections ci-dessous sont un aide-mémoire en anglais ; leur version française (installation, routes, vérifications) est dans [docs/fr/technical.md](docs/fr/technical.md).

## Quick start

Node.js 26 and read access to the GitHub Packages of `mairie360` (`NODE_AUTH_TOKEN`, `read:packages`) are needed for the private `@mairie360/*` packages.

```bash
export NODE_AUTH_TOKEN=<token with read:packages>
npm ci
# create .env with the variables below
npm run start
```

The BFF listens on port `4000`: `GET /health` checks the process, `GET /check_apis` its upstreams, `/docs` serves Swagger UI and `/openapi.json` the contract.

Configuration (local example, every upstream is required: there is no `localhost` default):

```dotenv
PORT=4000
CORE_API_URL=http://localhost:3000
JWT_PUBLIC_KEY=<the public key of the local Core API (PEM)>
```

## Routes

Generated contract: [`contracts/openapi.json`](contracts/openapi.json) (36 operations), published on every release as `@mairie360/bff-user-openapi` for the front.

| Method | Path | Summary |
| --- | --- | --- |
| `GET` | `/health` | Check the health of the BFF |
| `GET` | `/check_apis` | Checks that Core API is reachable |
| `POST` | `/auth/login` | Signs a user in |
| `POST` | `/auth/force_change_password` | Force a password change |
| `POST` | `/auth/forgot_password` | Requests a password reset e-mail |
| `POST` | `/auth/reset_password` | Resets a password with the e-mailed token |
| `POST` | `/auth/refresh` | Renews the access JWT |
| `POST` | `/auth/logout` | Signs a user out |
| `GET` | `/user/{userId}/about` | Gets the public information of a user |
| `GET` | `/admin/users` | List the manageable users, at most 20 items per page |
| `POST` | `/admin/users` | Create a user through Core API |
| `PATCH` | `/admin/users/{userId}` | Update a user through Core API |
| `DELETE` | `/admin/users/{userId}` | Delete a user for good through Core API |
| `POST` | `/admin/users/{userId}/roles` | Add a role to a user through Core API |
| `DELETE` | `/admin/users/{userId}/roles/{roleId}` | Remove a role from a user through Core API |
| `GET` | `/admin/roles` | List the admin roles through Core API |
| `POST` | `/admin/roles` | Create a role through Core API |
| `PUT` | `/admin/roles/{roleId}` | Replace a role through Core API |
| `PATCH` | `/admin/roles/{roleId}` | Update a role through Core API |
| `DELETE` | `/admin/roles/{roleId}` | Delete a role through Core API |
| `GET` | `/admin/groups` | Lists the groups through Core API, one page chosen with `limit` / `offset` |
| `POST` | `/admin/groups` | Create a group through Core API |
| `GET` | `/admin/groups/{groupId}` | Get a group through Core API |
| `PATCH` | `/admin/groups/{groupId}` | Update the name or the description of a group |
| `DELETE` | `/admin/groups/{groupId}` | Delete a group through Core API |
| `GET` | `/admin/groups/{groupId}/users` | List the users of a group through Core API |
| `POST` | `/admin/groups/{groupId}/users` | Add a user to a group through Core API |
| `DELETE` | `/admin/groups/{groupId}/users/{userId}` | Remove a user from a group through Core API |
| `GET` | `/admin/sessions` | List the active sessions through Core API |
| `GET` | `/admin/sessions/history` | Reads the session history through Core API, one page chosen with `limit` / `offset` |
| `POST` | `/admin/sessions/revoke` | Revokes a session through Core API |
| `GET` | `/me` | Get the identity, groups and roles of the session |
| `GET` | `/session/me` | Get the identity, groups and roles of the session |

## Upstream contracts

The BFF calls its upstreams through these published packages (never through a local checkout); bumping one of them is how an upstream change reaches this BFF:

- `@mairie360/core-api-openapi`

## Commands

```bash
npm run lint                 # eslint
npm test                     # jest: unit, route and upstream-mock tests
npm run contracts:generate   # regenerate contracts/ after a route, schema or status change
npm run contracts:check      # CI gate: fails when contracts/ is stale
```

Docker stacks, one at a time (they need `NODE_AUTH_TOKEN` and pull access to `ghcr.io/mairie360`):

- `./integration_test.sh`: newman collection against the stack of `docker-compose-integration.yml`
- `./security_test.sh`: OWASP ZAP scan of `/openapi.json` (`docker-compose-security.yml`)
- `./performance_test.sh`: k6 load test (`docker-compose-performance.yml`)
- `./gdpr_marker_test.sh`: GDPR marker check (`docker-compose-gdpr-marker.yml`)
- `./gdpr_simulation_test.sh`: GDPR erasure simulation (`docker-compose-gdpr-simulation.yml`)

CI is the reusable `mairie360/CICD` workflow called by `.github/workflows/cicd.yml`.

## Contracts and background / Contrats et compléments

- [CONTRACT.md](CONTRACT.md)
- [contracts/openapi.json](contracts/openapi.json)
