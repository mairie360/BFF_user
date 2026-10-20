# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "b6b04cf7470d7fd32db46923707789cf008d0dc1", "prod": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "prod_tag": "v1.0.0", "staging": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "updated": {"dev": "2026-10-20 17:57 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.0.0 | `0a21926` | — |
| staging | — | `0a21926` | — |
| dev | — | `b6b04cf` | 2026-10-20 17:57 UTC |

## Ajouté sur main depuis la dernière release prod (v1.0.0)

#### Nouveautés
- Le BFF exporte en OTLP des traces (span serveur nommé d'après la route, spans des handlers, appels amont avec `traceparent`) et des métriques HTTP vers `OTEL_EXPORTER_OTLP_ENDPOINT`, sous le nom de service `bff-user`. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sont exportés : jamais d'URL, de query string, d'en-tête, d'identifiant ni d'IP. La télémétrie est désactivée si `OTEL_EXPORTER_OTLP_ENDPOINT` n'est pas défini ou si `OTEL_SDK_DISABLED=true`. `OTEL_SERVICE_NAME` et `OTEL_RESOURCE_ATTRIBUTES` permettent d'ajuster le nom du service et les attributs de ressource. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))

#### Changements de comportement
- Le contrat OpenAPI du BFF (`contracts/openapi.json`) documente désormais une réponse `429` (`ErrorResponse`) sur les routes de connexion, utilisateur, administration, session et compte : elle est renvoyée quand la limite de débit de la Core API est atteinte, et le client doit réessayer après le délai indiqué par l'en-tête `Retry-After` (en secondes). Le diff étant tronqué, seule la documentation du contrat est confirmée. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Le contrat `@mairie360/core-api-openapi` passe de `0.0.0-dev-95531e2` à `2.1.0`, puis à `0.0.0-dev-30d9bb5`, puis à `0.0.0-staging.b900797`. L'image `core-api` des stacks de test docker-compose suit la même progression jusqu'à `staging-b900797`. Côté core-api 2.1.0, `role` devient obligatoire sur `AdminUserRow`, mais la réponse du BFF ne change pas. (MAIR-568, MAIR-575, MAIR-600, [#252](https://github.com/mairie360/BFF_user/pull/252), [#261](https://github.com/mairie360/BFF_user/pull/261), [#264](https://github.com/mairie360/BFF_user/pull/264))
- CI et outillage, sans effet visible :
  - 4 montées du workflow `mairie360/CICD` (`v4.2.1` → `v4.3.2`) ([#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#262](https://github.com/mairie360/BFF_user/pull/262)) ;
  - transmission des secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` pour le journal des releases (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256)) ;
  - 2 mises à jour de dépendances de développement : `eslint` 10.13.0 et `typescript-eslint` 8.72.0 ([#253](https://github.com/mairie360/BFF_user/pull/253), [#258](https://github.com/mairie360/BFF_user/pull/258)).

## Différence dev → staging (en dev, pas encore en staging)

#### Nouveautés
- Le BFF exporte en OTLP des traces (span serveur nommé d'après la route, spans des handlers, appels amont avec `traceparent`) et des métriques HTTP vers `OTEL_EXPORTER_OTLP_ENDPOINT`, sous le nom de service `bff-user`. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sont exportés : jamais d'URL, de query string, d'en-tête, d'identifiant ni d'IP. La télémétrie est désactivée si `OTEL_EXPORTER_OTLP_ENDPOINT` n'est pas défini ou si `OTEL_SDK_DISABLED=true`. `OTEL_SERVICE_NAME` et `OTEL_RESOURCE_ATTRIBUTES` permettent d'ajuster le nom du service et les attributs de ressource. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))

#### Changements de comportement
- Le contrat OpenAPI du BFF (`contracts/openapi.json`) documente désormais une réponse `429` (`ErrorResponse`) sur les routes de connexion, utilisateur, administration, session et compte : elle est renvoyée quand la limite de débit de la Core API est atteinte, et le client doit réessayer après le délai indiqué par l'en-tête `Retry-After` (en secondes). Le diff étant tronqué, seule la documentation du contrat est confirmée. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Le contrat `@mairie360/core-api-openapi` passe de `0.0.0-dev-95531e2` à `2.1.0`, puis à `0.0.0-dev-30d9bb5`, puis à `0.0.0-staging.b900797`. L'image `core-api` des stacks de test docker-compose suit la même progression jusqu'à `staging-b900797`. Côté core-api 2.1.0, `role` devient obligatoire sur `AdminUserRow`, mais la réponse du BFF ne change pas. (MAIR-568, MAIR-575, MAIR-600, [#252](https://github.com/mairie360/BFF_user/pull/252), [#261](https://github.com/mairie360/BFF_user/pull/261), [#264](https://github.com/mairie360/BFF_user/pull/264))
- CI et outillage, sans effet visible :
  - 4 montées du workflow `mairie360/CICD` (`v4.2.1` → `v4.3.2`) ([#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#262](https://github.com/mairie360/BFF_user/pull/262)) ;
  - transmission des secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` pour le journal des releases (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256)) ;
  - 2 mises à jour de dépendances de développement : `eslint` 10.13.0 et `typescript-eslint` 8.72.0 ([#253](https://github.com/mairie360/BFF_user/pull/253), [#258](https://github.com/mairie360/BFF_user/pull/258)).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-20 17:57 UTC | dev | — | `b6b04cf` | [run](https://github.com/mairie360/BFF_user/actions/runs/39470049349) |
| 2026-10-20 13:04 UTC | dev | — | `699a1ef` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426669559) |
| 2026-10-20 13:02 UTC | dev | — | `848097d` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426619527) |
| 2026-10-19 20:26 UTC | dev | — | `b6d118c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39318019880) |
| 2026-10-19 20:15 UTC | dev | — | `05cc9d3` | [run](https://github.com/mairie360/BFF_user/actions/runs/39316541683) |
<!-- release-journal-history:end -->
