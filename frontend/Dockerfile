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

# renovate: datasource=github-releases depName=kyubisation/angular-server-side-configuration
ARG NGSSC_VERSION=21.0.3

ADD --chmod=755 https://github.com/kyubisation/angular-server-side-configuration/releases/download/v${NGSSC_VERSION}/ngssc_64bit /usr/local/bin/ngssc

COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=builder /app/dist/frontend/browser /var/www/html
COPY --from=builder /app/dist/ngssc.json /var/www/html/ngssc.json
COPY entrypoint.sh /entrypoint.sh

EXPOSE 8282/tcp

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
