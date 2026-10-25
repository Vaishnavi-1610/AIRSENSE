import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  Cell
} from 'recharts';
import {
  History,
  TrendingDown,
  TrendingUp,
  BarChart3,
  Activity,
  AlertTriangle,
  AlertCircle,
  Info,
  Sparkles,
  FileText,
  Filter,
  CheckCircle2,
  Wind,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  HistoricalAnalysisResponse,
  HistoricalMetadataResponse,
  HistoricalMonthlyResponse,
  HistoricalYearlyResponse
} from '../types';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AQIBadge } from '../components/AQIBadge';

interface HistoricalPageProps {
  availableCities: string[];
  initialCity?: string;
  selectedCity?: string;
  onSelectCity?: (city: string) => void;
}

const ALL_MONTHS = [
  { value: 1, name: 'January', short: 'Jan' },
  { value: 2, name: 'February', short: 'Feb' },
  { value: 3, name: 'March', short: 'Mar' },
  { value: 4, name: 'April', short: 'Apr' },
  { value: 5, name: 'May', short: 'May' },
  { value: 6, name: 'June', short: 'Jun' },
  { value: 7, name: 'July', short: 'Jul' },
  { value: 8, name: 'August', short: 'Aug' },
  { value: 9, name: 'September', short: 'Sep' },
  { value: 10, name: 'October', short: 'Oct' },
  { value: 11, name: 'November', short: 'Nov' },
  { value: 12, name: 'December', short: 'Dec' },
];

export const HistoricalPage: React.FC<HistoricalPageProps> = ({
  availableCities: propAvailableCities,
  initialCity = 'Delhi',
  selectedCity: propCity,
  onSelectCity,
}) => {
  // Primary selection state
  const [selectedCity, setSelectedCity] = useState<string>(propCity || initialCity);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedMonth, setSelectedMonth] = useState<number>(12); // Dec 2024 default

  // Metadata
  const [metadata, setMetadata] = useState<HistoricalMetadataResponse | null>(null);
  const [metaLoading, setMetaLoading] = useState<boolean>(true);

  // Analytical data
  const [analysisData, setAnalysisData] = useState<HistoricalAnalysisResponse | null>(null);
  const [monthlyData, setMonthlyData] = useState<HistoricalMonthlyResponse | null>(null);
  const [yearlyData, setYearlyData] = useState<HistoricalYearlyResponse | null>(null);
  const [dataLoading, setDataLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Sync prop city change
  useEffect(() => {
    if (propCity && propCity !== selectedCity) {
      setSelectedCity(propCity);
    }
  }, [propCity]);

  // 1. Fetch metadata on city change to discover actual available years & months
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setMetaLoading(true);
        setError(null);
        const meta = await api.getHistoricalMetadata(selectedCity);
        setMetadata(meta);

        // Adjust selected year if current year not available for this city
        if (meta.available_years && meta.available_years.length > 0) {
          let targetYear = selectedYear;
          if (!meta.available_years.includes(selectedYear)) {
            targetYear = meta.available_years[meta.available_years.length - 1];
            setSelectedYear(targetYear);
          }

          // Adjust selected month based on available months for this target year
          const yearInfo = meta.years_info?.[targetYear];
          if (yearInfo?.months && yearInfo.months.length > 0) {
            if (!yearInfo.months.includes(selectedMonth)) {
              // Pick highest available month
              setSelectedMonth(yearInfo.months[yearInfo.months.length - 1]);
            }
          }
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Failed to load historical metadata');
      } finally {
        setMetaLoading(false);
      }
    };

    fetchMetadata();
  }, [selectedCity]);

  // Available months for the currently selected year (strictly derived from data)
  const availableMonthsForYear = useMemo(() => {
    if (!metadata?.years_info) return ALL_MONTHS;
    const yearInfo = metadata.years_info[selectedYear];
    if (!yearInfo?.months || yearInfo.months.length === 0) return [];
    return ALL_MONTHS.filter(m => yearInfo.months.includes(m.value));
  }, [metadata, selectedYear]);

  // When selected year changes, ensure selected month is valid for that year
  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
    if (metadata?.years_info) {
      const yearInfo = metadata.years_info[newYear];
      if (yearInfo?.months && yearInfo.months.length > 0) {
        if (!yearInfo.months.includes(selectedMonth)) {
          setSelectedMonth(yearInfo.months[yearInfo.months.length - 1]);
        }
      }
    }
  };

  // Keep selectedMonth synchronized whenever availableMonthsForYear updates
  useEffect(() => {
    if (availableMonthsForYear.length > 0 && !availableMonthsForYear.some(m => m.value === selectedMonth)) {
      setSelectedMonth(availableMonthsForYear[availableMonthsForYear.length - 1].value);
    }
  }, [availableMonthsForYear, selectedMonth]);

  // 2. Fetch analytical graphs data when city, year, or month change
  useEffect(() => {
    if (!selectedCity) return;

    const fetchAllHistoricalGraphs = async () => {
      try {
        setDataLoading(true);
        setError(null);

        // Run monthly daily analysis, full-year monthly comparisons, and multi-year evolution concurrently
        const [analysisRes, monthlyRes, yearlyRes] = await Promise.all([
          api.getHistoricalAnalysis({
            city: selectedCity,
            year: selectedYear,
            month: selectedMonth
          }),
          api.getHistoricalMonthly({
            city: selectedCity,
            year: selectedYear
          }),
          api.getHistoricalYearly({
            city: selectedCity,
            pollutant: 'aqi'
          })
        ]);

        setAnalysisData(analysisRes);
        setMonthlyData(monthlyRes);
        setYearlyData(yearlyRes);
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Failed to retrieve historical telemetry records');
      } finally {
        setDataLoading(false);
      }
    };

    fetchAllHistoricalGraphs();
  }, [selectedCity, selectedYear, selectedMonth]);

  // City list with badges
  const citiesList = useMemo(() => {
    if (!metadata?.city_summaries) return propAvailableCities || [];
    return Object.keys(metadata.city_summaries);
  }, [metadata, propAvailableCities]);

  const currentCitySummary = metadata?.city_summaries?.[selectedCity];
  const isFallbackActive = analysisData?.is_fallback;
  const hasPartialData = analysisData?.has_partial_data;

  // Prepare Daily Charts Data
  const dailyChartData = useMemo(() => {
    if (!analysisData?.timeseries) return [];
    return analysisData.timeseries.map(item => {
      const dayNum = item.date.slice(-2);
      const monthNum = item.date.slice(5, 7);
      const monthAbbr = ALL_MONTHS.find(m => m.value === Number(monthNum))?.short || '';
      return {
        ...item,
        dayLabel: `${dayNum} ${monthAbbr}`,
        dateShort: item.date.slice(5),
      };
    });
  }, [analysisData]);

  // Custom Recharts Tooltip
  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/95 dark:bg-slate-950/95 border border-slate-700 p-3 rounded-xl shadow-xl text-xs text-white backdrop-blur-md">
          <p className="font-bold text-slate-300 border-b border-slate-800 pb-1 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span>{entry.name}:</span>
              </span>
              <span className="font-extrabold">{entry.value !== null && entry.value !== undefined ? entry.value : 'N/A'}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Header & Dynamic Year/Month Dropdown Filters */}
      <div className="card-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="text-base font-bold text-navy-900 dark:text-slate-100">
                Historical Atmospheric Telemetry Analysis
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                Verified Historical Records
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Explore air quality primarily through verified graphs, criteria pollutant trends, and automated analytical insights
            </p>
          </div>

          {/* Quick Period Presets (dynamically tailored to selected city's actual records) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">
              Quick Select:
            </span>
            {metadata?.available_years && metadata.available_years.length > 0 && (
              <>
                <button
                  onClick={() => {
                    const latestY = metadata.available_years[metadata.available_years.length - 1];
                    setSelectedYear(latestY);
                    const mList = metadata.years_info?.[latestY]?.months || [12];
                    setSelectedMonth(mList[mList.length - 1]);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
                >
                  Latest Verified ({metadata.available_years[metadata.available_years.length - 1]})
                </button>
                {metadata.available_years.includes(2010) && (
                  <button
                    onClick={() => {
                      setSelectedYear(2010);
                      const mList = metadata.years_info?.[2010]?.months || [1];
                      setSelectedMonth(mList[0]);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300 text-xs font-semibold transition-colors"
                  >
                    Archive Origin (2010)
                  </button>
                )}
                {metadata.available_years.includes(2023) && (
                  <button
                    onClick={() => {
                      setSelectedYear(2023);
                      const mList = metadata.years_info?.[2023]?.months || [1];
                      setSelectedMonth(mList[mList.length - 1]);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition-colors"
                  >
                    2023 Baseline
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Dynamic Dropdown Filters: City, Year, Month */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          {/* City Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select City
            </label>
            <div className="relative">
              <select
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  onSelectCity?.(e.target.value);
                }}
                className="w-full text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
              >
                {citiesList.map((c) => {
                  const metaSummary = metadata?.city_summaries?.[c];
                  const label = metaSummary ? `${c} (${metaSummary.year_range_label})` : c;
                  return (
                    <option key={c} value={c}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
            {currentCitySummary && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                <span>Verified Window:</span>
                <span className="font-semibold text-teal-600 dark:text-teal-400">
                  {currentCitySummary.min_date} to {currentCitySummary.max_date}
                </span>
              </p>
            )}
          </div>

          {/* Dynamic Year Selector (Only years with valid data for selected city) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select Year
            </label>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="w-full text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
              >
                {(metadata?.available_years ? [...metadata.available_years].reverse() : []).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {metadata?.available_years?.length || 0} years with verified records for {selectedCity}
            </p>
          </div>

          {/* Dynamic Month Selector (Only months with valid data for selected year) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Select Month
            </label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2.5 text-navy-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
              >
                {availableMonthsForYear.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.name} ({m.short})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              Showing {availableMonthsForYear.length} available months for {selectedYear}
            </p>
          </div>
        </div>
      </div>

      {/* Fallback Period Notice if applicable */}
      {isFallbackActive && analysisData?.fallback_note && (
        <div className="card-panel p-4 border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 animate-fadeIn">
          <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Historical Fallback Analysis Active</p>
            <p className="mt-0.5 leading-relaxed">{analysisData.fallback_note}</p>
          </div>
        </div>
      )}

      {/* Partial / Data Pending Notice if applicable */}
      {hasPartialData && (
        <div className="card-panel p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-3 animate-fadeIn">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Academic Data Integrity Disclosure</p>
            <p className="mt-0.5 leading-relaxed">
              For {analysisData?.period_label}, physical particulate measurements (PM2.5 and PM10) are recorded across all days and plotted below. Official CPCB NAQI values are preserved as 'Data Pending' because gaseous criteria pollutants have not yet been released by CPCB for this recent period.
            </p>
          </div>
        </div>
      )}

      {/* Error Notice */}
      {error && (
        <div className="card-panel p-4 border-l-4 border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />
          <div>
            <p className="font-bold">Telemetry Query Notice</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {dataLoading ? (
        <div className="card-panel p-16 text-center">
          <LoadingSpinner message={`Generating historical graphs & analysis for ${selectedCity}...`} />
        </div>
      ) : analysisData ? (
        <>
          {/* 2. Summary Statistics KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Monthly Average AQI */}
            <div className="card-panel p-5 border-l-4 border-teal-500">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Monthly Average AQI
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-extrabold text-navy-900 dark:text-slate-100">
                  {analysisData.stats?.mean_aqi !== null && analysisData.stats?.mean_aqi !== undefined
                    ? analysisData.stats.mean_aqi
                    : 'Data Pending'}
                </span>
                {analysisData.stats?.mean_aqi !== null && analysisData.stats?.mean_aqi !== undefined && (
                  <span className="text-xs text-slate-400">CPCB NAQI</span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {analysisData.period_label} &bull; {analysisData.city}
              </p>
            </div>

            {/* Peak Observed AQI */}
            <div className="card-panel p-5 border-l-4 border-rose-500">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Peak AQI Observed
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                  {analysisData.stats?.max_aqi !== null && analysisData.stats?.max_aqi !== undefined
                    ? analysisData.stats.max_aqi
                    : 'N/A'}
                </span>
                <span className="text-xs text-slate-400">Peak value</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Single highest daily observation
              </p>
            </div>

            {/* Lowest Observed AQI */}
            <div className="card-panel p-5 border-l-4 border-emerald-500">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Lowest AQI Observed
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {analysisData.stats?.min_aqi !== null && analysisData.stats?.min_aqi !== undefined
                    ? analysisData.stats.min_aqi
                    : 'N/A'}
                </span>
                <span className="text-xs text-slate-400">Cleanest day</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Lowest recorded pollution episode
              </p>
            </div>

            {/* Valid Observation Count & Coverage */}
            <div className="card-panel p-5 border-l-4 border-indigo-500">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Valid Observation Count
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {analysisData.stats?.observations_count || 0}
                </span>
                <span className="text-xs text-slate-400">days monitored</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {analysisData.stats?.valid_aqi_days || 0} days with official NAQI ({analysisData.stats?.data_completeness_pct || 0}% coverage)
              </p>
            </div>
          </div>

          {/* 3. Automatically Generated Analysis Paragraph */}
          <div className="card-panel p-6 bg-gradient-to-r from-teal-50/50 via-white to-slate-50/50 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 border border-teal-200/60 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100 uppercase tracking-wider">
                Automated Atmospheric Telemetry Analysis &bull; {analysisData.period_label}
              </h4>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              {analysisData.summary}
            </p>
          </div>

          {/* 4. Graph 1: AQI Trend Throughout the Selected Month */}
          <div className="card-panel p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-bold text-navy-900 dark:text-slate-100">
                  Air Quality Index (AQI) Trend &bull; {analysisData.period_label}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Daily CPCB NAQI trajectory across all recorded days in {analysisData.period_label}
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Unit: CPCB Index (0–500)
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorAQI" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis
                    dataKey="dayLabel"
                    stroke="#64748b"
                    fontSize={11}
                    tickMargin={8}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    domain={[0, 'auto']}
                    label={{ value: 'AQI Index', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 10 } }}
                  />
                  <Tooltip content={renderCustomTooltip} />
                  {/* Category benchmark lines */}
                  <ReferenceLine y={50} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Good (50)', fill: '#10b981', fontSize: 9 }} />
                  <ReferenceLine y={100} stroke="#84cc16" strokeDasharray="3 3" label={{ value: 'Satisfactory (100)', fill: '#84cc16', fontSize: 9 }} />
                  <ReferenceLine y={200} stroke="#eab308" strokeDasharray="3 3" label={{ value: 'Moderate (200)', fill: '#eab308', fontSize: 9 }} />
                  <ReferenceLine y={300} stroke="#f97316" strokeDasharray="3 3" label={{ value: 'Poor (300)', fill: '#f97316', fontSize: 9 }} />
                  <Area
                    type="monotone"
                    dataKey="aqi"
                    name="Daily CPCB NAQI"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorAQI)"
                    connectNulls={false}
                    dot={{ r: 3, fill: '#0d9488' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. Graph 2: Respirable Particulate Matter (PM2.5 and PM10) Trend */}
          <div className="card-panel p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-bold text-navy-900 dark:text-slate-100">
                  Respirable Particulate Matter (PM2.5 & PM10) Trends &bull; {analysisData.period_label}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Direct physical mass concentration measurements plotted with statutory NAAQS 24-hr safe benchmarks
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                Shared Unit: µg/m³
              </span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={11} tickMargin={8} />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    label={{ value: 'Concentration (µg/m³)', angle: -90, position: 'insideLeft', style: { fill: '#64748b', fontSize: 10 } }}
                  />
                  <Tooltip content={renderCustomTooltip} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <ReferenceLine y={30} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: 'PM2.5 Safe (30 µg/m³)', fill: '#3b82f6', fontSize: 9 }} />
                  <ReferenceLine y={60} stroke="#f97316" strokeDasharray="4 4" label={{ value: 'PM10 Safe (60 µg/m³)', fill: '#f97316', fontSize: 9 }} />
                  <Line
                    type="monotone"
                    dataKey="pm25"
                    name="PM2.5 (Fine Respirable, µg/m³)"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pm10"
                    name="PM10 (Inhalable Dust, µg/m³)"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6. Graph 3 & 4: Other Pollutant Graphs (NO₂, SO₂, Ozone in µg/m³ & CO in mg/m³) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gaseous Criteria Pollutants (NO₂, SO₂, Ozone in µg/m³) */}
            <div className="card-panel p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">
                    Gaseous Criteria Pollutants (NO₂, SO₂, Ozone)
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Photochemical and industrial combustion gases ({analysisData.period_label})
                  </p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Unit: µg/m³
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyChartData} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                    <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={10} tickMargin={6} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip content={renderCustomTooltip} />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                    <ReferenceLine y={40} stroke="#ec4899" strokeDasharray="3 3" label={{ value: 'NO₂ Safe (40)', fill: '#ec4899', fontSize: 8 }} />
                    <Line type="monotone" dataKey="no2" name="NO₂ (Nitrogen Dioxide, µg/m³)" stroke="#ec4899" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                    <Line type="monotone" dataKey="so2" name="SO₂ (Sulphur Dioxide, µg/m³)" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                    <Line type="monotone" dataKey="ozone" name="Ozone (O₃, µg/m³)" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Carbon Monoxide (CO in mg/m³ - Strictly separate scale) */}
            <div className="card-panel p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">
                    Carbon Monoxide (CO) Concentration
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Vehicular and incomplete combustion tracer ({analysisData.period_label})
                  </p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                  Unit: mg/m³
                </span>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyChartData} margin={{ top: 10, right: 15, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorCO" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                    <XAxis dataKey="dayLabel" stroke="#64748b" fontSize={10} tickMargin={6} />
                    <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
                    <Tooltip content={renderCustomTooltip} />
                    <ReferenceLine y={2.0} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'CO Safe Standard (2.0 mg/m³)', fill: '#ef4444', fontSize: 8 }} />
                    <Area type="monotone" dataKey="co" name="CO (mg/m³)" stroke="#f59e0b" strokeWidth={2} fill="url(#colorCO)" fillOpacity={1} dot={{ r: 2 }} connectNulls={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 7. Graph 5: Monthly Comparison Graph (Jan–Dec Average AQI for the Year) */}
          <div className="card-panel p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-bold text-navy-900 dark:text-slate-100">
                  Monthly Comparison Graph &bull; Full Year {selectedYear}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Comparison of monthly average AQI across all 12 calendar months for {selectedCity}
                </p>
              </div>
              {monthlyData?.best_month && monthlyData?.worst_month && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                    Cleanest: {monthlyData.best_month.name} ({monthlyData.best_month.mean_aqi})
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-bold border border-rose-200 dark:border-rose-800">
                    Highest: {monthlyData.worst_month.name} ({monthlyData.worst_month.mean_aqi})
                  </span>
                </div>
              )}
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyData?.monthly_data || []}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis dataKey="short_name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 'auto']} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700">
                            <p className="font-bold text-teal-300 mb-1">{data.month_name} {selectedYear}</p>
                            <p className="flex justify-between gap-4">
                              <span className="text-slate-400">Monthly Mean AQI:</span>
                              <span className="font-extrabold">{data.mean_aqi !== null ? data.mean_aqi : 'Data Pending'}</span>
                            </p>
                            <p className="flex justify-between gap-4 mt-1">
                              <span className="text-slate-400">Category:</span>
                              <span className="font-bold" style={{ color: data.color }}>{data.category}</span>
                            </p>
                            <p className="flex justify-between gap-4 mt-1">
                              <span className="text-slate-400">Peak Observed:</span>
                              <span>{data.max_aqi !== null ? data.max_aqi : 'N/A'}</span>
                            </p>
                            <p className="flex justify-between gap-4 mt-1">
                              <span className="text-slate-400">Monitored Days:</span>
                              <span>{data.valid_aqi_days} / {data.total_days}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={100} stroke="#84cc16" strokeDasharray="3 3" label={{ value: 'Satisfactory (100)', fill: '#84cc16', fontSize: 9 }} />
                  <ReferenceLine y={200} stroke="#eab308" strokeDasharray="3 3" label={{ value: 'Moderate (200)', fill: '#eab308', fontSize: 9 }} />
                  <Bar dataKey="mean_aqi" name="Monthly Average AQI" radius={[6, 6, 0, 0]}>
                    {(monthlyData?.monthly_data || []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.mean_aqi !== null ? entry.color : '#94a3b8'}
                        opacity={entry.month === selectedMonth ? 1 : 0.8}
                        stroke={entry.month === selectedMonth ? '#0f766e' : 'none'}
                        strokeWidth={entry.month === selectedMonth ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 8. Graph 6: Year-wise Comparison Graph (Multi-Year Trajectory) */}
          <div className="card-panel p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h4 className="text-base font-bold text-navy-900 dark:text-slate-100">
                  Year-wise Comparison Graph &bull; Multi-Year Evolution ({yearlyData?.min_year} &ndash; {yearlyData?.max_year})
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Long-term annual average AQI trajectory across all available historical observation years for {selectedCity}
                </p>
              </div>
              {yearlyData && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold border border-indigo-200 dark:border-indigo-800">
                    Trajectory: {yearlyData.overall_trend_direction.toUpperCase()}
                  </span>
                  {yearlyData.cleanest_year && (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                      Cleanest Year: {yearlyData.cleanest_year.year} ({yearlyData.cleanest_year.mean_aqi})
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={yearlyData?.yearly_records || []}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis dataKey="year" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 'auto']} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs border border-slate-700">
                            <p className="font-bold text-teal-300 mb-1">Year {data.year}</p>
                            <p className="flex justify-between gap-4">
                              <span className="text-slate-400">Annual Mean AQI:</span>
                              <span className="font-extrabold">{data.mean_aqi !== null ? data.mean_aqi : 'Data Pending'}</span>
                            </p>
                            <p className="flex justify-between gap-4 mt-1">
                              <span className="text-slate-400">Category:</span>
                              <span className="font-bold" style={{ color: data.color }}>{data.category}</span>
                            </p>
                            <p className="flex justify-between gap-4 mt-1">
                              <span className="text-slate-400">YoY Change:</span>
                              <span className={data.yoy_aqi_change <= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {data.yoy_aqi_change !== null ? `${data.yoy_aqi_change > 0 ? '+' : ''}${data.yoy_aqi_change}%` : 'Baseline'}
                              </span>
                            </p>
                            {data.is_partial && (
                              <p className="text-amber-400 text-[10px] mt-1 font-semibold">
                                * Partial Year Monitoring
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={100} stroke="#84cc16" strokeDasharray="3 3" label={{ value: 'Satisfactory (100)', fill: '#84cc16', fontSize: 9 }} />
                  <ReferenceLine y={200} stroke="#eab308" strokeDasharray="3 3" label={{ value: 'Moderate (200)', fill: '#eab308', fontSize: 9 }} />
                  <Bar dataKey="mean_aqi" name="Annual Average AQI" radius={[6, 6, 0, 0]}>
                    {(yearlyData?.yearly_records || []).map((entry, index) => (
                      <Cell
                        key={`year-cell-${index}`}
                        fill={entry.year === selectedYear ? '#0d9488' : entry.color}
                        opacity={entry.year === selectedYear ? 1 : 0.85}
                        stroke={entry.year === selectedYear ? '#042f2e' : 'none'}
                        strokeWidth={entry.year === selectedYear ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
