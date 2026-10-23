# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "7a4bbf9bc8c938de7e23d84482d5f504674186bb", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-10-23 02:58 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `7a4bbf9` | 2026-10-23 02:58 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Technique
- Tests d'intégration de la BFF (MAIR-262) : ajout de `docker-compose-integration.yml` et `integration_test.sh`, qui rejouent `tests/postman/collection.json` contre l'API Core publiée. Aucun changement de comportement de la BFF dans ce lot. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Mise à jour de `dotenv` vers 18.0.9 (renovate). Le changement amont ne touche que la CLI (`DOTENV_PATH` vide), sans effet visible sur l'API. ([#274](https://github.com/mairie360/BFF_user/pull/274))
- `cicd.yml`, `promote-staging.yml` et `promote-prod.yml` pinnés sur mairie360/CICD v4.5.0 (au lieu de v4.4.3). Documentation alignée sur v4.4.3 (MAIR-612, [#271](https://github.com/mairie360/BFF_user/pull/271)).

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- Le job `integration_tests` de la promotion vers staging (`promote-staging.yml`, `integration/bffs` de mairie360/CICD v4.5.0) rejoue désormais la collection newman contre l'image `dev-<sha>` ; un échec bloque la promotion. Ce lot n'ajoute pas de changement fonctionnel dans l'API ou le BFF. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Mise à jour de `dotenv` vers 18.0.9, qui ne touche que la CLI. ([#274](https://github.com/mairie360/BFF_user/pull/274))
- Pin de mairie360/CICD passé à v4.5.0 dans les trois workflows, documentation alignée sur v4.4.3. ([#271](https://github.com/mairie360/BFF_user/pull/271))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
