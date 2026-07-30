FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN groupadd --system trackforge \
    && useradd --system --gid trackforge --home-dir /app trackforge \
    && mkdir -p /data \
    && chown -R trackforge:trackforge /app /data

COPY requirements.txt .
RUN pip install --no-cache-dir --disable-pip-version-check -r requirements.txt
COPY --chown=trackforge:trackforge app ./app
COPY --chown=trackforge:trackforge migrations ./migrations
COPY --chown=trackforge:trackforge scripts ./scripts
COPY --chown=trackforge:trackforge alembic.ini ./alembic.ini

USER trackforge
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/ready', timeout=3)"]
CMD ["python", "-m", "scripts.start"]