# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "b6d118cf32a498a78f09c399b6849054e6931e1f", "prod": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "prod_tag": "v1.0.0", "staging": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "updated": {"dev": "2026-10-19 20:26 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.0.0 | `0a21926` | — |
| staging | — | `0a21926` | — |
| dev | — | `b6d118c` | 2026-10-19 20:26 UTC |

## Ajouté sur main depuis la dernière release prod (v1.0.0)

#### Nouveautés
- Télémétrie OpenTelemetry dans bff-user : les traces (span serveur nommé d'après la route, spans des handlers, appels vers l'API amont portant `traceparent`) et les métriques HTTP sont exportées en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT`. Sans cette variable, ou avec `OTEL_SDK_DISABLED=true`, rien n'est exporté. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sortent du BFF, jamais une URL, une query string, un en-tête, un identifiant ou une IP. Le nom du service (`bff-user` par défaut) et les attributs de ressource se règlent avec `OTEL_SERVICE_NAME` et `OTEL_RESOURCE_ATTRIBUTES`. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))

#### Changements de comportement
- Le contrat OpenAPI du BFF (`contracts/openapi.json`, `contracts/bff.d.ts`) documente désormais une réponse 429 (`ErrorResponse`) quand la limite de débit de Core API est atteinte, avec l'en-tête `Retry-After` en secondes. Elle figure sur les routes de connexion, d'utilisateur, d'administration, de session et de compte. Le diff est tronqué : l'effet exact sur les routes (`src/routes/*.ts`) n'est pas entièrement visible. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Contrat `@mairie360/core-api-openapi` aligné sur sa version prod 2.1.0, avec les fixtures de test adaptées au champ `role` désormais requis. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))
- 5 changements d'outillage sans effet fonctionnel :
  - workflow `mairie360/CICD` passé en v4.2.2, v4.3.0 puis v4.3.1 ([#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259)) ;
  - transmission des secrets du journal des releases (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256)) ;
  - mises à jour de `eslint` 10.13.0 et de typescript-eslint 8.72.0 ([#253](https://github.com/mairie360/BFF_user/pull/253), [#258](https://github.com/mairie360/BFF_user/pull/258)).

## Différence dev → staging (en dev, pas encore en staging)

#### Nouveautés
- Télémétrie OpenTelemetry dans bff-user : les traces (span serveur nommé d'après la route, spans des handlers, appels vers l'API amont portant `traceparent`) et les métriques HTTP sont exportées en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT`. Sans cette variable, ou avec `OTEL_SDK_DISABLED=true`, rien n'est exporté. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sortent du BFF, jamais une URL, une query string, un en-tête, un identifiant ou une IP. Le nom du service (`bff-user` par défaut) et les attributs de ressource se règlent avec `OTEL_SERVICE_NAME` et `OTEL_RESOURCE_ATTRIBUTES`. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))

#### Changements de comportement
- Le contrat OpenAPI du BFF (`contracts/openapi.json`, `contracts/bff.d.ts`) documente désormais une réponse 429 (`ErrorResponse`) quand la limite de débit de Core API est atteinte, avec l'en-tête `Retry-After` en secondes. Elle figure sur les routes de connexion, d'utilisateur, d'administration, de session et de compte. Le diff est tronqué : l'effet exact sur les routes (`src/routes/*.ts`) n'est pas entièrement visible. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Contrat `@mairie360/core-api-openapi` aligné sur sa version prod 2.1.0, avec les fixtures de test adaptées au champ `role` désormais requis. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))
- 5 changements d'outillage sans effet fonctionnel :
  - workflow `mairie360/CICD` passé en v4.2.2, v4.3.0 puis v4.3.1 ([#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259)) ;
  - transmission des secrets du journal des releases (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256)) ;
  - mises à jour de `eslint` 10.13.0 et de typescript-eslint 8.72.0 ([#253](https://github.com/mairie360/BFF_user/pull/253), [#258](https://github.com/mairie360/BFF_user/pull/258)).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-19 20:26 UTC | dev | — | `b6d118c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39318019880) |
| 2026-10-19 20:15 UTC | dev | — | `05cc9d3` | [run](https://github.com/mairie360/BFF_user/actions/runs/39316541683) |
<!-- release-journal-history:end -->
