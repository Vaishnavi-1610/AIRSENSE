import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.data_loader import DataLoader
from app.modeling import ForecastEngine
from app.api.router import get_dashboard_city_data, get_high_pollution_alerts, get_live_vs_prediction

def test_endpoints():
    loader = DataLoader()
    cities = loader.get_available_cities()
    print(f"Available cities: {cities}")

    for city in ["Pune", "Delhi", "Ahmedabad", "Mumbai"]:
        print(f"\n================ Testing {city} ================")
        
        # 1. Dashboard city data
        d = get_dashboard_city_data(city=city)
        today_pred = d.get("today_prediction", {})
        print(f"Dashboard Today's Predicted AQI: {d.get('today_predicted_aqi')} ({d.get('today_predicted_category')}) on {d.get('today_predicted_date_formatted')}")
        assert d.get("today_predicted_aqi") is not None, "today_predicted_aqi missing!"
        
        # 5-day forecast
        fc = d.get("forecast", [])
        print(f"Forecast steps count: {len(fc)}")
        assert len(fc) == 5, f"Expected 5 forecast steps, got {len(fc)}"
        for step in fc:
            print(f"  Step {step['step']}: {step['horizon_title']} ({step['date']}) -> Predicted AQI: {step['predicted_aqi']} ({step['category']})")

        # Alerts in dashboard
        alerts = d.get("alerts", {})
        print(f"Alerts in dashboard: count={alerts.get('count')}, has_alerts={alerts.get('has_alerts')}")
        for a in alerts.get("alerts", []):
            print(f"  Alert [{a['alert_type']}]: {a['headline']} (AQI: {a['aqi_value']}, Status: {a['status']}, Impact: {a['expected_impact']})")

        # 2. Alerts endpoint test
        res_alerts = get_high_pollution_alerts(city=city, threshold=200.0)
        print(f"/alerts/high-pollution (threshold=200): count={res_alerts.get('count')}")
        
        # 3. Live vs Prediction comparison
        comp = get_live_vs_prediction(city=city)
        print(f"Live vs Prediction: is_live={comp.get('is_live')}, today_live_available={comp.get('today_live_available')}")
        print(f"  Observed: aqi={comp['observed']['aqi']}, is_available={comp['observed'].get('is_available')}")
        print(f"  Predicted: aqi={comp['predicted']['aqi']}, date={comp['predicted'].get('prediction_date')}")
        print(f"  Comparison: available={comp['comparison'].get('comparison_available')}, abs_diff={comp['comparison'].get('absolute_difference')}")
        if comp.get('latest_historical_observation'):
            hist = comp['latest_historical_observation']
            print(f"  Historical Baseline: {hist['date']} -> AQI {hist['aqi']} ({hist['category']})")

    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    test_endpoints()
