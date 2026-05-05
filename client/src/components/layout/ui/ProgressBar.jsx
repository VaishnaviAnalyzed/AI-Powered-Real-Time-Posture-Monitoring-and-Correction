import React from 'react';

const ProgressBar = ({ progress = 0, className = '' }) => {
  // Ensure progress is bounded between 0 and 100
  const normalizedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className={`w-full bg-gray-200 rounded-full h-2.5 overflow-hidden ${className}`}>
      <div
        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
        style={{ width: `${normalizedProgress}%` }}
      />
    </div>
  );
};

export default ProgressBar;
