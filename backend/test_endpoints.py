import urllib.request
import urllib.error
import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

endpoints = [
    ('dataset/info', 'Dataset Governance & Kaggle Source Info'),
    ('cities', 'Available Cities List (Actual Usable Data)'),
    ('dashboard/city-data?city=Pune', 'Dashboard Data for Selected City (Pune)'),
    ('dashboard/city-data?city=Pune&target_date=2025-05-15', 'Dashboard Out-of-Range Date Test (May 2025)'),
    ('predict/daily?city=Pune&days=5', 'Future AQI Prediction (5 Days with Confidence Intervals)'),
    ('historical/analyze?city=Pune', 'Historical Analysis (Available Range)'),
    ('historical/analyze?city=Pune&start_date=2025-05-01&end_date=2025-05-10', 'Historical Analysis (Out-of-Range Validation)'),
    ('clustering/analysis?city=Pune', 'Pollution Clustering & Profiles'),
    ('hotspots/india', 'Hotspots on India Map (Top 2-3 Highlighted)')
]

print("=" * 70)
print("Testing AirSense Smart City Environmental Analytics Engine Endpoints")
print("=" * 70)

all_passed = True
for ep, desc in endpoints:
    url = f'http://127.0.0.1:8000/api/{ep}'
    print(f"\n-> [{desc}]")
    print(f"   Request: {url}")
    try:
        req = urllib.request.urlopen(url, timeout=20)
        data = json.loads(req.read().decode('utf-8'))
        if isinstance(data, dict):
            keys_preview = list(data.keys())[:6]
            print(f"   Status: [200 OK] | Keys: {keys_preview}")
            if "out_of_range_message" in data and data["out_of_range_message"]:
                print(f"   [Validation Passed] Message: {data['out_of_range_message']}")
            elif "message" in data and not data.get("available", True):
                print(f"   [Validation Passed] Out-of-range Message: {data['message']}")
            elif "top_hotspots" in data:
                print(f"   [Hotspots Validated] Top {len(data['top_hotspots'])}: {[h['city'] for h in data['top_hotspots']]}")
            elif "forecast" in data:
                print(f"   [Forecast Validated] Steps: {len(data['forecast'])}, Trend: {data.get('trend_direction')}")
        else:
            print(f"   Status: [200 OK] | Items: {len(data)}")
    except urllib.error.URLError as e:
        print(f"   Status: [FAILED] -> {e.reason}")
        all_passed = False
        break
    except Exception as e:
        print(f"   Status: [FAILED] -> {e}")
        all_passed = False
        break

print("\n" + "=" * 70)
if all_passed:
    print("ALL API ENDPOINTS VALIDATED SUCCESSFULLY!")
else:
    print("SOME ENDPOINTS FAILED - PLEASE CHECK SERVER LOGS.")
print("=" * 70)
