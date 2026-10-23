# Development image: runs the TypeScript sources with tsx watch (npm run start). The security and
# performance stacks build it as bff-user:local when IMAGE_REF is empty.
FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53

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
