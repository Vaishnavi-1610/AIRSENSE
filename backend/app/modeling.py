
import os
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import pandas as pd
import numpy as np
import joblib

from app.config import (
    MODELS_CACHE_DIR,
    get_aqi_category_info,
    AQI_CATEGORIES,
    get_current_kolkata_date,
)
from app.live_aqi_service import fetch_live_observation_for_city

logger = logging.getLogger(__name__)


class ForecastEngine:
    """
    Daily multi-horizon AQI forecasting engine.

    Uses cached models when available. Historical evaluation never substitutes
    the observed AQI for a prediction. If model artifacts are unavailable,
    a clearly identified rolling-mean baseline is used instead.
    """

    POLLUTANTS = ("pm25", "pm10", "no2", "so2", "co", "ozone")

    def __init__(self, target_col: str = "aqi"):
        self.target_col = target_col
        self.models: Dict[int, Any] = {}
        self.scalers: Dict[int, Any] = {}
        self.feature_cols: List[str] = []
        self.metrics: Dict[str, Any] = {}
        self._load_cached_models()

    def _load_cached_models(self):
        models_path = Path(MODELS_CACHE_DIR) / "multi_horizon_models.joblib"
        scalers_path = Path(MODELS_CACHE_DIR) / "multi_horizon_scalers.joblib"
        meta_path = Path(MODELS_CACHE_DIR) / "feature_metadata.json"
        metrics_path = Path(MODELS_CACHE_DIR) / "model_evaluation_metrics.json"

        if not (
            models_path.exists()
            and scalers_path.exists()
            and meta_path.exists()
        ):
            logger.warning(
                "Forecast model artifacts are missing. "
                "A baseline will be used until models are available."
            )
            return

        try:
            models = joblib.load(models_path)
            scalers = joblib.load(scalers_path)

            with open(meta_path, "r", encoding="utf-8") as file:
                metadata = json.load(file)

            metrics = {}
            if metrics_path.exists():
                with open(metrics_path, "r", encoding="utf-8") as file:
                    metrics = json.load(file)

            if not isinstance(models, dict) or not isinstance(scalers, dict):
                raise ValueError("Cached models and scalers must be dictionaries.")

            self.models = models
            self.scalers = scalers
            self.feature_cols = metadata.get("feature_cols", [])
            self.metrics = metrics

            logger.info("Forecast model artifacts loaded successfully.")

        except Exception:
            logger.exception("Could not load cached forecasting artifacts.")
            self.models = {}
            self.scalers = {}
            self.feature_cols = []
            self.metrics = {}

    @staticmethod
    def _safe_float(value, default=0.0) -> float:
        try:
            result = float(value)
            return result if np.isfinite(result) else float(default)
        except (TypeError, ValueError):
            return float(default)

    @staticmethod
    def _clamp_aqi(value: float) -> float:
        return float(np.clip(value, 0.0, 500.0))

    def _prepare_city_data(
        self, df: pd.DataFrame, city: str
    ) -> pd.DataFrame:
        if not isinstance(df, pd.DataFrame) or df.empty:
            raise ValueError("AQI dataframe is empty or invalid.")

        required = {"city", "date", self.target_col}
        missing = required.difference(df.columns)
        if missing:
            raise ValueError(
                f"Dataframe is missing required columns: {sorted(missing)}"
            )

        subset = df[
            df["city"].astype(str).str.strip().str.lower()
            == city.strip().lower()
        ].copy()

        if subset.empty:
            raise ValueError(f"No records available for city: {city}")

        subset["dt"] = pd.to_datetime(subset["date"], errors="coerce")
        subset[self.target_col] = pd.to_numeric(
            subset[self.target_col], errors="coerce"
        )
        subset = subset.dropna(subset=["dt", self.target_col])

        if subset.empty:
            raise ValueError(f"No valid AQI records available for city: {city}")

        for pollutant in self.POLLUTANTS:
            if pollutant in subset.columns:
                subset[pollutant] = pd.to_numeric(
                    subset[pollutant], errors="coerce"
                )

        # Aggregate multiple records for a date, if the input contains
        # multiple monitoring stations for the same city and date.
        aggregation = {self.target_col: "mean"}
        for pollutant in self.POLLUTANTS:
            if pollutant in subset.columns:
                aggregation[pollutant] = "mean"
        if "station_count" in subset.columns:
            aggregation["station_count"] = "max"

        subset["dt"] = subset["dt"].dt.normalize()
        daily = (
            subset.groupby("dt", as_index=False)
            .agg(aggregation)
            .sort_values("dt")
            .reset_index(drop=True)
        )
        daily["city"] = city

        return daily

    def _build_features_from_prior(
        self,
        prior: pd.DataFrame,
        target_dt: datetime,
        all_cities: Optional[List[str]] = None,
        city: Optional[str] = None,
    ) -> pd.DataFrame:
        """
        Build one inference row using only observations before target_dt.
        The target day's AQI is never included in its own features.
        """
        if prior.empty:
            raise ValueError("Insufficient prior observations to build features.")

        prior = prior.sort_values("dt").copy()
        aqi = prior[self.target_col].astype(float)
        current_date = pd.Timestamp(target_dt)

        pm25 = (
            prior["pm25"].astype(float).ffill()
            if "pm25" in prior.columns
            else aqi * 0.45
        )
        pm25 = pm25.fillna(aqi * 0.45)

        row = {
            "aqi_current": float(aqi.iloc[-1]),
            "aqi_lag_1": float(aqi.iloc[-2]) if len(aqi) >= 2 else float(aqi.iloc[-1]),
            "aqi_lag_2": float(aqi.iloc[-3]) if len(aqi) >= 3 else float(aqi.iloc[-1]),
            "aqi_lag_3": float(aqi.iloc[-4]) if len(aqi) >= 4 else float(aqi.iloc[-1]),
            "aqi_lag_7": float(aqi.iloc[-8]) if len(aqi) >= 8 else float(aqi.iloc[-1]),
            "aqi_roll_mean_7": float(aqi.tail(7).mean()),
            "aqi_roll_std_7": float(aqi.tail(7).std()) if len(aqi) >= 3 else 0.0,
            "day_of_week": int(current_date.weekday()),
            "is_weekend": int(current_date.weekday() >= 5),
            "month": int(current_date.month),
            "day_of_year": int(current_date.dayofyear),
        }

        for pollutant in self.POLLUTANTS:
            if pollutant in prior.columns:
                values = prior[pollutant].astype(float).ffill()
                value = values.iloc[-1]
                row[f"{pollutant}_current"] = (
                    float(value) if pd.notna(value) else 0.0
                )

        for lag in (1, 2, 3, 7):
            position = -(lag + 1)
            row[f"pm25_lag_{lag}"] = (
                float(pm25.iloc[position])
                if len(pm25) >= abs(position)
                else float(pm25.iloc[-1])
            )

        for name in all_cities or []:
            row[f"city_{name}"] = float(
                str(name).strip().lower() == str(city).strip().lower()
            )

        features = pd.DataFrame([row])

        # The cached training metadata defines the model's expected order.
        if self.feature_cols:
            for col in self.feature_cols:
                if col not in features.columns:
                    features[col] = 0.0
            features = features[self.feature_cols]

        return (
            features.replace([np.inf, -np.inf], np.nan)
            .fillna(0.0)
        )

    def _predict_from_prior(
        self,
        prior: pd.DataFrame,
        target_dt: datetime,
        horizon: int = 1,
        all_cities: Optional[List[str]] = None,
        city: Optional[str] = None,
    ) -> Tuple[float, str]:
        """Predict from prior data; never use the target's observed AQI."""
        features = self._build_features_from_prior(
            prior=prior,
            target_dt=target_dt,
            all_cities=all_cities,
            city=city,
        )

        model = self.models.get(horizon)
        scaler = self.scalers.get(horizon)

        if model is not None and scaler is not None:
            try:
                scaled = scaler.transform(features)
                prediction = float(model.predict(scaled)[0])
                if np.isfinite(prediction):
                    return self._clamp_aqi(prediction), "ml_model"
            except Exception:
                logger.exception(
                    "Model prediction failed for city=%s, horizon=%s",
                    city,
                    horizon,
                )

        # Honest fallback: calculate from prior AQI, not from the target row.
        prior_aqi = prior[self.target_col].astype(float)
        if prior_aqi.empty:
            raise ValueError("No prior AQI values available for baseline prediction.")

        baseline = float(prior_aqi.tail(7).mean())
        return self._clamp_aqi(baseline), "rolling_mean_baseline"

    def _get_horizon_metrics(self, horizon: int) -> Dict[str, Any]:
        return self.metrics.get("horizons", {}).get(f"day_{horizon}", {})

    def _confidence_interval(
        self, prediction: float, rmse: float
    ) -> Dict[str, Any]:
        margin = 1.96 * max(0.0, float(rmse))
        return {
            "lower": max(0.0, round(prediction - margin, 1)),
            "upper": min(500.0, round(prediction + margin, 1)),
            "level": "95%",
        }

    def generate_daily_forecast(
        self,
        df: pd.DataFrame,
        city: str,
        days: int = 5,
        reference_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a prediction for today and forecasts for subsequent days."""
        days = min(max(int(days), 1), 5)

        if not self.models:
            self._load_cached_models()

        daily = self._prepare_city_data(df, city)
        today = (
            pd.to_datetime(reference_date).date()
            if reference_date
            else get_current_kolkata_date()
        )
        all_cities = df["city"].dropna().astype(str).unique().tolist()

        # Use only observations strictly before the forecast date.
        prior_today = daily[daily["dt"].dt.date < today].copy()
        if prior_today.empty:
            # No past observations means a valid model prediction is impossible.
            # Use the earliest known observation as a clearly labelled fallback.
            prior_today = daily.iloc[:1].copy()
            today_source = "unavailable_insufficient_history"
            today_raw = self._safe_float(prior_today[self.target_col].iloc[-1], 100.0)
        else:
            today_raw, today_source = self._predict_from_prior(
                prior_today,
                pd.Timestamp(today),
                horizon=1,
                all_cities=all_cities,
                city=city,
            )

        today_pred = round(self._clamp_aqi(today_raw), 1)
        today_cat = get_aqi_category_info(today_pred)
        today_metrics = self._get_horizon_metrics(1)
        today_rmse = self._safe_float(today_metrics.get("test_rmse"), 30.22)

        today_prediction = {
            "date": str(today),
            "date_formatted": today.strftime("%d %B %Y"),
            "display_label": today.strftime("%a, %d %b %Y"),
            "predicted_aqi": today_pred,
            "category": today_cat["name"],
            "color": today_cat["color"],
            "badge": today_cat["badge"],
            "prediction_source": today_source,
            "confidence_interval": self._confidence_interval(today_pred, today_rmse),
            "health_advisory": self._health_advisory(today_pred),
        }

        # Recent actual observations are context only.
        recent_observed = []
        for _, row in daily.tail(5).iterrows():
            value = round(float(row[self.target_col]), 1)
            category = get_aqi_category_info(value)
            recent_observed.append({
                "date": str(row["dt"].date()),
                "observed_aqi": value,
                "category": category["name"],
                "color": category["color"],
                "is_prediction": False,
            })

        latest = daily.iloc[-1]
        latest_aqi = round(float(latest[self.target_col]), 1)
        latest_date = latest["dt"].date()
        forecasts = []
        previous_prediction = today_pred

        titles = {
            1: "Day 1: Tomorrow",
            2: "Day 2: Day after tomorrow",
            3: "Day 3",
            4: "Day 4",
            5: "Day 5",
        }

        for horizon in range(1, days + 1):
            future_date = pd.Timestamp(today) + pd.Timedelta(days=horizon)
            # For each future date, only use observations before that date.
            prior = daily[daily["dt"] < future_date].copy()

            if prior.empty:
                prior = daily.iloc[:1].copy()

            prediction, source = self._predict_from_prior(
                prior,
                future_date,
                horizon=horizon,
                all_cities=all_cities,
                city=city,
            )
            prediction = round(self._clamp_aqi(prediction), 1)

            metrics = self._get_horizon_metrics(horizon)
            rmse = self._safe_float(
                metrics.get("test_rmse"), 30.0 + horizon * 4.0
            )
            category = get_aqi_category_info(prediction)
            delta = round(prediction - latest_aqi, 1)
            step_delta = prediction - previous_prediction

            if delta > 5:
                comparison, comparison_label, comparison_color = (
                    "increase",
                    f"Higher than latest observation (+{delta} AQI points)",
                    "#ef4444",
                )
            elif delta < -5:
                comparison, comparison_label, comparison_color = (
                    "decrease",
                    f"Lower than latest observation ({delta} AQI points)",
                    "#10b981",
                )
            else:
                comparison, comparison_label, comparison_color = (
                    "stable",
                    "Approximately stable compared with latest observation",
                    "#64748b",
                )

            trend = (
                "deteriorating" if step_delta > 5
                else "improving" if step_delta < -5
                else "stable"
            )

            forecasts.append({
                "step": horizon,
                "horizon_label": titles[horizon],
                "horizon_title": titles[horizon],
                "date": str(future_date.date()),
                "date_formatted": future_date.strftime("%d %B %Y"),
                "display_label": future_date.strftime("%d %b %Y"),
                "predicted_aqi": prediction,
                "category": category["name"],
                "color": category["color"],
                "badge": category["badge"],
                "health_advisory": self._health_advisory(prediction),
                "trend_direction": trend,
                "comparison_to_actual": comparison,
                "delta_from_actual": delta,
                "comparison_label": comparison_label,
                "comparison_color": comparison_color,
                "prediction_source": source,
                "is_prediction": True,
                "confidence_interval": self._confidence_interval(prediction, rmse),
            })
            previous_prediction = prediction

        final_aqi = forecasts[-1]["predicted_aqi"]
        total_delta = round(final_aqi - latest_aqi, 1)

        if total_delta > 10:
            overall_trend = (
                f"Pollution may increase over the requested horizon "
                f"(+{total_delta} AQI points versus the latest observation)."
            )
            trend_tone = "warning"
        elif total_delta < -10:
            overall_trend = (
                f"Pollution may decrease over the requested horizon "
                f"({total_delta} AQI points versus the latest observation)."
            )
            trend_tone = "positive"
        else:
            overall_trend = "Pollution is projected to remain approximately stable."
            trend_tone = "neutral"

        observed_recs = [
            f"Latest dataset observation: AQI {latest_aqi} on "
            f"{latest_date.strftime('%d %b %Y')}."
        ]
        peak_prediction = max(x["predicted_aqi"] for x in forecasts)
        predicted_recs = [self._health_advisory(peak_prediction)]

        alerts = self.detect_high_pollution_alerts(
            city=city,
            latest_obs_aqi=latest_aqi,
            latest_obs_date=latest_date.strftime("%d %b %Y"),
            today_prediction=today_prediction,
            forecast_steps=forecasts,
            threshold=200.0,
        )

        return {
            "city": city,
            "today_date": str(today),
            "today_formatted": today.strftime("%d %b %Y"),
            "today_prediction": today_prediction,
            "forecast_reference_date": str(today),
            "forecast_reference_formatted": today.strftime("%d %B %Y"),
            "latest_observed_date": latest_date.strftime("%d %b %Y"),
            "latest_observed_aqi": latest_aqi,
            "latest_observed_category": get_aqi_category_info(latest_aqi)["name"],
            "is_live_observation": latest_date == today,
            "freshness_label": (
                "Observation dated today"
                if latest_date == today
                else f"Latest dataset observation: {latest_date.strftime('%d %b %Y')}"
            ),
            "requested_horizon_days": days,
            "recent_observed": recent_observed,
            "forecast": forecasts,
            "alerts": alerts,
            "overall_trend": overall_trend,
            "trend_tone": trend_tone,
            "delta_from_latest": total_delta,
            "baseline_recent_aqi": round(float(daily.tail(7)[self.target_col].mean()), 1),
            "observed_recommendations": observed_recs,
            "predicted_recommendations": predicted_recs,
            "recommendations": observed_recs + predicted_recs,
            "model_metadata": {
                "validation_approach": (
                    "Prior-only features; cached model metrics are reported separately"
                ),
                "day_1_test_mae": today_metrics.get("test_mae"),
                "day_1_test_r2": today_metrics.get("test_r2"),
                "data_provenance": "Source dataset supplied to ForecastEngine",
                "today_prediction_source": today_source,
            },
        }

    @staticmethod
    def _health_advisory(aqi: float) -> str:
        if aqi > 300:
            return (
                "Very poor air quality: avoid strenuous outdoor activity; "
                "vulnerable people should remain indoors."
            )
        if aqi > 200:
            return (
                "Poor air quality: sensitive groups should reduce prolonged "
                "outdoor exertion and consider a well-fitting N95 mask."
            )
        if aqi > 100:
            return (
                "Moderate air quality: sensitive individuals should limit "
                "strenuous outdoor activity if symptoms occur."
            )
        if aqi > 50:
            return "Satisfactory air quality; unusually sensitive people may experience discomfort."
        return "Good air quality; minimal health impact is expected."

    def detect_high_pollution_alerts(
        self,
        city: str,
        latest_obs_aqi: Optional[float],
        latest_obs_date: Optional[str],
        today_prediction: Dict[str, Any],
        forecast_steps: List[Dict[str, Any]],
        threshold: float = 200.0,
    ) -> Dict[str, Any]:
        """Build distinct current-observation and forecast pollution alerts."""
        alerts = []
        seen_ids = set()

        def add_alert(
            alert_id: str,
            alert_type: str,
            aqi_value: float,
            timestamp: str,
            expected_impact: str,
            headline: str,
            description: str,
            precautions: List[str],
            is_prediction: bool,
        ):
            if alert_id in seen_ids:
                return

            seen_ids.add(alert_id)
            category = get_aqi_category_info(aqi_value)
            alerts.append({
                "id": alert_id,
                "city": city,
                "alert_type": alert_type,
                "alert_type_label": (
                    "Current Pollution Alert"
                    if alert_type == "current"
                    else "Forecast Pollution Alert"
                ),
                "severity": category["name"],
                "color": category["color"],
                "badge": category["badge"],
                "aqi_value": round(float(aqi_value), 1),
                "is_prediction": is_prediction,
                "timestamp": timestamp,
                "expected_impact": expected_impact,
                "status": "Active",
                "headline": headline,
                "description": description,
                "precautions": precautions,
            })

        if latest_obs_aqi is not None and latest_obs_aqi >= threshold:
            add_alert(
                f"current-{city.lower()}-{latest_obs_date}",
                "current",
                latest_obs_aqi,
                f"{latest_obs_date} (dataset observation)",
                "Observed",
                f"High AQI Observation in {city}",
                f"Observed AQI {latest_obs_aqi} meets or exceeds threshold {threshold}.",
                [
                    "Reduce prolonged outdoor exertion.",
                    "Sensitive groups should take extra precautions.",
                    "Follow local public-health advice.",
                ],
                False,
            )

        today_aqi = today_prediction.get("predicted_aqi")
        if today_aqi is not None and today_aqi >= threshold:
            date = today_prediction.get("date", "today")
            add_alert(
                f"forecast-{city.lower()}-{date}",
                "forecast",
                today_aqi,
                f"Issued for {date}",
                f"Today ({date})",
                f"High Pollution Forecast for {city}",
                f"The model forecasts AQI {today_aqi} for {date}.",
                [
                    "Consider moving strenuous outdoor activities indoors.",
                    "Sensitive groups should reduce heavy outdoor exertion.",
                ],
                True,
            )

        for step in forecast_steps:
            if step.get("predicted_aqi", 0) < threshold:
                continue

            date = step.get("date", "unknown")
            add_alert(
                f"forecast-{city.lower()}-{date}",
                "forecast",
                step["predicted_aqi"],
                "Forecast model output",
                f"{step.get('horizon_title', 'Upcoming day')} ({step.get('date_formatted', date)})",
                f"Elevated Pollution Expected in {city}",
                f"The forecast estimates AQI {step['predicted_aqi']} for {date}.",
                [
                    "Consider reducing strenuous outdoor activities.",
                    "Sensitive groups should monitor official air-quality guidance.",
                ],
                True,
            )

        count = len(alerts)
        summary = (
            f"{count} high-pollution alert(s) for {city} at or above AQI {threshold}."
            if count
            else f"No alerts at or above AQI {threshold} were identified for {city}."
        )

        return {
            "city": city,
            "threshold": threshold,
            "has_alerts": count > 0,
            "summary": summary,
            "alerts": alerts,
            "count": count,
        }

    def generate_live_vs_prediction_comparison(
        self,
        df: pd.DataFrame,
        city: str,
        reference_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Compare today's live observation against today's prediction.

        Retrospective predictions use only observations preceding each target
        date. Actual AQI is never copied into the prediction field.
        """
        if not self.models:
            self._load_cached_models()

        daily = self._prepare_city_data(df, city)
        all_cities = df["city"].dropna().astype(str).unique().tolist()

        today = (
            pd.to_datetime(reference_date).date()
            if reference_date
            else get_current_kolkata_date()
        )
        today_str = str(today)

        h1_metrics = self._get_horizon_metrics(1)
        rmse = self._safe_float(h1_metrics.get("test_rmse"), 30.22)

        prior_today = daily[daily["dt"].dt.date < today].copy()
        if prior_today.empty:
            today_prediction_value = float(daily.iloc[0][self.target_col])
            prediction_source = "unavailable_insufficient_history"
        else:
            today_prediction_value, prediction_source = self._predict_from_prior(
                prior_today,
                pd.Timestamp(today),
                horizon=1,
                all_cities=all_cities,
                city=city,
            )

        today_prediction_value = round(self._clamp_aqi(today_prediction_value), 1)
        today_category = get_aqi_category_info(today_prediction_value)
        ci = self._confidence_interval(today_prediction_value, rmse)

        latest = daily.iloc[-1]
        latest_date = latest["dt"].date()
        latest_date_str = str(latest_date)
        latest_aqi = round(float(latest[self.target_col]), 1)
        latest_category = get_aqi_category_info(latest_aqi)
        latest_display = latest["dt"].strftime("%d %b %Y")

        pollutants = {}
        for pollutant in self.POLLUTANTS:
            if pollutant in daily.columns and pd.notna(latest.get(pollutant)):
                pollutants[pollutant] = round(
                    float(latest[pollutant]),
                    2 if pollutant == "co" else 1,
                )

        historical_record = {
            "aqi": latest_aqi,
            "category": latest_category["name"],
            "color": latest_category["color"],
            "badge": latest_category["badge"],
            "date": latest_date_str,
            "display_date": latest_display,
            "timestamp": f"{latest_display}, Historical Dataset Observation",
            "data_source": "Historical AQI dataset",
            "station_count": int(latest.get("station_count", 1) or 1),
            "pollutants": pollutants,
            "is_historical": True,
        }

        try:
            live_result = fetch_live_observation_for_city(
                city, reference_date=today
            ) or {}
        except Exception as exc:
            logger.warning("Live observation lookup failed for %s: %s", city, exc)
            live_result = {
                "today_live_available": False,
                "warning_message": "Live AQI service is temporarily unavailable.",
            }

        live_available = bool(
            live_result.get("today_live_available")
            and live_result.get("aqi") is not None
        )

        if live_available:
            live_aqi = round(float(live_result["aqi"]), 1)
            live_category = get_aqi_category_info(live_aqi)
            live_display = live_result.get(
                "observation_display_date", today.strftime("%d %b %Y")
            )
            live_timestamp = live_result.get(
                "observation_timestamp", live_display
            )
            data_source = live_result.get(
                "data_source", "External live AQI service"
            )
            freshness_status = "Live Telemetry (Today)"
            freshness_note = live_result.get("freshness_note", "")
            warning = None

            observed_payload = {
                "aqi": live_aqi,
                "is_available": True,
                "category": live_category["name"],
                "color": live_category["color"],
                "badge": live_category["badge"],
                "pollutants": live_result.get("pollutants", {}),
                "timestamp": live_timestamp,
                "display_date": live_display,
                "data_source": data_source,
                "is_live": True,
            }

            absolute_difference = round(
                abs(today_prediction_value - live_aqi), 1
            )
            percentage_error = (
                round(absolute_difference / abs(live_aqi) * 100, 1)
                if live_aqi != 0
                else None
            )
            category_match = (
                live_category["name"].lower()
                == today_category["name"].lower()
            )

            category_order = [x["name"].lower() for x in AQI_CATEGORIES]
            try:
                rank_difference = abs(
                    category_order.index(live_category["name"].lower())
                    - category_order.index(today_category["name"].lower())
                )
            except ValueError:
                rank_difference = None

            if category_match:
                match_status, match_tone = "Exact Category Match", "positive"
            elif rank_difference == 1:
                match_status, match_tone = (
                    "Adjacent Category (Within 1 Band)",
                    "neutral",
                )
            else:
                match_status, match_tone = "Discrepant Category", "warning"

            evaluation_text = (
                f"Predicted AQI {today_prediction_value}; live AQI {live_aqi}; "
                f"absolute difference {absolute_difference} AQI points."
            )
            observation_date = live_result.get("observation_date", today_str)
            observation_display_date = live_display
            observation_timestamp = live_timestamp

        else:
            live_aqi = None
            live_display = f"Today ({today.strftime('%d %b %Y')})"
            live_timestamp = f"Live telemetry unavailable for {today_str}"
            data_source = "Historical AQI dataset"
            freshness_status = "Live Telemetry Unavailable for Today"
            freshness_note = (
                f"No verified live observation is available for {today_str}."
            )
            warning = live_result.get("warning_message") or freshness_note

            observed_payload = {
                "aqi": None,
                "is_available": False,
                "category": "Live Reading Pending",
                "color": "#64748b",
                "badge": "bg-slate-100 text-slate-700 border-slate-300",
                "pollutants": {},
                "timestamp": live_timestamp,
                "display_date": live_display,
                "data_source": data_source,
                "is_live": False,
            }

            absolute_difference = None
            percentage_error = None
            category_match = None
            rank_difference = None
            match_status, match_tone = "Live Observation Pending", "neutral"
            evaluation_text = (
                "A direct live comparison is unavailable because no verified "
                "live reading was returned for today. Historical evaluation "
                "is reported separately."
            )
            observation_date = latest_date_str
            observation_display_date = latest_display
            observation_timestamp = historical_record["timestamp"]

        # Retrospective evaluation. Each prediction uses rows before its date.
        matched_series = []
        start_idx = max(8, len(daily) - 14)

        for idx in range(start_idx, len(daily)):
            target = daily.iloc[idx]
            target_date = target["dt"]
            actual = round(float(target[self.target_col]), 1)
            prior = daily.iloc[:idx].copy()

            if prior.empty:
                continue

            try:
                predicted, source = self._predict_from_prior(
                    prior,
                    target_date,
                    horizon=1,
                    all_cities=all_cities,
                    city=city,
                )
            except Exception:
                logger.exception(
                    "Could not evaluate historical prediction for %s on %s",
                    city,
                    target_date.date(),
                )
                continue

            predicted = round(self._clamp_aqi(predicted), 1)

            matched_series.append({
                "date": str(target_date.date()),
                "display_label": target_date.strftime("%d %b"),
                "observed_aqi": actual,
                "predicted_aqi": predicted,
                "absolute_diff": round(abs(predicted - actual), 1),
                "prediction_source": source,
            })

        if matched_series:
            actual_values = np.asarray(
                [x["observed_aqi"] for x in matched_series], dtype=float
            )
            predicted_values = np.asarray(
                [x["predicted_aqi"] for x in matched_series], dtype=float
            )
            errors = predicted_values - actual_values

            city_mae = float(np.mean(np.abs(errors)))
            city_rmse = float(np.sqrt(np.mean(errors ** 2)))

            actual_categories = [
                get_aqi_category_info(v)["name"].lower()
                for v in actual_values
            ]
            predicted_categories = [
                get_aqi_category_info(v)["name"].lower()
                for v in predicted_values
            ]
            category_accuracy = float(
                np.mean([
                    actual == predicted
                    for actual, predicted in zip(
                        actual_categories, predicted_categories
                    )
                ]) * 100.0
            )

            evaluation_status = (
                "ML-only historical evaluation"
                if all(
                    x["prediction_source"] == "ml_model"
                    for x in matched_series
                )
                else "Baseline included; not pure ML evaluation"
            )
        else:
            city_mae = None
            city_rmse = None
            category_accuracy = None
            evaluation_status = "Insufficient historical samples"

        return {
            "city": city,
            "today_date": today_str,
            "today_formatted": today.strftime("%d %b %Y"),
            "observation_date": observation_date,
            "observation_display_date": observation_display_date,
            "observation_timestamp": observation_timestamp,
            "is_live": live_available,
            "today_live_available": live_available,
            "warning_message": warning,
            "data_source": data_source,
            "station_count": (
                live_result.get(
                    "station_count",
                    historical_record["station_count"],
                )
                if live_available
                else historical_record["station_count"]
            ),
            "freshness_status": freshness_status,
            "freshness_note": freshness_note,
            "observed": observed_payload,
            "latest_historical_observation": historical_record,
            "predicted": {
                "aqi": today_prediction_value,
                "category": today_category["name"],
                "color": today_category["color"],
                "badge": today_category["badge"],
                "model_name": "Today's AQI Prediction",
                "model_type": (
                    "Direct Multi-Horizon Regressor"
                    if prediction_source == "ml_model"
                    else "Rolling-Mean Baseline"
                    if prediction_source == "rolling_mean_baseline"
                    else "Unavailable: insufficient prior observations"
                ),
                "prediction_source": prediction_source,
                "prediction_date": today_str,
                "prediction_date_formatted": today.strftime("%d %b %Y"),
                "prediction_timestamp": (
                    f"Issued for {today.strftime('%d %b %Y')} "
                    "using prior observations"
                ),
                "confidence_interval": ci,
            },
            "comparison": {
                "comparison_available": live_available,
                "absolute_difference": absolute_difference,
                "percentage_error": percentage_error,
                "category_match": category_match,
                "rank_difference": rank_difference,
                "match_status": match_status,
                "match_tone": match_tone,
                "evaluation_text": evaluation_text,
            },
            "matched_series": matched_series,
            "model_performance_summary": {
                # These metrics are calculated from this city's retrospective
                # matched series, not copied from cached global metrics.
                "horizon_1_test_mae": city_mae,
                "horizon_1_test_rmse": city_rmse,
                "horizon_1_test_r2": h1_metrics.get("test_r2"),
                "horizon_1_baseline_mae": h1_metrics.get("baseline_mae"),
                "category_accuracy": category_accuracy,
                "evaluation_partition": "Recent matched historical observations",
                "validation_approach": (
                    "Prior-only historical predictions; target AQI excluded "
                    "from its own features"
                ),
                "evaluation_status": evaluation_status,
                "prediction_source": (
                    "ML model"
                    if self.models.get(1) is not None
                    and self.scalers.get(1) is not None
                    else "Rolling-mean baseline"
                ),
            },
            "scientific_disclosure": (
                "Retrospective predictions are generated from observations "
                "strictly before each target date. If model artifacts are "
                "unavailable, a rolling-mean baseline is used and identified "
                "explicitly. Retrospective metrics are not official holdout "
                "metrics from model training."
            ),
        }


# Backward compatibility alias used by older imports.
ModelManager = ForecastEngine
