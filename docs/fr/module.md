# BFF_user — Présentation du module

[Documentation technique](technical.md) · [English](../en/module.md) · [README](../../README.md)

Centraliser la connexion, la session et les opérations d’administration des comptes pour les interfaces Mairie360. Ce BFF adapte Core et fournit le contexte utilisateur partagé par les autres modules.

## Public et utilité

Les équipes qui développent la connexion, l’administration et les modules consommant une session utilisateur.

Domaine fonctionnel: Identité et administration.

## Fonctions disponibles

- Connexion, changement de mot de passe de première connexion, mot de passe oublié (e-mail de réinitialisation, puis réinitialisation avec le jeton reçu, qui connecte l’utilisateur) et déconnexion (pas d’inscription publique: les administrateurs créent les comptes).
- Consultation de la session avec identité, groupes et rôles via `/me` et `/session/me`.
- Gestion des utilisateurs, rôles, groupes, membres et opérations de session sous `/admin`.
- Liste des projets restés sans groupe (`/admin/projects-without-group`, lue dans BFF_Project) pour l’onglet Groupes.

## Parcours type

1. Le portail de connexion transmet les identifiants au BFF.
2. Le BFF échange avec Core ou déclenche le parcours de changement de mot de passe obligatoire.
3. Les interfaces réutilisent la session pour charger le contexte et effectuer les opérations autorisées.

## Place dans Mairie360

Dépôts associés: [Administrator_Web_Service](https://github.com/mairie360/Administrator_Web_Service), [Login_Web_Service](https://github.com/mairie360/Login_Web_Service).

Ce dépôt contient le serveur BFF et son contrat. Les web services associés portent les écrans; le BFF adapte les données et les règles serveur nécessaires à ces écrans.

## Données et état actuel

Core API fournit l’identité, les sessions, les utilisateurs, les rôles et les groupes : le BFF n’accède ni à une base de données ni à Redis, et toute lecture ou écriture passe par Core API, première connexion comprise. Seule exception : la liste des projets sans groupe, lue dans BFF_Project.

## Périmètre et limites

Les fonctions de supervision, sauvegarde, journaux applicatifs et politique système décrites dans les besoins d’administration ne sont pas garanties par ce contrat.

## Pour développer ou exploiter ce module

Le [guide technique](technical.md) détaille architecture, configuration, routes, session, persistance, tests et CI/CD. Il décrit les sources de vérité et les étapes de synchronisation des contrats avec les dépôts associés.
