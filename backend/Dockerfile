FROM docker.io/astral/uv:python3.14-alpine

ARG IMAGE_VERSION=1.2.1

LABEL org.opencontainers.image.title="Stickermap Backend" \
      org.opencontainers.image.version="${IMAGE_VERSION}" \
      org.opencontainers.image.source="https://github.com/WatskeBart/stickermap/" \
      org.opencontainers.image.authors="WatskeBart"

WORKDIR /app

RUN apk update && apk add --no-cache curl

COPY pyproject.toml uv.lock* ./

RUN uv sync --no-dev --no-install-project

COPY . .

RUN mkdir -p uploads

EXPOSE 5555/tcp

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5555"]
