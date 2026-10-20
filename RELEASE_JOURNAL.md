# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "b6b04cf7470d7fd32db46923707789cf008d0dc1", "prod": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "prod_tag": "v1.0.0", "staging": "b6b04cf7470d7fd32db46923707789cf008d0dc1", "updated": {"dev": "2026-10-20 17:57 UTC", "staging": "2026-10-20 18:12 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.0.0 | `0a21926` | — |
| staging | — | `b6b04cf` | 2026-10-20 18:12 UTC |
| dev | — | `b6b04cf` | 2026-10-20 17:57 UTC |

## Ajouté sur main depuis la dernière release prod (v1.0.0)

#### Nouveautés
- Le BFF exporte des traces et des métriques HTTP OpenTelemetry en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` (service `bff-user`, surchargeable par `OTEL_SERVICE_NAME`). La télémétrie est désactivée si la variable n'est pas définie ou si `OTEL_SDK_DISABLED=true`. Seuls sortent la méthode, le statut, la route paramétrée et l'hôte appelé, jamais une URL, une query string, un en-tête, un identifiant ou une IP. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))
- Le contrat OpenAPI du BFF (`contracts/openapi.json`) documente une réponse 429 (`ErrorResponse`, réessayer après l'en-tête `Retry-After`) quand la limite de débit de Core API est atteinte, sur les routes de connexion, utilisateur, administration, session et compte. Le diff de cette PR est tronqué. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- `@mairie360/core-api-openapi` passe de `0.0.0-dev-95531e2` à `2.1.0`, puis à `0.0.0-dev-30d9bb5`, puis à `0.0.0-staging.b900797`. L'image `core-api` des stacks docker-compose (dev, sécurité, performance) passe à `staging-b900797`. Selon les PR, le contrat est inchangé et la réponse du BFF reste identique. (MAIR-568, MAIR-575, MAIR-600, [#252](https://github.com/mairie360/BFF_user/pull/252), [#261](https://github.com/mairie360/BFF_user/pull/261), [#264](https://github.com/mairie360/BFF_user/pull/264))
- Sept changements sans effet visible : le workflow `mairie360/CICD` passe de v4.2.1 à v4.3.2 en quatre mises à jour, le workflow reçoit les secrets du journal des releases (MAIR-571), et `eslint` ainsi que `typescript-eslint` sont mis à jour. ([#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#262](https://github.com/mairie360/BFF_user/pull/262), [#256](https://github.com/mairie360/BFF_user/pull/256), [#253](https://github.com/mairie360/BFF_user/pull/253), [#258](https://github.com/mairie360/BFF_user/pull/258))

## Différence dev → staging (en dev, pas encore en staging)

_Rien._

## Différence staging → prod (en staging, pas encore en prod)

#### Nouveautés
- Le BFF exporte des traces et des métriques HTTP OpenTelemetry en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` (service `bff-user`, surchargeable par `OTEL_SERVICE_NAME`). La télémétrie est désactivée si la variable n'est pas définie ou si `OTEL_SDK_DISABLED=true`. Seuls sortent la méthode, le statut, la route paramétrée et l'hôte appelé, jamais une URL, une query string, un en-tête, un identifiant ou une IP. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))
- Le contrat OpenAPI du BFF (`contracts/openapi.json`) documente une réponse 429 (`ErrorResponse`, réessayer après l'en-tête `Retry-After`) quand la limite de débit de Core API est atteinte, sur les routes de connexion, utilisateur, administration, session et compte. Le diff de cette PR est tronqué. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- `@mairie360/core-api-openapi` passe de `0.0.0-dev-95531e2` à `2.1.0`, puis à `0.0.0-dev-30d9bb5`, puis à `0.0.0-staging.b900797`. L'image `core-api` des stacks docker-compose (dev, sécurité, performance) passe à `staging-b900797`. Selon les PR, le contrat est inchangé et la réponse du BFF reste identique. (MAIR-568, MAIR-575, MAIR-600, [#252](https://github.com/mairie360/BFF_user/pull/252), [#261](https://github.com/mairie360/BFF_user/pull/261), [#264](https://github.com/mairie360/BFF_user/pull/264))
- Sept changements sans effet visible : le workflow `mairie360/CICD` passe de v4.2.1 à v4.3.2 en quatre mises à jour, le workflow reçoit les secrets du journal des releases (MAIR-571), et `eslint` ainsi que `typescript-eslint` sont mis à jour. ([#254](https://github.com/mairie360/BFF_user/pull/254), [#257](https://github.com/mairie360/BFF_user/pull/257), [#259](https://github.com/mairie360/BFF_user/pull/259), [#262](https://github.com/mairie360/BFF_user/pull/262), [#256](https://github.com/mairie360/BFF_user/pull/256), [#253](https://github.com/mairie360/BFF_user/pull/253), [#258](https://github.com/mairie360/BFF_user/pull/258))

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-20 18:12 UTC | staging | — | `b6b04cf` | [run](https://github.com/mairie360/BFF_user/actions/runs/39470049349) |
| 2026-10-20 17:57 UTC | dev | — | `b6b04cf` | [run](https://github.com/mairie360/BFF_user/actions/runs/39470049349) |
| 2026-10-20 13:04 UTC | dev | — | `699a1ef` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426669559) |
| 2026-10-20 13:02 UTC | dev | — | `848097d` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426619527) |
| 2026-10-19 20:26 UTC | dev | — | `b6d118c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39318019880) |
| 2026-10-19 20:15 UTC | dev | — | `05cc9d3` | [run](https://github.com/mairie360/BFF_user/actions/runs/39316541683) |
<!-- release-journal-history:end -->
