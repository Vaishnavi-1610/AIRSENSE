import pandas as pd
from app.config import PROCESSED_DATASET_PATH, get_aqi_category_info, get_current_kolkata_date
from app.modeling import ForecastEngine

def test():
    df = pd.read_csv(PROCESSED_DATASET_PATH)
    engine = ForecastEngine()
    today_date = get_current_kolkata_date()
    print(f"Current Date: {today_date}")

    for city in ["Pune", "Delhi", "Ahmedabad", "Mumbai"]:
        sub = df[df["city"].str.lower() == city.lower()].sort_values("date")
        valid = sub[sub["aqi"].notnull()]
        latest = valid.iloc[-1]
        print(f"\n=== {city} ===")
        print(f"  Latest Recorded: AQI={latest['aqi']} on {latest['date']}")
        
        # Test 5-day forecast
        fc = engine.generate_daily_forecast(df, city=city, days=5)
        print(f"  Latest observed AQI: {fc['latest_observed_aqi']}")
        for s in fc["forecast"]:
            print(f"    Horizon {s['step']} ({s['date']}): Pred={s['predicted_aqi']} ({s['category']})")

if __name__ == "__main__":
    test()
