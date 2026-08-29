# LiveKit voice agent worker — a separate, persistent deployable from the
# main FastAPI API (see Dockerfile). Different entrypoint (voice_worker.py,
# not uvicorn), and the `download-files` step pre-fetches VAD/turn-detector
# model weights at build time so the container never hits the network for
# them at cold start — that weight has no reason to bloat the API image.

# --- Builder stage: compiles native extensions, downloads model weights ---
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

# Model download needs the packages just installed (livekit.agents CLI) —
# run it here rather than in the runtime stage so the runtime stage never
# needs build-essential/libpq-dev. The turn-detector model comes via
# huggingface_hub, which defaults to caching under $HOME/.cache — outside
# /app and therefore NOT covered by the COPY --from=builder /app /app below
# unless HF_HOME is pinned inside /app explicitly, in both stages.
ENV PYTHONPATH=/install/lib/python3.11/site-packages
ENV HF_HOME=/app/.cache/huggingface
COPY . /app/
RUN PATH="/install/bin:$PATH" python -m livekit.agents download-files

# --- Runtime stage: no compiler toolchain, runs as a non-root user ---
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

ENV HF_HOME=/app/.cache/huggingface

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser

WORKDIR /app
COPY --from=builder /install /usr/local
COPY --from=builder /app /app
RUN chown -R appuser:appuser /app

USER appuser

# Persistent worker process — connects out to LiveKit Cloud and waits for
# job dispatch; unlike the API, this is not a request/response HTTP server,
# so there's no ${PORT} to bind (Cloud Run still needs a container that
# doesn't exit, which `start` satisfies by running forever).
CMD ["python", "voice-agent/voice_worker.py", "start"]
