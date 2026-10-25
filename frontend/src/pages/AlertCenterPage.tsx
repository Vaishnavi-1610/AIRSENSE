import React, { useState, useEffect } from 'react';
import {
  Bell,
  ShieldAlert,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  SlidersHorizontal,
  Info,
  Sparkles,
  Activity,
  HeartPulse,
  Users,
  Building
} from 'lucide-react';
import { DashboardCityData, DailyForecastResponse, HighPollutionAlert } from '../types';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AQIBadge } from '../components/AQIBadge';

interface AlertCenterPageProps {
  availableCities: string[];
  initialCity?: string;
  selectedCity?: string;
  onSelectCity?: (city: string) => void;
  isDark?: boolean;
}

export const AlertCenterPage: React.FC<AlertCenterPageProps> = ({
  availableCities,
  initialCity = 'Pune',
  selectedCity: propCity,
  onSelectCity,
  isDark = false,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>(propCity || initialCity);
  const [data, setData] = useState<DashboardCityData | null>(null);
  const [forecastData, setForecastData] = useState<DailyForecastResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Configurable CPCB NAQI threshold (default 200: Poor / Unhealthy)
  const [threshold, setThreshold] = useState<number>(200);

  // Alert acknowledgement persisted in localStorage
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('acknowledged_pollution_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleAcknowledgeAlert = (id: string) => {
    setAcknowledgedAlertIds((prev) => {
      const updated = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem('acknowledged_pollution_alerts', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  useEffect(() => {
    if (propCity && propCity !== selectedCity) {
      setSelectedCity(propCity);
    }
  }, [propCity]);

  const fetchAlertsData = async (city: string) => {
    try {
      setLoading(true);
      setError(null);
      const [cityRes, forecastRes] = await Promise.all([
        api.getDashboardCityData({ city }),
        api.getDailyPrediction({ city, days: 5 }),
      ]);
      setData(cityRes);
      setForecastData(forecastRes);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load alert telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertsData(selectedCity);
  }, [selectedCity]);

  // Evaluate alerts dynamically based on genuine observations & forecast data
  const alertsList = React.useMemo(() => {
    if (!data) return [];

    const items: HighPollutionAlert[] = [];
    const seen = new Set<string>();

    // 1. Current Pollution Alert (from genuine measured observation)
    const latestObsAqi = data.latest_record?.aqi;
    const latestObsDate = data.latest_record?.display_date || data.latest_record?.date;
    if (latestObsAqi !== null && latestObsAqi !== undefined && latestObsAqi >= threshold) {
      const id = `current-${selectedCity.toLowerCase()}-${latestObsDate}`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          city: selectedCity,
          alert_type: 'current',
          alert_type_label: 'Current Pollution Alert (Measured Telemetry)',
          severity: data.latest_record.category,
          color: data.latest_record.color,
          badge: data.latest_record.badge,
          aqi_value: latestObsAqi,
          is_prediction: false,
          timestamp: `${latestObsDate} (Physical CAAQM Measurement)`,
          expected_impact: 'Active / Currently Observed',
          status: 'Active',
          headline: `Unhealthy Air Quality Measured in ${selectedCity}`,
          description: `Verified physical telemetry recorded an AQI of ${latestObsAqi} (${data.latest_record.category}), crossing the configured health threshold of ${threshold} CPCB points.`,
          precautions: [
            'Sensitive individuals (children, asthmatics, elderly) should avoid prolonged outdoor physical exertion.',
            'Wear a well-fitting N95 respirator mask near heavy traffic or construction zones.',
            'Keep windows closed and utilize indoor air filtration if available.',
            'Avoid morning or late-evening outdoor workouts when ground-level temperature inversions trap pollutants.'
          ]
        });
      }
    }

    // 2. Forecast Pollution Alert - Today's Model Prediction
    const todayPredAqi = data.today_predicted_aqi ?? data.today_prediction?.predicted_aqi;
    const todayPredCat = data.today_predicted_category || data.today_prediction?.category || 'Moderate';
    const todayPredDate = data.today_predicted_date_formatted || data.today_formatted || 'Today';
    if (todayPredAqi !== null && todayPredAqi !== undefined && todayPredAqi >= threshold) {
      const id = `forecast-${selectedCity.toLowerCase()}-${todayPredDate}`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          city: selectedCity,
          alert_type: 'forecast',
          alert_type_label: 'Forecast Pollution Alert (Today)',
          severity: todayPredCat,
          color: data.today_predicted_color || '#ea580c',
          badge: data.today_predicted_badge || '',
          aqi_value: todayPredAqi,
          is_prediction: true,
          timestamp: `Issued for Today (${todayPredDate})`,
          expected_impact: `Today (${todayPredDate})`,
          status: 'Active',
          headline: `High Pollution Forecast for Today in ${selectedCity}`,
          description: `Our machine learning model forecasts an elevated AQI of ${todayPredAqi} (${todayPredCat}) for today, exceeding the ${threshold} CPCB threshold.`,
          precautions: [
            'Plan essential outdoor physical activities during lower traffic hours (midday).',
            'Vulnerable demographic groups should reduce heavy outdoor exercise.',
            'Consider closed ventilation and localized indoor air purification.'
          ]
        });
      }
    }

    // 3. Forecast Pollution Alert - Upcoming 5-day horizon steps
    if (forecastData?.forecast) {
      for (const step of forecastData.forecast) {
        if (step.predicted_aqi >= threshold) {
          const id = `forecast-${selectedCity.toLowerCase()}-${step.date}`;
          if (!seen.has(id)) {
            seen.add(id);
            items.push({
              id,
              city: selectedCity,
              alert_type: 'forecast',
              alert_type_label: 'Forecast Pollution Alert (Multi-Horizon)',
              severity: step.category,
              color: step.color,
              badge: step.badge,
              aqi_value: step.predicted_aqi,
              is_prediction: true,
              timestamp: 'Multi-Horizon Model Outlook',
              expected_impact: `${step.horizon_title || `Day ${step.step}`} (${step.date_formatted || step.date})`,
              status: 'Active',
              headline: `Elevated Pollution Expected on ${step.date_formatted || step.date} in ${selectedCity}`,
              description: `Model forecast projects an AQI of ${step.predicted_aqi} (${step.category}) on ${step.date_formatted || step.date}.`,
              precautions: [
                'Anticipate unhealthy air quality on this upcoming forecast date.',
                'Reschedule strenuous outdoor sports or heavy physical events where practical.',
                'Monitor real-time updates as the forecast target date approaches.'
              ]
            });
          }
        }
      }
    }

    return items;
  }, [data, forecastData, selectedCity, threshold]);

  const activeAlertsCount = alertsList.filter((a) => !acknowledgedAlertIds.includes(a.id)).length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header & City Selection Bar */}
      <div className="card-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <h3 className="text-base font-bold text-navy-900 dark:text-slate-100">
                Alerts & Recommendations Center
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Active environmental threshold warnings, observed vs. forecast alerts, and public-health precautions
            </p>
          </div>

          {/* Threshold Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start lg:self-auto border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 px-2 uppercase tracking-wider font-bold flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-slate-400" /> Trigger Threshold:
            </span>
            {[
              { val: 200, label: 'AQI 200 (Poor / Unhealthy)' },
              { val: 300, label: 'AQI 300 (Very Poor)' },
              { val: 100, label: 'AQI 100 (Moderate)' },
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => setThreshold(opt.val)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  threshold === opt.val
                    ? 'bg-amber-500 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* City Filter & Reference Dates Bar */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
              <Search className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Target Indian City:
            </label>
            <select
              value={selectedCity}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCity(val);
                onSelectCity?.(val);
              }}
              className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[200px]"
            >
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  {c} (Active CPCB Telemetry)
                </option>
              ))}
            </select>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <span>
              Evaluation Date: <strong className="text-navy-900 dark:text-slate-100">{data?.today_formatted || 'Current Date'}</strong>
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>
              Threshold Standard: <strong className="text-amber-700 dark:text-amber-400">CPCB NAQI ({threshold} pts)</strong>
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card-panel my-8 p-12">
          <LoadingSpinner message={`Scanning telemetry alerts and recommendations for ${selectedCity}...`} />
        </div>
      ) : error ? (
        <div className="card-panel p-6 text-center text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
          <h4 className="text-sm font-bold">Error loading alert data</h4>
          <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{error}</p>
        </div>
      ) : (
        <>
          {/* Active Alerts Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Active Alerts ({selectedCity})
                </h4>
                {activeAlertsCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                    {activeAlertsCount} ACTIVE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    ALL CLEAR
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {alertsList.length} alert event(s) detected
              </span>
            </div>

            {alertsList.length === 0 ? (
              <div className="card-panel p-8 text-center bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50">
                <ShieldCheck className="w-10 h-10 mx-auto mb-3 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">
                  No active alerts for this city.
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  Measured and forecast AQI levels for <strong>{selectedCity}</strong> remain below the configured threshold of {threshold} CPCB points.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {alertsList.map((alert) => {
                  const isAcknowledged = acknowledgedAlertIds.includes(alert.id);
                  const isCurrent = alert.alert_type === 'current';
                  return (
                    <div
                      key={alert.id}
                      className={`card-panel p-5 border-l-4 transition-all ${
                        isAcknowledged
                          ? 'border-l-slate-400 opacity-75'
                          : isCurrent
                          ? 'border-l-rose-600 shadow-sm'
                          : 'border-l-amber-500 shadow-sm'
                      }`}
                    >
                      {/* Top bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              isCurrent
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            }`}
                          >
                            {alert.alert_type_label}
                          </span>

                          <AQIBadge category={alert.severity} size="sm" />

                          <span className="text-xs font-black text-navy-900 dark:text-slate-100">
                            AQI {alert.aqi_value}
                          </span>

                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            • Target: <strong className="text-slate-700 dark:text-slate-300">{alert.expected_impact}</strong>
                          </span>
                        </div>

                        {/* Status Toggle Button */}
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isAcknowledged
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                : 'bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200'
                            }`}
                          >
                            {isAcknowledged ? 'Acknowledged' : 'Active'}
                          </span>
                          <button
                            onClick={() => toggleAcknowledgeAlert(alert.id)}
                            className={`text-[11px] font-bold px-3 py-1 rounded-lg border transition-all ${
                              isAcknowledged
                                ? 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                                : 'border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-amber-900 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950 shadow-2xs'
                            }`}
                          >
                            {isAcknowledged ? 'Mark as Active' : 'Acknowledge Alert'}
                          </button>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="mt-3 text-xs">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100 mb-1">
                              {alert.headline}
                            </h4>
                            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-xs mb-3">
                              {alert.description}
                            </p>
                          </div>
                        </div>

                        {/* Precautionary Recommendations */}
                        {alert.precautions && alert.precautions.length > 0 && (
                          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-2 flex items-center gap-1.5">
                              <HeartPulse className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                              Required Public Health Precautions:
                            </span>
                            <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-200">
                              {alert.precautions.map((p, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 mt-1.5 shrink-0" />
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mt-3 text-[10.5px] text-slate-400 flex items-center justify-between">
                          <span>Timestamp: {alert.timestamp}</span>
                          <span>Affected Jurisdiction: {alert.city}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* City-Specific Health Advisory Matrix */}
          <div className="card-panel p-6 border-t-4 border-t-teal-600 dark:border-t-teal-500">
            <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Standard CPCB Air Quality Health Guidance Matrix
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Official Central Pollution Control Board (CPCB) precautionary thresholds and population vulnerability guidelines
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 mb-1">
                  <Users className="w-4 h-4 text-amber-600" />
                  Sensitive Demographic Groups
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
                  Children, older adults, and individuals with respiratory conditions (asthma, COPD) or cardiovascular conditions should limit prolonged outdoor exertion whenever AQI exceeds 100.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 mb-1">
                  <HeartPulse className="w-4 h-4 text-rose-600" />
                  General Population Health
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
                  When AQI crosses 200 (Poor), even healthy individuals may experience breathing discomfort and eye irritation on prolonged exposure. Outdoor strenuous sports should be reduced.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 mb-1">
                  <Building className="w-4 h-4 text-teal-600" />
                  Indoor Air Quality & Ventilation
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
                  During high-pollution alert days, keep doors and windows closed during early mornings and rush hours. Run HEPA filtration if available and avoid burning biomass or incense.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
