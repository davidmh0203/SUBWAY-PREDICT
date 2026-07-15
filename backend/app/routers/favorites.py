"""즐겨찾기 경로 (/favorites/*). 전부 로그인 필수."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FavoriteRoute, User
from app.schemas_auth import FavoriteCreateRequest, FavoriteResponse, FavoritesListResponse
from app.security import get_current_user
from app.station_registry import normalize_name

router = APIRouter(prefix="/favorites", tags=["즐겨찾기"])

# 서버에서 강제해야 하는 상한 — 프론트 검사만으로는 우회 가능
MAX_FAVORITES_PER_USER = 5


@router.get("", response_model=FavoritesListResponse)
def list_favorites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(FavoriteRoute)
        .filter(FavoriteRoute.user_id == current_user.id)
        .order_by(FavoriteRoute.created_at.desc())
        .all()
    )
    return FavoritesListResponse(favorites=rows)


@router.post("", response_model=FavoriteResponse, status_code=status.HTTP_201_CREATED)
def add_favorite(
    req: FavoriteCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    start_name = normalize_name(req.start_name)
    end_name = normalize_name(req.end_name)
    if not start_name or not end_name:
        raise HTTPException(status_code=422, detail="출발/도착역 이름이 올바르지 않습니다")
    if start_name == end_name:
        raise HTTPException(status_code=422, detail="출발역과 도착역이 같습니다")

    count = (
        db.query(FavoriteRoute)
        .filter(FavoriteRoute.user_id == current_user.id)
        .count()
    )
    if count >= MAX_FAVORITES_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"즐겨찾기는 {MAX_FAVORITES_PER_USER}개까지 저장할 수 있습니다",
        )

    dup = (
        db.query(FavoriteRoute)
        .filter(
            FavoriteRoute.user_id == current_user.id,
            FavoriteRoute.start_name == start_name,
            FavoriteRoute.end_name == end_name,
            FavoriteRoute.route_key == req.route_key,
            FavoriteRoute.departure_time == req.departure_time,
        )
        .first()
    )
    if dup:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="이미 즐겨찾기에 추가된 경로입니다"
        )

    favorite = FavoriteRoute(
        user_id=current_user.id,
        start_name=start_name,
        end_name=end_name,
        route_key=req.route_key,
        route_label=req.route_label,
        departure_time=req.departure_time,
    )
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return favorite


@router.delete("/{favorite_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    favorite_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    favorite = (
        db.query(FavoriteRoute)
        .filter(FavoriteRoute.id == favorite_id, FavoriteRoute.user_id == current_user.id)
        .first()
    )
    # 다른 유저 소유여도 동일하게 404 — 존재 여부를 노출하지 않음
    if not favorite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="즐겨찾기를 찾을 수 없습니다")

    db.delete(favorite)
    db.commit()
