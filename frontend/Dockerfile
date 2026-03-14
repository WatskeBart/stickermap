# Build stage
FROM docker.io/node:lts-slim AS builder

WORKDIR /app

COPY . /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm exec ng run frontend:ngsscbuild:production

FROM docker.io/caddy:alpine AS final

WORKDIR /app

ARG NGSSC_VERSION=21.0.3

ADD --chmod=755 https://github.com/kyubisation/angular-server-side-configuration/releases/download/v${NGSSC_VERSION}/ngssc_64bit /usr/local/bin/ngssc

COPY Caddyfile /app/Caddyfile
COPY --from=builder --chown=1000:1000 /app/dist/frontend/browser /app/html
COPY --from=builder --chown=1000:1000 /app/dist/ngssc.json /app/html
COPY --chown=1000:1000 entrypoint.sh /entrypoint.sh

RUN chown 1000:1000 /srv

USER 1000

EXPOSE 8282/tcp

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
