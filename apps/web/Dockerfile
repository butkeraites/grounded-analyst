# Dev image for the web tier. Optimized for hot-reload under docker-compose:
# the source is bind-mounted at runtime, so this image only needs the installed
# node_modules. A production multi-stage build comes with the deploy milestone.
FROM node:22-alpine

# The web tier spawns ephemeral sandbox containers via the host Docker socket
# (docker-out-of-docker), so it needs the docker CLI. Socket access is the
# documented threat-model tradeoff (see docs/ARCHITECTURE.md).
RUN apk add --no-cache docker-cli

WORKDIR /app

# Install workspace deps from the monorepo manifests only, so `npm install`
# is cached and not re-run on every source edit.
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/core/package.json ./packages/core/package.json

RUN npm install

# Source is bind-mounted over this by docker-compose in dev; the COPY gives a
# sane default if the image is run without the mount.
COPY . .

EXPOSE 3000

# Next dev server, bound to all interfaces so the host can reach it.
CMD ["npm", "run", "dev", "--workspace", "web", "--", "--hostname", "0.0.0.0"]
