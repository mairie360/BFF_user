# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "2ab34b3bd28a50997742d6107116dc0eeb1c15e6", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-11-04 15:15 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `2ab34b3` | 2026-11-04 15:15 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Nouveautés
- `POST /admin/keycloak/console-access` : nouvelle route derrière `requireAdmin`. Elle renvoie `{ url, expires_in }` (lien à usage unique valable 120 s) pour ouvrir la console d'administration Keycloak dans un nouvel onglet, avec `Cache-Control: no-store`. Keycloak demande toujours un compte du realm ayant les rôles `realm-management`, et la console se ferme dès que l'administrateur perd le rôle Admin. Limite de 10 liens par administrateur sur 15 minutes (429 avec `Retry-After`). Une réponse 503 signale que l'accès n'est pas configuré sur l'instance. (MAIR-609, [#292](https://github.com/mairie360/BFF_user/pull/292))

#### Changements de comportement
- Sur `/admin/*`, `/me`, `/session/me` et `/user/*`, les tokens de session sont vérifiés en EdDSA avec la clé publique de Core `JWT_PUBLIC_KEY` (`kid`, `iss` `mairie360-core`, `aud` `mairie360`). Un token HS256 est refusé en 401 sans appel à Core, sauf si `JWT_SECRET` est encore défini (transition). Sans clé de session valide, l'instance ne démarre pas et les routes admin répondent 503. Il faut donc poser `JWT_PUBLIC_KEY` avant déploiement. (MAIR-680, [#290](https://github.com/mairie360/BFF_user/pull/290))
- `POST /auth/forgot_password` : chaque requête est désormais comptée, dans la limite de 10 par fenêtre de 15 minutes par IP cliente et par adresse e-mail (`AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX`). Au-delà, la requête est refusée par le limiteur. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- Tous les appels anonymes du BFF vers Core (connexion, Keycloak, mots de passe, refresh) transmettent l'IP cliente en `X-Forwarded-For`, pour que les budgets par IP de Core comptent le client et non le pod du BFF. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- `POST /auth/logout` : avec un refresh token, appelle `POST /api/v1/auth/logout`, sans JWT. Avec un Bearer, appelle aussi `POST /api/v1/sessions/logout`, les deux en parallèle. `session_revoked` vaut `true` si l'un des deux réussit. Sans refresh token ni Bearer, rien n'est appelé. Les cookies sont toujours effacés. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))

#### Corrections
- Déconnexion avec un JWT expiré (MAIR-692) : avant, `/auth/logout` échouait sans JWT valide, `session_revoked` restait `false` et le refresh token restait valide 30 jours côté Core. Maintenant, le refresh token révoque la session même si le JWT a expiré. ([#284](https://github.com/mairie360/BFF_user/pull/284))
- Limite « mot de passe oublié » (MAIR-679) : avant, 10 requêtes anonymes bloquaient la récupération pour toute l'instance pendant 15 minutes, car la route n'était jamais comptée et les appels partaient du pod du BFF. Maintenant, les requêtes sont comptées par IP et par e-mail, et un client qui inonde le formulaire ne bloque que lui. ([#281](https://github.com/mairie360/BFF_user/pull/281))

#### Technique
- CI/CD et dépendances : workflows sur mairie360/CICD v5.2.2 (#287), Node.js 24.22.1 avec images épinglées par digest et conteneur de dev exécuté en utilisateur `node` (#275, #285), mises à jour Renovate (typescript-eslint 8.72.1, axios 1.21.0, dotenv 18.0.9 dont la PR ne fournit pas de diff).
- Tests et journaux : stack d'intégration newman sur l'image réelle de Core (#273), marqueur RGPD des journaux, simulation RGPD et checklist RGPD des PR (#213, #217, #218), journaux décrits par `describeError` au lieu de l'erreur brute (#213), stacks de test avec `core-api:dev-690f32b`, clés Ed25519 et sans `JWT_SECRET` (#290, #292). Mise à jour de documentation seule (#271).

## Différence dev → staging (en dev, pas encore en staging)

#### Nouveautés
- `POST /admin/keycloak/console-access` : nouvelle route derrière `requireAdmin`. Elle renvoie `{ url, expires_in }` (lien à usage unique valable 120 s) pour ouvrir la console d'administration Keycloak dans un nouvel onglet, avec `Cache-Control: no-store`. Keycloak demande toujours un compte du realm ayant les rôles `realm-management`, et la console se ferme dès que l'administrateur perd le rôle Admin. Limite de 10 liens par administrateur sur 15 minutes (429 avec `Retry-After`). Une réponse 503 signale que l'accès n'est pas configuré sur l'instance. (MAIR-609, [#292](https://github.com/mairie360/BFF_user/pull/292))

#### Changements de comportement
- Sur `/admin/*`, `/me`, `/session/me` et `/user/*`, les tokens de session sont vérifiés en EdDSA avec la clé publique de Core `JWT_PUBLIC_KEY` (`kid`, `iss` `mairie360-core`, `aud` `mairie360`). Un token HS256 est refusé en 401 sans appel à Core, sauf si `JWT_SECRET` est encore défini (transition). Sans clé de session valide, l'instance ne démarre pas et les routes admin répondent 503. Il faut donc poser `JWT_PUBLIC_KEY` avant déploiement. (MAIR-680, [#290](https://github.com/mairie360/BFF_user/pull/290))
- `POST /auth/forgot_password` : chaque requête est désormais comptée, dans la limite de 10 par fenêtre de 15 minutes par IP cliente et par adresse e-mail (`AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX`). Au-delà, la requête est refusée par le limiteur. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- Tous les appels anonymes du BFF vers Core (connexion, Keycloak, mots de passe, refresh) transmettent l'IP cliente en `X-Forwarded-For`, pour que les budgets par IP de Core comptent le client et non le pod du BFF. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- `POST /auth/logout` : avec un refresh token, appelle `POST /api/v1/auth/logout`, sans JWT. Avec un Bearer, appelle aussi `POST /api/v1/sessions/logout`, les deux en parallèle. `session_revoked` vaut `true` si l'un des deux réussit. Sans refresh token ni Bearer, rien n'est appelé. Les cookies sont toujours effacés. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))

#### Corrections
- Déconnexion avec un JWT expiré (MAIR-692) : avant, `/auth/logout` échouait sans JWT valide, `session_revoked` restait `false` et le refresh token restait valide 30 jours côté Core. Maintenant, le refresh token révoque la session même si le JWT a expiré. ([#284](https://github.com/mairie360/BFF_user/pull/284))
- Limite « mot de passe oublié » (MAIR-679) : avant, 10 requêtes anonymes bloquaient la récupération pour toute l'instance pendant 15 minutes, car la route n'était jamais comptée et les appels partaient du pod du BFF. Maintenant, les requêtes sont comptées par IP et par e-mail, et un client qui inonde le formulaire ne bloque que lui. ([#281](https://github.com/mairie360/BFF_user/pull/281))

#### Technique
- CI/CD et dépendances : workflows sur mairie360/CICD v5.2.2 (#287), Node.js 24.22.1 avec images épinglées par digest et conteneur de dev exécuté en utilisateur `node` (#275, #285), mises à jour Renovate (typescript-eslint 8.72.1, axios 1.21.0, dotenv 18.0.9 dont la PR ne fournit pas de diff).
- Tests et journaux : stack d'intégration newman sur l'image réelle de Core (#273), marqueur RGPD des journaux, simulation RGPD et checklist RGPD des PR (#213, #217, #218), journaux décrits par `describeError` au lieu de l'erreur brute (#213), stacks de test avec `core-api:dev-690f32b`, clés Ed25519 et sans `JWT_SECRET` (#290, #292). Mise à jour de documentation seule (#271).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-11-04 15:15 UTC | dev | — | `2ab34b3` | [run](https://github.com/mairie360/BFF_user/actions/runs/41854314320) |
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
