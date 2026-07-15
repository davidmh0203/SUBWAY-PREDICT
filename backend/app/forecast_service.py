"""오늘의 정체 예보 카드 합성 (공휴일·날씨·ntce·SPATIC)."""

from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.calendar_service import get_day_context
from app.csv_store import load_ntce_crowd_events, load_spatic_events
from app.ntce_client import fetch_ntce_for_day
from app.weather_client import fetch_current_weather

KST = ZoneInfo("Asia/Seoul")

CROWD_KEYWORDS = ("시위", "집회", "전장연", "무정차", "혼잡", "지연", "장애", "고장", "화재")


def _norm(s: str | None) -> str:
    return re.sub(r"\s+", "", (s or "").strip())


def _station_hit(text: str, stations: list[str]) -> list[str]:
    hits: list[str] = []
    blob = _norm(text)
    for name in stations:
        n = _norm(name).replace("역", "")
        if len(n) < 2:
            continue
        if n in blob or f"{n}역" in blob:
            hits.append(name)
    return hits


def _parse_hhmm(raw: str | None) -> time | None:
    if not raw:
        return None
    m = re.search(r"(\d{1,2})\s*:\s*(\d{2})", raw)
    if not m:
        return None
    h, mi = int(m.group(1)), int(m.group(2))
    if h > 23 or mi > 59:
        return None
    return time(h, mi)


def _personnel_score(raw: str | None) -> int:
    if not raw:
        return 0
    nums = [int(x.replace(",", "")) for x in re.findall(r"\d[\d,]*", raw)]
    if not nums:
        return 0
    return min(max(nums), 50_000)


def _card(
    *,
    id_: str,
    priority: int,
    impact: int,
    emoji: str,
    title: str,
    summary: str,
    category: str | None = None,
    highlight: str | None = None,
    lines: list[str] | None = None,
) -> dict[str, Any]:
    # lines가 없으면 summary를 문장·중점으로 나눠 개조식에 가깝게 만든다
    bullet_lines = [ln.strip() for ln in (lines or []) if ln and str(ln).strip()]
    if not bullet_lines and summary:
        parts = re.split(r"(?<=[.!?다요음])\s+| · ", summary)
        bullet_lines = [p.strip(" ·") for p in parts if p and p.strip(" ·")]
        if len(bullet_lines) <= 1:
            bullet_lines = [summary.strip()]

    out: dict[str, Any] = {
        "id": id_,
        "priority": priority,
        "impactScore": impact,
        "emoji": emoji,
        "title": title,
        "summary": summary,
        "lines": bullet_lines,
    }
    if category:
        out["category"] = category
    if highlight:
        out["highlight"] = highlight
    return out


def _spatic_time_relevant(row: dict[str, str], now: datetime) -> bool:
    """당일 일정 중 현재±3h 또는 아직 끝나지 않은 일정이면 True."""
    start = _parse_hhmm(row.get("time_start"))
    end = _parse_hhmm(row.get("time_end"))
    now_t = now.time()
    if start is None and end is None:
        return True
    # 분에 가까운 비교
    def mins(t: time) -> int:
        return t.hour * 60 + t.minute

    now_m = mins(now_t)
    window = 3 * 60
    if start and end:
        s, e = mins(start), mins(end)
        if e < s:
            e += 24 * 60
        return (s - window) <= now_m <= (e + window)
    if start:
        return abs(now_m - mins(start)) <= window or now_m <= mins(start) + window
    if end:
        return now_m <= mins(end) + window
    return True


def _build_holiday_cards(day_ctx: dict[str, Any], at: datetime) -> list[dict[str, Any]]:
    hour = at.astimezone(KST).hour
    if 7 <= hour <= 9:
        tip = "지금은 출근 시간대예요. 주요 노선 혼잡이 높을 수 있으니 여유 시간을 확보하세요."
        title = "출근 시간대 안내"
    elif 17 <= hour <= 20:
        tip = "지금은 퇴근 시간대예요. 주요 노선 혼잡이 높을 수 있으니 여유 시간을 확보하세요."
        title = "퇴근 시간대 안내"
    else:
        tip = "7~9시·18~20시 주요 노선 혼잡이 높을 수 있어요. 여유 시간 확보를 권장합니다."
        title = "출근·퇴근 시간대 안내"

    if not day_ctx.get("isHoliday"):
        return [
            _card(
                id_="commute-weekday",
                priority=5,
                impact=60,
                emoji="📢",
                title=title,
                summary=tip,
                lines=[
                    tip,
                    "혼잡이 큰 시간: 아침 7~9시 · 저녁 18~20시",
                    "가능하면 여유 시간을 두고 출발하세요.",
                ],
                category="commute",
            )
        ]
    name = day_ctx.get("holidayName") or "공휴일"
    return [
        _card(
            id_="commute-holiday",
            priority=4,
            impact=55,
            emoji="📅",
            title=f"{at.month}/{at.day}은 {name}",
            summary="출퇴근 시간대 혼잡은 평소보다 낮을 수 있어요. 관광·나들이 구간은 따로 붐빌 수 있어요.",
            lines=[
                f"{name}이에요.",
                "출퇴근(7~9시·18~20시) 혼잡은 평소보다 낮을 수 있어요.",
                "관광·나들이 구간은 따로 붐빌 수 있어요.",
            ],
            category="commute",
            highlight=f"{name}이에요. 7~9시·18~20시 혼잡은 평소보다 낮을 수 있어요.",
        )
    ]


def _build_weather_cards(wx: dict[str, Any] | None, _at: datetime) -> list[dict[str, Any]]:
    if not wx:
        return [
            _card(
                id_="weather-missing",
                priority=6,
                impact=30,
                emoji="🌡️",
                title="날씨 정보를 불러오지 못함",
                summary="기상청 단기예보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.",
                lines=[
                    "기상청 단기예보를 가져오지 못했어요.",
                    "잠시 후 다시 시도해 주세요.",
                ],
                category="weather",
            )
        ]

    temp = wx.get("temperature")
    temp_s = f"{temp:.0f}°C" if isinstance(temp, (int, float)) else "—"
    sky = wx.get("skyLabel")
    pty = wx.get("ptyLabel")
    pop = wx.get("pop") or 0
    near = wx.get("nearFutureRain") or []

    lines = [f"기온 {temp_s}"]
    if sky:
        lines.append(f"하늘 {sky}")
    if pty:
        lines.append(f"강수 {pty}")
    if pop:
        lines.append(f"강수확률 {pop}%")
    if near:
        hours = ", ".join(f"{n['hour']:02d}시" for n in near[:3])
        labels = near[0].get("ptyLabel") or "강수"
        lines.append(f"인근 시간대({hours})에도 {labels} 소식")

    summary = " · ".join(lines)
    if wx.get("isRain") or near:
        lines.append("우천 시 지하철 이용이 늘어 혼잡이 커질 수 있어요.")
        return [
            _card(
                id_="weather-rain",
                priority=3,
                impact=95,
                emoji="🌧️",
                title="비·강수 예보 · 혼잡 주의",
                summary=summary,
                lines=lines,
                category="weather",
            )
        ]

    return [
        _card(
            id_="weather-clear",
            priority=6,
            impact=40,
            emoji="🌤️",
            title="날씨 예보",
            summary=summary,
            lines=lines,
            category="weather",
        )
    ]


def _normalize_ntce_item(item: dict[str, Any]) -> dict[str, str]:
    def g(*keys: str) -> str:
        for k in keys:
            v = item.get(k)
            if v is not None and str(v).strip():
                return str(v).strip()
        return ""

    return {
        "noft_ttl": g("noftTtl", "noft_ttl"),
        "noft_cn": g("noftCn", "noft_cn"),
        "nonstop_yn": g("nonstopYn", "nonstop_yn"),
        "line_nm_lst": g("lineNmLst", "line_nm_lst", "lineNm", "line_nm"),
        "noft_ocrn_dt": g("noftOcrnDt", "noft_ocrn_dt"),
        "xcse_sitn_end_dt": g("xcseSitnEndDt", "xcse_sitn_end_dt"),
        "primary_tag": "",
    }


def _ntce_from_csv_days(day_isos: list[str]) -> list[dict[str, str]]:
    """CSV 폴백: 지정 일자(최신 우선)의 알림."""
    ymds = {d.replace("-", "") for d in day_isos}
    days = set(day_isos)
    out: list[dict[str, str]] = []
    for row in load_ntce_crowd_events():
        crtr = (row.get("crtr_ymd") or "").strip()
        ocrn = (row.get("noft_ocrn_dt") or "")[:10]
        if crtr in ymds or ocrn in days:
            out.append(row)
    return out


def _spatic_dates_to_scan(today: date, lookback: int = 3, lookahead: int = 1) -> list[str]:
    """오늘 → 향후 → 최근 순으로 스캔할 날짜 목록."""
    ordered: list[str] = [today.isoformat()]
    for i in range(1, lookahead + 1):
        ordered.append((today + timedelta(days=i)).isoformat())
    for i in range(1, lookback + 1):
        ordered.append((today - timedelta(days=i)).isoformat())
    return ordered


def _build_ntce_cards(
    items: list[dict[str, str]],
    stations: list[str],
    *,
    prefer_nearby: bool,
) -> list[dict[str, Any]]:
    scored: list[tuple[int, dict[str, Any]]] = []
    for i, raw in enumerate(items):
        title = raw.get("noft_ttl") or "지하철 운행 알림"
        body = raw.get("noft_cn") or ""
        lines = raw.get("line_nm_lst") or ""
        blob = f"{title} {body} {lines}"
        hits = _station_hit(blob, stations)
        nonstop = (raw.get("nonstop_yn") or "").upper() == "Y" or "무정차" in blob
        crowdish = any(k in blob for k in CROWD_KEYWORDS)
        if not nonstop and not crowdish and not hits:
            # 전역 저관련은 스킵 (너무 많은 잡알림)
            if prefer_nearby:
                continue
            if not any(k in blob for k in ("시위", "집회", "전장연", "무정차")):
                continue

        impact = 70
        if nonstop:
            impact += 40
        if hits:
            impact += 25
        if "시위" in blob or "집회" in blob:
            impact += 20
        impact = min(impact, 160)

        near_hits = hits[:2]
        body_snip = (body or "").strip()
        if len(body_snip) > 100:
            body_snip = body_snip[:100] + "…"
        line_items = [title]
        if near_hits:
            line_items.append(f"인근 역: {', '.join(near_hits)}")
        if lines.strip():
            line_items.append(f"호선: {lines.strip()}")
        if body_snip and body_snip != title:
            line_items.append(body_snip)
        if nonstop:
            line_items.append("무정차·돌발 운행 영향이 있을 수 있어요.")

        near = f" · 인근 {', '.join(near_hits)}" if near_hits else ""
        emoji = "🚨" if nonstop else "🚇"
        prio = 1 if (nonstop or hits) else 2
        scored.append(
            (
                impact,
                _card(
                    id_=f"ntce-{i}-{abs(hash(title)) % 10_000}",
                    priority=prio,
                    impact=impact,
                    emoji=emoji,
                    title=("무정차·돌발" if nonstop else "운행 알림") + near,
                    summary=(title + (" — " + body[:120] if body else ""))[:180],
                    lines=line_items,
                    category="disruption",
                ),
            )
        )

    scored.sort(key=lambda x: -x[0])
    limit = 3 if prefer_nearby else 2
    return [c for _, c in scored[:limit]]


def _build_spatic_cards(
    event_date: str,
    now: datetime,
    stations: list[str],
    *,
    prefer_nearby: bool,
    date_note: str | None = None,
) -> list[dict[str, Any]]:
    scored: list[tuple[int, dict[str, Any]]] = []
    today_iso = now.date().isoformat()
    for i, row in enumerate(load_spatic_events()):
        if (row.get("event_date") or "").strip() != event_date:
            continue
        rtype = (row.get("record_type") or "").strip()
        if rtype not in ("assembly", "event", "pre_march"):
            continue
        # 오늘만 시간 윈도우 필터, 과거/미래 일자 카드는 날짜 매칭만
        if event_date == today_iso and not _spatic_time_relevant(row, now):
            continue

        place = " ".join(
            filter(
                None,
                [
                    row.get("place_primary"),
                    row.get("place_raw"),
                    row.get("crowd_focus_points"),
                    row.get("march_start"),
                    row.get("march_end"),
                    row.get("event_name"),
                ],
            )
        )
        hits = _station_hit(place, stations)
        if prefer_nearby and stations and not hits:
            if _personnel_score(row.get("personnel_raw")) < 3000:
                continue

        personnel = _personnel_score(row.get("personnel_raw"))
        impact = 80 + min(personnel // 200, 50)
        if hits:
            impact += 30
        if rtype == "event":
            impact += 5
        # 오늘이 아니면 약간 낮춤
        if event_date != today_iso:
            impact = max(impact - 15, 40)
        impact = min(impact, 170)

        t0 = row.get("time_start") or ""
        t1 = row.get("time_end") or ""
        when = f"{t0}~{t1}".strip("~") or (row.get("time_raw") or "")[:40]
        loc = (row.get("place_primary") or row.get("place_raw") or "장소 미상")[:40]
        name = (row.get("event_name") or "").strip()
        label = "행사" if rtype == "event" else "집회·시위"
        title_core = name or f"{label} · {loc}"
        near = f" · 인근 {', '.join(hits[:2])}" if hits else ""
        people = f"약 {personnel:,}명" if personnel else ""
        note = date_note or ""
        bullet = []
        if note:
            bullet.append(note)
        if when:
            bullet.append(f"시간 {when}")
        bullet.append(f"장소 {loc}")
        if people:
            bullet.append(f"인원 {people}")
        if hits:
            bullet.append(f"인근 역 {', '.join(hits[:2])}")
        bullet.append("인근 역 혼잡·통제 가능성이 있어요.")

        scored.append(
            (
                impact,
                _card(
                    id_=f"spatic-{row.get('post_id')}-{row.get('seq_no')}-{i}",
                    priority=1 if hits or personnel >= 5000 else 2,
                    impact=impact,
                    emoji="📣" if rtype != "event" else "🎉",
                    title=(title_core + near)[:48],
                    summary=f"{note}{when} · {loc}{(' · ' + people) if people else ''}. 인근 역 혼잡·통제 가능성이 있어요.",
                    lines=bullet,
                    category="protest" if rtype != "event" else "event",
                ),
            )
        )

    scored.sort(key=lambda x: -x[0])
    return [c for _, c in scored[:3]]


def _collect_spatic_cards(
    at: datetime,
    stations: list[str],
    *,
    prefer_nearby: bool,
) -> tuple[list[dict[str, Any]], str]:
    """선택 일자(at)의 집회·행사만. 근처 필터로 비면 전역 재시도."""
    day = at.astimezone(KST).date().isoformat()
    cards = _build_spatic_cards(
        day,
        at,
        stations,
        prefer_nearby=prefer_nearby,
        date_note=None,
    )
    if cards:
        return cards, day
    if prefer_nearby and stations:
        wide = _build_spatic_cards(
            day,
            at,
            stations,
            prefer_nearby=False,
            date_note=None,
        )
        if wide:
            return wide, day
    return [], "none"


def _empty_disruption_card(day_label: str) -> dict[str, Any]:
    return _card(
        id_="empty-ntce",
        priority=7,
        impact=35,
        emoji="🚇",
        title="지하철 돌발 알림 없음",
        summary=f"{day_label} 기준 시위·무정차 등 등록된 지하철 돌발 알림이 없어요.",
        lines=[
            f"기준일 {day_label}",
            "시위·무정차 등 등록된 지하철 돌발 알림이 없어요.",
        ],
        category="empty-disruption",
    )


def _empty_protest_card(day_label: str) -> dict[str, Any]:
    return _card(
        id_="empty-spatic",
        priority=7,
        impact=35,
        emoji="📣",
        title="집회·행사 정보 없음",
        summary=f"{day_label} 등록된 집회·행사 예고가 없어요. (SPATIC 수집 기준)",
        lines=[
            f"기준일 {day_label}",
            "등록된 집회·행사 예고가 없어요.",
            "출처: 서울경찰청 집회·통제정보(SPATIC)",
        ],
        category="empty-protest",
    )


def _dedupe_cards(cards: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for c in cards:
        key = f"{c.get('title')}|{c.get('summary', '')[:40]}"
        if key in seen:
            continue
        seen.add(key)
        out.append(c)
    return out


def _parse_at(at: datetime | str | None) -> datetime:
    if at is None:
        return datetime.now(KST)
    if isinstance(at, datetime):
        if at.tzinfo is None:
            return at.replace(tzinfo=KST)
        return at.astimezone(KST)
    # ISO 문자열
    try:
        raw = str(at).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=KST)
        return parsed.astimezone(KST)
    except ValueError:
        return datetime.now(KST)


async def build_forecast_cards(
    *,
    lat: float | None = None,
    lng: float | None = None,
    stations: list[str] | None = None,
    at: datetime | str | None = None,
) -> dict[str, Any]:
    when = _parse_at(at)
    day = when.date()
    day_iso = day.isoformat()
    day_label = f"{day.month}/{day.day}"
    station_list = [s.strip() for s in (stations or []) if s and s.strip()]
    prefer_nearby = bool(station_list)

    day_ctx = await get_day_context(day)
    wx = await fetch_current_weather(lat, lng, at=when)

    live_ntce = await fetch_ntce_for_day(day)
    if live_ntce:
        ntce_rows = [_normalize_ntce_item(x) for x in live_ntce]
        ntce_source = "live"
    else:
        ntce_rows = _ntce_from_csv_days([day_iso])
        ntce_source = "csv" if ntce_rows else "none"

    spatic_cards, spatic_day = _collect_spatic_cards(
        when, station_list, prefer_nearby=prefer_nearby
    )

    ntce_cards = _build_ntce_cards(
        ntce_rows, station_list, prefer_nearby=prefer_nearby
    )
    if prefer_nearby and station_list and not ntce_cards and ntce_rows:
        ntce_cards = _build_ntce_cards(
            ntce_rows, station_list, prefer_nearby=False
        )

    cards: list[dict[str, Any]] = []
    if ntce_cards:
        cards.extend(ntce_cards)
    else:
        cards.append(_empty_disruption_card(day_label))

    if spatic_cards:
        cards.extend(spatic_cards)
    else:
        cards.append(_empty_protest_card(day_label))

    cards.extend(_build_weather_cards(wx, when))
    cards.extend(_build_holiday_cards(day_ctx, when))

    cards = _dedupe_cards(cards)
    cards.sort(key=lambda c: (c["priority"], -c["impactScore"]))
    cards = cards[:8]

    return {
        "date": day_iso,
        "asOf": when.isoformat(),
        "stations": station_list,
        "sources": {
            "holiday": bool(day_ctx.get("isHoliday")),
            "weather": wx is not None,
            "ntce": ntce_source,
            "spatic": spatic_day,
        },
        "cards": cards,
    }
