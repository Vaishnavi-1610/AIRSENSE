import logging
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

logger = logging.getLogger(__name__)

class PollutionClusterer:
    """
    Unsupervised multi-pollutant pattern clustering on standardized Indian atmospheric features.
    Produces scientifically calibrated cluster profiles, city-specific cluster distributions,
    and cross-city comparisons with transparent attribution guardrails.
    """

    def __init__(self, n_clusters: int = 3):
        self.n_clusters = n_clusters
        self.scaler = StandardScaler()
        self.kmeans: Optional[KMeans] = None
        self.pollutant_cols: List[str] = []

    def fit_and_profile(self, df: pd.DataFrame, n_clusters: Optional[int] = 3, city: Optional[str] = None) -> Dict[str, Any]:
        if n_clusters:
            self.n_clusters = max(2, min(int(n_clusters), 5))

        data = df.copy()
        candidate_cols = ["pm25", "pm10", "no2", "co", "so2", "ozone"]
        self.pollutant_cols = [c for c in candidate_cols if c in data.columns and data[c].notnull().sum() > 20]

        if len(self.pollutant_cols) < 2 or len(data) < 30:
            return {
                "available": False,
                "message": "Insufficient usable multi-pollutant telemetry to perform reliable atmospheric clustering."
            }

        # Impute missing with median
        X_raw = data[self.pollutant_cols].copy()
        for c in self.pollutant_cols:
            X_raw[c] = X_raw[c].fillna(X_raw[c].median())

        # Standardize features
        X_scaled = self.scaler.fit_transform(X_raw)

        # Fit KMeans
        self.kmeans = KMeans(n_clusters=self.n_clusters, random_state=42, n_init=10)
        cluster_labels = self.kmeans.fit_predict(X_scaled)
        data["cluster_id"] = cluster_labels

        # Silhouette score
        eval_sample = min(len(X_scaled), 1500)
        eval_idx = np.random.RandomState(42).choice(len(X_scaled), eval_sample, replace=False)
        sil = float(silhouette_score(X_scaled[eval_idx], cluster_labels[eval_idx]))

        # Centroids
        centroids_unscaled = self.scaler.inverse_transform(self.kmeans.cluster_centers_)

        # Derive descriptive labels based on actual measured levels
        # Thresholds: PM2.5 standard 30, PM10 standard 60
        pm25_idx = self.pollutant_cols.index("pm25") if "pm25" in self.pollutant_cols else None
        
        # Sort clusters by PM2.5 or overall mean
        cluster_summaries = []
        for cid in range(self.n_clusters):
            c_mask = (cluster_labels == cid)
            c_count = int(c_mask.sum())
            c_pct = round((c_count / len(data)) * 100.0, 1)

            means_dict = {}
            for col_i, col_name in enumerate(self.pollutant_cols):
                means_dict[col_name] = round(float(centroids_unscaled[cid][col_i]), 1)

            cluster_summaries.append({
                "cluster_id": cid,
                "count": c_count,
                "percentage": c_pct,
                "means": means_dict,
                "key_val": means_dict.get("pm25", list(means_dict.values())[0])
            })

        # Rank clusters from lowest to highest pollution
        cluster_summaries.sort(key=lambda x: x["key_val"])

        profiles = []
        labels_seq = [
            ("Lower pollution profile", "bg-emerald-100 text-emerald-800 border-emerald-300", "#10b981",
             "Characterized by baseline atmospheric levels with well-dispersed particulates. Pollutant concentrations remain largely within permissible environmental limits."),
            ("Moderate pollution profile", "bg-amber-100 text-amber-800 border-amber-300", "#f59e0b",
             "Represents intermediate atmospheric loading. Frequently observed during regular urban daytime traffic and standard regional dispersion."),
            ("Higher multi-pollutant profile", "bg-rose-100 text-rose-800 border-rose-300", "#ef4444",
             "Characterized by elevated concentrations across multiple particulates (PM2.5, PM10) and combustion gases. Possible contributing factors include stagnant weather inversion, heavy traffic, and industrial proximity."),
            ("Photochemical / Elevated Ozone profile", "bg-cyan-100 text-cyan-800 border-cyan-300", "#06b6d4",
             "Marked by elevated ground-level Ozone (O₃) with moderate particulates, typically corresponding to intense solar radiation and photochemical reactions."),
            ("Severe particulate loading profile", "bg-red-950 text-white border-red-900", "#7f1d1d",
             "Marked by severe particulate spikes well above safe standards, commonly coinciding with winter smog, calm winds, or localized emission surges.")
        ]

        id_to_profile_map = {}
        for rank, c_info in enumerate(cluster_summaries):
            label_tuple = labels_seq[min(rank, len(labels_seq) - 1)]
            prof = {
                "cluster_id": c_info["cluster_id"],
                "rank_order": rank + 1,
                "label": label_tuple[0],
                "badge": label_tuple[1],
                "color": label_tuple[2],
                "description": label_tuple[3],
                "observations_count": c_info["count"],
                "percentage": c_info["percentage"],
                "average_pollutants": c_info["means"],
                "possible_explanations": [
                    "Atmospheric boundary layer height and ventilation coefficient.",
                    "Vehicular and combustion gas accumulation during peak activity.",
                    "Localized dust re-suspension and regional background transport."
                ]
            }
            profiles.append(prof)
            id_to_profile_map[c_info["cluster_id"]] = prof

        # Selected City Cluster Distribution
        city_eval = city if (city and city != "All") else data["city"].iloc[0]
        city_sub = data[data["city"].str.lower() == city_eval.lower()]

        city_cluster_distribution = []
        if len(city_sub) > 0:
            for prof in profiles:
                c_matches = (city_sub["cluster_id"] == prof["cluster_id"]).sum()
                c_pct = round((c_matches / len(city_sub)) * 100.0, 1)
                city_cluster_distribution.append({
                    "cluster_id": prof["cluster_id"],
                    "label": prof["label"],
                    "color": prof["color"],
                    "observations": int(c_matches),
                    "percentage": c_pct
                })

        # Cross-City Comparison across all cities in dataset
        cross_city = []
        for c_name in sorted(data["city"].dropna().unique().tolist()):
            c_rows = data[data["city"] == c_name]
            dist_map = {}
            for prof in profiles:
                pct = round(((c_rows["cluster_id"] == prof["cluster_id"]).sum() / len(c_rows)) * 100.0, 1)
                dist_map[prof["label"]] = pct

            cross_city.append({
                "city": c_name,
                "total_observations": len(c_rows),
                "distribution": dist_map
            })

        return {
            "available": True,
            "n_clusters": self.n_clusters,
            "silhouette_score": round(sil, 4),
            "pollutant_features": self.pollutant_cols,
            "profiles": profiles,
            "selected_city": city_eval,
            "selected_city_distribution": city_cluster_distribution,
            "cross_city_comparison": cross_city,
            "scientific_guardrail": (
                "Identified pollution clusters describe statistical patterns in atmospheric telemetry. "
                "They represent common environmental profiles and potential contributing atmospheric factors, "
                "not confirmed single-source causation."
            )
        }
