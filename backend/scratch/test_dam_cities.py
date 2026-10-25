from fastapi.testclient import TestClient
from app.main import app

def test_cities():
    client = TestClient(app)

    for city in ["Delhi", "Ahmedabad", "Mumbai"]:
        print(f"=== Testing {city} ===")
        r1 = client.get(f"/api/dashboard/city-data?city={city}")
        assert r1.status_code == 200, f"city-data failed for {city}: {r1.status_code}"
        d1 = r1.json()
        print(f"  Dashboard status: 200, Predicted AQI: {d1.get('predicted_aqi')}, Category: {d1.get('predicted_category')}")

        r2 = client.get(f"/api/predict/daily?city={city}&days=5")
        assert r2.status_code == 200, f"predict failed for {city}: {r2.status_code}"
        d2 = r2.json()
        print(f"  Predict status: 200, Forecast count: {len(d2.get('forecast', []))}")
        for f in d2.get("forecast", []):
            print(f"    {f.get('horizon_title', f.get('horizon_label'))} ({f.get('date')}): AQI={f.get('predicted_aqi')}, Cat={f.get('category')}")

    print("\n>>> ALL 3 CITIES PASSED WITH 200 OK! <<<")

if __name__ == "__main__":
    test_cities()
