# Development image: runs the TypeScript sources with tsx watch (npm run start). The security and
# performance stacks build it as bff-user:local when IMAGE_REF is empty.
FROM node:24.22.2-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8

# curl for the Docker healthchecks.
RUN apk add --no-cache curl

WORKDIR /app

# Dependency manifests first, for the Docker layer cache.
COPY package*.json tsconfig.json ./

# Full install (with devDependencies). The GitHub Packages credentials are only available
# during this step.
RUN --mount=type=secret,id=npmrc,target=/app/.npmrc \
    --mount=type=secret,id=node_auth_token,env=NODE_AUTH_TOKEN \
    npm ci

COPY . .

RUN chown -R node:node /app
USER node

CMD ["npm", "run", "start"]
