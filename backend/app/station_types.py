"""역명 → 모델 station_type 매핑.

미등록 역은 mixed. 유형 키는 type_to_group.pkl / 모델 그룹과 동일.
"""

from __future__ import annotations

# 핵심역 시드 (AI팀 유형 기준). 나머지는 mixed.
STATION_TYPES: dict[str, str] = {
    "강남": "commercial",
    "역삼": "office",
    "선릉": "office",
    "삼성": "commercial",
    "삼성(무역센터)": "commercial",
    "잠실": "commercial",
    "잠실(송파구청)": "commercial",
    "홍대입구": "commercial",
    "신촌": "university",
    "이대": "university",
    "서울대입구": "university",
    "낙성대": "university",
    "낙성대(강감찬)": "university",
    "건대입구": "university",
    "종합운동장": "stadium",
    "스포츠컴플렉스": "stadium",
    "서울역": "terminal",
    "용산": "terminal",
    "청량리": "terminal",
    "수서": "terminal",
    "여의도": "office",
    "시청": "office",
    "광화문": "office",
    "을지로입구": "office",
    "가산디지털단지": "office",
    "구로디지털단지": "office",
    "명동": "tourism",
    "동대문": "tourism",
    "동대문역사문화공원": "tourism",
    "이태원": "tourism",
    "경복궁": "tourism",
    "인사동": "tourism",
    "합정": "commercial",
    "신림": "commercial",
    "사당": "mixed",
    "교대": "mixed",
    "교대(법원.검찰청)": "mixed",
    "신도림": "mixed",
    "대림": "mixed",
    "대림(구로구청)": "mixed",
}


def station_type_for(name: str) -> str:
    if not name:
        return "mixed"
    key = name.strip()
    if key.endswith("역") and len(key) > 1:
        key = key[:-1]
    return STATION_TYPES.get(key, STATION_TYPES.get(name, "mixed"))
