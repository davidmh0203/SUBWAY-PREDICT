"""
빈틈타 - 고도화 예측 함수 (앙상블 버전)
LightGBM + XGBoost 앙상블 + Lag Feature + 자동 Threshold

사용 예시:
    from predict_advanced import AdvancedCongestionPredictor
    predictor = AdvancedCongestionPredictor(model_dir="./")
    result = predictor.predict(
        station_name="강남",
        station_type="commercial",
        date="2025-07-11",
        time_slot="18_19",
        weather={"temperature": 28.5, "is_rain": 0},
        event={"행사종류": "없음", "행사시점": 0}
    )
"""

import pickle
import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# ============================================================
# 상수 정의
# ============================================================
STATION_NAME_MAP = {
    "교대":   "교대(법원.검찰청)",
    "낙성대":  "낙성대(강감찬)",
    "대림":   "대림(구로구청)",
    "삼성":   "삼성(무역센터)",
    "잠실":   "잠실(송파구청)",
    # ODsay/UI 짧은 역명 → 학습 DB 역명
    "경복궁": "경복궁(정부서울청사)",
    "광화문": "광화문(세종문화회관)",
}

CONGESTION_LEVELS = [
    (90,  "극혼잡",  "darkred"),
    (75,  "매우혼잡", "red"),
    (60,  "혼잡",   "orange"),
    (40,  "보통",   "yellow"),
    (0,   "여유",   "green"),
]

TIME_ORDER = ['before_06','06_07','07_08','08_09','09_10','10_11',
              '11_12','12_13','13_14','14_15','15_16','16_17',
              '17_18','18_19','19_20','20_21','21_22','22_23',
              '23_24','after_24']
time_to_idx = {t: i for i, t in enumerate(TIME_ORDER)}

TIME_SLOT_KR_MAP = {
    'before_06':'06시이전', '06_07':'06-07시간대',
    '07_08':'07-08시간대', '08_09':'08-09시간대',
    '09_10':'09-10시간대', '10_11':'10-11시간대',
    '11_12':'11-12시간대', '12_13':'12-13시간대',
    '13_14':'13-14시간대', '14_15':'14-15시간대',
    '15_16':'15-16시간대', '16_17':'16-17시간대',
    '17_18':'17-18시간대', '18_19':'18-19시간대',
    '19_20':'19-20시간대', '20_21':'20-21시간대',
    '21_22':'21-22시간대', '22_23':'22-23시간대',
    '23_24':'23-24시간대', 'after_24':'24시이후',
}

SEASON_MAP = {
    1:'winter', 2:'winter', 3:'spring', 4:'spring', 5:'spring',
    6:'summer', 7:'summer', 8:'summer', 9:'fall',
    10:'fall', 11:'fall', 12:'winter'
}

TIME_GROUP_MAP = {
    'before_06':'dawn', '06_07':'early_morning',
    '07_08':'morning_peak', '08_09':'morning_peak',
    '09_10':'morning', '10_11':'morning',
    '11_12':'lunch', '12_13':'lunch',
    '13_14':'afternoon', '14_15':'afternoon',
    '15_16':'afternoon', '16_17':'afternoon',
    '17_18':'evening_peak', '18_19':'evening_peak',
    '19_20':'evening', '20_21':'evening',
    '21_22':'night', '22_23':'night',
    '23_24':'night', 'after_24':'late_night',
}

# ============================================================
# 운행 시간대 정의
# ============================================================
# 실제 서울 지하철 운행 시간 기준
# - 첫차: 05:30 전후 (before_06 포함)
# - 막차: 00:00~01:30 (1,3~8호선: ~01:00 / 2호선: ~01:30)
# - after_24 (01:00 이후): 거의 운행 없음 → 혼잡도 미표시

NO_SERVICE_SLOTS = {'after_24'}  # 운행 종료 시간대

# 호선별 막차 시간대 (더 정교한 처리 원하면 사용)
LAST_SERVICE_BY_LINE = {
    '1호선': '23_24',
    '2호선': 'after_24',  # 2호선만 after_24까지 운행
    '3호선': '23_24',
    '4호선': '23_24',
    '5호선': '23_24',
    '6호선': '23_24',
    '7호선': '23_24',
    '8호선': '23_24',
}


HOLIDAY_DATES = {
    "01-01","03-01","05-05","06-06",
    "08-15","10-03","10-09","12-25"
}

# 요일별 혼잡도 가중치 (실제 승하차 데이터 기반)
# 평일 평균 대비 각 요일의 상대적 혼잡 수준
WEEKDAY_FACTOR = {
    0: 0.950,  # 월요일 (주초 한산)
    1: 0.982,  # 화요일
    2: 0.989,  # 수요일
    3: 0.995,  # 목요일
    4: 1.084,  # 금요일 (주말 앞 가장 혼잡)
    5: 1.000,  # 토요일 (요일유형별 데이터 별도 존재)
    6: 1.000,  # 일요일
}


class AdvancedCongestionPredictor:

    def __init__(self, model_dir="./", lgb_weight=0.6, verbose=True):
        self.model_dir  = model_dir
        self.lgb_weight = lgb_weight
        self.xgb_weight = 1 - lgb_weight
        self.verbose    = verbose
        self._load_artifacts()

    # ──────────────────────────────────────────────────────────
    # 아티팩트 로드
    # ──────────────────────────────────────────────────────────
    def _load_artifacts(self):
        if self.verbose:
            print("모델 로드 중...")

        def _load(path, default=None):
            if os.path.exists(path):
                with open(path, 'rb') as f:
                    return pickle.load(f)
            return default

        # 인코더 / 피처 목록 (고도화 버전 우선, 없으면 기존 버전)
        self.encoders = (
            _load(os.path.join(self.model_dir, "encoders_adv.pkl")) or
            _load(os.path.join(self.model_dir, "encoders.pkl")) or {}
        )
        self.feature_cols = (
            _load(os.path.join(self.model_dir, "feature_cols_adv.pkl")) or
            _load(os.path.join(self.model_dir, "feature_cols.pkl")) or []
        )

        # feature_cols_adv.pkl이 없거나 74개 미만이면 직접 정의
        if len(self.feature_cols) < 74:
            if self.verbose:
                print(f"  feature_cols {len(self.feature_cols)}개 → 74개로 직접 설정")
            self.feature_cols = [
                'month','day','weekday','is_weekend','week_of_year',
                'is_morning_peak','is_evening_peak',
                'is_holiday','is_before_holiday','is_after_holiday','is_long_weekend',
                'line_count','is_transfer','avg_daily_total',
                'data_coverage_ratio','is_recent_station',
                'baseline_total','baseline_candidate_count',
                '기온(°C)','강수량(mm)','강수여부','행사시점',
                # 대학축제
                'is_university_festival','festival_event_count',
                'festival_tier_a_count','festival_tier_b_count',
                'has_tier_a_festival','has_tier_b_festival',
                'festival_core_event_count','has_core_festival',
                'festival_opening_count','festival_closing_count',
                'has_festival_opening','has_festival_closing',
                'spring_festival_count','fall_festival_count',
                'max_festival_duration_days','mean_festival_duration_days',
                'min_festival_day_index','max_festival_day_index',
                # 공식혼잡도
                'official_congestion_pct',
                # KOPIS
                'kopis_is_event_start_slot','kopis_event_count',
                'kopis_unique_performance_count',
                'kopis_is_pre_event_2h','kopis_is_pre_event_1h',
                'kopis_is_event_start_window','kopis_is_arrival_window',
                'kopis_arrival_unique_performance_count',
                'kopis_holiday_event_count','kopis_nonholiday_event_count',
                # ntce
                'is_disruption',
                # 교호작용
                'is_commercial_evening','is_stadium_event','is_weekend_commercial',
                'is_saturday_evening','is_summer_holiday','is_large_evening',
                'is_rain_commercial','is_before_holiday_evening',
                'is_high_baseline','is_high_baseline_evening',
                # lag
                'lag1_baseline','lag2_baseline','lag1_pct_change',
                'rolling3_baseline','baseline_growth',
                # 인코딩
                'season_enc','time_group_enc','station_size_enc','station_type_enc',
                'baseline_method_enc','station_name_enc','행사종류_enc',
            ]

        # Threshold (고도화 버전 우선)
        thr_adv = _load(os.path.join(self.model_dir, "threshold_advanced.pkl"))
        thr_old = _load(os.path.join(self.model_dir, "threshold_by_type.pkl"))

        if thr_adv:
            # threshold_advanced.pkl: {group: {inc, dec, f1}}
            self.threshold_by_type = {
                g: {'increase': v['inc'], 'decrease': v['dec']}
                for g, v in thr_adv.items()
            }
            if self.verbose:
                print("  자동 최적화 threshold 사용")
        elif thr_old:
            self.threshold_by_type = thr_old.get('by_type', {})
            if self.verbose:
                print("  수동 설정 threshold 사용")
        else:
            self.threshold_by_type = {}

        self.default_threshold = {'increase': 0.30, 'decrease': 0.30}

        # type → group 매핑
        self.type_to_group = _load(
            os.path.join(self.model_dir, "type_to_group.pkl")
        ) or {}

        # 역별 최대/baseline 데이터
        self.station_max        = _load(os.path.join(self.model_dir, "station_max.pkl"))                  or {}
        self.station_baseline   = _load(os.path.join(self.model_dir, "station_baseline.pkl"))             or {}
        self.baseline_by_day    = _load(os.path.join(self.model_dir, "station_baseline_by_daytype.pkl"))  or {}
        self.event_baseline     = _load(os.path.join(self.model_dir, "event_baseline.pkl"))               or {}
        self.official_congestion= _load(os.path.join(self.model_dir, "official_congestion.pkl"))          or {}

        # 룩업 테이블 (실시간 피처 조회용)
        self.festival_lookup      = _load(os.path.join(self.model_dir, "festival_lookup.pkl"))      or {}
        self.kopis_lookup         = _load(os.path.join(self.model_dir, "kopis_lookup.pkl"))         or {}
        self.before_holiday_dates = _load(os.path.join(self.model_dir, "before_holiday_dates.pkl")) or set()

        if self.verbose:
            print(f"  대학축제 룩업: {len(self.festival_lookup)}개")
            print(f"  KOPIS 룩업: {len(self.kopis_lookup)}개")
            print(f"  연휴 전날 날짜: {len(self.before_holiday_dates)}개")

        # 앙상블 모델 로드 (고도화 버전 우선, 없으면 기존 LGB만)
        self.lgb_models = {}
        self.xgb_models = {}
        adv_dir = os.path.join(self.model_dir, "models_advanced")
        old_dir = os.path.join(self.model_dir, "models_by_type")

        groups = ['stadium','commercial','office','terminal',
                  'tourism','university','mixed']

        for g in groups:
            lgb_adv = os.path.join(adv_dir, f"lgb_{g}.pkl")
            xgb_adv = os.path.join(adv_dir, f"xgb_{g}.pkl")
            lgb_old = os.path.join(old_dir, f"model_{g}.pkl")

            if os.path.exists(lgb_adv):
                self.lgb_models[g] = _load(lgb_adv)
                self.xgb_models[g] = _load(xgb_adv)
                if self.verbose:
                    print(f"  {g}: 앙상블 모델 로드")
            elif os.path.exists(lgb_old):
                self.lgb_models[g] = _load(lgb_old)
                self.xgb_models[g] = None
                if self.verbose:
                    print(f"  {g}: LGB 단독 모델 로드 (XGB 없음)")

        # 원인 분석 모델
        self.cause_model       = _load(os.path.join(self.model_dir, "cause_model.pkl"))
        self.cause_encoders    = _load(os.path.join(self.model_dir, "cause_encoders.pkl"))
        self.cause_label_order = _load(os.path.join(self.model_dir, "cause_label_order.pkl"))
        self.cause_feature_cols= _load(os.path.join(self.model_dir, "cause_feature_cols.pkl"))

        self.label_order = ["decrease", "increase", "normal"]

        if self.verbose:
            print("모델 로드 완료\n")

    # ──────────────────────────────────────────────────────────
    # 유틸리티
    # ──────────────────────────────────────────────────────────
    def _encode(self, col, value, encoders=None):
        enc = encoders or self.encoders
        if col not in enc:
            return 0
        le = enc[col]
        try:
            return int(le.transform([str(value)])[0])
        except ValueError:
            return 0

    def _get_day_type(self, dt):
        date_str = dt.strftime("%m-%d")
        if date_str in HOLIDAY_DATES:
            return "공휴일"
        wd = dt.weekday()
        if wd == 5: return "토요일"
        if wd == 6: return "일요일"
        return "평일"

    def _get_baseline(self, station_db, time_slot, day_type,
                      event_type=None, event_timing=0):
        # 1. 행사 baseline
        if event_type and event_type != '없음' and event_timing > 0:
            key = f'{event_type}_{event_timing}'
            v = self.event_baseline.get(station_db, {}).get(key)
            if v: return int(v)
        # 2. 요일유형별
        kr = TIME_SLOT_KR_MAP.get(time_slot, time_slot)
        v = self.baseline_by_day.get(station_db, {}).get(f'{kr}_{day_type}')
        if v: return int(v)
        # 3. 전체 평균
        v = self.station_baseline.get(station_db, {}).get(time_slot)
        if v: return int(v)
        return 5000

    def _get_prev_time_slot(self, time_slot):
        idx = time_to_idx.get(time_slot, 0)
        if idx == 0:
            return time_slot
        return TIME_ORDER[idx - 1]

    def _get_station_meta(self, station_name, station_type):
        transfer = {
            "강남","잠실","홍대입구","신촌","건대입구",
            "종합운동장","여의도","가산디지털단지","역삼","신도림"
        }
        large = {"강남","잠실","홍대입구","서울역","신도림"}
        return {
            "line_count":  2 if station_name in transfer else 1,
            "is_transfer": int(station_name in transfer),
            "size":        "large" if station_name in large else "medium",
        }

    def _get_congestion_level(self, pct):
        for threshold, level, color in CONGESTION_LEVELS:
            if pct >= threshold:
                return level, color
        return "여유", "green"

    # ──────────────────────────────────────────────────────────
    # 피처 생성 (lag feature 포함)
    # ──────────────────────────────────────────────────────────
    def _build_features(self, station_name_db, station_type, date,
                        time_slot, weather, event,
                        baseline_total, avg_daily_total,
                        day_type, lag_info=None,
                        kopis_info=None, festival_info=None,
                        is_before_holiday_flag=0):
        if kopis_info    is None: kopis_info    = {}
        if festival_info is None: festival_info = {}

        dt      = pd.to_datetime(date)
        weekday = dt.weekday()
        season  = SEASON_MAP.get(dt.month, 'spring')
        time_group    = TIME_GROUP_MAP.get(time_slot, 'afternoon')
        is_morning    = int(time_slot in {'07_08','08_09'})
        is_evening    = int(time_slot in {'17_18','18_19'})
        is_holiday    = int(dt.strftime("%m-%d") in HOLIDAY_DATES)
        is_weekend    = int(weekday >= 5)
        week_of_year  = dt.isocalendar()[1]
        meta          = self._get_station_meta(station_name_db, station_type)

        # lag feature (실시간 추정)
        if lag_info:
            lag1_bl   = lag_info.get('lag1_baseline', baseline_total)
            lag2_bl   = lag_info.get('lag2_baseline', baseline_total)
            lag1_pct  = lag_info.get('lag1_pct_change', 0.0)
            roll3_bl  = lag_info.get('rolling3_baseline', baseline_total)
            bl_growth = baseline_total / (lag1_bl + 1) if lag1_bl > 0 else 1.0
        else:
            # lag 정보 없으면 현재 baseline으로 대체 (실시간 서빙 시)
            lag1_bl   = baseline_total
            lag2_bl   = baseline_total
            lag1_pct  = 0.0
            roll3_bl  = baseline_total
            bl_growth = 1.0

        feat = {
            "month":                    dt.month,
            "day":                      dt.day,
            "weekday":                  weekday,
            "is_weekend":               is_weekend,
            "week_of_year":             int(week_of_year),
            "is_morning_peak":          is_morning,
            "is_evening_peak":          is_evening,
            "is_holiday":               is_holiday,
            "is_before_holiday":        0,
            "is_after_holiday":         0,
            "is_long_weekend":          0,
            "line_count":               meta["line_count"],
            "is_transfer":              meta["is_transfer"],
            "avg_daily_total":          avg_daily_total,
            "data_coverage_ratio":      1.0,
            "is_recent_station":        0,
            "baseline_total":           baseline_total,
            "baseline_candidate_count": 30,
            "기온(°C)":                 weather.get("temperature", 15.0),
            "강수량(mm)":               weather.get("rainfall", 0.0),
            "강수여부":                 weather.get("is_rain", 0),
            "행사시점":                 event.get("행사시점", 0),
            # lag features
            "lag1_baseline":            lag1_bl,
            "lag2_baseline":            lag2_bl,
            "lag1_pct_change":          lag1_pct,
            "rolling3_baseline":        roll3_bl,
            "baseline_growth":          bl_growth,
            # 인코딩
            "season_enc":               self._encode("season", season),
            "time_group_enc":           self._encode("time_group", time_group),
            "station_size_enc":         self._encode("station_size", meta["size"]),
            "station_type_enc":         self._encode("station_type", station_type),
            "baseline_method_enc":      self._encode("baseline_method", "weekday_avg"),
            "station_name_enc":         self._encode("station_name", station_name_db),
            "행사종류_enc":             self._encode("행사종류", event.get("행사종류","없음")),

            # ── 교호작용 피처 (10개) ──────────────────────────
            "is_commercial_evening":     int(station_type=='commercial' and is_evening),
            "is_stadium_event":          int(station_type=='stadium' and event.get("행사종류","없음")!='없음'),
            "is_weekend_commercial":     int(is_weekend and station_type=='commercial'),
            "is_saturday_evening":       int(weekday==5 and is_evening),
            "is_summer_holiday":         int(season=='summer' and is_holiday),
            "is_large_evening":          int(meta["size"]=='large' and is_evening),
            "is_rain_commercial":        int(weather.get("is_rain",0)==1 and station_type=='commercial'),
            "is_before_holiday_evening": int(is_before_holiday_flag and is_evening),
            "is_high_baseline":          int(baseline_total >= 2267),  # train 75th percentile
            "is_high_baseline_evening":  int(baseline_total >= 2267 and is_evening),

            # ── KOPIS 공연 피처 (10개) ────────────────────────
            # 실시간 서빙 시 공연 정보 없으면 0으로 처리
            # 백엔드에서 kopis_info dict로 전달 가능
            "kopis_is_event_start_slot":              kopis_info.get("kopis_is_event_start_slot", 0),
            "kopis_event_count":                      kopis_info.get("kopis_event_count", 0),
            "kopis_unique_performance_count":         kopis_info.get("kopis_unique_performance_count", 0),
            "kopis_is_pre_event_2h":                  kopis_info.get("kopis_is_pre_event_2h", 0),
            "kopis_is_pre_event_1h":                  kopis_info.get("kopis_is_pre_event_1h", 0),
            "kopis_is_event_start_window":            kopis_info.get("kopis_is_event_start_window", 0),
            "kopis_is_arrival_window":                kopis_info.get("kopis_is_arrival_window", 0),
            "kopis_arrival_unique_performance_count": kopis_info.get("kopis_arrival_unique_performance_count", 0),
            "kopis_holiday_event_count":              kopis_info.get("kopis_holiday_event_count", 0),
            "kopis_nonholiday_event_count":           kopis_info.get("kopis_nonholiday_event_count", 0),

            # ── 대학축제 피처 (18개) ──────────────────────────
            "is_university_festival":         festival_info.get("is_university_festival", 0),
            "festival_event_count":           festival_info.get("festival_event_count", 0),
            "festival_tier_a_count":          festival_info.get("festival_tier_a_count", 0),
            "festival_tier_b_count":          festival_info.get("festival_tier_b_count", 0),
            "has_tier_a_festival":            festival_info.get("has_tier_a_festival", 0),
            "has_tier_b_festival":            festival_info.get("has_tier_b_festival", 0),
            "festival_core_event_count":      festival_info.get("festival_core_event_count", 0),
            "has_core_festival":              festival_info.get("has_core_festival", 0),
            "festival_opening_count":         festival_info.get("festival_opening_count", 0),
            "festival_closing_count":         festival_info.get("festival_closing_count", 0),
            "has_festival_opening":           festival_info.get("has_festival_opening", 0),
            "has_festival_closing":           festival_info.get("has_festival_closing", 0),
            "spring_festival_count":          festival_info.get("spring_festival_count", 0),
            "fall_festival_count":            festival_info.get("fall_festival_count", 0),
            "max_festival_duration_days":     festival_info.get("max_festival_duration_days", 0),
            "mean_festival_duration_days":    festival_info.get("mean_festival_duration_days", 0),
            "min_festival_day_index":         festival_info.get("min_festival_day_index", 0),
            "max_festival_day_index":         festival_info.get("max_festival_day_index", 0),

            # ── 공식 혼잡도 (1개) ─────────────────────────────
            "official_congestion_pct": self.official_congestion.get(
                station_name_db, {}
            ).get(day_type, {}).get(time_slot, 30.0),

            # ── ntce 운행장애 (1개) ───────────────────────────
            "is_disruption": 0,  # 실시간 서빙 시 기본 0 (장애 없는 날)
        }
        return feat

    # ──────────────────────────────────────────────────────────
    # 앙상블 예측
    # ──────────────────────────────────────────────────────────
    def _ensemble_predict(self, group, X):
        lgb_model = self.lgb_models.get(group) or self.lgb_models.get('mixed')
        xgb_model = self.xgb_models.get(group)

        lgb_proba = lgb_model.predict(X)

        if xgb_model is not None:
            xgb_proba_raw = xgb_model.predict_proba(X)
            # 클래스 순서 맞추기
            xgb_classes = list(xgb_model.classes_)
            xgb_proba = np.zeros_like(lgb_proba)
            for i, label in enumerate(self.label_order):
                if label in xgb_classes:
                    xgb_proba[:, i] = xgb_proba_raw[:, xgb_classes.index(label)]
            return lgb_proba * self.lgb_weight + xgb_proba * self.xgb_weight
        else:
            return lgb_proba

    # ──────────────────────────────────────────────────────────
    # 메인 예측 함수
    # ──────────────────────────────────────────────────────────
    def predict(self, station_name, station_type, date, time_slot,
                weather=None, event=None,
                baseline_total=None, avg_daily_total=None,
                lag_info=None, kopis_info=None, festival_info=None):
        """
        Args:
            station_name  (str)
            station_type  (str)
            date          (str): "YYYY-MM-DD"
            time_slot     (str): "18_19"
            weather      (dict): temperature, rainfall, is_rain
            event        (dict): 행사종류, 행사시점
            lag_info     (dict): lag1_baseline, lag2_baseline,
                                 lag1_pct_change, rolling3_baseline
                                 (없으면 현재 baseline으로 대체)
        Returns:
            dict
        """
        if weather is None: weather = {"temperature":15.0,"rainfall":0.0,"is_rain":0}
        if event   is None: event   = {"행사종류":"없음","행사시점":0}
        if kopis_info    is None: kopis_info    = {}
        if festival_info is None: festival_info = {}

        # ── 운행 종료 시간대 체크 ──────────────────────────
        if time_slot in NO_SERVICE_SLOTS:
            return {
                "label":            None,
                "prob_increase":    None,
                "prob_normal":      None,
                "prob_decrease":    None,
                "congestion_pct":   None,
                "congestion_level": "운행종료",
                "congestion_color": "gray",
                "usual_pct":        None,
                "usual_level":      "운행종료",
                "usual_color":      "gray",
                "cause":            None,
                "cause_prob":       None,
                "day_type":         None,
                "model_type":       None,
                "message":          "해당 시간대는 열차 운행이 종료됩니다."
            }
        station_db = STATION_NAME_MAP.get(station_name, station_name)
        dt = pd.to_datetime(date)
        day_type = self._get_day_type(dt)

        # ── 룩업 테이블 자동 조회 ─────────────────────────────
        # 대학축제 피처 자동 조회
        if not festival_info:
            festival_info = self.festival_lookup.get(
                (str(date), station_db), {}
            )

        # KOPIS 공연 피처 자동 조회
        if not kopis_info:
            kopis_info = self.kopis_lookup.get(
                (str(date), station_db, time_slot), {}
            )

        # is_before_holiday 자동 계산
        is_before_holiday_flag = int(str(date) in self.before_holiday_dates)
        event_type   = event.get("행사종류","없음")
        event_timing = event.get("행사시점", 0)

        if baseline_total is None:
            baseline_total = self._get_baseline(
                station_db, time_slot, day_type,
                event_type, event_timing
            )
        if avg_daily_total is None:
            avg_daily_total = sum(
                self.station_baseline.get(station_db, {}).values()
            ) or 80000

        # 피처 생성
        feat = self._build_features(
            station_db, station_type, date, time_slot,
            weather, event, baseline_total, avg_daily_total,
            day_type, lag_info, kopis_info, festival_info,
            is_before_holiday_flag
        )

        # feature_cols 순서에 맞게 정렬
        # self.feature_cols가 없으면 feat의 전체 키를 순서대로 사용
        if self.feature_cols:
            avail_cols = [c for c in self.feature_cols if c in feat]
        else:
            avail_cols = list(feat.keys())

        # 디버그: 피처 수 확인 (문제 해결 후 제거)
        if len(avail_cols) != len(self.feature_cols):
            missing = [c for c in self.feature_cols if c not in feat]
            print(f"[DEBUG] feat 키: {len(feat)}개 / feature_cols: {len(self.feature_cols)}개 / avail: {len(avail_cols)}개")
            print(f"[DEBUG] 누락 키: {missing}")

        X = pd.DataFrame([feat])[avail_cols]

        # 앙상블 예측
        group = self.type_to_group.get(station_type, 'mixed')
        proba = self._ensemble_predict(group, X)[0]

        idx_inc = self.label_order.index("increase")
        idx_dec = self.label_order.index("decrease")
        idx_nor = self.label_order.index("normal")

        # threshold 적용
        thr = self.threshold_by_type.get(group, self.default_threshold)
        if proba[idx_inc] >= thr['increase']:
            label = "increase"
        elif proba[idx_dec] >= thr['decrease']:
            label = "decrease"
        else:
            label = "normal"

        # ============================================================
        # 혼잡도 계산 (공식 혼잡도 기반으로 전면 수정)
        # 기준: 서울교통공사 공식 열차 내부 혼잡도 (열차 정원 대비 %)
        # 공식: official_usual × (1 + prob × 보정계수 0.35)
        # ============================================================
        BOOST = 0.25
        max_pax = self.station_max.get(station_db, 15000)
        baseline_pct = round(baseline_total / max_pax * 100, 1)

        # 공식 혼잡도 조회 (기준점)
        official_pct_raw = self.official_congestion.get(
            station_db, {}
        ).get(day_type, {}).get(time_slot, None)

        # 공식 혼잡도 없는 역 → 기존 방식 fallback
        base_for_calc = float(official_pct_raw) if official_pct_raw else baseline_pct

        # 행사 있을 때 → 행사 인원 / 평소 인원 비율로 스케일링
        if event_type != '없음' and event_timing > 0:
            key = f'{event_type}_{event_timing}'
            ev_pax = self.event_baseline.get(station_db, {}).get(key)
            if ev_pax:
                usual_bl = self._get_baseline(station_db, time_slot, day_type)
                scale = (ev_pax / usual_bl) if usual_bl > 0 else 1.0
                congestion_pct = round(base_for_calc * scale, 1)
            else:
                congestion_pct = round(base_for_calc * (1 + proba[idx_inc] * BOOST), 1)
        elif label == "increase":
            congestion_pct = round(base_for_calc * (1 + proba[idx_inc] * BOOST), 1)
        elif label == "decrease":
            congestion_pct = round(base_for_calc * (1 - proba[idx_dec] * 0.30), 1)
        else:
            congestion_pct = round(base_for_calc, 1)

        level, color = self._get_congestion_level(congestion_pct)

        # 평소 혼잡도 (공식 혼잡도 × 요일 가중치)
        # 평일 내에서도 월~금 패턴 차이 반영
        wd_factor = WEEKDAY_FACTOR.get(dt.weekday(), 1.0) if day_type == '평일' else 1.0
        usual_pct = round(float(official_pct_raw) * wd_factor, 1) if official_pct_raw else round(baseline_pct, 1)
        usual_level, usual_color = self._get_congestion_level(usual_pct)

        # 공식 혼잡도 (반환용)
        official_pct   = round(float(official_pct_raw), 1) if official_pct_raw else None
        official_level = self._get_congestion_level(official_pct)[0] if official_pct else None
        official_color = self._get_congestion_level(official_pct)[1] if official_pct else None

        result = {
            "label":              label,
            "prob_increase":      round(float(proba[idx_inc]), 4),
            "prob_normal":        round(float(proba[idx_nor]), 4),
            "prob_decrease":      round(float(proba[idx_dec]), 4),
            "congestion_pct":     congestion_pct,    # 오늘 예측 혼잡도
            "congestion_level":   level,
            "congestion_color":   color,
            "usual_pct":          usual_pct,          # 평소 이 요일/시간 평균 (승하차 기반)
            "usual_level":        usual_level,
            "usual_color":        usual_color,
            "official_pct":       official_pct,        # 공식 열차 내부 혼잡도 평균 (서울교통공사)
            "official_level":     official_level,
            "official_color":     official_color,
            "cause":              None,
            "cause_prob":         None,
            "day_type":           day_type,
            "model_type":         "ensemble" if self.xgb_models.get(group) else "lgb_only",
        }

        # 2단계 원인 분석
        if label == "increase" and self.cause_model is not None:
            try:
                feat_c = self._build_features(
                    station_db, station_type, date, time_slot,
                    weather, event, baseline_total, avg_daily_total,
                    day_type, lag_info, kopis_info, festival_info,
                    is_before_holiday_flag
                )
                avail_c = [c for c in self.cause_feature_cols if c in feat_c]
                X_c = pd.DataFrame([feat_c])[avail_c]
                c_proba = self.cause_model.predict(X_c)[0]
                c_idx   = c_proba.argmax()
                result["cause"]      = self.cause_label_order[c_idx]
                result["cause_prob"] = round(float(c_proba[c_idx]), 4)
            except:
                result["cause"] = "분석불가"

        return result

    def predict_route(self, stations, date, time_slot,
                      weather=None, event=None):
        """경로 내 전체 역 일괄 예측"""
        # 운행 종료 시간대면 전체 경로 None 반환
        if time_slot in NO_SERVICE_SLOTS:
            return [{
                "station_name":     s["name"],
                "label":            None,
                "congestion_pct":   None,
                "congestion_level": "운행종료",
                "congestion_color": "gray",
                "usual_pct":        None,
                "message":          "해당 시간대는 열차 운행이 종료됩니다."
            } for s in stations]

        results = []
        for s in stations:
            r = self.predict(
                station_name=s["name"],
                station_type=s.get("type","mixed"),
                date=date,
                time_slot=time_slot,
                weather=weather,
                event=event
            )
            r["station_name"] = s["name"]
            results.append(r)
        return results


# ============================================================
# 테스트
# ============================================================
if __name__ == "__main__":
    predictor = AdvancedCongestionPredictor(model_dir="./")

    print("=" * 55)
    print("단일 역 예측 테스트")
    print("=" * 55)

    # 테스트 1 — 강남역 평일 퇴근
    r1 = predictor.predict(
        station_name="강남",
        station_type="commercial",
        date="2025-07-11",
        time_slot="18_19",
        weather={"temperature": 28.5, "is_rain": 0},
        event={"행사종류":"없음","행사시점":0},
        lag_info={
            "lag1_baseline":    14535,   # 17-18시 인원
            "lag2_baseline":    9225,    # 16-17시 인원
            "lag1_pct_change":  0.015,
            "rolling3_baseline": 12000,
        }
    )
    print("\n[강남역 금요일 18-19시 (lag 포함)]")
    for k, v in r1.items():
        print(f"  {k}: {v}")

    # 테스트 2 — 종합운동장 야구 종료
    r2 = predictor.predict(
        station_name="종합운동장",
        station_type="stadium",
        date="2025-07-11",
        time_slot="21_22",
        weather={"temperature": 26.0, "is_rain": 0},
        event={"행사종류":"야구","행사시점":2}
    )
    print("\n[종합운동장 야구 종료 21-22시]")
    for k, v in r2.items():
        print(f"  {k}: {v}")

    # 테스트 3 — 운행 종료 시간대
    r3 = predictor.predict(
        station_name="강남",
        station_type="commercial",
        date="2025-07-11",
        time_slot="after_24",  # 운행 종료
    )
    print("\n[강남역 after_24 (운행 종료 시간대)]")
    for k, v in r3.items():
        print(f"  {k}: {v}")

    # 테스트 4 — 경로 예측
    print("\n" + "=" * 55)
    print("경로 예측 (강남 → 홍대입구) 18-19시")
    print("=" * 55)

    stations = [
        {"name":"강남",      "type":"commercial"},
        {"name":"교대",      "type":"mixed"},
        {"name":"사당",      "type":"mixed"},
        {"name":"신림",      "type":"commercial"},
        {"name":"신도림",    "type":"mixed"},
        {"name":"합정",      "type":"commercial"},
        {"name":"홍대입구",  "type":"commercial"},
    ]
    route = predictor.predict_route(
        stations=stations,
        date="2025-07-11",
        time_slot="18_19",
        weather={"temperature":28.5,"is_rain":0}
    )

    print(f"\n{'역명':<12} {'레벨':<10} {'혼잡%':<8} {'평소%':<8} {'공식%':<8} "
          f"{'색상':<10} {'원인':<10} {'모델'}")
    print("-" * 85)
    for r in route:
        cause = r.get('cause') or '-'
        off   = str(r.get('official_pct') or '-')
        print(f"{r['station_name']:<12} {r['congestion_level']:<10} "
              f"{r['congestion_pct']:<8} {r['usual_pct']:<8} "
              f"{off:<8} {r['congestion_color']:<10} "
              f"{cause:<10} {r['model_type']}")
