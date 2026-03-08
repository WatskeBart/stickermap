FROM docker.io/astral/uv:python3.14-alpine

WORKDIR /app

RUN apk update && apk add --no-cache curl

COPY pyproject.toml uv.lock* ./

RUN uv pip install --system -r pyproject.toml

COPY . .

RUN mkdir -p uploads

EXPOSE 5555/tcp

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5555"]
