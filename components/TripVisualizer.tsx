import React from 'react';
import { BirdStatus, TripConfig } from '../types';
import { FLY_OUT_DURATION_MIN, FLY_BACK_DURATION_MIN } from '../constants';

interface TripVisualizerProps {
  trip: TripConfig;
  currentElapsedMinutes: number;
}

const TripVisualizer: React.FC<TripVisualizerProps> = ({ trip, currentElapsedMinutes }) => {
  const { totalDurationMinutes, status, destinationName, actualDistanceMeters, radiusMeters } = trip;
  
  const stayDuration = totalDurationMinutes - FLY_OUT_DURATION_MIN - FLY_BACK_DURATION_MIN;
  
  let statusText = '';
  let progressPercent = 0;
  
  // Mystery Mode: Hide name if flying out
  const displayDestinationName = status === BirdStatus.FLYING_OUT ? '神秘地點 ???' : destinationName;

  if (status === BirdStatus.FLYING_OUT) {
    statusText = `正飛往 ${displayDestinationName}...`;
    progressPercent = (currentElapsedMinutes / FLY_OUT_DURATION_MIN) * 33;
  } else if (status === BirdStatus.STAYING) {
    const stayingElapsed = currentElapsedMinutes - FLY_OUT_DURATION_MIN;
    statusText = `正在探索 ${displayDestinationName}...`;
    // Map the staying duration to the middle 33% of the bar (33% to 66%)
    progressPercent = 33 + ((stayingElapsed / stayDuration) * 33);
  } else if (status === BirdStatus.FLYING_BACK) {
    statusText = `正在返家...`;
    const returnElapsed = currentElapsedMinutes - (FLY_OUT_DURATION_MIN + stayDuration);
    progressPercent = 66 + ((returnElapsed / FLY_BACK_DURATION_MIN) * 34);
  }

  // Clamping
  progressPercent = Math.min(100, Math.max(0, progressPercent));

  // Determine which distance to show (Actual calculated distance preferred, fallback to radius)
  const distanceToShow = actualDistanceMeters !== undefined ? actualDistanceMeters : radiusMeters;

  // Convert to KM for display if > 1000m
  const distanceDisplay = distanceToShow >= 1000 
    ? `${(distanceToShow / 1000).toFixed(1)} 公里` 
    : `${Math.round(distanceToShow)} 公尺`;

  return (
    <div className="w-full bg-white rounded-xl p-4 shadow-sm border border-sky-100">
      <div className="flex justify-between items-end mb-2">
        <span className="font-bold text-sky-800">{statusText}</span>
        <span className="text-xs text-sky-500">
           實際距離: {distanceDisplay}
        </span>
      </div>
      
      <div className="relative h-4 bg-sky-100 rounded-full overflow-hidden">
        <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-sky-400 to-indigo-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
        />
      </div>
      
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>家</span>
        <span>{status === BirdStatus.FLYING_OUT ? '???' : '目的地'}</span>
        <span>家</span>
      </div>
    </div>
  );
};

export default TripVisualizer;