# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "7931bcc759e415fdb2f82a8e6162e52bd25b73c8", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-11-03 14:22 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `7931bcc` | 2026-11-03 14:22 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Changements de comportement

- Les jetons de session sont désormais vérifiés avec la clé publique Ed25519 de Core (`JWT_PUBLIC_KEY`, EdDSA, `kid`, `iss` `mairie360-core`, `aud` `mairie360`) au lieu du secret HS256 `JWT_SECRET`. Sans `JWT_SECRET` défini, un jeton HS256 est refusé en 401 sans appel à Core ; `JWT_SECRET` seul reste accepté pendant la transition. Un appelant qui signe encore avec `JWT_SECRET` seul est donc refusé. (MAIR-680, [#290](https://github.com/mairie360/BFF_user/pull/290))
- Au démarrage, l'instance refuse de démarrer sans clé de session (`JWT_PUBLIC_KEY`, ou `JWT_SECRET` pendant la transition) ou si la clé PEM est invalide. Les descriptions des réponses 503 nomment `JWT_PUBLIC_KEY`. (MAIR-680, [#290](https://github.com/mairie360/BFF_user/pull/290))
- `POST /auth/logout` avec un refresh token (corps ou cookie `refreshToken`) appelle la route publique `POST /api/v1/auth/logout` de Core, sans JWT, et révoque la session même si le JWT a expiré. Avec un Bearer, `POST /api/v1/sessions/logout` est appelé en parallèle ; `session_revoked` vaut `true` si l'un des deux réussit. Sans aucun des deux, rien n'est appelé. Les cookies sont toujours effacés. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- `/auth/forgot_password` est limité par IP cliente et par adresse e-mail (`AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX`, 10 par fenêtre de 15 minutes par défaut). Chaque requête compte, y compris celles qui répondent 200 ; au-delà du quota, la requête est refusée par le limiteur. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Corrections

- Déconnexion avec JWT expiré : avant, `/auth/logout` échouait sans bruit (`session_revoked: false`) et le refresh token restait valide 30 jours côté Core ; maintenant le refresh token est révoqué. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- Mot de passe oublié verrouillable pour toute l'instance : avant, les appels anonymes au Core partaient sans adresse cliente, donc les quotas de Core étaient consommés par le pod du BFF ; maintenant chaque appel anonyme (connexion, Keycloak, mot de passe oublié, réinitialisation, changement forcé, refresh) transmet l'IP cliente en `X-Forwarded-For`. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- Journaux : avant, les erreurs étaient journalisées avec leur valeur brute (Bearer token et corps de requête dans la cause de l'erreur axios) ; maintenant `errorHandler` et `checkApis` journalisent un descriptif (type, statut, code, message). (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique

- Dépendances : `@mairie360/bffs-lib` passé à 2.7.0 (#290) ; `@mairie360/core-api-openapi` en 2.2.0, images Core `dev-72dca5b` et base `dev-76437e3` dans les stacks (#284) ; mises à jour TypeScript (#276) et dotenv 18.0.9 (#274), selon la description de la PR.
- CI/CD : workflows sur mairie360/CICD v5.2.2 avec `ANTHROPIC_WORKSPACE_ID` (#287) ; images et actions épinglées par digest, Node.js 24.22.1, utilisateur `node` dans l'image de développement (#275, #285) ; checklist RGPD des PR (#218) ; documentation CICD v4.4.3 (#271).
- Tests : stack d'intégration newman avec collection Postman (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273)), test du marqueur RGPD (MAIR-290, #213) et simulation d'usage RGPD (MAIR-497, [#217](https://github.com/mairie360/BFF_user/pull/217)), clés Ed25519 générées par run dans les stacks de test (#290).

## Différence dev → staging (en dev, pas encore en staging)

#### Changements de comportement

- Les jetons de session sont désormais vérifiés avec la clé publique Ed25519 de Core (`JWT_PUBLIC_KEY`, EdDSA, `kid`, `iss` `mairie360-core`, `aud` `mairie360`) au lieu du secret HS256 `JWT_SECRET`. Sans `JWT_SECRET` défini, un jeton HS256 est refusé en 401 sans appel à Core ; `JWT_SECRET` seul reste accepté pendant la transition. Un appelant qui signe encore avec `JWT_SECRET` seul est donc refusé. (MAIR-680, [#290](https://github.com/mairie360/BFF_user/pull/290))
- Au démarrage, l'instance refuse de démarrer sans clé de session (`JWT_PUBLIC_KEY`, ou `JWT_SECRET` pendant la transition) ou si la clé PEM est invalide. Les descriptions des réponses 503 nomment `JWT_PUBLIC_KEY`. (MAIR-680, [#290](https://github.com/mairie360/BFF_user/pull/290))
- `POST /auth/logout` avec un refresh token (corps ou cookie `refreshToken`) appelle la route publique `POST /api/v1/auth/logout` de Core, sans JWT, et révoque la session même si le JWT a expiré. Avec un Bearer, `POST /api/v1/sessions/logout` est appelé en parallèle ; `session_revoked` vaut `true` si l'un des deux réussit. Sans aucun des deux, rien n'est appelé. Les cookies sont toujours effacés. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- `/auth/forgot_password` est limité par IP cliente et par adresse e-mail (`AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX`, 10 par fenêtre de 15 minutes par défaut). Chaque requête compte, y compris celles qui répondent 200 ; au-delà du quota, la requête est refusée par le limiteur. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Corrections

- Déconnexion avec JWT expiré : avant, `/auth/logout` échouait sans bruit (`session_revoked: false`) et le refresh token restait valide 30 jours côté Core ; maintenant le refresh token est révoqué. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- Mot de passe oublié verrouillable pour toute l'instance : avant, les appels anonymes au Core partaient sans adresse cliente, donc les quotas de Core étaient consommés par le pod du BFF ; maintenant chaque appel anonyme (connexion, Keycloak, mot de passe oublié, réinitialisation, changement forcé, refresh) transmet l'IP cliente en `X-Forwarded-For`. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- Journaux : avant, les erreurs étaient journalisées avec leur valeur brute (Bearer token et corps de requête dans la cause de l'erreur axios) ; maintenant `errorHandler` et `checkApis` journalisent un descriptif (type, statut, code, message). (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique

- Dépendances : `@mairie360/bffs-lib` passé à 2.7.0 (#290) ; `@mairie360/core-api-openapi` en 2.2.0, images Core `dev-72dca5b` et base `dev-76437e3` dans les stacks (#284) ; mises à jour TypeScript (#276) et dotenv 18.0.9 (#274), selon la description de la PR.
- CI/CD : workflows sur mairie360/CICD v5.2.2 avec `ANTHROPIC_WORKSPACE_ID` (#287) ; images et actions épinglées par digest, Node.js 24.22.1, utilisateur `node` dans l'image de développement (#275, #285) ; checklist RGPD des PR (#218) ; documentation CICD v4.4.3 (#271).
- Tests : stack d'intégration newman avec collection Postman (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273)), test du marqueur RGPD (MAIR-290, #213) et simulation d'usage RGPD (MAIR-497, [#217](https://github.com/mairie360/BFF_user/pull/217)), clés Ed25519 générées par run dans les stacks de test (#290).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-11-03 14:22 UTC | dev | — | `7931bcc` | [run](https://github.com/mairie360/BFF_user/actions/runs/41652093723) |
| 2026-11-03 02:07 UTC | dev | — | `d774f6c` | [run](https://github.com/mairie360/BFF_user/actions/runs/41563618435) |
| 2026-11-03 00:02 UTC | dev | — | `243acbe` | [run](https://github.com/mairie360/BFF_user/actions/runs/41548478302) |
| 2026-11-02 12:56 UTC | dev | — | `cd4e695` | [run](https://github.com/mairie360/BFF_user/actions/runs/41448169133) |
| 2026-11-01 20:09 UTC | dev | — | `7ce44d2` | [run](https://github.com/mairie360/BFF_user/actions/runs/41344951999) |
| 2026-11-01 17:21 UTC | dev | — | `49a3611` | [run](https://github.com/mairie360/BFF_user/actions/runs/41330698243) |
| 2026-11-01 12:45 UTC | dev | — | `86a82ae` | [run](https://github.com/mairie360/BFF_user/actions/runs/41307645663) |
| 2026-11-01 12:40 UTC | dev | — | `d356c97` | [run](https://github.com/mairie360/BFF_user/actions/runs/41307417610) |
| 2026-11-01 12:38 UTC | dev | — | `2ac1100` | [run](https://github.com/mairie360/BFF_user/actions/runs/41306977104) |
| 2026-10-23 12:22 UTC | dev | — | `64482b7` | [run](https://github.com/mairie360/BFF_user/actions/runs/39952425565) |
| 2026-10-23 02:58 UTC | dev | — | `7a4bbf9` | [run](https://github.com/mairie360/BFF_user/actions/runs/39892169488) |
| 2026-10-22 09:08 UTC | dev | — | `48b4a65` | [run](https://github.com/mairie360/BFF_user/actions/runs/39752659489) |
| 2026-10-21 10:09 UTC | prod | v1.1.0 | `b754a6c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39579231890) |
| 2026-10-21 09:48 UTC | dev | — | `a78ad89` | [run](https://github.com/mairie360/BFF_user/actions/runs/39579059907) |
| 2026-10-21 09:41 UTC | staging | — | `b754a6c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39577921804) |
| 2026-10-21 09:32 UTC | dev | — | `b754a6c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39577314349) |
| 2026-10-21 01:39 UTC | dev | — | `b134edd` | [run](https://github.com/mairie360/BFF_user/actions/runs/39528066253) |
| 2026-10-20 18:12 UTC | staging | — | `b6b04cf` | [run](https://github.com/mairie360/BFF_user/actions/runs/39470049349) |
| 2026-10-20 17:57 UTC | dev | — | `b6b04cf` | [run](https://github.com/mairie360/BFF_user/actions/runs/39470049349) |
| 2026-10-20 13:04 UTC | dev | — | `699a1ef` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426669559) |
| 2026-10-20 13:02 UTC | dev | — | `848097d` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426619527) |
| 2026-10-19 20:26 UTC | dev | — | `b6d118c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39318019880) |
| 2026-10-19 20:15 UTC | dev | — | `05cc9d3` | [run](https://github.com/mairie360/BFF_user/actions/runs/39316541683) |
<!-- release-journal-history:end -->
