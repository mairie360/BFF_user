# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "2ac110014004f23d5da15458698a4053bbcb2334", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-11-01 12:38 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `2ac1100` | 2026-11-01 12:38 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Corrections
- Les journaux d'erreur du BFF ne contiennent plus la valeur reçue. Avant, l'erreur brute était journalisée, et sa cause axios portait le Bearer token de l'appelant ainsi que les corps de requête et de réponse. Maintenant, `describeError(error)` journalise le type, le statut, le code et le message (`@mairie360/bffs-lib` 1.1.0 → 1.2.1). La description de la PR décrit ce changement, mais le `package.json` n'apparaît pas dans le diff visible, donc la bascule de la bibliothèque n'est pas vérifiée. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Test de marqueur RGPD : un compte marqueur traverse le BFF (erreurs volontaires comprises), puis `gdpr_marker_test.sh` cherche ses valeurs dans les journaux de tous les conteneurs. Le job `gdpr_marker` de CICD le lance sur l'image promue. Ajout de règles `.dockerignore` et `.gitignore` pour le rapport. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))
- Node.js passe à 24.22.1 dans la CI, dans les Dockerfiles (images épinglées par digest) et dans la documentation. L'image de développement tourne désormais sous l'utilisateur `node`. Le commentaire du Dockerfile de production annonce le retrait des gestionnaires de paquets de l'image runtime, mais la commande correspondante n'est pas visible dans le diff. (MAIR-... sans clé, [#275](https://github.com/mairie360/BFF_user/pull/275))
- Mise à jour de `dotenv` 18.0.8 → 18.0.9 : la CLI accepte un `DOTENV_PATH` vide. ([#274](https://github.com/mairie360/BFF_user/pull/274))
- Tests d'intégration sur stack réelle (MAIR-262) : `docker-compose-integration.yml`, collection newman de 73 requêtes rejouée contre le BFF, et porte `integration_tests` qui bloque la promotion staging en cas d'échec. Les workflows de promotion et `cicd.yml` sont épinglés sur mairie360/CICD v4.5.0. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Documentation : la version de CICD citée passe de v4.4.0 à v4.4.3 (MAIR-612, [#271](https://github.com/mairie360/BFF_user/pull/271))

## Différence dev → staging (en dev, pas encore en staging)

#### Corrections
- Les journaux d'erreur du BFF ne contiennent plus la valeur reçue. Avant, l'erreur brute était journalisée, et sa cause axios portait le Bearer token de l'appelant ainsi que les corps de requête et de réponse. Maintenant, `describeError(error)` journalise le type, le statut, le code et le message (`@mairie360/bffs-lib` 1.1.0 → 1.2.1). La description de la PR décrit ce changement, mais le `package.json` n'apparaît pas dans le diff visible, donc la bascule de la bibliothèque n'est pas vérifiée. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Test de marqueur RGPD : un compte marqueur traverse le BFF (erreurs volontaires comprises), puis `gdpr_marker_test.sh` cherche ses valeurs dans les journaux de tous les conteneurs. Le job `gdpr_marker` de CICD le lance sur l'image promue. Ajout de règles `.dockerignore` et `.gitignore` pour le rapport. (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))
- Node.js passe à 24.22.1 dans la CI, dans les Dockerfiles (images épinglées par digest) et dans la documentation. L'image de développement tourne désormais sous l'utilisateur `node`. Le commentaire du Dockerfile de production annonce le retrait des gestionnaires de paquets de l'image runtime, mais la commande correspondante n'est pas visible dans le diff. (MAIR-... sans clé, [#275](https://github.com/mairie360/BFF_user/pull/275))
- Mise à jour de `dotenv` 18.0.8 → 18.0.9 : la CLI accepte un `DOTENV_PATH` vide. ([#274](https://github.com/mairie360/BFF_user/pull/274))
- Tests d'intégration sur stack réelle (MAIR-262) : `docker-compose-integration.yml`, collection newman de 73 requêtes rejouée contre le BFF, et porte `integration_tests` qui bloque la promotion staging en cas d'échec. Les workflows de promotion et `cicd.yml` sont épinglés sur mairie360/CICD v4.5.0. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Documentation : la version de CICD citée passe de v4.4.0 à v4.4.3 (MAIR-612, [#271](https://github.com/mairie360/BFF_user/pull/271))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
