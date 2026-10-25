import React from 'react';
import { Calendar, Building2, MapPin, RefreshCw, Sun, Moon } from 'lucide-react';

interface NavbarProps {
  pageTitle: string;
  pageSubtitle: string;
  minDate?: string;
  maxDate?: string;
  citiesCount?: number;
  stationsCount?: number;
  onRefresh?: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  pageTitle,
  pageSubtitle,
  minDate = '2023-01-01',
  maxDate = '2025-09-30',
  citiesCount = 10,
  stationsCount = 22,
  onRefresh,
  isDark = false,
  onToggleTheme,
}) => {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200/90 dark:border-slate-800 px-6 md:px-8 py-3.5 sticky top-0 z-20 shadow-xs transition-colors duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Page Title & Context */}
        <div>
          <h2 className="text-lg md:text-xl font-extrabold text-navy-900 dark:text-slate-100 tracking-tight">
            {pageTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {pageSubtitle}
          </p>
        </div>

        {/* Right: Telemetry status pills & Theme Switcher */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Smart Cities Telemetry Scope pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
            <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{citiesCount} Smart Cities</span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{stationsCount} CAAQM Nodes</span>
          </div>

          {/* Theme Toggle Button (Light / Dark Mode) */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors border border-slate-200/80 dark:border-slate-700"
              title={isDark ? "Switch to Light Theme" : "Switch to Dark Theme"}
              aria-label="Toggle theme"
            >
              {isDark ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span className="text-xs font-semibold">Dark</span>
                </>
              )}
            </button>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh Telemetry Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* CPCB NAQI Range Guide Banner */}
      <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 hidden lg:flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-700 dark:text-slate-300">CPCB NAQI Index Scale:</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <strong className="text-slate-700 dark:text-slate-300">Good:</strong> 0–50
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-lime-500" />
            <strong className="text-slate-700 dark:text-slate-300">Satisfactory:</strong> 51–100
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <strong className="text-slate-700 dark:text-slate-300">Moderate:</strong> 101–200
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <strong className="text-slate-700 dark:text-slate-300">Poor:</strong> 201–300
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <strong className="text-slate-700 dark:text-slate-300">Very Poor:</strong> 301–400
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-900" />
            <strong className="text-slate-700 dark:text-slate-300">Severe:</strong> 401–500
          </span>
        </div>
      </div>
    </header>
  );
};
