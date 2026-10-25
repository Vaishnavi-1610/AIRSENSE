import os
from pathlib import Path
from datetime import datetime, date
import zoneinfo

def get_current_kolkata_datetime() -> datetime:
    """
    Returns current datetime in Asia/Kolkata timezone.
    Never hardcoded; dynamically evaluated from system clock with timezone.
    """
    try:
        tz = zoneinfo.ZoneInfo("Asia/Kolkata")
        return datetime.now(tz)
    except Exception:
        from datetime import timezone, timedelta
        tz = timezone(timedelta(hours=5, minutes=30))
        return datetime.now(tz)

def get_current_kolkata_date() -> date:
    """
    Returns current date in Asia/Kolkata timezone.
    """
    return get_current_kolkata_datetime().date()

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
MODELS_CACHE_DIR = BASE_DIR / "models_cache"

# Original dataset (preserved untouched)
ORIGINAL_DATASET_PATH = DATA_DIR / "india_air_quality_telemetry.csv"

# Verified processed real CPCB dataset from xKDR API
PROCESSED_DATASET_PATH = ROOT_DIR / "data" / "processed" / "daily_city_air_quality.csv"

# Active default dataset: use verified processed dataset if available, fallback to original
DEFAULT_DATASET_PATH = PROCESSED_DATASET_PATH if PROCESSED_DATASET_PATH.exists() else ORIGINAL_DATASET_PATH
STATIONS_REGISTRY_PATH = ROOT_DIR / "data" / "raw" / "stations_metadata.json"

# Verified multi-year historical archive (2010 to 2023)
HISTORICAL_ARCHIVE_DATASET_PATH = BASE_DIR / "data" / "external_aqi_dataset" / "data" / "aqi_daily_data_top6_most_data.csv"

MODELS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Standard CPCB NAQI Categories and Color Palette
AQICategories = AQI_CATEGORIES = [
    {"name": "Good", "min": 0, "max": 50, "color": "#10b981", "badge": "bg-emerald-100 text-emerald-800 border-emerald-300", "description": "Minimal impact on health."},
    {"name": "Satisfactory", "min": 51, "max": 100, "color": "#84cc16", "badge": "bg-lime-100 text-lime-800 border-lime-300", "description": "Minor breathing discomfort to sensitive people."},
    {"name": "Moderate", "min": 101, "max": 200, "color": "#eab308", "badge": "bg-amber-100 text-amber-800 border-amber-300", "description": "Breathing discomfort to people with lung, asthma and heart diseases."},
    {"name": "Poor", "min": 201, "max": 300, "color": "#f97316", "badge": "bg-orange-100 text-orange-800 border-orange-300", "description": "Breathing discomfort to most people on prolonged exposure."},
    {"name": "Very Poor", "min": 301, "max": 400, "color": "#ef4444", "badge": "bg-red-100 text-red-800 border-red-300", "description": "Respiratory illness on prolonged exposure."},
    {"name": "Severe", "min": 401, "max": 500, "color": "#7f1d1d", "badge": "bg-rose-900 text-white border-rose-950", "description": "Affects healthy people and seriously impacts those with existing diseases."}
]

def get_aqi_category_info(aqi_val: float) -> dict:
    if aqi_val is None or (isinstance(aqi_val, float) and (aqi_val < 0 or str(aqi_val) == 'nan')):
        return {"name": "Data Pending", "color": "#64748b", "badge": "bg-slate-100 text-slate-800 border-slate-300", "description": "Observations pending CPCB NAQI sufficiency."}
    for cat in AQI_CATEGORIES:
        if cat["min"] <= aqi_val <= cat["max"]:
            return cat
    return AQI_CATEGORIES[-1]

POLLUTANT_METRICS = {
    "pm25": {"name": "PM2.5", "unit": "µg/m³", "label": "Particulate Matter 2.5", "threshold_safe": 30},
    "pm10": {"name": "PM10", "unit": "µg/m³", "label": "Particulate Matter 10", "threshold_safe": 60},
    "no2": {"name": "NO₂", "unit": "µg/m³", "label": "Nitrogen Dioxide", "threshold_safe": 40},
    "so2": {"name": "SO₂", "unit": "µg/m³", "label": "Sulphur Dioxide", "threshold_safe": 40},
    "co": {"name": "CO", "unit": "mg/m³", "label": "Carbon Monoxide", "threshold_safe": 2.0},
    "ozone": {"name": "Ozone (O₃)", "unit": "µg/m³", "label": "Ground-Level Ozone", "threshold_safe": 100},
    "aqi": {"name": "AQI", "unit": "Index", "label": "Air Quality Index (CPCB NAQI)", "threshold_safe": 100}
}

# Verified Geographic Coordinates from CPCB CAAQM Station Centroids
VERIFIED_CITIES_COORDS = {
    "pune": {"lat": 18.6401, "lon": 73.8490, "state": "Maharashtra", "region": "Western Maharashtra", "stations_count": 9},
    "mumbai": {"lat": 19.0535, "lon": 72.8464, "state": "Maharashtra", "region": "Konkan Coast", "stations_count": 31},
    "nagpur": {"lat": 21.1218, "lon": 79.0495, "state": "Maharashtra", "region": "Vidarbha", "stations_count": 4},
    "delhi": {"lat": 28.8153, "lon": 77.1530, "state": "Delhi", "region": "Northern India", "stations_count": 39},
    "bengaluru": {"lat": 12.9135, "lon": 77.5951, "state": "Karnataka", "region": "Southern India", "stations_count": 14},
    "hyderabad": {"lat": 17.5409, "lon": 78.3585, "state": "Telangana", "region": "Southern India", "stations_count": 15},
    "chennai": {"lat": 13.0664, "lon": 80.2112, "state": "Tamil Nadu", "region": "Southern India", "stations_count": 8},
    "kolkata": {"lat": 22.5368, "lon": 88.3638, "state": "West Bengal", "region": "Eastern India", "stations_count": 8},
    "ahmedabad": {"lat": 23.1080, "lon": 72.5746, "state": "Gujarat", "region": "Western India", "stations_count": 8},
    "nashik": {"lat": 20.0073, "lon": 73.7762, "state": "Maharashtra", "region": "Northern Maharashtra", "stations_count": 4},
    "lucknow": {"lat": 26.8467, "lon": 80.9462, "state": "Uttar Pradesh", "region": "Northern India", "stations_count": 6},
}
