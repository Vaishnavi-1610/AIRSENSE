import sqlite3
import pandas as pd
import json

db_path = r'c:\Users\HP\Desktop\aiml\airsense.db'
conn = sqlite3.connect(db_path)

stations_df = pd.read_sql("SELECT * FROM stations", conn)
readings_df = pd.read_sql("SELECT * FROM readings WHERE station_id != 'test_station'", conn)

# Merge station metadata
merged_df = readings_df.merge(
    stations_df[['id', 'name', 'locality', 'city', 'state', 'latitude', 'longitude', 'is_physical_station', 'telemetry_type', 'provider']],
    left_on='station_id',
    right_on='id',
    how='left',
    suffixes=('', '_st')
)

# Clean and order columns
cols_order = [
    'timestamp', 'city', 'station_id', 'name', 'locality', 'state',
    'latitude', 'longitude', 'is_physical_station',
    'pm25', 'pm10', 'no2', 'co', 'so2', 'ozone', 'aqi', 'aqi_category', 'prominent_pollutant',
    'telemetry_type', 'provider'
]

# Ensure no nulls in city/name for known stations
merged_df['city'] = merged_df['city'].fillna('Pune')
merged_df['name'] = merged_df['name'].fillna(merged_df['station_id'])

# Sort chronologically by timestamp
merged_df['timestamp'] = pd.to_datetime(merged_df['timestamp'])
merged_df = merged_df.sort_values(by=['timestamp', 'station_id']).reset_index(drop=True)
merged_df['timestamp'] = merged_df['timestamp'].dt.strftime('%Y-%m-%dT%H:%M')

output_csv = r'c:\Users\HP\Desktop\air_prediction\backend\data\india_air_quality_telemetry.csv'
merged_df[cols_order].to_csv(output_csv, index=False)
print(f"Exported {len(merged_df)} records to {output_csv}")

# Export station registry JSON
stations_dict = stations_df.to_dict(orient='records')
with open(r'c:\Users\HP\Desktop\air_prediction\backend\data\stations_registry.json', 'w', encoding='utf-8') as f:
    json.dump(stations_dict, f, indent=2)
print("Exported station registry to backend/data/stations_registry.json")
