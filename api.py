
from pathlib import Path

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# --------------------------------------------------
# Project paths
# --------------------------------------------------

PROJECT_DIR = Path(__file__).resolve().parent

DATASET_PATH = (
    PROJECT_DIR / "data" / "processed" / "expanded_model_dataset.csv"
)
CALENDAR_PATH = PROJECT_DIR / "data" / "raw" / "race_calendar.csv"
QUALIFYING_PATH = (
    PROJECT_DIR / "data" / "raw" / "qualifying_results_partial.csv"
)
CALIBRATION_PATH = (
    PROJECT_DIR / "reports" / "race_level_probabilities_2025_normalized.csv"
)
MODELS_DIR = PROJECT_DIR / "models"

BASELINE_FEATURES = ["starting_position_feature"]

HISTORY_FEATURES = [
    "starting_position_feature",
    "driver_prior_mean_finish",
    "driver_prior_win_rate",
    "driver_recent5_mean_finish",
    "constructor_prior_mean_finish",
    "constructor_prior_win_rate",
]

# Fallbacks calculated from the existing training dataset.
DRIVER_FALLBACKS = {
    "driver_prior_mean_finish": 10.825,
    "driver_prior_win_rate": 0.0,
    "driver_recent5_mean_finish": 11.0,
}

CONSTRUCTOR_FALLBACKS = {
    "constructor_prior_mean_finish": 11.2083,
    "constructor_prior_win_rate": 0.0,
}

GRID_FALLBACK = 10.0

# --------------------------------------------------
# Load files and models
# --------------------------------------------------

for path in [DATASET_PATH, CALENDAR_PATH, QUALIFYING_PATH]:
    if not path.exists():
        raise FileNotFoundError(f"Required file not found: {path}")

df = pd.read_csv(DATASET_PATH)
calendar = pd.read_csv(CALENDAR_PATH)
qualifying = pd.read_csv(QUALIFYING_PATH)

df["season"] = pd.to_numeric(df["season"], errors="coerce")
df["round"] = pd.to_numeric(df["round"], errors="coerce")
df["position_num"] = pd.to_numeric(df["position_num"], errors="coerce")
df["won_race"] = pd.to_numeric(df["won_race"], errors="coerce")

calendar["season"] = pd.to_numeric(calendar["season"], errors="coerce")
calendar["round"] = pd.to_numeric(calendar["round"], errors="coerce")
calendar["race_date"] = pd.to_datetime(
    calendar["race_date"], errors="coerce"
)

qualifying["season"] = pd.to_numeric(
    qualifying["season"], errors="coerce"
)
qualifying["round"] = pd.to_numeric(
    qualifying["round"], errors="coerce"
)
qualifying["race_date"] = pd.to_datetime(
    qualifying["race_date"], errors="coerce"
)
qualifying["qualifying_position"] = pd.to_numeric(
    qualifying["qualifying_position"], errors="coerce"
)

# Normalize IDs for reliable joins.
for frame in [df, qualifying]:
    for column in ["driver_id", "constructor_id"]:
        if column in frame.columns:
            frame[column] = (
                frame[column].fillna("").astype(str).str.strip().str.casefold()
            )

baseline_model = joblib.load(MODELS_DIR / "baseline_model.joblib")
logistic_model = joblib.load(
    MODELS_DIR / "logistic_regression_model.joblib"
)
random_forest_model = joblib.load(
    MODELS_DIR / "random_forest_model.joblib"
)

MODELS = {
    "baseline": (baseline_model, BASELINE_FEATURES),
    "logistic": (logistic_model, HISTORY_FEATURES),
    "random_forest": (random_forest_model, HISTORY_FEATURES),
}

app = FastAPI(
    title="F1 Prediction API",
    description=(
        "Historical F1 predictions and upcoming-race forecasts "
        "using saved machine-learning models."
    ),
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://apex-f1-prediction-platform-nm3v-pied.vercel.app/",
    ],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# --------------------------------------------------
# General helpers
# --------------------------------------------------

def normalize_name(value):
    return str(value).strip().casefold()


def get_model(model_name):
    if model_name not in MODELS:
        raise HTTPException(
            status_code=400,
            detail="Model must be baseline, logistic, or random_forest.",
        )
    return MODELS[model_name]


def normalized_scores(estimator, feature_frame):
    scores = estimator.predict_proba(feature_frame)[:, 1]
    total = float(scores.sum())

    if total <= 0:
        raise HTTPException(
            status_code=500,
            detail="The model returned scores that cannot be normalized.",
        )

    return scores / total * 100



def get_historical_features():
    """
    Use the latest precomputed prior-performance features for each
    driver and constructor. These match the feature definitions used
    by the training dataset better than recalculating full-career means.
    """

    history = df.dropna(subset=["season", "round"]).copy()
    history = history.sort_values(["season", "round"])

    driver_features = {}
    driver_rows = history.drop_duplicates("driver_id", keep="last")

    for _, row in driver_rows.iterrows():
        driver_features[row["driver_id"]] = {
            "driver_prior_mean_finish": row["driver_prior_mean_finish"],
            "driver_prior_win_rate": row["driver_prior_win_rate"],
            "driver_recent5_mean_finish": row["driver_recent5_mean_finish"],
        }

    constructor_features = {}
    constructor_rows = history.drop_duplicates(
        "constructor_id", keep="last"
    )

    for _, row in constructor_rows.iterrows():
        constructor_features[row["constructor_id"]] = {
            "constructor_prior_mean_finish": row[
                "constructor_prior_mean_finish"
            ],
            "constructor_prior_win_rate": row[
                "constructor_prior_win_rate"
            ],
        }

    return driver_features, constructor_features



DRIVER_HISTORY, CONSTRUCTOR_HISTORY = get_historical_features()


def choose_upcoming_race():
    """Return the next race whose calendar date has not passed."""

    today = pd.Timestamp.now().normalize()

    future = calendar[
        calendar["race_date"].notna()
        & (calendar["race_date"] >= today)
    ].copy()

    if future.empty:
        raise HTTPException(
            status_code=404,
            detail="No upcoming races found in race_calendar.csv.",
        )

    return future.sort_values(["race_date", "season", "round"]).iloc[0]


def get_current_lineup(target_race):
    """
    Use target-race qualifying if available.
    Otherwise use the most recent qualifying event before the target race
    to identify the driver lineup only.
    """

    target_rows = qualifying[
        (qualifying["season"] == target_race["season"])
        & (qualifying["round"] == target_race["round"])
    ].copy()

    target_rows = target_rows[
        target_rows["driver_id"].ne("")
    ]

    if not target_rows.empty:
        return target_rows, True

    previous = qualifying[
        qualifying["race_date"].notna()
        & (qualifying["race_date"] < target_race["race_date"])
        & qualifying["driver_id"].ne("")
    ].copy()

    # Prefer the target season when it has previous qualifying data.
    same_season = previous[
        previous["season"] == target_race["season"]
    ]
    if not same_season.empty:
        previous = same_season

    if previous.empty:
        raise HTTPException(
            status_code=404,
            detail="No qualifying data is available to identify the driver lineup.",
        )

    latest_event = (
        previous.sort_values(["race_date", "round"])
        .iloc[-1]
    )

    lineup = previous[
        (previous["season"] == latest_event["season"])
        & (previous["round"] == latest_event["round"])
    ].copy()

    return lineup, False


def build_upcoming_features(lineup, target_qualifying_available):
    """Create one model-input row per current driver."""

    rows = []

    for _, driver in lineup.iterrows():
        driver_id = driver["driver_id"]
        constructor_id = driver["constructor_id"]

        driver_stats = DRIVER_HISTORY.get(driver_id, {})
        constructor_stats = CONSTRUCTOR_HISTORY.get(constructor_id, {})

        qualifying_position = driver.get("qualifying_position")
        has_target_position = (
            target_qualifying_available
            and pd.notna(qualifying_position)
            and qualifying_position > 0
        )

        if has_target_position:
            starting_position = float(qualifying_position)
            grid_source = "target_race_qualifying_position"
        else:
            starting_position = GRID_FALLBACK
            grid_source = "training_median_fallback"

        rows.append({
            "driver_id": driver_id,
            "driver_name": driver.get("driver_name", driver_id),
            "driver_code": driver.get("driver_code", ""),
            "constructor_id": constructor_id,
            "constructor_name": driver.get("constructor_name", "Unknown"),
            "starting_position_feature": starting_position,
            "driver_prior_mean_finish": driver_stats.get(
                "driver_prior_mean_finish",
                DRIVER_FALLBACKS["driver_prior_mean_finish"],
            ),
            "driver_prior_win_rate": driver_stats.get(
                "driver_prior_win_rate",
                DRIVER_FALLBACKS["driver_prior_win_rate"],
            ),
            "driver_recent5_mean_finish": driver_stats.get(
                "driver_recent5_mean_finish",
                DRIVER_FALLBACKS["driver_recent5_mean_finish"],
            ),
            "constructor_prior_mean_finish": constructor_stats.get(
                "constructor_prior_mean_finish",
                CONSTRUCTOR_FALLBACKS["constructor_prior_mean_finish"],
            ),
            "constructor_prior_win_rate": constructor_stats.get(
                "constructor_prior_win_rate",
                CONSTRUCTOR_FALLBACKS["constructor_prior_win_rate"],
            ),
            "starting_position_source": grid_source,
        })

    result = pd.DataFrame(rows)

    if result.empty:
        raise HTTPException(
            status_code=404,
            detail="Could not build a driver lineup for the upcoming race.",
        )

    return result


# --------------------------------------------------
# API endpoints
# --------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "F1 Prediction API is running",
        "docs": "/docs",
        "available_models": list(MODELS.keys()),
        "upcoming_endpoint": "/upcoming",
    }


@app.get("/seasons")
def get_seasons():
    seasons = sorted(
        int(season)
        for season in df["season"].dropna().unique()
    )
    return {"seasons": seasons}


@app.get("/races/{season}")
def get_races(season: int):
    season_data = df[df["season"] == season]

    if season_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No historical races found for season {season}.",
        )

    races = (
        season_data[["round", "race_name", "race_date"]]
        .drop_duplicates()
        .sort_values("round")
    )

    return {
        "season": season,
        "races": races.fillna("").to_dict(orient="records"),
    }


@app.get("/predict/{season}/{race_name}")
def predict_race(
    season: int,
    race_name: str,
    model: str = Query(
        default="logistic",
        description="Choose baseline, logistic, or random_forest.",
    ),
):
    estimator, features = get_model(model)

    race_data = df[
        (df["season"] == season)
        & (
            df["race_name"].fillna("").map(normalize_name)
            == normalize_name(race_name)
        )
    ].copy()

    if race_data.empty:
        raise HTTPException(
            status_code=404,
            detail=f"Historical race '{race_name}' not found in season {season}.",
        )

    scores = normalized_scores(estimator, race_data[features])
    race_data["win_probability_pct"] = scores.round(2)
    race_data = race_data.sort_values(
        "win_probability_pct", ascending=False
    )

    drivers = []
    for rank, (_, row) in enumerate(race_data.iterrows(), start=1):
        drivers.append({
            "rank": rank,
            "driver": row["driver_name"],
            "driver_code": row["driver_code"],
            "constructor": row["constructor_name"],
            "win_probability_pct": float(row["win_probability_pct"]),
            "actual_winner": int(row["won_race"]),
            "actual_position": (
                int(row["position_num"])
                if pd.notna(row["position_num"])
                else None
            ),
        })

    return {
        "season": season,
        "race": race_name,
        "model": model,
        "probability_note": (
            "Scores are normalized within this race. "
            "They are not calibrated win probabilities."
        ),
        "drivers": drivers,
    }


@app.get("/calibration")
def get_probability_calibration(
    model: str = Query(
        default="logistic",
        description="Choose baseline, logistic, or random_forest.",
    ),
):
    probability_columns = {
        "baseline": "baseline_normalized_probability",
        "logistic": "logistic_normalized_probability",
        "random_forest": "rf_normalized_probability",
    }
    if model not in probability_columns:
        raise HTTPException(
            status_code=400,
            detail="Model must be baseline, logistic, or random_forest.",
        )
    if not CALIBRATION_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Probability calibration data is not available.",
        )

    calibration = pd.read_csv(CALIBRATION_PATH)
    probability_column = probability_columns[model]
    required_columns = {probability_column, "won_race", "season", "round"}
    if not required_columns.issubset(calibration.columns):
        raise HTTPException(
            status_code=500,
            detail="Probability calibration data is missing required columns.",
        )

    calibration = calibration[[probability_column, "won_race", "season", "round"]]
    calibration[probability_column] = pd.to_numeric(
        calibration[probability_column], errors="coerce"
    )
    calibration["won_race"] = pd.to_numeric(
        calibration["won_race"], errors="coerce"
    )
    calibration = calibration.dropna()
    calibration = calibration[
        calibration[probability_column].between(0, 1)
        & calibration["won_race"].isin([0, 1])
    ]
    if calibration.empty:
        raise HTTPException(
            status_code=500,
            detail="Probability calibration data contains no valid samples.",
        )

    bins = pd.qcut(
        calibration[probability_column],
        q=10,
        duplicates="drop",
    )
    grouped = calibration.groupby(bins, observed=True, sort=True)
    points = [
        {
            "predicted_probability_pct": float(
                group[probability_column].mean() * 100
            ),
            "observed_win_rate_pct": float(group["won_race"].mean() * 100),
            "sample_size": int(len(group)),
        }
        for _, group in grouped
    ]
    race_brier_scores = (
        calibration.assign(
            squared_error=(
                calibration[probability_column] - calibration["won_race"]
            ) ** 2
        )
        .groupby(["season", "round"])["squared_error"]
        .sum()
    )

    return {
        "model": model,
        "season": int(calibration["season"].max()),
        "race_count": int(
            calibration[["season", "round"]].drop_duplicates().shape[0]
        ),
        "brier_score": float(race_brier_scores.mean()),
        "points": points,
    }


@app.get("/upcoming")
def predict_upcoming(
    model: str = Query(
        default="logistic",
        description="Choose baseline, logistic, or random_forest.",
    ),
):
    estimator, features = get_model(model)
    target_race = choose_upcoming_race()

    lineup, target_qualifying_available = get_current_lineup(target_race)

    prediction_data = build_upcoming_features(
        lineup,
        target_qualifying_available,
    )

    # Keep the exact feature order expected by the saved model.
    feature_frame = prediction_data[features].copy()
    scores = normalized_scores(estimator, feature_frame)

    prediction_data["win_probability_pct"] = scores.round(2)
    prediction_data = prediction_data.sort_values(
        "win_probability_pct", ascending=False
    )

    all_target_positions_available = (
        target_qualifying_available
        and prediction_data["starting_position_source"]
        .eq("target_race_qualifying_position")
        .all()
    )

    if all_target_positions_available:
        forecast_stage = "qualifying_informed"
        grid_note = (
            "Uses qualifying positions recorded for this target race. "
            "Qualifying position is a proxy for starting grid and may differ "
            "from the final grid if penalties apply."
        )
    elif target_qualifying_available:
        forecast_stage = "qualifying_partial"
        grid_note = (
            "Some target-race qualifying positions are missing. "
            "Missing positions use the training median of 10."
        )
    else:
        forecast_stage = "pre_qualifying"
        grid_note = (
            "Target-race qualifying is not present in the local CSV. "
            "All drivers use the training median starting position of 10. "
            "Previous-round qualifying positions are not reused as this "
            "race's starting positions."
        )

    drivers = []
    for rank, (_, row) in enumerate(prediction_data.iterrows(), start=1):
        drivers.append({
            "rank": rank,
            "driver": row["driver_name"],
            "driver_code": row["driver_code"],
            "constructor": row["constructor_name"],
            "win_probability_pct": float(row["win_probability_pct"]),
            "starting_position_used": float(
                row["starting_position_feature"]
            ),
            "starting_position_source": row["starting_position_source"],
        })

    return {
        "season": int(target_race["season"]),
        "round": int(target_race["round"]),
        "race": target_race["race_name"],
        "race_date": target_race["race_date"].strftime("%Y-%m-%d"),
        "circuit": target_race.get("circuit_name", ""),
        "city": target_race.get("city", ""),
        "country": target_race.get("country", ""),
        "model": model,
        "forecast_stage": forecast_stage,
        "grid_note": grid_note,
        "probability_note": (
            "Scores are normalized within this driver lineup. "
            "They are not calibrated win probabilities. "
            "Historical features come from data through 2025."
        ),
        "drivers": drivers,
    }
