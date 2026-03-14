FROM docker.io/astral/uv:python3.14-alpine

WORKDIR /app

COPY pyproject.toml ./
RUN uv pip install --system -r pyproject.toml

COPY . .

CMD ["alembic", "upgrade", "head"]
