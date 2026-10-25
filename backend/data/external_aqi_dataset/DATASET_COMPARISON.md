# Dataset Comparison and Audit Report: GitHub Repository vs. xKDR CPCB Telemetry

## 1. Overview and Provenance
This audit compares the newly integrated external GitHub dataset (`https://github.com/Krishna717-boop/AQI-Forecasting-India.git`) with the existing project's primary xKDR CPCB telemetry dataset.

### A. External GitHub Dataset (`backend/data/external_aqi_dataset/`)
- **Repository**: `Krishna717-boop/AQI-Forecasting-India`
- **Data Files**:
  1. `aqi_daily_data_top6_most_data.csv` (2.25 MB, 28,694 rows, 12 columns)
  2. `predicted_aqi_top6_2024_2026 (1).csv` (651 KB, 8,226 rows, 12 columns)
- **Provenance**:
  - Historical records were derived from the Kaggle dataset *"Time Series Air Quality Data of India (2010–2023)"*.
  - Cities covered: 6 metropolitan cities (**Delhi, Mumbai, Bengaluru, Chennai, Hyderabad, Lucknow**).
  - Date Range of historical measurements: **2010-01-01 to 2023-03-31**.
  - Missing Value Treatment: Imputed missing pollutant values by computing station-level medians and linear interpolation.
  - **Important Finding on 2024–2026 Data**: The file `predicted_aqi_top6_2024_2026 (1).csv` contains **PatchTST deep learning model predictions** covering `2023-04-01` to `2026-12-31`. As established during audit, these are **forecast projections, NOT genuine historical measurements**. In strict adherence to project integrity guidelines, these synthetic forecast rows are **never** treated as actual ground-truth observations.

### B. Existing xKDR Verified Telemetry Dataset (`data/processed/daily_city_air_quality.csv`)
- **Source**: xKDR Foundation Open Air Quality API (`https://airquality.xkdr.org/`), capturing continuous CPCB regulatory CAAQMS telemetry.
- **Raw Observations**: 533,748 hourly station records across 10 major Indian cities.
- **Cities Covered (10)**: **Ahmedabad, Bengaluru, Chennai, Delhi, Hyderabad, Kolkata, Mumbai, Nagpur, Nashik, Pune**.
- **Date Range**: **2023-01-01 to 2025-09-30** (9,116 city-day records).
- **CPCB NAQI Standard Enforcement**:
  - Requires daily concentration averages based on at least 16 hourly samples ($n \ge 16$).
  - Calculates official sub-indices for $\text{PM}_{2.5}, \text{PM}_{10}, \text{NO}_2, \text{SO}_2, \text{CO}, \text{O}_3$.
  - Strictly requires $\ge 3$ valid pollutant sub-indices, with at least one being a particulate pollutant ($\text{PM}_{2.5}$ or $\text{PM}_{10}$).
  - In periods with $<3$ criteria pollutants (such as 2025 gaseous telemetry pending release), AQI is kept as `NaN` rather than artificially imputed.

---

## 2. Statistical Comparison in Overlap Period (2023-01-01 to 2023-03-31)
Across the 5 common overlapping cities (Delhi, Mumbai, Bengaluru, Chennai, Hyderabad):
- **Delhi PM2.5 Pearson Correlation**: **0.9996** ($r \approx 1.0$), with Mean Absolute Difference of **3.23 $\mu g/m^3$**.
- **Delhi AQI Pearson Correlation**: **0.9845**, with Mean Absolute Difference of **7.99 AQI units**.
- **Conclusion**: Both datasets originate from CPCB CAAQMS sensors. The minor ~8-point difference arises because:
  1. The GitHub dataset applied station-median imputation prior to aggregation.
  2. The xKDR pipeline strictly aggregates valid $n \ge 16$ hourly telemetry and computes exact piecewise linear CPCB breakpoint sub-indices.

---

## 3. Dataset Integration & Selection Decision
1. **Preservation of External Source**:
   All GitHub source files, Jupyter notebooks (`timseries6 (1).ipynb`, `patchsts (1).ipynb`, `6-city (1).ipynb`), dashboard files, and README have been preserved intact inside `backend/data/external_aqi_dataset/`.
2. **Primary Operational Training Dataset**:
   The active training and operational forecasting pipeline uses `data/processed/daily_city_air_quality.csv`.
   **Justification**:
   - **Broader City Coverage (10 cities vs 6)**: Includes key industrial and urban hubs such as Pune, Kolkata, Ahmedabad, Nagpur, and Nashik.
   - **Modern Temporal Horizon**: Contains genuine 2023–2025 CPCB telemetry, ensuring models reflect recent vehicular emission standards (BS-VI) and post-pandemic urban mobility patterns.
   - **No Synthetic Injections**: Contains zero model-predicted values in historical ground truth.
   - **Methodological Consistency**: Rigorous adherence to the official CPCB NAQI standard without artificial single-pollutant AQI approximations.
