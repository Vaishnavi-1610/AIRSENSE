import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  Layers,
  Search,
  Info,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  PieChart as PieIcon,
  BarChart2
} from 'lucide-react';
import { ClusteringResponse } from '../types';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface ClusteringPageProps {
  availableCities: string[];
  initialCity?: string;
  selectedCity?: string;
  onSelectCity?: (city: string) => void;
  isDark?: boolean;
}

export const ClusteringPage: React.FC<ClusteringPageProps> = ({
  availableCities,
  initialCity = 'Pune',
  selectedCity: propCity,
  onSelectCity,
  isDark = false,
}) => {
  const [selectedCity, setSelectedCity] = useState<string>(propCity || initialCity);

  useEffect(() => {
    if (propCity && propCity !== selectedCity) {
      setSelectedCity(propCity);
    }
  }, [propCity]);

  const [clusterCount, setClusterCount] = useState<number>(3); // 2 to 4
  const [data, setData] = useState<ClusteringResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClustering = async (k: number, city: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getClusteringAnalysis({ n_clusters: k, city });
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Clustering error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClustering(clusterCount, selectedCity);
  }, [clusterCount, selectedCity]);

  // Transform cluster average pollutants into Recharts bar chart format
  const clusterChartData = React.useMemo(() => {
    if (!data || !data.profiles) return [];
    const pollutants = data.pollutant_features;

    return pollutants.map((pol) => {
      const row: any = { pollutant: pol.toUpperCase() };
      data.profiles.forEach((p) => {
        row[p.label] = p.average_pollutants[pol] || 0;
      });
      return row;
    });
  }, [data]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Filter Card */}
      <div className="card-panel p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h3 className="text-base font-bold text-navy-900 dark:text-slate-100">
                Atmospheric Multi-Pollutant Pattern Clustering
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Unsupervised grouping of atmospheric observations based on standardized particulate and gas profiles
            </p>
          </div>

          {/* Cluster count selector */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-semibold self-start lg:self-auto">
            <span className="text-[11px] text-slate-400 dark:text-slate-500 px-2 uppercase tracking-wider font-bold">Clusters:</span>
            {[2, 3, 4].map((k) => (
              <button
                key={k}
                onClick={() => setClusterCount(k)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  clusterCount === k
                    ? 'bg-teal-600 text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-100'
                }`}
              >
                k={k}
              </button>
            ))}
          </div>
        </div>

        {/* City Filter Selection */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
              <Search className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" /> Target City Profile:
            </label>
            <select
              value={selectedCity}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCity(val);
                onSelectCity?.(val);
              }}
              className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 min-w-[200px]"
            >
              {availableCities.map((c) => (
                <option key={c} value={c}>
                  {c} (Active Telemetry)
                </option>
              ))}
            </select>
          </div>

          {data && data.silhouette_score && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Silhouette Quality Score: <strong className="text-teal-700 dark:text-teal-400">{data.silhouette_score}</strong>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card-panel my-8 p-12">
          <LoadingSpinner message="Grouping multi-pollutant observations into clusters..." />
        </div>
      ) : error ? (
        <div className="card-panel p-6 text-center text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-rose-500" />
          <h4 className="text-sm font-bold">Clustering pipeline error</h4>
          <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{error}</p>
        </div>
      ) : data && data.available ? (
        <>
          {/* Scientific Disclaimer Alert (Section 5 Requirement) */}
          <div className="card-panel p-4 bg-slate-50 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-start gap-3">
            <Info className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong>Atmospheric Pattern Guardrail:</strong> {data.scientific_guardrail}
            </div>
          </div>

          {/* Identified Pollution Clusters Grid */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
              Identified Pollution Profiles ({data.profiles.length} Profiles Identified)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {data.profiles.map((prof) => (
                <div
                  key={prof.cluster_id}
                  className="card-panel p-6 flex flex-col justify-between border-t-4"
                  style={{ borderTopColor: prof.color }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${prof.badge}`}>
                        {prof.label}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                        {prof.percentage}% ({prof.observations_count.toLocaleString()} obs)
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2.5 leading-relaxed">
                      {prof.description}
                    </p>

                    {/* Average Pollutant Concentrations */}
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                        Mean Pollutant Signatures
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {Object.entries(prof.average_pollutants).map(([pol, val]) => (
                          <div key={pol} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                            <div className="text-[10px] font-bold uppercase text-slate-400">{pol}</div>
                            <div className="text-xs font-black text-navy-900 dark:text-slate-100 mt-0.5">{val}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Possible Explanations */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                      Potential Contributing Factors
                    </div>
                    <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {prof.possible_explanations.map((exp, idx) => (
                        <li key={idx} className="flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-slate-400" />
                          <span>{exp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comparative Cluster Profile Bar Chart */}
          <div className="card-panel p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">
                  Cluster Pollutant Signature Comparison
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comparing average measured pollutant values across identified atmospheric clusters
                </p>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Standardized Atmospheric Metrics</span>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clusterChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
                  <XAxis dataKey="pollutant" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                      borderRadius: '12px',
                      color: isDark ? '#f8fafc' : '#0f172a',
                      fontSize: '11px',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  {data.profiles.map((p) => (
                    <Bar key={p.cluster_id} dataKey={p.label} fill={p.color} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Selected City Distribution & Cross-City Comparison Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Selected City Distribution */}
            <div className="card-panel p-6">
              <div className="flex items-center gap-2 mb-1">
                <PieIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">
                  {selectedCity}: Cluster Distribution
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Proportion of observation hours {selectedCity} spends in each atmospheric profile
              </p>

              <div className="space-y-3">
                {data.selected_city_distribution.map((dist) => (
                  <div key={dist.cluster_id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between text-xs mb-1.5 font-semibold">
                      <span className="text-slate-800 dark:text-slate-200">{dist.label}</span>
                      <span className="font-bold" style={{ color: dist.color }}>
                        {dist.percentage}% ({dist.observations} obs)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${dist.percentage}%`, backgroundColor: dist.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cross-City Comparison Table */}
            <div className="card-panel p-6">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h4 className="text-sm font-bold text-navy-900 dark:text-slate-100">
                  Cross-City Cluster Breakdown
                </h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Comparing pollution profile prevalence across all monitored Indian smart cities
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50/70 dark:bg-slate-800/60">
                      <th className="py-2.5 px-3">City</th>
                      {data.profiles.map((p) => (
                        <th key={p.cluster_id} className="py-2.5 px-2 text-center truncate max-w-[100px]" title={p.label}>
                          {p.label.split(' ')[0]} %
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.cross_city_comparison.map((c) => (
                      <tr
                        key={c.city}
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/80 transition-colors ${
                          c.city.toLowerCase() === selectedCity.toLowerCase()
                            ? 'bg-teal-50/40 dark:bg-teal-950/40 font-bold text-teal-950 dark:text-teal-200'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold">{c.city}</td>
                        {data.profiles.map((p) => (
                          <td key={p.cluster_id} className="py-2.5 px-2 text-center font-mono">
                            {c.distribution[p.label] || 0}%
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card-panel p-8 text-center text-slate-500 dark:text-slate-400">
          Insufficient data to run clustering analysis.
        </div>
      )}
    </div>
  );
};
