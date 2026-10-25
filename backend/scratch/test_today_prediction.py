import pandas as pd
from app.config import PROCESSED_DATASET_PATH, get_aqi_category_info, get_current_kolkata_date
from app.modeling import ForecastEngine

def test_today():
    df = pd.read_csv(PROCESSED_DATASET_PATH)
    engine = ForecastEngine()
    today_date = get_current_kolkata_date()
    print(f"Current Date: {today_date}")

    for city in ["Pune", "Delhi", "Ahmedabad", "Mumbai"]:
        feat_df, latest_record, valid_sub = engine._build_inference_features(df, city=city)
        today_feat = feat_df.copy()
        today_feat["day_of_week"] = today_date.weekday()
        today_feat["is_weekend"] = 1.0 if today_date.weekday() >= 5 else 0.0
        today_feat["month"] = float(today_date.month)
        today_feat["day_of_year"] = float(today_date.timetuple().tm_yday)
        
        model_1 = engine.models.get(1)
        scaler_1 = engine.scalers.get(1)
        pred_val = float(model_1.predict(scaler_1.transform(today_feat))[0])
        pred_val = max(15.0, min(pred_val, 495.0))
        pred_round = round(pred_val, 1)
        cat = get_aqi_category_info(pred_round)
        print(f"{city}: Today's Predicted AQI={pred_round} ({cat['name']}) on {today_date}")

if __name__ == "__main__":
    test_today()
