# BFF_user — Documentation technique

[Présentation du module](module.md) · [English](../en/technical.md) · [README](../../README.md)

## Architecture et traitement des requêtes

Serveur Express 5.2.1 écrit en TypeScript. Les schémas Zod et leur registre OpenAPI décrivent les objets échangés; les routeurs adaptent les services amont aux besoins des interfaces.

Les routeurs `auth`, `session`, `user` et `admin` sont montés dans `src/index.ts`. `src/clients/coreClient.ts` normalise l’adresse de Core et fournit son client généré. Les adaptateurs conservent les réponses Core; les schémas d’administration fixent notamment les enveloppes de listes et de groupes.

## Données et persistance

Core fournit les opérations d’identité et de session. Les dépôts SQL du BFF lisent aussi les utilisateurs et rôles, et réalisent certaines mutations de mots de passe et de groupes. Le parcours de première connexion utilise PostgreSQL et Redis. Les données ne sont donc pas toutes accessibles exclusivement par HTTP.

Les fonctions de supervision, sauvegarde, journaux applicatifs et politique système décrites dans les besoins d’administration ne sont pas garanties par ce contrat. Les accès SQL exigent un schéma compatible, notamment `group_members`; ne pas confondre ce nom avec `group_users` utilisé dans d’autres contrats.

## Installation et lancement local

Utiliser Node.js 22 pour reproduire le job de contrats et npm avec le fichier de verrouillage versionné. Les versions des autres jobs et de Docker sont précisées plus bas.

Les dépendances privées `@mairie360/*` nécessitent un accès GitHub Packages. Configurer `NODE_AUTH_TOKEN` dans l’environnement avec un jeton autorisé à lire ces packages, conformément à `.npmrc`. Ne pas enregistrer la valeur dans Git.

```bash
npm ci
```

Créer `.env` à la racine. Exemple de configuration HTTP locale à adapter aux services démarrés:

```dotenv
PORT=4000
CORE_API_URL=http://localhost:3000
```

Le BFF n’a besoin ni de base de données ni de Redis : tout passe par Core API. Les variables et les éventuels secrets listés ci-dessous restent à fournir; l’exemple HTTP ne prépare pas de données.

```bash
npm run start
```

`PORT` est optionnel; le repli de `src/index.ts` est `4000`.

Vérifier le processus puis consulter la documentation interactive:

```bash
curl --fail --silent --show-error http://localhost:4000/health
```

Interface Swagger: `http://localhost:4000/docs`. Spécification JSON: `/openapi.json`, avec l’alias `/swagger.json`. `/health` vérifie le processus; `/check_apis` est un diagnostic distinct des dépendances.

## Configuration

Les valeurs ci-dessous sont des exemples locaux ou des comportements explicitement indiqués, pas des identifiants de production.

| Variable ou priorité | Exemple / repli indiqué | Rôle |
| --- | --- | --- |
| `PORT` | 4000 | Port de cet exemple local. |
| `CORE_API_URL` | http://localhost:3000 | Adresse de Core, avec schéma HTTP(S). |
| `CORE_API_PORT` | 3000 | Port ajouté si l’adresse ne contient pas de port. |
| `JWT_SECRET` | — | Secret du déploiement Core requis pour les contrôles administrateur locaux. |
| `COOKIE_DOMAIN` | — | Domaine partagé des cookies; omettre pour un cookie limité à l’hôte. |
| `TRUST_PROXY` | non défini (aucun proxy de confiance) | `trust proxy` d’Express: nombre de sauts (`1`), `true`, ou adresses/sous-réseaux de confiance (`loopback, 10.0.0.0/8`). À définir derrière l’ingress pour que les limites s’appliquent par client et non par proxy; tant qu’elle n’est pas définie, la limite par IP est désactivée (avertissement au démarrage). |
| `AUTH_RATE_LIMIT_ENABLED` | `true` | `false` désactive les limites de débit de l’authentification (tests de charge uniquement). |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Fenêtre de limitation (15 minutes). |
| `AUTH_RATE_LIMIT_MAX` | `10` | Connexions échouées par e-mail de compte par fenêtre (par IP cliente + e-mail quand `TRUST_PROXY` est défini), et rafraîchissements échoués par refresh token. |
| `AUTH_RATE_LIMIT_IP_MAX` | `100` | Tentatives échouées par IP cliente par fenêtre, sur `/auth/login`, `/auth/force_change_password` et `/auth/refresh`; appliquée seulement si `TRUST_PROXY` est défini. |

## Routes et contrat de données

Inventaire extrait de `contracts/openapi.json`. Les paramètres entre accolades sont remplacés par des identifiants réels. Les types détaillés, champs requis, réponses et exemples éventuels sont définis dans ce contrat; les statuts du tableau sont ceux déclarés, sans prétendre lister toutes les erreurs de transport ou de validation.

| Méthode | Chemin | Corps déclaré | Statuts déclarés |
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

## Session, permissions et erreurs

Les routes d’authentification gèrent leur propre parcours: les corps de login sont validés avant d’atteindre Core. Il n’existe pas d’inscription publique: les comptes sont créés par les administrateurs via `/bff/admin/users`. `/auth/login` et `/auth/force_change_password` sont limités en débit (tentatives échouées seulement, 429 + `Retry-After`; compteurs en mémoire par réplique). Sans `TRUST_PROXY`, tous les clients partagent l’IP des pods du front: seule la limite par e-mail s’applique, car une limite par IP permettrait à un attaquant de bloquer tous les utilisateurs. `/auth/refresh` échange le `refresh_token` du login contre un nouveau JWT d’accès via la route publique `POST /api/v1/sessions/refresh` de Core (aucune session transmise, un JWT expiré peut donc être renouvelé) et le renvoie comme le login (en-tête et cookie); ses tentatives échouées sont limitées par refresh token (SHA-256), et par IP cliente quand `TRUST_PROXY` est défini. `/auth/logout` révoque la session Core (`POST /api/v1/sessions/revoke`) quand il reçoit à la fois la session et le `refresh_token` renvoyé par le login, ce qui fait refuser immédiatement le JWT d’accès par Core; il efface toujours le cookie, même si Core échoue, et indique le résultat dans `session_revoked`. Toutes les routes `/bff/admin/*` passent par `requireAdmin`, qui vérifie la session avec `JWT_SECRET` et le rôle en base avant toute autre chose, car Core API v1.1.1 ne contrôle pas le rôle administrateur. Les autres adaptateurs transmettent la session de l’appelant à Core et n’utilisent jamais de jeton par défaut; `/me` et `/user/{userId}/about` répondent 401 sans session, et `/user/{userId}/about` ne renvoie que les champs publics (`phone` peut valoir `null`). `/bff/admin/sessions/refresh` relaie le JWT rafraîchi comme le login (en-tête et cookie). Le détail des erreurs n’est exposé qu’avec `NODE_ENV=development`; `/check_apis` ne renvoie jamais de détail réseau. Les cookies dépendent de `COOKIE_DOMAIN` et de `NODE_ENV`; les droits de l’interface ne remplacent pas les contrôles serveur.

## Synchronisation et vérifications

```bash
npm run contracts:generate
npm run contracts:check
npm test -- --runInBand
npm run lint
npm run build
```

Les tests de `tests/user.upstream-mocks.test.ts` exécutent toute l'application et le vrai client Core API contre un mock HTTP local piloté par le contrat Core API, reconstruit depuis le paquet `@mairie360/core-api-openapi` installé (types orval, version épinglée dans `package.json`): chaque requête (chemin, paramètres, corps JSON) et chaque réponse de succès simulée est validée contre ce contrat, et chaque réponse du BFF contre `contracts/openapi.json`. Monter la version du paquet suffit à tester le nouveau contrat; les statuts d'erreur ne sont pas typés par orval et sont simulés explicitement. Les repositories PostgreSQL et Redis restent simulés par `jest.mock`. Les routes servies par Core API v1.1.1 mais absentes du contrat publié sont listées, avec leur justification, dans `tests/support/core-fixtures.ts`.

`contracts:generate` exporte le registre runtime dans `contracts/openapi.json` et régénère `contracts/bff.d.ts`. `contracts:check` échoue si le contrat ou les types sont périmés. Exécuter ensuite `npm run contracts:sync` dans chaque web service associé et livrer les modifications de contrat ensemble.

Le générateur de types est fixé à `openapi-typescript@7.10.1` dans `scripts/contracts.mjs` et s’exécute via npm. Pour une modification uniquement documentaire, vérifier les liens, l’exactitude des deux langues et `git diff --check`; ne pas régénérer les contrats sans modification de leur source.

## CI/CD et exécution Docker

Le job `contracts.yml` utilise Node.js 22, `actions/checkout@v7` et `actions/setup-node@v7`. Il s’exécute sur push, pull request et lancement manuel; il installe avec `npm ci`, contrôle les contrats et lance les tests dédiés.

`cicd.yml` appelle `mairie360/CICD/.github/workflows/BFFs-cicd.yml@v1.13.2`, avec `cicd_version: v1.13.2` et `node_version: "22"`. Les étapes réutilisables et les environnements GitHub déterminent les contrôles, publications et déploiements effectifs.

Le Dockerfile utilise encore `node:20-alpine` pour la construction et l’exécution; la commande de l’image est `["node", "dist/index.js"]`. Cette version est distincte du job de contrats Node.js 22.

Avant un lancement Docker, vérifier les variables de service, les secrets de build et les réseaux dans les fichiers du dépôt. Une CI verte valide ses jobs; elle ne prouve pas la disponibilité des services métier dans un environnement distant.

## Diagnostic

Si la connexion fonctionne mais que l’administration échoue, vérifier la configuration `JWT_SECRET`, le rôle enregistré et l’accès SQL. Si le changement de première connexion échoue, vérifier Redis, le jeton temporaire et PostgreSQL.

## Repères dans le dépôt

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

Compléments historiques: [CONTRACT.md](../../CONTRACT.md). Les besoins proposés doivent rester distincts du comportement effectivement implémenté.
