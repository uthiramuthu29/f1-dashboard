import os
import datetime
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import fastf1
import pandas as pd

from helpers import df_to_dict_list, clean_value

# Create cache directory
os.makedirs('f1_cache', exist_ok=True)

# Enable caching to speed up subsequent queries
try:
    fastf1.cache.enable_cache('f1_cache')
    print("Enabled FastF1 cache using fastf1.cache.enable_cache")
except AttributeError:
    fastf1.Cache.enable_cache('f1_cache')
    print("Enabled FastF1 cache using fastf1.Cache.enable_cache")

app = FastAPI(
    title="F1 Dashboard API",
    description="FastAPI service integrated with FastF1 to serve calendar schedule, results, laps, and telemetry.",
    version="1.0.0"
)

# Enable CORS so frontend (and Postman) can request data without restrictions
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
        "cache_dir": "f1_cache",
        "fastf1_version": fastf1.__version__
    }

@app.get("/api/schedule")
def get_schedule(year: int = Query(None, description="The F1 season year (e.g. 2024). Defaults to current year.")):
    if not year:
        year = datetime.datetime.now().year
    
    try:
        schedule = fastf1.get_event_schedule(year)
        # Convert schedule DataFrame to dict records
        events_list = df_to_dict_list(schedule)
        return {
            "success": True,
            "year": year,
            "count": len(events_list),
            "events": events_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch schedule for year {year}: {str(e)}")

@app.get("/api/session_info")
def get_session_info(
    year: int = Query(..., description="Year of the season (e.g. 2024)"),
    event: str = Query(..., description="Grand Prix name (e.g. 'Monaco', 'Silverstone') or Round number (e.g. '1')"),
    session: str = Query(..., description="Session type: 'R' (Race), 'Q' (Qualifying), 'FP1', 'FP2', 'FP3', 'S' (Sprint)")
):
    try:
        s = fastf1.get_session(year, event, session)
        s.load(laps=False, telemetry=False, weather=False, messages=False)
        
        event_dict = {}
        if hasattr(s, 'event') and s.event is not None:
            # s.event is a Series, let's convert it to a dict
            event_dict = clean_value(s.event.to_dict())
            
        return {
            "success": True,
            "year": year,
            "event_name": s.event['EventName'] if ('event' in dir(s) and 'EventName' in s.event) else s.name,
            "session_name": s.name,
            "session_date": clean_value(s.date),
            "event_details": event_dict,
            "drivers": list(s.drivers) if s.drivers is not None else []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load session details: {str(e)}")

@app.get("/api/results")
def get_results(
    year: int = Query(..., description="Year of the season (e.g. 2024)"),
    event: str = Query(..., description="Grand Prix name or Round number"),
    session: str = Query(..., description="Session type: 'R', 'Q', 'FP1', 'FP2', 'FP3', 'S'")
):
    try:
        s = fastf1.get_session(year, event, session)
        s.load(laps=False, telemetry=False, weather=False, messages=False)
        
        results_list = []
        if s.results is not None and not s.results.empty:
            results_list = df_to_dict_list(s.results)
            
        return {
            "success": True,
            "year": year,
            "event": event,
            "session": session,
            "session_name": s.name,
            "count": len(results_list),
            "results": results_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch session results: {str(e)}")

@app.get("/api/laps")
def get_laps(
    year: int = Query(..., description="Year of the season (e.g. 2024)"),
    event: str = Query(..., description="Grand Prix name or Round number"),
    session: str = Query(..., description="Session type: 'R', 'Q', 'FP1', 'FP2', 'FP3', 'S'"),
    driver: str = Query(None, description="Filter for a specific driver abbreviation (e.g. 'VER', 'HAM', 'LEC')")
):
    try:
        s = fastf1.get_session(year, event, session)
        s.load(laps=True, telemetry=False, weather=False, messages=False)
        
        laps = s.laps
        if driver:
            laps = laps.pick_driver(driver)
            
        laps_list = []
        if laps is not None and not laps.empty:
            laps_list = df_to_dict_list(laps)
            
        return {
            "success": True,
            "year": year,
            "event": event,
            "session": session,
            "session_name": s.name,
            "driver_filter": driver,
            "count": len(laps_list),
            "laps": laps_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch laps: {str(e)}")

@app.get("/api/telemetry")
def get_telemetry(
    year: int = Query(..., description="Year of the season (e.g. 2024)"),
    event: str = Query(..., description="Grand Prix name or Round number"),
    session: str = Query(..., description="Session type: 'R', 'Q', 'FP1', 'FP2', 'FP3', 'S'"),
    driver: str = Query(..., description="Driver abbreviation (e.g. 'VER', 'HAM', 'LEC')")
):
    try:
        s = fastf1.get_session(year, event, session)
        s.load(laps=True, telemetry=True, weather=False, messages=False)
        
        driver_laps = s.laps.pick_driver(driver)
        if driver_laps.empty:
            raise HTTPException(status_code=404, detail=f"No laps found for driver {driver} in this session.")
            
        fastest_lap = driver_laps.pick_fastest()
        if pd.isnull(fastest_lap['LapTime']):
            raise HTTPException(status_code=404, detail=f"No valid lap time for driver {driver}'s fastest lap.")
            
        # Get car telemetry data and add distance column (vital for plots)
        car_data = fastest_lap.get_car_data().add_distance()
        
        telemetry_list = []
        if car_data is not None and not car_data.empty:
            telemetry_list = df_to_dict_list(car_data)
            
        return {
            "success": True,
            "year": year,
            "event": event,
            "session": session,
            "session_name": s.name,
            "driver": driver,
            "fastest_lap_time": clean_value(fastest_lap['LapTime']),
            "fastest_lap_number": int(fastest_lap['LapNumber']) if not pd.isnull(fastest_lap['LapNumber']) else None,
            "telemetry_count": len(telemetry_list),
            "telemetry": telemetry_list
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch telemetry: {str(e)}")
