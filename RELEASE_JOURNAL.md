# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "05cc9d37832a37d2e83394f66b36a2ae66bdff5e", "prod": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "prod_tag": "v1.0.0", "staging": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "updated": {"dev": "2026-10-19 20:15 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.0.0 | `0a21926` | — |
| staging | — | `0a21926` | — |
| dev | — | `05cc9d3` | 2026-10-19 20:15 UTC |

## Ajouté sur main depuis la dernière release prod (v1.0.0)

#### Nouveautés
- Le BFF exporte désormais ses traces (span serveur nommé d'après la route, spans des handlers, appels amont portant `traceparent`) et ses métriques HTTP en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT`, sous le nom de service `bff-user`. La télémétrie reste désactivée si cette variable n'est pas définie ou si `OTEL_SDK_DISABLED=true`. `OTEL_SERVICE_NAME` et `OTEL_RESOURCE_ATTRIBUTES` (par ex. `service.version`, `deployment.environment.name`) permettent d'ajuster le nom et les attributs. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sortent du BFF : aucune URL, query string, en-tête, identifiant ou IP. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))

#### Changements de comportement
- Le contrat OpenAPI du BFF (`contracts/openapi.json`, `contracts/bff.d.ts`) documente désormais une réponse `429` (`ErrorResponse` avec en-tête `Retry-After` en secondes) quand la limite de débit de la Core API est atteinte, sur les routes de connexion, utilisateur, administration, session et compte. Le BFF s'appuie maintenant sur `@mairie360/core-api-openapi` 2.1.0, qui rend `role` obligatoire sur `AdminUserRow`. Selon la PR, la réponse du BFF pour les membres de groupe ne change pas. Le diff est tronqué : les ajustements de `src/routes/*` ne sont pas détaillés ici. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Workflow réutilisable `mairie360/CICD` mis à jour de v4.2.1 à v4.3.1, et transmission des secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` pour l'étape de journal des releases. (MAIR-571, [#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#256](https://github.com/mairie360/BFF_user/pull/256))
- Mise à jour de `eslint` en 10.13.0. ([#253](https://github.com/mairie360/BFF_user/pull/253))

## Différence dev → staging (en dev, pas encore en staging)

#### Nouveautés
- Le BFF exporte désormais ses traces (span serveur nommé d'après la route, spans des handlers, appels amont portant `traceparent`) et ses métriques HTTP en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT`, sous le nom de service `bff-user`. La télémétrie reste désactivée si cette variable n'est pas définie ou si `OTEL_SDK_DISABLED=true`. `OTEL_SERVICE_NAME` et `OTEL_RESOURCE_ATTRIBUTES` (par ex. `service.version`, `deployment.environment.name`) permettent d'ajuster le nom et les attributs. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sortent du BFF : aucune URL, query string, en-tête, identifiant ou IP. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))

#### Changements de comportement
- Le contrat OpenAPI du BFF (`contracts/openapi.json`, `contracts/bff.d.ts`) documente désormais une réponse `429` (`ErrorResponse` avec en-tête `Retry-After` en secondes) quand la limite de débit de la Core API est atteinte, sur les routes de connexion, utilisateur, administration, session et compte. Le BFF s'appuie maintenant sur `@mairie360/core-api-openapi` 2.1.0, qui rend `role` obligatoire sur `AdminUserRow`. Selon la PR, la réponse du BFF pour les membres de groupe ne change pas. Le diff est tronqué : les ajustements de `src/routes/*` ne sont pas détaillés ici. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Workflow réutilisable `mairie360/CICD` mis à jour de v4.2.1 à v4.3.1, et transmission des secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` pour l'étape de journal des releases. (MAIR-571, [#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#256](https://github.com/mairie360/BFF_user/pull/256))
- Mise à jour de `eslint` en 10.13.0. ([#253](https://github.com/mairie360/BFF_user/pull/253))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-19 20:15 UTC | dev | — | `05cc9d3` | [run](https://github.com/mairie360/BFF_user/actions/runs/39316541683) |
<!-- release-journal-history:end -->
