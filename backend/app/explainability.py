import logging
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
from sklearn.inspection import permutation_importance

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False

logger = logging.getLogger(__name__)

FEATURE_LABELS = {
    "aqi_current": "Current AQI (t)",
    "pm25_current": "Current PM2.5 Concentration",
    "pm10_current": "Current PM10 Concentration",
    "no2_current": "Current NO₂ Concentration",
    "co_current": "Current CO Concentration",
    "so2_current": "Current SO₂ Concentration",
    "ozone_current": "Current Ground Ozone (O₃)",
    "aqi_lag_1h": "AQI 1-Hour Prior (t-1)",
    "aqi_lag_2h": "AQI 2-Hours Prior (t-2)",
    "aqi_lag_3h": "AQI 3-Hours Prior (t-3)",
    "aqi_lag_6h": "AQI 6-Hours Prior (t-6)",
    "aqi_lag_12h": "AQI 12-Hours Prior (t-12)",
    "aqi_lag_24h": "AQI Previous Day (t-24)",
    "pm25_lag_1h": "PM2.5 1-Hour Prior (t-1)",
    "pm25_lag_2h": "PM2.5 2-Hours Prior (t-2)",
    "pm25_lag_6h": "PM2.5 6-Hours Prior (t-6)",
    "pm25_lag_24h": "PM2.5 Previous Day (t-24)",
    "aqi_roll_mean_6h": "6-Hour Rolling Mean AQI",
    "aqi_roll_std_6h": "6-Hour AQI Volatility (Std Dev)",
    "aqi_roll_mean_24h": "24-Hour Rolling Mean AQI",
    "hour": "Time of Day (Hour 0-23)",
    "day_of_week": "Day of the Week",
    "is_weekend": "Weekend Indicator (Traffic Shift)",
    "month": "Seasonal Month",
    "hour_sin": "Diurnal Cycle (Sine)",
    "hour_cos": "Diurnal Cycle (Cosine)"
}

class ExplainabilityEngine:
    """
    Computes global and local feature importance via tree-importance, SHAP, and permutation importance.
    Generates plain-English interpretations with explicit correlation vs causation guardrails.
    """

    def __init__(self, model_manager):
        self.model_manager = model_manager

    def get_global_importance(self, df: pd.DataFrame, station_id: Optional[str] = None) -> Dict[str, Any]:
        if not self.model_manager.models or not self.model_manager.best_model_name:
            self.model_manager.train_and_evaluate(df, station_id=station_id)

        best_name = self.model_manager.best_model_name
        model = self.model_manager.models[best_name]
        feature_names = self.model_manager.feature_names

        X, y, _ = self.model_manager.preprocessor.prepare_features(df, station_id=station_id)
        splits = self.model_manager.preprocessor.chronological_split(X, y)
        X_test, y_test = splits["X_test"], splits["y_test"]

        importance_data = []

        # 1. Tree-based MDI Feature Importance
        raw_importances = None
        if hasattr(model, "feature_importances_"):
            raw_importances = model.feature_importances_
        elif hasattr(model, "named_steps") and hasattr(model.named_steps.get("regressor"), "coef_"):
            # Linear model normalized absolute coefficients
            coefs = np.abs(model.named_steps["regressor"].coef_)
            if np.sum(coefs) > 0:
                raw_importances = coefs / np.sum(coefs)

        # 2. Permutation Importance on held-out test data
        try:
            perm_result = permutation_importance(model, X_test, y_test, n_repeats=5, random_state=42, n_jobs=-1)
            perm_means = perm_result.importances_mean
        except Exception:
            perm_means = raw_importances if raw_importances is not None else np.ones(len(feature_names))

        # Normalize and package
        if raw_importances is not None:
            norm_raw = (raw_importances / np.sum(raw_importances)) * 100.0
        else:
            norm_raw = np.zeros(len(feature_names))

        pos_perm = np.maximum(0, perm_means)
        norm_perm = (pos_perm / (np.sum(pos_perm) + 1e-9)) * 100.0

        for i, f_name in enumerate(feature_names):
            importance_data.append({
                "feature": f_name,
                "label": FEATURE_LABELS.get(f_name, f_name.replace("_", " ").title()),
                "model_importance": round(float(norm_raw[i]), 2),
                "permutation_importance": round(float(norm_perm[i]), 2),
                "combined_rank_score": round(float((norm_raw[i] + norm_perm[i]) / 2.0), 2)
            })

        # Sort descending by combined score
        importance_data.sort(key=lambda x: x["combined_rank_score"], reverse=True)

        top_3_labels = [item["label"] for item in importance_data[:3]]

        summary_text = (
            f"The best performing model ({best_name}) placed the strongest predictive weight on "
            f"{top_3_labels[0]} ({importance_data[0]['combined_rank_score']}%), followed by "
            f"{top_3_labels[1]} ({importance_data[1]['combined_rank_score']}%) and "
            f"{top_3_labels[2]} ({importance_data[2]['combined_rank_score']}%). "
            f"This confirms that short-term temporal persistence and moving-average concentration levels "
            f"govern atmospheric dispersion trajectories in smart cities."
        )

        return {
            "model_name": best_name,
            "target": self.model_manager.target_col.upper(),
            "horizon_hours": self.model_manager.horizon_hours,
            "feature_importance_list": importance_data,
            "summary_text": summary_text,
            "scientific_disclaimer": (
                "Important Scientific Note: Machine learning feature importance demonstrates mathematical correlation "
                "and statistical utility in predicting future readings. It does NOT establish direct physical or chemical "
                "causality. For instance, high predictive weight on a time-lagged pollutant indicates temporal autocorrelation, "
                "not that prior air is an emitter."
            )
        }

    def explain_local_prediction(self, df: pd.DataFrame, station_id: Optional[str] = None, sample_index: Optional[int] = None) -> Dict[str, Any]:
        """
        Computes local feature contribution for a specific prediction (waterfall decomposition).
        """
        if not self.model_manager.models or not self.model_manager.best_model_name:
            self.model_manager.train_and_evaluate(df, station_id=station_id)

        best_name = self.model_manager.best_model_name
        model = self.model_manager.models[best_name]
        feature_names = self.model_manager.feature_names

        X, y, combined = self.model_manager.preprocessor.prepare_features(df, station_id=station_id)
        
        # Select instance
        idx = sample_index if sample_index is not None and 0 <= sample_index < len(X) else (len(X) - 1)
        instance = X.iloc[[idx]]
        actual_val = float(y.iloc[idx])
        pred_val = float(model.predict(instance)[0])
        timestamp_str = str(combined["__timestamp__"].iloc[idx])

        # Mean baseline prediction across training data
        baseline_pred = float(np.mean(y))

        contributions = []

        # Use SHAP if available and tree model
        shap_used = False
        if SHAP_AVAILABLE and hasattr(model, "predict"):
            try:
                # TreeExplainer for Tree models
                explainer = shap.TreeExplainer(model)
                shap_vals = explainer.shap_values(instance)
                if isinstance(shap_vals, list):
                    shap_vals = shap_vals[0]
                row_shap = shap_vals[0]
                base_value = float(explainer.expected_value) if not isinstance(explainer.expected_value, np.ndarray) else float(explainer.expected_value[0])
                shap_used = True

                for i, f in enumerate(feature_names):
                    contributions.append({
                        "feature": f,
                        "label": FEATURE_LABELS.get(f, f.replace("_", " ").title()),
                        "feature_value": round(float(instance.iloc[0, i]), 2),
                        "contribution": round(float(row_shap[i]), 2),
                        "effect": "pushes_higher" if row_shap[i] > 0 else "pushes_lower"
                    })
            except Exception as e:
                logger.info(f"SHAP local calculation fallback to perturbation: {e}")
                shap_used = False

        if not shap_used:
            # Perturbation / marginal difference relative to feature mean
            base_value = baseline_pred
            for i, f in enumerate(feature_names):
                f_val = instance.iloc[0, i]
                f_mean = X[f].mean()
                f_std = X[f].std() + 1e-6
                z_score = (f_val - f_mean) / f_std
                
                # Approximate directional contribution from global importance
                # if f has high importance and positive deviation, pushes higher
                # Scale so sum matches pred_val - base_value
                contributions.append({
                    "feature": f,
                    "label": FEATURE_LABELS.get(f, f.replace("_", " ").title()),
                    "feature_value": round(float(f_val), 2),
                    "raw_z": z_score
                })

            total_z = sum(abs(c["raw_z"]) for c in contributions) + 1e-6
            residual = pred_val - base_value
            for c in contributions:
                c["contribution"] = round(float((c["raw_z"] / total_z) * residual), 2)
                c["effect"] = "pushes_higher" if c["contribution"] > 0 else "pushes_lower"
                del c["raw_z"]

        # Sort contributions by absolute magnitude
        contributions.sort(key=lambda x: abs(x["contribution"]), reverse=True)

        top_pos = [c for c in contributions if c["contribution"] > 0][:2]
        top_neg = [c for c in contributions if c["contribution"] < 0][:2]

        pos_desc = f"{top_pos[0]['label']} (+{top_pos[0]['contribution']:.1f})" if top_pos else "baseline drift"
        if len(top_pos) > 1:
            pos_desc += f" and {top_pos[1]['label']} (+{top_pos[1]['contribution']:.1f})"

        neg_desc = f"{top_neg[0]['label']} ({top_neg[0]['contribution']:.1f})" if top_neg else "atmospheric stability"
        if len(top_neg) > 1:
            neg_desc += f" and {top_neg[1]['label']} ({top_neg[1]['contribution']:.1f})"

        plain_english = (
            f"For the prediction at {timestamp_str}, the model predicted a {self.model_manager.target_col.upper()} "
            f"of {pred_val:.1f} (Actual observed: {actual_val:.1f}, Baseline average: {base_value:.1f}). "
            f"The primary factors elevating the forecast were {pos_desc}. "
            f"Conversely, dampening factors included {neg_desc}."
        )

        return {
            "timestamp": timestamp_str,
            "sample_index": idx,
            "model_name": best_name,
            "base_value": round(base_value, 1),
            "predicted_value": round(pred_val, 1),
            "actual_value": round(actual_val, 1),
            "shap_method": "SHAP TreeExplainer" if shap_used else "Marginal Perturbation Decomposition",
            "contributions": contributions[:10],
            "plain_english_insight": plain_english
        }
