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

## 2026-07-22 개선판 (project1)

공식 열차 혼잡도(`official_congestion`)를 기준점으로 쓰는 계산식으로 교체.

| 항목 | 내용 |
|------|------|
| 기준 | `official_usual × (1 ± prob × 0.25)` (공식값 없으면 승하차 baseline fallback) |
| 레벨 | 여유 &lt;40 / 보통 &lt;60 / 혼잡 &lt;75 / 매우혼잡 &lt;90 / 극혼잡 ≥90 |
| 요일 | 평일 내 `WEEKDAY_FACTOR` (월 0.95 ~ 금 1.084) |
| 역명 alias | `경복궁`→`경복궁(정부서울청사)`, `광화문`→`광화문(세종문화회관)` 등 |

상세 메모: [`docs/model-validation-notes.md`](../../docs/model-validation-notes.md)
