import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    positive?: boolean;
  };
  badge?: React.ReactNode;
  highlightColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  badge,
  highlightColor = 'teal',
}) => {
  return (
    <div className="card-panel p-5 relative overflow-hidden flex flex-col justify-between">
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase">{title}</span>
        {icon && (
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {icon}
          </div>
        )}
      </div>

      {/* Main value */}
      <div className="flex items-baseline gap-3 my-1">
        <span className="text-3xl font-extrabold text-navy-900 dark:text-slate-100 tracking-tight">{value}</span>
        {badge}
      </div>

      {/* Subtitle & Trend */}
      {(subtitle || trend) && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          {subtitle && <span>{subtitle}</span>}
          {trend && (
            <span
              className={`font-semibold ${
                trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
