# --- Builder stage: compiles native extensions (psycopg2, cryptography) ---
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# --- Runtime stage: no compiler toolchain, runs as a non-root user ---
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# libpq5 is the runtime lib psycopg2 needs; libpq-dev/build-essential above
# were only needed to compile it, not to run it — keeping them out of this
# stage is most of what makes multi-stage worth doing here.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser

WORKDIR /app
COPY --from=builder /install /usr/local
COPY . /app/
RUN chown -R appuser:appuser /app

USER appuser

CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}
