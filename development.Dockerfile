# Development image: runs the TypeScript sources with tsx watch (npm run start). The security and
# performance stacks build it as bff-user:local when IMAGE_REF is empty.
FROM node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85

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
