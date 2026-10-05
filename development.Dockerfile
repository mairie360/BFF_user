# Development image: runs the TypeScript sources with tsx watch (npm run start). The security and
# performance stacks build it as bff-user:local when IMAGE_REF is empty.
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

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

CMD ["npm", "run", "start"]
