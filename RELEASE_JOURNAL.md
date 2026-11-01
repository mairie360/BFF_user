# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "64482b760cb613d55ef1fd448fe6b653e19e9881", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-10-23 12:22 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `64482b7` | 2026-10-23 12:22 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Changements de comportement
- Le conteneur de développement (`development.Dockerfile`) tourne désormais sous l'utilisateur `node` (`chown -R node:node /app` puis `USER node`) au lieu de root. ([#275](https://github.com/mairie360/BFF_user/pull/275))

#### Technique
- Les images `Dockerfile` (build et runtime) et `development.Dockerfile` passent de `node:24-alpine` à `node:24.22.1-alpine`, épinglées par digest, et les workflows CI utilisent Node.js 24.22.1 ([#275](https://github.com/mairie360/BFF_user/pull/275)).
- Mise à jour de la dépendance `dotenv` de 18.0.8 à 18.0.9 : la PR ne contient pas de diff, seule la description renvoie au changelog (accepte une valeur vide pour `DOTENV_PATH` avec la CLI) ([#274](https://github.com/mairie360/BFF_user/pull/274)).
- Ajout de la stack de tests d'intégration newman (MAIR-262) : `docker-compose-integration.yml`, `integration_test.sh`, collection Postman `tests/postman/`, test jest de couverture. Elle devient la porte `integration_tests` de la promotion staging, et les workflows passent à mairie360/CICD v4.5.0 ([#273](https://github.com/mairie360/BFF_user/pull/273)).
- Documentation alignée sur mairie360/CICD v4.4.3 (MAIR-612) dans `docs/en/technical.md` et `docs/fr/technical.md` ([#271](https://github.com/mairie360/BFF_user/pull/271)).

## Différence dev → staging (en dev, pas encore en staging)

#### Changements de comportement
- Le conteneur de développement (`development.Dockerfile`) tourne désormais sous l'utilisateur `node` (`chown -R node:node /app` puis `USER node`) au lieu de root. ([#275](https://github.com/mairie360/BFF_user/pull/275))

#### Technique
- Les images `Dockerfile` (build et runtime) et `development.Dockerfile` passent de `node:24-alpine` à `node:24.22.1-alpine`, épinglées par digest, et les workflows CI utilisent Node.js 24.22.1 ([#275](https://github.com/mairie360/BFF_user/pull/275)).
- Mise à jour de la dépendance `dotenv` de 18.0.8 à 18.0.9 : la PR ne contient pas de diff, seule la description renvoie au changelog (accepte une valeur vide pour `DOTENV_PATH` avec la CLI) ([#274](https://github.com/mairie360/BFF_user/pull/274)).
- Ajout de la stack de tests d'intégration newman (MAIR-262) : `docker-compose-integration.yml`, `integration_test.sh`, collection Postman `tests/postman/`, test jest de couverture. Elle devient la porte `integration_tests` de la promotion staging, et les workflows passent à mairie360/CICD v4.5.0 ([#273](https://github.com/mairie360/BFF_user/pull/273)).
- Documentation alignée sur mairie360/CICD v4.4.3 (MAIR-612) dans `docs/en/technical.md` et `docs/fr/technical.md` ([#271](https://github.com/mairie360/BFF_user/pull/271)).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
