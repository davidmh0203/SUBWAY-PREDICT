"""FastAPI 앱 진입점.

실행:  fastapi dev app/main.py   (backend 폴더에서)
문서:  http://localhost:8000/docs
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import station_registry
from app.db import init_db
from app.routers import auth, calendar, congestion, favorites, forecast, odsay, stations


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="여유로 API", version="0.1.0", lifespan=lifespan)

# 프론트(React)와 연동하려면 CORS 허용이 필요합니다.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite 개발 서버 주소
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 각 라우터(엔드포인트 묶음) 등록
app.include_router(stations.router)
app.include_router(congestion.router)
app.include_router(odsay.router)
app.include_router(calendar.router)
app.include_router(auth.router)
app.include_router(favorites.router)
app.include_router(forecast.router)


@app.get("/health", tags=["기본"])
def health():
    """서버 상태 확인용."""
    return {"status": "ok"}


@app.get("/registry/stats", tags=["기본"])
def registry_stats():
    return station_registry.stats()
