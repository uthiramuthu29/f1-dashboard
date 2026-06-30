import pandas as pd
import numpy as np

def format_lap_time(seconds: float) -> str:
    """Formats a duration in seconds to standard F1 lap time format (M:SS.mmm)."""
    if seconds is None:
        return ""
    minutes = int(seconds // 60)
    rem_seconds = seconds % 60
    if minutes > 0:
        return f"{minutes}:{rem_seconds:06.3f}"[:-3] # Remove extra precision digits if float precision is high
    else:
        return f"{rem_seconds:.3f}"

def clean_value(v):
    """Recursively converts pandas/numpy types to JSON-serializable Python types."""
    if isinstance(v, dict):
        return {k: clean_value(val) for k, val in v.items()}
    if isinstance(v, (list, np.ndarray, set)):
        return [clean_value(val) for val in v]
    if pd.isnull(v):
        return None
    if isinstance(v, pd.Timedelta):
        return v.total_seconds()
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    if isinstance(v, (np.integer, np.int64, np.int32, np.int16, np.int8)):
        return int(v)
    if isinstance(v, (np.floating, np.float64, np.float32)):
        # Round floats to 6 decimal places to avoid floating point precision noise in JSON
        val = float(v)
        return round(val, 6)
    if isinstance(v, (np.bool_, bool)):
        return bool(v)
    return v

def df_to_dict_list(df: pd.DataFrame) -> list:
    """Converts a pandas DataFrame into a clean, JSON-serializable list of dicts."""
    records = df.to_dict(orient='records')
    return [clean_value(record) for record in records]
