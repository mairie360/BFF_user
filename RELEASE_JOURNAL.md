# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "prod_tag": "v1.0.0", "staging": "b6b04cf7470d7fd32db46923707789cf008d0dc1", "updated": {"dev": "2026-10-21 09:32 UTC", "staging": "2026-10-20 18:12 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.0.0 | `0a21926` | — |
| staging | — | `b6b04cf` | 2026-10-20 18:12 UTC |
| dev | — | `b754a6c` | 2026-10-21 09:32 UTC |

## Ajouté sur main depuis la dernière release prod (v1.0.0)

#### Nouveautés
- Le BFF exporte des traces et des métriques HTTP en OpenTelemetry (OTLP) vers `OTEL_EXPORTER_OTLP_ENDPOINT`. Sans cette variable, la télémétrie reste désactivée. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent du BFF, jamais d'URL, de query string, d'en-tête, d'identifiant ou d'IP. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))
- Le contrat OpenAPI documente désormais une réponse `429` (limite de débit du Core API, en-tête `Retry-After`) sur les routes d'authentification, d'utilisateur, d'administration, de session et de compte. Le diff étant tronqué, le détail des routes est déduit des fichiers modifiés. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Les paquets `@mairie360/core-api-openapi` passent de `0.0.0-dev-95531e2` à `2.2.0` (MAIR-568, puis MAIR-612). Les stacks de test pointent sur `core-api` 2.2.0 et sur `database` / `liquibase-migrations` 3.3.0 (MAIR-612, [#269](https://github.com/mairie360/BFF_user/pull/269)).
- Le workflow `cicd.yml` ne se déclenche plus que sur `push` vers `main`, ce qui évite le run du tag poussé par l'app de release. Les promotions staging et prod deviennent manuelles via `promote-staging.yml` et `promote-prod.yml` (MAIR-494, [#266](https://github.com/mairie360/BFF_user/pull/266) ; MAIR-612, [#269](https://github.com/mairie360/BFF_user/pull/269)).
- Les secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` sont transmis au workflow CICD pour le journal des releases (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256)).
- Mises à jour de dépendances : `follow-redirects` 1.16.1 dans le lockfile (débloque `npm audit`, [#266](https://github.com/mairie360/BFF_user/pull/266)), `@typescript-eslint/*` 8.72.0 ([#258](https://github.com/mairie360/BFF_user/pull/258)), `eslint` 10.13.0 ([#253](https://github.com/mairie360/BFF_user/pull/253)), et mairie360/CICD passé de v4.2.2 à v4.4.3 en plusieurs PR Renovate ([#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#262](https://github.com/mairie360/BFF_user/pull/262)).

## Différence dev → staging (en dev, pas encore en staging)

#### Changements de comportement
- Un push sur `main` ne lance plus que `release-dev`. Le staging et la prod ne se mettent à jour qu'à la demande, via `gh workflow run promote-staging.yml` puis `promote-prod.yml`. (MAIR-494, [#266](https://github.com/mairie360/BFF_user/pull/266))
- L'environnement dev fait tourner `core-api` 2.2.0 (image `ghcr.io/mairie360/core-api:2.2.0`) au lieu de `staging-b900797` dans `docker-compose.yml`. (MAIR-612, [#269](https://github.com/mairie360/BFF_user/pull/269))

#### Technique
- `cicd.yml` ne se lance que sur `push` vers `main` ; les autres branches gardent leur run `pull_request`. Le workflow CICD est épinglé en v4.4.3. (MAIR-612, [#269](https://github.com/mairie360/BFF_user/pull/269))
- Les workflows de promotion et `renovate.json` (regex `cicd_version`) suivent la même version CICD v4.4.0 ; la documentation FR/EN et `CLAUDE.md` décrivent la promotion. (MAIR-494, [#266](https://github.com/mairie360/BFF_user/pull/266))
- `@mairie360/core-api-openapi` passe à `2.2.0` dans `package.json`, et les stacks de test passent à `database` 3.3.0 et `liquibase-migrations` 3.3.0. (MAIR-612, [#269](https://github.com/mairie360/BFF_user/pull/269))

## Différence staging → prod (en staging, pas encore en prod)

#### Nouveautés
- Le BFF exporte des traces et des métriques HTTP en OpenTelemetry (OTLP) vers `OTEL_EXPORTER_OTLP_ENDPOINT`. Sans cette variable, la télémétrie reste désactivée. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent du BFF. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))
- Le contrat OpenAPI documente désormais une réponse `429` (limite de débit du Core API, en-tête `Retry-After`) sur les routes d'authentification, d'utilisateur, d'administration, de session et de compte. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Les stacks de test passent à `core-api` `staging-b900797` puis à `@mairie360/core-api-openapi` `2.1.0` (MAIR-600, [#264](https://github.com/mairie360/BFF_user/pull/264) ; MAIR-575, [#261](https://github.com/mairie360/BFF_user/pull/261) ; MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252)). Dans le contrat 2.1.0, `role` devient obligatoire sur `AdminUserRow`, ce qui ne touche que les fixtures de test.
- Mises à jour de CI et de dépendances : `cicd.yml` passe de v4.2.2 à v4.3.2 (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256) pour les secrets du journal), `@typescript-eslint/*` 8.72.0 ([#258](https://github.com/mairie360/BFF_user/pull/258)), `eslint` 10.13.0 ([#253](https://github.com/mairie360/BFF_user/pull/253)). Les versions CICD v4.3.0 à v4.3.2 viennent des PR Renovate [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259) et [#262](https://github.com/mairie360/BFF_user/pull/262).
- Le journal des releases de CICD exige les secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK`, désormais transmis par `cicd.yml` (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256)).

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-21 09:32 UTC | dev | — | `b754a6c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39577314349) |
| 2026-10-21 01:39 UTC | dev | — | `b134edd` | [run](https://github.com/mairie360/BFF_user/actions/runs/39528066253) |
| 2026-10-20 18:12 UTC | staging | — | `b6b04cf` | [run](https://github.com/mairie360/BFF_user/actions/runs/39470049349) |
| 2026-10-20 17:57 UTC | dev | — | `b6b04cf` | [run](https://github.com/mairie360/BFF_user/actions/runs/39470049349) |
| 2026-10-20 13:04 UTC | dev | — | `699a1ef` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426669559) |
| 2026-10-20 13:02 UTC | dev | — | `848097d` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426619527) |
| 2026-10-19 20:26 UTC | dev | — | `b6d118c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39318019880) |
| 2026-10-19 20:15 UTC | dev | — | `05cc9d3` | [run](https://github.com/mairie360/BFF_user/actions/runs/39316541683) |
<!-- release-journal-history:end -->
