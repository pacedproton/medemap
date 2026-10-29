# MeDeMAP for OpenShift. Build from the repo root:
#   podman build -f openshift/Dockerfile -t localhost:15000/medemap/web:latest .
# No build-time secrets: the app has no NEXT_PUBLIC_* variables in use, and everything
# else is read at runtime from the Secret medemap-env and the Deployment env.
# The ignore rules live in openshift/Dockerfile.dockerignore (no root .dockerignore).

FROM docker.io/library/node:22-alpine AS build
WORKDIR /app
# Pinned to the bun that wrote bun.lock (lockfile v3). A different bun can refuse --frozen-lockfile,
# so change this and regenerate bun.lock together.
RUN npm install -g bun@1.4.4
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM docker.io/library/node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
COPY --from=build /app /app
# OpenShift runs the container as a random UID in group 0, so the group needs the
# same rights as the owner (the .next cache is written at runtime).
RUN chgrp -R 0 /app && chmod -R g=u /app
USER 1001
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
