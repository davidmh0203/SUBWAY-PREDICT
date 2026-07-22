"""FastAPI 앱 진입점.

실행:  fastapi dev app/main.py   (backend 폴더에서)
문서:  http://localhost:8000/docs
"""

from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import station_registry
from app.db import init_db
from app.routers import auth, calendar, congestion, favorites, forecast, odsay, stations

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://subway-predict-dashboard.vercel.app",
]


def _cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if not raw:
        return DEFAULT_CORS_ORIGINS
    return [o.strip() for o in raw.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="여유로 API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
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


@app.get("/debug/egress-ip", tags=["기본"])
async def egress_ip():
    """ODsay LAB IP 화이트리스트용 — 이 서버의 출구(egress) IP.

    Free 플랜은 Shell이 없어서, 브라우저로 이 URL을 열어 IP를 확인한다.
    """
    import httpx

    urls = (
        "https://api.ipify.org",
        "https://ifconfig.me/ip",
    )
    async with httpx.AsyncClient(timeout=10.0) as client:
        for url in urls:
            try:
                r = await client.get(url)
                r.raise_for_status()
                ip = r.text.strip()
                if ip:
                    return {
                        "ip": ip,
                        "hint": "ODsay LAB → Server 키 → 허용 IP에 이 값을 등록하세요.",
                        "source": url,
                    }
            except httpx.HTTPError:
                continue
    return {"ip": None, "hint": "출구 IP를 조회하지 못했습니다. 잠시 후 다시 시도하세요."}


@app.get("/registry/stats", tags=["기본"])
def registry_stats():
    return station_registry.stats()
