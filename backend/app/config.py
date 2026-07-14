"""환경 변수 설정."""

import os
from pathlib import Path

from dotenv import load_dotenv

# 루트 .env (프론트와 공유) + backend/.env
_root = Path(__file__).resolve().parents[2]
load_dotenv(_root / ".env")
load_dotenv(_root / "backend" / ".env")

ODSAY_API_KEY = os.getenv("ODSAY_API_KEY", "").strip()
ODSAY_API_BASE = os.getenv("ODSAY_API_BASE", "https://api.odsay.com/v1/api").rstrip("/")
ODSAY_SEOUL_CID = int(os.getenv("ODSAY_SEOUL_CID", "1000"))
# 1/true 이면 ODsay를 호출하지 않고 픽스처·목업만 사용 (키 없어도 MVP 테스트)
ODSAY_FORCE_MOCK = os.getenv("ODSAY_FORCE_MOCK", "").strip().lower() in (
    "1",
    "true",
    "yes",
)

DATA_GO_API_KEY = os.getenv("DATA_GO_API_KEY", "").strip()
SPCDE_API_BASE = os.getenv(
    "SPCDE_API_BASE",
    "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService",
).rstrip("/")
