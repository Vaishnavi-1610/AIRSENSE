import logging
from typing import Tuple, List, Dict, Any, Optional
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

class TimeSeriesPreprocessor:
    """
    Constructs leak-free time-series features with strict chronological splits.
    Target is strictly y_{t+H} where H is the forecast horizon (1h, 6h, 24h).
    """

    def __init__(self, target_col: str = "aqi", horizon_hours: int = 1):
        self.target_col = target_col
        self.horizon_hours = horizon_hours
        self.feature_names: List[str] = []

    def prepare_features(self, df: pd.DataFrame, station_id: Optional[str] = None) -> Tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
        """
        Creates time-series lag and rolling features for a station or aggregated city.
        Returns: (X, y, df_clean)
        """
        data = df.copy()
        if station_id and station_id != "All":
            data = data[data["station_id"] == station_id]
        
        # Sort strictly chronologically
        data["dt"] = pd.to_datetime(data["timestamp"])
        data = data.sort_values(by="dt").reset_index(drop=True)

        if len(data) < 30:
            raise ValueError(f"Insufficient historical data ({len(data)} records). At least 30 observations required for time-series modeling.")

        # Pollutant input columns
        pollutants = [c for c in ["pm25", "pm10", "no2", "co", "so2", "ozone"] if c in data.columns and data[c].notnull().sum() > 5]
        
        feature_df = pd.DataFrame(index=data.index)
        
        # Base pollutant readings at current time t
        for p in pollutants:
            feature_df[f"{p}_current"] = data[p].ffill().bfill()

        # Current target variable at time t
        feature_df[f"{self.target_col}_current"] = data[self.target_col].ffill().bfill()

        # Lagged features for target and key particulates
        lags = [1, 2, 3, 6, 12, 24]
        for lag in lags:
            if len(data) > lag:
                feature_df[f"{self.target_col}_lag_{lag}h"] = data[self.target_col].shift(lag)
                if "pm25" in pollutants:
                    feature_df[f"pm25_lag_{lag}h"] = data["pm25"].shift(lag)

        # Rolling statistics at time t (using only past values, closed='left' equivalent by shifting 1)
        # 6-hour rolling mean and std
        feature_df[f"{self.target_col}_roll_mean_6h"] = data[self.target_col].shift(1).rolling(window=6, min_periods=1).mean()
        feature_df[f"{self.target_col}_roll_std_6h"] = data[self.target_col].shift(1).rolling(window=6, min_periods=1).std().fillna(0)
        
        # 24-hour rolling mean
        feature_df[f"{self.target_col}_roll_mean_24h"] = data[self.target_col].shift(1).rolling(window=24, min_periods=1).mean()

        # Temporal / Calendar features
        feature_df["hour"] = data["dt"].dt.hour
        feature_df["day_of_week"] = data["dt"].dt.dayofweek
        feature_df["is_weekend"] = feature_df["day_of_week"].apply(lambda d: 1 if d >= 5 else 0)
        feature_df["month"] = data["dt"].dt.month

        # Cyclic encoding of hour
        feature_df["hour_sin"] = np.sin(2 * np.pi * feature_df["hour"] / 24.0)
        feature_df["hour_cos"] = np.cos(2 * np.pi * feature_df["hour"] / 24.0)

        # Target variable: Value at t + horizon_hours (look-ahead strictly on target)
        target_series = data[self.target_col].shift(-self.horizon_hours)

        # Merge and drop rows where target or features are NaN (edge rows)
        combined = feature_df.copy()
        combined["__target__"] = target_series
        combined["__timestamp__"] = data["dt"]
        combined["__actual_current__"] = data[self.target_col]

        combined = combined.dropna().reset_index(drop=True)

        y = combined["__target__"]
        X = combined.drop(columns=["__target__", "__timestamp__", "__actual_current__"])
        
        self.feature_names = X.columns.tolist()
        return X, y, combined

    def chronological_split(self, X: pd.DataFrame, y: pd.Series, 
                            train_ratio: float = 0.70, 
                            val_ratio: float = 0.15) -> Dict[str, Any]:
        """
        Splits data chronologically into Train (70%), Validation (15%), and Test (15%).
        NO random shuffling!
        """
        n = len(X)
        train_end = int(n * train_ratio)
        val_end = int(n * (train_ratio + val_ratio))

        X_train, y_train = X.iloc[:train_end], y.iloc[:train_end]
        X_val, y_val = X.iloc[train_end:val_end], y.iloc[train_end:val_end]
        X_test, y_test = X.iloc[val_end:], y.iloc[val_end:]

        return {
            "X_train": X_train, "y_train": y_train,
            "X_val": X_val, "y_val": y_val,
            "X_test": X_test, "y_test": y_test,
            "split_indices": {
                "train_count": len(X_train),
                "val_count": len(X_val),
                "test_count": len(X_test),
                "total_count": n
            }
        }
