# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "prod_tag": "v1.0.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-10-21 09:32 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.0.0 | `0a21926` | — |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `b754a6c` | 2026-10-21 09:32 UTC |

## Ajouté sur main depuis la dernière release prod (v1.0.0)

#### Nouveautés

- Le contrat OpenAPI (`contracts/openapi.json`, `contracts/bff.d.ts`) documente désormais une réponse `429` sur les routes d'authentification, utilisateur, administration, session et compte : limite de débit du Core API atteinte, avec l'en-tête `Retry-After` (en secondes) et l'enveloppe d'erreur habituelle. Le diff tronqué ne permet pas de vérifier les modifications de `src/routes/*.ts` ; ce changement de contrat ne couvre que la documentation vérifiée. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique

- Pins de release : `@mairie360/core-api-openapi` passe de 2.1.0 à `0.0.0-dev-30d9bb5`, puis `0.0.0-staging.b900797`, puis `2.2.0` (MAIR-575, MAIR-600, MAIR-612, [#261](https://github.com/mairie360/BFF_user/pull/261), [#264](https://github.com/mairie360/BFF_user/pull/264), [#269](https://github.com/mairie360/BFF_user/pull/269)). Les images `core-api` des stacks de test suivent, et `database` / `liquibase-migrations` passent en 3.3.0. Les fixtures de test sont adaptées au rôle unique de `AdminUserRow` (core-api 2.1.0).
- Télémétrie OpenTelemetry (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220)) : `src/telemetry.ts` est importé avant l'application, et les traces et métriques ne sont exportées en OTLP que si `OTEL_EXPORTER_OTLP_ENDPOINT` est défini. Aucun effet sur les réponses de l'API.
- CI/CD : `mairie360/CICD` passe de v4.2.2 à v4.4.3 au fil des PR Renovate et de MAIR-612 ([#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#262](https://github.com/mairie360/BFF_user/pull/262), [#269](https://github.com/mairie360/BFF_user/pull/269)). MAIR-571 transmet `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` au workflow réutilisable ([#256](https://github.com/mairie360/BFF_user/pull/256)). MAIR-494 sépare la promotion : un push sur `main` ne lance plus que `release-dev`, et staging comme prod passent par les workflows manuels `promote-staging.yml` et `promote-prod.yml` ([#266](https://github.com/mairie360/BFF_user/pull/266)). `cicd.yml` ne se déclenche plus que sur push vers `main` ([#269](https://github.com/mairie360/BFF_user/pull/269)).
- Dépendances : `@typescript-eslint/*` et `typescript-eslint` passent de 8.71.2 à 8.72.0 ([#258](https://github.com/mairie360/BFF_user/pull/258)), `eslint` de 10.12.0 à 10.13.0 ([#253](https://github.com/mairie360/BFF_user/pull/253)), et `follow-redirects` 1.16.1 entre dans le lockfile pour débloquer `npm audit` ([#266](https://github.com/mairie360/BFF_user/pull/266)).
- Documentation : `docs/fr/technical.md`, `docs/en/technical.md` et `CLAUDE.md` décrivent la promotion, la télémétrie et les variables `OTEL_*` ([#220](https://github.com/mairie360/BFF_user/pull/220), [#266](https://github.com/mairie360/BFF_user/pull/266)).

## Différence dev → staging (en dev, pas encore en staging)

_Rien._

## Différence staging → prod (en staging, pas encore en prod)

#### Nouveautés

- Le contrat OpenAPI (`contracts/openapi.json`, `contracts/bff.d.ts`) documente désormais une réponse `429` sur les routes d'authentification, utilisateur, administration, session et compte : limite de débit du Core API atteinte, avec l'en-tête `Retry-After` (en secondes) et l'enveloppe d'erreur habituelle. Le diff tronqué ne permet pas de vérifier les modifications de `src/routes/*.ts` ; ce changement de contrat ne couvre que la documentation vérifiée. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique

- Pins de release : `@mairie360/core-api-openapi` passe de 2.1.0 à `0.0.0-dev-30d9bb5`, puis `0.0.0-staging.b900797`, puis `2.2.0` (MAIR-575, MAIR-600, MAIR-612, [#261](https://github.com/mairie360/BFF_user/pull/261), [#264](https://github.com/mairie360/BFF_user/pull/264), [#269](https://github.com/mairie360/BFF_user/pull/269)). Les images `core-api` des stacks de test suivent, et `database` / `liquibase-migrations` passent en 3.3.0. Les fixtures de test sont adaptées au rôle unique de `AdminUserRow` (core-api 2.1.0).
- Télémétrie OpenTelemetry (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220)) : `src/telemetry.ts` est importé avant l'application, et les traces et métriques ne sont exportées en OTLP que si `OTEL_EXPORTER_OTLP_ENDPOINT` est défini. Aucun effet sur les réponses de l'API.
- CI/CD : `mairie360/CICD` passe de v4.2.2 à v4.4.3 au fil des PR Renovate et de MAIR-612 ([#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#262](https://github.com/mairie360/BFF_user/pull/262), [#269](https://github.com/mairie360/BFF_user/pull/269)). MAIR-571 transmet `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` au workflow réutilisable ([#256](https://github.com/mairie360/BFF_user/pull/256)). MAIR-494 sépare la promotion : un push sur `main` ne lance plus que `release-dev`, et staging comme prod passent par les workflows manuels `promote-staging.yml` et `promote-prod.yml` ([#266](https://github.com/mairie360/BFF_user/pull/266)). `cicd.yml` ne se déclenche plus que sur push vers `main` ([#269](https://github.com/mairie360/BFF_user/pull/269)).
- Dépendances : `@typescript-eslint/*` et `typescript-eslint` passent de 8.71.2 à 8.72.0 ([#258](https://github.com/mairie360/BFF_user/pull/258)), `eslint` de 10.12.0 à 10.13.0 ([#253](https://github.com/mairie360/BFF_user/pull/253)), et `follow-redirects` 1.16.1 entre dans le lockfile pour débloquer `npm audit` ([#266](https://github.com/mairie360/BFF_user/pull/266)).
- Documentation : `docs/fr/technical.md`, `docs/en/technical.md` et `CLAUDE.md` décrivent la promotion, la télémétrie et les variables `OTEL_*` ([#220](https://github.com/mairie360/BFF_user/pull/220), [#266](https://github.com/mairie360/BFF_user/pull/266)).

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
