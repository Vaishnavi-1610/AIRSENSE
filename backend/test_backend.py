import sys
import os
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.data_loader import DataLoader
from app.modeling import ForecastEngine
from app.clustering import PollutionClusterer
from app.hotspots import HotspotAnalyzer

print("=" * 60)
print("AirSense Smart City Environmental Backend Verification")
print("=" * 60)

print("\n1. Testing DataLoader...")
loader = DataLoader()
report = loader.get_dataset_inspection_report()
print(f"   Dataset loaded: {report['total_records']} rows, {report['unique_cities_count']} cities.")
print(f"   Available cities: {report['cities']}")
df = loader.load_active_data()

print("\n2. Testing ForecastEngine (Multi-Horizon Daily AQI Forecast)...")
forecaster = ForecastEngine(target_col="aqi")
forecast_res = forecaster.generate_daily_forecast(df, city="Pune", days=5)
print(f"   Forecast reference date: {forecast_res['forecast_reference_date']}")
print(f"   Latest observed: AQI {forecast_res['latest_observed_aqi']} ({forecast_res['latest_observed_category']})")
print(f"   Generated horizons: {len(forecast_res['forecast'])} days")
for step in forecast_res['forecast']:
    print(f"    -> {step['horizon_title']} ({step['date']}): Pred AQI={step['predicted_aqi']} [{step['confidence_interval']['lower']} - {step['confidence_interval']['upper']}] ({step['category']})")

print("\n3. Testing Live vs Prediction Comparison...")
comp_res = forecaster.generate_live_vs_prediction_comparison(df, city="Pune")
print(f"   Observed: {comp_res['observed']['aqi']} | Predicted: {comp_res['predicted']['aqi']} | Diff: {comp_res['comparison']['absolute_difference']} pts ({comp_res['comparison']['percentage_error']}%)")

print("\n4. Testing PollutionClusterer...")
clusterer = PollutionClusterer(n_clusters=3)
cl_res = clusterer.fit_and_profile(df, city="Pune")
print(f"   Clusters generated: {cl_res['n_clusters']}, Silhouette score: {cl_res.get('silhouette_score')}")
for p in cl_res['profiles']:
    print(f"    -> Cluster {p['cluster_id']}: {p['label']} ({p['percentage']}%) - Averages: {p['average_pollutants']}")

print("\n5. Testing HotspotAnalyzer...")
hotspots = HotspotAnalyzer.analyze_india_hotspots(df)
print(f"   Total cities evaluated: {hotspots['total_cities_evaluated']}")
print(f"   Top 3 Hotspots: {[h['city'] + ' (Rank #' + str(h['hotspot_rank']) + ' - Mean AQI: ' + str(h['mean_aqi']) + ')' for h in hotspots['top_hotspots']]}")

print("\n" + "=" * 60)
print("ALL BACKEND CHECKS PASSED SUCCESSFULLY!")
print("=" * 60)
