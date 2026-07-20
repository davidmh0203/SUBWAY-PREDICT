# 혼잡도 예측 모델 아티팩트

AI팀 산출물. FastAPI `congestion_model.py`에서 로드합니다.

## 로드 우선순위

1. **고도화 앙상블** — `predict_advanced.py` + `encoders_adv.pkl` + `models_advanced/` (LGB+XGB)
2. **기존 LGB 단독** — `predict.py` + `encoders.pkl` + `model_*.pkl`
3. 없으면 mock fallback

## 파일 구성

| 경로 | 설명 |
|------|------|
| `model_*.pkl` | 역 유형별 LightGBM Booster (기존) |
| `models_advanced/lgb_*.pkl`, `xgb_*.pkl` | 역 유형별 앙상블 부스터 |
| `encoders.pkl` / `encoders_adv.pkl` | 카테고리 인코더 |
| `feature_cols.pkl` / `feature_cols_adv.pkl` | 피처 목록 |
| `threshold_by_type.pkl` / `threshold_advanced.pkl` | 유형별 혼잡 임계값 |
| `station_baseline.pkl`, `station_baseline_by_daytype.pkl` | 역·요일유형별 베이스라인 |
| `station_max.pkl`, `official_congestion.pkl` | 역별 최대·공식 혼잡도 |
| `cause_model.pkl` | 혼잡 원인 분류 (고도화) |
| `festival_lookup.pkl`, `kopis_lookup.pkl`, `event_baseline.pkl` | 외부 이벤트 룩업 |

로드 경로는 `model_dir` 직하 파일입니다 (`models_by_type/` 중첩 불필요).

---

## 혼잡도 성능·검증 한계 (2026-07-20)

현재 모델의 **혼잡도 수치·레벨이 얼마나 “맞는지” 단정하기 어렵습니다.** 아래는 실제 지도 UI(18:30 출발 기준)에서 관찰한 내용과 해석입니다.

### 관찰

| 구간 | 예측 경향 | 비고 |
|------|-----------|------|
| 강남·교대·신사·압구정 | 매우혼잡~극혼잡 (80~100%) | 퇴근 시간대 기대와 대체로 일치 |
| 연신내·불광·녹번 | 혼잡 (60~73%) | 환승·통근 구간으로 상대적으로 높게 나옴 |
| 경복궁·안국·독립문 | 보통 (33~45%) | **관광·통근이 섞인 구간인데 예상보다 낮음** |

### 가능한 원인 (가설)

1. **요일·날씨 효과** — 월요일 + 우중충한 장마철이라 외출·관광 수요가 줄었을 수 있음. 모델은 과거 평균·날씨 피처를 쓰지만, “놀러 안 가는 날”의 실제 패턴이 학습 데이터에 충분히 반영됐는지 불확실.
2. **역 단위 집계** — 역별·호선별이 아니라 **역 전체(모든 호선 합산)** 기준으로 학습·예측할 가능성. 경복궁(3호선)은 관광 비중이 크지만, 합산 시 다른 호선·시간대가 희석되면 %가 낮게 나올 수 있음.
3. **레이블 정의** — 학습 타깃이 “승하차 증감 분류”이고, UI의 `congestion_pct`는 베이스라인·역 최대치 대비 환산값이라 **직관적 “현장 혼잡”과 1:1 대응하지 않을 수 있음.**

### 정리

- 강남권·연신내 등 **혼잡이 예상되는 축은 상대적으로 잘 잡히는 편**으로 보임.
- 경복궁 등 **관광·비통근 구간은 절대값·레벨 해석에 주의**가 필요함.
- 정량 평가(MAE, 호선별 hold-out 등)와 **호선·방향 분리 예측**은 후속 과제로 남김.
