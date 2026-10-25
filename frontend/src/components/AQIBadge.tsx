import React from 'react';

interface AQIBadgeProps {
  category?: string;
  value?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showValue?: boolean;
}

export const getCategoryStyles = (category?: string) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('good')) {
    return {
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
      dot: 'bg-emerald-500',
      label: 'Good (0-50)'
    };
  }
  if (cat.includes('satisfactory')) {
    return {
      bg: 'bg-lime-50 text-lime-800 border-lime-300',
      dot: 'bg-lime-500',
      label: 'Satisfactory (51-100)'
    };
  }
  if (cat.includes('moderate')) {
    return {
      bg: 'bg-amber-50 text-amber-800 border-amber-300',
      dot: 'bg-amber-500',
      label: 'Moderate (101-200)'
    };
  }
  if (cat.includes('very poor')) {
    return {
      bg: 'bg-red-50 text-red-800 border-red-300',
      dot: 'bg-red-500',
      label: 'Very Poor (301-400)'
    };
  }
  if (cat.includes('poor')) {
    return {
      bg: 'bg-orange-50 text-orange-800 border-orange-300',
      dot: 'bg-orange-500',
      label: 'Poor (201-300)'
    };
  }
  if (cat.includes('severe')) {
    return {
      bg: 'bg-rose-950 text-white border-rose-900',
      dot: 'bg-rose-400',
      label: 'Severe (401-500)'
    };
  }
  return {
    bg: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-400',
    label: category || 'Unknown'
  };
};

export const AQIBadge: React.FC<AQIBadgeProps> = ({ category, value, size = 'md', showValue = false }) => {
  const styles = getCategoryStyles(category);

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1.5',
    md: 'text-xs font-semibold px-2.5 py-1 gap-2',
    lg: 'text-sm font-bold px-3 py-1.5 gap-2.5'
  }[size];

  return (
    <span className={`inline-flex items-center rounded-full border ${styles.bg} ${sizeClasses}`}>
      <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
      <span>{category || 'Unknown'}</span>
      {showValue && value !== undefined && value !== null && (
        <span className="font-bold opacity-80">({Math.round(value)})</span>
      )}
    </span>
  );
};
