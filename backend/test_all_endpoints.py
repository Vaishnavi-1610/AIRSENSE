import sys
from pathlib import Path
backend_dir = Path(r"c:\Users\HP\Desktop\air_prediction\backend")
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_endpoints():
    print("Testing /api/health...")
    r = client.get("/api/health")
    print(f"Health: {r.status_code}, data={r.json()}")
    assert r.status_code == 200

    print("\nTesting /api/cities...")
    r = client.get("/api/cities")
    cities = r.json()
    print(f"Cities ({len(cities)}): {cities}")
    assert len(cities) >= 10

    print("\nTesting /api/dashboard/city-data for Pune...")
    r = client.get("/api/dashboard/city-data?city=Pune")
    print(f"Dashboard: {r.status_code}")
    d = r.json()
    print(f"Today Date: {d.get('today_date')} ({d.get('today_formatted')})")
    print(f"Latest record: {d.get('latest_record')}")
    print(f"Freshness note: {d.get('data_freshness_note')}")
    assert r.status_code == 200
    assert d.get("today_date") is not None
    assert d.get("out_of_range_message") is None

    print("\nTesting /api/predict/daily for Pune (5 days)...")
    r = client.get("/api/predict/daily?city=Pune&days=5")
    print(f"Prediction: {r.status_code}")
    p = r.json()
    print(f"Forecast reference date: {p.get('forecast_reference_date')}")
    print(f"Latest observed: {p.get('latest_observed_aqi')} on {p.get('latest_observed_date')}")
    print(f"Steps: {len(p.get('forecast', []))}")
    for step in p.get("forecast", []):
        print(f"  {step.get('horizon_title')} ({step['date']}): Predicted AQI={step['predicted_aqi']} [{step['confidence_interval']['lower']} - {step['confidence_interval']['upper']}] ({step['category']}) | Comp: {step.get('comparison_label')}")
        assert step.get("comparison_to_actual") in ["increase", "decrease", "stable"]
        assert step.get("is_prediction") is True
    assert r.status_code == 200
    assert len(p.get("forecast", [])) == 5
    assert p.get("forecast_reference_date") is not None

    print("\nTesting /api/historical/analyze for Pune (May 2024 - Valid)...")
    r = client.get("/api/historical/analyze?city=Pune&year=2024&month=5")
    print(f"Historical (May 2024): {r.status_code}")
    h = r.json()
    print(f"Available: {h.get('available')}, Stats: {h.get('stats')}")
    assert r.status_code == 200
    assert h.get("available") is True

    print("\nTesting /api/historical/analyze for Pune (May 2026 - Out-of-range period notice)...")
    r = client.get("/api/historical/analyze?city=Pune&year=2026&month=5")
    print(f"Historical (May 2026): {r.status_code}")
    h2 = r.json()
    print(f"Available: {h2.get('available')}, Message: {h2.get('message')}")
    assert r.status_code == 200
    assert h2.get("available") is False

    print("\nTesting /api/clustering/analysis...")
    r = client.get("/api/clustering/analysis?city=Pune")
    print(f"Clustering: {r.status_code}")
    c = r.json()
    print(f"Profiles: {len(c.get('profiles', []))}, Silhouette: {c.get('silhouette_score')}")
    assert r.status_code == 200

    print("\nTesting /api/hotspots/india...")
    r = client.get("/api/hotspots/india")
    print(f"Hotspots: {r.status_code}")
    hot = r.json()
    print(f"Top hotspots: {[h['city'] + ' (#' + str(h['hotspot_rank']) + ' - ' + str(h['mean_aqi']) + ')' for h in hot.get('top_hotspots', [])]}")
    assert r.status_code == 200

    print("\nTesting /api/model/metrics...")
    r = client.get("/api/model/metrics")
    print(f"Metrics: {r.status_code}")
    m = r.json()
    print(f"Horizon 1 Test MAE: {m.get('horizons', {}).get('day_1', {}).get('test_mae')}")
    assert r.status_code == 200

    print("\nTesting /api/dataset/external-audit...")
    r = client.get("/api/dataset/external-audit")
    print(f"External Audit: {r.status_code}")
    ea = r.json()
    print(f"Repo: {ea.get('repository')}, Status: {ea.get('status')}")
    print(f"Historical telemetry rows: {ea.get('historical_telemetry', {}).get('rows')}")
    print(f"Forecast telemetry is ground truth: {ea.get('forecast_telemetry', {}).get('is_ground_truth')}")
    assert r.status_code == 200
    assert ea.get("status") == "integrated_and_audited"

    print("\n>>> ALL BACKEND API TESTS COMPLETED AND VERIFIED! <<<")

if __name__ == "__main__":
    test_endpoints()
