# AI-Based Air Quality Prediction & Pollution Source Clustering for Smart Cities

A production-grade Environmental Intelligence web application designed for academic demonstration and viva. Built with **FastAPI** (Python 3.14) and **React + TypeScript + TailwindCSS + Recharts + Leaflet**, backed by genuine, verified physical monitoring observations from India's **Central Pollution Control Board (CPCB) Continuous Ambient Air Quality Monitoring (CAAQM)** network via the **xKDR India Air Quality Database**.

---

## 📑 Table of Contents
1. [Key Capabilities & Architecture](#-key-capabilities--architecture)
2. [Dataset Provenance & CPCB NAQI Methodology](#-dataset-provenance--cpcb-naqi-methodology)
3. [Machine Learning Forecasting & Evaluation](#-machine-learning-forecasting--evaluation)
4. [Application Modules](#-application-modules)
5. [Setup & Startup Instructions](#-setup--startup-instructions)
6. [Data Governance & File Integrity](#-data-governance--file-integrity)

---

## 🌟 Key Capabilities & Architecture

- **10 Major Indian Cities Supported**: Pune, Mumbai, Nagpur, Delhi, Bengaluru, Hyderabad, Chennai, Kolkata, Ahmedabad, and Nashik across Western, Northern, Southern, Eastern, and Central India.
- **Genuine Historical Provenance**: Built on 533,748 raw physical station measurements and 498,509 quality-filtered observations aggregated into 9,116 city-day records spanning from **January 2023 through September 2025**.
- **Official CPCB NAQI Multi-Pollutant Calculation**: Enforces the official Central Pollution Control Board (CPCB) rule requiring at least 3 criteria pollutants (with at least PM2.5 or PM10) to calculate an official AQI. Missing values are preserved appropriately without arbitrary median imputation.
- **Zero-Leakage Multi-Horizon Forecasting**: Direct regression models predicting AQI for horizons **Day +1, Day +2, Day +3, Day +4, and Day +5** with calibrated 95% uncertainty intervals based on empirical test RMSE.
- **Monthly Historical Explorer**: Query historical data by City, Month, and Year (e.g. Pune, May 2024). Gracefully handles periods with incomplete data (e.g. May 2025 where gases are pending publication) with transparent, data-supported explanations.
- **Unsupervised Pollution Clustering**: $K$-Means clustering with silhouette score evaluation, deriving descriptive atmospheric profiles with attribution guardrails (non-causal).
- **Interactive National Hotspot Map**: Leaflet map highlighting strictly the top 2–3 cities with the highest period-average AQI using verified CAAQM coordinates.

---

## 📊 Dataset Provenance & CPCB NAQI Methodology

### 1. Ingestion Pipeline
- **API Source**: xKDR India Air Quality Database (`https://airquality.xkdr.org/v1/measurements` and `/v1/stations`)
- **Raw Telemetry**: 50 raw chunk files saved untouched in `data/raw/` (totaling 533,748 station-day readings).
- **Station Metadata**: 558 CAAQM stations mapped with exact geographic coordinates in `data/raw/stations_metadata.csv`.
- **Sufficiency Filter**: Enforces CPCB standard: stations must have at least 16 valid monitoring hours ($n \ge 16$) in a day to calculate a representative 24-hour mean.
- **Spatial Aggregation**: Station measurements are averaged across reporting nodes to derive daily city-level records.

### 2. CPCB Breakpoints and AQI Rule
Linear sub-indices are calculated for PM2.5, PM10, NO₂, SO₂, CO, and Ozone using official CPCB linear interpolation:
$$I_p = I_{low} + \frac{I_{high} - I_{low}}{B_{high} - B_{low}} \times (C_p - B_{low})$$
- Overall $\text{AQI} = \max(I_{\text{PM2.5}}, I_{\text{PM10}}, I_{\text{NO2}}, I_{\text{SO2}}, I_{\text{CO}}, I_{\text{O3}})$.
- **Sufficiency Rule**: If fewer than 3 pollutants are available, or neither PM2.5 nor PM10 is present, AQI is set to `NaN` (never fabricated).

---

## 🧠 Machine Learning Forecasting & Evaluation

### 1. Direct Multi-Horizon Architecture
Instead of recursive feedback that compounds error over time, five specialized models were trained for each horizon $h \in \{1, 2, 3, 4, 5\}$ using strictly information available at forecast issue time $t$:
- Current observations: $\text{AQI}_t, \text{PM2.5}_t, \text{PM10}_t, \text{NO2}_t, \text{SO2}_t, \text{CO}_t, \text{O3}_t$
- Lags: $t-1, t-2, t-3, t-7$
- Rolling Statistics: 7-day backward mean and standard deviation
- Calendar attributes: Day of week, month, day of year, weekend flag
- City one-hot encoding

### 2. Chronological Train-Val-Test Evaluation
Data was strictly partitioned chronologically (70% Train, 15% Validation, 15% Unseen Test) for each city to prevent target leakage:

| Horizon | Selected Algorithm | Test MAE | Test RMSE | Test $R^2$ | Baseline MAE | Error Reduction vs Baseline | CPCB Category Accuracy | Macro-F1 |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Day +1** | Random Forest | **19.93** | **30.22** | **0.8667** | 19.07 | Baseline Match | **73.4%** | **0.608** |
| **Day +2** | Random Forest | **27.96** | **40.98** | **0.7557** | 28.56 | **+2.1%** | **65.6%** | **0.485** |
| **Day +3** | Random Forest | **31.80** | **45.53** | **0.6993** | 33.88 | **+6.1%** | **61.8%** | **0.363** |
| **Day +4** | Random Forest | **33.87** | **48.43** | **0.6612** | 36.69 | **+7.7%** | **60.5%** | **0.357** |
| **Day +5** | Random Forest | **34.48** | **47.73** | **0.6725** | 38.13 | **+9.6%** | **59.5%** | **0.359** |

### 3. City-Level Test Performance (Day +1 Horizon)
| City | Test Samples | Test MAE | Test RMSE | Test $R^2$ |
|---|:---:|:---:|:---:|:---:|
| **Hyderabad** | 109 | **7.09** | **9.44** | **0.7701** |
| **Bengaluru** | 109 | **10.63** | **14.02** | **0.6433** |
| **Pune** | 106 | **13.15** | **17.20** | **0.7824** |
| **Mumbai** | 109 | **14.33** | **20.04** | **0.7750** |
| **Ahmedabad** | 109 | **19.36** | **28.35** | **0.5884** |
| **Nashik** | 109 | **22.33** | **32.43** | **0.7320** |
| **Nagpur** | 109 | **25.17** | **32.94** | **0.6275** |
| **Kolkata** | 109 | **27.13** | **37.27** | **0.7525** |
| **Chennai** | 109 | **17.24** | **26.97** | **0.3904** |
| **Delhi** | 109 | **42.67** | **55.45** | **0.7819** |

---

## 🖥 Application Modules

1. **Dashboard (`DashboardPage.tsx`)**:
   - City selector driving all panels without manual date-picker input.
   - Dynamic today reference date evaluated automatically in `Asia/Kolkata` timezone.
   - Latest actual observed AQI with observation date and transparent freshness badge.
   - Automated 5-day predictive forecast ribbon (Day 1: Tomorrow through Day 5) with comparative indicators vs. latest actual AQI.
   - 6 criteria pollutant cards with CPCB safety benchmarks.
   - 30-day historical observation trend chart.
   - Clear distinction between observed health guidance and predicted actionable advisories.
2. **Predictive Forecasting (`PredictionPage.tsx`)**:
   - Automated 5-calendar-day forecast starting from tomorrow.
   - Daily forecast cards displaying Date, Horizon Title, Predicted AQI, CPCB Category Badge, 95% Confidence Interval, and Visual Increase/Decrease/Stable indicator vs. latest actual AQI.
   - Seamless Recharts area chart connecting recent observed telemetry to future predictive horizons.
3. **Historical Analysis (`HistoricalPage.tsx`)**:
   - City, Target Month, and Target Year selectors.
   - Monthly summary metrics (Mean, Peak, Lowest, Std Dev, Completeness %).
   - Daily trend area chart with pollutant toggles.
   - CPCB AQI category distribution breakdown.
   - Graceful, informative handling for periods with missing criteria gases (e.g. May 2025).
4. **Atmospheric Pattern Clustering (`ClusteringPage.tsx`)**:
   - Unsupervised $K$-Means clustering ($k \in \{2, 3, 4\}$) evaluated with Silhouette Score.
   - Descriptive profiles derived dynamically from centroids (e.g. Lower pollution pattern, Particulate-dominant pattern, Mixed urban combustion).
   - Clear scientific guardrails explaining pattern similarity without single-source causation claims.
5. **National Hotspots Map (`HotspotMapPage.tsx`)**:
   - Leaflet interactive map of India with custom glowing rank markers for the top 2–3 national hotspots.
   - Complete national ranking table with verified coordinates.

---

## 🚀 Setup & Startup Instructions

### Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Node.js 18+ & npm

### Running the Entire Application
Use the all-in-one launcher in the project root:

```bash
# Using Python
python run.py

# Or on Windows PowerShell
.\run_app.ps1

# Or on Windows Command Prompt
run_app.bat
```

This starts:
- **FastAPI Backend**: `http://127.0.0.1:8000` (API Docs: `http://127.0.0.1:8000/docs`)
- **Vite React Frontend**: `http://localhost:5173`

### Manual Execution (Separate Terminals)

**Terminal 1 (Backend):**
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

### Reproducible Data Preprocessing & Training
To re-run preprocessing or re-train models from scratch:

```bash
# 1. Preprocess raw station observations into daily city dataset
python backend/app/preprocess_data.py

# 2. Train multi-horizon models and generate evaluation metrics
python backend/app/train_models.py

# 3. Run automated backend test suite
python backend/test_all_endpoints.py
```

---

## 📦 Integrated External GitHub Dataset Audit

The external repository `https://github.com/Krishna717-boop/AQI-Forecasting-India.git` was downloaded, inspected, audited, and preserved in `backend/data/external_aqi_dataset/`:

1. **Source Files Preserved**:
   - `backend/data/external_aqi_dataset/data/aqi_daily_data_top6_most_data.csv` (28,694 daily records from 2010 to 2023 across 6 cities).
   - `backend/data/external_aqi_dataset/data/predicted_aqi_top6_2024_2026 (1).csv` (8,226 rows of PatchTST model predictions from 2023 to 2026).
   - Jupyter notebooks (`timseries6 (1).ipynb`, `patchsts (1).ipynb`, `6-city (1).ipynb`).
2. **Key Audit Findings**:
   - **Genuine Observations vs Model Projections**: The external repo's 2024–2026 data consists of deep-learning transformer (PatchTST) forecasts rather than physical monitoring observations.
   - **Empirical Overlap Correlation**: In the overlapping window (Jan–Mar 2023), the external historical measurements show **0.9996 correlation for PM2.5** and **0.9845 correlation for AQI** with our xKDR telemetry.
   - **Active Dataset Selection**: Our primary operational dataset `data/processed/daily_city_air_quality.csv` covers 10 cities (adding Pune, Kolkata, Ahmedabad, Nagpur, Nashik) from 2023 to 2025 and strictly enforces official CPCB NAQI criteria (≥3 pollutants including PM) without artificial imputation.
   - Full audit report: `backend/data/external_aqi_dataset/DATASET_COMPARISON.md`.

---

## 🔒 Data Governance & File Integrity

- **Original CSV Preserved**: `backend/data/india_air_quality_telemetry.csv` and its backup remain completely untouched.
- **Private Secrets**: `AQI_API_KEY` is loaded securely from root `.env` in backend code only and is excluded from Git via `.gitignore`.
- **Model Artifacts**: Pre-trained model bundles are stored in `backend/models_cache/` for instant runtime inference.

