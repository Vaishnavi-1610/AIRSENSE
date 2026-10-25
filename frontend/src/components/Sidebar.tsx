import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  GitCompare,
  BarChart2,
  Wind,
  ShieldCheck,
  Radio,
  Bell
} from 'lucide-react';
import { NavTab } from '../types';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isDark?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
}) => {
  const navItems = [
    {
      id: 'dashboard' as NavTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Current AQI, pollutants & advice',
    },
    {
      id: 'prediction' as NavTab,
      label: '5-Day Forecast',
      icon: TrendingUp,
      description: 'Predictions for tomorrow to +5d',
    },
    {
      id: 'live_vs_pred' as NavTab,
      label: 'Live vs Prediction',
      icon: GitCompare,
      description: 'Observed vs Model Estimate',
    },
    /* Temporarily hidden for hackathon:
    {
      id: 'alerts' as NavTab,
      label: 'Alerts & Recommendations',
      icon: Bell,
      description: 'Active warnings & precautions',
    },
    */
    {
      id: 'analysis' as NavTab,
      label: 'Pollution Analysis',
      icon: BarChart2,
      description: 'Trends & pattern clustering',
    },
  ];

  // Helper to map sub-tabs to active sidebar section
  const isTabActive = (itemTab: NavTab) => {
    if (currentTab === itemTab) return true;
    if (itemTab === 'analysis' && ['historical', 'clustering'].includes(currentTab)) {
      return true;
    }
    return false;
  };

  return (
    <aside className="w-64 md:w-72 bg-white dark:bg-slate-900 border-r border-slate-200/90 dark:border-slate-800 flex flex-col justify-between h-screen sticky top-0 shrink-0 z-30 select-none shadow-xs transition-colors duration-200">
      <div>
        {/* Brand header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
            <Wind className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-navy-900 dark:text-slate-100 tracking-tight leading-tight">
              AirSense India
            </h1>
            <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium">Smart City Air Quality Platform</p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Core Modules
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isTabActive(item.id);
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left transition-all ${
                  active
                    ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 font-semibold shadow-xs border border-teal-200 dark:border-teal-800/80'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-navy-900 dark:hover:text-slate-100 font-medium'
                }`}
              >
                <div
                  className={`p-1.5 rounded-lg ${
                    active
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{item.label}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{item.description}</div>
                </div>
                {active && (
                  <div className="w-1.5 h-6 bg-teal-600 dark:bg-teal-400 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Verified Platform Status Footer (No internal filenames or upload buttons) */}
      <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 m-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-teal-600 dark:text-teal-400 animate-pulse" /> Telemetry Feed
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> CPCB Verified
          </span>
        </div>
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
          Official CPCB CAAQM Network
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          Multi-pollutant telemetry across 10 smart cities
        </div>
      </div>
    </aside>
  );
};
