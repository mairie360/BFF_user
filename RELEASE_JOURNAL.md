# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "699a1ef8ebbf14878ebfe4ac4b4cca4543793118", "prod": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "prod_tag": "v1.0.0", "staging": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "updated": {"dev": "2026-10-20 13:04 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.0.0 | `0a21926` | — |
| staging | — | `0a21926` | — |
| dev | — | `699a1ef` | 2026-10-20 13:04 UTC |

## Ajouté sur main depuis la dernière release prod (v1.0.0)

#### Nouveautés
- Le BFF émet désormais de la télémétrie OpenTelemetry (service `bff-user`). Il exporte en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` des traces (span serveur nommé d'après la route, spans des handlers, appels à l'API amont propageant `traceparent`) et des métriques HTTP. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sortent du BFF : jamais d'URL, de query string, d'en-tête, d'identifiant ni d'IP. La télémétrie reste désactivée si la variable n'est pas définie ou avec `OTEL_SDK_DISABLED=true`. `OTEL_SERVICE_NAME` et `OTEL_RESOURCE_ATTRIBUTES` permettent de fixer le nom du service, `service.version` et `deployment.environment.name`. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))

#### Changements de comportement
- Le contrat OpenAPI du BFF (`contracts/openapi.json`) documente une réponse `429` sur les routes de connexion, utilisateur, administration, session et compte : quand la limite de débit de la Core API est atteinte, le BFF répond `429` avec l'enveloppe `ErrorResponse` et un en-tête `Retry-After` (en secondes). Le diff étant tronqué, le détail des modifications de `src/routes/*` n'est pas visible. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Contrat `@mairie360/core-api-openapi` passé à `2.1.0` (fixtures de test adaptées au champ `role` désormais obligatoire sur `AdminUserRow`, sans changement de la réponse du BFF), puis à `0.0.0-dev-30d9bb5`. L'image `core-api` des stacks de test passe à `dev-30d9bb5`. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252) ; MAIR-575, [#261](https://github.com/mairie360/BFF_user/pull/261))
- CI et outillage, 7 commits :
  - workflow `mairie360/CICD` monté de v4.2.1 à v4.3.2 ([#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#262](https://github.com/mairie360/BFF_user/pull/262)) ;
  - transmission des secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` pour le journal des releases (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256)) ;
  - mises à jour de `eslint` 10.13.0 et `typescript-eslint` 8.72.0 ([#253](https://github.com/mairie360/BFF_user/pull/253), [#258](https://github.com/mairie360/BFF_user/pull/258)).

## Différence dev → staging (en dev, pas encore en staging)

#### Nouveautés
- Le BFF émet désormais de la télémétrie OpenTelemetry (service `bff-user`). Il exporte en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` des traces (span serveur nommé d'après la route, spans des handlers, appels à l'API amont propageant `traceparent`) et des métriques HTTP. Seuls la méthode, le statut, la route paramétrée et l'hôte appelé sortent du BFF : jamais d'URL, de query string, d'en-tête, d'identifiant ni d'IP. La télémétrie reste désactivée si la variable n'est pas définie ou avec `OTEL_SDK_DISABLED=true`. `OTEL_SERVICE_NAME` et `OTEL_RESOURCE_ATTRIBUTES` permettent de fixer le nom du service, `service.version` et `deployment.environment.name`. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))

#### Changements de comportement
- Le contrat OpenAPI du BFF (`contracts/openapi.json`) documente une réponse `429` sur les routes de connexion, utilisateur, administration, session et compte : quand la limite de débit de la Core API est atteinte, le BFF répond `429` avec l'enveloppe `ErrorResponse` et un en-tête `Retry-After` (en secondes). Le diff étant tronqué, le détail des modifications de `src/routes/*` n'est pas visible. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Contrat `@mairie360/core-api-openapi` passé à `2.1.0` (fixtures de test adaptées au champ `role` désormais obligatoire sur `AdminUserRow`, sans changement de la réponse du BFF), puis à `0.0.0-dev-30d9bb5`. L'image `core-api` des stacks de test passe à `dev-30d9bb5`. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252) ; MAIR-575, [#261](https://github.com/mairie360/BFF_user/pull/261))
- CI et outillage, 7 commits :
  - workflow `mairie360/CICD` monté de v4.2.1 à v4.3.2 ([#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#262](https://github.com/mairie360/BFF_user/pull/262)) ;
  - transmission des secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` pour le journal des releases (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256)) ;
  - mises à jour de `eslint` 10.13.0 et `typescript-eslint` 8.72.0 ([#253](https://github.com/mairie360/BFF_user/pull/253), [#258](https://github.com/mairie360/BFF_user/pull/258)).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-20 13:04 UTC | dev | — | `699a1ef` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426669559) |
| 2026-10-20 13:02 UTC | dev | — | `848097d` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426619527) |
| 2026-10-19 20:26 UTC | dev | — | `b6d118c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39318019880) |
| 2026-10-19 20:15 UTC | dev | — | `05cc9d3` | [run](https://github.com/mairie360/BFF_user/actions/runs/39316541683) |
<!-- release-journal-history:end -->
