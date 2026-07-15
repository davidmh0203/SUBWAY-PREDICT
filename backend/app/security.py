"""비밀번호 해싱 + JWT 발급/검증.

passlib는 안 쓴다 — passlib가 bcrypt 4.x와 호환 문제가 있어서 bcrypt 라이브러리를 직접 사용.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import JWT_ALGORITHM, JWT_EXPIRE_MINUTES, JWT_SECRET
from app.db import get_db
from app.models import User

# bcrypt는 72바이트를 넘는 입력을 조용히 잘라버려서, 그 전에 명시적으로 거부한다.
_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    raw = password.encode("utf-8")
    if len(raw) > _BCRYPT_MAX_BYTES:
        raise ValueError("비밀번호는 72바이트를 초과할 수 없습니다.")
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    raw = password.encode("utf-8")
    if len(raw) > _BCRYPT_MAX_BYTES:
        return False
    return bcrypt.checkpw(raw, password_hash.encode("utf-8"))


def create_access_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다"
        )
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다"
        )

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다"
        )
    return user
