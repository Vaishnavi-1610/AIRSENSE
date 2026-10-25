# xKDR India Air Quality Dataset Summary

**Generated:** 2026-10-20 02:05:25  
**Source:** CPCB CAAQM Network via xKDR India Air Quality Database (`https://airquality.xkdr.org`)  

## Overview
- **Total Raw Observation Rows Downloaded:** 533,748
- **Quality-Filtered Station Observations:** 498,509
- **City-Level Daily Aggregated Records:** 9,116
- **Cities Evaluated:** 10 (Ahmedabad, Bengaluru, Chennai, Delhi, Hyderabad, Kolkata, Mumbai, Nagpur, Nashik, Pune)
- **Chronological Window:** 2023-01-01 to 2025-09-30
- **Valid CPCB AQI Observations:** 7,287 (79.9%)

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
| Ahmedabad | Gujarat | 885 | 2023-01-01 to 2025-09-01 | 731 (82.6%) | 109.1 | 312.0 | 6.8 |
| Bengaluru | Karnataka | 885 | 2023-01-01 to 2025-09-01 | 731 (82.6%) | 72.5 | 348.0 | 11.3 |
| Chennai | TamilNadu | 975 | 2023-01-01 to 2025-09-01 | 731 (75.0%) | 67.7 | 325.0 | 6.0 |
| Delhi | Delhi | 885 | 2023-01-01 to 2025-09-01 | 731 (82.6%) | 210.3 | 500.0 | 36.7 |
| Hyderabad | Telangana | 970 | 2023-01-01 to 2025-09-30 | 731 (75.4%) | 81.4 | 303.0 | 10.9 |
| Kolkata | West Bengal | 936 | 2023-01-01 to 2025-09-01 | 731 (78.1%) | 107.1 | 337.0 | 7.1 |
| Mumbai | Maharashtra | 947 | 2023-01-01 to 2025-09-01 | 731 (77.2%) | 97.7 | 309.0 | 21.2 |
| Nagpur | Maharashtra | 885 | 2023-01-01 to 2025-09-01 | 731 (82.6%) | 106.2 | 329.0 | 3.3 |
| Nashik | Maharashtra | 883 | 2023-01-01 to 2025-09-01 | 728 (82.4%) | 79.9 | 314.0 | 3.3 |
| Pune | Maharashtra | 865 | 2023-01-21 to 2025-09-01 | 711 (82.2%) | 105.4 | 347.0 | 4.7 |

## Pollutant Coverage
| Pollutant | Valid Days | Coverage | Mean | Min | Max | Unit |
|---|---|---|---|---|---|---|
| PM25 | 9115 | 100.0% | 45.06 | 3.38 | 592.02 | µg/m³ |
| PM10 | 8827 | 96.8% | 93.14 | 10.32 | 765.86 | µg/m³ |
| NO2 | 7288 | 79.9% | 25.46 | 1.35 | 142.17 | µg/m³ |
| SO2 | 7232 | 79.3% | 14.76 | 0.6 | 167.76 | µg/m³ |
| CO | 7288 | 79.9% | 0.87 | 0.17 | 3.01 | mg/m³ |
| OZONE | 7262 | 79.7% | 27.66 | 3.07 | 76.73 | µg/m³ |
| AQI | 7287 | 79.9% | 103.73 | 20.0 | 500.0 | Index |
