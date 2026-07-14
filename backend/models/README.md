# 혼잡도 예측 모델 아티팩트

AI팀 `models_by_type` 산출물. FastAPI에서 `CongestionPredictor`(`predict.py`)로 로드합니다.

- `model_*.pkl` — LightGBM Booster (역 유형별)
- `encoders.pkl`, `feature_cols.pkl`, `threshold_by_type.pkl`, `type_to_group.pkl`
- `station_baseline.pkl`, `station_max.pkl`

로드 경로는 `model_dir` 직하 파일입니다 (`models_by_type/` 중첩 불필요).
