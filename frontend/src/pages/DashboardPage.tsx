import React, { useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Activity,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  ChevronRight,
  Layers,
  Clock,
  Sparkles,
  GitCompare,
  Leaf,
  Users,
  Bell,
  SlidersHorizontal,
  Calendar,
  Sun,
  Compass
} from 'lucide-react';
import { DashboardCityData, DailyForecastResponse, ClusteringResponse, NavTab, HighPollutionAlert } from '../types';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AQIBadge } from '../components/AQIBadge';

interface DashboardPageProps {
  availableCities: string[];
  initialCity?: string;
  selectedCity?: string;
  onSelectCity?: (city: string) => void;
  onNavigate: (tab: NavTab) => void;
  isDark?: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  availableCities,
  initialCity = 'Pune',
  selectedCity: propCity,
  onSelectCity,
  onNavigate,
  isDark = false,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>(propCity || initialCity);
  const [data, setData] = useState<DashboardCityData | null>(null);
  const [forecastPreview, setForecastPreview] = useState<DailyForecastResponse | null>(null);
  const [clusteringPreview, setClusteringPreview] = useState<ClusteringResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Local Alert Acknowledgement State (synchronized with Alert Center)
  const [acknowledgedAlertIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('acknowledged_pollution_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (propCity && propCity !== selectedCity) {
      setSelectedCity(propCity);
    }
  }, [propCity]);

  const fetchDashboardData = async (city: string) => {
    try {
      setLoading(true);
      setError(null);
      const [cityRes, forecastRes, clusterRes] = await Promise.all([
        api.getDashboardCityData({ city }),
        api.getDailyPrediction({ city, days: 5 }),
        api.getClusteringAnalysis({ city })
      ]);
      setData(cityRes);
      setForecastPreview(forecastRes);
      setClusteringPreview(clusterRes);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load dashboard telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedCity);
  }, [selectedCity]);

  // Find dominant cluster profile for selected city
  const cityClusterProfile = React.useMemo(() => {
    if (!clusteringPreview || !clusteringPreview.selected_city_distribution?.length) return null;
    const sorted = [...clusteringPreview.selected_city_distribution].sort((a, b) => b.percentage - a.percentage);
    return sorted[0];
  }, [clusteringPreview]);

  // 1. Extract Today's ML-predicted AQI values (evaluated strictly for today_date)
  const todayPred = data?.today_prediction || forecastPreview?.today_prediction;
  const todayPredictedAqi = data?.today_predicted_aqi ?? todayPred?.predicted_aqi ?? null;
  const todayPredictedCategory = data?.today_predicted_category || todayPred?.category || 'Moderate';
  const todayPredictedColor = data?.today_predicted_color || todayPred?.color || '#0d9488';
  const todayDateFormatted = data?.today_predicted_date_formatted || todayPred?.date_formatted || data?.today_formatted || data?.today_date || 'Today';
  const todayDisplayLabel = data?.today_predicted_display_label || todayPred?.display_label || 'Today';
  const todayConfidenceInterval = data?.today_predicted_confidence_interval || todayPred?.confidence_interval;
  const todayHealthAdvisory = data?.today_predicted_health_advisory || todayPred?.health_advisory;

  // 2. "Best Time to Go Outdoors" Recommendation Logic
  // Daily model: Time-specific forecasts (hourly/morning/evening) are not available.
  // Recommendations are supported by today's predicted AQI and diurnal atmospheric dispersion principles.
  const outdoorRecommendation = React.useMemo(() => {
    if (todayPredictedAqi === null || todayPredictedAqi === undefined) {
      return null;
    }

    const aqi = todayPredictedAqi;
    let timeSlot = '';
    let categoryTitle = todayPredictedCategory;
    let explanation = '';
    let activityGuidance = '';
    let warning: string | null = null;
    let statusTone: 'optimal' | 'good' | 'caution' | 'warning' | 'danger' = 'good';

    if (aqi <= 50) {
      statusTone = 'optimal';
      timeSlot = 'Anytime Today (Optimal All Day)';
      activityGuidance = 'Ideal for running, sports, walking, cycling, and open-air activities.';
      explanation = 'Air quality is predicted to remain in the Good category. Particulate and gaseous pollutants pose minimal to no health risk.';
    } else if (aqi <= 100) {
      statusTone = 'good';
      timeSlot = 'Morning or Late Afternoon (Favorable)';
      activityGuidance = 'Safe for standard outdoor exercises, work, and community activities.';
      explanation = 'Predicted air quality is Satisfactory. Sensitive individuals may take brief rests during intense physical exertion.';
    } else if (aqi <= 200) {
      statusTone = 'caution';
      timeSlot = 'Mid-Day to Early Afternoon (11:00 AM – 3:30 PM)';
      activityGuidance = 'Moderate outdoor exposure; avoid heavy endurance running or high-intensity workouts.';
      explanation = 'In typical urban environments, cold morning ground inversions trap particulate matter, and evening rush-hour traffic creates secondary spikes. Warmer mid-day hours offer improved atmospheric convective dispersion.';
      warning = 'AQI is in the Moderate category. Children, elderly citizens, and individuals with respiratory sensitivities should moderate prolonged outdoor exposure.';
    } else if (aqi <= 300) {
      statusTone = 'warning';
      timeSlot = 'Brief Mid-Day Exposure Only (12:00 PM – 2:30 PM)';
      activityGuidance = 'Limit outdoor presence; avoid strenuous physical exertion outdoors.';
      explanation = 'Predicted air quality is in the Poor category. Ground-level emissions and calm winds limit dilution. If outdoor errands are unavoidable, mid-day provides relatively higher dispersion than morning or evening inversion hours.';
      warning = `⚠️ Health Warning: Today's predicted AQI is ${aqi} (Poor). Sensitive groups should reduce prolonged outdoor exertion. Wear an N95 respirator mask near vehicular corridors.`;
    } else if (aqi <= 400) {
      statusTone = 'danger';
      timeSlot = 'Stay Indoors / Minimal Transit Only';
      activityGuidance = 'Outdoor sports, jogging, and strenuous outdoor tasks should be avoided entirely.';
      explanation = 'High particulate accumulation forecast across the city. Stagnant atmospheric conditions trap pollutants throughout the day.';
      warning = `🚨 Very Poor Air Quality Warning: Predicted AQI of ${aqi} can trigger acute respiratory discomfort. Keep outdoor exposure to essential travel only and wear protective masks.`;
    } else {
      statusTone = 'danger';
      timeSlot = 'Remain Indoors (Hazardous Conditions)';
      activityGuidance = 'All outdoor physical activities are strongly discouraged.';
      explanation = 'Severe pollution conditions predicted. Atmospheric ventilation is severely constrained with dense particulate presence.';
      warning = `🚨 Emergency Alert: Severe air pollution (${aqi} AQI) predicted. Keep windows closed, operate indoor air filtration, and avoid all unnecessary outdoor movement.`;
    }

    // Check if upcoming 5 days show a rising trajectory
    let riseWarning: string | null = null;
    if (forecastPreview?.forecast?.length) {
      const tomorrow = forecastPreview.forecast[0];
      const maxUpcoming = Math.max(...forecastPreview.forecast.map(s => s.predicted_aqi));
      if (tomorrow && tomorrow.predicted_aqi > aqi + 15) {
        riseWarning = `Pollution is expected to rise further to ${tomorrow.predicted_aqi} (${tomorrow.category}) tomorrow in ${selectedCity}. If you have necessary outdoor commitments, prioritize them during the recommended window today before conditions worsen.`;
      } else if (maxUpcoming > aqi + 25 && maxUpcoming >= 200) {
        riseWarning = `Air quality is projected to worsen over the coming 5 days (reaching up to ${maxUpcoming} AQI). Plan and minimize outdoor exertion accordingly.`;
      }
    }

    return {
      aqi,
      category: categoryTitle,
      timeSlot,
      activityGuidance,
      explanation,
      warning,
      riseWarning,
      statusTone,
    };
  }, [todayPredictedAqi, todayPredictedCategory, forecastPreview, selectedCity]);

  // 3. Detect & evaluate High Pollution Alerts (Default threshold 200 CPCB points)
  const alertsList = React.useMemo(() => {
    if (data?.alerts?.alerts) {
      return data.alerts.alerts;
    }

    const items: HighPollutionAlert[] = [];
    const seen = new Set<string>();

    // Current measured observation (Current Pollution Alert)
    const latestObsAqi = data?.latest_record?.aqi;
    const latestObsDate = data?.latest_record?.display_date || data?.latest_record?.date;
    if (latestObsAqi !== null && latestObsAqi !== undefined && latestObsAqi >= 200) {
      const id = `current-${selectedCity.toLowerCase()}-${latestObsDate}`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          city: selectedCity,
          alert_type: 'current',
          alert_type_label: 'Current Pollution Alert',
          severity: data.latest_record.category,
          color: data.latest_record.color,
          badge: data.latest_record.badge,
          aqi_value: latestObsAqi,
          is_prediction: false,
          timestamp: `${latestObsDate} (Physical Observation)`,
          expected_impact: 'Active / Observed',
          status: 'Active',
          headline: `Unhealthy Air Quality Measured in ${selectedCity}`,
          description: `Observed AQI of ${latestObsAqi} (${data.latest_record.category}) crosses the health threshold of 200 CPCB points.`,
          precautions: [
            'Sensitive individuals (children, elderly, asthmatics) should avoid prolonged outdoor exertion.',
            'Wear an N95 respirator mask near heavy traffic or construction corridors.',
            'Keep windows closed and utilize indoor air filtration if available.'
          ]
        });
      }
    }

    // Today's predicted AQI (Forecast Pollution Alert - Today)
    if (todayPredictedAqi !== null && todayPredictedAqi !== undefined && todayPredictedAqi >= 200) {
      const id = `forecast-${selectedCity.toLowerCase()}-${todayDateFormatted}`;
      if (!seen.has(id)) {
        seen.add(id);
        items.push({
          id,
          city: selectedCity,
          alert_type: 'forecast',
          alert_type_label: 'Forecast Pollution Alert',
          severity: todayPredictedCategory,
          color: todayPredictedColor,
          badge: todayPred?.badge || '',
          aqi_value: todayPredictedAqi,
          is_prediction: true,
          timestamp: `Issued for Today (${todayDateFormatted})`,
          expected_impact: `Today (${todayDateFormatted})`,
          status: 'Active',
          headline: `High Pollution Forecast for Today in ${selectedCity}`,
          description: `Our predictive model forecasts an AQI of ${todayPredictedAqi} (${todayPredictedCategory}) for today.`,
          precautions: [
            'Plan outdoor physical activities during lower traffic hours.',
            'Vulnerable groups should reduce heavy outdoor exercise today.',
            'Consider indoor air filtration and protective masks.'
          ]
        });
      }
    }

    // Upcoming forecast days in the 5-day horizon
    if (forecastPreview?.forecast) {
      for (const step of forecastPreview.forecast) {
        if (step.predicted_aqi >= 200) {
          const id = `forecast-${selectedCity.toLowerCase()}-${step.date}`;
          if (!seen.has(id)) {
            seen.add(id);
            items.push({
              id,
              city: selectedCity,
              alert_type: 'forecast',
              alert_type_label: 'Forecast Pollution Alert',
              severity: step.category,
              color: step.color,
              badge: step.badge,
              aqi_value: step.predicted_aqi,
              is_prediction: true,
              timestamp: 'Multi-Horizon Model Outlook',
              expected_impact: `${step.horizon_title || `Day ${step.step}`} (${step.date_formatted || step.date})`,
              status: 'Active',
              headline: `Elevated Pollution Expected on ${step.date_formatted || step.date} in ${selectedCity}`,
              description: `Model forecast predicts AQI of ${step.predicted_aqi} (${step.category}) on ${step.date_formatted || step.date}.`,
              precautions: [
                'Anticipate unhealthy air quality on this upcoming forecast date.',
                'Reschedule strenuous outdoor sports or events if feasible.'
              ]
            });
          }
        }
      }
    }

    return items;
  }, [data, forecastPreview, selectedCity, todayPredictedAqi, todayPredictedCategory, todayPredictedColor, todayDateFormatted, todayPred]);


  const activeAlertsCount = alertsList.filter(a => !acknowledgedAlertIds.includes(a.id)).length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header & City Selection Bar */}
      <div className="card-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="text-base font-bold text-navy-900 dark:text-slate-100">
                Smart City Air Quality Forecasting Dashboard
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              ML-driven multi-horizon AQI predictions, CPCB NAQI evaluation, and historical telemetry patterns
            </p>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex items-center gap-2 self-start lg:self-auto text-xs font-semibold flex-wrap">
            <button
              onClick={() => onNavigate('prediction')}
              className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900 flex items-center gap-1.5 transition-all"
            >
              <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Full 5-Day Forecast</span>
              <ChevronRight className="w-3 h-3" />
            </button>
            <button
              onClick={() => onNavigate('live_vs_pred')}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 flex items-center gap-1.5 transition-all"
            >
              <GitCompare className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Live vs Prediction</span>
              <ChevronRight className="w-3 h-3" />
            </button>
            <button
              onClick={() => onNavigate('analysis')}
              className="px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-all"
            >
              <span>Pollution Analysis</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* City Selector & Status Bar */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Target Indian City
            </label>
            <select
              value={selectedCity}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCity(val);
                onSelectCity?.(val);
              }}
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-2xs"
            >
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  {c} (Active CPCB Telemetry)
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Date & Forecast Target Status Pill */}
          {data && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block flex items-center gap-1">
                  <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" /> Today's Date (IST)
                </span>
                <strong className="text-navy-900 dark:text-slate-100 font-bold">{data.today_formatted || data.today_date}</strong>
              </div>
              <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Forecast Target</span>
                <strong className="text-teal-900 dark:text-teal-300 font-bold">{todayDateFormatted}</strong>
              </div>
              <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 block">Model Status</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Active Multi-Horizon
                </strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card-panel my-8 p-12">
          <LoadingSpinner message={`Loading forecast data for ${selectedCity}...`} />
        </div>
      ) : error ? (
        <div className="card-panel p-6 text-center text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
          <h4 className="text-sm font-bold">Error loading city data</h4>
          <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{error}</p>
        </div>
      ) : data ? (
        <>
          {/* Primary: Today's Predicted AQI Hero Banner */}
          <div className="card-panel p-6 border-l-4 border-l-teal-600 dark:border-l-teal-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Today's Predicted AQI ({selectedCity})
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                    Model Prediction
                  </span>
                </div>

                {todayPredictedAqi !== null && todayPredictedAqi !== undefined ? (
                  <div className="flex items-baseline gap-4 my-2">
                    <span className="text-6xl font-black text-navy-900 dark:text-slate-100">
                      {todayPredictedAqi}
                    </span>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-400 block">CPCB Index (Today's Forecast)</span>
                      <AQIBadge
                        category={todayPredictedCategory}
                        size="md"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="my-3 p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 inline mr-1 text-amber-600" />
                    Today's AQI prediction is currently unavailable for {selectedCity}.
                  </div>
                )}
              </div>

              {/* Forecast Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:border-l lg:border-slate-200 dark:lg:border-slate-700 lg:pl-6 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Forecast Horizon</span>
                  <strong className="text-teal-900 dark:text-teal-300 font-bold text-sm block">Today</strong>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{todayDateFormatted}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">95% Expected Range</span>
                  <strong className="text-slate-800 dark:text-slate-200 font-bold text-sm block">
                    {todayConfidenceInterval ? `[${todayConfidenceInterval.lower} – ${todayConfidenceInterval.upper}]` : '± 10% Margin'}
                  </strong>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Multi-Horizon Quantile</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Selected City</span>
                  <strong className="text-navy-900 dark:text-slate-100 font-bold text-sm block">{selectedCity}</strong>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Active CPCB Telemetry</div>
                </div>
              </div>
            </div>

            {todayHealthAdvisory && (
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                <span>{todayHealthAdvisory}</span>
              </div>
            )}
          </div>

          {/* Temporarily hidden for hackathon: "Best Time to Go Outdoors" Recommendation Card
          {outdoorRecommendation && (
            <div className={`card-panel p-6 border-l-4 ${
              outdoorRecommendation.statusTone === 'optimal' || outdoorRecommendation.statusTone === 'good'
                ? 'border-l-emerald-500'
                : outdoorRecommendation.statusTone === 'caution'
                ? 'border-l-amber-500'
                : 'border-l-rose-500'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl border ${
                    outdoorRecommendation.statusTone === 'optimal' || outdoorRecommendation.statusTone === 'good'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                      : outdoorRecommendation.statusTone === 'caution'
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                      : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                  }`}>
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-navy-900 dark:text-slate-100">
                        Best Time to Go Outdoors
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {selectedCity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Personalized outdoor activity guidance based on predicted air quality and meteorological ventilation
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Predicted AQI:</span>
                  <span className="text-lg font-black text-navy-900 dark:text-slate-100">{outdoorRecommendation.aqi}</span>
                  <AQIBadge category={outdoorRecommendation.category} size="sm" />
                </div>
              </div>

              <div className="p-3 mb-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200">Forecast Data Notice: </span>
                  <span>
                    Time-specific AQI forecasts are not available from our daily prediction model. Recommendations are based on today's predicted daily AQI ({outdoorRecommendation.aqi}) and standard diurnal atmospheric dispersion guidelines.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    Recommended Time Slot
                  </div>
                  <div className="text-sm font-bold text-teal-800 dark:text-teal-300 mt-0.5">
                    {outdoorRecommendation.timeSlot}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    {outdoorRecommendation.activityGuidance}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                  <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    Why This Recommendation?
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {outdoorRecommendation.explanation}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {outdoorRecommendation.warning && (
                  <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{outdoorRecommendation.warning}</p>
                  </div>
                )}

                {outdoorRecommendation.riseWarning && (
                  <div className="p-3 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
                    <TrendingUp className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="font-bold">Rising Pollution Alert: </strong>
                      {outdoorRecommendation.riseWarning}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          */}

          {/* Temporarily hidden for hackathon: Alert Center Shortcut Strip
          <div className="card-panel p-5 border-t-4 border-t-amber-500 dark:border-t-amber-600">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  activeAlertsCount > 0
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                }`}>
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">
                      Alerts & Recommendations Center
                    </h4>
                    {activeAlertsCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse">
                        {activeAlertsCount} ACTIVE ALERT{activeAlertsCount > 1 ? 'S' : ''}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        NORMAL
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {activeAlertsCount > 0
                      ? `${activeAlertsCount} active pollution warning(s) detected for ${selectedCity}. Detailed health precautions and alert status available in the Alert Center.`
                      : `No active high-pollution warnings for ${selectedCity}. Current and forecast levels are within standard thresholds.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <button
                  onClick={() => onNavigate('prediction')}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>5-Day Forecast</span>
                </button>
                <button
                  onClick={() => onNavigate('alerts')}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs hover:shadow transition-all flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Open Alert Center</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
          */}


          {/* Measured Criteria Pollutant Concentrations Grid (Historical CAAQM Baseline) */}
          <div className="card-panel p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">
                  Measured Criteria Pollutant Concentrations ({selectedCity})
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Observed concentrations evaluated against Central Pollution Control Board (CPCB NAAQS) benchmarks
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {data.pollutants.map((item) => (
                <div
                  key={item.pollutant}
                  className={`p-3.5 rounded-xl border transition-all ${
                    item.is_elevated
                      ? 'bg-rose-50/40 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                      : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    {item.name}
                  </div>
                  <div className="text-xl font-black text-navy-900 dark:text-slate-100 my-1">
                    {item.value} <span className="text-[11px] font-normal text-slate-400">{item.unit}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    Limit: {item.threshold_safe} {item.unit}
                  </div>
                  <div className="mt-1.5 text-[10px] font-semibold">
                    {item.is_elevated ? (
                      <span className="text-rose-600 dark:text-rose-400">Elevated ({Math.round(item.ratio_to_safe * 100)}%)</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">Safe Level</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>


          {/* Section 11: "Why Is Air Quality Like This?" Explanation Card */}
          <div className="card-panel p-6 border-l-4 border-l-indigo-600 dark:border-l-indigo-500">
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">
                Why Is Air Quality Like This in {selectedCity}?
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">CPCB Category Meaning</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong>{data.latest_record.category}</strong>: {data.latest_record.category === 'Good' ? 'Air quality poses minimal risk; optimal for all groups.' :
                  data.latest_record.category === 'Satisfactory' ? 'Minor breathing discomfort possible for sensitive individuals.' :
                  data.latest_record.category === 'Moderate' ? 'Breathing discomfort to people with lung, asthma and heart diseases.' :
                  data.latest_record.category === 'Poor' ? 'Breathing discomfort to most people on prolonged exposure.' :
                  'Significant health concern; prolonged exposure may trigger respiratory illness.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Prominent Measured Pollutant</span>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                  {data.dominant_pollutants && data.dominant_pollutants.length > 0 ? data.dominant_pollutants.join(', ') : 'All criteria pollutants within safe CPCB thresholds.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Potential Contributing Factors</span>
                <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                  {data.possible_factors.map((fact, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-3 text-[10.5px] text-slate-400 dark:text-slate-500 italic">
              Note: Potential factors describe observed atmospheric patterns and seasonal dispersion conditions; they represent potential contributors, not legally confirmed individual source attributions.
            </div>
          </div>

          {/* Section 12 & 13: Practical Health Recommendations & "How Can We Improve Air Quality?" */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Practical Health Guidance (Section 12: What Can You Do?) */}
            <div className="card-panel p-6 border-t-4 border-t-teal-600 dark:border-t-teal-500">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">
                  What Can You Do? (Citizen Health Actions)
                </h4>
              </div>

              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1.5">
                  Guidance Based on Environmental Indicators ({selectedCity})
                </div>
                <div className="space-y-2.5">
                  {data.recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2.5"
                    >
                      <span className="w-5 h-5 rounded-full bg-teal-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{rec}</span>
                    </div>
                  ))}
                </div>

                {/* Practical Protective Advice */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">Respirator Notice:</div>
                  <p className="text-[11px] leading-relaxed">
                    A well-fitting N95-type respirator significantly reduces exposure to fine particulate matter (PM2.5), but does not filter gaseous pollutants (such as CO or NO2).
                  </p>
                </div>
              </div>
            </div>

            {/* Section 13: How Can We Improve Air Quality? Suggestions */}
            <div className="card-panel p-6 border-t-4 border-t-emerald-600 dark:border-t-emerald-500">
              <div className="flex items-center gap-2 mb-3">
                <Leaf className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">
                  How Can We Improve Air Quality? (Community Actions)
                </h4>
              </div>

              <div className="space-y-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1.5">
                  Actionable Steps for Citizens & Communities
                </div>
                <div className="space-y-2.5">
                  {[
                    "Use public transport (Metro, City Buses), carpooling, or non-motorized mobility (walking, cycling) where safe and practical.",
                    "Avoid open burning of leaves, garbage, or municipal waste; report visible open fires through official municipal helplines.",
                    "Turn off private vehicle engines at traffic signals exceeding 30 seconds to minimize localized combustion accumulation.",
                    "Support road and construction dust suppression through water sprinkling and covering transit trucks.",
                    "Plant indigenous foliage and maintain rooftop greenery to enhance localized particulate deposition."
                  ].map((tip, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2.5"
                    >
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
