# Étape 1 : Build & Installation
FROM node:20-alpine AS builder

WORKDIR /app

# Installation de TOUTES les dépendances
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# On installe UNIQUEMENT les dépendances de prod dans un dossier séparé
# pour ne copier que le strict nécessaire
RUN npm ci --omit=dev --ignore-scripts

# --- Étape 2 : Runtime ---
FROM node:20-alpine

# On définit l'environnement de production
ENV NODE_ENV=production

WORKDIR /app

# On copie les dépendances de prod depuis le builder
COPY --from=builder /app/node_modules ./node_modules
# On copie le code compilé
COPY --from=builder /app/dist ./dist
# On copie le package.json (parfois requis par certains outils)
COPY --from=builder /app/package.json ./

# SÉCURITÉ : On utilise l'utilisateur node par défaut d'Alpine
USER node

# OPTIMISATION RAM : On limite le tas de Node pour éviter les crashs sur 4Go
# Ici, on limite à 400Mo pour un Pod limité à 512Mo
ENV NODE_OPTIONS="--max-old-space-size=400"

EXPOSE 4000

# On lance directement le fichier compilé
CMD ["node", "dist/index.js"]