FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:${PATH}"

WORKDIR /app/apps/worker

RUN pip install --no-cache-dir uv

COPY apps/worker/pyproject.toml apps/worker/README.md ./
COPY apps/worker/src ./src

RUN uv sync --no-dev

EXPOSE 8100

CMD ["uv", "run", "python", "-m", "worker"]
