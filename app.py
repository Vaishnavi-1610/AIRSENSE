import streamlit as st
import requests

st.set_page_config(page_title="AIRSENSE", layout="wide")
st.title("🌍 AIRSENSE")
st.subheader("Air Quality Prediction and Pollution Monitoring")

API_URL = "https://air-quality-prediction-api-mpy3.onrender.com"

if st.button("Check backend connection"):
    try:
        response = requests.get(f"{API_URL}/docs", timeout=30)
        if response.status_code == 200:
            st.success("Backend is reachable!")
        else:
            st.warning(f"Backend returned status: {response.status_code}")
    except requests.RequestException as e:
        st.error(f"Connection failed: {e}")

st.info("This is the initial Streamlit interface. Prediction and clustering features still need to be connected.")
