# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "48b4a654d223e3e21019854cbbd907fd0a987abc", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-10-22 09:08 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `48b4a65` | 2026-10-22 09:08 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Technique
- Ajout d'une suite de tests d'intégration sur stack réel : `./integration_test.sh` lance `docker-compose-integration.yml`, où newman rejoue `tests/postman/collection.json` contre le BFF et l'API Core publiée. La collection couvre les parcours de compte et la résolution de session, et `tests/integration-collection.test.ts` vérifie qu'chaque opération de `contracts/openapi.json` a au moins une requête. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Passage de mairie360/CICD de v4.4.3 à v4.5.0 dans `cicd.yml`, `promote-staging.yml` et `promote-prod.yml`. La promotion staging exécute désormais le gate `integration_tests` sur l'image `dev-<sha>`. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Documentation : version CI/CD alignée sur v4.4.3 dans `docs/en/technical.md` et `docs/fr/technical.md`. (MAIR-612, [#271](https://github.com/mairie360/BFF_user/pull/271))
- Les diffs visibles ne modifient ni route, ni réponse, ni base de données. Le diff de #273 est tronqué, donc cette absence n'est pas vérifiée sur la totalité du diff.

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- Ajout d'une suite de tests d'intégration sur stack réel : `./integration_test.sh` lance `docker-compose-integration.yml`, où newman rejoue `tests/postman/collection.json` contre le BFF et l'API Core publiée. La collection couvre les parcours de compte et la résolution de session, et `tests/integration-collection.test.ts` vérifie qu'chaque opération de `contracts/openapi.json` a au moins une requête. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Passage de mairie360/CICD de v4.4.3 à v4.5.0 dans `cicd.yml`, `promote-staging.yml` et `promote-prod.yml`. Le gate `integration_tests` de la promotion staging s'appliquera à partir de cette version. (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273))
- Documentation : version CI/CD alignée sur v4.4.3 dans `docs/en/technical.md` et `docs/fr/technical.md`. (MAIR-612, [#271](https://github.com/mairie360/BFF_user/pull/271))
- Les diffs visibles ne modifient ni route, ni réponse, ni base de données. Le diff de #273 est tronqué, donc cette absence n'est pas vérifiée sur la totalité du diff.

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
