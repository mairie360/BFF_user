# Development image: runs the TypeScript sources with tsx watch (npm run start). The security and
# performance stacks build it as bff-user:local when IMAGE_REF is empty.
FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f

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
