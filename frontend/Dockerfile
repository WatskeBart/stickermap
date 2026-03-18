# Build stage
FROM docker.io/node:lts-slim AS builder

WORKDIR /app

COPY . .

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm exec ng run frontend:ngsscbuild:production

FROM docker.io/caddy:alpine AS final

ARG IMAGE_VERSION=1.3.0

LABEL org.opencontainers.image.title="Stickermap Frontend" \
      org.opencontainers.image.version="${IMAGE_VERSION}" \
      org.opencontainers.image.source="https://github.com/WatskeBart/stickermap/" \
      org.opencontainers.image.authors="WatskeBart"

WORKDIR /app

ARG NGSSC_VERSION=21.0.3

ADD --chmod=755 https://github.com/kyubisation/angular-server-side-configuration/releases/download/v${NGSSC_VERSION}/ngssc_64bit /usr/local/bin/ngssc

COPY --chown=11953:0 Caddyfile /app/Caddyfile
COPY --from=builder --chown=11953:0 /app/dist/frontend/browser /app/html
COPY --from=builder --chown=11953:0 /app/dist/ngssc.json /app/html
COPY --chmod=755 --chown=11953:0 entrypoint.sh /entrypoint.sh

RUN chown -R 11953:0 /srv /data /config \
      && chmod -R g=u /srv /data /config

USER 11953

EXPOSE 8181/tcp
EXPOSE 8282/tcp

ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]

CMD ["caddy", "run", "--config", "/app/Caddyfile", "--adapter", "caddyfile"]
