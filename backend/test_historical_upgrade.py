import sys
import io
import requests

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
BASE_URL = "http://127.0.0.1:8000/api"

print("--- Testing /api/historical/metadata ---")
r = requests.get(f"{BASE_URL}/historical/metadata", params={"city": "Delhi"})
assert r.status_code == 200, f"Metadata failed: {r.status_code} {r.text}"
meta = r.json()
print("Selected city:", meta["selected_city"])
print("Available years:", meta["available_years"][:3], "...", meta["available_years"][-3:])
print("Years info 2010:", meta["years_info"]["2010"])
print("Years info 2025:", meta["years_info"]["2025"])

print("\n--- Testing /api/historical/calendar ---")
# 1. 2010 calendar for Delhi
r = requests.get(f"{BASE_URL}/historical/calendar", params={"city": "Delhi", "year": 2010, "month": 1})
assert r.status_code == 200, f"Calendar failed: {r.status_code} {r.text}"
cal_2010 = r.json()
print("Delhi Jan 2010: days_in_month =", cal_2010["days_in_month"], "mean_aqi =", cal_2010["mean_aqi"])
print("Delhi Jan 2010 Day 1:", cal_2010["calendar_days"][0])

# 2. 2025 May calendar for Pune (partial data / data pending)
r = requests.get(f"{BASE_URL}/historical/calendar", params={"city": "Pune", "year": 2025, "month": 5})
assert r.status_code == 200, f"Calendar 2025 failed: {r.status_code} {r.text}"
cal_2025 = r.json()
print("Pune May 2025: is_partial_month =", cal_2025["is_partial_month"])
print("Pune May 2025 Day 1 status =", cal_2025["calendar_days"][0]["status"], "category =", cal_2025["calendar_days"][0]["category"])

print("\n--- Testing /api/historical/monthly ---")
r = requests.get(f"{BASE_URL}/historical/monthly", params={"city": "Delhi", "year": 2024, "compare_years": "2023,2019"})
assert r.status_code == 200, f"Monthly failed: {r.status_code} {r.text}"
m_data = r.json()
print("Delhi 2024 monthly points count:", len(m_data["monthly_data"]))
print("Delhi 2024 best month:", m_data["best_month"])
print("Delhi 2024 comparisons keys:", list(m_data["comparisons"].keys()))

print("\n--- Testing /api/historical/yearly ---")
r = requests.get(f"{BASE_URL}/historical/yearly", params={"city": "Delhi", "pollutant": "aqi"})
assert r.status_code == 200, f"Yearly failed: {r.status_code} {r.text}"
y_data = r.json()
print("Delhi yearly records count:", len(y_data["yearly_records"]))
print("Delhi cleanest year:", y_data["cleanest_year"]["year"], "mean_aqi =", y_data["cleanest_year"]["mean_aqi"])
print("Delhi worst year:", y_data["worst_year"]["year"], "mean_aqi =", y_data["worst_year"]["mean_aqi"])

print("\n--- Testing /api/historical/table ---")
r = requests.get(f"{BASE_URL}/historical/table", params={"city": "Delhi", "year": 2024, "month": 5, "page": 1, "page_size": 10})
assert r.status_code == 200, f"Table failed: {r.status_code} {r.text}"
t_data = r.json()
print("Delhi May 2024 table: total_records =", t_data["total_records"], "total_pages =", t_data["total_pages"], "records len =", len(t_data["records"]))

print("\n--- Testing backwards-compatible /api/historical/analyze ---")
r = requests.get(f"{BASE_URL}/historical/analyze", params={"city": "Delhi", "year": 2012, "month": 1})
assert r.status_code == 200, f"Analyze failed: {r.status_code} {r.text}"
old_data = r.json()
print("Delhi Jan 2012 /api/historical/analyze available =", old_data["available"], "mean_aqi =", old_data["stats"]["mean_aqi"])

print("\nALL HISTORICAL ENDPOINTS VERIFIED AND PASSING!")
