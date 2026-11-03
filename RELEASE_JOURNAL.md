# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "d774f6cf22766808867da6d482c2d7b14df84a80", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-11-03 02:07 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `d774f6c` | 2026-11-03 02:07 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Changements de comportement
- `POST /auth/logout` révoque la session à partir du refresh token, sans JWT valide. Si un refresh token est fourni (corps ou cookie `refreshToken`), le BFF appelle `POST /api/v1/auth/logout` de Core de façon anonyme. Avec une session Bearer, il appelle aussi `POST /api/v1/sessions/logout` ; `session_revoked` vaut `true` si l'un des deux appels réussit. Sans aucun identifiant, rien n'est appelé. Les cookies sont toujours effacés. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- `POST /auth/forgot_password` compte chaque requête, réussie ou non, par IP cliente (si `TRUST_PROXY` est défini et que la requête porte `X-Forwarded-For`) et par adresse e-mail (SHA-256). Le plafond est `AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX`, 10 par fenêtre de 15 minutes par défaut ; au-delà, la requête est refusée. L'IP cliente est relayée à Core dans `X-Forwarded-For` sur les appels anonymes (connexion, Keycloak, mot de passe oublié, réinitialisation, changement imposé, refresh). (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Corrections
- Déconnexion avec un JWT expiré : avant, l'appel à Core échouait (`session_revoked: false`, erreur seulement journalisée) et le refresh token restait valable 30 jours côté Core. Maintenant, le refresh token révoque la session. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- Mot de passe oublié : avant, 10 requêtes anonymes bloquaient la récupération pour toute l'instance pendant 15 minutes, car le budget par IP de Core était consommé par le pod du BFF. Maintenant, la limite s'applique par IP cliente et par e-mail. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- Journaux : avant, l'erreur brute était journalisée, y compris le Bearer token et les corps de requête et de réponse. Maintenant, `describeError` ne journalise que le type, le statut, le code et le message. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Dépendances : épinglage par digest des images et actions GitHub (Renovate, [#285](https://github.com/mairie360/BFF_user/pull/285)), mises à jour TypeScript ([#276](https://github.com/mairie360/BFF_user/pull/276)), dotenv 18.0.9 ([#274](https://github.com/mairie360/BFF_user/pull/274)), `@mairie360/bffs-lib` 2.6.0 ([#281](https://github.com/mairie360/BFF_user/pull/281)), `core-api` et `database` épinglés en `dev-72dca5b` / `dev-76437e3` ([#284](https://github.com/mairie360/BFF_user/pull/284)).
- Node.js 24.22.1 pour la CI, les images Dockerfile et le conteneur de développement, désormais exécuté avec l'utilisateur `node` ([#275](https://github.com/mairie360/BFF_user/pull/275)).
- CI et tests : CICD v5.2.2 avec `ANTHROPIC_WORKSPACE_ID` et test de version ([#287](https://github.com/mairie360/BFF_user/pull/287)), stack d'intégration newman ([#273](https://github.com/mairie360/BFF_user/pull/273)), simulation RGPD ([#217](https://github.com/mairie360/BFF_user/pull/217)), marqueur RGPD ([#213](https://github.com/mairie360/BFF_user/pull/213)), checklist RGPD des PR ([#218](https://github.com/mairie360/BFF_user/pull/218)).
- Documentation : versions CICD alignées ([#271](https://github.com/mairie360/BFF_user/pull/271)) et mise à jour de la doc technique en v5.2.2 ([#287](https://github.com/mairie360/BFF_user/pull/287)).

## Différence dev → staging (en dev, pas encore en staging)

#### Changements de comportement
- `POST /auth/logout` révoque la session à partir du refresh token, sans JWT valide. Si un refresh token est fourni (corps ou cookie `refreshToken`), le BFF appelle `POST /api/v1/auth/logout` de Core de façon anonyme. Avec une session Bearer, il appelle aussi `POST /api/v1/sessions/logout` ; `session_revoked` vaut `true` si l'un des deux appels réussit. Sans aucun identifiant, rien n'est appelé. Les cookies sont toujours effacés. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- `POST /auth/forgot_password` compte chaque requête, réussie ou non, par IP cliente (si `TRUST_PROXY` est défini et que la requête porte `X-Forwarded-For`) et par adresse e-mail (SHA-256). Le plafond est `AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX`, 10 par fenêtre de 15 minutes par défaut ; au-delà, la requête est refusée. L'IP cliente est relayée à Core dans `X-Forwarded-For` sur les appels anonymes (connexion, Keycloak, mot de passe oublié, réinitialisation, changement imposé, refresh). (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Corrections
- Déconnexion avec un JWT expiré : avant, l'appel à Core échouait (`session_revoked: false`, erreur seulement journalisée) et le refresh token restait valable 30 jours côté Core. Maintenant, le refresh token révoque la session. (MAIR-692, [#284](https://github.com/mairie360/BFF_user/pull/284))
- Mot de passe oublié : avant, 10 requêtes anonymes bloquaient la récupération pour toute l'instance pendant 15 minutes, car le budget par IP de Core était consommé par le pod du BFF. Maintenant, la limite s'applique par IP cliente et par e-mail. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))
- Journaux : avant, l'erreur brute était journalisée, y compris le Bearer token et les corps de requête et de réponse. Maintenant, `describeError` ne journalise que le type, le statut, le code et le message. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Dépendances : épinglage par digest des images et actions GitHub (Renovate, [#285](https://github.com/mairie360/BFF_user/pull/285)), mises à jour TypeScript ([#276](https://github.com/mairie360/BFF_user/pull/276)), dotenv 18.0.9 ([#274](https://github.com/mairie360/BFF_user/pull/274)), `@mairie360/bffs-lib` 2.6.0 ([#281](https://github.com/mairie360/BFF_user/pull/281)), `core-api` et `database` épinglés en `dev-72dca5b` / `dev-76437e3` ([#284](https://github.com/mairie360/BFF_user/pull/284)).
- Node.js 24.22.1 pour la CI, les images Dockerfile et le conteneur de développement, désormais exécuté avec l'utilisateur `node` ([#275](https://github.com/mairie360/BFF_user/pull/275)).
- CI et tests : CICD v5.2.2 avec `ANTHROPIC_WORKSPACE_ID` et test de version ([#287](https://github.com/mairie360/BFF_user/pull/287)), stack d'intégration newman ([#273](https://github.com/mairie360/BFF_user/pull/273)), simulation RGPD ([#217](https://github.com/mairie360/BFF_user/pull/217)), marqueur RGPD ([#213](https://github.com/mairie360/BFF_user/pull/213)), checklist RGPD des PR ([#218](https://github.com/mairie360/BFF_user/pull/218)).
- Documentation : versions CICD alignées ([#271](https://github.com/mairie360/BFF_user/pull/271)) et mise à jour de la doc technique en v5.2.2 ([#287](https://github.com/mairie360/BFF_user/pull/287)).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
