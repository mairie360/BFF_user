# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "d356c97c75757b84f011c7dad5fb8eef7cc6842f", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-11-01 12:40 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `d356c97` | 2026-11-01 12:40 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Corrections
- Les journaux d'erreur du BFF ne reprennent plus l'erreur brute : avant, l'erreur axios (son `cause`) pouvait écrire dans les journaux le Bearer token de l'appelant ainsi que les corps de requête et de réponse ; maintenant, `errorHandler` et `checkApis` journalisent `describeError(error)` (type, statut, code, message). `@mairie360/bffs-lib` passe de 1.1.0 à 1.2.1. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Ajout d'une checklist RGPD sur les pull requests : le workflow `gdpr-pr.yml` appelle le workflow réutilisable de mairie360/CICD, et la section « Données personnelles » de la description doit être renseignée. (MAIR-295, [#218](https://github.com/mairie360/BFF_user/pull/218))
- Ajout d'un test du marqueur RGPD (`gdpr-marker.yaml`, `docker-compose-gdpr-marker.yml`, `gdpr_marker_test.sh`) qui parcourt le BFF avec un utilisateur marqué puis cherche ses valeurs dans les journaux de chaque conteneur. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))
- Node.js passe à 24.22.1 dans les images `Dockerfile` et `development.Dockerfile` (épinglées par digest) et dans les jobs CI ; l'image de développement tourne désormais sous l'utilisateur `node`. ([#275](https://github.com/mairie360/BFF_user/pull/275))
- Mise à jour de la dépendance `dotenv` de 18.0.8 à 18.0.9, sans changement de code applicatif. ([#274](https://github.com/mairie360/BFF_user/pull/274))
- Ajout de la stack d'intégration (`docker-compose-integration.yml`, `integration_test.sh`) qui rejoue une collection Postman/newman contre la vraie Core API, et d'un test jest qui vérifie la couverture de la collection. Cette stack devient la porte `integration_tests` de la promotion staging ; CICD passe en v4.5.0. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Mise à jour de la documentation technique (versions de mairie360/CICD v4.4.3 en FR et EN). (MAIR-612, [#271](https://github.com/mairie360/BFF_user/pull/271))

## Différence dev → staging (en dev, pas encore en staging)

#### Corrections
- Les journaux d'erreur du BFF ne reprennent plus l'erreur brute : avant, l'erreur axios (son `cause`) pouvait écrire dans les journaux le Bearer token de l'appelant ainsi que les corps de requête et de réponse ; maintenant, `errorHandler` et `checkApis` journalisent `describeError(error)` (type, statut, code, message). `@mairie360/bffs-lib` passe de 1.1.0 à 1.2.1. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Ajout d'une checklist RGPD sur les pull requests : le workflow `gdpr-pr.yml` appelle le workflow réutilisable de mairie360/CICD, et la section « Données personnelles » de la description doit être renseignée. (MAIR-295, [#218](https://github.com/mairie360/BFF_user/pull/218))
- Ajout d'un test du marqueur RGPD (`gdpr-marker.yaml`, `docker-compose-gdpr-marker.yml`, `gdpr_marker_test.sh`) qui parcourt le BFF avec un utilisateur marqué puis cherche ses valeurs dans les journaux de chaque conteneur. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))
- Node.js passe à 24.22.1 dans les images `Dockerfile` et `development.Dockerfile` (épinglées par digest) et dans les jobs CI ; l'image de développement tourne désormais sous l'utilisateur `node`. ([#275](https://github.com/mairie360/BFF_user/pull/275))
- Mise à jour de la dépendance `dotenv` de 18.0.8 à 18.0.9, sans changement de code applicatif. ([#274](https://github.com/mairie360/BFF_user/pull/274))
- Ajout de la stack d'intégration (`docker-compose-integration.yml`, `integration_test.sh`) qui rejoue une collection Postman/newman contre la vraie Core API, et d'un test jest qui vérifie la couverture de la collection. Cette stack devient la porte `integration_tests` de la promotion staging ; CICD passe en v4.5.0. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Mise à jour de la documentation technique (versions de mairie360/CICD v4.4.3 en FR et EN). (MAIR-612, [#271](https://github.com/mairie360/BFF_user/pull/271))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
