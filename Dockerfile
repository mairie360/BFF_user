# --- Étape 1 : Build ---
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS builder
WORKDIR /app
COPY package*.json ./

# Les identifiants GitHub Packages ne sont disponibles que pendant le npm ci.
RUN --mount=type=secret,id=npmrc,target=/app/.npmrc \
    --mount=type=secret,id=node_auth_token,env=NODE_AUTH_TOKEN \
    npm ci

COPY . .
RUN npm run build

RUN --mount=type=secret,id=npmrc,target=/app/.npmrc \
    --mount=type=secret,id=node_auth_token,env=NODE_AUTH_TOKEN \
    npm ci --omit=dev --ignore-scripts

# --- Stage 2: Runtime ---
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
ENV NODE_ENV=production
# The runtime only runs `node dist/index.js`: drop the package managers bundled with the base image
# (their dependencies carry CVEs reported by the Trivy scan of the release).
RUN apk add --no-cache curl \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
              /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-*

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

USER node

# Cap the heap at 180 MB to fit a 256 MB K8s memory limit
ENV NODE_OPTIONS="--max-old-space-size=180"

EXPOSE 4000
CMD ["node", "dist/index.js"]
