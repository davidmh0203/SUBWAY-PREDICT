"""ODsay 디버그·역 검색·길찾기 프록시 (/odsay/*)."""

from fastapi import APIRouter, HTTPException, Query

from app.odsay_client import (
    OdsayError,
    is_configured,
    search_pub_trans_path,
    search_station,
)
from app.odsay_service import resolve_station_coords

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


def _line_names(subpath: dict) -> list[str]:
    lanes = subpath.get("lane") or []
    names: list[str] = []
    for lane in lanes:
        name = lane.get("name") or lane.get("subwayCode")
        if name:
            names.append(str(name))
    return names


def _summarize_path(path_item: dict) -> dict:
    """ODsay path 1건 → 소요시간/환승/노선 요약."""
    info = path_item.get("info") or {}
    subways = [
        sp for sp in path_item.get("subPath", []) if sp.get("trafficType") == 1
    ]
    lines: list[str] = []
    for sp in subways:
        lines.extend(_line_names(sp))

    return {
        "total_time_min": info.get("totalTime"),
        "transfer_count": info.get("subwayTransitCount"),
        "payment": info.get("payment"),
        "lines": lines,
        "first_station": info.get("firstStartStation"),
        "last_station": info.get("lastEndStation"),
        "total_stop_count": info.get("busStationCount", 0)
        + info.get("subwayStationCount", 0),
    }


@router.get("/path")
async def odsay_path(
    start: str = Query(..., min_length=2, description="출발역 이름 (예: 강남)"),
    end: str = Query(..., min_length=2, description="도착역 이름 (예: 서울역)"),
    raw: bool = Query(False, description="true면 ODsay 원본 JSON 전체를 반환"),
):
    """출발·도착역 이름으로 ODsay 길찾기(searchPubTransPathT)를 직접 테스트.

    /predict/route와 달리 mock으로 fallback하지 않고, ODsay 오류를 그대로 502로
    노출합니다. → 길찾기 자체가 되는지 진단하는 용도.
    """
    if not is_configured():
        raise HTTPException(status_code=503, detail="ODSAY_API_KEY 미설정")

    try:
        _, sx, sy = await resolve_station_coords(start)
        _, ex, ey = await resolve_station_coords(end)
        data = await search_pub_trans_path(sx, sy, ex, ey, search_path_type=1)
    except OdsayError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if raw:
        return data

    paths = (data.get("result") or {}).get("path") or []
    return {
        "start": start,
        "end": end,
        "coords": {"start": [sx, sy], "end": [ex, ey]},
        "path_count": len(paths),
        "summaries": [_summarize_path(p) for p in paths[:5]],
    }