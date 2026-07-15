"""회원가입/로그인/내 정보 (/auth/*)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas_auth import LoginRequest, SignupRequest, TokenResponse, UserResponse
from app.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["인증"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(req: SignupRequest, db: Session = Depends(get_db)):
    exists = db.query(User).filter(User.email == req.email).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 가입된 이메일입니다")

    try:
        password_hash = hash_password(req.password)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    user = User(email=req.email, nickname=req.nickname, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, nickname=user.nickname),
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    # 가입 여부 노출 방지: 이메일 없음/비밀번호 틀림 모두 같은 메시지로 응답
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다",
        )

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user.id, email=user.email, nickname=user.nickname),
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse(id=current_user.id, email=current_user.email, nickname=current_user.nickname)
