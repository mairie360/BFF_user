# BFF_user — Documentation technique

[Présentation du module](module.md) · [English](../en/technical.md) · [README](../../README.md)

## Architecture et traitement des requêtes

Serveur Express 5.2.1 écrit en TypeScript. Les schémas Zod et leur registre OpenAPI décrivent les objets échangés; les routeurs adaptent les services amont aux besoins des interfaces.

Les routeurs `auth`, `session`, `user` et `admin` sont montés dans `src/index.ts`. `src/clients/coreClient.ts` normalise l’adresse de Core et fournit son client généré. Les adaptateurs conservent les réponses Core; les schémas d’administration fixent notamment les enveloppes de listes et de groupes.

## Données et persistance

Core fournit les opérations d’identité et de session. Les dépôts SQL du BFF lisent aussi les utilisateurs et rôles, et réalisent certaines mutations de mots de passe et de groupes. Le parcours de première connexion utilise PostgreSQL et Redis. Les données ne sont donc pas toutes accessibles exclusivement par HTTP.

Les fonctions de supervision, sauvegarde, journaux applicatifs et politique système décrites dans les besoins d’administration ne sont pas garanties par ce contrat. Les accès SQL exigent un schéma compatible, notamment `group_members`; ne pas confondre ce nom avec `group_users` utilisé dans d’autres contrats.

## Installation et lancement local

Utiliser Node.js 24 (comme les jobs CI et les images) pour reproduire le job de contrats et npm avec le fichier de verrouillage versionné. Les versions des autres jobs et de Docker sont précisées plus bas.

Les dépendances privées `@mairie360/*` nécessitent un accès GitHub Packages. Configurer `NODE_AUTH_TOKEN` dans l’environnement avec un jeton autorisé à lire ces packages, conformément à `.npmrc`. Ne pas enregistrer la valeur dans Git.

```bash
npm ci
```

Créer `.env` à la racine. Exemple de configuration HTTP locale à adapter aux services démarrés:

```dotenv
PORT=4000
CORE_API_URL=http://localhost:3000
JWT_SECRET=<le secret du Core API local>
```

`.env` est chargé par la première ligne de `src/index.ts` (`import 'dotenv/config'`), avant tout autre module. Le serveur refuse de démarrer (une erreur nommant chaque variable manquante) si `CORE_API_URL` est absent ou invalide ou si `JWT_SECRET` est absent : il n’y a aucune valeur par défaut `localhost`.

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
| `CORE_API_URL` | http://core-api:3000 | **Obligatoire**, sans valeur par défaut. Adresse de Core (schéma facultatif, `http` par défaut), relue à chaque appel : le serveur ne démarre pas sans elle, et une route qui appelle Core répond 503 si elle disparaît. |
| `CORE_API_PORT` | 3000 | Port ajouté si l’adresse ne contient pas de port. |
| `JWT_SECRET` | — | **Obligatoire** : secret du déploiement Core pour les contrôles administrateur locaux ; le serveur ne démarre pas sans lui (503 sur `/bff/admin/*` s’il disparaît). |
| `COOKIE_DOMAIN` | — | Domaine partagé des cookies; omettre pour un cookie limité à l’hôte. |
| `TRUST_PROXY` | non défini (aucun proxy de confiance) | `trust proxy` d’Express: nombre de sauts (`1`), `true`, ou adresses/sous-réseaux de confiance (`loopback, 10.0.0.0/8`). À définir derrière l’ingress pour que les limites s’appliquent par client et non par proxy; tant qu’elle n’est pas définie, la limite par IP est désactivée (avertissement au démarrage). |
| `AUTH_RATE_LIMIT_ENABLED` | `true` | `false` désactive les limites de débit de l’authentification (tests de charge uniquement). |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Fenêtre de limitation (15 minutes). |
| `AUTH_RATE_LIMIT_MAX` | `10` | Connexions échouées par e-mail de compte par fenêtre (par IP cliente + e-mail quand `TRUST_PROXY` est défini), et rafraîchissements échoués par refresh token. |
| `AUTH_RATE_LIMIT_IP_MAX` | `100` | Tentatives échouées par IP cliente par fenêtre, sur `/auth/login`, `/auth/force_change_password` et `/auth/refresh`; appliquée seulement si `TRUST_PROXY` est défini et que la requête porte `X-Forwarded-For` (un front qui appelle côté serveur sans cet en-tête partage l’IP de son pod avec tous les utilisateurs). |
| `KEYCLOAK_REALM_URL` | https://auth.mairie360.fr/realms/mairie360 | URL publique du realm Keycloak, telle que le navigateur l’atteint. Avec `KEYCLOAK_CLIENT_ID`, active la déconnexion unique. |
| `KEYCLOAK_CLIENT_ID` | mairie360 | Client OIDC avec lequel les fronts se connectent (le même que Core). |
| `KEYCLOAK_POST_LOGOUT_REDIRECT_URI` | https://login.mairie360.fr/ | Page par défaut vers laquelle Keycloak renvoie le navigateur après la déconnexion; le client doit l’autoriser. |

## Routes et contrat de données

Inventaire extrait de `contracts/openapi.json`. Les paramètres entre accolades sont remplacés par des identifiants réels. Les types détaillés, champs requis, réponses et exemples éventuels sont définis dans ce contrat; les statuts du tableau sont ceux déclarés, sans prétendre lister toutes les erreurs de transport ou de validation.

| Méthode | Chemin | Corps déclaré | Statuts déclarés |
| --- | --- | --- | --- |
| GET | `/health` | — | 200 |
| GET | `/check_apis` | — | 200, 502 |
| POST | `/auth/login` | application/json | 200, 400, 401, 412, 429, 500, 502 |
| POST | `/auth/keycloak` | application/json | 200, 400, 401, 403, 500, 502, 503 |
| POST | `/auth/force_change_password` | application/json | 204, 400, 401, 403, 429, 500, 502 |
| POST | `/auth/refresh` | application/json | 200, 400, 401, 429, 500, 502 |
| POST | `/auth/logout` | application/json (optionnel) | 200, 400, 500 |
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

## Session, permissions et erreurs

Les routes d’authentification gèrent leur propre parcours: les corps de login sont validés avant d’atteindre Core. Il n’existe pas d’inscription publique: les comptes sont créés par les administrateurs via `/bff/admin/users`. `/auth/keycloak` termine l’authentification unique Keycloak: il transmet le code d’autorisation (avec `redirect_uri`, et le `code_verifier` PKCE et le `nonce` s’ils sont utilisés) à la route publique `POST /api/v1/auth/keycloak` de Core, qui l’échange et ouvre une session pour le compte ayant le même e-mail vérifié; la session est ensuite posée exactement comme au login (cookies HttpOnly `accessToken` et `refreshToken`), donc les rôles et les autres BFFs ne changent pas. Le `503` de Core (Keycloak non configuré) est conservé pour que le front puisse revenir au login par mot de passe, qui reste disponible pendant la transition. `/auth/login` et `/auth/force_change_password` sont limités en débit (tentatives échouées seulement, 429 + `Retry-After`; compteurs en mémoire par réplique). Sans `TRUST_PROXY`, tous les clients partagent l’IP des pods du front: seule la limite par e-mail s’applique, car une limite par IP permettrait à un attaquant de bloquer tous les utilisateurs. Il en va de même par requête quand `TRUST_PROXY` est défini: une requête sans `X-Forwarded-For` (un front qui appelle côté serveur) n’est pas soumise à la limite par IP. La connexion ne remet la session que dans des cookies HttpOnly `SameSite=Strict`: `accessToken` (le JWT d’accès, chemin `/`) et `refreshToken` (chemin `/auth`); aucun jeton n’est renvoyé dans le corps ni dans un en-tête de réponse. `/auth/force_change_password` exige un mot de passe de 8 à 255 caractères, comme les routes d’administration. `/auth/refresh` échange le refresh token (`refresh_token` du corps, sinon le cookie `refreshToken`) contre un nouveau JWT d’accès via la route publique `POST /api/v1/sessions/refresh` de Core (aucune session transmise, un JWT expiré peut donc être renouvelé) et le pose comme le login (cookie uniquement); ses tentatives échouées sont limitées par refresh token (SHA-256), et par IP cliente quand `TRUST_PROXY` est défini. `/auth/logout` révoque la session Core (`POST /api/v1/sessions/revoke`) quand il reçoit à la fois la session et le refresh token (corps ou cookie `refreshToken`), ce qui fait refuser immédiatement le JWT d’accès par Core; il efface toujours les deux cookies, même si Core échoue, et indique le résultat dans `session_revoked`. Quand `KEYCLOAK_REALM_URL` et `KEYCLOAK_CLIENT_ID` sont définis, `/auth/logout` renvoie aussi `logout_url`, l’URL de fin de session OpenID Connect du realm (`/protocol/openid-connect/logout`) vers laquelle le front doit envoyer le navigateur: Keycloak ferme alors la session d’authentification unique et, par son front-channel ou back-channel logout, les sessions des autres outils du realm (n8n). Core ne conserve aucun jeton Keycloak, donc l’URL porte `client_id` plutôt que `id_token_hint` et Keycloak demande confirmation à l’utilisateur; le `post_logout_redirect_uri` vient du corps optionnel, sinon de `KEYCLOAK_POST_LOGOUT_REDIRECT_URI`, et doit être autorisé sur le client. Chaque corps de requête `/bff/admin/*` est validé par un schéma Zod calqué sur la vue Core API à laquelle il est transmis (champs inconnus retirés, `<` et `>` refusés dans les libellés stockés, l’identifiant du chemin prime sur le `user_id`/`group_id` du corps, pas de mot de passe dans une mise à jour d’utilisateur); un corps invalide répond 400 sans atteindre Core. Toutes les routes `/bff/admin/*` passent par `requireAdmin`, qui vérifie la session avec `JWT_SECRET` et le rôle en base avant toute autre chose, car Core API v1.1.1 ne contrôle pas le rôle administrateur. Les autres adaptateurs transmettent la session de l’appelant à Core et n’utilisent jamais de jeton par défaut; la session est lue uniquement dans l’en-tête `Authorization: Bearer`, que le proxy des fronts construit à partir du cookie `accessToken` (le cookie `accessToken`, l’en-tête `x-session-token`, le cookie `session` et les autres schémas sont ignorés, y compris par `/auth/logout` et la vérification administrateur); sans lui, les routes liées à la session répondent 401 avant toute validation ou tout appel à Core, et toutes les réponses de `/auth`, `/me`, `/session`, `/user` et `/bff/admin` portent `Cache-Control: no-store`. Les routes de lecture (`/me`, listes d’administration) ne renvoient que les champs de leur schéma de contrat: tout autre champ ajouté par Core est retiré, et une réponse Core non conforme donne un 502; `/me` et `/user/{userId}/about` répondent 401 sans session, et `/user/{userId}/about` ne renvoie que les champs publics (`phone` peut valoir `null`). `/bff/admin/sessions/refresh` a été supprimée: elle remplaçait le cookie de l’administrateur par le JWT de la session rafraîchie, et Core ne publie aucune révocation par identifiant de session. L’absence de `CORE_API_URL` répond 503 sur toutes les routes qui appellent Core (déclaré dans le contrat), et l’absence de `JWT_SECRET` répond 503 sur `/bff/admin/*` ; le contrôle au démarrage empêche normalement les deux cas. Ni les jetons ni les URL appelées sur Core ne sont journalisés. Toutes les erreurs répondent l’enveloppe commune à tous les BFFs (`@mairie360/bffs-lib`), `{ "error": { "code", "message", "details" } }`, déclarée comme `ErrorResponse` dans le contrat : `code` suit le statut (`BAD_REQUEST`, `UNAUTHORIZED`, `CONFLICT`, `BAD_GATEWAY`...), et un 400 liste les champs invalides dans `details` (`{ "path": "body.email", "message" }`). Seuls les 4xx du Core qu’une route déclare sont conservés, avec un message générique (`/user/{userId}/about` garde 401 et 404, les écritures d’administration gardent aussi 409) ; tout autre statut du Core et un Core injoignable répondent 502, et le corps du Core n’est jamais relayé. Le 412 de première connexion de `/auth/login` n’est pas une erreur : il ne porte que le `token` à usage unique. Une erreur inattendue répond un 500 générique, quel que soit `NODE_ENV` ; `/check_apis` ne renvoie jamais de détail réseau. Les cookies dépendent de `COOKIE_DOMAIN` et de `NODE_ENV`; les droits de l’interface ne remplacent pas les contrôles serveur.

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

Le job `contracts.yml` utilise Node.js 24, `actions/checkout@v7` et `actions/setup-node@v7`. Il s’exécute sur push, pull request et lancement manuel; il installe avec `npm ci`, contrôle les contrats et lance les tests dédiés.

`cicd.yml` appelle `mairie360/CICD/.github/workflows/BFFs-cicd.yml@v3.2.0`, avec `cicd_version: v3.2.0` et `node_version: "24"`. Les étapes réutilisables et les environnements GitHub déterminent les contrôles, publications et déploiements effectifs.

Le `Dockerfile` (construction et exécution) et `development.Dockerfile` utilisent `node:24-alpine` épinglé par digest, la même version de Node.js que les jobs CI ; la commande de l’image de production est `["node", "dist/index.js"]` (les paquets `@mairie360/*-openapi` sont intégrés au bundle par esbuild, rien n’est compilé à l’exécution) et l’image de développement lance `npm run start` (`tsx watch`).

`security_test.sh` et `performance_test.sh` testent l’image désignée par `IMAGE_REF`: en CI, l’image que `release-dev` vient de publier, soit l’artefact ensuite promu en staging puis en prod. Quand `IMAGE_REF` est vide (usage local), ils construisent d’abord `bff-user:local` depuis `development.Dockerfile`, ce qui demande `NODE_AUTH_TOKEN` et `./.npmrc`.

`security_test.sh` lance la stack OWASP ZAP de `docker-compose-security.yml`: ZAP rejoue chaque opération de `/openapi.json` avec un JWT admin statique (`sub=1`, HS256, `JWT_SECRET=b"secret"`) et remplit corps et paramètres de chemin avec les exemples du contrat. `init-test.sql` crée les ressources que ces exemples désignent (utilisateurs 1, 2, 10, 11, 42, rôles et groupes 10 et 11, deux sessions); garder exemples et seed alignés en ajoutant une route.

Les deux stacks portent la gate de couverture OpenAPI de `mairie360/CICD` (`tests/zap/zap_hooks.py`, `tests/k6/coverage.js`), extraite dans `cicd-repo/` par les jobs CI et clonée au même endroit par les scripts au `cicd_version` épinglé (`CICD_VERSION` le remplace). Après le scan, le hook ZAP échoue si une opération du contrat n’a jamais été atteinte, ou si une opération qui exige `bearerAuth` n’a reçu que des 401/403 ; les opérations publiques déclarent `security: []` dans leur `registerPath`. `load-test.js` contient un handler par opération de `contracts/openapi.json` : k6 s’arrête à l’init s’il en manque un et échoue sur le seuil `operations_uncovered` si un handler n’envoie pas sa requête. **Ajouter une route implique d’ajouter son handler dans `load-test.js`** (et `security: []` si elle est publique).

`load-test.js` lance deux scénarios. `crud` (2 VUs) appelle chaque handler une fois par itération, écritures comprises, sous forme d’un scénario admin autonome qui supprime ce qu’il crée. `reads` (jusqu’à 20 VUs) ne rejoue que les handlers GET sur les fixtures de `init-test.sql`. Chaque opération a un seuil `p(95)` fixé par sa famille : 50 ms pour `/health`, 150 ms pour `/check_apis`, 500 ms pour les lectures, 800 ms pour `/auth/*` et les écritures admin ; `http_req_failed` doit rester sous 1 %.

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
