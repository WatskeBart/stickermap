FROM docker.io/astral/uv:python3.14-alpine

ARG IMAGE_VERSION=1.9.0

LABEL org.opencontainers.image.title="Stickermap Database Migrations" \
      org.opencontainers.image.version="${IMAGE_VERSION}" \
      org.opencontainers.image.source="https://github.com/WatskeBart/stickermap/" \
      org.opencontainers.image.authors="WatskeBart"

WORKDIR /app

COPY pyproject.toml .
RUN uv pip install --system -r pyproject.toml

COPY . .

CMD ["alembic", "upgrade", "head"]
