#!/usr/bin/env python3
"""
Reproducible Preprocessing Pipeline for xKDR India Air Quality Dataset
======================================================================
This script:
1. Loads raw station metadata from data/raw/stations_metadata.csv
2. Ingests all raw station measurement CSVs from data/raw/
3. Applies data validity checks (minimum 16 hours/day for representative daily mean, physical range checks)
4. Aggregates station-level observations into daily city-level records
5. Computes official CPCB National Air Quality Index (NAQI) sub-indices and overall AQI
   strictly enforcing the CPCB rule: at least 3 pollutants monitored, with at least one particulate matter (PM2.5 or PM10).
6. Preserves missing values appropriately without arbitrary median imputation
7. Saves processed results separately to data/processed/
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# CPCB Sub-Index Linear Breakpoints (CPCB NAQI Standard)
# Breakpoints: (B_low, B_high, I_low, I_high)
CPCB_BREAKPOINTS = {
    "pm25": [
        (0.0, 30.0, 0, 50),
        (30.0001, 60.0, 51, 100),
        (60.0001, 90.0, 101, 200),
        (90.0001, 120.0, 201, 300),
        (120.0001, 250.0, 301, 400),
        (250.0001, 500.0, 401, 500),
    ],
    "pm10": [
        (0.0, 50.0, 0, 50),
        (50.0001, 100.0, 51, 100),
        (100.0001, 250.0, 101, 200),
        (250.0001, 350.0, 201, 300),
        (350.0001, 430.0, 301, 400),
        (430.0001, 500.0, 401, 500),
    ],
    "no2": [
        (0.0, 40.0, 0, 50),
        (40.0001, 80.0, 51, 100),
        (80.0001, 180.0, 101, 200),
        (180.0001, 280.0, 201, 300),
        (280.0001, 400.0, 301, 400),
        (400.0001, 1000.0, 401, 500),
    ],
    "so2": [
        (0.0, 40.0, 0, 50),
        (40.0001, 80.0, 51, 100),
        (80.0001, 380.0, 101, 200),
        (380.0001, 800.0, 201, 300),
        (800.0001, 1600.0, 301, 400),
        (1600.0001, 2000.0, 401, 500),
    ],
    "co": [
        (0.0, 1.0, 0, 50),
        (1.0001, 2.0, 51, 100),
        (2.0001, 10.0, 101, 200),
        (10.0001, 17.0, 201, 300),
        (17.0001, 34.0, 301, 400),
        (34.0001, 50.0, 401, 500),
    ],
    "ozone": [
        (0.0, 50.0, 0, 50),
        (50.0001, 100.0, 51, 100),
        (100.0001, 168.0, 101, 200),
        (168.0001, 208.0, 201, 300),
        (208.0001, 748.0, 301, 400),
        (748.0001, 1000.0, 401, 500),
    ],
}

def calculate_sub_index(pollutant: str, conc: float) -> Optional[float]:
    """Calculates CPCB linear sub-index for a single pollutant concentration."""
    if conc is None or np.isnan(conc) or conc < 0:
        return None
    
    pollutant = pollutant.lower()
    breakpoints = CPCB_BREAKPOINTS.get(pollutant)
    if not breakpoints:
        return None

    # Cap extreme values at max breakpoint
    max_b_high = breakpoints[-1][1]
    if conc > max_b_high:
        return 500.0

    for b_low, b_high, i_low, i_high in breakpoints:
        if b_low <= conc <= b_high:
            sub = i_low + ((i_high - i_low) / (b_high - b_low)) * (conc - b_low)
            return round(sub, 1)

    return None

def compute_cpcb_aqi(pollutants: Dict[str, float]) -> Tuple[Optional[int], Optional[str], Optional[str]]:
    """
    Computes CPCB overall AQI strictly following Central Pollution Control Board guidelines:
    - Minimum 3 pollutants with valid sub-indices required
    - At least one particulate matter (PM2.5 or PM10) required
    Returns (aqi, prominent_pollutant, aqi_category)
    """
    sub_indices = {}
    for p, val in pollutants.items():
        if val is not None and not np.isnan(val):
            sub = calculate_sub_index(p, val)
            if sub is not None:
                sub_indices[p] = sub

    # CPCB Rule Check:
    # 1. Total valid pollutants >= 3
    # 2. At least one of PM2.5 or PM10 present
    has_pm = ("pm25" in sub_indices) or ("pm10" in sub_indices)
    if len(sub_indices) < 3 or not has_pm:
        return None, None, None

    max_p = max(sub_indices, key=sub_indices.get)
    overall_aqi = int(round(sub_indices[max_p]))

    # Category name
    if overall_aqi <= 50:
        cat = "Good"
    elif overall_aqi <= 100:
        cat = "Satisfactory"
    elif overall_aqi <= 200:
        cat = "Moderate"
    elif overall_aqi <= 300:
        cat = "Poor"
    elif overall_aqi <= 400:
        cat = "Very Poor"
    else:
        cat = "Severe"

    prominent_names = {
        "pm25": "PM2.5",
        "pm10": "PM10",
        "no2": "NO₂",
        "so2": "SO₂",
        "co": "CO",
        "ozone": "Ozone",
    }
    return overall_aqi, prominent_names.get(max_p, max_p.upper()), cat

def main():
    root_dir = Path(__file__).resolve().parent.parent if "__file__" in locals() else Path(r"c:\Users\HP\Desktop\air_prediction")
    raw_dir = root_dir / "data" / "raw"
    processed_dir = root_dir / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Root dir: {root_dir}")
    logger.info(f"Raw data dir: {raw_dir}")
    logger.info(f"Processed data dir: {processed_dir}")

    # 1. Load station metadata
    stations_csv = raw_dir / "stations_metadata.csv"
    if not stations_csv.exists():
        raise FileNotFoundError(f"Stations metadata not found at {stations_csv}")

    stations_df = pd.read_csv(stations_csv)
    logger.info(f"Loaded {len(stations_df)} stations from metadata.")

    # Build station lookup map
    station_lookup = {}
    for _, row in stations_df.iterrows():
        sid = str(row["station_id"]).strip()
        station_lookup[sid] = {
            "station_name": row.get("station_name"),
            "city_name": str(row.get("city_name")).strip(),
            "state_name": str(row.get("state_name")).strip(),
            "latitude": float(row["latitude"]) if pd.notnull(row.get("latitude")) else None,
            "longitude": float(row["longitude"]) if pd.notnull(row.get("longitude")) else None,
        }

    # Verified city coordinates calculated as mean of stations in each city
    city_coords = {}
    for city, grp in stations_df.groupby("city_name"):
        valid_lats = grp["latitude"].dropna()
        valid_lons = grp["longitude"].dropna()
        state = grp["state_name"].iloc[0] if len(grp["state_name"].dropna()) > 0 else "India"
        if len(valid_lats) > 0 and len(valid_lons) > 0:
            city_coords[str(city).strip().lower()] = {
                "city": str(city).strip(),
                "latitude": round(float(valid_lats.mean()), 4),
                "longitude": round(float(valid_lons.mean()), 4),
                "state": state
            }

    # 2. Ingest all raw measurement files
    raw_files = list(raw_dir.glob("raw_*_*.csv"))
    logger.info(f"Found {len(raw_files)} raw measurement files in {raw_dir}")
    if not raw_files:
        raise FileNotFoundError("No raw measurement CSV files found in data/raw/")

    chunk_dfs = []
    total_raw_rows = 0
    for f in raw_files:
        try:
            df_c = pd.read_csv(f)
            total_raw_rows += len(df_c)
            # Infer city from filename: raw_{city}_{start}_{end}.csv
            parts = f.stem.split("_")
            inferred_city = parts[1].capitalize() if len(parts) >= 2 else "Unknown"
            df_c["city"] = inferred_city
            chunk_dfs.append(df_c)
        except Exception as e:
            logger.warning(f"Failed to read {f.name}: {e}")

    raw_combined = pd.concat(chunk_dfs, ignore_index=True)
    logger.info(f"Combined {len(raw_combined)} raw measurement records (expected: {total_raw_rows}).")

    # Standardize columns
    raw_combined.columns = [c.strip().lower() for c in raw_combined.columns]

    # Map parameter names
    param_map = {
        "pm2.5": "pm25",
        "pm25": "pm25",
        "pm10": "pm10",
        "no2": "no2",
        "so2": "so2",
        "co": "co",
        "ozone": "ozone",
        "o3": "ozone"
    }
    raw_combined["parameter_clean"] = raw_combined["parameter_name"].str.strip().str.lower().map(param_map)
    raw_combined = raw_combined[raw_combined["parameter_clean"].notnull()]

    # Parse date (period_start is YYYY-MM-DD HH:MM:SS)
    raw_combined["date"] = pd.to_datetime(raw_combined["period_start"]).dt.strftime("%Y-%m-%d")

    # Quality filter: CPCB data sufficiency requires n >= 16 hours/day for representative 24h mean
    # However, if n is not provided, we keep valid values.
    valid_mask = raw_combined["mean"].notnull() & (raw_combined["mean"] >= 0)
    if "n" in raw_combined.columns:
        valid_mask = valid_mask & (raw_combined["n"] >= 16)

    filtered = raw_combined[valid_mask].copy()
    logger.info(f"Retained {len(filtered)} valid station-day observations after quality & sufficiency filtering.")

    # 3. Station-to-City Daily Aggregation
    # Group by city, date, parameter_clean
    city_daily_param = filtered.groupby(["city", "date", "parameter_clean"]).agg(
        conc_mean=("mean", "mean"),
        station_count=("station_id", "nunique"),
        readings_n=("n", "sum")
    ).reset_index()

    # Pivot so each pollutant is its own column
    pivoted = city_daily_param.pivot(
        index=["city", "date"],
        columns="parameter_clean",
        values="conc_mean"
    ).reset_index()

    station_counts = city_daily_param.groupby(["city", "date"])["station_count"].max().reset_index()
    pivoted = pivoted.merge(station_counts, on=["city", "date"], how="left")

    # Ensure all target pollutant columns exist
    for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"]:
        if p not in pivoted.columns:
            pivoted[p] = np.nan
        else:
            pivoted[p] = pivoted[p].round(2)

    # 4. Attach verified Coordinates & State
    pivoted["latitude"] = np.nan
    pivoted["longitude"] = np.nan
    pivoted["state"] = "India"

    for idx, row in pivoted.iterrows():
        c_key = str(row["city"]).strip().lower()
        if c_key in city_coords:
            pivoted.at[idx, "latitude"] = city_coords[c_key]["latitude"]
            pivoted.at[idx, "longitude"] = city_coords[c_key]["longitude"]
            pivoted.at[idx, "state"] = city_coords[c_key]["state"]

    # 5. Compute CPCB AQI strictly following official NAQI logic
    aqi_values = []
    prominent_list = []
    category_list = []

    for _, row in pivoted.iterrows():
        pollutants = {
            "pm25": row["pm25"],
            "pm10": row["pm10"],
            "no2": row["no2"],
            "so2": row["so2"],
            "co": row["co"],
            "ozone": row["ozone"],
        }
        aqi_val, prom, cat = compute_cpcb_aqi(pollutants)
        aqi_values.append(aqi_val)
        prominent_list.append(prom)
        category_list.append(cat)

    pivoted["aqi"] = aqi_values
    pivoted["prominent_pollutant"] = prominent_list
    pivoted["aqi_category"] = category_list

    # Sort chronologically by date and city
    pivoted = pivoted.sort_values(by=["city", "date"]).reset_index(drop=True)

    # Reorder columns
    col_order = [
        "date", "city", "state", "latitude", "longitude",
        "pm25", "pm10", "no2", "so2", "co", "ozone",
        "aqi", "aqi_category", "prominent_pollutant", "station_count"
    ]
    pivoted = pivoted[[c for c in col_order if c in pivoted.columns]]

    # 6. Save Processed Dataset
    processed_csv = processed_dir / "daily_city_air_quality.csv"
    pivoted.to_csv(processed_csv, index=False)
    logger.info(f"Saved processed dataset to {processed_csv} ({len(pivoted)} city-day records).")

    # 7. Generate Dataset Summary Report
    summary = {
        "dataset_name": "xKDR CPCB CAAQM India Air Quality Dataset",
        "provenance": "Continuous Ambient Air Quality Monitoring Stations (CAAQMS) network published by xKDR / CPCB",
        "total_raw_rows_downloaded": int(total_raw_rows),
        "total_station_day_observations_processed": int(len(filtered)),
        "total_city_day_aggregated_records": int(len(pivoted)),
        "unique_cities_count": int(pivoted["city"].nunique()),
        "available_cities": sorted(pivoted["city"].unique().tolist()),
        "earliest_date": str(pivoted["date"].min()),
        "latest_date": str(pivoted["date"].max()),
        "cpcb_aqi_records_count": int(pivoted["aqi"].notnull().sum()),
        "cpcb_aqi_coverage_pct": round(float(pivoted["aqi"].notnull().sum() / len(pivoted) * 100), 1),
        "per_city_summary": {},
        "pollutant_coverage": {}
    }

    for p in ["pm25", "pm10", "no2", "so2", "co", "ozone", "aqi"]:
        notnull_cnt = int(pivoted[p].notnull().sum())
        summary["pollutant_coverage"][p] = {
            "valid_records": notnull_cnt,
            "coverage_pct": round(notnull_cnt / len(pivoted) * 100, 1),
            "mean": round(float(pivoted[p].dropna().mean()), 2) if notnull_cnt > 0 else None,
            "min": round(float(pivoted[p].dropna().min()), 2) if notnull_cnt > 0 else None,
            "max": round(float(pivoted[p].dropna().max()), 2) if notnull_cnt > 0 else None,
        }

    for city, grp in pivoted.groupby("city"):
        aqi_valid = int(grp["aqi"].notnull().sum())
        summary["per_city_summary"][city] = {
            "total_days": len(grp),
            "date_range": f"{grp['date'].min()} to {grp['date'].max()}",
            "cpcb_aqi_days": aqi_valid,
            "cpcb_aqi_pct": round(aqi_valid / len(grp) * 100, 1),
            "mean_aqi": round(float(grp["aqi"].dropna().mean()), 1) if aqi_valid > 0 else None,
            "max_aqi": round(float(grp["aqi"].dropna().max()), 1) if aqi_valid > 0 else None,
            "min_aqi": round(float(grp["aqi"].dropna().min()), 1) if aqi_valid > 0 else None,
            "stations_reporting_avg": round(float(grp["station_count"].mean()), 1),
            "missing_aqi_note": "In 2025, gases (NO2, SO2, CO, Ozone) are pending publication in xKDR; CPCB NAQI requires >=3 pollutants including PM to calculate genuine AQI." if aqi_valid < len(grp) else "Full coverage"
        }

    summary_json_path = processed_dir / "dataset_summary.json"
    with open(summary_json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    logger.info(f"Saved dataset summary JSON to {summary_json_path}")

    # Generate Markdown Summary
    md_content = f"""# xKDR India Air Quality Dataset Summary

**Generated:** {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}  
**Source:** CPCB CAAQM Network via xKDR India Air Quality Database (`https://airquality.xkdr.org`)  

## Overview
- **Total Raw Observation Rows Downloaded:** {summary['total_raw_rows_downloaded']:,}
- **Quality-Filtered Station Observations:** {summary['total_station_day_observations_processed']:,}
- **City-Level Daily Aggregated Records:** {summary['total_city_day_aggregated_records']:,}
- **Cities Evaluated:** {summary['unique_cities_count']} ({', '.join(summary['available_cities'])})
- **Chronological Window:** {summary['earliest_date']} to {summary['latest_date']}
- **Valid CPCB AQI Observations:** {summary['cpcb_aqi_records_count']:,} ({summary['cpcb_aqi_coverage_pct']}%)

## CPCB NAQI Calculation & Aggregation Methodology
1. **Station Data Completeness Filter:** Only station days with at least 16 monitoring hours (`n >= 16`) are considered valid for daily mean calculations, conforming to standard CPCB temporal completeness criteria.
2. **Station-to-City Daily Aggregation:** Valid daily station concentrations are averaged across all reporting stations in each city for each target pollutant.
3. **CPCB Multi-Pollutant AQI Rule:** According to Central Pollution Control Board guidelines:
   - An overall AQI is calculated **only when at least 3 pollutants** have valid measurements, and at least one is **PM2.5 or PM10**.
   - Sub-indices are calculated using official linear interpolation across the standard 6 CPCB NAQI breakpoint categories.
   - Overall AQI is the maximum of the sub-indices: `AQI = max(sub_indices)`.
   - When fewer than 3 pollutants are present (such as in 2025 where gases are pending publication in xKDR), AQI is set to `NaN` to avoid falsely treating an individual pollutant concentration as an AQI.

## Per-City Statistics
| City | State | Total Records | Date Range | CPCB AQI Days | Mean AQI | Peak AQI | Avg Stations |
|---|---|---|---|---|---|---|---|
"""
    for city, s in summary["per_city_summary"].items():
        state = city_coords.get(city.lower(), {}).get("state", "India")
        md_content += f"| {city} | {state} | {s['total_days']} | {s['date_range']} | {s['cpcb_aqi_days']} ({s['cpcb_aqi_pct']}%) | {s['mean_aqi'] or 'N/A'} | {s['max_aqi'] or 'N/A'} | {s['stations_reporting_avg']} |\n"

    md_content += """
## Pollutant Coverage
| Pollutant | Valid Days | Coverage | Mean | Min | Max | Unit |
|---|---|---|---|---|---|---|
"""
    units = {"pm25": "µg/m³", "pm10": "µg/m³", "no2": "µg/m³", "so2": "µg/m³", "co": "mg/m³", "ozone": "µg/m³", "aqi": "Index"}
    for p, stats in summary["pollutant_coverage"].items():
        md_content += f"| {p.upper()} | {stats['valid_records']} | {stats['coverage_pct']}% | {stats['mean'] or 'N/A'} | {stats['min'] or 'N/A'} | {stats['max'] or 'N/A'} | {units.get(p, '')} |\n"

    md_path = processed_dir / "DATASET_SUMMARY.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    logger.info(f"Saved dataset summary Markdown to {md_path}")

    print("\n" + md_content)

if __name__ == "__main__":
    main()
