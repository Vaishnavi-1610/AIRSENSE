export type NavTab = 'dashboard' | 'prediction' | 'live_vs_pred' | 'alerts' | 'analysis' | 'historical' | 'clustering' | 'hotspots';

export interface AQICategory {
  name: string;
  min: number;
  max: number;
  color: string;
  badge: string;
  description: string;
}

export interface DatasetInfo {
  source_file: string;
  min_date: string;
  max_date: string;
  total_records: number;
  unique_cities_count: number;
  unique_stations_count?: number;
  cities: string[];
  pollutants_present: string[];
  has_aqi: boolean;
  valid_aqi_records?: number;
  missing_counts: Record<string, number>;
  duplicate_records: number;
  stats: Record<string, {
    mean: number;
    min: number;
    max: number;
    unit: string;
  }>;
  aqi_category_distribution: Record<string, number>;
  provenance?: string;
  setup_instructions?: string;
}

export interface PollutantConcentration {
  pollutant: string;
  name: string;
  label: string;
  value: number;
  unit: string;
  threshold_safe: number;
  is_elevated: boolean;
  ratio_to_safe: number;
}

export interface TrendPoint {
  date: string;
  display_label: string;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  ozone: number | null;
}

export interface HighPollutionAlert {
  id: string;
  city: string;
  alert_type: 'current' | 'forecast';
  alert_type_label: string;
  severity: string;
  color: string;
  badge: string;
  aqi_value: number;
  is_prediction: boolean;
  timestamp: string;
  expected_impact: string;
  status: 'Active' | 'Acknowledged' | 'Resolved';
  headline: string;
  description: string;
  precautions: string[];
}

export interface HighPollutionAlertSummary {
  city: string;
  threshold: number;
  has_alerts: boolean;
  summary: string;
  alerts: HighPollutionAlert[];
  count: number;
}

export interface DashboardCityData {
  city: string;
  available: boolean;
  today_date?: string;
  today_formatted?: string;
  is_live?: boolean;
  freshness_label?: string;
  min_date: string;
  max_date: string;
  total_city_records: number;

  // Today's ML Prediction
  today_prediction?: {
    date: string;
    date_formatted: string;
    display_label: string;
    predicted_aqi: number;
    category: string;
    color: string;
    badge: string;
    confidence_interval: {
      lower: number;
      upper: number;
      level: string;
    };
    health_advisory: string;
  };
  today_predicted_aqi?: number | null;
  today_predicted_category?: string;
  today_predicted_color?: string;
  today_predicted_badge?: string;
  today_predicted_date?: string;
  today_predicted_date_formatted?: string;
  today_predicted_display_label?: string;
  today_predicted_health_advisory?: string;
  today_predicted_confidence_interval?: {
    lower: number;
    upper: number;
    level: string;
  };

  predicted_aqi?: number | null;
  predicted_category?: string;
  predicted_color?: string;
  predicted_badge?: string;
  predicted_target_date?: string;
  predicted_target_formatted?: string;
  predicted_display_label?: string;
  predicted_horizon_title?: string;
  predicted_confidence_interval?: {
    lower: number;
    upper: number;
    level: string;
  };
  model_name?: string;
  forecast_reference_date?: string;
  forecast_reference_formatted?: string;
  forecast?: DailyForecastStep[];
  alerts?: HighPollutionAlertSummary;

  latest_record: {
    date: string;
    display_date?: string;
    aqi: number | null;
    category: string;
    color: string;
    badge: string;
    station_count?: number;
    is_today?: boolean;
  };
  selected_date_record?: {
    date: string;
    aqi: number | null;
    category: string;
    color: string;
    badge: string;
    pollutants: Record<string, number | null>;
  } | null;
  target_date_requested?: string | null;
  date_is_available?: boolean;
  out_of_range_message?: string | null;
  pollutants: PollutantConcentration[];
  trend: TrendPoint[];
  summary: string;
  dominant_pollutants: string[];
  possible_factors: string[];
  recommendations: string[];
  data_freshness_note?: string;
  message?: string;
}

export interface DailyForecastStep {
  step: number;
  horizon_label: string;
  horizon_title?: string;
  date: string;
  date_formatted?: string;
  display_label: string;
  predicted_aqi: number;
  category: string;
  color: string;
  badge: string;
  health_advisory: string;
  trend_direction: 'improving' | 'stable' | 'deteriorating';
  comparison_to_actual?: 'increase' | 'decrease' | 'stable';
  delta_from_actual?: number;
  comparison_label?: string;
  comparison_color?: string;
  is_prediction?: boolean;
  confidence_interval: {
    lower: number;
    upper: number;
    level: string;
  };
}

export interface DailyForecastResponse {
  city: string;
  today_date?: string;
  today_formatted?: string;
  today_prediction?: {
    date: string;
    date_formatted: string;
    display_label: string;
    predicted_aqi: number;
    category: string;
    color: string;
    badge: string;
    confidence_interval: {
      lower: number;
      upper: number;
      level: string;
    };
    health_advisory: string;
  };
  forecast_issue_date: string;
  forecast_reference_date?: string;
  forecast_reference_formatted?: string;
  latest_observed_date?: string;
  latest_observed_aqi: number;
  latest_observed_category: string;
  is_live_observation?: boolean;
  freshness_label?: string;
  requested_horizon_days: number;
  baseline_recent_aqi: number;
  delta_from_latest: number;
  overall_trend: string;
  trend_tone: 'positive' | 'neutral' | 'warning';
  recent_observed: Array<{
    date: string;
    observed_aqi: number;
    category: string;
    color: string;
    is_prediction?: boolean;
  }>;
  forecast: DailyForecastStep[];
  alerts?: HighPollutionAlertSummary;
  observed_recommendations?: string[];
  predicted_recommendations?: string[];
  recommendations: string[];
  model_metadata?: {
    validation_approach: string;
    day_1_test_mae: number;
    day_1_test_r2: number;
    data_provenance: string;
  };
}

export interface HistoricalAnalysisResponse {
  city: string;
  period_label?: string;
  requested_period_label?: string;
  is_fallback?: boolean;
  fallback_note?: string;
  available: boolean;
  has_partial_data?: boolean;
  start_date: string;
  end_date: string;
  min_available_date?: string;
  max_available_date?: string;
  days_present?: number;
  partial_pollutants?: {
    pm25_mean: number | null;
    pm10_mean: number | null;
  };
  stats?: {
    mean_aqi: number;
    max_aqi: number;
    min_aqi: number;
    std_aqi: number;
    observations_count: number;
    valid_aqi_days: number;
    data_completeness_pct: number;
  };
  pollutant_averages?: Record<string, number>;
  category_distribution?: Record<string, number>;
  baseline_city_aqi?: number;
  variance_pct?: number;
  timeseries?: Array<{
    date: string;
    display_label: string;
    aqi: number | null;
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    so2?: number | null;
    co?: number | null;
    ozone: number | null;
    category: string;
    color: string;
    prominent_pollutant?: string;
  }>;
  summary?: string;
  recommendations?: string[];
  message?: string;
}

export interface CitySummaryInfo {
  city: string;
  min_year: number;
  max_year: number;
  min_date: string;
  max_date: string;
  year_range_label: string;
  total_records: number;
  valid_aqi_records: number;
}

export interface YearInfo {
  year: number;
  total_days: number;
  valid_aqi_days: number;
  months: number[];
  is_partial: boolean;
  partial_reason: string | null;
  has_valid_aqi: boolean;
}

export interface PollutantMeta {
  id: string;
  name: string;
  unit: string;
  description: string;
}

export interface HistoricalMetadataResponse {
  selected_city: string;
  min_date: string;
  max_date: string;
  available_years: number[];
  years_info: Record<string, YearInfo>;
  available_pollutants: PollutantMeta[];
  all_cities: string[];
  city_summaries: Record<string, CitySummaryInfo>;
}

export interface CalendarDayData {
  date: string;
  day: number;
  weekday: number; // 0=Mon, 6=Sun
  weekday_name: string;
  status: 'complete' | 'partial' | 'missing';
  aqi: number | null;
  category: string;
  color: string;
  badge: string;
  pollutants: {
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    so2: number | null;
    co: number | null;
    ozone: number | null;
  };
  prominent_pollutant: string;
}

export interface HistoricalCalendarResponse {
  city: string;
  year: number;
  month: number;
  month_name: string;
  period_label: string;
  days_in_month: number;
  first_weekday: number;
  monitored_days: number;
  valid_aqi_days: number;
  completeness_pct: number;
  mean_aqi: number | null;
  max_aqi: number | null;
  min_aqi: number | null;
  std_aqi: number | null;
  overall_category: AQICategory;
  category_distribution: Record<string, number>;
  pollutant_averages: Record<string, number>;
  calendar_days: CalendarDayData[];
  is_partial_month: boolean;
  status_note: string | null;
}

export interface HistoricalMonthlyPoint {
  month: number;
  month_name: string;
  short_name: string;
  mean_aqi: number | null;
  max_aqi: number | null;
  min_aqi: number | null;
  category: string;
  color: string;
  badge: string;
  status: 'complete' | 'partial' | 'missing';
  total_days: number;
  recorded_days: number;
  valid_aqi_days: number;
  completeness_pct: number;
  pollutants: {
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    so2: number | null;
    co: number | null;
    ozone: number | null;
  };
}

export interface MonthComparePoint {
  month: number;
  short_name: string;
  mean_aqi: number | null;
}

export interface HistoricalMonthlyResponse {
  city: string;
  year: number;
  monthly_data: HistoricalMonthlyPoint[];
  comparisons: Record<string, MonthComparePoint[]>;
  best_month: {
    month: number;
    name: string;
    mean_aqi: number;
  } | null;
  worst_month: {
    month: number;
    name: string;
    mean_aqi: number;
  } | null;
  valid_months_count: number;
  annual_mean_aqi: number | null;
}

export interface HistoricalYearlyRecord {
  year: number;
  mean_aqi: number | null;
  max_aqi: number | null;
  min_aqi: number | null;
  category: string;
  color: string;
  badge: string;
  selected_pollutant: string;
  pollutant_mean: number | null;
  pollutant_unit: string;
  yoy_aqi_change: number | null;
  yoy_pollutant_change: number | null;
  total_recorded_days: number;
  valid_aqi_days: number;
  months_count: number;
  is_partial: boolean;
  partial_reason: string | null;
  pollutants: Record<string, number | null>;
}

export interface HistoricalYearlyResponse {
  city: string;
  selected_pollutant: string;
  years_count: number;
  min_year: number;
  max_year: number;
  yearly_records: HistoricalYearlyRecord[];
  cleanest_year: HistoricalYearlyRecord | null;
  worst_year: HistoricalYearlyRecord | null;
  overall_trend_direction: 'improving' | 'deteriorating' | 'stable';
}

export interface HistoricalTableRecord {
  date: string;
  city: string;
  aqi: number | null;
  category: string;
  color: string;
  badge: string;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  co: number | null;
  ozone: number | null;
  status: 'complete' | 'partial' | 'missing';
  prominent_pollutant: string;
}

export interface HistoricalTableResponse {
  city: string;
  total_records: number;
  total_pages: number;
  page: number;
  page_size: number;
  sort_col: string;
  sort_dir: 'asc' | 'desc';
  records: HistoricalTableRecord[];
}

export interface ClusterProfile {
  cluster_id: number;
  rank_order: number;
  label: string;
  badge: string;
  color: string;
  description: string;
  observations_count: number;
  percentage: number;
  average_pollutants: Record<string, number>;
  possible_explanations: string[];
}

export interface ClusteringResponse {
  available: boolean;
  n_clusters: number;
  silhouette_score: number;
  pollutant_features: string[];
  profiles: ClusterProfile[];
  selected_city: string;
  selected_city_distribution: Array<{
    cluster_id: number;
    label: string;
    color: string;
    observations: number;
    percentage: number;
  }>;
  cross_city_comparison: Array<{
    city: string;
    total_observations: number;
    distribution: Record<string, number>;
  }>;
  scientific_guardrail: string;
  message?: string;
}

export interface HotspotCity {
  city: string;
  state: string;
  region: string;
  latitude: number;
  longitude: number;
  stations_count?: number;
  mean_aqi: number;
  latest_aqi: number;
  max_aqi: number;
  min_aqi: number;
  mean_pm25: number;
  mean_pm10: number;
  mean_no2: number;
  poor_hours_count: number;
  elevated_percentage: number;
  observations_count: number;
  category: string;
  color: string;
  badge: string;
  analysis_period: string;
  is_top_hotspot: boolean;
  hotspot_rank: number | null;
  hotspot_explanation: string;
  latest_date?: string;
}

export interface HotspotsResponse {
  analysis_period: string;
  is_date_filtered: boolean;
  total_cities_evaluated: number;
  top_hotspots_count: number;
  top_hotspots: HotspotCity[];
  all_city_rankings: HotspotCity[];
  national_center: {
    lat: number;
    lon: number;
    zoom: number;
  };
  selection_criteria: string;
}

export interface ExternalDatasetAudit {
  repository: string;
  local_storage_path: string;
  status: string;
  historical_telemetry: {
    filename: string;
    rows: number;
    columns: number;
    cities: string[];
    date_range: [string, string];
    provenance: string;
  };
  forecast_telemetry: {
    filename: string;
    rows: number;
    columns: number;
    date_range: [string, string];
    is_ground_truth: boolean;
    provenance: string;
  };
  comparison_with_active_dataset: {
    active_dataset: string;
    active_cities: string[];
    active_date_range: [string, string];
    active_rows: number;
    overlap_window: string;
    pm25_correlation: number;
    aqi_correlation: number;
    cpcb_methodology_distinction: string;
  };
}

export interface MatchedPoint {
  date: string;
  display_label: string;
  observed_aqi: number;
  predicted_aqi: number;
  absolute_diff: number;
}

export interface LiveVsPredictionResponse {
  city: string;
  today_date: string;
  today_formatted: string;
  observation_date: string;
  observation_display_date: string;
  observation_timestamp: string;
  is_live: boolean;
  today_live_available?: boolean;
  warning_message?: string | null;
  data_source: string;
  station_count: number;
  freshness_status: string;
  freshness_note: string;
  observed: {
    aqi: number | null;
    is_available?: boolean;
    category: string;
    color: string;
    badge: string;
    pollutants: Record<string, number>;
    timestamp?: string;
    display_date?: string;
    data_source?: string;
    is_live?: boolean;
  };
  latest_historical_observation?: {
    aqi: number;
    category: string;
    color: string;
    badge: string;
    date: string;
    display_date: string;
    timestamp: string;
    data_source: string;
    station_count?: number;
    pollutants: Record<string, number>;
    is_historical: boolean;
  };
  predicted: {
    aqi: number;
    category: string;
    color: string;
    badge: string;
    model_name: string;
    model_type: string;
    prediction_date?: string;
    prediction_date_formatted?: string;
    prediction_timestamp: string;
    confidence_interval: {
      lower: number;
      upper: number;
      level: string;
    };
  };
  comparison: {
    comparison_available?: boolean;
    absolute_difference: number | null;
    percentage_error: number | null;
    category_match: boolean | null;
    rank_difference: number | null;
    match_status: string;
    match_tone: 'positive' | 'neutral' | 'warning';
    evaluation_text: string;
  };
  matched_series: MatchedPoint[];
  model_performance_summary: {
    horizon_1_test_mae: number;
    horizon_1_test_rmse: number;
    horizon_1_test_r2: number;
    horizon_1_baseline_mae: number;
    category_accuracy: number;
    evaluation_partition: string;
    validation_approach: string;
  };
  scientific_disclosure: string;
}

