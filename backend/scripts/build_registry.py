"""혼잡도 CSV -> 정규 역 레지스트리(data/stations.json) 생성 스크립트.

데이터팀이 받는 '서울교통공사_지하철혼잡도정보' CSV 를 입력으로 받아
정규 키 (호선, 역명) + 역번호 + 호선 내 순번(seq) 을 뽑아냅니다.
(프론트 metro-stations.json 이 있으면 SVG 좌표도 역명으로 붙입니다.)

사용법:
  python scripts/build_registry.py \
      --congestion data/서울교통공사_지하철혼잡도정보_20260331.csv \
      --svg ../src/lib/generated/metro-stations.json

★ 한국 공공데이터 CSV 는 cp949(euc-kr) 인코딩이 흔합니다.
  utf-8 로 안 열리면 자동으로 cp949 를 재시도합니다.
★ 컬럼명은 데이터셋 버전마다 미묘하게 다릅니다(예: '호선' vs '호선명').
  실행하면 감지된 컬럼을 먼저 출력하니, 안 맞으면 아래 매핑 상수를 고치세요.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

# 데이터셋 컬럼명 후보 (버전에 따라 하나가 잡힘)
COL_LINE = ["호선", "호선명", "line"]
COL_CODE = ["역번호", "역코드", "station_code"]
COL_NAME = ["역명", "출발역", "station_name"]

_HHMM = re.compile(r"^\s*(\d{1,2})[시:]?\s*(\d{2})분?\s*$")  # '08:30','08시30분','0830'


def _read_rows(path: Path) -> list[dict[str, str]]:
    for enc in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            with path.open(encoding=enc, newline="") as f:
                rows = list(csv.DictReader(f))
            print(f"  [읽기 성공] 인코딩={enc}, {len(rows)}행")
            return rows
        except (UnicodeDecodeError, LookupError):
            continue
    sys.exit(f"CSV 인코딩을 판별하지 못했습니다: {path}")


def _pick(header: list[str], candidates: list[str]) -> str | None:
    for c in candidates:
        if c in header:
            return c
    return None


def _norm_name(raw: str) -> str:
    name = (raw or "").strip().split("/")[0]
    name = re.sub(r"\(.*?\)", "", name)
    name = re.sub(r"역$", "", name.strip())
    return re.sub(r"\s+", "", name).strip()


def _line(raw: str) -> str:
    s = str(raw).strip()
    if s.endswith("호선"):
        return s
    return f"{s}호선" if s.isdigit() else s


def build(congestion_csv: Path, svg_json: Path | None) -> list[dict]:
    rows = _read_rows(congestion_csv)
    if not rows:
        sys.exit("빈 CSV 입니다.")

    header = list(rows[0].keys())
    print("  감지된 컬럼:", header[:8], "..." if len(header) > 8 else "")
    c_line = _pick(header, COL_LINE)
    c_code = _pick(header, COL_CODE)
    c_name = _pick(header, COL_NAME)
    if not (c_line and c_name):
        sys.exit(f"호선/역명 컬럼을 못 찾음. COL_* 상수를 확인하세요. header={header}")

    # SVG 좌표 (역명 -> x,y)
    svg_xy: dict[str, dict] = {}
    if svg_json and svg_json.exists():
        for s in json.loads(svg_json.read_text(encoding="utf-8")):
            svg_xy[_norm_name(s.get("name", ""))] = {"svg_x": s.get("x"), "svg_y": s.get("y")}
        print(f"  SVG 좌표 {len(svg_xy)}개 로드")

    # (호선, 역명) 중복 제거 + 등장 순서로 seq 부여 (방향 판정용 근사)
    seen: dict[tuple[str, str], dict] = {}
    seq_counter: dict[str, int] = {}
    for r in rows:
        line = _line(r.get(c_line, ""))
        name_raw = (r.get(c_name, "") or "").strip()
        nname = _norm_name(name_raw)
        if not line or not nname:
            continue
        key = (line, nname)
        if key in seen:
            continue
        seq_counter[line] = seq_counter.get(line, 0) + 1
        entry = {
            "line": line,
            "name": name_raw,
            "name_norm": nname,
            "station_code": (r.get(c_code, "") or "").strip() if c_code else "",
            "seq": seq_counter[line],
        }
        entry.update(svg_xy.get(nname, {}))
        seen[key] = entry

    out = sorted(seen.values(), key=lambda e: (e["line"], e["seq"]))
    print(f"  → 정규 역 {len(out)}개 생성 "
          f"({len({e['line'] for e in out})}개 호선)")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--congestion", required=True, type=Path, help="혼잡도 CSV 경로")
    ap.add_argument("--svg", type=Path, default=None, help="프론트 metro-stations.json (선택)")
    ap.add_argument("--out", type=Path,
                    default=Path(__file__).resolve().parents[1] / "app" / "data" / "stations.json")
    args = ap.parse_args()

    print(f"[build_registry] {args.congestion}")
    rows = build(args.congestion, args.svg)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[완료] {args.out}  ({len(rows)}개)")


if __name__ == "__main__":
    main()
