import logging
from typing import Dict, Any, List, Optional
import pandas as pd
from app.config import get_aqi_category_info, VERIFIED_CITIES_COORDS

logger = logging.getLogger(__name__)

class HotspotAnalyzer:
    """
    Evaluates city-wide air quality metrics across India and identifies strictly the top 2-3 national hotspots
    based on standardized, comparable period-average AQI and particulate persistence.
    """

    @staticmethod
    def analyze_india_hotspots(df: pd.DataFrame, target_date: Optional[str] = None) -> Dict[str, Any]:
        data = df.copy()

        # Date column normalization
        date_col = "date" if "date" in data.columns else "timestamp"

        is_date_filtered = False
        date_label = "Overall Multi-Year Analysis Window (2023–2024)"

        if target_date:
            target_str = str(target_date).strip()
            date_matches = data[data[date_col].astype(str).str.startswith(target_str)]
            if len(date_matches) > 0:
                data = date_matches
                is_date_filtered = True
                date_label = f"Observation Period: {target_str}"

        cities = data["city"].dropna().unique().tolist()
        city_metrics = []

        for city in cities:
            c_sub = data[data["city"].str.lower() == city.lower()]
            if len(c_sub) == 0:
                continue

            city_key = str(city).lower().strip()
            coords = VERIFIED_CITIES_COORDS.get(city_key)
            if not coords:
                coords = {"lat": 20.0, "lon": 77.0, "state": "India", "region": "India", "stations_count": 1}

            # Valid AQI series
            aqi_series = c_sub["aqi"].dropna()
            if len(aqi_series) == 0:
                continue

            mean_aqi = round(float(aqi_series.mean()), 1)
            max_aqi = round(float(aqi_series.max()), 1)
            min_aqi = round(float(aqi_series.min()), 1)

            pm25_mean = round(float(c_sub["pm25"].mean()), 1) if "pm25" in c_sub and c_sub["pm25"].notnull().any() else 0.0
            pm10_mean = round(float(c_sub["pm10"].mean()), 1) if "pm10" in c_sub and c_sub["pm10"].notnull().any() else 0.0
            no2_mean = round(float(c_sub["no2"].mean()), 1) if "no2" in c_sub and c_sub["no2"].notnull().any() else 0.0

            # Persistence of elevated pollution (>= 101 Moderate, >= 201 Poor)
            poor_days = int((aqi_series >= 201).sum())
            elevated_pct = round((int((aqi_series >= 101).sum()) / len(aqi_series)) * 100.0, 1)

            cat_info = get_aqi_category_info(mean_aqi)

            latest_row = c_sub.sort_values(by=date_col).iloc[-1]
            latest_val = round(float(latest_row["aqi"]), 1) if pd.notnull(latest_row["aqi"]) else mean_aqi

            city_metrics.append({
                "city": city,
                "state": coords.get("state", "India"),
                "region": coords.get("region", "India"),
                "latitude": coords["lat"],
                "longitude": coords["lon"],
                "stations_count": coords.get("stations_count", 1),
                "mean_aqi": mean_aqi,
                "latest_aqi": latest_val,
                "max_aqi": max_aqi,
                "min_aqi": min_aqi,
                "mean_pm25": pm25_mean,
                "mean_pm10": pm10_mean,
                "mean_no2": no2_mean,
                "poor_hours_count": poor_days,
                "elevated_percentage": elevated_pct,
                "observations_count": len(aqi_series),
                "category": cat_info["name"],
                "color": cat_info["color"],
                "badge": cat_info["badge"],
                "analysis_period": date_label,
                "latest_date": str(latest_row[date_col])
            })

        # Sort strictly descending by Mean AQI
        city_metrics.sort(key=lambda x: x["mean_aqi"], reverse=True)

        # Highlight strictly the top 2-3 cities as national hotspots
        top_k = min(3, len(city_metrics))
        top_hotspots = []

        for idx, item in enumerate(city_metrics):
            if idx < top_k:
                item["is_top_hotspot"] = True
                item["hotspot_rank"] = idx + 1
                item["hotspot_explanation"] = (
                    f"Designated as National Hotspot #{idx + 1} due to the highest period-average AQI of {item['mean_aqi']} "
                    f"({item['category']}) with elevated respirable PM2.5 concentrations ({item['mean_pm25']} µg/m³) "
                    f"and {item['elevated_percentage']}% of monitoring days in elevated pollution bands."
                )
                top_hotspots.append(item)
            else:
                item["is_top_hotspot"] = False
                item["hotspot_rank"] = None
                item["hotspot_explanation"] = (
                    f"Standard ambient air quality observation node with a period-mean AQI of {item['mean_aqi']}. "
                    f"Pollution levels fall below national hotspot ranking thresholds."
                )

        return {
            "analysis_period": date_label,
            "is_date_filtered": is_date_filtered,
            "total_cities_evaluated": len(city_metrics),
            "top_hotspots_count": len(top_hotspots),
            "top_hotspots": top_hotspots,
            "all_city_rankings": city_metrics,
            "national_center": {"lat": 22.0, "lon": 78.5, "zoom": 5},
            "selection_criteria": (
                "Hotspots are identified strictly by ranking comparable time-weighted Mean AQI "
                "across monitoring stations for the evaluated period. Only the top 2-3 cities with the highest "
                "pollution severity are highlighted."
            )
        }
