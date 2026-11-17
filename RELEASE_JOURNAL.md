# Journal des releases — BFF_user

<!-- release-journal-state {"dev": "8574431d4b6aeeccebb2d7711ce59272cf223950", "prod": "c6eda654f4dcb8ecb2a85bf5d76625cea6257ff7", "prod_tag": "v1.2.0", "staging": "c6eda654f4dcb8ecb2a85bf5d76625cea6257ff7", "updated": {"dev": "2026-11-17 23:57 UTC", "prod": "2026-11-13 00:45 UTC", "staging": "2026-11-13 00:31 UTC"}} -->
> Tenu à jour par la CI (`mairie360/CICD`, action `release/release-journal`) à chaque passage en dev, staging et prod. Ne pas modifier à la main : le fichier est réécrit au passage suivant.

| Environnement | Version | Commit | Mis à jour |
| --- | --- | --- | --- |
| prod | v1.2.0 | `c6eda65` | 2026-11-13 00:45 UTC |
| staging | — | `c6eda65` | 2026-11-13 00:31 UTC |
| dev | — | `8574431` | 2026-11-17 23:57 UTC |

## Ajouté sur main depuis la dernière release prod (v1.2.0)

- feat: MAIR-810 Passkeys managed by Core ([#329](https://github.com/mairie360/BFF_user/pull/329))
- feat: MAIR-808 Make the two-factor authentication mandatory (instance policy) ([#323](https://github.com/mairie360/BFF_user/pull/323))
- feat: MAIR-805 Relay the second factor in BFF_user ([#321](https://github.com/mairie360/BFF_user/pull/321))
- test: MAIR-537 Test upstream error mapping on every write route of the BFFs ([#328](https://github.com/mairie360/BFF_user/pull/328))
- test: MAIR-538 Add cross-cutting timeout, 413 and token-refusal tests to the BFFs and the template ([#326](https://github.com/mairie360/BFF_user/pull/326))
- feat: MAIR-998 Test stacks follow the moving upstream tag of the stage (#317) ([#317](https://github.com/mairie360/BFF_user/pull/317))
- chore(deps): pin actions/checkout action to 3d3c42e (#319) ([#319](https://github.com/mairie360/BFF_user/pull/319))
- ci: MAIR-1008 Nightly rehearsal of the promotion gates (#314) ([#314](https://github.com/mairie360/BFF_user/pull/314))
- chore(deps): update dependency eslint to v10.15.0 (#318) ([#318](https://github.com/mairie360/BFF_user/pull/318))
- test: MAIR-248 Translate the BFFs' messages and the ansible documentation into English (#315) ([#315](https://github.com/mairie360/BFF_user/pull/315))
- fix: MAIR-248 Translate the BFFs' messages and the ansible documentation into English (#312) ([#312](https://github.com/mairie360/BFF_user/pull/312))
- docs: MAIR-246 Update the stale CLAUDE.md files (#310) ([#310](https://github.com/mairie360/BFF_user/pull/310))
- test: MAIR-241 Test the BFF_user admin routes and raise the BFFs coverage thresholds (#304) ([#304](https://github.com/mairie360/BFF_user/pull/304))
- chore(deps): update typescript dependencies (#302) ([#302](https://github.com/mairie360/BFF_user/pull/302))
- ci: MAIR-1003 Release prod: align internal versions and deploy ([#308](https://github.com/mairie360/BFF_user/pull/308))

## Différence dev → staging (en dev, pas encore en staging)

- feat: MAIR-810 Passkeys managed by Core ([#329](https://github.com/mairie360/BFF_user/pull/329))
- feat: MAIR-808 Make the two-factor authentication mandatory (instance policy) ([#323](https://github.com/mairie360/BFF_user/pull/323))
- feat: MAIR-805 Relay the second factor in BFF_user ([#321](https://github.com/mairie360/BFF_user/pull/321))
- test: MAIR-537 Test upstream error mapping on every write route of the BFFs ([#328](https://github.com/mairie360/BFF_user/pull/328))
- test: MAIR-538 Add cross-cutting timeout, 413 and token-refusal tests to the BFFs and the template ([#326](https://github.com/mairie360/BFF_user/pull/326))
- feat: MAIR-998 Test stacks follow the moving upstream tag of the stage (#317) ([#317](https://github.com/mairie360/BFF_user/pull/317))
- chore(deps): pin actions/checkout action to 3d3c42e (#319) ([#319](https://github.com/mairie360/BFF_user/pull/319))
- ci: MAIR-1008 Nightly rehearsal of the promotion gates (#314) ([#314](https://github.com/mairie360/BFF_user/pull/314))
- chore(deps): update dependency eslint to v10.15.0 (#318) ([#318](https://github.com/mairie360/BFF_user/pull/318))
- test: MAIR-248 Translate the BFFs' messages and the ansible documentation into English (#315) ([#315](https://github.com/mairie360/BFF_user/pull/315))
- fix: MAIR-248 Translate the BFFs' messages and the ansible documentation into English (#312) ([#312](https://github.com/mairie360/BFF_user/pull/312))
- docs: MAIR-246 Update the stale CLAUDE.md files (#310) ([#310](https://github.com/mairie360/BFF_user/pull/310))
- test: MAIR-241 Test the BFF_user admin routes and raise the BFFs coverage thresholds (#304) ([#304](https://github.com/mairie360/BFF_user/pull/304))
- chore(deps): update typescript dependencies (#302) ([#302](https://github.com/mairie360/BFF_user/pull/302))
- ci: MAIR-1003 Release prod: align internal versions and deploy ([#308](https://github.com/mairie360/BFF_user/pull/308))

## Différence staging → prod (en staging, pas encore en prod)

_Rien._

> Résumé Claude indisponible pour ce passage : listes brutes des commits.

## Historique des passages

<!-- release-journal-history:start -->
| Date | Environnement | Version | Commit | Run |
| --- | --- | --- | --- | --- |
| 2026-11-17 23:57 UTC | dev | — | `8574431` | [run](https://github.com/mairie360/BFF_user/actions/runs/44203376842) |
| 2026-11-17 23:53 UTC | dev | — | `149ae4e` | [run](https://github.com/mairie360/BFF_user/actions/runs/44202767910) |
| 2026-11-17 23:50 UTC | dev | — | `f4cac95` | [run](https://github.com/mairie360/BFF_user/actions/runs/44202041797) |
| 2026-11-17 17:04 UTC | dev | — | `92a4d0a` | [run](https://github.com/mairie360/BFF_user/actions/runs/44131434092) |
| 2026-11-17 17:01 UTC | dev | — | `f538027` | [run](https://github.com/mairie360/BFF_user/actions/runs/44131417776) |
| 2026-11-17 11:55 UTC | dev | — | `2f759ff` | [run](https://github.com/mairie360/BFF_user/actions/runs/44076471460) |
| 2026-11-17 11:43 UTC | dev | — | `32e4097` | [run](https://github.com/mairie360/BFF_user/actions/runs/44075926973) |
| 2026-11-17 11:02 UTC | dev | — | `558a28b` | [run](https://github.com/mairie360/BFF_user/actions/runs/44069092326) |
| 2026-11-17 07:40 UTC | dev | — | `9c673d3` | [run](https://github.com/mairie360/BFF_user/actions/runs/44039915722) |
| 2026-11-16 17:58 UTC | dev | — | `0a681f5` | [run](https://github.com/mairie360/BFF_user/actions/runs/43923016311) |
| 2026-11-16 17:48 UTC | dev | — | `d2e721b` | [run](https://github.com/mairie360/BFF_user/actions/runs/43919056732) |
| 2026-11-16 16:45 UTC | dev | — | `38d1661` | [run](https://github.com/mairie360/BFF_user/actions/runs/43910253835) |
| 2026-11-16 14:19 UTC | dev | — | `393e080` | [run](https://github.com/mairie360/BFF_user/actions/runs/43883446674) |
| 2026-11-13 10:11 UTC | dev | — | `a236608` | [run](https://github.com/mairie360/BFF_user/actions/runs/43406521618) |
| 2026-11-13 00:51 UTC | dev | — | `95d1af0` | [run](https://github.com/mairie360/BFF_user/actions/runs/43340048866) |
| 2026-11-13 00:45 UTC | prod | v1.2.0 | `c6eda65` | [run](https://github.com/mairie360/BFF_user/actions/runs/43337858213) |
| 2026-11-13 00:31 UTC | staging | — | `c6eda65` | [run](https://github.com/mairie360/BFF_user/actions/runs/43336603406) |
| 2026-11-13 00:22 UTC | dev | — | `c6eda65` | [run](https://github.com/mairie360/BFF_user/actions/runs/43334829914) |
| 2026-11-12 21:08 UTC | staging | — | `654debe` | [run](https://github.com/mairie360/BFF_user/actions/runs/43306278448) |
| 2026-11-12 20:58 UTC | dev | — | `654debe` | [run](https://github.com/mairie360/BFF_user/actions/runs/43305006579) |
| 2026-11-12 13:16 UTC | dev | — | `26fd3d3` | [run](https://github.com/mairie360/BFF_user/actions/runs/43224988483) |
| 2026-11-12 05:30 UTC | dev | — | `329d75a` | [run](https://github.com/mairie360/BFF_user/actions/runs/43161243565) |
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
