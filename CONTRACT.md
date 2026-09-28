# Contrat BFF / web service

Web services associés : **Administrator_Web_Service, Login_Web_Service**. Le document [OpenAPI](contracts/openapi.json), les [types TypeScript](contracts/bff.d.ts), `/openapi.json` et `/swagger.json` proviennent tous de `src/openapi.ts`, qui importe les routes montées par l’application.

## Routes implémentées

Les chemins sont relatifs au BFF. Les proxies web conservent méthode, paramètres, contenu binaire, statuts et cookies. Les chemins `/api/auth/*` restent des adaptateurs de session vers BFF User ; les pages Next.js sont distinctes des routes de données.

| Méthode | Route | Réponse / schéma |
| --- | --- | --- |
| GET | `/health` | 200 OK |
| GET | `/check_apis` | 200 CheckApiResponse |
| POST | `/auth/login` | 200 AuthTokenResponse |
| POST | `/auth/force_change_password` | 204 Mot de passe changé avec succès |
| POST | `/auth/refresh` | 200 RefreshResponse |
| POST | `/auth/logout` | 200 LogoutResponse |
| GET | `/user/{userId}/about` | 200 AboutResponseView |
| GET | `/bff/admin/users` | 200 AdministrationUsersPage ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| POST | `/bff/admin/users` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| PATCH | `/bff/admin/users/{userId}` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| DELETE | `/bff/admin/users/{userId}` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| PATCH | `/bff/admin/users/{userId}/password` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| POST | `/bff/admin/users/{userId}/roles` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| DELETE | `/bff/admin/users/{userId}/roles/{roleId}` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| GET | `/bff/admin/roles` | 200 Données de l’administration ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| POST | `/bff/admin/roles` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| PUT | `/bff/admin/roles/{roleId}` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| PATCH | `/bff/admin/roles/{roleId}` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| DELETE | `/bff/admin/roles/{roleId}` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| GET | `/bff/admin/groups` | 200 Données de l’administration ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| POST | `/bff/admin/groups` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| GET | `/bff/admin/groups/{groupId}` | 200 AdministrationGroup ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| PATCH | `/bff/admin/groups/{groupId}` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| DELETE | `/bff/admin/groups/{groupId}` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| GET | `/bff/admin/groups/{groupId}/users` | 200 Données de l’administration ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| POST | `/bff/admin/groups/{groupId}/users` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| DELETE | `/bff/admin/groups/{groupId}/users/{userId}` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| GET | `/bff/admin/sessions` | 200 Données de l’administration ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| GET | `/bff/admin/sessions/history` | 200 Données de l’administration ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| POST | `/bff/admin/sessions/refresh` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| POST | `/bff/admin/sessions/revoke` | 200 CoreResponse ; 201 CoreResponse ; 204 Aucun contenu retourné par le Core API |
| GET | `/me` | 200 SessionResponse |
| GET | `/session/me` | 200 SessionResponse |

## Mise à jour et validation

Après une modification des routes ou schémas, exécuter `npm run contracts:generate`, puis synchroniser chaque web service associé avec `npm run contracts:sync`. `npm run contracts:check` échoue si le contrat exporté ou les types générés sont périmés. Soumettre les branches associées dans la même livraison.

Le générateur de types est fixé à `openapi-typescript@7.10.1`. Il est exécuté via npm ; aucun jeton privé ne figure dans les contrats.
