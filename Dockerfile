# syntax=docker/dockerfile:1

# ---- Frontend build ----
FROM node:24-alpine AS web
WORKDIR /web
RUN npm install -g pnpm@9.15.9
COPY apps/web/package.json apps/web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY apps/web/ ./
RUN pnpm build

# ---- API runtime ----
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    WEB_DIST_DIR=/app/web/dist

WORKDIR /app
RUN addgroup --system app && adduser --system --ingroup app app

COPY apps/api/pyproject.toml ./
COPY apps/api/src ./src
RUN pip install .

COPY apps/api/alembic.ini ./
COPY apps/api/alembic ./alembic
COPY --from=web /web/dist ./web/dist

USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/healthz', timeout=2)"

# Migrations are a separate release step: docker compose run --rm api alembic upgrade head
# Rate limits are in-process: keep one worker. Add a shared store before scaling out.
CMD ["uvicorn", "utsavos.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--no-access-log"]
