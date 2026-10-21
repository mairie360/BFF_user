# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "a78ad89460fa342589ada266d0744af724de0143", "prod": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "prod_tag": "v1.0.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-10-21 09:48 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.0.0 | `0a21926` | — |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `a78ad89` | 2026-10-21 09:48 UTC |

## Ajouté sur main depuis la dernière release prod (v1.0.0)

#### Nouveautés
- Télémétrie OpenTelemetry : traces et métriques HTTP exportées en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT`. Sans cette variable, rien n'est exporté. Nouvelles variables `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` et `OTEL_SDK_DISABLED`. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent du BFF. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))

#### Changements de comportement
- Les routes d'authentification, utilisateur, administration, session et compte documentent désormais une réponse 429 quand Core API atteint sa limite de débit : en-tête `Retry-After` et code d'erreur dans l'enveloppe `ErrorResponse`. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Dépendances : `@mairie360/core-api-openapi` passe à 2.2.0 (MAIR-612, [#269](https://github.com/mairie360/BFF_user/pull/269)). Les images de test (`docker-compose*.yml`) passent aux versions prod : database 3.3.0, core-api 2.2.0. Les fixtures de tests suivent core-api 2.1.0, où `role` est requis sur `AdminUserRow` (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252)).
- CI/CD : mairie360/CICD passe de v4.2.1 à v4.4.3 au fil des PR Renovate (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256), [#262](https://github.com/mairie360/BFF_user/pull/262), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259)). `cicd.yml` ne se déclenche sur push que pour `main`. Les secrets du journal de release sont transmis au workflow réutilisable.
- Promotion : un push sur `main` ne livre que dev. Staging et prod passent par les workflows manuels `promote-staging.yml` et `promote-prod.yml` (MAIR-494, [#266](https://github.com/mairie360/BFF_user/pull/266)).
- Dépendances de dev : `typescript-eslint` et `@typescript-eslint/*` en 8.72.0, `eslint` en 10.13.0 (MAIR-600 et renovate, [#258](https://github.com/mairie360/BFF_user/pull/258), [#253](https://github.com/mairie360/BFF_user/pull/253)). `follow-redirects` en 1.16.1 dans le lockfile pour corriger `npm audit` (MAIR-494, [#266](https://github.com/mairie360/BFF_user/pull/266)).
- Documentation : `docs/en/technical.md`, `docs/fr/technical.md` et `CLAUDE.md` décrivent la télémétrie et la promotion (MAIR-504, MAIR-494, [#271](https://github.com/mairie360/BFF_user/pull/271)).

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- Documentation : `docs/en/technical.md` et `docs/fr/technical.md` citent désormais mairie360/CICD v4.4.3 au lieu de v4.4.0 (MAIR-612, [#271](https://github.com/mairie360/BFF_user/pull/271)).

## Différence staging → prod (en staging, pas encore en prod)

#### Nouveautés
- Télémétrie OpenTelemetry : traces et métriques HTTP exportées en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT`. Sans cette variable, rien n'est exporté. Nouvelles variables `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` et `OTEL_SDK_DISABLED`. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent du BFF. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))

#### Changements de comportement
- Les routes d'authentification, utilisateur, administration, session et compte documentent désormais une réponse 429 quand Core API atteint sa limite de débit : en-tête `Retry-After` et code d'erreur dans l'enveloppe `ErrorResponse`. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Dépendances : `@mairie360/core-api-openapi` passe à 2.2.0 et les images de test (`docker-compose*.yml`) passent aux versions prod : database 3.3.0, core-api 2.2.0 (MAIR-612, [#269](https://github.com/mairie360/BFF_user/pull/269)). Les fixtures de tests suivent core-api 2.1.0, où `role` est requis sur `AdminUserRow` (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252)).
- CI/CD : mairie360/CICD passe de v4.2.1 à v4.4.3 au fil des PR Renovate (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256), [#262](https://github.com/mairie360/BFF_user/pull/262), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259)). `cicd.yml` ne se déclenche sur push que pour `main`. Les secrets du journal de release sont transmis au workflow réutilisable (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256)).
- Promotion : un push sur `main` ne livre que dev. Staging et prod passent par les workflows manuels `promote-staging.yml` et `promote-prod.yml` (MAIR-494, [#266](https://github.com/mairie360/BFF_user/pull/266)).
- Dépendances de dev : `typescript-eslint` et `@typescript-eslint/*` en 8.72.0, `eslint` en 10.13.0 (MAIR-600 et renovate, [#258](https://github.com/mairie360/BFF_user/pull/258), [#253](https://github.com/mairie360/BFF_user/pull/253)). `follow-redirects` en 1.16.1 dans le lockfile pour corriger `npm audit` (MAIR-494, [#266](https://github.com/mairie360/BFF_user/pull/266)).
- Documentation : `docs/en/technical.md`, `docs/fr/technical.md` et `CLAUDE.md` décrivent la télémétrie et la promotion (MAIR-504, MAIR-494, [#271](https://github.com/mairie360/BFF_user/pull/271)).

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
