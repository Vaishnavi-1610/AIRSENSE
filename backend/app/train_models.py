/env python3
"""
Chronologically-Validated Multi-Horizon Air Quality Forecasting Pipeline
=======================================================================
This script trains and evaluates machine learning models to predict daily AQI
for 1 to 5 days ahead (Horizons +1d, +2d, +3d, +4d, +5d) across 10 Indian cities.

Key Methodology:
1. Zero Future Leakage: Every feature at time t uses only historical information (t, t-1, t-2, t-3, t-7, 7d rolling mean).
2. Direct Multi-Horizon Architecture: Dedicated models for each horizon h in {1, 2, 3, 4, 5}.
3. Chronological Train-Val-Test Splits (70% Train, 15% Validation, 15% Unseen Test).
4. Evaluation: MAE, RMSE, R2, CPCB Category Accuracy, and baseline persistence comparison.
5. Persists trained models and metrics to backend/models_cache/.
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple

import pandas as pd
import numpy as np
import joblib

from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, root_mean_squared_error, r2_score, accuracy_score, f1_score
from sklearn.preprocessing import StandardScaler
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.config import (
    PROCESSED_DATASET_PATH,
    ORIGINAL_DATASET_PATH,
    MODELS_CACHE_DIR,
    get_aqi_category_info,
    AQI_CATEGORIES
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

HORIZONS = [1, 2, 3, 4, 5]


def get_aqi_category_name(val: float) -> str:
    if val is None or not np.isfinite(val) or val < 0:
        return "Unknown"
    for cat in AQI_CATEGORIES:
        if cat["min"] <= val <= cat["max"]:
            return cat["name"]
    return "Severe"


def safe_r2(y_true, y_pred):
    """Return None where R² is mathematically undefined."""
    if len(y_true) < 2 or pd.Series(y_true).nunique() < 2:
        return None
    value = float(r2_score(y_true, y_pred))
    return value if np.isfinite(value) else None


def build_multi_horizon_dataset(df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """
    Constructs feature matrix X strictly from time t and earlier,
    and target vectors y_h for h in {1, 2, 3, 4, 5}.
    """
    clean_df = df[df["aqi"].notnull()].copy()
    clean_df["date_dt"] = pd.to_datetime(clean_df["date"])
    clean_df = clean_df.sort_values(by=["city", "date_dt"]).reset_index(drop=True)

    city_dfs = []
    for city, grp in clean_df.groupby("city"):
        grp = grp.sort_values(by="date_dt").copy()

        # Target lags
        grp["aqi_current"] = grp["aqi"]
        for lag in [1, 2, 3, 7]:
            grp[f"aqi_lag_{lag}"] = grp["aqi"].shift(lag)
            if "pm25" in grp:
                grp[f"pm25_lag_{lag}"] = grp["pm25"].shift(lag)

        # 7-day backward rolling statistics (strictly past t-6 to t)
        grp["aqi_roll_mean_7"] = grp["aqi"].rolling(window=7, min_periods=3).mean()
        grp["aqi_roll_std_7"] = grp["aqi"].rolling(window=7, min_periods=3).std().fillna(0)

        # Current pollutant levels
        for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"]:
            if p in grp:
                grp[f"{p}_current"] = grp[p]

        # Calendar features
        grp["day_of_week"] = grp["date_dt"].dt.dayofweek
        grp["is_weekend"] = grp["day_of_week"].apply(lambda d: 1 if d >= 5 else 0)
        grp["month"] = grp["date_dt"].dt.month
        grp["day_of_year"] = grp["date_dt"].dt.dayofyear

        # Future targets for each horizon h (t+h)
        for h in HORIZONS:
            grp[f"target_h{h}"] = grp["aqi"].shift(-h)

        city_dfs.append(grp)

    full_data = pd.concat(city_dfs, ignore_index=True)

 # One-hot encode city
    city_dummies = pd.get_dummies(full_data["city"], prefix="city", drop_first=False, dtype=float)
    full_data = pd.concat([full_data, city_dummies], axis=1)

    # Base feature columns (unchanged)
    feature_cols = [
        "aqi_current",
        "aqi_lag_1", "aqi_lag_2", "aqi_lag_3", "aqi_lag_7",
        "aqi_roll_mean_7", "aqi_roll_std_7",
        "day_of_week", "is_weekend", "month", "day_of_year"
    ]
    for p in ["pm25_current", "pm10_current", "no2_current", "so2_current", "co_current", "ozone_current",
              "pm25_lag_1", "pm25_lag_2", "pm25_lag_3", "pm25_lag_7"]:
        if p in full_data.columns:
            feature_cols.append(p)

    feature_cols.extend(city_dummies.columns.tolist())

    return full_data, feature_cols


def train_and_evaluate_multi_horizon(data_path: Path):
    logger.info(f"Loading dataset from {data_path}...")
    df = pd.read_csv(data_path)

    full_data, feature_cols = build_multi_horizon_dataset(df)
    logger.info(f"Engineered dataset: {len(full_data)} records, {len(feature_cols)} features.")

    # Chronological Split (70% Train, 15% Val, 15% Test) per city (unchanged)
    train_indices = []
    val_indices = []
    test_indices = []

    for city, grp in full_data.groupby("city"):
        grp_sorted = grp.sort_values(by="date_dt")
        n = len(grp_sorted)
        t_end = int(n * 0.70)
        v_end = int(n * 0.85)
     train_indices.extend(grp_sorted.iloc[:t_end].index.tolist())
        val_indices.extend(grp_sorted.iloc[t_end:v_end].index.tolist())
        test_indices.extend(grp_sorted.iloc[v_end:].index.tolist())

    logger.info(f"Split sizes: Train={len(train_indices)}, Val={len(val_indices)}, Test={len(test_indices)}")

    trained_models = {}
    scalers = {}
    horizon_metrics = {}
    city_test_metrics = {}

    for h in HORIZONS:
        logger.info(f"\n--- Training Horizon Day +{h} ---")
        target_col = f"target_h{h}"

        # Drop rows where target or key lags are NaN
        h_data = full_data.dropna(subset=[target_col, "aqi_current", "aqi_lag_1", "aqi_lag_2", "aqi_roll_mean_7"]).copy()

        # Intersect with split indices
        train_idx = [i for i in train_indices if i in h_data.index]
        val_idx = [i for i in val_indices if i in h_data.index]
        test_idx = [i for i in test_indices if i in h_data.index]

        X_train_raw = h_data.loc[train_idx, feature_cols].fillna(0)
        y_train = h_data.loc[train_idx, target_col]

        X_val_raw = h_data.loc[val_idx, feature_cols].fillna(0)
        y_val = h_data.loc[val_idx, target_col]

        X_test_raw = h_data.loc[test_idx, feature_cols].fillna(0)
        y_test = h_data.loc[test_idx, target_col]

        # Fit Scaler strictly on X_train
        scaler = StandardScaler()
        scaler.fit(X_train_raw)
        X_train = scaler.transform(X_train_raw)
        X_val = scaler.transform(X_val_raw)
        X_test = scaler.transform(X_test_raw)

        # Baseline: Persistence model (predict current AQI for future AQI)
        baseline_preds = h_data.loc[test_idx, "aqi_current"]
        baseline_valid = (
            y_test.notna()
            & baseline_preds.notna()
            & np.isfinite(y_test.to_numpy(dtype=float))
            & np.isfinite(baseline_preds.to_numpy(dtype=float))
        )
        y_base = y_test.loc[baseline_valid].astype(float)
        base_preds = baseline_preds.loc[baseline_valid].astype(float)

        base_mae = float(mean_absolute_error(y_base, base_preds)) if len(y_base) else None
        base_rmse = float(root_mean_squared_error(y_base, base_preds)) if len(y_base) else None
        base_r2 = safe_r2(y_base, base_preds)

        # Model candidates (unchanged)
        candidates = {
            "Random Forest": RandomForestRegressor(
                n_estimators=100, max_depth=8, min_samples_split=4, random_state=42, n_jobs=-1
            ),
            "Gradient Boosting": GradientBoostingRegressor(
                n_estimators=100, max_depth=5, learning_rate=0.08, random_state=42
            ),
            "Ridge Regression": Ridge(alpha=5.0)
        }

        best_val_mae = float("inf")
        best_name = None
        best_model = None

        for name, model in candidates.items():
            model.fit(X_train, y_train)
            v_preds = model.predict(X_val)
            v_valid = np.isfinite(v_preds) & np.isfinite(y_val.to_numpy(dtype=float))
            if not v_valid.any():
                continue
            v_mae = float(mean_absolute_error(y_val.to_numpy(dtype=float)[v_valid], v_preds[v_valid]))
            logger.info(f"  [{name}] Val MAE: {v_mae:.2f}")
            if v_mae < best_val_mae:
                best_val_mae = v_mae
                best_name = name
                best_model = model

        if best_model is None:
            raise ValueError(f"No candidate model could be evaluated for horizon {h}.")

        # Evaluate best model on Unseen Chronological Test Set
        test_preds_all = np.asarray(best_model.predict(X_test), dtype=float)
        y_test_array = y_test.to_numpy(dtype=float)
        valid = np.isfinite(y_test_array) & np.isfinite(test_preds_all)
        y_eval = y_test_array[valid]
        test_preds = test_preds_all[valid]

        if len(y_eval) == 0:
            raise ValueError(f"No valid test observations for horizon {h}.")

        test_mae = float(mean_absolute_error(y_eval, test_preds))
        test_rmse = float(root_mean_squared_error(y_eval, test_preds))
        test_r2 = safe_r2(y_eval, test_preds)

        # AQI category accuracy and macro-F1 (classification of AQI categories)
        true_cats = [get_aqi_category_name(v) for v in y_eval]
        pred_cats = [get_aqi_category_name(v) for v in test_preds]
        cat_acc = float(accuracy_score(true_cats, pred_cats))
        cat_f1 = float(f1_score(true_cats, pred_cats, average="macro", zero_division=0))

        mae_improvement = (
            round(((base_mae - test_mae) / base_mae) * 100.0, 1)
            if base_mae is not None and base_mae > 0 else None
        )

        logger.info(f"Selected: {best_name}")
        logger.info(f"Test MAE: {test_mae:.2f}")
        logger.info(f"Test RMSE: {test_rmse:.2f}")
        logger.info(f"Test R2: {test_r2:.4f}" if test_r2 is not None else "Test R2: N/A")
        logger.info(f"AQI Category Accuracy: {cat_acc * 100:.1f}%, Macro-F1: {cat_f1:.3f}")
        logger.info(
            f"Baseline MAE: {base_mae:.2f}" if base_mae is not None else "Baseline MAE: N/A"
        )
        logger.info(
            f"Baseline RMSE: {base_rmse:.2f}" if base_rmse is not None else "Baseline RMSE: N/A"
        )
        logger.info(
            f"MAE improvement vs baseline: {mae_improvement}%"
            if mae_improvement is not None else "MAE improvement vs baseline: N/A"
        )

        trained_models[h] = best_model
        scalers[h] = scaler
        horizon_metrics[f"day_{h}"] = {
            "horizon": h,
            "best_algorithm": best_name,
            "test_mae": round(test_mae, 2),
            "test_rmse": round(test_rmse, 2),
            "test_r2": round(test_r2, 4) if test_r2 is not None else None,
            "baseline_mae": round(base_mae, 2) if base_mae is not None else None,
            "baseline_rmse": round(base_rmse, 2) if base_rmse is not None else None,
            "baseline_r2": round(base_r2, 4) if base_r2 is not None else None,
            "mae_improvement_pct": mae_improvement,
            "cpcb_category_accuracy": round(cat_acc * 100, 1),
            "cpcb_category_macro_f1": round(cat_f1, 3),
            "test_sample_size": int(len(y_eval))
        }

        # Per-city breakdown on test set for Horizon 1
        if h == 1:
            test_rows = h_data.loc[test_idx].copy()
            test_rows["actual_h1"] = y_test.to_numpy(dtype=float)
            test_rows["pred_h1"] = test_preds_all
            for city_name, c_grp in test_rows.groupby("city"):
                c_y = c_grp["actual_h1"].to_numpy(dtype=float)
                c_p = c_grp["pred_h1"].to_numpy(dtype=float)
                c_valid = np.isfinite(c_y) & np.isfinite(c_p)
                c_y = c_y[c_valid]
                c_p = c_p[c_valid]
                if len(c_y) == 0:
                    continue
                c_r2 = safe_r2(c_y, c_p)
                city_test_metrics[city_name] = {
                    "city": city_name,
                    "test_samples": int(len(c_y)),
                    "mae": round(float(mean_absolute_error(c_y, c_p)), 2),
                    "rmse": round(float(root_mean_squared_error(c_y, c_p)), 2),
                    "r2": round(c_r2, 4) if c_r2 is not None else None
                }

 # Save artifacts to backend/models_cache/ (unchanged filenames and structure)
    MODELS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    models_file = MODELS_CACHE_DIR / "multi_horizon_models.joblib"
    scalers_file = MODELS_CACHE_DIR / "multi_horizon_scalers.joblib"
    meta_file = MODELS_CACHE_DIR / "feature_metadata.json"
    metrics_file = MODELS_CACHE_DIR / "model_evaluation_metrics.json"

    joblib.dump(trained_models, models_file)
    joblib.dump(scalers, scalers_file)

    meta = {
        "feature_cols": feature_cols,
        "horizons": HORIZONS,
        "train_date": pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S"),
        "training_records": len(train_indices),
        "test_records": len(test_indices),
        "source_dataset": data_path.name
    }
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    with open(metrics_file, "w", encoding="utf-8") as f:
        json.dump({"horizons": horizon_metrics, "per_city_h1": city_test_metrics}, f, indent=2)

    logger.info(f"Saved model artifacts to {MODELS_CACHE_DIR}")

    # Generate Markdown Evaluation Report
    report_md = f"""# Machine-Learning Model Evaluation & Validation Report

**Training Execution Timestamp:** {meta['train_date']}  
**Dataset Source:** `{data_path.name}` (CPCB CAAQM Network via xKDR India Database)  
**Methodology:** Direct Multi-Horizon Regression with Chronological Train (70%) / Validation (15%) / Test (15%) split.

## 1. Overall Performance by Forecast Horizon (Test Set)
| Horizon | Selected Algorithm | Test MAE | Test RMSE | Test R² | Baseline MAE | Error Reduction vs Baseline | CPCB Category Accuracy | Macro-F1 |
|---|---|---|---|---|---|---|---|---|
"""
    for h in HORIZONS:
        m = horizon_metrics[f"day_{h}"]
        r2_text = m["test_r2"] if m["test_r2"] is not None else "N/A"
        baseline_text = m["baseline_mae"] if m["baseline_mae"] is not None else "N/A"
        improvement_text = (
            f"+{m['mae_improvement_pct']}%"
            if m["mae_improvement_pct"] is not None else "N/A"
        )
        report_md += (
            f"| **Day +{h}** | {m['best_algorithm']} | **{m['test_mae']}** | **{m['test_rmse']}** | "
            f"**{r2_text}** | {baseline_text} | **{improvement_text}** | "
            f"{m['cpcb_category_accuracy']}% | {m['cpcb_category_macro_f1']} |\n"
        )

    report_md += """
## 2. City-Level Test Performance (Horizon Day +1)
| City | Test Samples | Test MAE | Test RMSE | Test R² |
|---|---|---|---|---|
"""
    for c_name, c_m in sorted(city_test_metrics.items()):
        city_r2_text = c_m["r2"] if c_m["r2"] is not None else "N/A"
        report_md += (
            f"| **{c_name}** | {c_m['test_samples']} | {c_m['mae']} | "
            f"{c_m['rmse']} | {city_r2_text} |\n"
        )

    report_md += r"""
## 3. Methodological Notes
1. MAE and RMSE are computed on valid actual/predicted AQI pairs from the test partition.
2. R² is reported as N/A when it is mathematically undefined (fewer than two samples or constant actual values).
3. CPCB Category Accuracy is the percentage of predictions whose AQI category matches the observed category; it is not numerical AQI accuracy.
4. Baseline improvement is reported as N/A when baseline MAE is zero or unavailable.
"""
    report_file = MODELS_CACHE_DIR / "MODEL_EVALUATION_REPORT.md"
    with open(report_file, "w", encoding="utf-8") as f:
        f.write(report_md)
    logger.info(f"Saved evaluation report to {report_file}")
    print("\n" + report_md)


if __name__ == "__main__":
    target_data = PROCESSED_DATASET_PATH if PROCESSED_DATASET_PATH.exists() else ORIGINAL_DATASET_PATH
    train_and_evaluate_multi_horizon(target_data)
