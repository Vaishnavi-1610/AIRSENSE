import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
  subMessage?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = 'Processing Environmental Intelligence...',
  subMessage = 'Performing time-series regressions and model validation',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="relative mb-4">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
        <div className="w-3 h-3 rounded-full bg-teal-400 absolute top-3.5 left-3.5 pulse-dot" />
      </div>
      <h4 className="text-base font-semibold text-navy-900 mb-1">{message}</h4>
      {subMessage && <p className="text-xs text-slate-500 max-w-sm">{subMessage}</p>}
    </div>
  );
};
