import React, { useState, useEffect, useCallback } from 'react';
import { BirdType, BirdStatus, BirdState, Souvenir, TripConfig, Coordinates } from './types';
import { FEED_COOLDOWN_MS, FEED_ENERGY_GAIN, TRIP_COOLDOWN_MS, MIN_TRIP_DURATION_MIN, MAX_TRIP_DURATION_MIN, FLY_OUT_DURATION_MIN, FLY_BACK_DURATION_MIN } from './constants';
import BirdAvatar from './components/BirdAvatar';
import TripVisualizer from './components/TripVisualizer';
import MapTracker from './components/MapTracker';
import { findDestination } from './services/geminiService';

const INITIAL_STATE: BirdState = {
  isInitialized: false,
  type: BirdType.SPARROW,
  name: '',
  energy: 0,
  lastFedTime: 0,
  lastTripTime: 0,
  currentTrip: null,
  history: []
};

// Translation map for Bird Types
const BIRD_TYPE_CN: Record<BirdType, string> = {
  [BirdType.SPARROW]: '麻雀',
  [BirdType.ROBIN]: '知更鳥',
  [BirdType.BLUE_JAY]: '冠藍鴉',
  [BirdType.COCKATIEL]: '玄鳳鸚鵡',
  [BirdType.PIGEON]: '鴿子'
};

// Haversine formula to calculate distance between two coordinates in meters
const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (coord1.lat * Math.PI) / 180;
  const φ2 = (coord2.lat * Math.PI) / 180;
  const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export default function App() {
  const [bird, setBird] = useState<BirdState>(INITIAL_STATE);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [isFeeding, setIsFeeding] = useState(false); // Animation state

  // Load from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('travel_bird_save');
    if (saved) {
      try {
        setBird(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load save", e);
      }
    }
    
    // Get Location immediately
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => {
          setLocationError("需要位置權限才能讓鳥兒飛行。");
          console.error(err);
        }
      );
    } else {
        setLocationError("您的瀏覽器不支援地理位置功能。");
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    if (bird.isInitialized) {
      localStorage.setItem('travel_bird_save', JSON.stringify(bird));
    }
  }, [bird]);

  // Main Game Loop (Status Updater)
  useEffect(() => {
    if (!bird.isInitialized) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // Handle Trip Logic
      if (bird.currentTrip) {
        const trip = bird.currentTrip;
        const elapsedMinutes = (now - trip.startTime) / (1000 * 60);

        // 1. Check if trip is finished
        if (elapsedMinutes >= trip.totalDurationMinutes) {
          handleTripComplete(trip);
        } 
        // 2. Check phase transitions
        else {
           let newStatus = trip.status;
           const stayDuration = trip.totalDurationMinutes - FLY_OUT_DURATION_MIN - FLY_BACK_DURATION_MIN;
           
           if (elapsedMinutes < FLY_OUT_DURATION_MIN) {
             newStatus = BirdStatus.FLYING_OUT;
           } else if (elapsedMinutes < (FLY_OUT_DURATION_MIN + stayDuration)) {
             newStatus = BirdStatus.STAYING;
           } else {
             newStatus = BirdStatus.FLYING_BACK;
           }

           if (newStatus !== trip.status) {
              setBird(prev => ({
                  ...prev,
                  currentTrip: { ...prev.currentTrip!, status: newStatus }
              }));
           }
        }
      } 
      // Handle Auto-Fly Logic
      else if (!bird.currentTrip && userLocation) {
        // Check cooldown
        const timeSinceLastTrip = now - bird.lastTripTime;
        if (timeSinceLastTrip >= TRIP_COOLDOWN_MS && bird.energy > 0) {
           startTrip();
        }
      }

    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bird, userLocation]);

  const startTrip = async (overrideEnergy?: number) => {
    if (!userLocation) return;
    
    // Use override energy (for testing) or current bird energy
    const effectiveEnergy = overrideEnergy !== undefined ? overrideEnergy : bird.energy;

    // Calculate Duration
    // Duration = Energy / 10 minutes.
    let duration = Math.floor(effectiveEnergy / 10);
    duration = Math.max(MIN_TRIP_DURATION_MIN, Math.min(MAX_TRIP_DURATION_MIN, duration));

    // Calculate Search Radius: Energy * 50 KM (converted to meters)
    const radius = effectiveEnergy * 50 * 1000;

    // Determine Destination using Gemini
    // We set status to FLYING_OUT immediately to block UI, but wait for API for details
    const startTime = Date.now();
    
    // Optimistic update
    setBird(prev => ({
        ...prev,
        energy: 0, // Consumed upon departure
        currentTrip: {
            destinationName: "正在確認目的地...",
            startTime: startTime,
            totalDurationMinutes: duration,
            radiusMeters: radius,
            energyUsed: effectiveEnergy,
            status: BirdStatus.FLYING_OUT,
            actualDistanceMeters: 0 // Placeholder
        }
    }));

    try {
        const destination = await findDestination(userLocation, radius);
        
        // Calculate actual distance
        const dist = calculateDistance(userLocation, destination.coordinates);

        setBird(prev => {
            if (!prev.currentTrip) return prev;
            return {
                ...prev,
                currentTrip: {
                    ...prev.currentTrip,
                    destinationName: destination.name,
                    mapLink: destination.mapLink,
                    destinationCoords: destination.coordinates,
                    actualDistanceMeters: dist
                }
            };
        });
    } catch (e) {
        console.error("Failed to find destination", e);
    }
  };

  const handleTripComplete = (trip: TripConfig) => {
    const souvenir: Souvenir = {
        id: Date.now().toString(),
        cityName: trip.destinationName, 
        timestamp: Date.now(),
        // Fallback generator just in case mapLink is missing (shouldn't happen with new service)
        mapLink: trip.mapLink || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trip.destinationName)}&data=!3m1!1e2`,
        description: `你的鳥兒造訪了 ${trip.destinationName} 並帶回了這裡的照片！`
    };

    setBird(prev => ({
        ...prev,
        currentTrip: null,
        lastTripTime: Date.now(),
        history: [souvenir, ...prev.history]
    }));
  };

  const handleFeed = () => {
    const now = Date.now();
    if (now - bird.lastFedTime < FEED_COOLDOWN_MS) return;

    setIsFeeding(true);
    setTimeout(() => setIsFeeding(false), 1000);

    setBird(prev => ({
      ...prev,
      energy: prev.energy + FEED_ENERGY_GAIN,
      lastFedTime: now
    }));
  };

  // Test Function: Skip the "Flying Out" phase (Instantly Arrive)
  const skipFlyOut = () => {
    setBird(prev => {
        if (!prev.currentTrip) return prev;
        
        // To skip flying out, we shift the start time back by the flight duration + buffer
        const shiftedStartTime = Date.now() - (FLY_OUT_DURATION_MIN * 60 * 1000) - 5000;
        
        return {
            ...prev,
            currentTrip: {
                ...prev.currentTrip,
                startTime: shiftedStartTime,
                status: BirdStatus.STAYING // Force status update
            }
        };
    });
  };

  // Test Function: Skip the "Staying" phase (Start Flying Back Immediately)
  const skipStay = () => {
    setBird(prev => {
        if (!prev.currentTrip) return prev;
        const trip = prev.currentTrip;
        const stayDuration = trip.totalDurationMinutes - FLY_OUT_DURATION_MIN - FLY_BACK_DURATION_MIN;
        
        // Shift time so we are at the start of FLYING_BACK phase
        // Elapsed = FLY_OUT + STAY + small buffer
        const targetElapsedMin = FLY_OUT_DURATION_MIN + stayDuration; 
        const shiftedStartTime = Date.now() - (targetElapsedMin * 60 * 1000) - 5000;

        return {
            ...prev,
            currentTrip: {
                ...trip,
                startTime: shiftedStartTime,
                status: BirdStatus.FLYING_BACK
            }
        };
    });
  };

  // Test Function: Skip the "Flying Back" phase (Instant Finish & Collect Reward)
  const fastForwardTrip = () => {
       setBird(prev => {
        if (!prev.currentTrip) return prev;
        const trip = prev.currentTrip;
        
        // Shift time so elapsed > totalDuration
        const shiftedStartTime = Date.now() - (trip.totalDurationMinutes * 60 * 1000) - 5000;

        return {
            ...prev,
            currentTrip: {
                ...trip,
                startTime: shiftedStartTime,
                // Loop will trigger completion next tick
            }
        };
      });
  };

  const initializeBird = (selectedType: BirdType | 'RANDOM', name: string) => {
    let finalType = selectedType;
    if (selectedType === 'RANDOM') {
      // 10% Chance for Cockatiel
      const isRare = Math.random() < 0.1;
      if (isRare) {
        finalType = BirdType.COCKATIEL;
      } else {
        const commonTypes = [BirdType.SPARROW, BirdType.ROBIN, BirdType.BLUE_JAY, BirdType.PIGEON];
        finalType = commonTypes[Math.floor(Math.random() * commonTypes.length)];
      }
    }

    setBird({
      ...INITIAL_STATE,
      isInitialized: true,
      type: finalType as BirdType,
      name: name || '小鳥',
      lastTripTime: Date.now(), // Start cooldown immediately
    });
  };

  // --- RENDER HELPERS ---

  if (!bird.isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-sky-50 p-4 font-sans">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <h1 className="text-3xl font-bold text-sky-900 mb-6">領養你的旅鳥</h1>
            {locationError && <p className="text-red-500 mb-4 text-sm">{locationError}</p>}
            
            <input 
                type="text" 
                id="birdName"
                placeholder="幫你的鳥兒取個名字..." 
                className="w-full border-2 border-sky-100 rounded-lg p-3 mb-6 focus:border-sky-400 outline-none"
            />
            
            <div className="grid grid-cols-2 gap-4">
                {[BirdType.SPARROW, BirdType.ROBIN, BirdType.BLUE_JAY, BirdType.PIGEON].map(type => (
                    <button 
                        key={type}
                        onClick={() => {
                            const name = (document.getElementById('birdName') as HTMLInputElement).value;
                            initializeBird(type, name);
                        }}
                        className="p-4 rounded-xl border-2 border-slate-100 hover:border-sky-400 transition flex flex-col items-center gap-2"
                        disabled={!!locationError}
                    >
                        <BirdAvatar type={type} status={BirdStatus.IDLE} size="sm" />
                        <span className="text-sm font-medium">{BIRD_TYPE_CN[type]}</span>
                    </button>
                ))}
            </div>

            <button 
                onClick={() => {
                    const name = (document.getElementById('birdName') as HTMLInputElement).value;
                    initializeBird('RANDOM', name);
                }}
                disabled={!!locationError}
                className="w-full mt-6 bg-gradient-to-r from-purple-500 to-indigo-600 text-white py-4 rounded-xl font-bold hover:shadow-lg transition disabled:opacity-50"
            >
                神秘鳥蛋 (隨機 + 機率稀有)
            </button>
        </div>
      </div>
    );
  }

  const timeUntilFeed = Math.max(0, FEED_COOLDOWN_MS - (Date.now() - bird.lastFedTime));
  const canFeed = timeUntilFeed === 0 && !bird.currentTrip; // Can't feed while away
  
  const timeUntilFly = Math.max(0, TRIP_COOLDOWN_MS - (Date.now() - bird.lastTripTime));
  
  return (
    <div className="max-w-md mx-auto h-full flex flex-col relative bg-sky-50 shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="bg-white p-4 shadow-sm z-10 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold text-slate-800">{bird.name}</h2>
                <p className="text-xs text-slate-400">{BIRD_TYPE_CN[bird.type]} • {userLocation ? 'GPS 已定位' : '無 GPS 訊號'}</p>
            </div>
            <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                ⚡ {bird.energy}
            </div>
        </div>

        {/* Main View */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
            
            {/* Bird Stage OR Map Stage */}
            <div className="flex flex-col items-center justify-center py-4 relative">
                
                {bird.currentTrip && userLocation ? (
                    // SHOW MAP WHEN FLYING
                    <MapTracker 
                        trip={bird.currentTrip} 
                        homeCoords={userLocation}
                        birdType={bird.type}
                    />
                ) : (
                    // SHOW BIRD WHEN HOME
                    <>
                        {isFeeding && (
                            <div className="absolute top-0 text-2xl animate-bounce">🍎</div>
                        )}
                        <BirdAvatar type={bird.type} status={BirdStatus.IDLE} size="lg" />
                        
                        <div className="mt-4 text-center">
                            <span className="inline-block bg-green-100 text-green-700 px-4 py-1 rounded-full text-sm font-medium">
                                在家休息
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Current Trip or Stats */}
            {bird.currentTrip ? (
                <div className="space-y-2">
                    <TripVisualizer 
                        trip={bird.currentTrip} 
                        currentElapsedMinutes={(Date.now() - bird.currentTrip.startTime) / (60000)}
                    />
                    
                    {/* TEST BUTTONS GROUP */}
                    <div className="flex flex-col gap-1">
                        {bird.currentTrip.status === BirdStatus.FLYING_OUT && (
                            <button 
                                onClick={skipFlyOut}
                                className="w-full text-xs text-indigo-500 hover:text-indigo-700 underline text-center transition py-1 bg-indigo-50 rounded"
                            >
                                ⏩ 測試: 瞬間抵達 (跳過飛行)
                            </button>
                        )}
                        {bird.currentTrip.status === BirdStatus.STAYING && (
                            <button 
                                onClick={skipStay}
                                className="w-full text-xs text-indigo-500 hover:text-indigo-700 underline text-center transition py-1 bg-indigo-50 rounded"
                            >
                                ⏩ 測試: 瞬間返程 (跳過停留)
                            </button>
                        )}
                        {bird.currentTrip.status === BirdStatus.FLYING_BACK && (
                            <button 
                                onClick={fastForwardTrip}
                                className="w-full text-xs text-indigo-500 hover:text-indigo-700 underline text-center transition py-1 bg-indigo-50 rounded"
                            >
                                ⏩ 測試: 瞬間到家 (跳過回程)
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                     <div className="flex justify-between items-center text-sm text-slate-600 mb-2">
                        <span>下次飛行冷卻時間:</span>
                        <span className="font-mono text-sky-600 font-bold">
                            {timeUntilFly > 0 
                                ? `${Math.ceil(timeUntilFly / (1000 * 60 * 60))}時 ${Math.ceil((timeUntilFly % (1000 * 60 * 60)) / (1000 * 60))}分` 
                                : '準備就緒！'}
                        </span>
                     </div>
                     <div className="text-xs text-slate-400 border-t border-slate-100 pt-2 mt-2">
                        目前能量飛行半徑: <span className="font-bold text-sky-600">{bird.energy * 50}</span> 公里
                     </div>
                </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-1 gap-4">
                <button
                    onClick={handleFeed}
                    disabled={!canFeed}
                    className={`
                        w-full py-3 rounded-xl font-bold transition flex items-center justify-center gap-2
                        ${canFeed 
                            ? 'bg-orange-500 text-white shadow-orange-200 shadow-lg hover:bg-orange-600 active:scale-95' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                    `}
                >
                    <span>餵食 (+10 能量)</span>
                    {!canFeed && !bird.currentTrip && (
                         <span className="text-xs font-normal">
                             ({Math.ceil(timeUntilFeed / 60000)}分)
                         </span>
                    )}
                </button>

                {/* Test Flight Button */}
                {!bird.currentTrip && (
                    <button
                        onClick={() => startTrip(100)}
                        className="w-full py-2 rounded-xl font-bold border-2 border-dashed border-sky-300 text-sky-600 hover:bg-sky-50 transition"
                    >
                        🧪 測試飛行 (模擬 100 能量)
                    </button>
                )}
            </div>

            {/* History / Souvenirs */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-700 text-lg">旅遊相簿 ({bird.history.length})</h3>
                </div>
                
                {bird.history.length === 0 ? (
                    <div className="text-center text-slate-400 py-8 bg-white rounded-xl border border-dashed border-slate-200">
                        <div className="text-4xl mb-2">🖼️</div>
                        目前還沒有照片。<br/>趕快餵食你的鳥兒，讓牠出去探險吧！
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {bird.history.map(souvenir => (
                            <div key={souvenir.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition flex flex-row items-center gap-3">
                                <a 
                                    href={souvenir.mapLink} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="w-20 h-20 bg-sky-100 rounded-lg flex-shrink-0 flex items-center justify-center text-3xl overflow-hidden relative group"
                                >
                                    📸
                                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all"></div>
                                </a>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-800 truncate">{souvenir.cityName}</h4>
                                    <p className="text-xs text-slate-400 mb-2">{new Date(souvenir.timestamp).toLocaleDateString()} {new Date(souvenir.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                    <a 
                                        href={souvenir.mapLink} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        className="text-xs bg-sky-50 text-sky-600 px-2 py-1 rounded border border-sky-100 hover:bg-sky-100 inline-block"
                                    >
                                        📍 查看 Google Maps 照片
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}