# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "b134edddaad27ddaa92f3005cf680c4a19bc3cda", "prod": "0a21926f6b54567fc8bdf6cb9c3530672f8ead6f", "prod_tag": "v1.0.0", "staging": "b6b04cf7470d7fd32db46923707789cf008d0dc1", "updated": {"dev": "2026-10-21 01:39 UTC", "staging": "2026-10-20 18:12 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.0.0 | `0a21926` | — |
| staging | — | `b6b04cf` | 2026-10-20 18:12 UTC |
| dev | — | `b134edd` | 2026-10-21 01:39 UTC |

## Ajouté sur main depuis la dernière release prod (v1.0.0)

#### Nouveautés
- Télémétrie OpenTelemetry : les traces et les métriques HTTP sont exportées en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` quand cette variable est définie ; sans elle, rien n'est exporté. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent du BFF, jamais une URL, une query string, un en-tête, un identifiant ou une IP. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))
- Les réponses `429` sont documentées dans le contrat OpenAPI sur les routes d'authentification, d'utilisateur, d'administration, de session et de compte : quand la limite de Core API est atteinte, le client reçoit un `429` avec un code d'erreur et un en-tête `Retry-After`. Le diff est tronqué, le détail des routes modifiées dans `src/routes` n'est pas vérifiable au-delà de cette documentation. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- Contrats Core API : `@mairie360/core-api-openapi` passe de `2.1.0` à un artefact de dev puis à `0.0.0-staging.b900797` (MAIR-568, MAIR-575, MAIR-600, [#252](https://github.com/mairie360/BFF_user/pull/252), [#261](https://github.com/mairie360/BFF_user/pull/261), [#264](https://github.com/mairie360/BFF_user/pull/264)) ; les fixtures de test suivent le champ `role` requis de `AdminUserRow`.
- CI : `cicd.yml` passe de `mairie360/CICD` v4.2.1 à v4.4.0 via plusieurs bumps Renovate (v4.2.2, v4.3.0, v4.3.1, v4.3.2, v4.4.0), et les secrets `ANTHROPIC_API_KEY`, `RELEASE_APP_ID` et `RELEASE_APP_PK` sont transmis au workflow réutilisable (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256)). Les workflows `promote-staging.yml` et `promote-prod.yml` sont ajoutés (MAIR-494, [#266](https://github.com/mairie360/BFF_user/pull/266)) ; un push sur `main` s'arrête après `release-dev`.
- Dépendances : `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` et `typescript-eslint` passent en 8.72.0 ([#258](https://github.com/mairie360/BFF_user/pull/258)) ; `eslint` passe en 10.13.0 ([#253](https://github.com/mairie360/BFF_user/pull/253)) ; `follow-redirects` passe en 1.16.1 dans le lockfile, ce qui débloque `npm audit` ([#266](https://github.com/mairie360/BFF_user/pull/266)).
- Documentation : `CLAUDE.md`, `docs/en/technical.md` et `docs/fr/technical.md` décrivent la télémétrie et la promotion manuelle.

## Différence dev → staging (en dev, pas encore en staging)

#### Technique
- Promotion séparée du workflow de base (MAIR-494, [#266](https://github.com/mairie360/BFF_user/pull/266)) : `cicd.yml` passe à `mairie360/CICD` v4.4.0 et s'arrête après `release-dev`, donc un push sur `main` ne lance plus les environnements Staging et Prod. Staging et prod passent par les workflows manuels `promote-staging.yml` et `promote-prod.yml`, verrouillés par cible.
- Dépendance : `follow-redirects` passe en 1.16.1 dans le lockfile (GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c), ce qui débloque `npm audit` sur `main`.
- Renovate et documentation : le manager `cicd_version` couvre les trois workflows, regroupés dans une seule PR ; `CLAUDE.md` et les docs décrivent la promotion.

## Différence staging → prod (en staging, pas encore en prod)

#### Nouveautés
- Télémétrie OpenTelemetry : les traces et les métriques HTTP sont exportées en OTLP vers `OTEL_EXPORTER_OTLP_ENDPOINT` quand cette variable est définie ; sans elle, rien n'est exporté. Seuls la méthode, le statut, la route paramétrée et l'hôte amont sortent du BFF. (MAIR-504, [#220](https://github.com/mairie360/BFF_user/pull/220))
- Les réponses `429` sont documentées dans le contrat OpenAPI sur les routes d'authentification, d'utilisateur, d'administration, de session et de compte : quand la limite de Core API est atteinte, le client reçoit un `429` avec un code d'erreur et un en-tête `Retry-After`. (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252))

#### Technique
- CI : `cicd.yml` passe de `mairie360/CICD` v4.3.0 à v4.4.0 via les bumps Renovate v4.3.0, v4.3.1, v4.3.2 et v4.4.0 ; le journal de release (MAIR-571, [#256](https://github.com/mairie360/BFF_user/pull/256)) reçoit ses secrets. Les workflows `promote-staging.yml` et `promote-prod.yml` remplacent la promotion automatique (MAIR-494, [#266](https://github.com/mairie360/BFF_user/pull/266)).
- Contrat Core API : `@mairie360/core-api-openapi` pointe sur `0.0.0-staging.b900797` et les images `core-api` des stacks de test sur `staging-b900797` (MAIR-600, [#264](https://github.com/mairie360/BFF_user/pull/264)).
- Dépendances : `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` et `typescript-eslint` passent en 8.72.0 ([#258](https://github.com/mairie360/BFF_user/pull/258)) ; `eslint` passe en 10.13.0 ([#253](https://github.com/mairie360/BFF_user/pull/253)).
- Tests : les fixtures suivent le champ `role` requis de `AdminUserRow` (MAIR-568, [#252](https://github.com/mairie360/BFF_user/pull/252)).

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-10-21 01:39 UTC | dev | — | `b134edd` | [run](https://github.com/mairie360/BFF_user/actions/runs/39528066253) |
| 2026-10-20 18:12 UTC | staging | — | `b6b04cf` | [run](https://github.com/mairie360/BFF_user/actions/runs/39470049349) |
| 2026-10-20 17:57 UTC | dev | — | `b6b04cf` | [run](https://github.com/mairie360/BFF_user/actions/runs/39470049349) |
| 2026-10-20 13:04 UTC | dev | — | `699a1ef` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426669559) |
| 2026-10-20 13:02 UTC | dev | — | `848097d` | [run](https://github.com/mairie360/BFF_user/actions/runs/39426619527) |
| 2026-10-19 20:26 UTC | dev | — | `b6d118c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39318019880) |
| 2026-10-19 20:15 UTC | dev | — | `05cc9d3` | [run](https://github.com/mairie360/BFF_user/actions/runs/39316541683) |
<!-- release-journal-history:end -->
