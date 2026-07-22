# 여유로 FastAPI (ODsay · 혼잡 모델 · forecast)
# 빌드 컨텍스트: 레포 루트
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

# 로컬과 동일한 경로 구조 (config.REPO_ROOT = /app)
COPY backend/app /app/backend/app
COPY backend/models /app/backend/models
COPY data /app/data

WORKDIR /app/backend

ENV PYTHONUNBUFFERED=1
ENV PORT=8000

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
