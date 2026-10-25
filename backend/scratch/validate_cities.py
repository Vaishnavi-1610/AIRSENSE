import json
import pandas as pd
import numpy as np
from app.config import PROCESSED_DATASET_PATH, MODELS_CACHE_DIR, DEFAULT_DATASET_PATH
from app.modeling import ForecastEngine

def run_validation():
    print("=== LOADING DATASET & MODEL METRICS ===")
    df = pd.read_csv(PROCESSED_DATASET_PATH)
    metrics_path = MODELS_CACHE_DIR / "model_evaluation_metrics.json"
    with open(metrics_path, "r") as f:
        metrics = json.load(f)

    print("\n--- Model Metrics Stored from Holdout Evaluation ---")
    cities_to_check = ["Delhi", "Ahmedabad", "Mumbai", "Pune"]
    for city in cities_to_check:
        c_metrics = metrics.get("per_city_h1", {}).get(city, {})
        print(f"City: {city}")
        print(f"  Test Samples: {c_metrics.get('test_samples')}")
        print(f"  MAE: {c_metrics.get('mae')} CPCB AQI points")
        print(f"  RMSE: {c_metrics.get('rmse')} CPCB AQI points")
        print(f"  R2: {c_metrics.get('r2')}")

    print("\n--- Inspecting Data Characteristics for Delhi, Ahmedabad, Mumbai ---")
    for city in cities_to_check:
        sub = df[df["city"].str.lower() == city.lower()].sort_values("date")
        valid_aqi = sub[sub["aqi"].notnull()]
        print(f"\nCity: {city}")
        print(f"  Total records: {len(sub)}")
        print(f"  Valid AQI records: {len(valid_aqi)}")
        print(f"  Date range: {sub['date'].min()} to {sub['date'].max()}")
        print(f"  AQI stats: min={valid_aqi['aqi'].min():.1f}, mean={valid_aqi['aqi'].mean():.1f}, max={valid_aqi['aqi'].max():.1f}")
        for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"]:
            if p in sub:
                val = sub[p].dropna()
                print(f"    {p}: mean={val.mean():.2f}, min={val.min():.2f}, max={val.max():.2f}")

    print("\n--- Generating Forecast for Delhi, Ahmedabad, Mumbai, Pune ---")
    engine = ForecastEngine()
    for city in cities_to_check:
        res = engine.generate_daily_forecast(df, city, days=5)
        print(f"\nCity: {city}")
        print(f"  Latest observed date: {res.get('latest_observed_date')}, AQI: {res.get('latest_observed_aqi')}")
        for step in res["forecast"]:
            print(f"    Step {step['step']} ({step['date']}): Pred={step['predicted_aqi']}, Cat={step['category']}, Range=[{step['confidence_interval']['lower']} - {step['confidence_interval']['upper']}]")

if __name__ == "__main__":
    run_validation()
