
import streamlit as st
import requests
import pandas as pd

st.set_page_config(page_title="AIRSENSE", layout="wide")

API = "https://air-quality-prediction-api-mpy3.onrender.com"

st.title("🌍 AIRSENSE")
st.subheader("AI-Based Air Quality Prediction & Pollution Monitoring")

@st.cache_data(ttl=60)
def get_data(endpoint, params=None):
    response = requests.get(
        f"{API}/api/{endpoint}",
        params=params,
        timeout=90
    )
    response.raise_for_status()
    return response.json()

page = st.sidebar.radio(
    "Navigation",
    ["Dashboard", "AQI Prediction", "Pollution Alerts", "API Status"]
)

if page == "API Status":
    try:
        data = get_data("health")
        st.success("Backend connected")
        st.json(data)
    except Exception as e:
        st.error(f"Backend error: {e}")

elif page == "Dashboard":
    st.header("Air Quality Dashboard")
    try:
        data = get_data("dataset/info")
        st.json(data)
    except Exception as e:
        st.error(f"Could not load dashboard data: {e}")

elif page == "AQI Prediction":
    st.header("Daily Air Quality Prediction")
    try:
        data = get_data("predict/daily")
        st.json(data)
    except Exception as e:
        st.error(f"Prediction request failed: {e}")

elif page == "Pollution Alerts":
    st.header("High Pollution Alerts")
    try:
        data = get_data("alerts/high-pollution")
        st.json(data)
    except Exception as e:
        st.error(f"Could not load alerts: {e}")
