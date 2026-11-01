# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "7ce44d2217e901127f690fdbca9162e4b0e5b170", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-11-01 20:09 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `7ce44d2` | 2026-11-01 20:09 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Nouveautés
- `POST /auth/forgot_password` : chaque requête compte désormais dans deux plafonds sur 15 minutes, l'un par IP cliente et l'autre par adresse e-mail (`AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX`, 10 par défaut) ; au-delà, la requête est refusée. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Changements de comportement
- `POST /auth/forgot_password` : une même adresse e-mail ou une même IP cliente ne peut plus déclencher plus de 10 demandes par fenêtre de 15 minutes ; les demandes suivantes sont refusées, même si la réponse habituelle serait un 200 vide. Les requêtes malformées comptent aussi comme tentatives échouées par IP quand `TRUST_PROXY` est défini. Un front qui relance la demande trop souvent doit en tenir compte. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Corrections
- Le « mot de passe oublié » ne peut plus être bloqué pour toute l'instance (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281)). Avant : 10 requêtes anonymes suffisaient à verrouiller la récupération pour tous les utilisateurs pendant 15 minutes, car les appels anonymes vers Core partaient sans adresse du client et le budget par IP de Core était consommé par le pod du BFF. Maintenant : les appels anonymes (connexion, Keycloak, mot de passe oublié et réinitialisation, changement imposé, refresh) transmettent l'IP du client dans `X-Forwarded-For`, et Core compte par client.
- Les journaux d'erreur ne contiennent plus de secrets ni de contenu HTTP (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213)). Avant : l'erreur brute était journalisée, y compris le Bearer token de l'appelant et les corps de requête et de réponse. Maintenant : seuls le type, le statut, le code et le message sont journalisés (`describeError` de `@mairie360/bffs-lib` 1.2.1).

#### Technique
- Dépendances : `@mairie360/bffs-lib` passe à 2.6.0 (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281)) ; mises à jour des outils TypeScript et ESLint ([#276](https://github.com/mairie360/BFF_user/pull/276)) et de `dotenv` en 18.0.9 ([#274](https://github.com/mairie360/BFF_user/pull/274)) ; Node.js 24.22.1 épinglé par digest dans les Dockerfile et la CI, l'image de développement tourne sous l'utilisateur `node` ([#275](https://github.com/mairie360/BFF_user/pull/275)).
- Tests et CI : stack d'intégration newman sur la vraie Core API (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273)), simulation RGPD et test du marqueur de journaux (MAIR-290 et MAIR-497, [#213](https://github.com/mairie360/BFF_user/pull/213), [#217](https://github.com/mairie360/BFF_user/pull/217)), checklist RGPD obligatoire sur les pull requests (MAIR-295, [#218](https://github.com/mairie360/BFF_user/pull/218)) ; description OpenAPI de `/auth/forgot_password` mise à jour ([#281](https://github.com/mairie360/BFF_user/pull/281)) et documentation alignée sur mairie360/CICD v4.4.3 ([#271](https://github.com/mairie360/BFF_user/pull/271)).

## Différence dev → staging (en dev, pas encore en staging)

#### Nouveautés
- `POST /auth/forgot_password` : chaque requête compte désormais dans deux plafonds sur 15 minutes, l'un par IP cliente et l'autre par adresse e-mail (`AUTH_RATE_LIMIT_FORGOT_PASSWORD_MAX`, 10 par défaut) ; au-delà, la requête est refusée. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Changements de comportement
- `POST /auth/forgot_password` : une même adresse e-mail ou une même IP cliente ne peut plus déclencher plus de 10 demandes par fenêtre de 15 minutes ; les demandes suivantes sont refusées, même si la réponse habituelle serait un 200 vide. Les requêtes malformées comptent aussi comme tentatives échouées par IP quand `TRUST_PROXY` est défini. Un front qui relance la demande trop souvent doit en tenir compte. (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281))

#### Corrections
- Le « mot de passe oublié » ne peut plus être bloqué pour toute l'instance (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281)). Avant : 10 requêtes anonymes suffisaient à verrouiller la récupération pour tous les utilisateurs pendant 15 minutes, car les appels anonymes vers Core partaient sans adresse du client et le budget par IP de Core était consommé par le pod du BFF. Maintenant : les appels anonymes (connexion, Keycloak, mot de passe oublié et réinitialisation, changement imposé, refresh) transmettent l'IP du client dans `X-Forwarded-For`, et Core compte par client.
- Les journaux d'erreur ne contiennent plus de secrets ni de contenu HTTP (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213)). Avant : l'erreur brute était journalisée, y compris le Bearer token de l'appelant et les corps de requête et de réponse. Maintenant : seuls le type, le statut, le code et le message sont journalisés (`describeError` de `@mairie360/bffs-lib` 1.2.1).

#### Technique
- Dépendances : `@mairie360/bffs-lib` passe à 2.6.0 (MAIR-679, [#281](https://github.com/mairie360/BFF_user/pull/281)) ; mises à jour des outils TypeScript et ESLint ([#276](https://github.com/mairie360/BFF_user/pull/276)) et de `dotenv` en 18.0.9 ([#274](https://github.com/mairie360/BFF_user/pull/274)) ; Node.js 24.22.1 épinglé par digest dans les Dockerfile et la CI, l'image de développement tourne sous l'utilisateur `node` ([#275](https://github.com/mairie360/BFF_user/pull/275)).
- Tests et CI : stack d'intégration newman sur la vraie Core API (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273)), simulation RGPD et test du marqueur de journaux (MAIR-290 et MAIR-497, [#213](https://github.com/mairie360/BFF_user/pull/213), [#217](https://github.com/mairie360/BFF_user/pull/217)), checklist RGPD obligatoire sur les pull requests (MAIR-295, [#218](https://github.com/mairie360/BFF_user/pull/218)) ; description OpenAPI de `/auth/forgot_password` mise à jour ([#281](https://github.com/mairie360/BFF_user/pull/281)) et documentation alignée sur mairie360/CICD v4.4.3 ([#271](https://github.com/mairie360/BFF_user/pull/271)).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
