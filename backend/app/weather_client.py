"""기상청 단기예보 조회서비스 2.0 (공공데이터포털).

DATA_GO_API_KEY(Decoding) + 단기예보 활용신청 필요.
좌표(lat/lng) → 격자(nx, ny) 변환 후
getUltraSrtNcst / getUltraSrtFcst / getVilageFcst 조회.
실패 시 Open-Meteo로 soft fallback.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from app.config import DATA_GO_API_KEY
from app.ttl_cache import cache_get, cache_set

KST = ZoneInfo("Asia/Seoul")
KMA_BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0"
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
WEATHER_TTL = 600
DEFAULT_LAT = 37.5665
DEFAULT_LNG = 126.9780

# 단기예보 발표 시각 (KST)
VILAGE_BASE_HOURS = (2, 5, 8, 11, 14, 17, 20, 23)

PTY_LABEL = {
    "0": None,
    "1": "비",
    "2": "비/눈",
    "3": "눈",
    "4": "소나기",
    "5": "빗방울",
    "6": "빗방울눈날림",
    "7": "눈날림",
}

SKY_LABEL = {
    "1": "맑음",
    "3": "구름많음",
    "4": "흐림",
}


def latlng_to_grid(lat: float, lon: float) -> tuple[int, int]:
    """위경도 → 기상청 단기예보 격자(nx, ny)."""
    re = 6371.00877
    grid = 5.0
    slat1 = 30.0
    slat2 = 60.0
    olon = 126.0
    olat = 38.0
    xo = 43
    yo = 136

    degrad = math.pi / 180.0
    re /= grid
    slat1 *= degrad
    slat2 *= degrad
    olon *= degrad
    olat *= degrad

    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(math.pi * 0.25 + slat1 * 0.5)
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = (sf**sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / (ro**sn)

    ra = math.tan(math.pi * 0.25 + lat * degrad * 0.5)
    ra = re * sf / (ra**sn)
    theta = lon * degrad - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn

    x = ra * math.sin(theta) + xo + 0.5
    y = ro - ra * math.cos(theta) + yo + 0.5
    return int(x), int(y)


def _latest_vilage_base(now: datetime) -> tuple[str, str]:
    """현재 시각 기준 가용한 최신 단기예보 base_date / base_time."""
    cursor = now.astimezone(KST).replace(minute=0, second=0, microsecond=0)
    # 발표 후 약 10분 지나야 안정 → 10분 여유
    available = cursor - timedelta(minutes=10)
    for _ in range(48):
        if available.hour in VILAGE_BASE_HOURS:
            return available.strftime("%Y%m%d"), f"{available.hour:02d}00"
        available -= timedelta(hours=1)
    return now.strftime("%Y%m%d"), "0200"


def _ultra_base(now: datetime) -> tuple[str, str]:
    """초단기: 매시 30분 발표. 40분 이전이면 이전 시 base."""
    t = now.astimezone(KST)
    if t.minute < 40:
        t = t - timedelta(hours=1)
    return t.strftime("%Y%m%d"), f"{t.hour:02d}30"


def _items(payload: dict[str, Any]) -> list[dict[str, Any]]:
    body = (payload.get("response") or {}).get("body") or {}
    header = (payload.get("response") or {}).get("header") or {}
    code = str(header.get("resultCode") or "")
    if code and code not in ("00", "0"):
        return []
    items = (body.get("items") or {}).get("item")
    if items is None:
        return []
    if isinstance(items, dict):
        return [items]
    return [i for i in items if isinstance(i, dict)]


async def _kma_get(
    client: httpx.AsyncClient,
    path: str,
    *,
    base_date: str,
    base_time: str,
    nx: int,
    ny: int,
    num_of_rows: int = 1000,
) -> list[dict[str, Any]]:
    if not DATA_GO_API_KEY:
        return []
    url = f"{KMA_BASE}/{path}"
    params = {
        "serviceKey": DATA_GO_API_KEY,
        "pageNo": "1",
        "numOfRows": str(num_of_rows),
        "dataType": "JSON",
        "base_date": base_date,
        "base_time": base_time,
        "nx": str(nx),
        "ny": str(ny),
    }
    try:
        res = await client.get(url, params=params, timeout=15.0)
        res.raise_for_status()
        # 간혹 XML 오류 본문
        if "application/json" not in (res.headers.get("content-type") or "") and res.text.lstrip().startswith("<"):
            return []
        return _items(res.json())
    except (httpx.HTTPError, ValueError, TypeError):
        return []


def _bucket_by_fcst(items: list[dict[str, Any]]) -> dict[tuple[str, str], dict[str, str]]:
    buckets: dict[tuple[str, str], dict[str, str]] = {}
    for it in items:
        fd = str(it.get("fcstDate") or "")
        ft = str(it.get("fcstTime") or "")
        cat = str(it.get("category") or "")
        val = str(it.get("fcstValue") if it.get("fcstValue") is not None else it.get("obsrValue") or "")
        if not fd or not ft or not cat:
            # 실황은 base만 있음
            if it.get("baseDate") and it.get("category") and "obsrValue" in it:
                fd = str(it.get("baseDate"))
                ft = str(it.get("baseTime") or "0000")
            else:
                continue
        key = (fd, ft)
        buckets.setdefault(key, {})[cat] = val
    return buckets


def _nearest_slot(
    buckets: dict[tuple[str, str], dict[str, str]],
    when: datetime,
) -> tuple[tuple[str, str], dict[str, str]] | None:
    if not buckets:
        return None
    target = when.astimezone(KST)
    target_min = target.hour * 60 + target.minute
    target_day = target.strftime("%Y%m%d")

    best = None
    best_diff = 10**9
    for (fd, ft), cats in buckets.items():
        if len(ft) < 4:
            continue
        try:
            hm = int(ft[:2]) * 60 + int(ft[2:4])
        except ValueError:
            continue
        # 날짜 차이
        try:
            d0 = datetime.strptime(fd, "%Y%m%d").replace(tzinfo=KST)
        except ValueError:
            continue
        day_delta = (d0.date() - target.date()).days
        diff = abs(day_delta * 24 * 60 + hm - target_min)
        if fd == target_day:
            diff -= 1  # 같은 날 가산
        if diff < best_diff:
            best_diff = diff
            best = ((fd, ft), cats)
    return best


def _parse_rain_mm(pcp: str | None) -> float:
    if not pcp or pcp in ("-", "강수없음"):
        return 0.0
    # "1.0mm" / "1mm 미만" 등
    cleaned = pcp.replace("mm", "").replace("미만", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        if "미만" in pcp or cleaned.startswith("1"):
            return 0.5
        return 0.0


def _slot_to_summary(cats: dict[str, str]) -> dict[str, Any]:
    tmp_raw = cats.get("TMP") or cats.get("T1H")
    try:
        temp = float(tmp_raw) if tmp_raw not in (None, "") else None
    except ValueError:
        temp = None

    pty = str(cats.get("PTY") or "0")
    pop_raw = cats.get("POP")
    try:
        pop = int(pop_raw) if pop_raw not in (None, "") else 0
    except ValueError:
        pop = 0

    precip = _parse_rain_mm(cats.get("PCP") or cats.get("RN1"))
    sky = str(cats.get("SKY") or "")
    is_rain = pty not in ("0", "") or precip > 0 or pop >= 60

    return {
        "temperature": temp,
        "pty": pty,
        "ptyLabel": PTY_LABEL.get(pty),
        "pop": pop,
        "precipitation": precip,
        "sky": sky,
        "skyLabel": SKY_LABEL.get(sky),
        "isRain": is_rain,
        "reh": cats.get("REH"),
    }


def _near_future_rain(
    buckets: dict[tuple[str, str], dict[str, str]],
    when: datetime,
    hours: int = 3,
) -> list[dict[str, Any]]:
    """설정 시각 전후 인근(기본 +0~+3h) 강수 특이 시각."""
    base = when.astimezone(KST).replace(minute=0, second=0, microsecond=0)
    out: list[dict[str, Any]] = []
    for h in range(0, hours + 1):
        t = base + timedelta(hours=h)
        fd = t.strftime("%Y%m%d")
        ft = f"{t.hour:02d}00"
        cats = buckets.get((fd, ft))
        if not cats:
            # 초단기는 매시 정각/30분
            cats = buckets.get((fd, f"{t.hour:02d}30"))
        if not cats:
            continue
        summary = _slot_to_summary(cats)
        if summary["isRain"]:
            out.append(
                {
                    "hour": t.hour,
                    "date": fd,
                    "ptyLabel": summary["ptyLabel"] or "강수",
                    "pop": summary["pop"],
                    "temperature": summary["temperature"],
                }
            )
    return out


async def _fetch_kma(
    lat: float,
    lng: float,
    when: datetime,
) -> dict[str, Any] | None:
    nx, ny = latlng_to_grid(lat, lng)
    now = datetime.now(KST)
    when = when.astimezone(KST)

    async with httpx.AsyncClient() as client:
        base_date, base_time = _latest_vilage_base(now)
        vilage_items = await _kma_get(
            client,
            "getVilageFcst",
            base_date=base_date,
            base_time=base_time,
            nx=nx,
            ny=ny,
        )
        buckets = _bucket_by_fcst(vilage_items)

        # 가까운 미래(~6h)면 초단기예보로 보강
        delta_h = (when - now).total_seconds() / 3600.0
        if -1 <= delta_h <= 6:
            ub_date, ub_time = _ultra_base(now)
            ultra_items = await _kma_get(
                client,
                "getUltraSrtFcst",
                base_date=ub_date,
                base_time=ub_time,
                nx=nx,
                ny=ny,
                num_of_rows=60,
            )
            for key, cats in _bucket_by_fcst(ultra_items).items():
                buckets.setdefault(key, {}).update(cats)

            # 실황 (현재 ±1.5h)
            if abs(delta_h) < 1.5:
                ncst_t = now.replace(minute=0, second=0, microsecond=0)
                if now.minute < 40:
                    ncst_t -= timedelta(hours=1)
                ncst_items = await _kma_get(
                    client,
                    "getUltraSrtNcst",
                    base_date=ncst_t.strftime("%Y%m%d"),
                    base_time=ncst_t.strftime("%H00"),
                    nx=nx,
                    ny=ny,
                    num_of_rows=20,
                )
                for it in ncst_items:
                    cat = str(it.get("category") or "")
                    val = str(it.get("obsrValue") or "")
                    if cat:
                        buckets.setdefault(
                            (ncst_t.strftime("%Y%m%d"), ncst_t.strftime("%H00")),
                            {},
                        )[cat] = val

        picked = _nearest_slot(buckets, when)
        if not picked:
            return None
        (fd, ft), cats = picked
        summary = _slot_to_summary(cats)
        near = _near_future_rain(buckets, when, hours=3)

        return {
            **summary,
            "lat": lat,
            "lng": lng,
            "nx": nx,
            "ny": ny,
            "forDate": f"{fd[:4]}-{fd[4:6]}-{fd[6:8]}",
            "forHour": int(ft[:2]) if len(ft) >= 2 else when.hour,
            "forTime": ft,
            "source": "kma",
            "nearFutureRain": near,
            "weatherCode": 61 if summary["isRain"] else 0,
        }


async def _fetch_open_meteo(
    lat: float,
    lng: float,
    when: datetime,
) -> dict[str, Any] | None:
    day = when.astimezone(KST).date()
    hour = when.hour
    today = datetime.now(KST).date()
    if day == today:
        params: dict[str, Any] = {
            "latitude": lat,
            "longitude": lng,
            "current": "temperature_2m,precipitation,weather_code,rain",
            "timezone": "Asia/Seoul",
        }
    else:
        params = {
            "latitude": lat,
            "longitude": lng,
            "hourly": "temperature_2m,precipitation,weather_code,rain",
            "start_date": day.isoformat(),
            "end_date": day.isoformat(),
            "timezone": "Asia/Seoul",
        }
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(OPEN_METEO_URL, params=params, timeout=12.0)
            res.raise_for_status()
            data = res.json()
    except (httpx.HTTPError, ValueError, KeyError):
        return None

    if day == today:
        current = data.get("current") or {}
        temp = current.get("temperature_2m")
        precip = float(current.get("precipitation") or current.get("rain") or 0)
        code = int(current.get("weather_code") or 0)
    else:
        hourly = data.get("hourly") or {}
        times = hourly.get("time") or []
        temps = hourly.get("temperature_2m") or []
        precips = hourly.get("precipitation") or hourly.get("rain") or []
        codes = hourly.get("weather_code") or []
        target = f"{day.isoformat()}T{hour:02d}:00"
        idx = times.index(target) if target in times else min(hour, max(len(times) - 1, 0))
        temp = temps[idx] if idx < len(temps) else None
        precip = float(precips[idx]) if idx < len(precips) else 0.0
        code = int(codes[idx]) if idx < len(codes) else 0

    is_rain = precip > 0.1 or code >= 51
    return {
        "temperature": temp,
        "precipitation": precip,
        "weatherCode": code,
        "isRain": is_rain,
        "pty": "1" if is_rain else "0",
        "ptyLabel": "비" if is_rain else None,
        "pop": 70 if is_rain else 0,
        "skyLabel": None,
        "lat": lat,
        "lng": lng,
        "forDate": day.isoformat(),
        "forHour": hour,
        "source": "open-meteo",
        "nearFutureRain": [],
    }


async def fetch_current_weather(
    lat: float | None = None,
    lng: float | None = None,
    at: datetime | None = None,
) -> dict[str, Any] | None:
    lat_v = float(lat) if lat is not None else DEFAULT_LAT
    lng_v = float(lng) if lng is not None else DEFAULT_LNG
    when = at.astimezone(KST) if at is not None else datetime.now(KST)

    cache_key = f"wx:kma:{round(lat_v, 3)}:{round(lng_v, 3)}:{when.date().isoformat()}:{when.hour}"
    cached = cache_get(cache_key, WEATHER_TTL)
    if cached is not None:
        return cached

    result = None
    if DATA_GO_API_KEY:
        result = await _fetch_kma(lat_v, lng_v, when)
    if result is None:
        result = await _fetch_open_meteo(lat_v, lng_v, when)
    if result is None:
        return None

    cache_set(cache_key, result)
    return result
