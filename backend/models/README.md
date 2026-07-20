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

> **업데이트 (원인 확인):** 행사·공연·집회 등 **이벤트가 역별 평균·베이스라인을 올려 오염**시키는 것이 1차 원인으로 파악됨. AI팀 담당자가 이벤트 보정·베이스라인 정제를 개선 예정 — 반영 전까지 수치는 참고용.

### 관찰

| 구간 | 예측 경향 | 비고 |
|------|-----------|------|
| 강남·교대·신사·압구정 | 매우혼잡~극혼잡 (80~100%) | 퇴근 시간대 기대와 대체로 일치 |
| 연신내·불광·녹번 | 혼잡 (60~73%) | 환승·통근 구간으로 상대적으로 높게 나옴 |
| 경복궁·안국·독립문 | 보통 (33~45%) | **이벤트 오염된 평균 대비 상대적으로 낮게 보임** |

### 원인

**1차 (확인)** — **이벤트로 인한 베이스라인·평균 오염**

- `festival_lookup`, `kopis_lookup`, `event_baseline` 등 외부 이벤트 피처·룩업이 학습·추론에 쓰이면서, **과거 이벤트가 많았던 역의 평균·베이스라인이 상승**.
- 이벤트가 없는 평범한 날에는 `congestion_pct`(베이스라인 대비 환산)가 **실제보다 낮게** 나올 수 있음.
- 통근·환승 축(강남·연신내)은 이벤트 영향이 상대적으로 작아 **순위·방향성은 그럴듯**해 보일 수 있음.

**보조 가설 (미확정)**

1. **요일·날씨** — 월요일 + 장마철 외출 감소 등 당일 수요 요인.
2. **역 단위 집계** — 호선별이 아닌 역 전체 합산 시 % 해석 왜곡.
3. **레이블 정의** — 학습 타깃(증감 분류) vs UI 지표(베이스라인 대비 %) 불일치.

### 대응

- AI팀 담당자가 **이벤트 보정·베이스라인 정제** 개선 → 새 아티팩트 교체 시 `congestion_model.py`가 자동으로 `predict_advanced` 우선 로드.
- 상세 메모: [`docs/model-validation-notes.md`](../../docs/model-validation-notes.md)

### 정리

- 강남권·연신내 등 **혼잡 축의 상대 순위**는 참고 가능.
- 경복궁 등 **이벤트 민감 역은 절대 %·레벨 해석 금지** — 이벤트 오염 보정 전.
- 호선별 예측·정량 평가(MAE 등)는 후속 과제.
