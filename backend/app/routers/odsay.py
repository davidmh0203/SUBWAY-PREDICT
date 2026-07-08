"""ODsay 디버그·역 검색 프록시 (/odsay/*)."""

from fastapi import APIRouter, HTTPException, Query

from app.odsay_client import OdsayError, is_configured, search_station

router = APIRouter(prefix="/odsay", tags=["ODsay"])


@router.get("/status")
async def odsay_status():
    return {
        "configured": is_configured(),
        "hint": "서버 호출에는 ODsay LAB에서 Server API 키 + IP 등록이 필요합니다.",
    }


@router.get("/search-station")
async def odsay_search_station(
    query: str = Query(..., min_length=1),
    cid: int | None = Query(1000),
    display_cnt: int = Query(20, alias="displayCnt"),
    normalize: bool = Query(True),
):
    """프론트 dev 테스트용 — ODsay searchStation 원본 응답 프록시."""
    if not is_configured():
        raise HTTPException(status_code=503, detail="ODSAY_API_KEY 미설정")

    try:
        data = await search_station(
            query,
            cid=cid,
            display_cnt=display_cnt,
            normalize=normalize,
        )
        return data
    except OdsayError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
