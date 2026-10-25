import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { PredictionPage } from './pages/PredictionPage';
import { LiveVsPredictionPage } from './pages/LiveVsPredictionPage';
import { AlertCenterPage } from './pages/AlertCenterPage';
import { PollutionAnalysisPage } from './pages/PollutionAnalysisPage';
import { DatasetInfo, NavTab } from './types';
import { api } from './services/api';
import { LoadingSpinner } from './components/LoadingSpinner';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [selectedCity, setSelectedCity] = useState<string>('Pune');
  const [datasetInfo, setDatasetInfo] = useState<DatasetInfo | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Theme Management (Light / Dark Mode with Persistence)
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch {
      // Ignore in non-browser or restricted contexts
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [info, cityList] = await Promise.all([
        api.getDatasetInfo(),
        api.getCities(),
      ]);
      setDatasetInfo(info);
      setCities(cityList);
      if (cityList.length > 0 && !cityList.includes(selectedCity)) {
        setSelectedCity(cityList[0]);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to initialize atmospheric telemetry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Guard against navigating to temporarily hidden tabs (alerts / hotspots)
  useEffect(() => {
    if ((currentTab as string) === 'alerts' || (currentTab as string) === 'hotspots') {
      setCurrentTab('dashboard');
    }
  }, [currentTab]);

  const pageMeta: Record<string, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Indian Smart City Air Quality Dashboard',
      subtitle: 'Real-time observation telemetry, CPCB NAQI evaluation, and targeted citizen advisories',
    },
    prediction: {
      title: 'Future Air Quality Forecasting (5-Day Outlook)',
      subtitle: 'Multi-horizon daily forecasts (+1d to +5d) with calibrated uncertainty bounds and trend analysis',
    },
    live_vs_pred: {
      title: 'Live Observed AQI vs. Our Model Prediction',
      subtitle: 'Side-by-side comparison with zero future leakage, error metrics, and timeline verification',
    },
    alerts: {
      title: 'Alerts & Recommendations Center',
      subtitle: 'City-specific threshold alerts, observed vs. forecast warning events, and verified precautions',
    },
    analysis: {
      title: 'Multi-Pollutant Telemetry & Pattern Analysis',
      subtitle: 'Historical trends and unsupervised atmospheric clustering',
    },
    historical: {
      title: 'Historical Atmospheric Telemetry Analysis',
      subtitle: 'Multi-pollutant historical trends, statistical distributions, and chronological baseline comparisons',
    },
    clustering: {
      title: 'Atmospheric Multi-Pollutant Pattern Clustering',
      subtitle: 'Unsupervised grouping of atmospheric observations based on standardized particulate and gas profiles',
    },
    hotspots: {
      title: 'Pollution Hotspot Detection on India Map',
      subtitle: 'Interactive national map highlighting top Indian cities with highest air pollution levels',
    },
  };

  const currentMeta = pageMeta[currentTab] || pageMeta.dashboard;

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-200">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isDark={isDark}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto">
        <Navbar
          pageTitle={currentMeta.title}
          pageSubtitle={currentMeta.subtitle}
          minDate={datasetInfo?.min_date}
          maxDate={datasetInfo?.max_date}
          citiesCount={datasetInfo?.unique_cities_count || cities.length}
          stationsCount={datasetInfo?.unique_stations_count}
          onRefresh={fetchInitialData}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />

        <main className="flex-1 p-5 md:p-8 max-w-7xl w-full mx-auto">
          {loading && !datasetInfo ? (
            <div className="card-panel my-12 p-12">
              <LoadingSpinner message="Initializing Smart City Environmental Dashboard..." />
            </div>
          ) : error && !datasetInfo ? (
            <div className="card-panel p-8 text-center text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800">
              <h3 className="text-base font-bold mb-2">System Telemetry Connection Error</h3>
              <p className="text-xs max-w-md mx-auto mb-4">{error}</p>
              <button
                onClick={fetchInitialData}
                className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs"
              >
                Retry Connection
              </button>
            </div>
          ) : (
            <>
              {currentTab === 'dashboard' && (
                <DashboardPage
                  availableCities={cities}
                  selectedCity={selectedCity}
                  onSelectCity={setSelectedCity}
                  onNavigate={setCurrentTab}
                  isDark={isDark}
                />
              )}

              {currentTab === 'prediction' && (
                <PredictionPage
                  availableCities={cities}
                  selectedCity={selectedCity}
                  onSelectCity={setSelectedCity}
                  isDark={isDark}
                />
              )}

              {currentTab === 'live_vs_pred' && (
                <LiveVsPredictionPage
                  availableCities={cities}
                  selectedCity={selectedCity}
                  onSelectCity={setSelectedCity}
                  isDark={isDark}
                />
              )}

              {/* Temporarily hidden for hackathon: Alerts & Recommendations Center
              {currentTab === 'alerts' && (
                <AlertCenterPage
                  availableCities={cities}
                  selectedCity={selectedCity}
                  onSelectCity={setSelectedCity}
                  isDark={isDark}
                />
              )}
              */}

              {(currentTab === 'analysis' || currentTab === 'historical' || currentTab === 'clustering') && (
                <PollutionAnalysisPage
                  availableCities={cities}
                  selectedCity={selectedCity}
                  onSelectCity={setSelectedCity}
                  initialSubTab={
                    currentTab === 'clustering' ? 'clustering' : 'trends'
                  }
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};
