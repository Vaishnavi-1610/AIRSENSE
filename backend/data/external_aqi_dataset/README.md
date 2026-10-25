# Air Quality Index (AQI) Forecasting for Major Indian Cities (2010–2026)

## Overview
This project predicts future Air Quality Index (AQI) levels for six major Indian cities using historical pollutant data and a transformer-based deep learning model (PatchTST).

## Project Workflow
1. **Data Construction** – Unified 14M+ records (2010–2023) from CPCB datasets.
2. **City Selection** – Filtered top 6 cities with continuous data (Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad).
3. **Data Preparation** – Cleaned, interpolated, and aggregated to daily pollutant averages.
4. **Modeling** – Applied PatchTST for multi-year AQI prediction (2024–2026).
5. **Visualization** – Interactive HTML dashboard for forecast exploration.

## Repository Structure
- `/notebooks/` – All Jupyter notebooks for data processing and modeling.
- `/data/` – Unified, filtered, and predicted datasets.
- `/dashboard/` – Web interface to visualize forecasted AQI.
- `/reports/` – Presentation slides and analytical summaries.

## Results
- Model: PatchTST Transformer
- Test RMSE (2023): 10–15 AQI units
- Forecast range: 2024–2026
- AQI categories preserved: Moderate (62%), Poor (24%), Very Poor (8.6%), Severe (1.5%)

## Tech Stack
- Python (Pandas, NumPy, PyTorch, Darts, Matplotlib)
- Tailwind CSS + PapaParse + JavaScript (for dashboard)
- Kaggle GPU (T4, 16GB)

## Usage
Clone and explore:
```bash
git clone https://github.com/Krishna717-boop/AQI-Forecasting-India.git
cd AQI-Forecasting-India
pip install -r requirements.txt
