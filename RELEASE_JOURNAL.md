# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "cd4e6952b4a63ce63a2688c3283c92dff0123f41", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-11-02 12:56 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `cd4e695` | 2026-11-02 12:56 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Changements de comportement
- `POST /auth/logout` n'appelle plus `POST /api/v1/sessions/revoke` de Core. Avec un refresh token (corps ou cookie `refreshToken`), il appelle `POST /api/v1/auth/logout` de Core, sans JWT. Avec une session Bearer, il appelle aussi `POST /api/v1/sessions/logout` en parallèle ; `session_revoked` vaut `true` si l'un des deux appels réussit. Sans refresh token ni session Bearer, rien n'est appelé. Les cookies sont toujours effacés, et un échec de Core n'est que journalisé. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- Les appels anonymes à Core (connexion, Keycloak, changement de mot de passe imposé, mot de passe oublié, réinitialisation, refresh) transmettent désormais l'IP du client en `X-Forwarded-For`, pour que les limites par IP de Core comptent le client et non le pod du BFF. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- `/auth/forgot_password` : chaque requête est comptée, par IP cliente (si `TRUST_PROXY` est défini et que la requête porte `X-Forwarded-For`) et par e-mail (SHA-256 de l'adresse), avec `AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX` (10 par fenêtre de 15 minutes par défaut). Les requêtes mal formées comptent aussi comme échecs par IP. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Corrections
- `POST /auth/logout` avec un JWT expiré : avant, la révocation échouait (`session_revoked: false`) et le refresh token restait valide 30 jours sur Core ; maintenant le refresh token est révoqué même sans JWT valide. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- Mot de passe oublié verrouillable pour toute l'instance : avant, 10 requêtes anonymes bloquaient la récupération pour tout le monde pendant 15 minutes, car `/auth/forgot_password` n'était pas compté et les appels à Core partaient sans IP cliente ; maintenant chaque requête est comptée par client. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- Journaux : avant, le gestionnaire d'erreurs par défaut et `checkApis` journalisaient l'erreur brute, dont la `cause` axios contenait le Bearer et les corps de requête et de réponse ; maintenant ils journalisent `describeError` (type, statut, code, message). (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Pins Core API `dev-72dca5b`, base `dev-76437e3` et liquibase `dev-76437e3` dans les stacks (les stacks RGPD gardent `dev-c5b8e22` pour la base) ; `@mairie360/bffs-lib` passe de 2.5.0 à 2.6.0 ; documentation et contrat OpenAPI mis à jour. (MAIR-692, MAIR-679, [#284](https://github.com/mairie360/BFF_user/pull/284), [#281](https://github.com/mairie360/BFF_user/pull/281))
- Node.js épinglé à 24.22.1 (images `Dockerfile` et `development.Dockerfile` par digest, CI) ; l'image de développement tourne sous l'utilisateur `node`. (MAIR-, [#275](https://github.com/mairie360/BFF_user/pull/275))
- Outillage de tests et CI : suite d'intégration newman sur la vraie image Core (`docker-compose-integration.yml`, porte `integration_tests` de la promotion staging, CICD v4.5.0) ([#273](https://github.com/mairie360/BFF_user/pull/273)) ; test RGPD du marqueur dans les logs ([#213](https://github.com/mairie360/BFF_user/pull/213)), simulation RGPD ([#217](https://github.com/mairie360/BFF_user/pull/217)) et checklist RGPD des PR ([#218](https://github.com/mairie360/BFF_user/pull/218)).
- Dépendances : mises à jour TypeScript (`@typescript-eslint` 8.72.1, `eslint` 10.14.0, `globals` 17.14.0, `typescript-eslint` 8.72.1) ([#276](https://github.com/mairie360/BFF_user/pull/276)) ; `dotenv` 18.0.8 → 18.0.9 ([#274](https://github.com/mairie360/BFF_user/pull/274), diff absent, seule la description est disponible). Documentation de la version CICD v4.4.3 ([#271](https://github.com/mairie360/BFF_user/pull/271)).

## Différence dev → staging (en dev, pas encore en staging)

#### Changements de comportement
- `POST /auth/logout` n'appelle plus `POST /api/v1/sessions/revoke` de Core. Avec un refresh token (corps ou cookie `refreshToken`), il appelle `POST /api/v1/auth/logout` de Core, sans JWT. Avec une session Bearer, il appelle aussi `POST /api/v1/sessions/logout` en parallèle ; `session_revoked` vaut `true` si l'un des deux appels réussit. Sans refresh token ni session Bearer, rien n'est appelé. Les cookies sont toujours effacés, et un échec de Core n'est que journalisé. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- Les appels anonymes à Core (connexion, Keycloak, changement de mot de passe imposé, mot de passe oublié, réinitialisation, refresh) transmettent désormais l'IP du client en `X-Forwarded-For`, pour que les limites par IP de Core comptent le client et non le pod du BFF. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- `/auth/forgot_password` : chaque requête est comptée, par IP cliente (si `TRUST_PROXY` est défini et que la requête porte `X-Forwarded-For`) et par e-mail (SHA-256 de l'adresse), avec `AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX` (10 par fenêtre de 15 minutes par défaut). Les requêtes mal formées comptent aussi comme échecs par IP. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Corrections
- `POST /auth/logout` avec un JWT expiré : avant, la révocation échouait (`session_revoked: false`) et le refresh token restait valide 30 jours sur Core ; maintenant le refresh token est révoqué même sans JWT valide. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- Mot de passe oublié verrouillable pour toute l'instance : avant, 10 requêtes anonymes bloquaient la récupération pour tout le monde pendant 15 minutes, car `/auth/forgot_password` n'était pas compté et les appels à Core partaient sans IP cliente ; maintenant chaque requête est comptée par client. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- Journaux : avant, le gestionnaire d'erreurs par défaut et `checkApis` journalisaient l'erreur brute, dont la `cause` axios contenait le Bearer et les corps de requête et de réponse ; maintenant ils journalisent `describeError` (type, statut, code, message). (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Pins Core API `dev-72dca5b`, base `dev-76437e3` et liquibase `dev-76437e3` dans les stacks (les stacks RGPD gardent `dev-c5b8e22` pour la base) ; `@mairie360/bffs-lib` passe de 2.5.0 à 2.6.0 ; documentation et contrat OpenAPI mis à jour. (MAIR-692, MAIR-679, [#284](https://github.com/mairie360/BFF_user/pull/284), [#281](https://github.com/mairie360/BFF_user/pull/281))
- Node.js épinglé à 24.22.1 (images `Dockerfile` et `development.Dockerfile` par digest, CI) ; l'image de développement tourne sous l'utilisateur `node`. ([#275](https://github.com/mairie360/BFF_user/pull/275))
- Outillage de tests et CI : suite d'intégration newman sur la vraie image Core (`docker-compose-integration.yml`, porte `integration_tests` de la promotion staging, CICD v4.5.0) ([#273](https://github.com/mairie360/BFF_user/pull/273)) ; test RGPD du marqueur dans les logs ([#213](https://github.com/mairie360/BFF_user/pull/213)), simulation RGPD ([#217](https://github.com/mairie360/BFF_user/pull/217)) et checklist RGPD des PR ([#218](https://github.com/mairie360/BFF_user/pull/218)).
- Dépendances : mises à jour TypeScript (`@typescript-eslint` 8.72.1, `eslint` 10.14.0, `globals` 17.14.0, `typescript-eslint` 8.72.1) ([#276](https://github.com/mairie360/BFF_user/pull/276)) ; `dotenv` 18.0.8 → 18.0.9 ([#274](https://github.com/mairie360/BFF_user/pull/274), diff absent, seule la description est disponible). Documentation de la version CICD v4.4.3 ([#271](https://github.com/mairie360/BFF_user/pull/271)).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
