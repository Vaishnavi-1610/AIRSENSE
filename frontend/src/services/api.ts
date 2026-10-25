import axios from 'axios';
import {
  DatasetInfo,
  DashboardCityData,
  DailyForecastResponse,
  HistoricalAnalysisResponse,
  HistoricalMetadataResponse,
  HistoricalCalendarResponse,
  HistoricalMonthlyResponse,
  HistoricalYearlyResponse,
  HistoricalTableResponse,
  ClusteringResponse,
  HotspotsResponse,
  LiveVsPredictionResponse,
  HighPollutionAlertSummary
} from '../types';

const API_BASE = '/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 45000,
});

export const api = {
  // Dataset & Cities
  getDatasetInfo: async (): Promise<DatasetInfo> => {
    const res = await apiClient.get<DatasetInfo>('/dataset/info');
    return res.data;
  },

  getCities: async (): Promise<string[]> => {
    const res = await apiClient.get<string[]>('/cities');
    return res.data;
  },

  // 1. Dashboard
  getDashboardCityData: async (params: {
    city: string;
    target_date?: string;
    reference_date?: string;
  }): Promise<DashboardCityData> => {
    const res = await apiClient.get<DashboardCityData>('/dashboard/city-data', { params });
    return res.data;
  },

  // 2. AQI Prediction (1 to 5 days)
  getDailyPrediction: async (params: {
    city: string;
    days: number;
    reference_date?: string;
  }): Promise<DailyForecastResponse> => {
    const res = await apiClient.get<DailyForecastResponse>('/predict/daily', { params });
    return res.data;
  },

  // 3. Live AQI vs Model Prediction
  getLiveVsPrediction: async (params: { city: string; reference_date?: string }): Promise<LiveVsPredictionResponse> => {
    const res = await apiClient.get<LiveVsPredictionResponse>('/compare/live-vs-prediction', { params });
    return res.data;
  },

  refreshLiveAqi: async (params: { city: string; reference_date?: string }): Promise<{ status: string; message: string; data: LiveVsPredictionResponse }> => {
    const res = await apiClient.post('/compare/refresh-live', null, { params });
    return res.data;
  },

  // High Pollution Alerts
  getHighPollutionAlerts: async (params: {
    city: string;
    threshold?: number;
    reference_date?: string;
  }): Promise<HighPollutionAlertSummary> => {
    const res = await apiClient.get<HighPollutionAlertSummary>('/alerts/high-pollution', { params });
    return res.data;
  },

  // 4. Historical Analysis (Supports City, Year, Month or date range)
  getHistoricalAnalysis: async (params: {
    city: string;
    year?: number;
    month?: number;
    start_date?: string;
    end_date?: string;
  }): Promise<HistoricalAnalysisResponse> => {
    const res = await apiClient.get<HistoricalAnalysisResponse>('/historical/analyze', { params });
    return res.data;
  },

  // Historical Analysis Suite
  getHistoricalMetadata: async (city?: string): Promise<HistoricalMetadataResponse> => {
    const res = await apiClient.get<HistoricalMetadataResponse>('/historical/metadata', {
      params: city ? { city } : {}
    });
    return res.data;
  },

  getHistoricalCalendar: async (params: {
    city: string;
    year: number;
    month: number;
  }): Promise<HistoricalCalendarResponse> => {
    const res = await apiClient.get<HistoricalCalendarResponse>('/historical/calendar', { params });
    return res.data;
  },

  getHistoricalMonthly: async (params: {
    city: string;
    year: number;
    compare_years?: string;
  }): Promise<HistoricalMonthlyResponse> => {
    const res = await apiClient.get<HistoricalMonthlyResponse>('/historical/monthly', { params });
    return res.data;
  },

  getHistoricalYearly: async (params: {
    city: string;
    pollutant?: string;
  }): Promise<HistoricalYearlyResponse> => {
    const res = await apiClient.get<HistoricalYearlyResponse>('/historical/yearly', { params });
    return res.data;
  },

  getHistoricalTable: async (params: {
    city: string;
    year?: number;
    month?: number;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
    sort_col?: string;
    sort_dir?: string;
  }): Promise<HistoricalTableResponse> => {
    const res = await apiClient.get<HistoricalTableResponse>('/historical/table', { params });
    return res.data;
  },

  // 4. Pollution Clustering
  getClusteringAnalysis: async (params?: {
    n_clusters?: number;
    city?: string;
  }): Promise<ClusteringResponse> => {
    const res = await apiClient.get<ClusteringResponse>('/clustering/analysis', { params });
    return res.data;
  },

  // 5. Hotspot Detection on India Map
  getIndiaHotspots: async (target_date?: string): Promise<HotspotsResponse> => {
    const res = await apiClient.get<HotspotsResponse>('/hotspots/india', {
      params: target_date ? { target_date } : {}
    });
    return res.data;
  },

  // 6. Model Evaluation Metrics
  getModelMetrics: async (): Promise<any> => {
    const res = await apiClient.get('/model/metrics');
    return res.data;
  },

  // 7. External GitHub Dataset Audit
  getExternalDatasetAudit: async (): Promise<any> => {
    const res = await apiClient.get('/dataset/external-audit');
    return res.data;
  },

  // CSV Ingestion & Reset
  uploadCSV: async (file: File): Promise<{ message: string; report: DatasetInfo }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/dataset/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  resetDefaultDataset: async (): Promise<{ message: string; report: DatasetInfo }> => {
    const res = await apiClient.post('/dataset/reset-default');
    return res.data;
  },
};
