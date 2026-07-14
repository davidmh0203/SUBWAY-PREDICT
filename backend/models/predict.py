"""
빈틈타 - 백엔드 연동용 혼잡도 예측 함수
FastAPI 등에서 import해서 사용

사용 예시:
    from predict import CongestionPredictor
    predictor = CongestionPredictor(model_dir="./", verbose=False)
    result = predictor.predict(
        station_name="강남",
        station_type="commercial",
        date="2025-07-10",
        time_slot="18_19",
        weather={"temperature": 28.5, "is_rain": 0},
        event={"행사종류": "없음", "행사시점": 0}
    )
    print(result)
    # {
    #   "label": "increase",
    #   "prob_increase": 0.72,
    #   "prob_normal": 0.21,
    #   "prob_decrease": 0.07,
    #   "congestion_pct": 74.3,
    #   "congestion_level": "혼잡",
    #   "congestion_color": "orange"
    # }
"""

import pickle
import os
import numpy as np
import pandas as pd

# ============================================================
# 역명 정규화 맵 (사용자 입력 → 데이터 역명)
# ============================================================
STATION_NAME_MAP = {
    "교대":     "교대(법원.검찰청)",
    "낙성대":   "낙성대(강감찬)",
    "대림":     "대림(구로구청)",
    "삼성":     "삼성(무역센터)",
    "잠실":     "잠실(송파구청)",
    "성수":     "성수",
    "종합운동장": "종합운동장",
}

# 혼잡도 레벨 기준
CONGESTION_LEVELS = [
    (100, "극혼잡",   "darkred"),   # 역대 최고 초과
    (80,  "매우혼잡", "red"),
    (60,  "혼잡",    "orange"),
    (30,  "보통",    "yellow"),
    (0,   "여유",    "green"),
]

# 시간대 매핑
TIME_SLOT_MAP = {
    "before_06": 0, "06_07": 1, "07_08": 2, "08_09": 3,
    "09_10": 4, "10_11": 5, "11_12": 6, "12_13": 7,
    "13_14": 8, "14_15": 9, "15_16": 10, "16_17": 11,
    "17_18": 12, "18_19": 13, "19_20": 14, "20_21": 15,
    "21_22": 16, "22_23": 17, "23_24": 18, "after_24": 19,
}

SEASON_MAP = {1: "winter", 2: "winter", 3: "spring",
              4: "spring", 5: "spring", 6: "summer",
              7: "summer", 8: "summer", 9: "fall",
              10: "fall",  11: "fall",  12: "winter"}

TIME_GROUP_MAP = {
    "before_06": "dawn",  "06_07": "early_morning",
    "07_08": "morning_peak", "08_09": "morning_peak",
    "09_10": "morning",   "10_11": "morning",
    "11_12": "lunch",     "12_13": "lunch",
    "13_14": "afternoon", "14_15": "afternoon",
    "15_16": "afternoon", "16_17": "afternoon",
    "17_18": "evening_peak", "18_19": "evening_peak",
    "19_20": "evening",   "20_21": "evening",
    "21_22": "night",     "22_23": "night",
    "23_24": "night",     "after_24": "late_night",
}

MORNING_PEAK = {"07_08", "08_09"}
EVENING_PEAK = {"17_18", "18_19"}


class CongestionPredictor:

    def __init__(self, model_dir="./", verbose=True):
        self.model_dir = model_dir
        self.verbose = verbose
        self._load_artifacts()

    def _load_artifacts(self):
        if self.verbose:
            print("모델 로드 중...")

        # 인코더, 피처 목록, threshold, 유형-그룹 매핑 로드
        with open(os.path.join(self.model_dir, "encoders.pkl"), "rb") as f:
            self.encoders = pickle.load(f)
        with open(os.path.join(self.model_dir, "feature_cols.pkl"), "rb") as f:
            self.feature_cols = pickle.load(f)
        with open(os.path.join(self.model_dir, "threshold_by_type.pkl"), "rb") as f:
            thr_data = pickle.load(f)
            self.threshold_by_type = thr_data["by_type"]
            self.default_threshold  = thr_data["default"]
        with open(os.path.join(self.model_dir, "type_to_group.pkl"), "rb") as f:
            self.type_to_group = pickle.load(f)

        # 역별 최대 인원 및 baseline 로드
        max_path  = os.path.join(self.model_dir, "station_max.pkl")
        base_path = os.path.join(self.model_dir, "station_baseline.pkl")

        if os.path.exists(max_path):
            with open(max_path, "rb") as f:
                self.station_max = pickle.load(f)
        else:
            self.station_max = {}

        if os.path.exists(base_path):
            with open(base_path, "rb") as f:
                self.station_baseline = pickle.load(f)
        else:
            self.station_baseline = {}

        if self.verbose:
            print(f"역별 최대 인원 로드 완료: {len(self.station_max)}개 역")

        # 역 유형별 모델 로드 (artifacts는 model_dir 직하)
        self.models = {}
        for group in ["stadium", "commercial", "office", "terminal",
                      "tourism", "university", "mixed"]:
            path = os.path.join(self.model_dir, f"model_{group}.pkl")
            if not os.path.exists(path):
                nested = os.path.join(self.model_dir, "models_by_type", f"model_{group}.pkl")
                path = nested if os.path.exists(nested) else path
            if os.path.exists(path):
                with open(path, "rb") as f:
                    self.models[group] = pickle.load(f)
                if self.verbose:
                    print(f"  {group} 모델 로드 완료")

        self.label_order = ["decrease", "increase", "normal"]
        if self.verbose:
            print("모델 로드 완료\n")

    def _build_features(self, station_name, station_type, date,
                        time_slot, weather, event,
                        baseline_total=None, avg_daily_total=None):
        """입력값으로 피처 딕셔너리 생성"""
        dt = pd.to_datetime(date)

        # 공휴일 목록 (실제 서비스에서는 API 연동)
        HOLIDAYS = {
            "01-01", "03-01", "05-05", "06-06",
            "08-15", "10-03", "10-09", "12-25"
        }
        date_str = dt.strftime("%m-%d")
        is_holiday = int(date_str in HOLIDAYS)

        # 시간대 관련
        time_num      = TIME_SLOT_MAP.get(time_slot, 10)
        time_group    = TIME_GROUP_MAP.get(time_slot, "afternoon")
        is_morning    = int(time_slot in MORNING_PEAK)
        is_evening    = int(time_slot in EVENING_PEAK)
        season        = SEASON_MAP.get(dt.month, "spring")
        weekday       = dt.weekday()           # 0=월 ~ 6=일
        is_weekend    = int(weekday >= 5)
        week_of_year  = dt.isocalendar()[1]

        # 베이스라인 (없으면 기본값)
        _baseline = baseline_total    if baseline_total    else 5000
        _avg      = avg_daily_total   if avg_daily_total   else 80000

        # 역 특성 (실제 서비스에서는 DB에서 조회)
        station_meta = self._get_station_meta(station_name, station_type)

        feat = {
            "month":                   dt.month,
            "day":                     dt.day,
            "weekday":                 weekday,
            "is_weekend":              is_weekend,
            "week_of_year":            week_of_year,
            "is_morning_peak":         is_morning,
            "is_evening_peak":         is_evening,
            "is_holiday":              is_holiday,
            "is_before_holiday":       0,   # 실제 서비스에서 계산 필요
            "is_after_holiday":        0,
            "is_long_weekend":         0,
            "line_count":              station_meta["line_count"],
            "is_transfer":             station_meta["is_transfer"],
            "avg_daily_total":         _avg,
            "data_coverage_ratio":     1.0,
            "is_recent_station":       0,
            "baseline_total":          _baseline,
            "baseline_candidate_count": 30,
            "기온(°C)":                weather.get("temperature", 15.0),
            "강수량(mm)":              weather.get("rainfall", 0.0),
            "강수여부":                weather.get("is_rain", 0),
            "행사시점":                event.get("행사시점", 0),
            # 카테고리 인코딩
            "season_enc":             self._encode("season", season),
            "time_group_enc":         self._encode("time_group", time_group),
            "station_size_enc":       self._encode("station_size", station_meta["size"]),
            "station_type_enc":       self._encode("station_type", station_type),
            "baseline_method_enc":    self._encode("baseline_method", "weekday_avg"),
            "station_name_enc":       self._encode("station_name", station_name),
            "행사종류_enc":           self._encode("행사종류", event.get("행사종류", "없음")),
        }

        return feat

    def _encode(self, col, value):
        """LabelEncoder로 인코딩, 미지의 값은 0으로 처리"""
        if col not in self.encoders:
            return 0
        le = self.encoders[col]
        try:
            return int(le.transform([str(value)])[0])
        except ValueError:
            return 0

    def _get_station_meta(self, station_name, station_type):
        """역 메타데이터 반환 (실제 서비스에서는 DB 조회)"""
        # 임시 기본값 — 실제 서비스에서는 역 정보 DB로 교체
        transfer_stations = {
            "강남", "잠실", "홍대입구", "신촌", "건대입구",
            "종합운동장", "여의도", "가산디지털단지", "역삼"
        }
        large_stations = {
            "강남", "잠실", "홍대입구", "서울역", "신도림"
        }
        return {
            "line_count":  2 if station_name in transfer_stations else 1,
            "is_transfer": int(station_name in transfer_stations),
            "size":        "large" if station_name in large_stations else "medium",
        }

    def _get_congestion_pct(self, station_name, predicted_passengers):
        """역 최대 인원 대비 혼잡도 % 계산 (100% 초과 가능)"""
        max_pax = self.station_max.get(station_name, 15000)
        return round(predicted_passengers / max_pax * 100, 1)

    def _get_baseline(self, station_name, time_slot):
        """역별 시간대별 평균 인원 반환"""
        return self.station_baseline.get(station_name, {}).get(time_slot, 5000)

    def _get_congestion_level(self, pct):
        """혼잡도 % → 레벨/색상 변환"""
        for threshold, level, color in CONGESTION_LEVELS:
            if pct >= threshold:
                return level, color
        return "여유", "green"

    def predict(self, station_name, station_type, date, time_slot,
                weather=None, event=None,
                baseline_total=None, avg_daily_total=None):
        """
        혼잡도 예측 메인 함수

        Args:
            station_name  (str): 역명 (예: "강남")
            station_type  (str): 역 유형 (예: "commercial")
            date          (str): 날짜 (예: "2025-07-10")
            time_slot     (str): 시간대 (예: "18_19")
            weather      (dict): {"temperature": 28.5, "rainfall": 0.0, "is_rain": 0}
            event        (dict): {"행사종류": "없음", "행사시점": 0}
            baseline_total     (int): 해당 역/시간대 평균 인원 (없으면 기본값)
            avg_daily_total    (int): 해당 역 일평균 인원 (없으면 기본값)

        Returns:
            dict: {
                "label":           "increase" | "normal" | "decrease",
                "prob_increase":   float,
                "prob_normal":     float,
                "prob_decrease":   float,
                "congestion_pct":  float,   # 역 최대 대비 %
                "congestion_level": str,    # "여유" | "보통" | "혼잡" | "매우혼잡"
                "congestion_color": str,    # "green" | "yellow" | "orange" | "red"
            }
        """
        if weather is None:
            weather = {"temperature": 15.0, "rainfall": 0.0, "is_rain": 0}
        if event is None:
            event = {"행사종류": "없음", "행사시점": 0}

        # 역명 정규화 (표기 차이 보정)
        station_name_db = STATION_NAME_MAP.get(station_name, station_name)
        if baseline_total is None:
            baseline_total = self._get_baseline(station_name_db, time_slot)
        if avg_daily_total is None:
            avg_daily_total = sum(
                self.station_baseline.get(station_name_db, {}).values()
            ) or 80000

        # 피처 생성
        feat = self._build_features(
            station_name_db, station_type, date, time_slot,
            weather, event, baseline_total, avg_daily_total
        )

        # 피처 순서 맞추기
        X = pd.DataFrame([feat])[self.feature_cols]

        # 모델 선택
        group = self.type_to_group.get(station_type, "mixed")
        model = self.models.get(group, self.models.get("mixed"))

        # 예측
        proba = model.predict(X)[0]
        idx_inc = self.label_order.index("increase")
        idx_dec = self.label_order.index("decrease")
        idx_nor = self.label_order.index("normal")

        # threshold 적용
        thr = self.threshold_by_type.get(station_type, self.default_threshold)
        if proba[idx_inc] >= thr["increase"]:
            label = "increase"
        elif proba[idx_dec] >= thr["decrease"]:
            label = "decrease"
        else:
            label = "normal"

        # 혼잡도 % 계산 (역 최대 인원 대비)
        if label == "increase":
            predicted_pax = baseline_total * (1 + proba[idx_inc])
        elif label == "decrease":
            predicted_pax = baseline_total * (1 - proba[idx_dec] * 0.5)
        else:
            predicted_pax = baseline_total

        congestion_pct = float(self._get_congestion_pct(station_name_db, predicted_pax))
        # 상한선 없음 — 100% 초과 시 "역대 최고보다 더 혼잡"을 그대로 표시
        level, color   = self._get_congestion_level(congestion_pct)

        return {
            "label":            label,
            "prob_increase":    round(float(proba[idx_inc]), 4),
            "prob_normal":      round(float(proba[idx_nor]), 4),
            "prob_decrease":    round(float(proba[idx_dec]), 4),
            "congestion_pct":   congestion_pct,
            "congestion_level": level,
            "congestion_color": color,
        }

    def predict_route(self, stations, date, time_slot, weather=None, event=None):
        """
        경로 내 전체 역 혼잡도 일괄 예측

        Args:
            stations (list): [{"name": "강남", "type": "commercial"}, ...]
            date     (str):  "2025-07-10"
            time_slot(str):  "18_19"

        Returns:
            list: 각 역별 예측 결과 리스트
        """
        results = []
        for s in stations:
            result = self.predict(
                station_name=s["name"],
                station_type=s.get("type", "mixed"),
                date=date,
                time_slot=time_slot,
                weather=weather,
                event=event
            )
            result["station_name"] = s["name"]
            results.append(result)
        return results


# ============================================================
# 테스트 실행
# ============================================================
if __name__ == "__main__":
    predictor = CongestionPredictor(model_dir="./")

    print("=" * 50)
    print("단일 역 예측 테스트")
    print("=" * 50)

    # 테스트 1 — 강남역 퇴근 시간
    result = predictor.predict(
        station_name="강남",
        station_type="commercial",
        date="2025-07-11",
        time_slot="18_19",
        weather={"temperature": 28.5, "rainfall": 0.0, "is_rain": 0},
        event={"행사종류": "없음", "행사시점": 0}
    )
    print("\n[강남역 금요일 18-19시]")
    for k, v in result.items():
        print(f"  {k}: {v}")

    result2 = predictor.predict(
        station_name="종합운동장",
        station_type="stadium",
        date="2025-07-11",
        time_slot="21_22",
        weather={"temperature": 26.0, "rainfall": 0.0, "is_rain": 0},
        event={"행사종류": "야구", "행사시점": 2}
    )
    print("\n[종합운동장역 야구 경기 종료 후 21-22시]")
    for k, v in result2.items():
        print(f"  {k}: {v}")

    # 테스트 3 — 경로 예측
    print("\n" + "=" * 50)
    print("경로 예측 테스트 (강남 → 홍대입구)")
    print("=" * 50)
    stations = [
        {"name": "강남",   "type": "commercial"},
        {"name": "교대",   "type": "mixed"},
        {"name": "서초",   "type": "mixed"},
        {"name": "방배",   "type": "mixed"},
        {"name": "사당",   "type": "mixed"},
        {"name": "낙성대", "type": "mixed"},
        {"name": "서울대입구", "type": "university"},
        {"name": "봉천",   "type": "mixed"},
        {"name": "신림",   "type": "commercial"},
        {"name": "신대방", "type": "mixed"},
        {"name": "구로디지털단지", "type": "office"},
        {"name": "대림",   "type": "mixed"},
        {"name": "신도림", "type": "mixed"},
        {"name": "문래",   "type": "mixed"},
        {"name": "영등포구청", "type": "mixed"},
        {"name": "당산",   "type": "mixed"},
        {"name": "합정",   "type": "commercial"},
        {"name": "홍대입구", "type": "commercial"},
    ]

    route_results = predictor.predict_route(
        stations=stations,
        date="2025-07-11",
        time_slot="18_19",
        weather={"temperature": 28.5, "is_rain": 0}
    )

    print(f"\n{'역명':<15} {'레벨':<10} {'혼잡도%':<10} {'색상':<10} {'increase prob'}")
    print("-" * 60)
    for r in route_results:
        print(f"{r['station_name']:<15} {r['congestion_level']:<10} "
              f"{r['congestion_pct']:<10} {r['congestion_color']:<10} "
              f"{r['prob_increase']:.4f}")
