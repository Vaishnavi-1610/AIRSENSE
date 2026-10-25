import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np

from app.config import (
    DEFAULT_DATASET_PATH,
    PROCESSED_DATASET_PATH,
    ORIGINAL_DATASET_PATH,
    HISTORICAL_ARCHIVE_DATASET_PATH,
    VERIFIED_CITIES_COORDS,
    get_aqi_category_info,
    POLLUTANT_METRICS,
    get_current_kolkata_date
)

logger = logging.getLogger(__name__)

INDIAN_CITIES_COORDS = VERIFIED_CITIES_COORDS

class DataLoader:
    _instance = None
    _active_file: Path = DEFAULT_DATASET_PATH
    _df: Optional[pd.DataFrame] = None
    _historical_combined_df: Optional[pd.DataFrame] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DataLoader, cls).__new__(cls)
            cls._instance.load_active_data()
        return cls._instance

    def get_active_file(self) -> Path:
        return self._active_file

    def set_active_file(self, file_path: Path):
        self._active_file = file_path
        self._df = None
        self._historical_combined_df = None
        self.load_active_data()

    def load_active_data(self) -> pd.DataFrame:
        if self._df is not None:
            return self._df

        if not self._active_file.exists():
            # If processed file does not exist, fallback to original
            if ORIGINAL_DATASET_PATH.exists():
                self._active_file = ORIGINAL_DATASET_PATH
            else:
                raise FileNotFoundError(f"Dataset file not found at: {self._active_file}")

        try:
            df = pd.read_csv(self._active_file)
        except Exception:
            df = pd.read_csv(self._active_file, sep=";", decimal=",")

        cleaned_df = self.detect_and_standardize_schema(df)
        self._df = cleaned_df
        return self._df

    def detect_and_standardize_schema(self, raw_df: pd.DataFrame) -> pd.DataFrame:
        df = raw_df.copy()
        df.columns = [str(c).strip().lower().replace(" ", "_").replace(".", "_").replace("-", "_") for c in df.columns]

        col_map = {}
        for c in df.columns:
            if c in ["date", "timestamp", "datetime", "date_time", "last_update", "period_start"]:
                col_map[c] = "date"
                break

        for c in df.columns:
            if c in ["city", "city_name", "location", "district"]:
                col_map[c] = "city"
                break

        candidates = {
            "pm25": ["pm25", "pm2_5", "pm_25"],
            "pm10": ["pm10", "pm_10"],
            "no2": ["no2", "nitrogen_dioxide"],
            "so2": ["so2", "sulphur_dioxide"],
            "co": ["co", "carbon_monoxide"],
            "ozone": ["ozone", "o3", "ground_ozone"],
            "aqi": ["aqi", "air_quality_index"]
        }

        for target_col, synonyms in candidates.items():
            for c in df.columns:
                if c in synonyms and c not in col_map:
                    col_map[c] = target_col
                    break

        df = df.rename(columns=col_map)

        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d")
        else:
            df["date"] = pd.date_range(end=pd.Timestamp.now().date(), periods=len(df), freq="D").strftime("%Y-%m-%d")

        if "city" not in df.columns:
            df["city"] = "Pune"
        else:
            df["city"] = df["city"].astype(str).str.strip()

        # Clean numerical pollutants
        for col in ["pm25", "pm10", "no2", "so2", "co", "ozone", "aqi"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")
                df.loc[df[col] < 0, col] = np.nan

        # Attach verified coordinates & state
        if "latitude" not in df.columns or "longitude" not in df.columns or df["latitude"].isnull().any():
            for idx, row in df.iterrows():
                city_key = str(row["city"]).lower().strip()
                if city_key in VERIFIED_CITIES_COORDS:
                    df.at[idx, "latitude"] = VERIFIED_CITIES_COORDS[city_key]["lat"]
                    df.at[idx, "longitude"] = VERIFIED_CITIES_COORDS[city_key]["lon"]
                    df.at[idx, "state"] = VERIFIED_CITIES_COORDS[city_key]["state"]

        if "state" not in df.columns:
            df["state"] = "India"

        # Deduplicate and sort chronologically
        df = df.drop_duplicates(subset=["city", "date"]).reset_index(drop=True)
        df = df.sort_values(by=["date", "city"]).reset_index(drop=True)
        return df

    def load_combined_historical_data(self) -> pd.DataFrame:
        """
        Loads and seamlessly combines verified modern CPCB telemetry (2023-2025)
        with the multi-year historical archive (2010-2022).
        For overlapping windows (e.g. Q1 2023), active verified telemetry takes strict precedence.
        """
        if self._historical_combined_df is not None:
            return self._historical_combined_df

        df_active = self.load_active_data().copy()
        df_active["city"] = df_active["city"].astype(str).str.strip().str.title()
        df_active["date"] = df_active["date"].astype(str).str.strip()

        if HISTORICAL_ARCHIVE_DATASET_PATH.exists():
            try:
                df_archive = pd.read_csv(HISTORICAL_ARCHIVE_DATASET_PATH)
                col_rename = {
                    "ds": "date",
                    "PM2_5": "pm25",
                    "PM10": "pm10",
                    "NO2": "no2",
                    "SO2": "so2",
                    "CO": "co",
                    "AQI": "aqi",
                    "Dominant_Pollutant": "prominent_pollutant"
                }
                df_archive = df_archive.rename(columns=col_rename)
                df_archive["city"] = df_archive["city"].astype(str).str.strip().str.title()
                df_archive["date"] = pd.to_datetime(df_archive["date"], errors="coerce").dt.strftime("%Y-%m-%d")
                df_archive = df_archive.dropna(subset=["date", "city"])

                # Standardize numeric pollutants
                for col in ["pm25", "pm10", "no2", "so2", "co", "aqi"]:
                    if col in df_archive.columns:
                        df_archive[col] = pd.to_numeric(df_archive[col], errors="coerce")
                        df_archive.loc[df_archive[col] < 0, col] = np.nan

                if "ozone" not in df_archive.columns:
                    df_archive["ozone"] = np.nan

                # Keep archive records prior to active start per city to prioritize active verified telemetry
                active_mins = df_active.groupby("city")["date"].min().to_dict()
                archive_keep = []
                for city, grp in df_archive.groupby("city"):
                    if city in active_mins:
                        archive_keep.append(grp[grp["date"] < active_mins[city]])
                    else:
                        archive_keep.append(grp)

                if archive_keep:
                    df_archive_filt = pd.concat(archive_keep, ignore_index=True)
                else:
                    df_archive_filt = pd.DataFrame()

                # Align coordinates, state, and station count for archive records
                if not df_archive_filt.empty:
                    for idx, row in df_archive_filt.iterrows():
                        c_key = str(row["city"]).lower().strip()
                        if c_key in VERIFIED_CITIES_COORDS:
                            meta = VERIFIED_CITIES_COORDS[c_key]
                            df_archive_filt.at[idx, "latitude"] = meta["lat"]
                            df_archive_filt.at[idx, "longitude"] = meta["lon"]
                            df_archive_filt.at[idx, "state"] = meta["state"]
                    df_archive_filt["station_count"] = 1

                standard_cols = [
                    "date", "city", "state", "latitude", "longitude",
                    "pm25", "pm10", "no2", "so2", "co", "ozone",
                    "aqi", "prominent_pollutant", "station_count"
                ]
                for c in standard_cols:
                    if c not in df_archive_filt.columns:
                        df_archive_filt[c] = np.nan
                    if c not in df_active.columns:
                        df_active[c] = np.nan

                combined = pd.concat([df_archive_filt[standard_cols], df_active[standard_cols]], ignore_index=True)
            except Exception as e:
                logger.error(f"Error merging historical archive: {e}")
                combined = df_active
        else:
            combined = df_active

        # Deduplicate on city + date, keeping active dataset in case of overlap
        combined = combined.drop_duplicates(subset=["city", "date"], keep="last").sort_values(by=["date", "city"]).reset_index(drop=True)
        self._historical_combined_df = combined
        return self._historical_combined_df

    def get_available_cities(self) -> List[str]:
        df = self.load_active_data()
        cities = df["city"].dropna().unique().tolist()
        return sorted([str(c) for c in cities if len(str(c).strip()) > 0])

    def get_dataset_inspection_report(self) -> Dict[str, Any]:
        df = self.load_active_data()
        min_date = str(df["date"].min())
        max_date = str(df["date"].max())
        total_records = len(df)
        unique_cities = self.get_available_cities()

        pollutants_present = [p for p in ["pm25", "pm10", "no2", "co", "so2", "ozone"] if p in df.columns and int(df[p].notnull().sum()) > 0]

        missing_counts = {}
        for col in ["date", "city", "aqi"] + pollutants_present:
            missing_counts[col] = int(df[col].isnull().sum())

        valid_aqi_df = df[df["aqi"].notnull()]
        cat_counts = valid_aqi_df["aqi_category"].value_counts().to_dict() if "aqi_category" in valid_aqi_df else {}
        cat_dist = {str(k): int(v) for k, v in cat_counts.items()}

        stats = {}
        for p in ["aqi"] + pollutants_present:
            valid_p = df[p].dropna()
            stats[p] = {
                "mean": round(float(valid_p.mean()), 1) if len(valid_p) > 0 else 0,
                "min": round(float(valid_p.min()), 1) if len(valid_p) > 0 else 0,
                "max": round(float(valid_p.max()), 1) if len(valid_p) > 0 else 0,
                "valid_records": int(len(valid_p)),
                "coverage_pct": round(len(valid_p) / total_records * 100, 1) if total_records > 0 else 0,
                "unit": POLLUTANT_METRICS.get(p, {}).get("unit", "Index")
            }

        return {
            "source_file": self._active_file.name,
            "min_date": min_date,
            "max_date": max_date,
            "total_records": int(total_records),
            "unique_cities_count": int(len(unique_cities)),
            "cities": unique_cities,
            "pollutants_present": [str(p) for p in pollutants_present],
            "has_aqi": int(df["aqi"].notnull().sum()) > 0,
            "valid_aqi_records": int(df["aqi"].notnull().sum()),
            "missing_counts": missing_counts,
            "duplicate_records": 0,
            "stats": stats,
            "aqi_category_distribution": cat_dist,
            "provenance": "CPCB CAAQM Network via xKDR India Air Quality Database",
            "setup_instructions": (
                "Verified multi-city daily observations covering 2023 through 2025. "
                "Official CPCB NAQI is calculated strictly when >=3 criteria pollutants (with at least PM2.5 or PM10) are present."
            )
        }

    def get_city_dashboard_data(
        self,
        city: str,
        target_date: Optional[str] = None,
        reference_date: Optional[str] = None
    ) -> Dict[str, Any]:
        df = self.load_active_data()
        city_sub = df[df["city"].str.lower() == city.lower()].copy()

        if len(city_sub) == 0:
            return {
                "city": city,
                "available": False,
                "message": f"No records found for city '{city}' in the active dataset."
            }

        city_sub["date"] = city_sub["date"].astype(str)
        city_sub = city_sub.sort_values(by="date").reset_index(drop=True)
        min_date = str(city_sub["date"].min())
        max_date = str(city_sub["date"].max())

        # 1. Today's reference date dynamically determined in Asia/Kolkata timezone
        if reference_date:
            today_date = pd.to_datetime(reference_date).date()
        else:
            today_date = get_current_kolkata_date()
        today_str = str(today_date)

        # 2. Find latest record with valid AQI for genuine forecasting and display
        valid_aqi_sub = city_sub[city_sub["aqi"].notnull()]
        if len(valid_aqi_sub) > 0:
            latest_row = valid_aqi_sub.iloc[-1]
            latest_aqi = round(float(latest_row["aqi"]), 1)
            latest_cat = get_aqi_category_info(latest_aqi)
            latest_date = str(latest_row["date"])
        else:
            latest_row = city_sub.iloc[-1]
            latest_aqi = None
            latest_cat = get_aqi_category_info(None)
            latest_date = str(latest_row["date"])

        is_live = (latest_date == today_str)
        freshness_label = f"Latest verified CPCB physical monitoring observation: {latest_date}"

        selected_record = None
        date_is_available = False
        out_of_range_message = None

        if target_date:
            target_str = str(target_date).strip()
            matches = city_sub[city_sub["date"].str.startswith(target_str)]
            if len(matches) > 0:
                date_is_available = True
                match_row = matches.iloc[-1]
                m_aqi = round(float(match_row["aqi"]), 1) if pd.notnull(match_row["aqi"]) else None
                m_cat = get_aqi_category_info(m_aqi)
                selected_record = {
                    "date": match_row["date"],
                    "aqi": m_aqi,
                    "category": m_cat["name"],
                    "color": m_cat["color"],
                    "badge": m_cat["badge"],
                    "pollutants": {
                        p: round(float(match_row[p]), 1) if pd.notnull(match_row.get(p)) else None
                        for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"] if p in match_row
                    }
                }
            else:
                out_of_range_message = (
                    f"No recorded observation exists for {city} on {target_date}. "
                    f"The verified dataset spans from {min_date} to {max_date}."
                )

        eval_row = latest_row
        eval_aqi = latest_aqi if latest_aqi is not None else 100.0
        eval_cat = latest_cat

        # Pollutant breakdown for latest observation
        pollutant_concentrations = []
        for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"]:
            val = None
            if p in eval_row and pd.notnull(eval_row[p]):
                val = round(float(eval_row[p]), 2 if p == "co" else 1)

            if val is not None:
                meta = POLLUTANT_METRICS.get(p, {})
                thresh = meta.get("threshold_safe", 100)
                is_elevated = val > thresh
                pollutant_concentrations.append({
                    "pollutant": p,
                    "name": meta.get("name", p.upper()),
                    "label": meta.get("label", p.upper()),
                    "value": val,
                    "unit": meta.get("unit", "µg/m³"),
                    "threshold_safe": thresh,
                    "is_elevated": is_elevated,
                    "ratio_to_safe": round(val / thresh, 2) if thresh > 0 else 1.0
                })

        # Recent 30-day trend of valid observations
        trend_sub = valid_aqi_sub.tail(30) if len(valid_aqi_sub) >= 30 else valid_aqi_sub
        trend = []
        for _, r in trend_sub.iterrows():
            trend.append({
                "date": str(r["date"]),
                "display_label": str(r["date"])[5:],
                "aqi": round(float(r["aqi"]), 1),
                "pm25": round(float(r["pm25"]), 1) if pd.notnull(r.get("pm25")) else None,
                "pm10": round(float(r["pm10"]), 1) if pd.notnull(r.get("pm10")) else None,
                "no2": round(float(r["no2"]), 1) if pd.notnull(r.get("no2")) else None,
                "ozone": round(float(r["ozone"]), 1) if pd.notnull(r.get("ozone")) else None,
            })

        # Objective factors based on actual observed concentrations
        dominant_list = []
        for pc in pollutant_concentrations:
            if pc["is_elevated"]:
                dominant_list.append(f"{pc['name']} ({pc['value']} {pc['unit']}, {int(pc['ratio_to_safe'] * 100)}% of safe benchmark)")

        if not dominant_list:
            dominant_list = ["All monitored pollutant concentrations are within national permissible limits."]

        reasons = []
        if eval_aqi > 200:
            reasons.append("Elevated respirable particulate matter concentrations (PM2.5 and PM10) observed across monitoring nodes.")
            reasons.append("Atmospheric dispersion conditions (e.g. low boundary layer height or reduced wind dispersion) limiting particulate ventilation.")
            reasons.append("Cumulative urban combustion and vehicular emission accumulation during peak commuting intervals.")
        elif eval_aqi > 100:
            reasons.append("Moderate ambient particulate levels exceeding optimal health thresholds.")
            reasons.append("Photochemical solar insolation contributing to localized ozone formation.")
            reasons.append("Dry atmospheric suspension of coarse surface dust (PM10).")
        else:
            reasons.append("Favorable atmospheric ventilation and wind dispersion keeping air quality in satisfactory bands.")
            reasons.append("Criteria pollutants remain comfortably below statutory National Ambient Air Quality Standards (NAAQS).")

        recommendations = []
        if eval_aqi > 200:
            recommendations.append("Sensitive groups (asthma, COPD, cardiovascular conditions) should limit prolonged outdoor exertion.")
            recommendations.append("General public should consider wearing protective filtration masks (N95) near high-density traffic arteries.")
            recommendations.append("Avoid open burning of leaves or waste, and ensure home ventilation filters are operational.")
        elif eval_aqi > 100:
            recommendations.append("Sensitive individuals should take regular breaks during heavy outdoor exertion.")
            recommendations.append("General public can engage in regular outdoor activities while monitoring daily AQI trend.")
        else:
            recommendations.append("Air quality is healthy and meets Indian ambient air quality standards.")
            recommendations.append("Optimal conditions for outdoor sports, recreation, and fresh room ventilation.")

        summary_text = (
            f"Today ({today_date.strftime('%d %b %Y')}), {city} air quality is reported as '{eval_cat['name']}' with an active CPCB NAQI of {eval_aqi}. "
            f"{eval_cat['description']} "
            f"Prominent criteria pollutant: {eval_row.get('prominent_pollutant', 'PM2.5')}."
        )

        return {
            "city": city,
            "available": True,
            "today_date": today_str,
            "today_formatted": today_date.strftime("%d %b %Y"),
            "is_live": False,
            "freshness_label": freshness_label,
            "min_date": min_date,
            "max_date": max_date,
            "total_city_records": len(city_sub),
            "latest_record": {
                "date": latest_date,
                "display_date": pd.to_datetime(latest_date).strftime("%d %b %Y") if latest_date else "Unknown",
                "aqi": latest_aqi,
                "category": eval_cat["name"],
                "color": eval_cat["color"],
                "badge": eval_cat["badge"],
                "station_count": int(eval_row.get("station_count", 1)) if pd.notnull(eval_row.get("station_count")) else 1,
                "is_today": (latest_date == today_str)
            },
            "selected_date_record": selected_record,
            "target_date_requested": target_date,
            "date_is_available": date_is_available,
            "out_of_range_message": out_of_range_message,
            "pollutants": pollutant_concentrations,
            "trend": trend,
            "summary": summary_text,
            "dominant_pollutants": dominant_list,
            "possible_factors": reasons,
            "recommendations": recommendations,
            "data_freshness_note": freshness_label
        }

    def get_historical_analysis(
        self,
        city: str,
        year: Optional[int] = None,
        month: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        allow_fallback: bool = False
    ) -> Dict[str, Any]:
        """
        Historical analysis supporting explicit Year + Month selection (e.g. Pune, May 2024 or May 2025)
        or custom start/end date ranges.
        """
        df = self.load_combined_historical_data()
        city_sub = df[df["city"].str.lower() == city.lower()].copy()

        if len(city_sub) == 0:
            return {
                "city": city,
                "available": False,
                "message": f"City '{city}' not found in active records."
            }

        city_sub["date"] = city_sub["date"].astype(str)
        min_avail_date = str(city_sub["date"].min())
        max_avail_date = str(city_sub["date"].max())

        # Resolve date boundaries
        if year is not None and month is not None:
            s_date = f"{year:04d}-{month:02d}-01"
            import calendar
            last_day = calendar.monthrange(year, month)[1]
            e_date = f"{year:04d}-{month:02d}-{last_day:02d}"
            period_label = f"{calendar.month_name[month]} {year}"
        elif start_date:
            s_date = start_date
            e_date = end_date if end_date else start_date
            period_label = f"{s_date} to {e_date}"
        else:
            # Default to the most recent complete month with valid AQI (e.g. December 2024)
            valid_aqi_sub = city_sub[city_sub["aqi"].notnull()]
            if len(valid_aqi_sub) > 0:
                last_dt = pd.to_datetime(valid_aqi_sub["date"].max())
                year = last_dt.year
                month = last_dt.month
                import calendar
                s_date = f"{year:04d}-{month:02d}-01"
                e_date = f"{year:04d}-{month:02d}-{calendar.monthrange(year, month)[1]:02d}"
                period_label = f"{calendar.month_name[month]} {year}"
            else:
                s_date = min_avail_date
                e_date = max_avail_date
                period_label = f"{s_date} to {e_date}"

        is_fallback = False
        fallback_note = None
        requested_period_label = period_label

        mask = (city_sub["date"] >= s_date) & (city_sub["date"] <= e_date)
        filtered = city_sub[mask].sort_values(by="date")

        # Fallback handling: If requested period has zero records, use suitable historical records if allow_fallback=True
        if len(filtered) == 0:
            if allow_fallback:
                valid_sub = city_sub[city_sub["aqi"].notnull()]
                if len(valid_sub) > 0:
                    last_dt = pd.to_datetime(valid_sub["date"].max())
                    fb_y = last_dt.year
                    fb_m = last_dt.month
                    import calendar
                    fb_last = calendar.monthrange(fb_y, fb_m)[1]
                    s_date = f"{fb_y:04d}-{fb_m:02d}-01"
                    e_date = f"{fb_y:04d}-{fb_m:02d}-{fb_last:02d}"
                    period_label = f"{calendar.month_name[fb_m]} {fb_y}"
                    mask = (city_sub["date"] >= s_date) & (city_sub["date"] <= e_date)
                    filtered = city_sub[mask].sort_values(by="date")
                    is_fallback = True
                    fallback_note = (
                        f"Requested period ({requested_period_label}) has no recorded observations for {city}. "
                        f"Displaying latest verified historical baseline ({period_label}) for continuous comparative analysis."
                    )
                else:
                    return {
                        "city": city,
                        "period_label": period_label,
                        "available": False,
                        "is_fallback": False,
                        "start_date": s_date,
                        "end_date": e_date,
                        "min_available_date": min_avail_date,
                        "max_available_date": max_avail_date,
                        "message": (
                            f"Requested period ({period_label}) contains zero recorded observations for {city}. "
                            f"The verified dataset strictly spans {min_avail_date} to {max_avail_date}. "
                            f"Please select an available period from the filters."
                        )
                    }
            else:
                return {
                    "city": city,
                    "period_label": period_label,
                    "available": False,
                    "is_fallback": False,
                    "start_date": s_date,
                    "end_date": e_date,
                    "min_available_date": min_avail_date,
                    "max_available_date": max_avail_date,
                    "message": (
                        f"Requested period ({period_label}) contains zero recorded observations for {city}. "
                        f"The verified dataset strictly spans {min_avail_date} to {max_avail_date}. "
                        f"Please select a period within this verified historical window."
                    )
                }

        # Check if period has records but official AQI is not computable (e.g. May 2025 lacking gaseous pollutants)
        aqi_series = filtered["aqi"].dropna()
        has_partial_data = (len(aqi_series) == 0 and len(filtered) > 0)

        # Build day-by-day timeseries for charts (always include all available measurements)
        timeseries = []
        for _, r in filtered.iterrows():
            aqi_val = round(float(r["aqi"]), 1) if pd.notnull(r["aqi"]) else None
            cat = get_aqi_category_info(aqi_val) if aqi_val is not None else {"name": "Data Pending", "color": "#64748b"}
            timeseries.append({
                "date": str(r["date"]),
                "display_label": str(r["date"])[5:],
                "aqi": aqi_val,
                "pm25": round(float(r["pm25"]), 1) if pd.notnull(r.get("pm25")) else None,
                "pm10": round(float(r["pm10"]), 1) if pd.notnull(r.get("pm10")) else None,
                "no2": round(float(r["no2"]), 1) if pd.notnull(r.get("no2")) else None,
                "so2": round(float(r["so2"]), 1) if pd.notnull(r.get("so2")) else None,
                "co": round(float(r["co"]), 2) if pd.notnull(r.get("co")) else None,
                "ozone": round(float(r["ozone"]), 1) if pd.notnull(r.get("ozone")) else None,
                "category": cat["name"],
                "color": cat["color"],
                "prominent_pollutant": str(r["prominent_pollutant"]) if pd.notnull(r.get("prominent_pollutant")) else "PM2.5"
            })

        # Calculate pollutant averages
        pollutant_avgs = {}
        for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"]:
            if p in filtered and filtered[p].notnull().any():
                pollutant_avgs[p] = round(float(filtered[p].dropna().mean()), 2 if p == "co" else 1)

        city_overall_mean = city_sub["aqi"].dropna().mean() if city_sub["aqi"].notnull().any() else 100.0

        if has_partial_data:
            pm25_mean = pollutant_avgs.get("pm25")
            pm10_mean = pollutant_avgs.get("pm10")
            pm25_max = round(float(filtered["pm25"].max()), 1) if "pm25" in filtered and filtered["pm25"].notnull().any() else None
            pm10_max = round(float(filtered["pm10"].max()), 1) if "pm10" in filtered and filtered["pm10"].notnull().any() else None

            summary_text = (
                f"For {city} during {period_label}, physical particulate monitoring captured {len(filtered)} recorded observation days. "
                f"PM2.5 concentrations averaged {pm25_mean} µg/m³ (Peak: {pm25_max} µg/m³ vs. statutory benchmark of 30 µg/m³) "
                f"and PM10 averaged {pm10_mean} µg/m³ (Peak: {pm10_max} µg/m³ vs. benchmark of 60 µg/m³). "
                f"Official CPCB NAQI values are currently marked as 'Data Pending' because gaseous criteria pollutants (NO₂, SO₂, CO, Ozone) "
                f"have not yet been published by CPCB/xKDR for this recent observation window. Under Central Pollution Control Board guidelines, "
                f"an official air quality index requires at least 3 criteria pollutants (with at least one particulate parameter). "
                f"Per academic integrity standards, missing gaseous readings are not fabricated or replaced with zero."
            )

            return {
                "city": city,
                "period_label": period_label,
                "requested_period_label": requested_period_label,
                "is_fallback": is_fallback,
                "fallback_note": fallback_note,
                "available": True,
                "has_partial_data": True,
                "start_date": s_date,
                "end_date": e_date,
                "min_available_date": min_avail_date,
                "max_available_date": max_avail_date,
                "stats": {
                    "mean_aqi": None,
                    "max_aqi": None,
                    "min_aqi": None,
                    "std_aqi": None,
                    "observations_count": len(filtered),
                    "valid_aqi_days": 0,
                    "data_completeness_pct": 0.0
                },
                "pollutant_averages": pollutant_avgs,
                "category_distribution": {},
                "baseline_city_aqi": round(float(city_overall_mean), 1),
                "variance_pct": None,
                "timeseries": timeseries,
                "summary": summary_text,
                "recommendations": [
                    "Particulate levels (PM2.5 and PM10) are directly monitored and plotted above.",
                    "Official multi-pollutant NAQI requires 3 criteria parameters and remains pending CPCB publication."
                ]
            }

        # Full valid analysis with official AQI
        mean_aqi = round(float(aqi_series.mean()), 1)
        max_aqi = round(float(aqi_series.max()), 1)
        min_aqi = round(float(aqi_series.min()), 1)
        std_aqi = round(float(aqi_series.std()), 1) if len(aqi_series) > 1 else 0.0

        # Category distribution
        cat_counts = {}
        for item in timeseries:
            if item["aqi"] is not None:
                c_name = item["category"]
                cat_counts[c_name] = cat_counts.get(c_name, 0) + 1

        variance_pct = round(((mean_aqi - city_overall_mean) / city_overall_mean) * 100.0, 1)

        # Dynamic Trend Behavior Analysis (increasing, decreasing, or fluctuating)
        half_n = len(aqi_series) // 2
        first_half_mean = float(aqi_series.iloc[:half_n].mean()) if half_n > 0 else mean_aqi
        second_half_mean = float(aqi_series.iloc[half_n:].mean()) if half_n > 0 else mean_aqi
        diff_half = second_half_mean - first_half_mean

        if abs(diff_half) <= 8 and std_aqi > 15:
            trend_desc = (
                f"AQI exhibited notable day-to-day fluctuation without a persistent directional trajectory, "
                f"oscillating between a monthly low of {min_aqi} and a peak of {max_aqi} (standard deviation: ±{std_aqi} pts)."
            )
        elif diff_half > 8:
            trend_desc = (
                f"AQI demonstrated a discernible deteriorating/increasing trend as the month progressed, "
                f"rising from an average of {round(first_half_mean, 1)} in the first half to {round(second_half_mean, 1)} during the second half."
            )
        elif diff_half < -8:
            trend_desc = (
                f"AQI demonstrated a sustained improving/decreasing trend across the month, "
                f"dropping from an average of {round(first_half_mean, 1)} in the early portion to {round(second_half_mean, 1)} towards month-end."
            )
        else:
            trend_desc = (
                f"Air quality remained relatively steady throughout the month with moderate daily variations around the monthly mean of {mean_aqi}."
            )

        # Identify peak and cleanest dates
        peak_records = filtered[filtered["aqi"] == max_aqi]
        peak_date = str(peak_records.iloc[0]["date"]) if len(peak_records) > 0 else "N/A"
        peak_cat = get_aqi_category_info(max_aqi)["name"]

        min_records = filtered[filtered["aqi"] == min_aqi]
        min_date = str(min_records.iloc[0]["date"]) if len(min_records) > 0 else "N/A"
        min_cat = get_aqi_category_info(min_aqi)["name"]

        # Particulate dynamics
        pm25_avg = pollutant_avgs.get("pm25")
        pm10_avg = pollutant_avgs.get("pm10")
        if pm25_avg is not None and pm10_avg is not None and pm10_avg > 0:
            pm_ratio = round((pm25_avg / pm10_avg) * 100, 1)
            source_insight = (
                f"Fine particulate matter (PM2.5: {pm25_avg} µg/m³) accounted for {pm_ratio}% of coarse particulate loading (PM10: {pm10_avg} µg/m³), "
                f"indicating a dominant contribution from combustion processes (vehicular traffic and biomass combustion) relative to mechanical soil dust."
                if pm_ratio >= 50 else
                f"Coarse dust fractions predominated, with PM2.5 (avg {pm25_avg} µg/m³) representing {pm_ratio}% of PM10 (avg {pm10_avg} µg/m³), "
                f"pointing towards mechanical resuspension, road dust, and dry atmospheric conditions."
            )
        else:
            source_insight = ""

        # Gaseous pollutants notes
        gas_elements = []
        if "no2" in pollutant_avgs:
            no2_val = pollutant_avgs["no2"]
            gas_elements.append(f"NO₂ averaged {no2_val} µg/m³ ({'exceeding' if no2_val > 40 else 'within'} the 40 µg/m³ NAAQS benchmark)")
        if "so2" in pollutant_avgs:
            gas_elements.append(f"SO₂ averaged {pollutant_avgs['so2']} µg/m³ (benchmark: 40 µg/m³)")
        if "ozone" in pollutant_avgs:
            gas_elements.append(f"Ground-level Ozone averaged {pollutant_avgs['ozone']} µg/m³ (benchmark: 100 µg/m³)")
        if "co" in pollutant_avgs:
            gas_elements.append(f"Carbon Monoxide (CO) averaged {pollutant_avgs['co']} mg/m³ (benchmark: 2.0 mg/m³)")

        gas_text = f"Monitored gaseous criteria pollutants: {'; '.join(gas_elements)}." if gas_elements else ""

        overall_cat = get_aqi_category_info(mean_aqi)["name"]
        summary_text = (
            f"During {period_label}, {city} recorded a monthly average CPCB NAQI of {mean_aqi} ({overall_cat}) "
            f"derived from {len(aqi_series)} valid daily observation days ({round(len(aqi_series)/len(filtered)*100, 1)}% data completeness). "
            f"{trend_desc} The single highest pollution episode occurred on {peak_date} reaching a peak AQI of {max_aqi} ({peak_cat}), "
            f"whereas the cleanest air quality was observed on {min_date} at an AQI of {min_aqi} ({min_cat}). "
            f"{source_insight} {gas_text} "
            f"Compared against the multi-year city baseline ({round(city_overall_mean, 1)}), this month recorded a "
            f"{'+' if variance_pct >= 0 else ''}{variance_pct}% deviation."
        )

        recommendations = []
        if mean_aqi > 200:
            recommendations.append("Historical patterns for this month indicate severe particulate loading. Municipal authorities should consider seasonal dust suppression protocols.")
            recommendations.append("Schools and sports complexes should schedule high-intensity outdoor athletics outside morning and evening rush hours.")
        elif mean_aqi > 100:
            recommendations.append("Moderate ambient exposure observed. Focus on vehicular emission compliance (PUC checks) and arterial corridor green buffer maintenance.")
        else:
            recommendations.append("Period shows favorable atmospheric ventilation and compliant air quality meeting NAAQS standards.")

        return {
            "city": city,
            "period_label": period_label,
            "requested_period_label": requested_period_label,
            "is_fallback": is_fallback,
            "fallback_note": fallback_note,
            "available": True,
            "has_partial_data": False,
            "start_date": s_date,
            "end_date": e_date,
            "min_available_date": min_avail_date,
            "max_available_date": max_avail_date,
            "stats": {
                "mean_aqi": mean_aqi,
                "max_aqi": max_aqi,
                "min_aqi": min_aqi,
                "std_aqi": std_aqi,
                "observations_count": len(filtered),
                "valid_aqi_days": len(aqi_series),
                "data_completeness_pct": round(len(aqi_series) / len(filtered) * 100, 1)
            },
            "pollutant_averages": pollutant_avgs,
            "category_distribution": cat_counts,
            "baseline_city_aqi": round(float(city_overall_mean), 1),
            "variance_pct": variance_pct,
            "timeseries": timeseries,
            "summary": summary_text,
            "recommendations": recommendations
        }

    def get_historical_metadata(self, city: Optional[str] = None) -> Dict[str, Any]:
        """
        Returns dynamic historical bounds, available years (from 2010 onwards if present),
        available months, city coverage summaries, and valid criteria pollutants.
        """
        df = self.load_combined_historical_data()
        all_cities = sorted(df["city"].dropna().unique().tolist())
        target_city = city.title().strip() if city and city.title().strip() in all_cities else (all_cities[0] if all_cities else "Delhi")
        city_df = df[df["city"] == target_city].copy()

        city_df["date_dt"] = pd.to_datetime(city_df["date"], errors="coerce")
        city_df = city_df.dropna(subset=["date_dt"])
        city_df["year"] = city_df["date_dt"].dt.year
        city_df["month"] = city_df["date_dt"].dt.month

        # Filter for actual valid records (valid AQI)
        city_df_valid = city_df[city_df["aqi"].notnull()].copy()
        available_years = sorted(city_df_valid["year"].unique().tolist())

        years_info = {}
        for y in available_years:
            y_sub = city_df_valid[city_df_valid["year"] == y]
            valid_aqi = int(y_sub["aqi"].notnull().sum())
            total_days = len(y_sub)
            months_present = sorted(y_sub["month"].unique().tolist())
            is_partial = len(months_present) < 12
            reason = f"Observations recorded across {len(months_present)} months." if is_partial else None

            years_info[int(y)] = {
                "year": int(y),
                "total_days": total_days,
                "valid_aqi_days": valid_aqi,
                "months": months_present,
                "is_partial": is_partial,
                "partial_reason": reason,
                "has_valid_aqi": True
            }

        city_summaries = {}
        for c in all_cities:
            c_sub = df[df["city"] == c]
            c_valid = c_sub[c_sub["aqi"].notnull()]
            if len(c_valid) > 0:
                min_y = int(pd.to_datetime(c_valid["date"].min()).year)
                max_y = int(pd.to_datetime(c_valid["date"].max()).year)
                min_d = str(c_valid["date"].min())
                max_d = str(c_valid["date"].max())
                total_rec = len(c_valid)
            else:
                min_y = int(pd.to_datetime(c_sub["date"].min()).year)
                max_y = int(pd.to_datetime(c_sub["date"].max()).year)
                min_d = str(c_sub["date"].min())
                max_d = str(c_sub["date"].max())
                total_rec = len(c_sub)

            city_summaries[c] = {
                "city": c,
                "min_year": min_y,
                "max_year": max_y,
                "min_date": min_d,
                "max_date": max_d,
                "year_range_label": f"{min_y}–{max_y}",
                "total_records": total_rec,
                "valid_aqi_records": int(c_sub["aqi"].notnull().sum())
            }

        available_pollutants = [
            {"id": "aqi", "name": "CPCB NAQI", "unit": "Index", "description": "National Air Quality Index"},
            {"id": "pm25", "name": "PM2.5", "unit": "µg/m³", "description": "Fine Particulate Matter (Respirable)"},
            {"id": "pm10", "name": "PM10", "unit": "µg/m³", "description": "Coarse Particulate Matter (Inhalable Dust)"},
            {"id": "no2", "name": "NO₂", "unit": "µg/m³", "description": "Nitrogen Dioxide"},
            {"id": "so2", "name": "SO₂", "unit": "µg/m³", "description": "Sulphur Dioxide"},
            {"id": "co", "name": "CO", "unit": "mg/m³", "description": "Carbon Monoxide"},
            {"id": "ozone", "name": "Ozone (O₃)", "unit": "µg/m³", "description": "Ground-Level Photochemical Ozone"}
        ]

        min_date_str = str(city_df_valid["date_dt"].min().strftime("%Y-%m-%d")) if len(city_df_valid) > 0 else "2010-01-01"
        max_date_str = str(city_df_valid["date_dt"].max().strftime("%Y-%m-%d")) if len(city_df_valid) > 0 else "2024-12-31"

        return {
            "selected_city": target_city,
            "min_date": min_date_str,
            "max_date": max_date_str,
            "available_years": available_years,
            "years_info": years_info,
            "available_pollutants": available_pollutants,
            "all_cities": all_cities,
            "city_summaries": city_summaries
        }

    def get_calendar_daily_analysis(self, city: str, year: int, month: int) -> Dict[str, Any]:
        """
        Generates day-by-day calendar data for the requested month:
        - Day status: 'complete' (valid AQI), 'partial' (particulates present, gaseous pending), or 'missing'
        - Numerical concentrations of all criteria pollutants
        - Category color and badge
        - Summary metrics for the month
        """
        import calendar
        df = self.load_combined_historical_data()
        target_city = city.title().strip()
        month_prefix = f"{year:04d}-{month:02d}"

        city_sub = df[(df["city"] == target_city) & (df["date"].str.startswith(month_prefix))].copy()
        date_map = {}
        for _, r in city_sub.iterrows():
            date_map[str(r["date"])] = r

        first_weekday, num_days = calendar.monthrange(year, month)
        calendar_days = []
        weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        valid_aqi_values = []
        cat_counts = {}
        pollutant_accum = {p: [] for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"]}

        for day in range(1, num_days + 1):
            d_str = f"{year:04d}-{month:02d}-{day:02d}"
            cur_dt = pd.to_datetime(d_str)
            w_idx = cur_dt.weekday()  # 0=Mon, 6=Sun
            w_name = weekday_names[w_idx]

            if d_str in date_map:
                row = date_map[d_str]
                aqi_val = round(float(row["aqi"]), 1) if pd.notnull(row["aqi"]) else None
                has_pm = pd.notnull(row.get("pm25")) or pd.notnull(row.get("pm10"))

                if aqi_val is not None:
                    status = "complete"
                    valid_aqi_values.append(aqi_val)
                    cat = get_aqi_category_info(aqi_val)
                    cat_name = cat["name"]
                    cat_counts[cat_name] = cat_counts.get(cat_name, 0) + 1
                    color = cat["color"]
                    badge = cat["badge"]
                elif has_pm:
                    status = "partial"
                    cat_name = "Data Pending"
                    color = "#64748b"
                    badge = "bg-slate-100 text-slate-800 border-slate-300"
                else:
                    status = "missing"
                    cat_name = "No Data"
                    color = "#cbd5e1"
                    badge = "bg-gray-100 text-gray-500 border-gray-200"

                pollutants = {}
                for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"]:
                    if p in row and pd.notnull(row[p]):
                        val = round(float(row[p]), 2 if p == "co" else 1)
                        pollutants[p] = val
                        pollutant_accum[p].append(val)
                    else:
                        pollutants[p] = None

                calendar_days.append({
                    "date": d_str,
                    "day": day,
                    "weekday": w_idx,
                    "weekday_name": w_name,
                    "status": status,
                    "aqi": aqi_val,
                    "category": cat_name,
                    "color": color,
                    "badge": badge,
                    "pollutants": pollutants,
                    "prominent_pollutant": row.get("prominent_pollutant") if pd.notnull(row.get("prominent_pollutant")) else "N/A"
                })
            else:
                calendar_days.append({
                    "date": d_str,
                    "day": day,
                    "weekday": w_idx,
                    "weekday_name": w_name,
                    "status": "missing",
                    "aqi": None,
                    "category": "No Record",
                    "color": "#e2e8f0",
                    "badge": "bg-slate-50 text-slate-400 border-slate-200",
                    "pollutants": {p: None for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"]},
                    "prominent_pollutant": "N/A"
                })

        mean_aqi = round(float(np.mean(valid_aqi_values)), 1) if valid_aqi_values else None
        max_aqi = round(float(np.max(valid_aqi_values)), 1) if valid_aqi_values else None
        min_aqi = round(float(np.min(valid_aqi_values)), 1) if valid_aqi_values else None
        std_aqi = round(float(np.std(valid_aqi_values)), 1) if len(valid_aqi_values) > 1 else (0.0 if valid_aqi_values else None)

        pollutant_averages = {
            p: round(float(np.mean(vals)), 2 if p == "co" else 1)
            for p, vals in pollutant_accum.items() if len(vals) > 0
        }

        is_partial_month = (year == 2025 and len(valid_aqi_values) == 0 and len(city_sub) > 0)
        status_note = None
        if is_partial_month:
            status_note = (
                f"For {calendar.month_name[month]} {year}, particulate telemetry (PM2.5/PM10) is active across "
                f"{len(city_sub)} days, but CPCB gaseous criteria gases (NO₂, SO₂, CO, Ozone) are pending publication. "
                f"Under CPCB guidelines, official NAQI requires >=3 pollutants with at least one particulate parameter."
            )
        elif len(valid_aqi_values) == 0 and len(city_sub) == 0:
            status_note = f"No monitoring records logged for {city} in {calendar.month_name[month]} {year}."

        return {
            "city": target_city,
            "year": year,
            "month": month,
            "month_name": calendar.month_name[month],
            "period_label": f"{calendar.month_name[month]} {year}",
            "days_in_month": num_days,
            "first_weekday": first_weekday,
            "monitored_days": len(city_sub),
            "valid_aqi_days": len(valid_aqi_values),
            "completeness_pct": round(len(valid_aqi_values) / num_days * 100, 1),
            "mean_aqi": mean_aqi,
            "max_aqi": max_aqi,
            "min_aqi": min_aqi,
            "std_aqi": std_aqi,
            "overall_category": get_aqi_category_info(mean_aqi) if mean_aqi is not None else get_aqi_category_info(None),
            "category_distribution": cat_counts,
            "pollutant_averages": pollutant_averages,
            "calendar_days": calendar_days,
            "is_partial_month": is_partial_month,
            "status_note": status_note
        }

    def get_month_wise_analysis(self, city: str, year: int, compare_years: Optional[List[int]] = None) -> Dict[str, Any]:
        """
        Returns January-through-December monthly breakdown with multi-year comparison support.
        Preserves missing months as null (never zero) for scientific data integrity.
        """
        import calendar
        df = self.load_combined_historical_data()
        target_city = city.title().strip()
        city_df = df[df["city"] == target_city].copy()

        monthly_data = []
        valid_months_aqi = []

        for m in range(1, 13):
            prefix = f"{year:04d}-{m:02d}"
            m_sub = city_df[city_df["date"].str.startswith(prefix)]
            num_days = calendar.monthrange(year, m)[1]

            if len(m_sub) > 0:
                valid_aqi_s = m_sub["aqi"].dropna()
                valid_count = len(valid_aqi_s)
                m_mean_aqi = round(float(valid_aqi_s.mean()), 1) if valid_count > 0 else None
                m_max_aqi = round(float(valid_aqi_s.max()), 1) if valid_count > 0 else None
                m_min_aqi = round(float(valid_aqi_s.min()), 1) if valid_count > 0 else None

                if m_mean_aqi is not None:
                    valid_months_aqi.append((m, m_mean_aqi))
                    status = "complete"
                elif m_sub["pm25"].notnull().any() or m_sub["pm10"].notnull().any():
                    status = "partial"
                else:
                    status = "missing"

                pollutant_means = {}
                for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"]:
                    if p in m_sub and m_sub[p].notnull().any():
                        pollutant_means[p] = round(float(m_sub[p].dropna().mean()), 2 if p == "co" else 1)
                    else:
                        pollutant_means[p] = None
            else:
                valid_count = 0
                m_mean_aqi = None
                m_max_aqi = None
                m_min_aqi = None
                status = "missing"
                pollutant_means = {p: None for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"]}

            cat_info = get_aqi_category_info(m_mean_aqi) if m_mean_aqi is not None else {"name": "No Data", "color": "#94a3b8"}

            monthly_data.append({
                "month": m,
                "month_name": calendar.month_name[m],
                "short_name": calendar.month_abbr[m],
                "mean_aqi": m_mean_aqi,
                "max_aqi": m_max_aqi,
                "min_aqi": m_min_aqi,
                "category": cat_info["name"],
                "color": cat_info["color"],
                "badge": cat_info.get("badge", ""),
                "status": status,
                "total_days": num_days,
                "recorded_days": len(m_sub),
                "valid_aqi_days": valid_count,
                "completeness_pct": round(valid_count / num_days * 100, 1) if num_days > 0 else 0,
                "pollutants": pollutant_means
            })

        # Multi-year comparisons
        comparisons = {}
        if compare_years:
            for cy in compare_years:
                if cy != year:
                    cy_sub = city_df[city_df["date"].str.startswith(f"{cy:04d}")]
                    cy_monthly = []
                    for m in range(1, 13):
                        m_sub = cy_sub[cy_sub["date"].str.startswith(f"{cy:04d}-{m:02d}")]
                        v_s = m_sub["aqi"].dropna()
                        cy_monthly.append({
                            "month": m,
                            "short_name": calendar.month_abbr[m],
                            "mean_aqi": round(float(v_s.mean()), 1) if len(v_s) > 0 else None
                        })
                    comparisons[str(cy)] = cy_monthly

        best_month = None
        worst_month = None
        if valid_months_aqi:
            sorted_by_aqi = sorted(valid_months_aqi, key=lambda x: x[1])
            best_month = {
                "month": sorted_by_aqi[0][0],
                "name": calendar.month_name[sorted_by_aqi[0][0]],
                "mean_aqi": sorted_by_aqi[0][1]
            }
            worst_month = {
                "month": sorted_by_aqi[-1][0],
                "name": calendar.month_name[sorted_by_aqi[-1][0]],
                "mean_aqi": sorted_by_aqi[-1][1]
            }

        return {
            "city": target_city,
            "year": year,
            "monthly_data": monthly_data,
            "comparisons": comparisons,
            "best_month": best_month,
            "worst_month": worst_month,
            "valid_months_count": len(valid_months_aqi),
            "annual_mean_aqi": round(float(np.mean([x[1] for x in valid_months_aqi])), 1) if valid_months_aqi else None
        }

    def get_year_wise_analysis(self, city: str, pollutant: str = "aqi") -> Dict[str, Any]:
        """
        Returns multi-year evolution from 2010 through 2025:
        - Yearly averages and peak AQI
        - Year-over-Year (YoY) percentage change
        - Transparent partial-year indicators (flagging 2025 as 9-month partial)
        - Cleanest vs most polluted years
        """
        df = self.load_combined_historical_data()
        target_city = city.title().strip()
        city_df = df[df["city"] == target_city].copy()

        city_df["date_dt"] = pd.to_datetime(city_df["date"], errors="coerce")
        city_df = city_df.dropna(subset=["date_dt"])
        city_df["year"] = city_df["date_dt"].dt.year
        city_df["month"] = city_df["date_dt"].dt.month

        # Only include years with actual valid records
        valid_city_df = city_df[city_df["aqi"].notnull()].copy()
        years_present = sorted(valid_city_df["year"].unique().tolist())
        target_pollutant = pollutant.lower().strip() if pollutant.lower().strip() in ["aqi", "pm25", "pm10", "no2", "so2", "co", "ozone"] else "aqi"

        yearly_records = []
        prev_valid_aqi = None
        prev_valid_pollutant = None

        for y in years_present:
            y_sub = valid_city_df[valid_city_df["year"] == y]
            total_days = len(y_sub)
            months_count = len(y_sub["month"].unique())
            is_partial = (months_count < 12)

            partial_reason = f"Observations recorded across {months_count} months." if is_partial else None

            aqi_s = y_sub["aqi"].dropna()
            valid_aqi_days = len(aqi_s)
            mean_aqi = round(float(aqi_s.mean()), 1) if valid_aqi_days > 0 else None
            max_aqi = round(float(aqi_s.max()), 1) if valid_aqi_days > 0 else None
            min_aqi = round(float(aqi_s.min()), 1) if valid_aqi_days > 0 else None

            p_s = y_sub[target_pollutant].dropna() if target_pollutant in y_sub else pd.Series(dtype=float)
            p_mean = round(float(p_s.mean()), 2 if target_pollutant == "co" else 1) if len(p_s) > 0 else None

            yoy_aqi_change = None
            if mean_aqi is not None and prev_valid_aqi is not None and prev_valid_aqi > 0:
                yoy_aqi_change = round(((mean_aqi - prev_valid_aqi) / prev_valid_aqi) * 100.0, 1)

            yoy_p_change = None
            if p_mean is not None and prev_valid_pollutant is not None and prev_valid_pollutant > 0:
                yoy_p_change = round(((p_mean - prev_valid_pollutant) / prev_valid_pollutant) * 100.0, 1)

            if mean_aqi is not None:
                prev_valid_aqi = mean_aqi
            if p_mean is not None:
                prev_valid_pollutant = p_mean

            cat_info = get_aqi_category_info(mean_aqi) if mean_aqi is not None else {"name": "Data Incomplete", "color": "#94a3b8"}

            pollutant_breakdown = {}
            for p in ["pm25", "pm10", "no2", "so2", "co", "ozone"]:
                if p in y_sub and y_sub[p].notnull().any():
                    pollutant_breakdown[p] = round(float(y_sub[p].dropna().mean()), 2 if p == "co" else 1)
                else:
                    pollutant_breakdown[p] = None

            yearly_records.append({
                "year": int(y),
                "mean_aqi": mean_aqi,
                "max_aqi": max_aqi,
                "min_aqi": min_aqi,
                "category": cat_info["name"],
                "color": cat_info["color"],
                "badge": cat_info.get("badge", ""),
                "selected_pollutant": target_pollutant,
                "pollutant_mean": p_mean,
                "pollutant_unit": POLLUTANT_METRICS.get(target_pollutant, {}).get("unit", "Index"),
                "yoy_aqi_change": yoy_aqi_change,
                "yoy_pollutant_change": yoy_p_change,
                "total_recorded_days": total_days,
                "valid_aqi_days": valid_aqi_days,
                "months_count": months_count,
                "is_partial": is_partial,
                "partial_reason": partial_reason,
                "pollutants": pollutant_breakdown
            })

        valid_years = [r for r in yearly_records if r["mean_aqi"] is not None]
        cleanest_year = min(valid_years, key=lambda x: x["mean_aqi"]) if valid_years else None
        worst_year = max(valid_years, key=lambda x: x["mean_aqi"]) if valid_years else None

        trend_direction = "stable"
        if len(valid_years) >= 3:
            first_half_mean = np.mean([r["mean_aqi"] for r in valid_years[:len(valid_years)//2]])
            second_half_mean = np.mean([r["mean_aqi"] for r in valid_years[len(valid_years)//2:]])
            diff_pct = (second_half_mean - first_half_mean) / first_half_mean * 100.0
            if diff_pct < -5.0:
                trend_direction = "improving"
            elif diff_pct > 5.0:
                trend_direction = "deteriorating"

        return {
            "city": target_city,
            "selected_pollutant": target_pollutant,
            "years_count": len(years_present),
            "min_year": min(years_present) if years_present else 2010,
            "max_year": max(years_present) if years_present else 2024,
            "yearly_records": yearly_records,
            "cleanest_year": cleanest_year,
            "worst_year": worst_year,
            "overall_trend_direction": trend_direction
        }

    def get_historical_table_records(
        self,
        city: str,
        year: Optional[int] = None,
        month: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        page: int = 1,
        page_size: int = 25,
        sort_col: str = "date",
        sort_dir: str = "desc"
    ) -> Dict[str, Any]:
        """
        Returns paginated, sortable table records for the selected period/city.
        """
        import calendar
        df = self.load_combined_historical_data()
        target_city = city.title().strip()
        filtered = df[df["city"] == target_city].copy()

        if year is not None and month is not None:
            last_day = calendar.monthrange(year, month)[1]
            s_d = f"{year:04d}-{month:02d}-01"
            e_d = f"{year:04d}-{month:02d}-{last_day:02d}"
            filtered = filtered[(filtered["date"] >= s_d) & (filtered["date"] <= e_d)]
        elif year is not None:
            filtered = filtered[filtered["date"].str.startswith(f"{year:04d}")]
        elif start_date:
            e_d = end_date if end_date else start_date
            filtered = filtered[(filtered["date"] >= start_date) & (filtered["date"] <= e_d)]

        total_records = len(filtered)
        if total_records == 0:
            return {
                "city": target_city,
                "total_records": 0,
                "total_pages": 0,
                "page": page,
                "page_size": page_size,
                "records": []
            }

        valid_sort_cols = ["date", "aqi", "pm25", "pm10", "no2", "so2", "co", "ozone"]
        s_col = sort_col.lower() if sort_col.lower() in valid_sort_cols else "date"
        ascending = (sort_dir.lower() == "asc")

        filtered = filtered.sort_values(by=s_col, ascending=ascending, na_position="last")

        total_pages = int(np.ceil(total_records / page_size))
        page = max(1, min(page, total_pages)) if total_pages > 0 else 1
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size

        page_df = filtered.iloc[start_idx:end_idx]

        records = []
        for _, r in page_df.iterrows():
            aqi_val = round(float(r["aqi"]), 1) if pd.notnull(r["aqi"]) else None
            cat_info = get_aqi_category_info(aqi_val) if aqi_val is not None else get_aqi_category_info(None)
            has_pm = pd.notnull(r.get("pm25")) or pd.notnull(r.get("pm10"))

            if aqi_val is not None:
                status = "complete"
            elif has_pm:
                status = "partial"
            else:
                status = "missing"

            records.append({
                "date": str(r["date"]),
                "city": str(r["city"]),
                "aqi": aqi_val,
                "category": cat_info["name"],
                "color": cat_info["color"],
                "badge": cat_info.get("badge", ""),
                "pm25": round(float(r["pm25"]), 1) if pd.notnull(r.get("pm25")) else None,
                "pm10": round(float(r["pm10"]), 1) if pd.notnull(r.get("pm10")) else None,
                "no2": round(float(r["no2"]), 1) if pd.notnull(r.get("no2")) else None,
                "so2": round(float(r["so2"]), 1) if pd.notnull(r.get("so2")) else None,
                "co": round(float(r["co"]), 2) if pd.notnull(r.get("co")) else None,
                "ozone": round(float(r["ozone"]), 1) if pd.notnull(r.get("ozone")) else None,
                "status": status,
                "prominent_pollutant": r.get("prominent_pollutant") if pd.notnull(r.get("prominent_pollutant")) else "N/A"
            })

        return {
            "city": target_city,
            "total_records": total_records,
            "total_pages": total_pages,
            "page": page,
            "page_size": page_size,
            "sort_col": s_col,
            "sort_dir": "asc" if ascending else "desc",
            "records": records
        }
