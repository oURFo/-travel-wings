export const FEED_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes
export const FEED_ENERGY_GAIN = 10;

export const TRIP_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

export const MIN_TRIP_DURATION_MIN = 30;
export const MAX_TRIP_DURATION_MIN = 90;

export const FLY_OUT_DURATION_MIN = 10;
export const FLY_BACK_DURATION_MIN = 10;
// Staying duration = Total - 20 mins.

export const BIRD_SVG_MAP: Record<string, string> = {
  'Sparrow': '🪶', // Fallback, we'll use SVGs in component
  'Robin': '🐦',
  'Blue Jay': '🫐',
  'Cockatiel': '🦜',
  'Pigeon': '🕊️'
};