import json
import os
import re
import pandas as pd

# 1. 엑셀 경로 및 JSON 저장 경로 설정
excel_path = "역위치.xlsx"
output_path = "src/lib/generated/real-station-coords.json"

# 별칭(Alias) 매핑 사전 정의 (이름 표기 불일치 보정)
ALIAS_MAP = {
    "가락": "가락시장",
    "경기도청": "경기도청북부청사",
    "국회": "국회의사당",
    "대모산": "대모산입구",
    "로데오": "압구정로데오",
    "서울지방": "서울지방병무청",
    "성신여대": "성신여대입구",
    "송도달빛": "송도달빛축제공원",
    "숙대": "숙대입구",
    "역사문화공원": "동대문역사문화공원",
    "온양": "온양온천",
    "올림픽": "올림픽공원",
    "의사당": "국회의사당",
    "지제": "평택지제",
}

def normalize(name):
    if not name:
        return ""
    n = str(name).strip()
    n = re.sub(r"역$", "", n)
    n = re.sub(r"\(.*\)", "", n)
    n = re.sub(r"\[.*\]", "", n)
    return n.strip()

def main():
    if not os.path.exists(excel_path):
        print(f"[Error] '{excel_path}' 파일이 존재하지 않습니다.")
        return

    print("엑셀 데이터 로드 중...")
    df = pd.read_excel(excel_path)
    
    # 엑셀 역명 정규화 테이블 빌드
    excel_coords = {}
    for _, row in df.iterrows():
        raw_name = str(row["역사명"]).strip()
        lat = row["역위도"]
        lng = row["역경도"]
        
        # 위도/경도가 유효하지 않으면 패스
        if pd.isna(lat) or pd.isna(lng):
            continue
            
        # 주소 필터링 (서울/경기만 포함, 타지역(인천 등) 제외)
        addr = str(row.get("역사도로명주소", "")).strip()
        is_seoul_or_gyeonggi = any(keyword in addr for keyword in ["서울", "서울특별시", "경기", "경기도"])
        if not is_seoul_or_gyeonggi:
            continue
            
        norm_name = normalize(raw_name)
        if norm_name:
            excel_coords[norm_name] = {
                "lat": float(lat),
                "lng": float(lng)
            }

    # 587개 원본 역 리스트 읽기
    json_path = "src/lib/generated/metro-stations.json"
    with open(json_path, "r", encoding="utf-8") as f:
        stations_data = json.load(f)

    result_coords = {}
    match_count = 0
    fallback_count = 0

    for station in stations_data:
        name = station["name"]
        if not name:
            continue
            
        # 괄호 형태의 더미 노선 제외
        if name.startswith("(") and name.endswith(")"):
            continue

        norm_j = normalize(name)
        
        # 1. 1차 매핑 시도 (정확히 정규화 일치)
        if norm_j in excel_coords:
            result_coords[name] = excel_coords[norm_j]
            match_count += 1
            continue
            
        # 2. 2차 매핑 시도 (별칭 사전 매핑)
        alias_name = ALIAS_MAP.get(norm_j)
        norm_alias = normalize(alias_name) if alias_name else ""
        if norm_alias in excel_coords:
            result_coords[name] = excel_coords[norm_alias]
            match_count += 1
            print(f"[Alias Match] '{name}' (정규화: '{norm_j}') -> '{alias_name}' 좌표 매핑 완료.")
            continue
            
        # 3. 매칭 실패 (타지역 역이거나 엑셀에 없는 역) -> JSON에 담지 않음
        fallback_count += 1

    # 디렉토리 생성
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # JSON 저장
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result_coords, f, ensure_ascii=False, indent=2)

    print("\n[변환 결과]")
    print(f"- 매칭 성공 (서울/경기 실제 GPS 좌표 적용): {match_count}개 역")
    print(f"- 제외/실패 (타지역 혹은 엑셀에 없는 역): {fallback_count}개 역")
    print(f"- 좌표 JSON 생성 완료: {output_path}")

if __name__ == "__main__":
    main()