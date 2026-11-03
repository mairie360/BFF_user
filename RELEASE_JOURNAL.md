# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "243acbe516c1f70509778422e7e0ef71e30d8fd0", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-11-03 00:02 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `243acbe` | 2026-11-03 00:02 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Changements de comportement
- `POST /auth/logout` révoque désormais la session via la route publique de Core `POST /api/v1/auth/logout` quand un refresh token est fourni (body ou cookie `refreshToken`), sans JWT. Avec un Bearer, il appelle aussi `POST /api/v1/sessions/logout` ; `session_revoked` vaut `true` si l'un des deux appels réussit. Sans refresh token ni Bearer, rien n'est appelé. Les cookies sont toujours effacés et un échec Core n'est que journalisé. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- `POST /auth/forgot_password` compte désormais chaque requête, réussie ou non, dans deux budgets : par IP cliente (si `TRUST_PROXY` est défini et que la requête porte `X-Forwarded-For`) et par adresse e-mail (SHA-256). Le plafond est `AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX`, 10 par fenêtre de 15 minutes par défaut, et une requête mal formée compte aussi comme tentative échouée par IP. Au-delà du plafond, la requête est refusée avec un 429. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Corrections
- Déconnexion avec un JWT expiré : avant, la révocation passait par `POST /api/v1/sessions/revoke`, qui exige un JWT valide ; elle échouait silencieusement, `session_revoked` valait `false` et le refresh token restait valable 30 jours sur Core. Maintenant, le refresh token révoque la session même avec un JWT expiré. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- Mot de passe oublié verrouillable pour toute l'instance : avant, le limiteur de cette route ne comptait que les échecs alors que la route répond toujours 200, et les appels anonymes à Core partaient sans adresse cliente, si bien que 10 requêtes épuisaient les budgets par IP de Core pour tous les utilisateurs. Maintenant chaque requête est comptée, et `X-Forwarded-For` avec l'IP du client est transmis à Core sur les appels anonymes (connexion, Keycloak, mot de passe oublié, réinitialisation, changement forcé, refresh). (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- Journaux : avant, l'erreur brute journalisée (cause axios) pouvait contenir le Bearer token de l'appelant et les corps de requête et de réponse ; maintenant le journal ne contient qu'un résumé (type, statut, code, message), selon la description de la PR, qui indique la montée de `@mairie360/bffs-lib` en 1.2.1. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- CI : `cicd.yml`, `gdpr-pr.yml`, `promote-staging.yml` et `promote-prod.yml` appellent mairie360/CICD v5.2.2, avec `ANTHROPIC_WORKSPACE_ID` transmis ; un test de garde vérifie la version. (MAIR-771, [#287](https://github.com/mairie360/BFF_user/pull/287))
- Stacks de test : images Core API, database et liquibase repassées sur des builds `dev-72dca5b` et `dev-76437e3`, et stacks RGPD (marqueur de logs, simulation d'usage, checklist RGPD des PR) ajoutés pour les contrôles RGPD. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284) ; MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213) ; MAIR-497, [#217](https://github.com/mairie360/BFF_user/pull/217) ; MAIR-295, [#218](https://github.com/mairie360/BFF_user/pull/218))
- Tests d'intégration : collection Postman rejouée par newman sur la stack `docker-compose-integration.yml`, porte `integration_tests` de la promotion staging. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Runtime : `Dockerfile` et `development.Dockerfile` épinglés en Node.js 24.22.1 par digest ; l'image de développement tourne sous l'utilisateur `node`. (MAIR-? , [#275](https://github.com/mairie360/BFF_user/pull/275))
- Dépendances : `@mairie360/bffs-lib` 2.6.0, paquets TypeScript/ESLint (typescript-eslint 8.72.1, eslint 10.14.0), `dotenv` 18.0.9. ([#276](https://github.com/mairie360/BFF_user/pull/276), [#274](https://github.com/mairie360/BFF_user/pull/274))
- Documentation : versions de CICD et de Node.js mises à jour dans `docs/en/technical.md` et `docs/fr/technical.md`. ([#271](https://github.com/mairie360/BFF_user/pull/271))

## Différence dev → staging (en dev, pas encore en staging)

#### Changements de comportement
- `POST /auth/logout` révoque désormais la session via la route publique de Core `POST /api/v1/auth/logout` quand un refresh token est fourni (body ou cookie `refreshToken`), sans JWT. Avec un Bearer, il appelle aussi `POST /api/v1/sessions/logout` ; `session_revoked` vaut `true` si l'un des deux appels réussit. Sans refresh token ni Bearer, rien n'est appelé. Les cookies sont toujours effacés et un échec Core n'est que journalisé. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- `POST /auth/forgot_password` compte désormais chaque requête, réussie ou non, dans deux budgets : par IP cliente (si `TRUST_PROXY` est défini et que la requête porte `X-Forwarded-For`) et par adresse e-mail (SHA-256). Le plafond est `AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX`, 10 par fenêtre de 15 minutes par défaut, et une requête mal formée compte aussi comme tentative échouée par IP. Au-delà du plafond, la requête est refusée avec un 429. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Corrections
- Déconnexion avec un JWT expiré : avant, la révocation passait par `POST /api/v1/sessions/revoke`, qui exige un JWT valide ; elle échouait silencieusement, `session_revoked` valait `false` et le refresh token restait valable 30 jours sur Core. Maintenant, le refresh token révoque la session même avec un JWT expiré. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- Mot de passe oublié verrouillable pour toute l'instance : avant, le limiteur de cette route ne comptait que les échecs alors que la route répond toujours 200, et les appels anonymes à Core partaient sans adresse cliente, si bien que 10 requêtes épuisaient les budgets par IP de Core pour tous les utilisateurs. Maintenant chaque requête est comptée, et `X-Forwarded-For` avec l'IP du client est transmis à Core sur les appels anonymes (connexion, Keycloak, mot de passe oublié, réinitialisation, changement forcé, refresh). (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- Journaux : avant, l'erreur brute journalisée (cause axios) pouvait contenir le Bearer token de l'appelant et les corps de requête et de réponse ; maintenant le journal ne contient qu'un résumé (type, statut, code, message), selon la description de la PR, qui indique la montée de `@mairie360/bffs-lib` en 1.2.1. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- CI : `cicd.yml`, `gdpr-pr.yml`, `promote-staging.yml` et `promote-prod.yml` appellent mairie360/CICD v5.2.2, avec `ANTHROPIC_WORKSPACE_ID` transmis ; un test de garde vérifie la version. (MAIR-771, [#287](https://github.com/mairie360/BFF_user/pull/287))
- Stacks de test : images Core API, database et liquibase repassées sur des builds `dev-72dca5b` et `dev-76437e3`, et stacks RGPD (marqueur de logs, simulation d'usage, checklist RGPD des PR) ajoutés pour les contrôles RGPD. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284) ; MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213) ; MAIR-497, [#217](https://github.com/mairie360/BFF_user/pull/217) ; MAIR-295, [#218](https://github.com/mairie360/BFF_user/pull/218))
- Tests d'intégration : collection Postman rejouée par newman sur la stack `docker-compose-integration.yml`, porte `integration_tests` de la promotion staging. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Runtime : `Dockerfile` et `development.Dockerfile` épinglés en Node.js 24.22.1 par digest ; l'image de développement tourne sous l'utilisateur `node`. ([#275](https://github.com/mairie360/BFF_user/pull/275))
- Dépendances : `@mairie360/bffs-lib` 2.6.0, paquets TypeScript/ESLint (typescript-eslint 8.72.1, eslint 10.14.0), `dotenv` 18.0.9. ([#276](https://github.com/mairie360/BFF_user/pull/276), [#274](https://github.com/mairie360/BFF_user/pull/274))
- Documentation : versions de CICD et de Node.js mises à jour dans `docs/en/technical.md` et `docs/fr/technical.md`. ([#271](https://github.com/mairie360/BFF_user/pull/271))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
