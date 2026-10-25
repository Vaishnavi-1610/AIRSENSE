import React, { useState, useEffect } from 'react';

import {
  GitCompare,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Activity,
  ShieldAlert,
  Clock,
  Sparkles,
  Info,
  Check,
  AlertTriangle
} from 'lucide-react';
import { LiveVsPredictionResponse } from '../types';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AQIBadge } from '../components/AQIBadge';

interface LiveVsPredictionPageProps {
  availableCities: string[];
  initialCity?: string;
  selectedCity?: string;
  onSelectCity?: (city: string) => void;
  isDark?: boolean;
}

export const LiveVsPredictionPage: React.FC<LiveVsPredictionPageProps> = ({
  availableCities,
  initialCity = 'Pune',
  selectedCity: propCity,
  onSelectCity,
  isDark = false,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>(propCity || initialCity);
  const [data, setData] = useState<LiveVsPredictionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshFeedback, setRefreshFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (propCity && propCity !== selectedCity) {
      setSelectedCity(propCity);
    }
  }, [propCity]);

  const fetchComparison = async (city: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getLiveVsPrediction({ city });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Error loading live vs prediction comparison');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparison(selectedCity);
  }, [selectedCity]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setRefreshFeedback(null);
      const res = await api.refreshLiveAqi({ city: selectedCity });
      setData(res.data);
      setRefreshFeedback(`Telemetry updated for ${selectedCity} (${res.data.today_formatted})`);
      setTimeout(() => setRefreshFeedback(null), 4000);
    } catch (err: any) {
      setRefreshFeedback(err.response?.data?.detail || 'Refresh error: verified telemetry retained.');
      setTimeout(() => setRefreshFeedback(null), 4000);
    } finally {
      setRefreshing(false);
    }
  };

  // Model performance summary metrics evaluated from genuine actual vs predicted records
  const accuracyMetrics = React.useMemo(() => {
    if (!data?.matched_series || data.matched_series.length < 2) {
      return null;
    }

    const series = data.matched_series;
    const n = series.length;
    const startDate = series[0].date;
    const endDate = series[series.length - 1].date;

    // 1. MAE: Mean Absolute Error
    const sumAbsDiff = series.reduce((sum, pt) => sum + Math.abs(pt.predicted_aqi - pt.observed_aqi), 0);
    const mae = Number((sumAbsDiff / n).toFixed(2));

    // 2. RMSE: Root Mean Squared Error
    const sumSqDiff = series.reduce((sum, pt) => sum + Math.pow(pt.predicted_aqi - pt.observed_aqi, 2), 0);
    const rmse = Number(Math.sqrt(sumSqDiff / n).toFixed(2));

    // 3. R² Score: Coefficient of Determination
    const meanObs = series.reduce((sum, pt) => sum + pt.observed_aqi, 0) / n;
    const ssTot = series.reduce((sum, pt) => sum + Math.pow(pt.observed_aqi - meanObs, 2), 0);
    const ssRes = sumSqDiff;
    const r2 = ssTot > 0 ? Number((1 - (ssRes / ssTot)).toFixed(3)) : null;

    // 4. Accuracy percentage based on 100% - MAPE (Mean Absolute Percentage Error)
    const validPairs = series.filter(pt => pt.observed_aqi > 0);
    let accuracyPct: number | null = null;
    if (validPairs.length > 0) {
      const meanMape = validPairs.reduce((sum, pt) => sum + (Math.abs(pt.predicted_aqi - pt.observed_aqi) / pt.observed_aqi), 0) / validPairs.length;
      accuracyPct = Number(Math.max(0, Math.min(100, (1 - meanMape) * 100)).toFixed(1));
    }

    return {
      evaluatedCount: n,
      startDate,
      endDate,
      mae,
      rmse,
      r2,
      accuracyPct,
    };
  }, [data]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header Card */}
      <div className="card-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="text-base font-bold text-navy-900 dark:text-slate-100">
                Live Observed AQI vs. Our Model's Prediction
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Side-by-side comparison between verified physical monitoring telemetry and our machine learning estimate with zero future leakage
            </p>
          </div>

          {/* Refresh Live Telemetry Button */}
          <div className="flex items-center gap-2 self-start lg:self-auto">
            {refreshFeedback && (
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 animate-fadeIn">
                {refreshFeedback}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-all disabled:opacity-50"
              title="Refresh latest telemetry observation from CPCB network"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh Live AQI'}</span>
            </button>
          </div>
        </div>

        {/* City Filter & Reference Time Bar */}
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

          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2.5 bg-slate-50 dark:bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              <span>Today (IST): <strong className="text-navy-900 dark:text-slate-100">{data?.today_formatted || 'Current Date'}</strong></span>
            </span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span>
              Observation Window: <strong className="text-teal-800 dark:text-teal-300">{data?.observation_display_date || 'Latest Available'}</strong>
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card-panel my-8 p-12">
          <LoadingSpinner message={`Comparing verified observations with model estimate for ${selectedCity}...`} />
        </div>
      ) : error ? (
        <div className="card-panel p-6 text-center text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
          <h4 className="text-sm font-bold">Comparison Data Unavailable</h4>
          <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{error}</p>
        </div>
      ) : data ? (
        <>
          {/* Warning banner if today's live observation is unavailable */}
          {(data.warning_message || data.today_live_available === false || !data.is_live) && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 animate-fadeIn">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm">Live Observation Status for Today ({data.today_formatted})</div>
                <p className="mt-1 leading-relaxed">
                  {data.warning_message || `Live telemetry for today (${data.today_formatted}) is currently unavailable. Displaying the latest available observation from verified historical telemetry (${data.observation_display_date}) with its genuine observation timestamp.`}
                </p>
              </div>
            </div>
          )}

          {/* Section 9 Comparison Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Card A: Verified Live / Actual Observed AQI */}
            <div className={`card-panel p-6 border-t-4 flex flex-col justify-between ${
              data.today_live_available && data.observed.is_available
                ? 'border-t-teal-600 dark:border-t-teal-500'
                : 'border-t-amber-500 dark:border-t-amber-600'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    A. Live Measured AQI
                  </span>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                    data.today_live_available && data.observed.is_available
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  }`}>
                    {data.today_live_available && data.observed.is_available ? 'Live Telemetry (Today)' : 'Telemetry Unavailable Today'}
                  </span>
                </div>

                {data.today_live_available && data.observed.is_available && data.observed.aqi !== null ? (
                  <>
                    <div className="my-3">
                      <div className="text-4xl font-black text-navy-900 dark:text-slate-100">
                        {data.observed.aqi}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        CPCB NAQI Index (Measured Today)
                      </div>
                    </div>

                    <div className="mb-4">
                      <AQIBadge category={data.observed.category} size="md" />
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Data Source:</span>
                        <strong className="text-right text-[11px]">{data.data_source}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Timestamp:</span>
                        <span className="text-right text-[11px] font-medium">{data.observation_timestamp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Station Monitoring Nodes:</span>
                        <span className="font-bold">{data.station_count} verified station(s)</span>
                      </div>
                    </div>

                    {/* Pollutants snapshot */}
                    {data.observed.pollutants && Object.keys(data.observed.pollutants).length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                          Observed Criteria Pollutants
                        </div>
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          {Object.entries(data.observed.pollutants).map(([pol, val]) => (
                            <div key={pol} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                              <div className="text-[9px] font-bold uppercase text-slate-400">{pol}</div>
                              <div className="text-xs font-bold text-navy-900 dark:text-slate-200">{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="my-3">
                      <div className="text-3xl font-black text-slate-400 dark:text-slate-500">
                        Unavailable
                      </div>
                      <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-medium">
                        No live physical observation reported yet for today ({data.today_formatted})
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 space-y-1.5 mb-3">
                      <div className="font-semibold text-amber-950 dark:text-amber-100 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Telemetry Status:
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        External station network has not yet broadcast telemetry for today ({data.today_formatted}). Today's model prediction is displayed in Card B.
                      </p>
                    </div>

                    {data.latest_historical_observation && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Archived Telemetry Baseline (Not Live)
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-slate-600 dark:text-slate-300 font-medium">
                            {data.latest_historical_observation.display_date}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-sm font-black text-navy-900 dark:text-slate-100">
                              AQI {data.latest_historical_observation.aqi}
                            </strong>
                            <AQIBadge category={data.latest_historical_observation.category} size="sm" />
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          {data.latest_historical_observation.timestamp}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Card B: Today's Model Prediction */}
            <div className="card-panel p-6 border-t-4 border-t-indigo-600 dark:border-t-indigo-500 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    B. Today's Predicted AQI
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold uppercase tracking-wider">
                    Model Forecast
                  </span>
                </div>

                <div className="my-3">
                  <div className="text-4xl font-black text-indigo-950 dark:text-indigo-200">
                    {data.predicted.aqi}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Model Estimate for Today ({data.predicted.prediction_date_formatted || data.today_formatted})
                  </div>
                </div>

                <div className="mb-4">
                  <AQIBadge category={data.predicted.category} size="md" />
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Architecture:</span>
                    <strong className="text-right text-[11px]">{data.predicted.model_type}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Validation Protocol:</span>
                    <span className="text-right text-[11px] text-indigo-700 dark:text-indigo-300 font-semibold">Zero Future Leakage</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Uncertainty Bounds:</span>
                    <span className="font-bold text-[11px]">
                      95% CI [{data.predicted.confidence_interval.lower} – {data.predicted.confidence_interval.upper}]
                    </span>
                  </div>
                </div>
              </div>

              {/* Model Leakage Disclaimer Note */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10.5px] text-slate-500 dark:text-slate-400 bg-indigo-50/50 dark:bg-indigo-950/30 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <span className="font-semibold text-indigo-900 dark:text-indigo-200 block mb-0.5">Prediction Timestamp:</span>
                {data.predicted.prediction_timestamp}
              </div>
            </div>

            {/* Card C: Difference & Evaluation Metrics */}
            <div className={`card-panel p-6 border-t-4 flex flex-col justify-between ${
              data.comparison.comparison_available && data.comparison.absolute_difference !== null
                ? data.comparison.match_tone === 'positive' ? 'border-t-emerald-500' :
                  data.comparison.match_tone === 'neutral' ? 'border-t-amber-500' : 'border-t-rose-500'
                : 'border-t-slate-400 dark:border-t-slate-600'
            }`}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    C. Comparison & Discrepancy
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                    data.comparison.comparison_available && data.comparison.absolute_difference !== null
                      ? data.comparison.match_tone === 'positive'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : data.comparison.match_tone === 'neutral'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                  }`}>
                    {data.comparison.match_status}
                  </span>
                </div>

                {data.comparison.comparison_available && data.comparison.absolute_difference !== null ? (
                  <>
                    <div className="my-3">
                      <div className="text-4xl font-black text-navy-900 dark:text-slate-100">
                        ±{data.comparison.absolute_difference}
                        <span className="text-xs font-normal text-slate-400 ml-1.5">pts</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Absolute Difference = |Predicted - Observed|
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 mb-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Percentage Error:</span>
                        <strong className="text-navy-900 dark:text-slate-200">
                          {data.comparison.percentage_error !== null ? `${data.comparison.percentage_error}%` : 'N/A'}
                        </strong>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 dark:text-slate-400">Category Match:</span>
                        <span className={`font-bold flex items-center gap-1 ${data.comparison.category_match ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {data.comparison.category_match ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Exact Same CPCB Category</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Adjacent ({data.comparison.rank_difference} level diff)</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {data.comparison.evaluation_text}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                      Formula: |{data.predicted.aqi} - {data.observed.aqi}| = {data.comparison.absolute_difference} AQI points
                    </div>
                  </>
                ) : (
                  <>
                    <div className="my-3">
                      <div className="text-3xl font-black text-slate-400 dark:text-slate-500">
                        Pending
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        Awaiting Today's Live Telemetry Observation
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-300 space-y-2 mb-3">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">Comparison Status:</div>
                      <p className="text-[11px] leading-relaxed">
                        Direct comparison requires an aligned live observation for today ({data.today_formatted}). Because today's measurement is not yet reported, no artificial single-day error is calculated.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-teal-50/50 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/60 text-[11px] text-teal-800 dark:text-teal-300">
                      <span className="font-bold">Evaluation Protocol:</span> Model accuracy is evaluated rigorously below across {accuracyMetrics?.evaluatedCount || 14} matching historical actual-versus-predicted records.
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Model Performance Summary & Accuracy Metrics (Replaces Removed Chart) */}
          <div className="card-panel p-6 bg-slate-50/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Model Accuracy & Performance Metrics ({selectedCity})
                </h4>
                {accuracyMetrics ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Evaluated across {accuracyMetrics.evaluatedCount} genuine paired observations ({accuracyMetrics.startDate} to {accuracyMetrics.endDate}) for {selectedCity}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Comparative evaluation metrics
                  </p>
                )}
              </div>
              {accuracyMetrics && (
                <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-3 py-1 rounded-full border border-teal-200 dark:border-teal-800 self-start sm:self-auto">
                  {accuracyMetrics.evaluatedCount} Observations Evaluated
                </span>
              )}
            </div>

            {accuracyMetrics ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {/* MAE */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">MAE (Mean Absolute Error)</span>
                  <div className="text-2xl font-black text-navy-900 dark:text-slate-100 my-1">
                    {accuracyMetrics.mae}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">AQI Points</span>
                </div>

                {/* RMSE */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">RMSE (Root Mean Squared Error)</span>
                  <div className="text-2xl font-black text-navy-900 dark:text-slate-100 my-1">
                    {accuracyMetrics.rmse}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">AQI Points</span>
                </div>

                {/* R² Score */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">R² Score</span>
                  <div className="text-2xl font-black text-teal-600 dark:text-teal-400 my-1">
                    {accuracyMetrics.r2 !== null ? accuracyMetrics.r2 : 'N/A'}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Variance Explained</span>
                </div>

                {/* Accuracy Percentage */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Accuracy Percentage</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 my-1">
                    {accuracyMetrics.accuracyPct !== null ? `${accuracyMetrics.accuracyPct}%` : 'N/A'}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">100% - MAPE</span>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                Evaluation metrics are currently unavailable for this selection.
              </div>
            )}
          </div>

          {/* Scientific Transparency and Methodology Disclosure */}
          <div className="card-panel p-4 bg-teal-50/50 dark:bg-teal-950/20 border-teal-200/80 dark:border-teal-900/50 flex items-start gap-3 text-xs text-slate-700 dark:text-slate-300">
            <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Methodology & Data Integrity Disclosure:</strong> {data.scientific_disclosure}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
