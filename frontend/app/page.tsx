'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

// API Base URL from environment variables or default to localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ==========================================
// Types & Interfaces
// ==========================================
interface Driver {
  id: string;
  name: string;
  shortName: string;
  number: number;
  team: string;
  teamColor: string;
  points: number;       // Season points
  gridPosition: number; // Starting grid position
  position: number;     // Current race position (1 to 22)
  prevPosition: number; // Previous race position to check climb/drop
  raceTime: number;     // Cumulative race time in seconds
  gap: number;          // Gap to leader in seconds
  gapToLeader: string;  // Formatted gap string
  fastestLap: boolean;  // Holding fastest lap of the race?
  dnf: boolean;         // Did the driver retire?
  dnfOrder?: number;    // Order in which DNF occurred
  isPitting: boolean;   // Is driver currently in the pit lane?
  tyre: 'Soft' | 'Medium' | 'Hard' | 'Intermediate' | 'Wet';
  tyreAge: number;      // Laps on current tyre set
  bestLapTime: string;  // Best lap time in the race
  currentLapCompleted?: number; // Last lap completed from telemetry
}

interface Track {
  name: string;
  location: string;
  laps: number;
  length: string;
  baseLapTime: number;       // in seconds
  rainChance: number;        // probability (0 to 1)
  overtakeDifficulty: number; // multiplier for overtake chance (lower = harder)
  dnfChance: number;         // crash probability per lap
  record: string;
  recordHolder: string;
}

interface CommentaryLog {
  id: string;
  lap: number;
  text: string;
  type: 'overtake' | 'crash' | 'pit' | 'weather' | 'sc' | 'finish' | 'normal';
}

// ==========================================
// Static Config Data
// ==========================================
const TRACKS: Track[] = [
  {
    name: "Autodromo Nazionale Monza",
    location: "Monza, Italy",
    laps: 53,
    length: "5.793 km",
    baseLapTime: 81.2,
    rainChance: 0.10,
    overtakeDifficulty: 1.3,
    dnfChance: 0.015,
    record: "1:21.046",
    recordHolder: "R. Barrichello (2004)"
  },
  {
    name: "Circuit de Spa-Francorchamps",
    location: "Stavelot, Belgium",
    laps: 44,
    length: "7.004 km",
    baseLapTime: 104.5,
    rainChance: 0.40,
    overtakeDifficulty: 1.1,
    dnfChance: 0.02,
    record: "1:46.286",
    recordHolder: "V. Bottas (2018)"
  },
  {
    name: "Circuit de Monaco",
    location: "Monte Carlo, Monaco",
    laps: 78,
    length: "3.337 km",
    baseLapTime: 71.8,
    rainChance: 0.15,
    overtakeDifficulty: 0.4, // Monaco - almost impossible to overtake!
    dnfChance: 0.03,        // High DNF chance
    record: "1:12.909",
    recordHolder: "L. Hamilton (2021)"
  },
  {
    name: "Marina Bay Street Circuit",
    location: "Singapore",
    laps: 62,
    length: "4.940 km",
    baseLapTime: 95.8,
    rainChance: 0.28,
    overtakeDifficulty: 0.7,
    dnfChance: 0.035,
    record: "1:35.867",
    recordHolder: "L. Hamilton (2018)"
  },
  {
    name: "Silverstone Circuit",
    location: "Silverstone, UK",
    laps: 52,
    length: "5.891 km",
    baseLapTime: 87.4,
    rainChance: 0.32,
    overtakeDifficulty: 1.2,
    dnfChance: 0.018,
    record: "1:27.097",
    recordHolder: "M. Verstappen (2020)"
  }
];

const INITIAL_DRIVERS: Driver[] = [
  { id: 'verstappen', name: 'Max Verstappen', shortName: 'VER', number: 1, team: 'Red Bull Racing', teamColor: '#3671C6', points: 437, gridPosition: 1, position: 1, prevPosition: 1, raceTime: 0, gap: 0, gapToLeader: 'LEADER', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'norris', name: 'Lando Norris', shortName: 'NOR', number: 4, team: 'McLaren', teamColor: '#FF8000', points: 374, gridPosition: 2, position: 2, prevPosition: 2, raceTime: 0.8, gap: 0.8, gapToLeader: '+0.800', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'leclerc', name: 'Charles Leclerc', shortName: 'LEC', number: 16, team: 'Ferrari', teamColor: '#E80020', points: 356, gridPosition: 3, position: 3, prevPosition: 3, raceTime: 1.6, gap: 1.6, gapToLeader: '+1.600', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'piastri', name: 'Oscar Piastri', shortName: 'PIA', number: 81, team: 'McLaren', teamColor: '#FF8000', points: 292, gridPosition: 4, position: 4, prevPosition: 4, raceTime: 2.4, gap: 2.4, gapToLeader: '+2.400', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'sainz', name: 'Carlos Sainz', shortName: 'SAI', number: 55, team: 'Williams', teamColor: '#64C4FF', points: 272, gridPosition: 5, position: 5, prevPosition: 5, raceTime: 3.2, gap: 3.2, gapToLeader: '+3.200', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'russell', name: 'George Russell', shortName: 'RUS', number: 63, team: 'Mercedes', teamColor: '#27F4D2', points: 245, gridPosition: 6, position: 6, prevPosition: 6, raceTime: 4.0, gap: 4.0, gapToLeader: '+4.000', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'hamilton', name: 'Lewis Hamilton', shortName: 'HAM', number: 44, team: 'Ferrari', teamColor: '#E80020', points: 223, gridPosition: 7, position: 7, prevPosition: 7, raceTime: 4.8, gap: 4.8, gapToLeader: '+4.800', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'perez', name: 'Sergio Perez', shortName: 'PER', number: 11, team: 'Red Bull Racing', teamColor: '#3671C6', points: 152, gridPosition: 8, position: 8, prevPosition: 8, raceTime: 5.6, gap: 5.6, gapToLeader: '+5.600', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'alonso', name: 'Fernando Alonso', shortName: 'ALO', number: 14, team: 'Aston Martin', teamColor: '#229971', points: 62, gridPosition: 9, position: 9, prevPosition: 9, raceTime: 6.4, gap: 6.4, gapToLeader: '+6.400', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'hulkenberg', name: 'Nico Hulkenberg', shortName: 'HUL', number: 27, team: 'Kick Sauber', teamColor: '#52E252', points: 31, gridPosition: 10, position: 10, prevPosition: 10, raceTime: 7.2, gap: 7.2, gapToLeader: '+7.200', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'tsunoda', name: 'Yuki Tsunoda', shortName: 'TSU', number: 22, team: 'Racing Bulls', teamColor: '#6692FF', points: 28, gridPosition: 11, position: 11, prevPosition: 11, raceTime: 8.0, gap: 8.0, gapToLeader: '+8.000', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'gasly', name: 'Pierre Gasly', shortName: 'GAS', number: 10, team: 'Alpine', teamColor: '#0093CC', points: 26, gridPosition: 12, position: 12, prevPosition: 12, raceTime: 8.8, gap: 8.8, gapToLeader: '+8.800', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'stroll', name: 'Lance Stroll', shortName: 'STR', number: 18, team: 'Aston Martin', teamColor: '#229971', points: 24, gridPosition: 13, position: 13, prevPosition: 13, raceTime: 9.6, gap: 9.6, gapToLeader: '+9.600', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'ocon', name: 'Esteban Ocon', shortName: 'OCO', number: 31, team: 'Haas', teamColor: '#B6BABD', points: 23, gridPosition: 14, position: 14, prevPosition: 14, raceTime: 10.4, gap: 10.4, gapToLeader: '+10.400', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'albon', name: 'Alexander Albon', shortName: 'ALB', number: 23, team: 'Williams', teamColor: '#64C4FF', points: 12, gridPosition: 15, position: 15, prevPosition: 15, raceTime: 11.2, gap: 11.2, gapToLeader: '+11.200', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'bearman', name: 'Oliver Bearman', shortName: 'BEA', number: 87, team: 'Haas', teamColor: '#B6BABD', points: 7, gridPosition: 16, position: 16, prevPosition: 16, raceTime: 12.0, gap: 12.0, gapToLeader: '+12.000', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'colapinto', name: 'Franco Colapinto', shortName: 'COL', number: 43, team: 'Pampa GP', teamColor: '#0EA5E9', points: 5, gridPosition: 17, position: 17, prevPosition: 17, raceTime: 12.8, gap: 12.8, gapToLeader: '+12.800', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'lawson', name: 'Liam Lawson', shortName: 'LAW', number: 30, team: 'Racing Bulls', teamColor: '#6692FF', points: 4, gridPosition: 18, position: 18, prevPosition: 18, raceTime: 13.6, gap: 13.6, gapToLeader: '+13.600', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'antonelli', name: 'Kimi Antonelli', shortName: 'ANT', number: 12, team: 'Mercedes', teamColor: '#27F4D2', points: 0, gridPosition: 19, position: 19, prevPosition: 19, raceTime: 14.4, gap: 14.4, gapToLeader: '+14.400', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'doohan', name: 'Jack Doohan', shortName: 'DOO', number: 9, team: 'Alpine', teamColor: '#0093CC', points: 0, gridPosition: 20, position: 20, prevPosition: 20, raceTime: 15.2, gap: 15.2, gapToLeader: '+15.200', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'bottas', name: 'Valtteri Bottas', shortName: 'BOT', number: 77, team: 'Andretti Cadillac', teamColor: '#94A3B8', points: 0, gridPosition: 21, position: 21, prevPosition: 21, raceTime: 16.0, gap: 16.0, gapToLeader: '+16.000', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' },
  { id: 'bortoleto', name: 'Gabriel Bortoleto', shortName: 'BOR', number: 5, team: 'Kick Sauber', teamColor: '#52E252', points: 0, gridPosition: 22, position: 22, prevPosition: 22, raceTime: 16.8, gap: 16.8, gapToLeader: '+16.800', fastestLap: false, dnf: false, isPitting: false, tyre: 'Medium', tyreAge: 0, bestLapTime: '-' }
];

// ==========================================
// Performance Weights (Physics parameters)
// ==========================================
const getDriverWeight = (id: string): number => {
  const weights: Record<string, number> = {
    verstappen: -0.32, norris: -0.30, leclerc: -0.28, piastri: -0.22,
    sainz: -0.18, russell: -0.18, hamilton: -0.20, perez: 0.05,
    alonso: -0.12, hulkenberg: 0.02, tsunoda: 0.06, gasly: 0.08,
    stroll: 0.22, ocon: 0.18, albon: 0.10, bearman: 0.12,
    colapinto: 0.14, lawson: 0.15, antonelli: 0.14, doohan: 0.25,
    bottas: 0.20, bortoleto: 0.28
  };
  return weights[id] ?? 0;
};

const getTeamWeight = (team: string): number => {
  const weights: Record<string, number> = {
    'McLaren': -0.25,
    'Ferrari': -0.22,
    'Red Bull Racing': -0.15,
    'Mercedes': -0.10,
    'Aston Martin': 0.02,
    'Racing Bulls': 0.12,
    'Haas': 0.15,
    'Williams': 0.18,
    'Andretti Cadillac': 0.25,
    'Pampa GP': 0.28,
    'Kick Sauber': 0.32
  };
  return weights[team] ?? 0;
};

const getTyreWearWeight = (tyre: string, age: number): number => {
  switch (tyre) {
    case 'Soft':
      return age * 0.15; // Softs degrade very quickly
    case 'Medium':
      return age * 0.07;
    case 'Hard':
      return age * 0.035; // Hards are extremely durable
    case 'Intermediate':
      return age * 0.05;
    case 'Wet':
      return age * 0.04;
    default:
      return 0;
  }
};

const getWeatherPenalty = (tyre: string, weather: string, wetness: number): number => {
  if (wetness > 35) { // Track is wet
    if (tyre === 'Soft' || tyre === 'Medium' || tyre === 'Hard') {
      return (wetness - 30) * 0.18; // Massive speed penalty on slick tyres in the wet!
    } else if (tyre === 'Intermediate') {
      return wetness > 70 ? (wetness - 70) * 0.08 : 0; // Inters are okay up to 70% wetness
    } else { // Wets
      return wetness < 60 ? (60 - wetness) * 0.08 : 0; // Wets are slow if track is not wet enough
    }
  } else { // Track is dry/mostly dry
    if (tyre === 'Intermediate') {
      return (35 - wetness) * 0.12; // Inters degrade and run slow on dry tarmac
    } else if (tyre === 'Wet') {
      return (35 - wetness) * 0.25; // Full wets melt and run extremely slow on dry tarmac
    }
  }
  return 0;
};

// ==========================================
// Formatting Helpers
// ==========================================
const formatLapTime = (timeInSeconds: number) => {
  const mins = Math.floor(timeInSeconds / 60);
  const secs = (timeInSeconds % 60).toFixed(3);
  return `${mins}:${secs.padStart(6, '0')}`;
};

const parseLapTime = (timeString: string): number => {
  if (timeString === '-') return Infinity;
  const parts = timeString.split(':');
  if (parts.length < 2) return parseFloat(timeString);
  return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
};

interface UpcomingSession {
  eventName: string;
  sessionName: string;
  date: Date;
}

const findUpcomingSession = (events: any[]): UpcomingSession | null => {
  const now = new Date();
  let soonestSession: UpcomingSession | null = null;

  events.forEach(event => {
    for (let i = 1; i <= 5; i++) {
      const sessionName = event[`Session${i}`];
      const sessionDateUtc = event[`Session${i}DateUtc`];

      if (sessionName && sessionName !== 'None' && sessionDateUtc) {
        const sessionDate = new Date(sessionDateUtc + 'Z');
        if (sessionDate > now) {
          if (!soonestSession || sessionDate < soonestSession.date) {
            soonestSession = {
              eventName: event.EventName,
              sessionName: sessionName,
              date: sessionDate
            };
          }
        }
      }
    }
  });

  return soonestSession;
};

// ==========================================
// Main Component
// ==========================================
export default function Home() {
  // Track State
  const [selectedTrack, setSelectedTrack] = useState<Track>(TRACKS[0]);
  
  // Standings & Simulation State
  const [drivers, setDrivers] = useState<Driver[]>(INITIAL_DRIVERS);
  const [lap, setLap] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<1 | 2 | 5>(2);
  const [weather, setWeather] = useState<'Sunny' | 'Overcast' | 'Rainy'>('Sunny');
  const [wetness, setWetness] = useState<number>(0); // 0 to 100
  const [safetyCar, setSafetyCar] = useState<'None' | 'SC' | 'VSC'>('None');
  const [scLapsRemaining, setScLapsRemaining] = useState<number>(0);
  const [commentary, setCommentary] = useState<CommentaryLog[]>([
    { id: 'start', lap: 0, text: "🚥 Pit lane is open. Drivers are lining up on the starting grid!", type: 'normal' }
  ]);
  
  // Fastest Lap holder
  const [fastestLapHolder, setFastestLapHolder] = useState<{ driverId: string; time: string } | null>(null);
  
  // Backend Integration States
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [selectedSessionType, setSelectedSessionType] = useState<string>('R');
  const [scheduleEvents, setScheduleEvents] = useState<any[]>([]);
  const [selectedEventName, setSelectedEventName] = useState<string>('');
  
  // Loaded raw backend telemetry
  const [resultsData, setResultsData] = useState<any[]>([]);
  const [lapsData, setLapsData] = useState<any[]>([]);
  
  // Live Upcoming Session States
  const [upcomingSession, setUpcomingSession] = useState<UpcomingSession | null>(null);
  const [countdownText, setCountdownText] = useState<string>('');
  
  // Loading and Error states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [apiError, setApiError] = useState<string | null>(null);

  // Helper to normalize compounds
  const normalizeCompound = (rawCompound: string): 'Soft' | 'Medium' | 'Hard' | 'Intermediate' | 'Wet' => {
    const comp = rawCompound ? rawCompound.toUpperCase() : 'MEDIUM';
    if (comp.includes('SOFT')) return 'Soft';
    if (comp.includes('MEDIUM')) return 'Medium';
    if (comp.includes('HARD')) return 'Hard';
    if (comp.includes('INTER') || comp.includes('WET_INT')) return 'Intermediate';
    if (comp.includes('WET')) return 'Wet';
    return 'Medium';
  };

  // Refs to avoid stale closures in the simulation interval
  const driversRef = useRef(drivers);
  const selectedTrackRef = useRef(selectedTrack);
  const lapRef = useRef(lap);
  const weatherRef = useRef(weather);
  const wetnessRef = useRef(wetness);
  const safetyCarRef = useRef(safetyCar);
  const scLapsRemainingRef = useRef(scLapsRemaining);
  const fastestLapHolderRef = useRef(fastestLapHolder);
  const nextDnfOrderRef = useRef<number>(1);
  
  // Sync refs with state updates
  useEffect(() => {
    driversRef.current = drivers;
    selectedTrackRef.current = selectedTrack;
    lapRef.current = lap;
    weatherRef.current = weather;
    wetnessRef.current = wetness;
    safetyCarRef.current = safetyCar;
    scLapsRemainingRef.current = scLapsRemaining;
    fastestLapHolderRef.current = fastestLapHolder;
    nextDnfOrderRef.current = drivers.filter(d => d.dnf).length + 1;
  }, [drivers, selectedTrack, lap, weather, wetness, safetyCar, scLapsRemaining, fastestLapHolder]);

  // Terminal scroll box ref
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [commentary]);

  // Fetch F1 Schedule for selected year
  useEffect(() => {
    async function fetchSchedule() {
      setIsLoading(true);
      setLoadingProgress(`Fetching ${selectedYear} season schedule...`);
      setApiError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/schedule?year=${selectedYear}`);
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        const data = await res.json();
        if (data.success && data.events) {
          // Filter out RoundNumber 0 or testing formats
          const validEvents = data.events.filter((e: any) => e.F1ApiSupport && e.RoundNumber > 0);
          setScheduleEvents(validEvents);
          // Auto-select first event if exists
          if (validEvents.length > 0) {
            setSelectedEventName(validEvents[0].EventName);
          } else {
            setSelectedEventName('');
          }
        } else {
          throw new Error(data.detail || "Failed to parse schedule");
        }
      } catch (err: any) {
        console.error(err);
        setApiError(`Failed to load ${selectedYear} season schedule. Make sure the backend server is running.`);
      } finally {
        setIsLoading(false);
      }
    }
    fetchSchedule();
  }, [selectedYear]);

  // Fetch live upcoming session on mount
  useEffect(() => {
    async function fetchLiveSchedule() {
      const currentYear = new Date().getFullYear();
      try {
        const res = await fetch(`${API_BASE_URL}/api/schedule?year=${currentYear}`);
        if (!res.ok) throw new Error("Failed to fetch live schedule");
        const data = await res.json();
        if (data.success && data.events) {
          const soonest = findUpcomingSession(data.events);
          setUpcomingSession(soonest);
        }
      } catch (err) {
        console.error("Failed to load upcoming live session:", err);
      }
    }
    fetchLiveSchedule();
  }, []);

  // Update upcoming session countdown timer every second
  useEffect(() => {
    if (!upcomingSession) return;

    const updateCountdown = () => {
      const now = new Date();
      const diffMs = upcomingSession.date.getTime() - now.getTime();

      if (diffMs <= 0) {
        setCountdownText('SESSION LIVE');
      } else {
        const secs = Math.floor(diffMs / 1000) % 60;
        const mins = Math.floor(diffMs / (1000 * 60)) % 60;
        const hours = Math.floor(diffMs / (1000 * 60 * 60)) % 24;
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        let text = '';
        if (days > 0) text += `${days}d `;
        text += `${hours.toString().padStart(2, '0')}h `;
        text += `${mins.toString().padStart(2, '0')}m `;
        text += `${secs.toString().padStart(2, '0')}s`;

        setCountdownText(text);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [upcomingSession]);

  // Load GP results and laps
  const loadRaceTelemetry = async (year: number, eventName: string, sessionType: string) => {
    if (!eventName) return;
    setIsLoading(true);
    setLoadingProgress(`Downloading session results and historical telemetry for ${eventName} (${year} - ${sessionType === 'R' ? 'Race' : sessionType === 'Q' ? 'Qualifying' : sessionType === 'S' ? 'Sprint' : 'Practice'})... (This may take a moment if the cache is cold)`);
    setApiError(null);
    setIsPlaying(false);
    setLap(0);
    setFastestLapHolder(null);
    setCommentary([
      { id: 'start', lap: 0, text: `🏁 Initializing playback for ${year} ${eventName} [${sessionType}]. Ready to start!`, type: 'normal' }
    ]);
    
    try {
      // 1. Fetch results
      const resResults = await fetch(`${API_BASE_URL}/api/results?year=${year}&event=${encodeURIComponent(eventName)}&session=${sessionType}`);
      if (!resResults.ok) throw new Error(`HTTP error fetching results: ${resResults.status}`);
      const dataResults = await resResults.json();
      if (!dataResults.success || !dataResults.results) {
        throw new Error(dataResults.detail || "Failed to load results");
      }
      
      // 2. Fetch laps
      setLoadingProgress(`Loading lap-by-lap telemetry records for ${eventName}...`);
      const resLaps = await fetch(`${API_BASE_URL}/api/laps?year=${year}&event=${encodeURIComponent(eventName)}&session=${sessionType}`);
      if (!resLaps.ok) throw new Error(`HTTP error fetching laps: ${resLaps.status}`);
      const dataLaps = await resLaps.json();
      if (!dataLaps.success || !dataLaps.laps) {
        throw new Error(dataLaps.detail || "Failed to load laps");
      }
      
      const results = dataResults.results;
      const laps = dataLaps.laps;
      
      setResultsData(results);
      setLapsData(laps);
      
      // 3. Initialize dynamic track structure
      const maxLaps = Math.max(...results.map((r: any) => r.Laps || 0));
      const firstResult = results[0] || {};
      
      const newTrack: Track = {
        name: eventName,
        location: firstResult.CountryCode || 'Global',
        laps: maxLaps > 0 ? maxLaps : 50,
        length: 'Dynamic',
        baseLapTime: 0,
        rainChance: 0,
        overtakeDifficulty: 1,
        dnfChance: 0,
        record: '-',
        recordHolder: '-'
      };
      setSelectedTrack(newTrack);
      
      // 4. Initialize drivers state from results (Sorted by GridPosition for Race/Sprint, otherwise Position)
      const startingDrivers: Driver[] = results.map((r: any, idx: number) => {
        const teamColorHex = r.TeamColor ? `#${r.TeamColor}` : '#94A3B8';
        const gp = sessionType === 'R' || sessionType === 'S'
          ? (parseInt(r.GridPosition) || 20)
          : (parseInt(r.Position) || idx + 1);
        
        // Find compound from first stint in laps data if possible
        const driverLaps = laps.filter((l: any) => l.Driver === r.Abbreviation && l.LapNumber === 1);
        const startCompoundRaw = driverLaps[0]?.Compound || 'MEDIUM';
        const startCompound = normalizeCompound(startCompoundRaw);
        
        return {
          id: r.DriverId || r.Abbreviation.toLowerCase(),
          name: r.FullName || r.BroadcastName,
          shortName: r.Abbreviation,
          number: parseInt(r.DriverNumber) || 0,
          team: r.TeamName,
          teamColor: teamColorHex,
          points: 0,
          gridPosition: gp,
          position: gp,
          prevPosition: gp,
          raceTime: gp * 0.8,
          gap: gp * 0.8,
          gapToLeader: gp === 1 ? 'LEADER' : `+${(gp * 0.8).toFixed(3)}`,
          fastestLap: false,
          dnf: false,
          isPitting: false,
          tyre: startCompound,
          tyreAge: 0,
          bestLapTime: '-',
          currentLapCompleted: 0
        };
      }).sort((a: Driver, b: Driver) => {
        return (sessionType === 'R' || sessionType === 'S')
          ? a.gridPosition - b.gridPosition
          : a.position - b.position;
      });
      
      // Re-assign position indices from 1 to N
      startingDrivers.forEach((d, idx) => {
        d.position = idx + 1;
        d.prevPosition = idx + 1;
      });
      
      setDrivers(startingDrivers);
      
    } catch (err: any) {
      console.error(err);
      setApiError(`Failed to load telemetry for ${eventName} (${year}): ${err.message}. Please verify the backend is running.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Load race data when selectedEventName, selectedYear, or selectedSessionType changes
  useEffect(() => {
    if (selectedEventName) {
      loadRaceTelemetry(selectedYear, selectedEventName, selectedSessionType);
    }
  }, [selectedEventName, selectedYear, selectedSessionType]);

  // Reset function
  const handleReset = () => {
    setIsPlaying(false);
    setLap(0);
    setWeather('Sunny');
    setWetness(0);
    setSafetyCar('None');
    setScLapsRemaining(0);
    setFastestLapHolder(null);
    
    if (resultsData.length > 0) {
      const startingDrivers: Driver[] = resultsData.map((r: any, idx: number) => {
        const teamColorHex = r.TeamColor ? `#${r.TeamColor}` : '#94A3B8';
        const gp = selectedSessionType === 'R' || selectedSessionType === 'S'
          ? (parseInt(r.GridPosition) || 20)
          : (parseInt(r.Position) || idx + 1);
        
        // Find compound from first stint in laps data if possible
        const driverLaps = lapsData.filter((l: any) => l.Driver === r.Abbreviation && l.LapNumber === 1);
        const startCompoundRaw = driverLaps[0]?.Compound || 'MEDIUM';
        const startCompound = normalizeCompound(startCompoundRaw);
        
        return {
          id: r.DriverId || r.Abbreviation.toLowerCase(),
          name: r.FullName || r.BroadcastName,
          shortName: r.Abbreviation,
          number: parseInt(r.DriverNumber) || 0,
          team: r.TeamName,
          teamColor: teamColorHex,
          points: 0,
          gridPosition: gp,
          position: gp,
          prevPosition: gp,
          raceTime: gp * 0.8,
          gap: gp * 0.8,
          gapToLeader: gp === 1 ? 'LEADER' : `+${(gp * 0.8).toFixed(3)}`,
          fastestLap: false,
          dnf: false,
          isPitting: false,
          tyre: startCompound,
          tyreAge: 0,
          bestLapTime: '-',
          currentLapCompleted: 0
        };
      }).sort((a: Driver, b: Driver) => {
        return (selectedSessionType === 'R' || selectedSessionType === 'S')
          ? a.gridPosition - b.gridPosition
          : a.position - b.position;
      });
      
      startingDrivers.forEach((d, idx) => {
        d.position = idx + 1;
        d.prevPosition = idx + 1;
      });
      
      setDrivers(startingDrivers);
      setCommentary([
        { id: `reset-${Date.now()}`, lap: 0, text: `🔄 Simulation reset for ${selectedYear} ${selectedEventName}. Drivers are on grid!`, type: 'normal' }
      ]);
    } else {
      // Fallback to initial drivers if no backend data loaded yet
      const reset = INITIAL_DRIVERS.map(d => ({
        ...d,
        raceTime: d.gridPosition * 0.8,
        gap: d.gridPosition * 0.8,
        gapToLeader: d.gridPosition === 1 ? 'LEADER' : `+${(d.gridPosition * 0.8).toFixed(3)}`,
        position: d.gridPosition,
        prevPosition: d.gridPosition,
        fastestLap: false,
        dnf: false,
        isPitting: false,
        tyre: 'Medium' as const,
        tyreAge: 0,
        bestLapTime: '-'
      }));
      setDrivers(reset);
      setCommentary([
        { id: `reset-${Date.now()}`, lap: 0, text: `🔄 Simulation reset for the ${selectedTrack.name}. Drivers are on grid!`, type: 'normal' }
      ]);
    }
  };

  // Change Track handler
  const handleTrackChange = (trackName: string) => {
    const track = TRACKS.find(t => t.name === trackName);
    if (!track) return;
    setSelectedTrack(track);
    setIsPlaying(false);
    setLap(0);
    setWeather('Sunny');
    setWetness(0);
    setSafetyCar('None');
    setScLapsRemaining(0);
    setFastestLapHolder(null);
    
    const reset = INITIAL_DRIVERS.map(d => ({
      ...d,
      raceTime: d.gridPosition * 0.8,
      gap: d.gridPosition * 0.8,
      gapToLeader: d.gridPosition === 1 ? 'LEADER' : `+${(d.gridPosition * 0.8).toFixed(3)}`,
      position: d.gridPosition,
      prevPosition: d.gridPosition,
      fastestLap: false,
      dnf: false,
      isPitting: false,
      tyre: 'Medium' as const,
      tyreAge: 0,
      bestLapTime: '-'
    }));
    setDrivers(reset);
    setCommentary([
      { id: `track-${Date.now()}`, lap: 0, text: `🏎️ Circuit changed to ${track.name} (${track.location}).`, type: 'normal' }
    ]);
  };

  // Log commentary wrapper
  const addCommentary = (text: string, type: CommentaryLog['type'] = 'normal') => {
    setCommentary(prev => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random()}`,
        lap: lapRef.current,
        text,
        type
      }
    ]);
  };

  // ==========================================
  // Core Simulation Playback Tick
  // ==========================================
  const runSimulationTick = () => {
    const currentLap = lapRef.current;
    const currentTrack = selectedTrackRef.current;
    const currentDrivers = [...driversRef.current];
    const prevSC = safetyCarRef.current;

    // Check if race is finished
    if (currentLap >= currentTrack.laps) {
      setIsPlaying(false);
      return;
    }

    const nextLap = currentLap + 1;
    
    // Get laps for this lap number
    const lapRecords = lapsData.filter((l: any) => parseInt(l.LapNumber) === nextLap);
    if (lapRecords.length === 0) {
      // If we don't have records for this lap, we might have hit the end of the telemetry
      setIsPlaying(false);
      addCommentary(`🏁 CHECKERED FLAG: The race playback is complete!`, 'finish');
      return;
    }

    setLap(nextLap);

    // Weather transition checks based on tyres on track
    let nextWeather: 'Sunny' | 'Overcast' | 'Rainy' = 'Sunny';
    let nextWetness = 0;

    const hasWet = lapRecords.some((l: any) => l.Compound && l.Compound.toUpperCase().includes('WET'));
    const hasInter = lapRecords.some((l: any) => l.Compound && l.Compound.toUpperCase().includes('INTER'));

    if (hasWet) {
      nextWeather = 'Rainy';
      nextWetness = 80;
    } else if (hasInter) {
      nextWeather = 'Rainy';
      nextWetness = 40;
    } else {
      nextWeather = 'Sunny';
      nextWetness = 0;
    }

    // Weather commentary logs
    if (nextWeather !== weatherRef.current) {
      if (nextWeather === 'Rainy') {
        addCommentary(`🌧️ WEATHER UPDATE: Rain detected on circuit. Track wetness is ${nextWetness}%.`, 'weather');
      } else {
        addCommentary(`☀️ WEATHER UPDATE: Track is dry. Slick tyres are optimal.`, 'weather');
      }
    }
    setWeather(nextWeather);
    setWetness(nextWetness);

    // Safety Car / VSC tracking from track status
    let nextSC: 'None' | 'SC' | 'VSC' = 'None';
    
    // Look at first lap record TrackStatus
    const statusString = lapRecords[0]?.TrackStatus || '1';
    if (statusString.includes('4') || statusString.includes('5')) {
      // 4 = Safety Car, 5 = Red Flag
      nextSC = 'SC';
    } else if (statusString.includes('6')) {
      // 6 = Virtual Safety Car
      nextSC = 'VSC';
    }

    if (nextSC !== prevSC) {
      if (nextSC === 'SC') {
        addCommentary("⚠️ SAFETY CAR DEPLOYED: Speeds neutralized across the field.", 'sc');
      } else if (nextSC === 'VSC') {
        addCommentary("⚠️ VSC DEPLOYED: Virtual Safety Car active. Speeds neutralized.", 'sc');
      } else {
        addCommentary("🟢 GREEN FLAG: Safety car period ended. Racing resumes!", 'sc');
      }
    }
    setSafetyCar(nextSC);

    // Check fastest lap this lap
    let lapFastestTime = Infinity;
    let lapFastestHolder: any = null;

    lapRecords.forEach((record: any) => {
      const lapTimeSec = parseFloat(record.LapTime);
      if (lapTimeSec > 0 && lapTimeSec < lapFastestTime) {
        lapFastestTime = lapTimeSec;
        lapFastestHolder = record;
      }
    });

    // Update fastest lap holder
    const currentGlobalFastestSec = fastestLapHolderRef.current 
      ? parseLapTime(fastestLapHolderRef.current.time) 
      : Infinity;
      
    if (lapFastestTime < currentGlobalFastestSec && lapFastestHolder) {
      const driverObj = currentDrivers.find(d => d.shortName === lapFastestHolder.Driver);
      if (driverObj) {
        setFastestLapHolder({
          driverId: driverObj.id,
          time: formatLapTime(lapFastestTime)
        });
        addCommentary(`🟣 FASTEST LAP: ${driverObj.name} clocks a blistering ${formatLapTime(lapFastestTime)}!`, 'normal');
      }
    }

    // Update driver statuses
    let updatedDrivers = currentDrivers.map(driver => {
      if (driver.dnf) return driver;

      const lapRecord = lapRecords.find((l: any) => l.Driver === driver.shortName);
      const resultObj = resultsData.find((r: any) => r.Abbreviation === driver.shortName);

      if (lapRecord) {
        const lapTimeSec = parseFloat(lapRecord.LapTime);
        const isPitting = lapRecord.PitInTime !== null && lapRecord.PitInTime !== undefined;
        const compound = normalizeCompound(lapRecord.Compound);

        if (isPitting && !driver.isPitting) {
          addCommentary(`🔧 PIT STOP: ${driver.name} enters the pit lane for fresh ${compound} tyres.`, 'pit');
        }

        let newBestLapTime = driver.bestLapTime;
        if (lapRecord.IsPersonalBest && lapTimeSec > 0) {
          newBestLapTime = formatLapTime(lapTimeSec);
        }

        return {
          ...driver,
          position: parseInt(lapRecord.Position) || driver.position,
          raceTime: parseFloat(lapRecord.Time) || driver.raceTime,
          tyre: compound,
          tyreAge: parseInt(lapRecord.TyreLife) || 0,
          isPitting: isPitting,
          bestLapTime: newBestLapTime,
          currentLapCompleted: nextLap
        };
      } else {
        // No record for this lap. Check if they retired (DNF) or are lapped.
        const isDnf = resultObj && resultObj.Status !== 'Finished' && !resultObj.Status.startsWith('+');
        if (isDnf) {
          const retiredOrder = nextDnfOrderRef.current;
          const statusReason = resultObj.Status || 'Technical Issue';
          addCommentary(`💥 RETIREMENT: ${driver.name} has retired from the race (${statusReason}).`, 'crash');
          return {
            ...driver,
            dnf: true,
            dnfOrder: retiredOrder,
            position: 22,
            isPitting: false,
            gapToLeader: 'DNF'
          };
        }
        // Lapped driver: keep their previous details
        return driver;
      }
    });

    // Check for overtakes by comparing current positions with new positions
    // Sort updated drivers to compute new standings
    let sortedStandings = [...updatedDrivers].sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;
      if (a.dnf && b.dnf) return (a.dnfOrder ?? 0) - (b.dnfOrder ?? 0);
      return a.position - b.position;
    });

    const leaderTime = sortedStandings.length > 0 ? sortedStandings[0].raceTime : 0;

    let finalDrivers = sortedStandings.map((driver, index) => {
      if (driver.dnf) {
        return {
          ...driver,
          position: 22,
          gap: Infinity,
          gapToLeader: 'DNF'
        };
      }

      const position = index + 1;
      const prevPosition = driver.prevPosition; // using previous loop's state

      // Calculate gap
      const lastCompleted = driver.currentLapCompleted || 0;
      const lapsBehind = nextLap - lastCompleted;

      let gap = driver.raceTime - leaderTime;
      let gapToLeader = '';

      if (position === 1) {
        gapToLeader = 'LEADER';
      } else if (lapsBehind > 0) {
        gapToLeader = `+${lapsBehind} Lap${lapsBehind > 1 ? 's' : ''}`;
      } else {
        gapToLeader = `+${gap.toFixed(3)}`;
      }

      // Overtake checks (only if not pitting, no safety car, and actually climbed positions)
      if (position < prevPosition && !driver.isPitting && nextSC === 'None') {
        const placesGained = prevPosition - position;
        const driverAheadOld = currentDrivers.find(d => d.position === position);
        if (driverAheadOld && driverAheadOld.id !== driver.id && !driverAheadOld.dnf) {
          if (placesGained === 1) {
            addCommentary(`⚔️ OVERTAKE: ${driver.name} passes ${driverAheadOld.name} for P${position}!`, 'overtake');
          } else {
            addCommentary(`📈 ADVANCE: ${driver.name} gains ${placesGained} positions, moving up to P${position}.`, 'overtake');
          }
        }
      }

      // Update the prevPosition to position for next loop iteration
      return {
        ...driver,
        position,
        prevPosition: position,
        gap,
        gapToLeader
      };
    });

    // Check if new global fastest lap is set
    const fastestLapId = fastestLapHolderRef.current?.driverId;
    finalDrivers = finalDrivers.map(d => ({
      ...d,
      fastestLap: d.id === fastestLapId
    }));

    setDrivers(finalDrivers);

    // If final lap just completed, display finish summary
    if (nextLap >= currentTrack.laps) {
      setIsPlaying(false);
      addCommentary(`🏁 CHECKERED FLAG: The race is complete!`, 'finish');
      
      const podium = finalDrivers.filter(d => !d.dnf).slice(0, 3);
      if (podium.length >= 3) {
        addCommentary(`🏆 PODIUM: 🥇 ${podium[0].name} | 🥈 ${podium[1].name} | 🥉 ${podium[2].name}`, 'finish');
      }

      // Update points distribution to reflect final results from the backend resultsData
      const updatedPointsDrivers = finalDrivers.map(d => {
        const resultObj = resultsData.find((r: any) => r.Abbreviation === d.shortName);
        if (resultObj) {
          return {
            ...d,
            points: resultObj.Points || 0
          };
        }
        return d;
      });
      setDrivers(updatedPointsDrivers);
    }
  };

  // ==========================================
  // Manual Interactive Button Controls
  // ==========================================
  const triggerManualOvertake = (driverId: string) => {
    setDrivers(prevDrivers => {
      const driverIdx = prevDrivers.findIndex(d => d.id === driverId);
      if (driverIdx === -1) return prevDrivers;
      const driver = prevDrivers[driverIdx];
      if (driver.dnf || driver.position === 1) return prevDrivers;
      
      const targetPos = driver.position - 1;
      const targetDriverIdx = prevDrivers.findIndex(d => d.position === targetPos);
      if (targetDriverIdx === -1) return prevDrivers;
      const targetDriver = prevDrivers[targetDriverIdx];
      
      const updated = prevDrivers.map((d, idx) => {
        if (idx === driverIdx) {
          return {
            ...d,
            position: targetPos,
            prevPosition: d.position,
            // Slide slightly ahead
            raceTime: targetDriver.raceTime - 0.4
          };
        }
        if (idx === targetDriverIdx) {
          return {
            ...d,
            position: d.position + 1,
            prevPosition: d.position,
            raceTime: targetDriver.raceTime + 0.4
          };
        }
        return {
          ...d,
          prevPosition: d.position
        };
      });

      addCommentary(`🛠️ MANUAL OVERTAKE: ${driver.name} moves up to P${targetPos} past ${targetDriver.name}.`, 'overtake');
      
      // Resort and recalculate gaps
      return resortAndCalculateGaps(updated);
    });
  };

  const triggerManualDrop = (driverId: string) => {
    setDrivers(prevDrivers => {
      const driverIdx = prevDrivers.findIndex(d => d.id === driverId);
      if (driverIdx === -1) return prevDrivers;
      const driver = prevDrivers[driverIdx];
      
      const activeCount = prevDrivers.filter(d => !d.dnf).length;
      if (driver.dnf || driver.position >= activeCount) return prevDrivers;
      
      const targetPos = driver.position + 1;
      const targetDriverIdx = prevDrivers.findIndex(d => d.position === targetPos);
      if (targetDriverIdx === -1) return prevDrivers;
      const targetDriver = prevDrivers[targetDriverIdx];
      
      const updated = prevDrivers.map((d, idx) => {
        if (idx === driverIdx) {
          return {
            ...d,
            position: targetPos,
            prevPosition: d.position,
            raceTime: targetDriver.raceTime + 0.4
          };
        }
        if (idx === targetDriverIdx) {
          return {
            ...d,
            position: d.position - 1,
            prevPosition: d.position,
            raceTime: targetDriver.raceTime - 0.4
          };
        }
        return {
          ...d,
          prevPosition: d.position
        };
      });

      addCommentary(`🛠️ MANUAL DROP: ${driver.name} drops back behind ${targetDriver.name} to P${targetPos}.`, 'overtake');
      
      // Resort and recalculate gaps
      return resortAndCalculateGaps(updated);
    });
  };

  const triggerManualDNF = (driverId: string) => {
    setDrivers(prevDrivers => {
      const driverIdx = prevDrivers.findIndex(d => d.id === driverId);
      if (driverIdx === -1) return prevDrivers;
      const driver = prevDrivers[driverIdx];
      if (driver.dnf) return prevDrivers;
      
      const dnfCount = prevDrivers.filter(d => d.dnf).length;
      const nextDnfOrder = dnfCount + 1;
      const retiredPos = driver.position;
      
      const updated = prevDrivers.map((d, idx) => {
        if (idx === driverIdx) {
          return {
            ...d,
            dnf: true,
            dnfOrder: nextDnfOrder,
            position: 22,
            prevPosition: d.position,
            gapToLeader: 'DNF',
            isPitting: false
          };
        }
        if (!d.dnf && d.position > retiredPos) {
          return {
            ...d,
            position: d.position - 1,
            prevPosition: d.position
          };
        }
        return {
          ...d,
          prevPosition: d.position
        };
      });

      addCommentary(`⚠️ DNF TRIGGERED: ${driver.name} has retired from the race.`, 'crash');
      
      // Trigger a Safety Car
      setSafetyCar('SC');
      setScLapsRemaining(3);
      addCommentary("⚠️ SIGNAL: Safety Car deployed to clear vehicle from track.", "sc");

      return resortAndCalculateGaps(updated);
    });
  };

  const resortAndCalculateGaps = (list: Driver[]): Driver[] => {
    const sorted = [...list].sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;
      if (a.dnf && b.dnf) return (a.dnfOrder ?? 0) - (b.dnfOrder ?? 0);
      return a.raceTime - b.raceTime;
    });

    const leaderTime = sorted.length > 0 ? sorted[0].raceTime : 0;
    
    return sorted.map((d, index) => {
      if (d.dnf) {
        return { ...d, position: 22, gap: Infinity, gapToLeader: 'DNF' };
      }
      const position = index + 1;
      const gap = d.raceTime - leaderTime;
      return {
        ...d,
        position,
        gap,
        gapToLeader: position === 1 ? 'LEADER' : `+${gap.toFixed(3)}`
      };
    });
  };

  // Toggle play/pause
  const togglePlay = () => {
    if (lap >= selectedTrack.laps) {
      handleReset();
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Deploy safety car button click
  const handleDeploySafetyCar = () => {
    if (safetyCar !== 'None') return;
    setSafetyCar('SC');
    setScLapsRemaining(3);
    addCommentary("⚠️ SAFETY CAR DEPLOYED: Race speed neutralized by race control.", 'sc');
  };

  // Trigger rain button click
  const handleTriggerRain = () => {
    if (weather === 'Rainy') return;
    setWeather('Rainy');
    setWetness(50);
    addCommentary("🌧️ WEATHER MANUAL OVERRIDE: Torrential rain started. Track wetness 50%.", 'weather');
  };

  // Trigger DNF button click
  const handleTriggerRandomCrash = () => {
    const active = drivers.filter(d => !d.dnf);
    if (active.length <= 3) return;
    const randomIdx = Math.floor(Math.random() * (active.length - 2)) + 2;
    triggerManualDNF(active[randomIdx].id);
  };

  // ==========================================
  // Simulation Loop Effect
  // ==========================================
  useEffect(() => {
    if (!isPlaying) return;

    // Simulation speed interval matching: 1x = 1500ms, 2x = 800ms, 5x = 300ms
    const intervalMs = speed === 5 ? 300 : speed === 2 ? 800 : 1500;
    
    const simTimer = setInterval(() => {
      runSimulationTick();
    }, intervalMs);

    return () => clearInterval(simTimer);
  }, [isPlaying, speed]);

  // Layout positions sort list
  const sortedDrivers = useMemo(() => {
    return [...drivers].sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;
      if (a.dnf && b.dnf) return (a.dnfOrder ?? 0) - (b.dnfOrder ?? 0);
      return a.position - b.position;
    });
  }, [drivers]);

  const progressPercentage = (lap / selectedTrack.laps) * 100;
  const isFinished = lap >= selectedTrack.laps;

  const TrophyIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"/><path d="M12 2a7 7 0 0 1 7 7c0 2.54-1.24 4.54-3 5.4A7.08 7.08 0 0 1 8 9a7 7 0 0 1 4-7z"/></svg>
  );

  const FastestLapIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 animate-pulse"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
  );

  const UpArrowIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="m18 15-6-6-6 6"/></svg>
  );

  const DownArrowIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><path d="m6 9 6 6 6-6"/></svg>
  );

  const PlayIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>
  );

  const PauseIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>
  );

  const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
  );

  const RainIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25"/><path d="M8 19v2"/><path d="M12 20v2"/><path d="M16 19v2"/></svg>
  );

  const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
  );

  const WarningIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  );

  // Render HTML
  return (
    <div className="carbon-bg min-h-screen text-slate-100 flex flex-col font-sans">
      
      {/* ==========================================
          HEADER
          ========================================== */}
      <header className="bg-zinc-950/80 border-b border-zinc-800 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-f1-red text-white font-extrabold px-3 py-1 rounded text-lg tracking-wider f1-font skew-x-[-12deg]">
            F1
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Pitwall
            </h1>
            <p className="text-xs text-slate-400">
              Formuala 1 Telemetry Dashboard
            </p>
          </div>
        </div>

        {/* Live track info ticker */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <div className="text-right">
            <span className="text-xs text-slate-400 block">CURRENT CIRCUIT</span>
            <span className="font-semibold text-white">{selectedTrack.name}</span>
          </div>
          <div className="h-8 w-[1px] bg-zinc-800" />
          <div className="text-right">
            <span className="text-xs text-slate-400 block">WEATHER</span>
            <span className="font-semibold flex items-center justify-end gap-1.5 text-white">
              {weather === 'Sunny' ? <SunIcon /> : <RainIcon />}
              {weather} ({wetness}% Wet)
            </span>
          </div>
          <div className="h-8 w-[1px] bg-zinc-800" />
          <div className="text-right">
            <span className="text-xs text-slate-400 block">RACE TRACK STATE</span>
            <span className={`font-semibold ${safetyCar !== 'None' ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`}>
              {safetyCar === 'None' ? '🟢 GREEN FLAG' : `🟡 SAFETY CAR (${safetyCar})`}
            </span>
          </div>
          {upcomingSession && (
            <>
              <div className="h-8 w-[1px] bg-zinc-800" />
              <div className="text-right max-w-[200px]">
                <span className="text-[10px] text-f1-red font-black tracking-wider block animate-pulse">
                  📡 UPCOMING LIVE SESSION
                </span>
                <span className="font-bold text-white block text-xs truncate">
                  {upcomingSession.eventName}
                </span>
                <span className="text-xs text-slate-400 font-mono block">
                  {upcomingSession.sessionName}: <span className="text-yellow-400 font-bold">{countdownText}</span>
                </span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ==========================================
          MAIN LAYOUT CONTAINER
          ========================================== */}
      <main className="flex-1 w-full max-w-none px-6 py-6 flex flex-col lg:flex-row gap-6">
        
        {/* ==========================================
            LEFT SIDE: DYNAMIC STANDINGS LEADERBOARD
            ========================================== */}
        <section className="flex-1 flex flex-col bg-f1-card border border-f1-border rounded-xl p-4 backdrop-blur-md overflow-x-auto">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-f1-red animate-ping" />
              <h2 className="text-lg font-bold tracking-wide uppercase text-slate-200">
                Live Standings
              </h2>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Lap {lap} of {selectedTrack.laps} ({Math.round(progressPercentage)}% Run)
            </div>
          </div>

          {/* Table Headers */}
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase px-4 mb-2 tracking-wider min-w-[680px]">
            <div className="w-12 text-center">Pos</div>
            <div className="flex-1 px-4">Driver / Team</div>
            <div className="w-20 text-right">Gap</div>
            <div className="w-24 text-center">Tyres</div>
            <div className="w-20 text-right hidden sm:block">Best Lap</div>
            <div className="w-14 text-center hidden md:block">Pts</div>
            <div className="w-24 text-right">Controls</div>
          </div>

          {/* Scrollable Body Container */}
          <div className="overflow-y-auto flex-1 max-h-[720px] pr-1">
            {/* Animated Reordering Rows Container */}
            <div 
              className="relative w-full transition-all duration-300 min-w-[680px]"
              style={{ height: `${drivers.length * 66}px` }}
            >
            {sortedDrivers.map((driver, index) => {
              // Row index styling
              const isPodium = index < 3;
              const isPoints = index >= 3 && index < 10;
              
              let cardBg = "border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700/60";
              let shadowClass = "";
              
              if (driver.dnf) {
                cardBg = "border-red-950/40 bg-red-950/5 opacity-55";
              } else if (driver.isPitting) {
                cardBg = "border-amber-500/50 bg-amber-500/5 animate-pulse";
              } else if (index === 0) {
                cardBg = "border-amber-400/40 bg-amber-400/5 glow-gold";
                shadowClass = "glow-gold";
              } else if (index === 1) {
                cardBg = "border-slate-300/30 bg-slate-300/5 glow-silver";
                shadowClass = "glow-silver";
              } else if (index === 2) {
                cardBg = "border-amber-700/30 bg-amber-700/5 glow-bronze";
                shadowClass = "glow-bronze";
              } else if (isPoints) {
                cardBg = "border-blue-900/30 bg-blue-950/5 hover:border-blue-800/40";
              }

              // Overall change relative to starting grid
              const overallChange = driver.gridPosition - (index + 1);

              return (
                <div
                  key={driver.id}
                  id={`driver-row-${driver.id}`}
                  className="absolute left-0 right-0"
                  style={{
                    transform: `translateY(${index * 66}px)`,
                    height: '56px',
                    transition: 'transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.6s ease'
                  }}
                >
                  <div className={`h-[56px] rounded-lg border flex items-center justify-between px-3 md:px-4 ${cardBg} ${shadowClass} backdrop-blur-sm transition-all duration-300`}>
                    
                    {/* Position & Change */}
                    <div className="w-12 flex items-center justify-center gap-1.5">
                      <span className={`text-base font-bold f1-font ${isPodium ? 'text-white' : 'text-slate-400'}`}>
                        {(index + 1).toString().padStart(2, '0')}
                      </span>
                      <div className="w-4 flex items-center justify-center">
                        {driver.dnf ? (
                          <span className="text-red-500 font-extrabold text-[10px]">❌</span>
                        ) : overallChange > 0 ? (
                          <span className="flex items-center text-emerald-400 text-[10px] font-bold">
                            <UpArrowIcon />
                            {overallChange}
                          </span>
                        ) : overallChange < 0 ? (
                          <span className="flex items-center text-red-400 text-[10px] font-bold">
                            <DownArrowIcon />
                            {Math.abs(overallChange)}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </div>
                    </div>

                    {/* Driver Identity */}
                    <div className="flex-1 px-4 flex items-center gap-3 min-w-0">
                      {/* Team vertical line marker */}
                      <div 
                        className="w-1.5 h-7 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: driver.teamColor }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500 font-mono">#{driver.number}</span>
                          <span className="font-bold text-slate-100 uppercase tracking-wide hidden sm:inline text-sm">
                            {driver.name}
                          </span>
                          <span className="font-extrabold text-slate-100 uppercase tracking-wide inline sm:hidden text-sm">
                            {driver.shortName}
                          </span>
                          {driver.fastestLap && (
                            <span className="inline-flex items-center glow-purple rounded px-1.5 py-0.5 text-[9px] bg-purple-950/60 text-purple-300 font-extrabold gap-0.5 animate-pulse uppercase border border-purple-500/30">
                              <FastestLapIcon />
                              <span>Fastest</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block truncate">
                          {driver.team}
                        </span>
                      </div>
                    </div>

                    {/* Gap To Leader */}
                    <div className="w-20 text-right font-mono text-xs">
                      {driver.dnf ? (
                        <span className="text-red-500 font-bold tracking-wider">OUT</span>
                      ) : driver.isPitting ? (
                        <span className="text-amber-400 font-extrabold tracking-wider animate-flash-amber px-1.5 py-0.5 rounded text-[10px] border border-amber-500/30 bg-amber-950/20">
                          PITTING
                        </span>
                      ) : index === 0 ? (
                        <span className="text-amber-400 font-bold uppercase text-[10px] flex items-center justify-end gap-1">
                          <TrophyIcon />
                          Leader
                        </span>
                      ) : (
                        <span className="text-slate-300 font-medium">{driver.gapToLeader}s</span>
                      )}
                    </div>

                    {/* Tyres */}
                    <div className="w-24 flex items-center justify-center gap-2">
                      {driver.dnf ? (
                        <span className="text-slate-600 text-xs">—</span>
                      ) : (
                        <>
                          <span 
                            className={`w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-xs border-2 select-none
                              ${driver.tyre === 'Soft' ? 'border-red-600 text-red-500 bg-red-950/20' : ''}
                              ${driver.tyre === 'Medium' ? 'border-yellow-500 text-yellow-500 bg-yellow-950/20' : ''}
                              ${driver.tyre === 'Hard' ? 'border-white text-white bg-zinc-950/20' : ''}
                              ${driver.tyre === 'Intermediate' ? 'border-emerald-500 text-emerald-500 bg-emerald-950/20' : ''}
                              ${driver.tyre === 'Wet' ? 'border-blue-500 text-blue-500 bg-blue-950/20' : ''}
                            `}
                            title={`${driver.tyre} Tyres`}
                          >
                            {driver.tyre[0]}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px] hidden md:inline">
                            {driver.tyreAge}L
                          </span>
                        </>
                      )}
                    </div>

                    {/* Best Lap */}
                    <div className="w-20 text-right font-mono text-xs text-slate-400 hidden sm:block">
                      {driver.dnf ? '—' : driver.bestLapTime}
                    </div>

                    {/* Season Points */}
                    <div className="w-14 text-center font-mono text-xs text-slate-400 hidden md:block">
                      {driver.points}
                    </div>

                    {/* Override Controls (Disabled for Telemetry Mode) */}
                    <div className="w-24 flex items-center justify-end gap-1 opacity-20" title="Telemetry Playback Mode">
                      <button
                        id={`btn-overtake-${driver.id}`}
                        disabled={true}
                        className="p-1 rounded bg-zinc-850 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                        title="Disabled in Playback"
                      >
                        <UpArrowIcon />
                      </button>
                      <button
                        id={`btn-drop-${driver.id}`}
                        disabled={true}
                        className="p-1 rounded bg-zinc-850 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                        title="Disabled in Playback"
                      >
                        <DownArrowIcon />
                      </button>
                      <button
                        id={`btn-dnf-${driver.id}`}
                        disabled={true}
                        className="px-1.5 py-0.5 rounded bg-zinc-850 border border-zinc-800 text-zinc-650 text-[10px] font-bold cursor-not-allowed"
                        title="Disabled in Playback"
                      >
                        OUT
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </section>

        {/* ==========================================
            RIGHT SIDE: CONTROLS & COMMENTARY FEED
            ========================================== */}
        <section className="w-full lg:w-[400px] flex flex-col gap-6">
          
          {/* Simulation Controls Panel */}
          <div className="bg-f1-card border border-f1-border rounded-xl p-4 backdrop-blur-md flex flex-col gap-4">
            <h2 className="text-base font-bold text-slate-200 border-b border-zinc-800 pb-2 flex items-center gap-2">
              <span className="text-f1-red">⚡</span> Live Control Dashboard
            </h2>

            {/* Season & Session Selectors */}
            <div className="grid grid-cols-2 gap-2 font-sans">
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold uppercase">Season Year</label>
                <select
                  id="select-year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  disabled={isPlaying || isLoading}
                  className="w-full bg-zinc-950 border border-zinc-800 text-slate-200 rounded px-2.5 py-1.5 text-sm focus:border-f1-red outline-none disabled:opacity-50 font-medium"
                >
                  {Array.from({ length: 9 }, (_, i) => 2018 + i).map(year => (
                    <option key={year} value={year}>{year} Season</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1 font-semibold uppercase">Session Type</label>
                <select
                  id="select-session"
                  value={selectedSessionType}
                  onChange={(e) => setSelectedSessionType(e.target.value)}
                  disabled={isPlaying || isLoading}
                  className="w-full bg-zinc-950 border border-zinc-800 text-slate-200 rounded px-2.5 py-1.5 text-sm focus:border-f1-red outline-none disabled:opacity-50 font-medium"
                >
                  <option value="R">Race (R)</option>
                  <option value="Q">Qualifying (Q)</option>
                  <option value="S">Sprint (S)</option>
                  <option value="FP1">Practice 1 (FP1)</option>
                  <option value="FP2">Practice 2 (FP2)</option>
                  <option value="FP3">Practice 3 (FP3)</option>
                </select>
              </div>
            </div>

            {/* Grand Prix Selector */}
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold uppercase">Grand Prix Event</label>
              <select
                id="select-event"
                value={selectedEventName}
                onChange={(e) => setSelectedEventName(e.target.value)}
                disabled={isPlaying || isLoading || scheduleEvents.length === 0}
                className="w-full bg-zinc-950 border border-zinc-800 text-slate-200 rounded px-2.5 py-1.5 text-sm focus:border-f1-red outline-none disabled:opacity-50 font-medium"
              >
                {scheduleEvents.map((event: any) => (
                  <option key={event.EventName} value={event.EventName}>
                    {event.EventName} ({event.Location})
                  </option>
                ))}
              </select>
            </div>

            {/* Play, Speed, Reset */}
            <div className="flex gap-2">
              <button
                id="btn-play-simulation"
                onClick={togglePlay}
                disabled={isFinished || isLoading}
                className={`flex-1 py-2 px-3 rounded font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer
                  ${isPlaying 
                    ? 'bg-amber-600 text-black hover:bg-amber-500' 
                    : isFinished 
                      ? 'bg-zinc-800 text-slate-500 border border-zinc-700 cursor-not-allowed'
                      : 'bg-f1-red text-white hover:bg-red-500'
                  }`}
              >
                {isPlaying ? (
                  <>
                    <PauseIcon />
                    <span>Pause Sim</span>
                  </>
                ) : (
                  <>
                    <PlayIcon />
                    <span>{lap > 0 ? 'Resume Sim' : 'Start Playback'}</span>
                  </>
                )}
              </button>

              <button
                id="btn-reset-simulation"
                onClick={handleReset}
                disabled={isLoading}
                className="p-2.5 rounded bg-zinc-800 border border-zinc-700 text-slate-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                title="Reset Race"
              >
                <ResetIcon />
              </button>
            </div>

            {/* Simulation speed multiplier */}
            <div>
              <span className="text-xs text-slate-400 block mb-1 font-semibold uppercase">Playback speed</span>
              <div className="flex rounded border border-zinc-800 overflow-hidden text-xs font-mono">
                {([1, 2, 5] as const).map(s => (
                  <button
                    key={s}
                    id={`btn-speed-${s}x`}
                    onClick={() => setSpeed(s)}
                    className={`flex-1 py-1.5 text-center font-bold transition-colors
                      ${speed === s 
                        ? 'bg-f1-red text-white' 
                        : 'bg-zinc-950 text-slate-400 hover:text-white hover:bg-zinc-900'
                      }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>


          </div>

          {/* Live Telemetry Progress Map */}
          <div className="bg-f1-card border border-f1-border rounded-xl p-4 backdrop-blur-md flex flex-col gap-2">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              🏁 Lap Progress
            </h2>
            <div className="w-full bg-zinc-950 border border-zinc-800 rounded-full h-3 overflow-hidden relative mt-1">
              <div 
                className="bg-f1-red h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
              <span>START / GRID</span>
              <span>LAP {lap} / {selectedTrack.laps}</span>
              <span>FINISH</span>
            </div>
          </div>

          {/* Race Event Log (Commentary) */}
          <div className="bg-f1-card border border-f1-border rounded-xl p-4 backdrop-blur-md flex flex-col h-[180px]">
            <h2 className="text-base font-bold text-slate-200 border-b border-zinc-800 pb-2 mb-3 flex items-center gap-2">
              🎙️ Live Race Commentary
            </h2>

            <div ref={terminalContainerRef} className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 text-xs font-mono">
              {commentary.map((log) => {
                let colorClass = "text-slate-300";
                let prefix = `[L${log.lap}]`;
                
                if (log.type === 'overtake') {
                  colorClass = "text-emerald-400 font-semibold";
                } else if (log.type === 'crash') {
                  colorClass = "text-red-400 font-extrabold bg-red-950/20 p-1 border border-red-500/20 rounded";
                } else if (log.type === 'pit') {
                  colorClass = "text-amber-300 font-medium";
                } else if (log.type === 'weather') {
                  colorClass = "text-sky-300 font-semibold";
                } else if (log.type === 'sc') {
                  colorClass = "text-amber-400 font-bold bg-amber-950/20 p-1 border border-amber-500/20 rounded animate-pulse";
                } else if (log.type === 'finish') {
                  colorClass = "text-yellow-400 font-bold border-l-2 border-yellow-500 pl-1.5";
                }

                return (
                  <div key={log.id} className={`leading-relaxed ${colorClass}`}>
                    <span className="text-slate-500 font-semibold mr-1.5">{prefix}</span>
                    <span>{log.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Track Profile Information */}
          <div className="bg-f1-card border border-f1-border rounded-xl p-4 backdrop-blur-md text-xs flex flex-col gap-2.5">
            <h2 className="text-sm font-bold text-slate-200 border-b border-zinc-800 pb-1.5 flex items-center gap-2">
              📋 Track Specifications
            </h2>
            <div className="grid grid-cols-2 gap-y-2 text-slate-300">
              <div>
                <span className="text-[10px] text-slate-500 block">CIRCUIT LENGTH</span>
                <span className="font-semibold">{selectedTrack.length}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">RACE LAPS</span>
                <span className="font-semibold">{selectedTrack.laps} Laps</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">WEATHER RAIN RISK</span>
                <span className="font-semibold">{(selectedTrack.rainChance * 100).toFixed(0)}% Risk</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">OVERTAKING DIFFICULTY</span>
                <span className="font-semibold">
                  {selectedTrack.overtakeDifficulty < 0.6 ? '🚨 Extreme' : selectedTrack.overtakeDifficulty < 1.0 ? '⚠️ Hard' : '🟢 Moderate'}
                </span>
              </div>
              <div className="col-span-2 mt-1 pt-1.5 border-t border-zinc-800">
                <span className="text-[10px] text-slate-500 block">LAP RECORD</span>
                <span className="font-mono text-purple-400">
                  {selectedTrack.record} <span className="text-slate-400">({selectedTrack.recordHolder})</span>
                </span>
              </div>
            </div>
          </div>
          
        </section>

      </main>

      {/* ==========================================
          FOOTER
          ========================================== */}
      <footer className="mt-auto py-6 border-t border-zinc-900 bg-zinc-950 text-center text-xs text-slate-500 flex flex-col gap-1">
        <div>🏎️ Formula 1 Standings Dashboard Simulator</div>
        <div>Created by Uthira Muthu S P</div>
      </footer>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center gap-4 text-slate-100 font-sans">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-zinc-800 border-t-f1-red rounded-full animate-spin" />
            <div className="absolute inset-2 bg-f1-red rounded-full flex items-center justify-center text-white font-black text-sm tracking-tighter skew-x-[-6deg] animate-pulse">
              F1
            </div>
          </div>
          <div className="text-center px-4 max-w-md">
            <h3 className="font-bold text-lg text-white mb-1">Retrieving Telemetry</h3>
            <p className="text-sm text-slate-400 font-mono animate-pulse">
              {loadingProgress}
            </p>
          </div>
        </div>
      )}

      {/* API Connection Error Overlay */}
      {apiError && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center gap-4 text-slate-100 px-6 text-center font-sans">
          <div className="w-16 h-16 rounded-full bg-red-950/40 border border-red-500/30 flex items-center justify-center text-red-500 text-3xl">
            ⚠️
          </div>
          <h3 className="font-bold text-xl text-white">Connection Error</h3>
          <p className="text-sm text-slate-400 max-w-md bg-zinc-900 p-4 rounded-lg border border-zinc-800 font-mono">
            {apiError}
          </p>
          <button
            onClick={() => {
              if (selectedEventName) {
                loadRaceTelemetry(selectedYear, selectedEventName, selectedSessionType);
              } else {
                setSelectedYear(selectedYear); // re-trigger schedule fetch
              }
            }}
            className="px-6 py-2 bg-f1-red hover:bg-red-500 text-white font-bold rounded-lg transition-colors cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
}
