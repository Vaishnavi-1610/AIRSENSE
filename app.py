
import streamlit as st
import requests
import pandas as pd

st.set_page_config(
    page_title="AIRSENSE | Air Quality Analytics",
    page_icon="🌍",
    layout="wide"
)

API = "https://air-quality-prediction-api-mpy3.onrender.com"

@st.cache_data(ttl=60)
def get_data(endpoint):
    r = requests.get(f"{API}/api/{endpoint}", timeout=90)
    r.raise_for_status()
    return r.json()

st.title("🌍 AIRSENSE")
st.caption("AI-Based Air Quality Prediction & Pollution Source Clustering")

page = st.sidebar.radio(
    "Navigation",
    ["Dashboard", "AQI Prediction", "Pollution Alerts", "API Status"]
)

def show_json_page(title, endpoint):
    st.header(title)
    try:
        st.json(get_data(endpoint))
    except Exception as e:
        st.error(f"Could not load data: {e}")

if page == "Dashboard":
    st.header("Air Quality Dashboard")
    try:
        d = get_data("dataset/info")
        stats = d.get("stats", {})
        aqi = stats.get("aqi", {})

        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Total Records", f'{d.get("total_records", 0):,}')
        c2.metric("Cities Covered", d.get("unique_cities_count", 0))
        c3.metric("Average AQI", aqi.get("mean", "N/A"))
        c4.metric("Valid AQI Records", f'{d.get("valid_aqi_records", 0):,}')

        st.subheader("Dataset Overview")
        st.write(
            f"**Period:** {d.get('min_date', 'N/A')} to "
            f"{d.get('max_date', 'N/A')}"
        )
        st.write(f"**Source:** {d.get('provenance', 'N/A')}")

        if stats:
            rows = []
            for name, item in stats.items():
                rows.append({
                    "Pollutant": name.upper(),
                    "Mean": item.get("mean"),
                    "Minimum": item.get("min"),
                    "Maximum": item.get("max"),
                    "Valid Records": item.get("valid_records"),
                    "Coverage (%)": item.get("coverage_pct"),
                    "Unit": item.get("unit")
                })
            st.subheader("Pollutant Statistics")
            st.dataframe(pd.DataFrame(rows), use_container_width=True)

        distribution = d.get("aqi_category_distribution", {})
        if distribution:
            st.subheader("AQI Category Distribution")
            chart_data = pd.DataFrame(
                list(distribution.items()),
                columns=["Category", "Records"]
            ).set_index("Category")
            st.bar_chart(chart_data)

        cities = d.get("cities", [])
        if cities:
            st.subheader("Cities in the Dataset")
            st.write(", ".join(cities))

    except Exception as e:
        st.error(f"Could not load dashboard: {e}")

elif page == "AQI Prediction":
    show_json_page("Daily AQI Prediction", "predict/daily")

elif page == "Pollution Alerts":
    show_json_page("High Pollution Alerts", "alerts/high-pollution")

elif page == "API Status":
    show_json_page("Backend Health", "health")
