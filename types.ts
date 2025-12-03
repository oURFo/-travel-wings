export enum BirdType {
  SPARROW = 'Sparrow',
  ROBIN = 'Robin',
  BLUE_JAY = 'Blue Jay',
  COCKATIEL = 'Cockatiel', // Rare
  PIGEON = 'Pigeon'
}

export enum BirdStatus {
  IDLE = 'IDLE',
  FLYING_OUT = 'FLYING_OUT',
  STAYING = 'STAYING',
  FLYING_BACK = 'FLYING_BACK'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Souvenir {
  id: string;
  cityName: string;
  timestamp: number;
  mapLink: string;
  description: string;
}

export interface TripConfig {
  destinationName: string;
  destinationCoords?: Coordinates;
  startTime: number;
  totalDurationMinutes: number; // 30 to 90
  radiusMeters: number; // The max radius allowed based on energy
  actualDistanceMeters?: number; // The actual calculated distance to the specific destination
  energyUsed: number;
  status: BirdStatus;
  mapLink?: string;
}

export interface BirdState {
  isInitialized: boolean;
  type: BirdType;
  name: string;
  energy: number;
  lastFedTime: number; // Timestamp
  lastTripTime: number; // Timestamp of when the LAST trip ended (to calculate 6hr cooldown)
  currentTrip: TripConfig | null;
  history: Souvenir[];
}