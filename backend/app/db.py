"""SQLite + SQLAlchemy 2.0 엔진/세션 설정.

회원가입/즐겨찾기용 DB. 별도 서버 없이 파일 하나로 굴리기 위해 SQLite를 쓴다.
"""

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

_DATA_DIR = Path(__file__).resolve().parent / "data"
_DATA_DIR.mkdir(exist_ok=True)

DATABASE_URL = f"sqlite:///{(_DATA_DIR / 'app.db').as_posix()}"

# FastAPI는 요청마다 다른 스레드에서 세션을 쓸 수 있어 SQLite 기본 제약(생성 스레드 전용)을 풀어줘야 함.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """앱 시작 시 1회 호출: 테이블이 없으면 생성."""
    from app import models  # noqa: F401  (Base.metadata에 등록되도록 임포트)

    Base.metadata.create_all(bind=engine)
