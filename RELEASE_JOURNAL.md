# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "848097d88f0c4ef46aa7fceafbf0207f1128248c", "prod": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "prod_tag": "v1.0.0", "staging": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "updated": {"dev": "2026-10-20 13:02 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.0.0 | `0a21926` | — |
| staging | — | `0a21926` | — |
| dev | — | `848097d` | 2026-10-20 13:02 UTC |

## Ajouté sur main depuis la dernière release prod (v1.0.0)

#### Nouveautés
- Le BFF exporte des traces (span serveur nommé d'après la route, spans des handlers, appels à la Core API portant `traceparent`) et des métriques HTTP en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` via `startTelemetry({ serviceName: 'bff-user' })` de `@mairie360/bffs-lib`. Sans cette variable, la télémétrie reste désactivée. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sont exportés, jamais d'URL, de query string, d'en-tête, d'identifiant ni d'IP. `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` et `OTEL_SDK_DISABLED` sont documentés. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))
- Le contrat OpenAPI du BFF (`contracts/openapi.json`, `contracts/bff.d.ts`) documente une réponse `429` (« Core API rate limit reached: retry after the Retry-After header (seconds) », corps `ErrorResponse`) sur les routes de connexion, utilisateur, administration, session et compte. Le diff est tronqué. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Contrat `@mairie360/core-api-openapi` passé de `0.0.0-dev-95531e2` à `2.1.0` (`role` devient obligatoire sur `AdminUserRow`, les fixtures sont adaptées et la réponse du BFF reste inchangée), puis à `0.0.0-dev-30d9bb5`. L'image `core-api` des stacks docker-compose (dev, performance, sécurité) suit en `dev-30d9bb5`. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252) ; MAIR-575, [#261](https://github.com/mairie360/BFF_user/pull/261))
- Workflow `mairie360/CICD` mis à jour de v4.2.1 à v4.3.1 en trois PR, avec transmission des secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` pour le journal des releases. S'y ajoutent les mises à jour d'`eslint` (10.13.0) et de `typescript-eslint` (8.72.0). (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256) ; [#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#253](https://github.com/mairie360/BFF_user/pull/253), [#258](https://github.com/mairie360/BFF_user/pull/258))

## Différence dev → staging (en dev, pas encore en staging)

#### Nouveautés
- Le BFF exporte des traces (span serveur nommé d'après la route, spans des handlers, appels à la Core API portant `traceparent`) et des métriques HTTP en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` via `startTelemetry({ serviceName: 'bff-user' })` de `@mairie360/bffs-lib`. Sans cette variable, la télémétrie reste désactivée. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sont exportés, jamais d'URL, de query string, d'en-tête, d'identifiant ni d'IP. `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` et `OTEL_SDK_DISABLED` sont documentés. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))
- Le contrat OpenAPI du BFF (`contracts/openapi.json`, `contracts/bff.d.ts`) documente une réponse `429` (« Core API rate limit reached: retry after the Retry-After header (seconds) », corps `ErrorResponse`) sur les routes de connexion, utilisateur, administration, session et compte. Le diff est tronqué. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Contrat `@mairie360/core-api-openapi` passé de `0.0.0-dev-95531e2` à `2.1.0` (`role` devient obligatoire sur `AdminUserRow`, les fixtures sont adaptées et la réponse du BFF reste inchangée), puis à `0.0.0-dev-30d9bb5`. L'image `core-api` des stacks docker-compose (dev, performance, sécurité) suit en `dev-30d9bb5`. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252) ; MAIR-575, [#261](https://github.com/mairie360/BFF_user/pull/261))
- Workflow `mairie360/CICD` mis à jour de v4.2.1 à v4.3.1 en trois PR, avec transmission des secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` pour le journal des releases. S'y ajoutent les mises à jour d'`eslint` (10.13.0) et de `typescript-eslint` (8.72.0). (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256) ; [#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#253](https://github.com/mairie360/BFF_user/pull/253), [#258](https://github.com/mairie360/BFF_user/pull/258))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-20 13:02 UTC | dev | — | `848097d` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426619527) |
| 2026-10-19 20:26 UTC | dev | — | `b6d118c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39318019880) |
| 2026-10-19 20:15 UTC | dev | — | `05cc9d3` | [run](https://github.com/mairie360/BFF_user/actions/runs/39316541683) |
<!-- release-journal-history:end -->
