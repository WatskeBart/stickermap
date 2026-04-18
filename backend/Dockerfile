FROM docker.io/astral/uv:python3.14-alpine

ARG IMAGE_VERSION=1.6.2

LABEL org.opencontainers.image.title="Stickermap Backend" \
      org.opencontainers.image.version="${IMAGE_VERSION}" \
      org.opencontainers.image.source="https://github.com/WatskeBart/stickermap/" \
      org.opencontainers.image.authors="WatskeBart"

WORKDIR /app

RUN apk update && apk add --no-cache curl

COPY pyproject.toml .

RUN uv pip install --system -r pyproject.toml

COPY . .

RUN mkdir -p uploads

EXPOSE 5555/tcp

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5555"]
