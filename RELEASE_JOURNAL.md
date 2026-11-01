# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "49a36116e3637b3a7e633d56b0b4d0713200bed2", "prod": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "prod_tag": "v1.1.0", "staging": "b754a6ce95b82af224e1bc4fead48f0f59e56433", "updated": {"dev": "2026-11-01 17:21 UTC", "prod": "2026-10-21 10:09 UTC", "staging": "2026-10-21 09:41 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.1.0 | `b754a6c` | 2026-10-21 10:09 UTC |
| staging | — | `b754a6c` | 2026-10-21 09:41 UTC |
| dev | — | `49a3611` | 2026-11-01 17:21 UTC |

## Ajouté sur main depuis la dernière release prod (v1.1.0)

#### Corrections
- Les journaux d'erreur ne contiennent plus les valeurs reçues. Avant : l'`errorHandler` par défaut et `checkApis` journalisaient l'erreur brute, dont la `cause` axios contenait le Bearer de l'appelant et les corps de requête et de réponse. Maintenant : ils journalisent `describeError(error)` (type, statut, code, message). (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Outils RGPD de CI sans effet sur le service : test du marqueur (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213)), simulation d'usage RGPD (MAIR-497, [#217](https://github.com/mairie360/BFF_user/pull/217)) et checklist RGPD des PR (MAIR-295, [#218](https://github.com/mairie360/BFF_user/pull/218)).
- Gate d'intégration newman (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273)) : collection Postman rejouée contre l'image du BFF, bloquante pour la promotion staging ; CICD passe en v4.5.0.
- Node.js 24.22.1 épinglé par digest pour les images et la CI, image de développement exécutée en utilisateur `node` ([#275](https://github.com/mairie360/BFF_user/pull/275)).
- Dépendances : `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` et `typescript-eslint` en 8.72.1, `eslint` en 10.14.0, `globals` en 17.14.0 ([#276](https://github.com/mairie360/BFF_user/pull/276)) ; `dotenv` en 18.0.9 ([#274](https://github.com/mairie360/BFF_user/pull/274)), diff absent, mention d'après la description de la PR.
- Documentation des versions CICD et Node.js alignée ([#271](https://github.com/mairie360/BFF_user/pull/271)).

## Différence dev → staging (en dev, pas encore en staging)

#### Corrections
- Les journaux d'erreur ne contiennent plus les valeurs reçues. Avant : l'`errorHandler` par défaut et `checkApis` journalisaient l'erreur brute, dont la `cause` axios contenait le Bearer de l'appelant et les corps de requête et de réponse. Maintenant : ils journalisent `describeError(error)` (type, statut, code, message). (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213))

#### Technique
- Outils RGPD de CI sans effet sur le service : test du marqueur (MAIR-290, [#213](https://github.com/mairie360/BFF_user/pull/213)), simulation d'usage RGPD (MAIR-497, [#217](https://github.com/mairie360/BFF_user/pull/217)) et checklist RGPD des PR (MAIR-295, [#218](https://github.com/mairie360/BFF_user/pull/218)).
- Gate d'intégration newman (MAIR-262, [#273](https://github.com/mairie360/BFF_user/pull/273)) : collection Postman rejouée contre l'image du BFF, bloquante pour la promotion staging ; CICD passe en v4.5.0.
- Node.js 24.22.1 épinglé par digest pour les images et la CI, image de développement exécutée en utilisateur `node` ([#275](https://github.com/mairie360/BFF_user/pull/275)).
- Dépendances : `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` et `typescript-eslint` en 8.72.1, `eslint` en 10.14.0, `globals` en 17.14.0 ([#276](https://github.com/mairie360/BFF_user/pull/276)) ; `dotenv` en 18.0.9 ([#274](https://github.com/mairie360/BFF_user/pull/274)), diff absent, mention d'après la description de la PR.
- Documentation des versions CICD et Node.js alignée ([#271](https://github.com/mairie360/BFF_user/pull/271)).

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
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
