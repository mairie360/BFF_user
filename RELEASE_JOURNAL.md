# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "86a82aecba14830e8ef7dfc29ca7d475d249b261", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-11-01 12:45 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `86a82ae` | 2026-11-01 12:45 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Corrections
- Les journaux d'erreur du BFF ne contiennent plus le token Bearer de l'appelant ni les corps de requête et de réponse. Avant : le gestionnaire d'erreurs par défaut et `checkApis` journalisaient l'erreur brute, dont la `cause` axios contenait ces valeurs. Maintenant : `describeError` ne journalise que le type, le statut, le code et le message. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Tests d'intégration sur stack réelle : `docker-compose-integration.yml`, `integration_test.sh` et une collection Postman de 73 requêtes rejouée par newman. Ils sont devenus la porte `integration_tests` de la promotion staging, avec CICD v4.5.0. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Contrôles RGPD : simulation d'usage en stack de test (`gdpr-simulation.yaml`, `gdpr_simulation_test.sh`) et checklist RGPD obligatoire sur les PR (`gdpr-pr.yml`). (MAIR-497, [#217](https://github.com/mairie360/BFF_user/pull/217) ; MAIR-295, [#218](https://github.com/mairie360/BFF_user/pull/218))
- Node.js passe à 24.22.1, épinglé par digest dans `Dockerfile`, `development.Dockerfile` et les CI. L'image de développement tourne désormais avec l'utilisateur `node`. (MAIR-? non précisé dans la PR, [#275](https://github.com/mairie360/BFF_user/pull/275))
- Mise à jour de dotenv 18.0.8 vers 18.0.9 ; le diff est absent, seule la description de la PR a été lue. ([#274](https://github.com/mairie360/BFF_user/pull/274))
- Documentation : versions CICD v4.4.3 et Node.js alignées dans `docs/en/technical.md` et `docs/fr/technical.md`. (MAIR-612, [#271](https://github.com/mairie360/BFF_user/pull/271))

## Différence dev → staging (en dev, pas encore en staging)

#### Corrections
- Les journaux d'erreur du BFF ne contiennent plus le token Bearer de l'appelant ni les corps de requête et de réponse. Avant : le gestionnaire d'erreurs par défaut et `checkApis` journalisaient l'erreur brute, dont la `cause` axios contenait ces valeurs. Maintenant : `describeError` ne journalise que le type, le statut, le code et le message. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Tests d'intégration sur stack réelle : `docker-compose-integration.yml`, `integration_test.sh` et une collection Postman de 73 requêtes rejouée par newman. Ils sont devenus la porte `integration_tests` de la promotion staging, avec CICD v4.5.0. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Contrôles RGPD : simulation d'usage en stack de test (`gdpr-simulation.yaml`, `gdpr_simulation_test.sh`) et checklist RGPD obligatoire sur les PR (`gdpr-pr.yml`). (MAIR-497, [#217](https://github.com/mairie360/BFF_user/pull/217) ; MAIR-295, [#218](https://github.com/mairie360/BFF_user/pull/218))
- Node.js passe à 24.22.1, épinglé par digest dans `Dockerfile`, `development.Dockerfile` et les CI. L'image de développement tourne désormais avec l'utilisateur `node`. (MAIR-? non précisé dans la PR, [#275](https://github.com/mairie360/BFF_user/pull/275))
- Mise à jour de dotenv 18.0.8 vers 18.0.9 ; le diff est absent, seule la description de la PR a été lue. ([#274](https://github.com/mairie360/BFF_user/pull/274))
- Documentation : versions CICD v4.4.3 et Node.js alignées dans `docs/en/technical.md` et `docs/fr/technical.md`. (MAIR-612, [#271](https://github.com/mairie360/BFF_user/pull/271))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
