# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "0f7bf6050fee6873d4493e0fd8ecd494bf83d464", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-11-10 18:37 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `0f7bf60` | 2026-11-10 18:37 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

- chore(deps): update dependency supertest to v7.3.2 (#295) ([#295](https://github.com/mairie360/BFF_user/pull/295))
- feat: MAIR-609 Core/BFF_user - Accès temporaire à la console Keycloak pour les admins de mairie (#292) ([#292](https://github.com/mairie360/BFF_user/pull/292))
- fix: MAIR-680 [Audit 23/10] Toutes les APIs et BFFs : remplacer le secret JWT HS256 partagé par 12 services (A1) ([#290](https://github.com/mairie360/BFF_user/pull/290))
- chore(deps): pin dependencies (#285) ([#285](https://github.com/mairie360/BFF_user/pull/285))
- ci: MAIR-771 APIs, BFFs, Database : monter CICD en v5.2.2 pour activer les contrôles RGPD (#287) ([#287](https://github.com/mairie360/BFF_user/pull/287))
- fix: MAIR-692 [Audit 23/10] Core_API : la déconnexion échoue avec un JWT expiré, le refresh token n'est pas révoqué (E4) (#284) ([#284](https://github.com/mairie360/BFF_user/pull/284))
- fix: MAIR-679 [Audit 23/10] BFF_user / bffs_lib / Core : « mot de passe oublié » verrouillable pour toute l'instance (A6) (#281) ([#281](https://github.com/mairie360/BFF_user/pull/281))
- chore(deps): update typescript dependencies (#276) ([#276](https://github.com/mairie360/BFF_user/pull/276))
- feat: MAIR-497 Simulation d'usage RGPD et revue IA des logs et de la base avant la prod (#217) ([#217](https://github.com/mairie360/BFF_user/pull/217))
- ci: MAIR-295 Ajouter une checklist RGPD aux PR et des rappels d'échéances automatiques (#218) ([#218](https://github.com/mairie360/BFF_user/pull/218))
- fix: MAIR-290 Détecter les données personnelles dans les journaux avec un test du marqueur (#213) ([#213](https://github.com/mairie360/BFF_user/pull/213))
- fix(security): patch Node.js runtime and toolchain (#275) ([#275](https://github.com/mairie360/BFF_user/pull/275))
- chore(deps): update dependency dotenv to v18.0.9 (#274) ([#274](https://github.com/mairie360/BFF_user/pull/274))
- feat: MAIR-262 Tests d'intégration - Tests de fonctionnement des APIs, tests métier des BFFs et tests de régression (#273) ([#273](https://github.com/mairie360/BFF_user/pull/273))
- docs: MAIR-612 Release prod: align internal versions and deploy (#271) ([#271](https://github.com/mairie360/BFF_user/pull/271))

## Différence dev → staging (en dev, pas encore en staging)

- chore(deps): update dependency supertest to v7.3.2 (#295) ([#295](https://github.com/mairie360/BFF_user/pull/295))
- feat: MAIR-609 Core/BFF_user - Accès temporaire à la console Keycloak pour les admins de mairie (#292) ([#292](https://github.com/mairie360/BFF_user/pull/292))
- fix: MAIR-680 [Audit 23/10] Toutes les APIs et BFFs : remplacer le secret JWT HS256 partagé par 12 services (A1) ([#290](https://github.com/mairie360/BFF_user/pull/290))
- chore(deps): pin dependencies (#285) ([#285](https://github.com/mairie360/BFF_user/pull/285))
- ci: MAIR-771 APIs, BFFs, Database : monter CICD en v5.2.2 pour activer les contrôles RGPD (#287) ([#287](https://github.com/mairie360/BFF_user/pull/287))
- fix: MAIR-692 [Audit 23/10] Core_API : la déconnexion échoue avec un JWT expiré, le refresh token n'est pas révoqué (E4) (#284) ([#284](https://github.com/mairie360/BFF_user/pull/284))
- fix: MAIR-679 [Audit 23/10] BFF_user / bffs_lib / Core : « mot de passe oublié » verrouillable pour toute l'instance (A6) (#281) ([#281](https://github.com/mairie360/BFF_user/pull/281))
- chore(deps): update typescript dependencies (#276) ([#276](https://github.com/mairie360/BFF_user/pull/276))
- feat: MAIR-497 Simulation d'usage RGPD et revue IA des logs et de la base avant la prod (#217) ([#217](https://github.com/mairie360/BFF_user/pull/217))
- ci: MAIR-295 Ajouter une checklist RGPD aux PR et des rappels d'échéances automatiques (#218) ([#218](https://github.com/mairie360/BFF_user/pull/218))
- fix: MAIR-290 Détecter les données personnelles dans les journaux avec un test du marqueur (#213) ([#213](https://github.com/mairie360/BFF_user/pull/213))
- fix(security): patch Node.js runtime and toolchain (#275) ([#275](https://github.com/mairie360/BFF_user/pull/275))
- chore(deps): update dependency dotenv to v18.0.9 (#274) ([#274](https://github.com/mairie360/BFF_user/pull/274))
- feat: MAIR-262 Tests d'intégration - Tests de fonctionnement des APIs, tests métier des BFFs et tests de régression (#273) ([#273](https://github.com/mairie360/BFF_user/pull/273))
- docs: MAIR-612 Release prod: align internal versions and deploy (#271) ([#271](https://github.com/mairie360/BFF_user/pull/271))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

> Résumé Claude indisponible pour ce passage : listes brutes des commits.

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-11-10 18:37 UTC | dev | — | `0f7bf60` | [run](https://github.com/mairie360/BFF_user/actions/runs/42876274924) |
| 2026-11-04 15:15 UTC | dev | — | `2ab34b3` | [run](https://github.com/mairie360/BFF_user/actions/runs/41854314320) |
| 2026-11-03 14:22 UTC | dev | — | `7931bcc` | [run](https://github.com/mairie360/BFF_user/actions/runs/41652093723) |
| 2026-11-03 02:07 UTC | dev | — | `d774f6c` | [run](https://github.com/mairie360/BFF_user/actions/runs/41563618435) |
| 2026-11-03 00:02 UTC | dev | — | `243acbe` | [run](https://github.com/mairie360/BFF_user/actions/runs/41548478302) |
| 2026-11-02 12:56 UTC | dev | — | `cd4e695` | [run](https://github.com/mairie360/BFF_user/actions/runs/41448169133) |
| 2026-11-01 20:09 UTC | dev | — | `7ce44d2` | [run](https://github.com/mairie360/BFF_user/actions/runs/41344951999) |
| 2026-11-01 17:21 UTC | dev | — | `49a3611` | [run](https://github.com/mairie360/BFF_user/actions/runs/41330698243) |
| 2026-11-01 12:45 UTC | dev | — | `86a82ae` | [run](https://github.com/mairie360/BFF_user/actions/runs/41307645663) |
| 2026-11-01 12:40 UTC | dev | — | `d356c97` | [run](https://github.com/mairie360/BFF_user/actions/runs/41307417610) |
| 2026-11-01 12:38 UTC | dev | — | `2ac1100` | [run](https://github.com/mairie360/BFF_user/actions/runs/41306977104) |
| 2026-10-23 12:22 UTC | dev | — | `64482b7` | [run](https://github.com/mairie360/BFF_user/actions/runs/39952425565) |
| 2026-10-23 02:58 UTC | dev | — | `7a4bbf9` | [run](https://github.com/mairie360/BFF_user/actions/runs/39892169488) |
| 2026-10-22 09:08 UTC | dev | — | `48b4a65` | [run](https://github.com/mairie360/BFF_user/actions/runs/39752659489) |
| 2026-10-21 10:09 UTC | prod | v1.1.0 | `b754a6c` | [run](https://github.com/mairie360/BFF_user/actions/runs/39579231890) |
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
