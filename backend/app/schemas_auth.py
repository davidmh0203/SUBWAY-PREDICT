"""회원가입/로그인/즐겨찾기 스키마.

기존 app/schemas.py와 분리 — 팀원이 작업 중인 파일과 충돌을 피하기 위함.
"""

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ---------- 인증 ----------
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    nickname: str = Field(min_length=1, max_length=50)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    nickname: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------- 즐겨찾기 ----------
_TIME_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"  # "HH:MM" 24시간제


class FavoriteCreateRequest(BaseModel):
    start_name: str
    end_name: str
    route_key: str
    route_label: str
    departure_time: str = Field(pattern=_TIME_PATTERN)


class FavoriteResponse(BaseModel):
    id: int
    start_name: str
    end_name: str
    route_key: str
    route_label: str
    departure_time: str
    created_at: datetime

    class Config:
        from_attributes = True


class FavoritesListResponse(BaseModel):
    favorites: list[FavoriteResponse]
