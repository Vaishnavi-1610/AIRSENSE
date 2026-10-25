import React, { useState } from 'react';
import { History, Layers, MapPin } from 'lucide-react';
import { HistoricalPage } from './HistoricalPage';
import { ClusteringPage } from './ClusteringPage';
import { HotspotMapPage } from './HotspotMapPage';

interface PollutionAnalysisPageProps {
  availableCities: string[];
  initialCity?: string;
  selectedCity?: string;
  onSelectCity?: (city: string) => void;
  initialSubTab?: 'trends' | 'clustering' | 'hotspots';
}

export const PollutionAnalysisPage: React.FC<PollutionAnalysisPageProps> = ({
  availableCities,
  initialCity = 'Pune',
  selectedCity,
  onSelectCity,
  initialSubTab = 'trends',
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'trends' | 'clustering' | 'hotspots'>(
    initialSubTab === 'hotspots' ? 'trends' : initialSubTab
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Module Sub-Navigation Switcher */}
      <div className="card-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-navy-900 dark:text-slate-100">
            Comprehensive Pollution Analysis
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Multi-pollutant telemetry trends and unsupervised atmospheric clustering
          </p>
        </div>

        {/* Sub-tab pills */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('trends')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'trends'
                ? 'bg-teal-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Pollutant Trends</span>
          </button>

          <button
            onClick={() => setActiveSubTab('clustering')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'clustering'
                ? 'bg-teal-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Pattern Clustering</span>
          </button>

          {/* Temporarily hidden for hackathon: Hotspot Map
          <button
            onClick={() => setActiveSubTab('hotspots')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeSubTab === 'hotspots'
                ? 'bg-teal-600 text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-100'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Hotspot Map</span>
          </button>
          */}
        </div>
      </div>

      {/* Render selected analytical view */}
      {activeSubTab === 'trends' && (
        <HistoricalPage
          availableCities={availableCities}
          initialCity={initialCity}
          selectedCity={selectedCity}
          onSelectCity={onSelectCity}
        />
      )}

      {activeSubTab === 'clustering' && (
        <ClusteringPage
          availableCities={availableCities}
          initialCity={initialCity}
          selectedCity={selectedCity}
          onSelectCity={onSelectCity}
        />
      )}

      {/* Temporarily hidden for hackathon: Hotspot Map
      {activeSubTab === 'hotspots' && (
        <HotspotMapPage />
      )}
      */}
    </div>
  );
};
