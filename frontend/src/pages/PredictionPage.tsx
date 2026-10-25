import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LabelList,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Search,
  Activity,
  ChevronRight
} from 'lucide-react';
import { DailyForecastResponse } from '../types';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AQIBadge } from '../components/AQIBadge';

const CustomForecastBarTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0].payload;
    return (
      <div className="bg-white dark:bg-slate-900 p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-xs min-w-[190px]">
        <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-slate-100 dark:border-slate-800">
          <span className="font-bold text-navy-900 dark:text-slate-100">{item.dayLabel} ({item.dateLabel})</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white shrink-0"
            style={{ backgroundColor: item.color }}
          >
            {item.category}
          </span>
        </div>
        <div className="space-y-1 text-slate-600 dark:text-slate-300">
          <div className="flex justify-between items-baseline">
            <span className="text-[11px] text-slate-400">Predicted AQI:</span>
            <strong className="text-navy-900 dark:text-slate-100 text-sm font-black">{item.predicted_aqi}</strong>
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Date:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{item.fullDate}</span>
          </div>
          {item.lower !== undefined && item.upper !== undefined && (
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>95% CI:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">[{item.lower} – {item.upper}]</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

interface PredictionPageProps {
  availableCities: string[];
  initialCity?: string;
  selectedCity?: string;
  onSelectCity?: (city: string) => void;
  isDark?: boolean;
}

export const PredictionPage: React.FC<PredictionPageProps> = ({
  availableCities,
  initialCity = 'Pune',
  selectedCity: propCity,
  onSelectCity,
  isDark = false,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>(propCity || initialCity);
  const [selectedHorizon, setSelectedHorizon] = useState<number>(5); // 1, 2, 3, 4, or 5 days
  const [forecastData, setForecastData] = useState<DailyForecastResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (propCity && propCity !== selectedCity) {
      setSelectedCity(propCity);
    }
  }, [propCity]);

  const fetchPrediction = async (city: string, days: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDailyPrediction({ city, days });
      setForecastData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Error generating forecast');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrediction(selectedCity, selectedHorizon);
  }, [selectedCity, selectedHorizon]);

  // Prepare 5-day forecast data for the Next 5 Days AQI Forecast Bar Chart
  // Strictly starting tomorrow (Day 1) to Day 5, excluding today
  const forecastBarData = React.useMemo(() => {
    if (!forecastData?.forecast?.length) return [];
    return forecastData.forecast.slice(0, 5).map((step) => {
      const datePart = step.date_formatted ? step.date_formatted.split(',')[0] : step.date.slice(5);
      const isTomorrow = step.step === 1;
      const dayTitle = isTomorrow ? 'Tomorrow' : `Day ${step.step}`;
      return {
        step: step.step,
        dayLabel: dayTitle,
        dateLabel: datePart,
        axisLabel: `${dayTitle} (${datePart})`,
        fullDate: step.date_formatted || step.display_label || step.date,
        predicted_aqi: step.predicted_aqi,
        category: step.category,
        color: step.color || '#0d9488',
        lower: step.confidence_interval?.lower,
        upper: step.confidence_interval?.upper,
        health_advisory: step.health_advisory,
      };
    });
  }, [forecastData]);


  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header Card */}
      <div className="card-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="text-base font-bold text-navy-900 dark:text-slate-100">
                Future Air Quality Forecasting (5 Calendar Days Outlook)
              </h3>
            </div>
          </div>

          {/* Horizon Selection Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl self-start lg:self-auto border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 px-2 uppercase tracking-wider font-bold">Horizon:</span>
            {[
              { days: 1, label: 'Day 1' },
              { days: 2, label: 'Day 2' },
              { days: 3, label: 'Day 3' },
              { days: 4, label: 'Day 4' },
              { days: 5, label: 'Next 5 Days' },
            ].map((opt) => (
              <button
                key={opt.days}
                onClick={() => setSelectedHorizon(opt.days)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedHorizon === opt.days
                    ? 'bg-teal-600 text-white shadow-xs font-bold'
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
              Forecast Reference: <strong className="text-navy-900 dark:text-slate-100">{forecastData?.forecast_reference_formatted || forecastData?.today_formatted || 'Today (IST)'}</strong>
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>
              Latest Physical Observation: <strong className="text-teal-800 dark:text-teal-300">{forecastData?.latest_observed_date || 'Historical observation'}</strong>
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card-panel my-8 p-12">
          <LoadingSpinner message={`Generating predictive forecast for ${selectedCity}...`} />
        </div>
      ) : error ? (
        <div className="card-panel p-6 text-center text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
          <h4 className="text-sm font-bold">Error generating forecast</h4>
          <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{error}</p>
        </div>
      ) : forecastData ? (
        <>
          {/* Trend Summary Banner */}
          <div className={`card-panel p-6 border-l-4 ${
            forecastData.trend_tone === 'warning' ? 'border-l-rose-500' :
            forecastData.trend_tone === 'positive' ? 'border-l-emerald-500' : 'border-l-teal-600 dark:border-l-teal-500'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border uppercase tracking-wider ${
                    forecastData.trend_tone === 'warning' ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800' :
                    forecastData.trend_tone === 'positive' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' :
                    'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                  }`}>
                    Trajectory: {forecastData.overall_trend.includes('increase') ? 'Worsening' : forecastData.overall_trend.includes('decrease') ? 'Improving' : 'Stable'}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-600">|</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Horizon: <strong>Next {forecastData.requested_horizon_days} Calendar Day(s) Starting Tomorrow</strong>
                  </span>
                </div>
                <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100 mt-1">
                  Air Quality Predictive Outlook for {selectedCity}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-3xl leading-relaxed">
                  {forecastData.overall_trend}
                </p>
              </div>

              {/* Baseline Comparison Pill */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center shrink-0 min-w-[200px]">
                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase">Latest Actual → Day 5 Prediction</div>
                <div className="text-lg font-black text-navy-900 dark:text-slate-100 mt-0.5">
                  {forecastData.latest_observed_aqi} → {forecastData.forecast[forecastData.forecast.length - 1]?.predicted_aqi}
                </div>
                <div className={`text-[11px] font-bold mt-0.5 flex items-center justify-center gap-1 ${forecastData.delta_from_latest <= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                  {forecastData.delta_from_latest > 0 ? (
                    <>
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>+{forecastData.delta_from_latest} pts change</span>
                    </>
                  ) : forecastData.delta_from_latest < 0 ? (
                    <>
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>{forecastData.delta_from_latest} pts change</span>
                    </>
                  ) : (
                    <span>Stable (0 pts change)</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Daily Forecast Cards Grid (Day 1 Tomorrow through Day 5) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                Daily Forecast Predictions (Calendar Days Starting Tomorrow)
              </h4>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                Expected 95% Interval Range
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {forecastData.forecast.map((step) => (
                <div
                  key={step.step}
                  className="card-panel p-5 flex flex-col justify-between hover:border-teal-400 dark:hover:border-teal-500 transition-all border border-slate-200/90 dark:border-slate-800 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800">
                        {step.horizon_title || step.horizon_label}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{step.date_formatted || step.display_label || step.date}</span>
                    </div>

                    <div className="my-3">
                      <div className="text-3xl font-black text-navy-900 dark:text-slate-100">{step.predicted_aqi}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Predicted AQI</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-xs bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 font-bold uppercase">
                          Prediction
                        </span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <AQIBadge category={step.category} size="sm" />
                    </div>

                    {/* Comparison Indicator vs Historical Baseline AQI */}
                    <div className="mb-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-[10px]">
                      <div className="text-slate-400 uppercase font-bold text-[9px] mb-0.5">Vs. Historical Baseline ({forecastData.latest_observed_aqi})</div>
                      <div className="flex items-center gap-1 font-bold">
                        {step.comparison_to_actual === 'increase' ? (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Expected to increase (+{step.delta_from_actual} pts)</span>
                          </span>
                        ) : step.comparison_to_actual === 'decrease' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <TrendingDown className="w-3.5 h-3.5" />
                            <span>Expected to decrease ({step.delta_from_actual} pts)</span>
                          </span>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Approximately stable</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Practical Day Advisory */}
                    <p className="text-[10.5px] text-slate-600 dark:text-slate-300 leading-snug mb-3">
                      {step.health_advisory}
                    </p>
                  </div>

                  {/* Confidence Interval / Uncertainty Range */}
                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-800/50 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center justify-between font-medium">
                      <span>95% CI Range:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        [{step.confidence_interval.lower} – {step.confidence_interval.upper}]
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dedicated Five-Day AQI Forecast Bar Chart */}
          {forecastBarData.length > 0 && (
            <div className="card-panel p-6 border-t-4 border-t-teal-600 dark:border-t-teal-500">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    <h4 className="text-base font-bold text-navy-900 dark:text-slate-100">
                      Next 5 Days AQI Forecast
                    </h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Multi-horizon machine learning predictions for <strong>{selectedCity}</strong> for the next five calendar days starting tomorrow, excluding today
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300">
                  <Activity className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>5 Future Calendar Days Outlook</span>
                </div>
              </div>

              {/* 5-Day Bar Chart: Exactly One Bar per Future Day */}
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={forecastBarData}
                    margin={{ top: 28, right: 20, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#f1f5f9'} vertical={false} />
                    <XAxis
                      dataKey="axisLabel"
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      fontSize={11}
                      fontWeight={600}
                      tickLine={false}
                      axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
                    />
                    <YAxis
                      stroke={isDark ? '#94a3b8' : '#64748b'}
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: isDark ? '#334155' : '#e2e8f0' }}
                      label={{
                        value: 'Predicted AQI',
                        angle: -90,
                        position: 'insideLeft',
                        offset: 5,
                        style: { textAnchor: 'middle', fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11, fontWeight: 700 }
                      }}
                    />
                    <Tooltip content={<CustomForecastBarTooltip />} />
                    <Bar
                      dataKey="predicted_aqi"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={55}
                    >
                      <LabelList
                        dataKey="predicted_aqi"
                        position="top"
                        style={{
                          fill: isDark ? '#f8fafc' : '#0f172a',
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      />
                      {forecastBarData.map((entry, index) => (
                        <Cell key={`forecast-bar-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Day Summary Cards Below Chart */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                {forecastBarData.map((step) => (
                  <div
                    key={step.step}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                        <span>{step.dayLabel}</span>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: step.color }}></span>
                      </div>
                      <div className="text-xl font-black text-navy-900 dark:text-slate-100 my-0.5">{step.predicted_aqi}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{step.dateLabel}</div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <AQIBadge category={step.category} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actionable Recommendations: Observed vs Predicted Distinction */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Observed Telemetry Guidance */}
            <div className="card-panel p-6 border-t-4 border-t-teal-600 dark:border-t-teal-500 bg-slate-50/50 dark:bg-slate-900/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Observed Telemetry Health Guidance ({selectedCity})
              </h4>
              <div className="space-y-2.5">
                {forecastData.observed_recommendations && forecastData.observed_recommendations.length > 0 ? (
                  forecastData.observed_recommendations.map((rec, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">{rec}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">Air quality meets national safety limits based on observed readings.</p>
                )}
              </div>
            </div>

            {/* 2. Predicted 5-Day Forward Guidance */}
            <div className="card-panel p-6 border-t-4 border-t-amber-500 bg-slate-50/50 dark:bg-slate-900/50">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                5-Day Forecast Actionable Recommendations
              </h4>
              <div className="space-y-2.5">
                {forecastData.predicted_recommendations && forecastData.predicted_recommendations.length > 0 ? (
                  forecastData.predicted_recommendations.map((rec, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">{rec}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">Stable conditions projected over the 5-day horizon.</p>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
