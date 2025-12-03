import React, { useEffect, useState, useRef } from 'react';
import { BirdStatus, Coordinates, TripConfig } from '../types';
import { FLY_OUT_DURATION_MIN, FLY_BACK_DURATION_MIN } from '../constants';
import BirdAvatar from './BirdAvatar';

interface MapTrackerProps {
  trip: TripConfig;
  homeCoords: Coordinates;
  birdType: any; 
}

const MapTracker: React.FC<MapTrackerProps> = ({ trip, homeCoords, birdType }) => {
  // Logic Position (Updated every 1s)
  const [currentPos, setCurrentPos] = useState<Coordinates>(homeCoords);
  // Visual Map Center (Updated every 5s to prevent flickering)
  const [mapCenter, setMapCenter] = useState<Coordinates>(homeCoords);
  
  const { destinationCoords, startTime, totalDurationMinutes, status, destinationName } = trip;
  const lastMapUpdateTime = useRef<number>(0);

  // Update logic position
  useEffect(() => {
    const updatePosition = () => {
      const now = Date.now();
      const elapsedMinutes = (now - startTime) / (60000);
      
      const dest = destinationCoords || homeCoords; // Fallback
      
      let progress = 0;
      let start: Coordinates = homeCoords;
      let end: Coordinates = dest;

      if (status === BirdStatus.FLYING_OUT) {
        // 0 to 10 mins
        progress = Math.min(1, elapsedMinutes / FLY_OUT_DURATION_MIN);
        start = homeCoords;
        end = dest;
      } else if (status === BirdStatus.STAYING) {
        // Staying at destination
        progress = 1;
        start = dest;
        end = dest;
      } else if (status === BirdStatus.FLYING_BACK) {
        // Total - 10 to Total
        const stayDuration = totalDurationMinutes - FLY_OUT_DURATION_MIN - FLY_BACK_DURATION_MIN;
        const returnStartTime = FLY_OUT_DURATION_MIN + stayDuration;
        const returnElapsed = elapsedMinutes - returnStartTime;
        
        progress = Math.min(1, returnElapsed / FLY_BACK_DURATION_MIN);
        start = dest;
        end = homeCoords;
      }

      // Linear Interpolation
      const lat = start.lat + (end.lat - start.lat) * progress;
      const lng = start.lng + (end.lng - start.lng) * progress;
      
      const newPos = { lat, lng };
      setCurrentPos(newPos);

      // Throttle Map Iframe Updates (Every 5 seconds)
      // Or if it's the very first update
      if (now - lastMapUpdateTime.current > 5000 || lastMapUpdateTime.current === 0) {
        setMapCenter(newPos);
        lastMapUpdateTime.current = now;
      }
    };

    const interval = setInterval(updatePosition, 1000);
    updatePosition(); // Initial call

    return () => clearInterval(interval);
  }, [startTime, totalDurationMinutes, status, homeCoords, destinationCoords]);

  // Construct Google Maps Embed URL using the THROTTLED mapCenter
  const mapUrl = `https://maps.google.com/maps?q=${mapCenter.lat},${mapCenter.lng}&hl=zh-TW&z=14&output=embed`;

  let statusMessage = "";
  if (status === BirdStatus.FLYING_OUT) statusMessage = "🚀 飛往 神秘地點 ??? ...";
  else if (status === BirdStatus.STAYING) statusMessage = `📍 抵達 ${destinationName}！探索中...`;
  else if (status === BirdStatus.FLYING_BACK) statusMessage = "🏠 滿載而歸返家中...";

  return (
    <div className="w-full h-80 rounded-2xl overflow-hidden shadow-inner border-2 border-sky-200 relative bg-slate-100 group">
      {/* 
        pointerEvents: 'none' 
        This prevents the user from dragging/zooming the map, ensuring the map center 
        always matches the bird overlay. It creates a "locked camera" feel.
      */}
      <iframe
        width="100%"
        height="100%"
        style={{ border: 0, pointerEvents: 'none' }}
        loading="lazy"
        allowFullScreen
        src={mapUrl}
        title="Bird Location"
        className="transition-opacity duration-500"
      ></iframe>
      
      {/* Overlay Info */}
      <div className="absolute top-2 left-2 right-2 bg-white/90 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-white/50 z-10 flex items-center gap-3">
        <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center overflow-hidden border border-sky-300">
           <BirdAvatar type={birdType} status={BirdStatus.FLYING_OUT} size="sm" />
        </div>
        <div className="flex-1 min-w-0">
             <div className="text-xs text-sky-600 font-bold uppercase tracking-wider">即時位置追蹤</div>
             <div className="text-slate-800 font-bold truncate">{statusMessage}</div>
        </div>
      </div>

      {/* Lock Indicator */}
      <div className="absolute bottom-2 right-2 bg-black/40 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md pointer-events-none flex items-center gap-1">
        🔒 視角鎖定 (每5秒更新地圖)
      </div>

      {/* Center Marker Overlay */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none drop-shadow-2xl pb-8 z-20">
        <div className="animate-bounce">
            <BirdAvatar type={birdType} status={BirdStatus.FLYING_OUT} size="sm" />
        </div>
      </div>
    </div>
  );
};

export default MapTracker;