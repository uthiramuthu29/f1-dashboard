'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

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

  // Reset function
  const handleReset = () => {
    setIsPlaying(false);
    setLap(0);
    setWeather('Sunny');
    setWetness(0);
    setSafetyCar('None');
    setScLapsRemaining(0);
    setFastestLapHolder(null);
    
    // Reset drivers back to starting grid points
    const reset = INITIAL_DRIVERS.map(d => ({
      ...d,
      raceTime: d.gridPosition * 0.8, // Initial spacing at start
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
  // Core Simulation Physics Step
  // ==========================================
  const runSimulationTick = () => {
    const currentLap = lapRef.current;
    const currentTrack = selectedTrackRef.current;
    const currentDrivers = [...driversRef.current];
    const currentSC = safetyCarRef.current;
    const currentScLaps = scLapsRemainingRef.current;
    const currentWet = wetnessRef.current;
    const currentWeather = weatherRef.current;

    // Check if race is finished
    if (currentLap >= currentTrack.laps) {
      setIsPlaying(false);
      return;
    }

    const nextLap = currentLap + 1;
    setLap(nextLap);

    // Weather transition checks
    let nextWeather = currentWeather;
    let nextWetness = currentWet;

    if (currentWeather === 'Sunny') {
      if (Math.random() < currentTrack.rainChance / 8) {
        nextWeather = 'Overcast';
        addCommentary("☁️ METEOROLOGY: Dark clouds grouping over the circuit. Sun covered.", 'weather');
      }
    } else if (currentWeather === 'Overcast') {
      const roll = Math.random();
      if (roll < 0.15) {
        nextWeather = 'Rainy';
        addCommentary("🌧️ WEATHER UPDATE: It's starting to rain! Track surface is becoming slippery.", 'weather');
      } else if (roll > 0.85) {
        nextWeather = 'Sunny';
        addCommentary("☀️ WEATHER UPDATE: Clouds breaking. Sunshine drying the track surface.", 'weather');
      }
    } else if (currentWeather === 'Rainy') {
      if (Math.random() < 0.10) {
        nextWeather = 'Overcast';
        addCommentary("🌤️ WEATHER UPDATE: Rain has stopped. A dry racing line should appear soon.", 'weather');
      }
    }

    // Adjust track wetness based on weather
    if (nextWeather === 'Rainy') {
      nextWetness = Math.min(100, currentWet + 20);
    } else if (nextWeather === 'Sunny') {
      nextWetness = Math.max(0, currentWet - 15);
    } else { // Overcast
      nextWetness = Math.max(0, currentWet - 5);
    }
    setWeather(nextWeather);
    setWetness(nextWetness);

    // Safety Car lap progress
    let nextSC = currentSC;
    let nextScLaps = currentScLaps;

    if (currentSC !== 'None') {
      if (currentScLaps <= 1) {
        nextSC = 'None';
        nextScLaps = 0;
        addCommentary("🟢 SAFETY CAR IN: Safety car pits. GREEN FLAG! Racing resumes!", 'sc');
      } else {
        nextScLaps -= 1;
        addCommentary(`🟡 SAFETY CAR: Circulating the track (Laps remaining: ${nextScLaps}). Pack compressed.`, 'sc');
      }
      setSafetyCar(nextSC);
      setScLapsRemaining(nextScLaps);
    }

    // Check for random DNF (only when Safety car is NOT already active)
    let triggeredDnfId = '';
    if (nextSC === 'None' && Math.random() < currentTrack.dnfChance) {
      const active = currentDrivers.filter(d => !d.dnf);
      if (active.length > 3) {
        // Pick random driver from P4 downward to keep podium competition stable but random
        const dnfIdx = Math.floor(Math.random() * (active.length - 3)) + 3;
        const targetDriver = active[dnfIdx];
        triggeredDnfId = targetDriver.id;
        
        // Random crash details
        const incidentTypes = [
          "suffered an engine blow-out!",
          "collided with the barrier at Turn 8!",
          "retired in the pits with gearbox failure.",
          "lost the rear and spun into the gravel trap!"
        ];
        const text = incidentTypes[Math.floor(Math.random() * incidentTypes.length)];
        
        addCommentary(`💥 RETIREMENT: ${targetDriver.name} has ${text}`, 'crash');
        
        // Deploy Safety Car or VSC
        const isFullSc = Math.random() > 0.4;
        nextSC = isFullSc ? 'SC' : 'VSC';
        nextScLaps = isFullSc ? 3 : 2;
        setSafetyCar(nextSC);
        setScLapsRemaining(nextScLaps);
        addCommentary(`⚠️ SIGNAL: ${nextSC} deployed. Speeds neutralized.`, 'sc');
      }
    }

    // Sort order based on previous position to calculate DRS
    const sortedPrev = [...currentDrivers].sort((a, b) => a.position - b.position);

    // Track best lap times this lap
    let lapFastestTime = Infinity;
    let lapFastestHolder: Driver | null = null;

    // First pass: Calculate lap times for active drivers, check tyre pit stops
    let updatedDrivers = currentDrivers.map(driver => {
      // If DNF, stays in DNF
      if (driver.id === triggeredDnfId) {
        return {
          ...driver,
          dnf: true,
          dnfOrder: nextDnfOrderRef.current,
          position: 22,
          isPitting: false,
          gapToLeader: 'DNF'
        };
      }
      if (driver.dnf) return driver;

      // Base Lap Time
      let lapTime = currentTrack.baseLapTime;

      // Performance weights
      lapTime += getDriverWeight(driver.id);
      lapTime += getTeamWeight(driver.team);
      
      // Tyre wear penalty
      lapTime += getTyreWearWeight(driver.tyre, driver.tyreAge);

      // Weather penalty
      lapTime += getWeatherPenalty(driver.tyre, nextWeather, nextWetness);

      // DRS Boost: If trailing within 1.0s of car ahead, no SC, and dry conditions
      const prevPosIdx = sortedPrev.findIndex(d => d.id === driver.id);
      let drsActive = false;
      if (prevPosIdx > 0 && nextSC === 'None' && nextWeather !== 'Rainy') {
        const carAhead = sortedPrev[prevPosIdx - 1];
        const gapToAhead = driver.raceTime - carAhead.raceTime;
        if (gapToAhead > 0 && gapToAhead < 1.0 && !carAhead.dnf) {
          lapTime -= 0.65; // DRS speed gain
          drsActive = true;
        }
      }

      // Random Lap fluctuation
      lapTime += (Math.random() * 0.6) - 0.3;

      // Safety Car speed cap
      if (nextSC !== 'None') {
        // Speeds are severely limited under SC/VSC
        const scMultiplier = nextSC === 'SC' ? 1.45 : 1.25;
        lapTime = currentTrack.baseLapTime * scMultiplier + (Math.random() * 0.3);
      }

      // ----------------------------------------
      // Pit Stop Logic
      // ----------------------------------------
      let pittingThisLap = false;
      let nextTyre = driver.tyre;
      let nextTyreAge = driver.tyreAge + 1;

      // Decisions to pit:
      // 1. Wet track but on dry slick tyres
      const wetTarmacNeedRainTyres = nextWetness > 40 && (driver.tyre === 'Soft' || driver.tyre === 'Medium' || driver.tyre === 'Hard');
      // 2. Dry track but on wet weather tyres
      const dryTarmacNeedSlicks = nextWetness <= 20 && (driver.tyre === 'Intermediate' || driver.tyre === 'Wet');
      // 3. Tyres are heavily worn
      const softWorn = driver.tyre === 'Soft' && driver.tyreAge > 12;
      const medWorn = driver.tyre === 'Medium' && driver.tyreAge > 20;
      const hardWorn = driver.tyre === 'Hard' && driver.tyreAge > 30;
      const interWorn = driver.tyre === 'Intermediate' && driver.tyreAge > 18;
      const wetWorn = driver.tyre === 'Wet' && driver.tyreAge > 18;
      const tyreWorn = softWorn || medWorn || hardWorn || interWorn || wetWorn;

      // Only pit if there are laps left (don't pit on final lap)
      const lapsLeft = currentTrack.laps - nextLap;
      
      // If we need to pit and aren't already pitting, trigger pit lane entrance
      if ((wetTarmacNeedRainTyres || dryTarmacNeedSlicks || tyreWorn) && lapsLeft > 0 && !driver.isPitting) {
        pittingThisLap = true;
        nextTyreAge = 0;

        // Compound selection based on wetness
        if (nextWetness > 65) {
          nextTyre = 'Wet';
        } else if (nextWetness > 30) {
          nextTyre = 'Intermediate';
        } else {
          // Slick options
          if (lapsLeft < 10) {
            nextTyre = 'Soft';
          } else if (lapsLeft < 22) {
            nextTyre = 'Medium';
          } else {
            nextTyre = 'Hard';
          }
        }
      }

      // Clear pitting flag if they pitted in the previous tick
      let wasPitting = driver.isPitting;
      
      let finalLapTime = lapTime;
      if (pittingThisLap) {
        finalLapTime += 21.5; // Adding pit-stop overhead
        addCommentary(`🔧 PIT STOP: ${driver.name} comes in for fresh ${nextTyre} tyres.`, 'pit');
      }

      const newRaceTime = driver.raceTime + finalLapTime;

      // Track personal best lap times (exclude pitting laps and safety car laps)
      let newBestLapTime = driver.bestLapTime;
      const pureLapTime = pittingThisLap ? lapTime : finalLapTime;
      
      if (!pittingThisLap && !wasPitting && nextSC === 'None') {
        const currentBestSec = parseLapTime(driver.bestLapTime);
        if (pureLapTime < currentBestSec) {
          newBestLapTime = formatLapTime(pureLapTime);
          if (pureLapTime < lapFastestTime) {
            lapFastestTime = pureLapTime;
            lapFastestHolder = { ...driver, bestLapTime: newBestLapTime, raceTime: newRaceTime };
          }
        }
      }

      return {
        ...driver,
        raceTime: newRaceTime,
        tyre: pittingThisLap ? nextTyre : driver.tyre,
        tyreAge: pittingThisLap ? 0 : nextTyreAge,
        isPitting: pittingThisLap,
        bestLapTime: newBestLapTime
      };
    });

    // ----------------------------------------
    // Safety Car Compression Physics
    // ----------------------------------------
    if (nextSC !== 'None') {
      // Sort active drivers under safety car to bunch them up
      const active = updatedDrivers.filter(d => !d.dnf).sort((a, b) => a.raceTime - b.raceTime);
      if (active.length > 0) {
        const leader = active[0];
        
        // Loop and squash gaps (max gap under SC is compressed to 0.4s to 0.7s)
        for (let i = 1; i < active.length; i++) {
          const car = active[i];
          const carAhead = active[i - 1];
          const idealGap = 0.4 + (i * 0.05) + (Math.random() * 0.05); // compressed spacing
          
          // Modify the raceTime directly in updatedDrivers
          const driverIdx = updatedDrivers.findIndex(d => d.id === car.id);
          if (driverIdx !== -1) {
            updatedDrivers[driverIdx].raceTime = carAhead.raceTime + idealGap;
          }
        }
      }
    }

    // ----------------------------------------
    // Sort Standings & Check Overtakes
    // ----------------------------------------
    // Sort: Active drivers by raceTime, DNFs by dnfOrder at the bottom
    let sortedStandings = [...updatedDrivers].sort((a, b) => {
      if (a.dnf && !b.dnf) return 1;
      if (!a.dnf && b.dnf) return -1;
      if (a.dnf && b.dnf) return (a.dnfOrder ?? 0) - (b.dnfOrder ?? 0);
      return a.raceTime - b.raceTime;
    });

    // Leader race time for gap calculations
    const leaderTime = sortedStandings.length > 0 ? sortedStandings[0].raceTime : 0;

    // Second pass: Assign positions, calculate gaps, detect overtakes
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
      const prevPosition = driver.position;

      // Calculate gap
      const gap = driver.raceTime - leaderTime;
      const gapToLeader = position === 1 ? 'LEADER' : `+${gap.toFixed(3)}`;

      // Overtake checks (only if not pitting, no safety car, and actually climbed positions)
      if (position < prevPosition && !driver.isPitting && nextSC === 'None') {
        const placesGained = prevPosition - position;
        
        // Find who they passed (looking at previous standings)
        const driverAheadOld = sortedPrev[position - 1]; // who was at their new position previously
        if (driverAheadOld && driverAheadOld.id !== driver.id && !driverAheadOld.dnf) {
          if (placesGained === 1) {
            addCommentary(`⚔️ OVERTAKE: ${driver.name} makes a clean move past ${driverAheadOld.name} for P${position}!`, 'overtake');
          } else {
            addCommentary(`📈 ADVANCE: ${driver.name} gains ${placesGained} positions, moving up to P${position}.`, 'overtake');
          }
        }
      }

      return {
        ...driver,
        position,
        prevPosition,
        gap,
        gapToLeader
      };
    });

    // Check if new global fastest lap is set
    const holder = lapFastestHolder as Driver | null;
    if (holder) {
      const currentGlobalFastestSec = fastestLapHolderRef.current 
        ? parseLapTime(fastestLapHolderRef.current.time) 
        : Infinity;
        
      if (lapFastestTime < currentGlobalFastestSec) {
        setFastestLapHolder({
          driverId: holder.id,
          time: formatLapTime(lapFastestTime)
        });

        // Set fastest lap flags
        finalDrivers = finalDrivers.map(d => ({
          ...d,
          fastestLap: d.id === holder.id
        }));

        addCommentary(`🟣 FASTEST LAP: ${holder.name} clocks a blistering ${formatLapTime(lapFastestTime)}!`, 'normal');
      }
    }

    setDrivers(finalDrivers);

    // If final lap just completed, display finish summary
    if (nextLap >= currentTrack.laps) {
      setIsPlaying(false);
      addCommentary(`🏁 CHECKERED FLAG: The race is complete!`, 'finish');
      
      const podium = finalDrivers.filter(d => !d.dnf).slice(0, 3);
      if (podium.length >= 3) {
        addCommentary(`🏆 PODIUM: 🥇 ${podium[0].name} | 🥈 ${podium[1].name} | 🥉 ${podium[2].name}`, 'finish');
      }

      // Add points to season standings!
      // 25, 18, 15, 12, 10, 8, 6, 4, 2, 1
      const pointsDistribution = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
      const updatedPointsDrivers = finalDrivers.map(d => {
        if (d.dnf) return d;
        let pointsEarned = 0;
        if (d.position <= 10) {
          pointsEarned += pointsDistribution[d.position - 1];
        }
        // Fastest lap bonus (+1 point if finishing in top 10)
        if (d.fastestLap && d.position <= 10) {
          pointsEarned += 1;
          addCommentary(`✨ BONUS: ${d.name} scores +1 point for fastest lap!`, 'finish');
        }

        if (pointsEarned > 0) {
          return {
            ...d,
            points: d.points + pointsEarned
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
              Leaderboard & Live Race Simulator
            </h1>
            <p className="text-xs text-slate-400">
              Interactive 22-Driver Position Telemetry Dashboard
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
        </div>
      </header>

      {/* ==========================================
          MAIN LAYOUT CONTAINER
          ========================================== */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        
        {/* ==========================================
            LEFT SIDE: DYNAMIC STANDINGS LEADERBOARD
            ========================================== */}
        <section className="flex-1 flex flex-col bg-f1-card border border-f1-border rounded-xl p-4 backdrop-blur-md">
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
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase px-4 mb-2 tracking-wider">
            <div className="w-12 text-center">Pos</div>
            <div className="flex-1 px-4">Driver / Team</div>
            <div className="w-20 text-right">Gap</div>
            <div className="w-24 text-center">Tyres</div>
            <div className="w-20 text-right hidden sm:block">Best Lap</div>
            <div className="w-14 text-center hidden md:block">Pts</div>
            <div className="w-24 text-right">Controls</div>
          </div>

          {/* Animated Reordering Rows Container */}
          <div 
            className="relative w-full transition-all duration-300"
            style={{ height: `${22 * 66}px` }}
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

                    {/* Override Controls */}
                    <div className="w-24 flex items-center justify-end gap-1">
                      <button
                        id={`btn-overtake-${driver.id}`}
                        onClick={() => triggerManualOvertake(driver.id)}
                        disabled={driver.dnf || index === 0}
                        className="p-1 rounded bg-zinc-800 hover:bg-emerald-950 border border-zinc-700 hover:border-emerald-600 text-emerald-400 disabled:opacity-30 disabled:hover:bg-zinc-800 disabled:hover:border-zinc-700 transition-colors"
                        title="Overtake Ahead"
                      >
                        <UpArrowIcon />
                      </button>
                      <button
                        id={`btn-drop-${driver.id}`}
                        onClick={() => triggerManualDrop(driver.id)}
                        disabled={driver.dnf || driver.position >= drivers.filter(d => !d.dnf).length}
                        className="p-1 rounded bg-zinc-800 hover:bg-red-990 border border-zinc-700 hover:border-red-600 text-red-400 disabled:opacity-30 disabled:hover:bg-zinc-800 disabled:hover:border-zinc-700 transition-colors"
                        title="Drop Behind"
                      >
                        <DownArrowIcon />
                      </button>
                      <button
                        id={`btn-dnf-${driver.id}`}
                        onClick={() => triggerManualDNF(driver.id)}
                        disabled={driver.dnf}
                        className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-red-600 hover:text-white border border-zinc-700 text-slate-400 disabled:opacity-30 disabled:hover:bg-zinc-800 text-[10px] font-bold transition-all"
                        title="Force DNF"
                      >
                        OUT
                      </button>
                    </div>

                  </div>
                </div>
              );
            })}
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

            {/* Circuit Selector */}
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-semibold uppercase">Track Circuit</label>
              <select
                id="select-track"
                value={selectedTrack.name}
                onChange={(e) => handleTrackChange(e.target.value)}
                disabled={isPlaying}
                className="w-full bg-zinc-950 border border-zinc-800 text-slate-200 rounded px-2.5 py-1.5 text-sm focus:border-f1-red outline-none disabled:opacity-50"
              >
                {TRACKS.map(t => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Play, Speed, Reset */}
            <div className="flex gap-2">
              <button
                id="btn-play-simulation"
                onClick={togglePlay}
                disabled={isFinished}
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
                    <span>{lap > 0 ? 'Resume Sim' : 'Start Race'}</span>
                  </>
                )}
              </button>

              <button
                id="btn-reset-simulation"
                onClick={handleReset}
                className="p-2.5 rounded bg-zinc-800 border border-zinc-700 text-slate-300 hover:bg-zinc-700 transition-colors"
                title="Reset Race"
              >
                <ResetIcon />
              </button>
            </div>

            {/* Simulation speed multiplier */}
            <div>
              <span className="text-xs text-slate-400 block mb-1 font-semibold uppercase">Simulation speed</span>
              <div className="flex rounded border border-zinc-800 overflow-hidden text-xs">
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

            {/* Interactive Incident Buttons */}
            <div className="grid grid-cols-3 gap-2 border-t border-zinc-800 pt-3 mt-1">
              <button
                id="btn-trigger-sc"
                onClick={handleDeploySafetyCar}
                disabled={!isPlaying || safetyCar !== 'None'}
                className="py-1.5 px-2 bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 hover:bg-amber-500/20 text-amber-400 text-xs font-bold rounded disabled:opacity-30 transition-all flex flex-col items-center justify-center gap-1"
              >
                <WarningIcon />
                <span>Safety Car</span>
              </button>
              
              <button
                id="btn-trigger-rain"
                onClick={handleTriggerRain}
                disabled={!isPlaying || weather === 'Rainy'}
                className="py-1.5 px-2 bg-blue-500/10 border border-blue-500/30 hover:border-blue-400 hover:bg-blue-500/20 text-blue-400 text-xs font-bold rounded disabled:opacity-30 transition-all flex flex-col items-center justify-center gap-1"
              >
                <RainIcon />
                <span>Make Rain</span>
              </button>

              <button
                id="btn-trigger-crash"
                onClick={handleTriggerRandomCrash}
                disabled={!isPlaying}
                className="py-1.5 px-2 bg-red-500/10 border border-red-500/30 hover:border-red-400 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded disabled:opacity-30 transition-all flex flex-col items-center justify-center gap-1"
              >
                <span>💥</span>
                <span>Crash Car</span>
              </button>
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
        <div>Created with React 19, Next.js and Tailwind CSS</div>
      </footer>
    </div>
  );
}
