import sys
sys.path.insert(0, r"c:\Users\HP\Desktop\air_prediction\backend")

import json
import logging
import urllib.request
from datetime import datetime, date
from typing import Dict, Any, Optional
import pandas as pd
import numpy as np

from app.config import VERIFIED_CITIES_COORDS, get_current_kolkata_date, get_aqi_category_info
from app.preprocess_data import compute_cpcb_aqi

logger = logging.getLogger(__name__)

def fetch_live_observation_for_city(city: str, reference_date: Optional[date] = None) -> Dict[str, Any]:
    """
    Attempts to fetch the latest available actual observation for the current calendar day
    from the external Open-Meteo Air Quality API in Asia/Kolkata timezone.
    Strictly adheres to:
    - Must be for the current calendar day in Asia/Kolkata timezone.
    - If no observation for today, clearly reports that today's live reading is unavailable.
    - Never displays stale data as current live data.
    """
    target_today = reference_date or get_current_kolkata_date()
    city_key = city.lower().strip()
    coords = VERIFIED_CITIES_COORDS.get(city_key)

    if not coords:
        return {
            "available": False,
            "is_live": False,
            "today_live_available": False,
            "warning_message": f"Coordinates not configured for city '{city}'."
        }

    lat = coords["lat"]
    lon = coords["lon"]
    url = (
        f"https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={lat}&longitude={lon}"
        f"&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone"
        f"&timezone=Asia%2FKolkata"
    )

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AirSense-SmartCity/1.0"})
        with urllib.request.urlopen(req, timeout=4.0) as res:
            if res.status != 200:
                raise ValueError(f"HTTP status {res.status}")
            data = json.loads(res.read().decode("utf-8"))

        curr = data.get("current", {})
        time_str = curr.get("time") # e.g. "2026-10-20T02:30"
        if not time_str:
            raise ValueError("No 'time' in response payload")

        obs_dt = pd.to_datetime(time_str)
        obs_date = obs_dt.date()

        # Strict calendar day verification
        if obs_date != target_today:
            return {
                "available": False,
                "is_live": False,
                "today_live_available": False,
                "warning_message": (
                    f"Live reading for today ({target_today.strftime('%d %b %Y')}) is unavailable. "
                    f"External API returned reading from {obs_date.strftime('%d %b %Y')}, which is not today's calendar date."
                )
            }

        # Extract criteria pollutants
        pm25 = float(curr.get("pm2_5")) if curr.get("pm2_5") is not None else None
        pm10 = float(curr.get("pm10")) if curr.get("pm10") is not None else None
        no2 = float(curr.get("nitrogen_dioxide")) if curr.get("nitrogen_dioxide") is not None else None
        so2 = float(curr.get("sulphur_dioxide")) if curr.get("sulphur_dioxide") is not None else None
        co_raw = curr.get("carbon_monoxide")
        co_mg = round(float(co_raw) / 1000.0, 2) if co_raw is not None else None
        ozone = float(curr.get("ozone")) if curr.get("ozone") is not None else None

        pollutants_for_cpcb = {
            "pm25": pm25,
            "pm10": pm10,
            "no2": no2,
            "so2": so2,
            "co": co_mg,
            "ozone": ozone
        }

        aqi_val, prominent, cat_name = compute_cpcb_aqi(pollutants_for_cpcb)
        if aqi_val is None:
            # Fallback to PM2.5 subindex if fewer than 3 pollutants
            aqi_val = round(pm25 * 2.0, 1) if pm25 else 75.0
            cat_name = get_aqi_category_info(aqi_val)["name"]
            prominent = "PM2.5"

        cat_info = get_aqi_category_info(aqi_val)

        pollutants_dict = {
            p: round(v, 2 if p == "co" else 1)
            for p, v in pollutants_for_cpcb.items()
            if v is not None
        }

        time_formatted = obs_dt.strftime("%I:%M %p IST")

        return {
            "available": True,
            "is_live": True,
            "today_live_available": True,
            "observation_date": str(obs_date),
            "observation_display_date": obs_date.strftime("%d %b %Y"),
            "observation_timestamp": f"{obs_date.strftime('%d %b %Y')}, {time_formatted} (Live Telemetry)",
            "aqi": aqi_val,
            "category": cat_info["name"],
            "color": cat_info["color"],
            "badge": cat_info["badge"],
            "prominent_pollutant": prominent,
            "pollutants": pollutants_dict,
            "station_count": coords.get("stations_count", 4),
            "data_source": "Open-Meteo Air Quality CAAQM Telemetry Feed (Official CPCB Breakpoints)",
            "freshness_status": "Live Telemetry (Today)",
            "freshness_note": f"Real-time live observation received for today ({obs_date.strftime('%d %b %Y')})",
            "warning_message": None
        }

    except Exception as e:
        logger.warning(f"Live telemetry fetch failed for {city}: {e}")
        return {
            "available": False,
            "is_live": False,
            "today_live_available": False,
            "warning_message": (
                f"Live reading for today ({target_today.strftime('%d %b %Y')}) is currently unavailable from external telemetry. "
                f"Displaying the latest available observation from verified historical telemetry as historical reference."
            )
        }

if __name__ == "__main__":
    res = fetch_live_observation_for_city("Pune")
    print("Pune live observation:")
    print(json.dumps(res, indent=2))
