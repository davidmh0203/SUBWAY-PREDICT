"""회원 / 즐겨찾기 경로 DB 모델."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    nickname: Mapped[str] = mapped_column(String(50))
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

    favorites: Mapped[list["FavoriteRoute"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class FavoriteRoute(Base):
    __tablename__ = "favorite_routes"
    __table_args__ = (
        # departure_time도 식별자에 포함 — 같은 경로를 출근/퇴근처럼 다른 시각으로
        # 여러 개 즐겨찾기할 수 있게 한다 (완전히 같은 시각 중복만 막는다).
        UniqueConstraint(
            "user_id",
            "start_name",
            "end_name",
            "route_key",
            "departure_time",
            name="uq_favorite_route",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    start_name: Mapped[str] = mapped_column(String(100))
    end_name: Mapped[str] = mapped_column(String(100))
    route_key: Mapped[str] = mapped_column(String(255))
    route_label: Mapped[str] = mapped_column(String(100))
    departure_time: Mapped[str] = mapped_column(String(5))  # "HH:MM" — 시:분만 저장, 날짜는 항상 오늘 기준으로 재조회
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="favorites")
