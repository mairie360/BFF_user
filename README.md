# 🧩 BFF User — Backend for Frontend pour la gestion des utilisateurs

## 🏗️ Présentation

Ce dépôt correspond au **BFF (Backend for Frontend)** destiné à **gérer toutes les requêtes liées aux utilisateurs**.  
Il sert d’interface entre le frontend et les différents microservices liés à la gestion des **users**, en assurant :
- l’adaptation des données pour le front,  
- la centralisation des appels vers les APIs backend,  
- la simplification des flux réseau.

---

## ✨ Fonctionnalités principales

- Serveur basé sur **Express.js**
- Développement en **TypeScript** pour une meilleure sécurité et maintenabilité
- Intégration d’un endpoint `/health` pour la supervision
- Gestion centralisée des erreurs et de la configuration réseau
- Conteneurisation avec **Docker**
- Tests unitaires avec **Jest**
- Linting et formatage conformes aux standards du projet

---

## ⚙️ Objectif de ce BFF

Le **BFF User** a pour rôle :
- de **gérer toutes les opérations liées aux utilisateurs** (récupération, création, mise à jour, suppression),
- de **communiquer avec le microservice User Core**,
- et de **préparer les données** pour un usage optimal côté frontend.

---

## ⚠️ Configuration

L'accès au package privé `@mairie360/core-api-openapi` nécessite un token
GitHub Packages avec la permission `read:packages` :

```sh
export NODE_AUTH_TOKEN=<github-token>
```

Le token est transmis aux builds Docker comme secret BuildKit et n'est pas
enregistré dans l'image.

Avant de démarrer, crée un fichier `.env` à la racine du projet :

```env
PORT=3000
```
# Installer les dépendances
npm install

# Lancer le serveur
npm run start
