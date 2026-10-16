
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Activity,
  ChevronDown,
  Gauge,
  History,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Search,
  Settings2,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartEmptyState,
  chartAxisTick,
  chartColors,
  chartTooltipStyle,
} from "./chart-theme";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type Race = {
  round: number;
  race_name: string;
  race_date: string;
};

type Driver = {
  rank: number;
  driver: string;
  driver_code?: string;
  constructor: string;
  win_probability_pct: number;
  actual_winner: number;
  actual_position: number | null;
};

type PredictionResponse = {
  season: number;
  race: string;
  model: string;
  probability_note: string;
  drivers: Driver[];
};


type UpcomingDriver = {
  rank: number;
  driver: string;
  driver_code?: string;
  constructor: string;
  win_probability_pct: number;
  starting_position_used: number;
  starting_position_source: string;
};

type UpcomingPredictionResponse = {
  season: number;
  round: number;
  race: string;
  race_date: string;
  circuit: string;
  city: string;
  country: string;
  model: string;
  forecast_stage:
    | "pre_qualifying"
    | "qualifying_partial"
    | "qualifying_informed";
  grid_note: string;
  probability_note: string;
  drivers: UpcomingDriver[];
};


const models = [
  { value: "logistic", label: "Logistic Regression" },
  { value: "random_forest", label: "Random Forest" },
  { value: "baseline", label: "Grid Baseline" },
];

const teamColors: Record<string, string> = {
  Ferrari: "#E10600",
  McLaren: "#B80000",
  Mercedes: "#D0D0D0",
  "Red Bull": "#8E0000",
  Williams: "#A6A6A6",
  Alpine: "#777777",
  Aston: "#C2C2C2",
  Haas: "#929292",
  Sauber: "#B0B0B0",
  Racing: "#686868",
};

function teamColor(team: string) {
  const key = Object.keys(teamColors).find((name) =>
    team.toLowerCase().includes(name.toLowerCase())
  );
  return key ? teamColors[key] : "#E10600";
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric-card">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <span className="metric-detail">{detail}</span>
    </div>
  );
}

export default function Home() {
  const [seasons, setSeasons] = useState<number[]>([]);
  const [season, setSeason] = useState(2025);
  const [races, setRaces] = useState<Race[]>([]);
  const [raceName, setRaceName] = useState("");
  const [model, setModel] = useState("logistic");
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [upcomingPrediction, setUpcomingPrediction] =
  useState<UpcomingPredictionResponse | null>(null);
const [upcomingLoading, setUpcomingLoading] = useState(true);
const [upcomingError, setUpcomingError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeTab, setActiveTab] = useState("Overview");

  useEffect(() => {
    fetch(`${API}/seasons`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load seasons.");
        return response.json();
      })
      .then((data) => {
        const available: number[] = data.seasons ?? [];
        setSeasons(available);
        if (available.length) {
          setSeason(available.includes(2025) ? 2025 : Math.max(...available));
        }
      })
      .catch(() =>
        setError("Cannot connect to the API. Make sure FastAPI is running on port 8000.")
      );
  }, []);

  useEffect(() => {
    if (!seasons.includes(season)) return;

    let cancelled = false;
    setRaces([]);
    setRaceName("");
    setPrediction(null);
    setError("");

    fetch(`${API}/races/${season}`)
      .then((response) => {
        if (!response.ok) throw new Error("Could not load races.");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        const available: Race[] = data.races ?? [];
        setRaces(available);
        if (available.length) {
          const lastRace = available[available.length - 1];
          setRaceName(lastRace.race_name);
        } else {
          setError("No races are available for this season.");
        }
      })
      .catch(() => {
        if (!cancelled) setError(`Could not load races for ${season}.`);
      });

    return () => {
      cancelled = true;
    };
  }, [season, seasons]);

  useEffect(() => {
    if (!raceName) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setPrediction(null);

    const url = `${API}/predict/${season}/${encodeURIComponent(raceName)}?model=${model}`;

    fetch(url)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Prediction request failed.");
        }
        return data as PredictionResponse;
      })
      .then((data) => {
        if (!cancelled) setPrediction(data);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [season, raceName, model]);

  useEffect(() => {
  let cancelled = false;

  async function loadUpcomingPrediction() {
    setUpcomingLoading(true);
    setUpcomingError("");

    try {
      const response = await fetch(
        `${API}/upcoming?model=${encodeURIComponent(model)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not load the upcoming race forecast."
        );
      }

      if (!cancelled) {
        setUpcomingPrediction(data as UpcomingPredictionResponse);
      }
    } catch (reason) {
      if (!cancelled) {
        setUpcomingError(
          reason instanceof Error
            ? reason.message
            : "Could not connect to the prediction API."
        );
      }
    } finally {
      if (!cancelled) {
        setUpcomingLoading(false);
      }
    }
  }

  loadUpcomingPrediction();

  return () => {
    cancelled = true;
  };
}, [model]);

  const visibleDrivers = useMemo(() => {
    const drivers = prediction?.drivers ?? [];
    const query = search.trim().toLowerCase();
    return drivers.filter(
      (driver) =>
        driver.driver.toLowerCase().includes(query) ||
        driver.constructor.toLowerCase().includes(query)
    );
  }, [prediction, search]);

  const leader = prediction?.drivers?.[0];
  const topThree = prediction?.drivers?.slice(0, 3) ?? [];
  const upcomingScoredDrivers = upcomingPrediction?.drivers.filter(
    (driver) => Number.isFinite(driver.win_probability_pct)
  ) ?? [];
  const upcomingGridDrivers = upcomingPrediction?.drivers.filter(
    (driver) =>
      driver.starting_position_source === "target_race_qualifying_position" &&
      Number.isFinite(driver.starting_position_used) &&
      driver.starting_position_used > 0 &&
      Number.isFinite(driver.win_probability_pct)
  ) ?? [];
  const historicalDrivers = prediction?.drivers.flatMap((driver) =>
    driver.actual_position === null
      ? []
      : [{
          ...driver,
          predicted_position: driver.rank,
          actual_position: driver.actual_position,
        }]
  ) ?? [];
  const maxFinishPosition = Math.max(
    1,
    ...historicalDrivers.map((driver) => driver.actual_position)
  );
  const isUpcomingCota = /circuit of the americas|austin/i.test(
    upcomingPrediction?.circuit ?? ""
  );
  const probabilityTotal = prediction?.drivers.reduce(
    (sum, driver) => sum + driver.win_probability_pct,
    0
  ) ?? 0;

  
const navItems = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Predictions", icon: Trophy },
  { name: "Model analysis", icon: Activity },
  { name: "Historical results", icon: History },
  { name: "Model comparison", icon: Gauge },
];


  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg className="brand-symbol" viewBox="0 0 64 48" focusable="false">
              <path
                d="M4 44 22.5 3l8.1 15.8L58 10 34 27.4 4 44Zm14.7-12.1 8.5-4.3-4.5-8.8-4 13.1Z"
                fill="#f6f4e8"
                fillRule="evenodd"
              />
              <path d="m32.5 39.3 7.8-4.1 3.1 4.1H32.5Z" fill="#f6f4e8" />
            </svg>
          </div>
          <div>
            <div className="brand-title">APEX<span>F1</span></div>
            <div className="brand-subtitle">RACE INTELLIGENCE</div>
          </div>
          <button className="icon-button mobile-close" onClick={() => setMobileMenu(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              
onClick={() => {
  setMobileMenu(false);

  if (name === "Model comparison") {
    window.location.href = "/comparison";
    return;
  }

  setActiveTab(name);

  document.getElementById(
    name === "Predictions"
      ? "predictions"
      : name === "Model analysis"
      ? "analysis"
      : name === "Historical results"
      ? "historical"
      : "overview"
  )?.scrollIntoView({ behavior: "smooth" });
}}

              className={`nav-item ${activeTab === name ? "nav-active" : ""}`}
            >
              <Icon size={18} />
              <span>{name}</span>
              {activeTab === name && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="status-card">
            <span className="status-dot" />
            <div>
              <strong>Prediction engine</strong>
              <span>Connected when API responds</span>
            </div>
          </div>
          <div className="sidebar-footer">INDEPENDENT F1 ANALYTICS<br />NOT AFFILIATED WITH FORMULA 1</div>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-backdrop" onClick={() => setMobileMenu(false)} aria-label="Close navigation" />}

      <section className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu">
            <Menu size={21} />
          </button>
          <div className="breadcrumb">WORKSPACE <span>/</span> <strong>{activeTab.toUpperCase()}</strong></div>
          <div className="topbar-right">
            <span className="environment"><span className="status-dot" /> LOCAL ENVIRONMENT</span>
            <div className="avatar">F1</div>
          </div>
        </header>

        <div className="page-container">
          <section className="page-heading" id="overview">
            <div>
              <div className="section-kicker"><span /> MOTORSPORT ANALYTICS PLATFORM</div>
              <h1>Race <span>intelligence.</span></h1>
              <p>Explore model-driven winner projections, driver rankings, and historical race data.</p>
            </div>
            <button
              className="refresh-button"
              onClick={() => {
                if (raceName) {
                  setPrediction(null);
                  setError("");
                  setModel((current) => current);
                }
              }}
            >
              <RefreshCw size={15} /> REFRESH VIEW
            </button>
          </section>
          <section className="upcoming-panel" id="upcoming">
  <div className="upcoming-heading">
    <div className="upcoming-copy">
      <div className="section-kicker">
        <span /> NEXT GRAND PRIX
      </div>
      <h2>
        {upcomingLoading
          ? "Loading upcoming race..."
          : upcomingPrediction?.race ?? "Upcoming race"}
      </h2>
      {upcomingPrediction && (
        <p>
          ROUND {String(upcomingPrediction.round).padStart(2, "0")}
          {" · "}
          {new Date(
            `${upcomingPrediction.race_date}T12:00:00`
          ).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {" · "}
          {[upcomingPrediction.city, upcomingPrediction.country]
            .filter(Boolean)
            .join(", ")}
        </p>
      )}

      <div className="upcoming-status">
        {upcomingLoading
          ? "LOADING FORECAST"
          : upcomingPrediction?.forecast_stage === "qualifying_informed"
            ? "QUALIFYING AVAILABLE"
            : upcomingPrediction?.forecast_stage === "qualifying_partial"
              ? "PARTIAL QUALIFYING"
              : upcomingPrediction
                ? "PRE-QUALIFYING FORECAST"
                : "FORECAST UNAVAILABLE"}
      </div>
    </div>

    {upcomingPrediction && (
      <div className="upcoming-track-card">
        <div className="upcoming-track-heading">
          <div>
            <span className="eyebrow">UPCOMING RACE WEEKEND</span>
            <h3>Track layout</h3>
          </div>
          <span className="upcoming-track-circuit">
            {upcomingPrediction.circuit || "CIRCUIT"}
          </span>
        </div>
        <div className="upcoming-track-visual">
          {isUpcomingCota ? (
            <Image
              className="upcoming-track-map"
              src="/tracks/austin-circuit.svg"
              alt="Circuit of the Americas track map"
              width={2300}
              height={2300}
            />
          ) : (
            <div className="upcoming-track-unavailable">
              A verified track map is not available for this circuit yet.
            </div>
          )}
        </div>
        <div className="upcoming-track-meta">
          <strong>{upcomingPrediction.circuit}</strong>
          <span>
            {upcomingPrediction.city}
            {upcomingPrediction.country
              ? `, ${upcomingPrediction.country}`
              : ""}
          </span>
          <span>{upcomingPrediction.race_date}</span>
        </div>
        {isUpcomingCota && (
          <div className="upcoming-track-credit">
            Track map by Gustavo Girardelli · Wikimedia Commons · CC BY-SA 2.0 ·
            recolored for the dark UI
          </div>
        )}
      </div>
    )}
  </div>

  {upcomingError && (
    <div className="error-banner">
      <Activity size={18} />
      <div>
        <strong>Upcoming forecast unavailable</strong>
        <span>{upcomingError}</span>
      </div>
    </div>
  )}

  {upcomingLoading && (
    <div className="upcoming-loading">
      <div className="loader" />
      <span>CALCULATING THE NEXT RACE FORECAST...</span>
    </div>
  )}

  {!upcomingLoading && upcomingPrediction && (
    <>
      {upcomingPrediction.drivers.length === 0 ? (
        <ChartEmptyState
          title="Upcoming lineup unavailable"
          message="The API returned no drivers for this race, so forecast charts cannot be shown."
        />
      ) : (
      <>
      <div className="upcoming-summary">
        <div className="upcoming-leader">
          <span className="eyebrow">CURRENT MODEL LEADER</span>
          <h3>
            {upcomingPrediction.drivers[0]?.driver ??
              "No prediction available"}
          </h3>
          <p>
            {upcomingPrediction.drivers[0]?.constructor ?? ""}
          </p>
          <strong>
            {upcomingPrediction.drivers[0]
              ? `${upcomingPrediction.drivers[0].win_probability_pct.toFixed(2)}%`
              : "—"}
          </strong>
          <span className="upcoming-score-label">
            NORMALIZED MODEL SCORE
          </span>
        </div>

        <div className="upcoming-contenders">
          <div className="upcoming-contenders-heading">
            <h3>Leading contenders</h3>
            <span>
              {models.find((item) => item.value === model)?.label ?? model}
            </span>
          </div>

          {upcomingPrediction.drivers.slice(0, 5).map((driver) => (
            <div className="upcoming-driver-row" key={driver.driver}>
              <span className="upcoming-rank">
                {String(driver.rank).padStart(2, "0")}
              </span>
              <span className="upcoming-driver-name">
                <strong>{driver.driver}</strong>
                <small>{driver.constructor}</small>
                <span
                  className="upcoming-driver-scorebar"
                  aria-label={`${driver.win_probability_pct.toFixed(2)} percent normalized win score`}
                >
                  <span
                    style={{
                      width: `${Math.min(driver.win_probability_pct, 100)}%`,
                    }}
                  />
                </span>
              </span>
              <strong className="upcoming-driver-score">
                {driver.win_probability_pct.toFixed(2)}%
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="upcoming-chart-grid">
        <article className="dashboard-chart dashboard-chart-wide">
          <div className="dashboard-chart-heading">
            <div>
              <span className="eyebrow">FULL GRID · {upcomingPrediction.drivers.length} DRIVERS</span>
              <h3>Win score distribution</h3>
              <p>All entrants, ranked highest to lowest · scores sum to 100%</p>
            </div>
            <span className="chart-unit">SCORE %</span>
          </div>
          <div className="dashboard-chart-plot dashboard-chart-grid-plot">
            {upcomingScoredDrivers.length ? (
            <ResponsiveContainer width="100%" height={Math.max(300, upcomingScoredDrivers.length * 25)}>
              <BarChart
                data={upcomingScoredDrivers.map((driver) => ({
                  ...driver,
                  chart_label: driver.driver,
                }))}
                layout="vertical"
                margin={{ top: 4, right: 22, left: 4, bottom: 4 }}
              >
                <CartesianGrid stroke={chartColors.grid} horizontal={false} />
                <XAxis
                  type="number"
                  tick={chartAxisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                />
                <YAxis
                  type="category"
                  dataKey="chart_label"
                  tick={{ ...chartAxisTick, fill: chartColors.text }}
                  axisLine={false}
                  tickLine={false}
                  width={126}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, "Win score"]}
                  labelFormatter={(_, entries) => {
                    const driver = entries[0]?.payload;
                    return driver
                      ? `${driver.driver} · ${driver.constructor}`
                      : "";
                  }}
                />
                <Bar dataKey="win_probability_pct" radius={[0, 4, 4, 0]} barSize={14}>
                  {upcomingScoredDrivers.map((driver, index) => (
                    <Cell
                      key={driver.driver}
                      fill={index === 0 ? chartColors.accent : chartColors.secondary}
                    />
                  ))}
                  <LabelList
                    dataKey="win_probability_pct"
                    position="right"
                    fill={chartColors.text}
                    fontSize={9}
                    formatter={(value: number | string) =>
                      `${Number(value).toFixed(2)}%`
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            ) : (
              <ChartEmptyState
                title="Win scores unavailable"
                message="No valid model scores were returned for the upcoming lineup."
              />
            )}
          </div>
        </article>

        <article className="dashboard-chart">
          <div className="dashboard-chart-heading">
            <div>
              <span className="eyebrow">GRID POSITION × MODEL SCORE</span>
              <h3>Starting grid vs. win score</h3>
              <p>Each point represents one driver</p>
            </div>
          </div>
          {upcomingGridDrivers.length ? (
          <div className="dashboard-chart-plot">
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 12, right: 18, left: 4, bottom: 8 }}>
                <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="starting_position_used"
                  name="Grid position"
                  domain={[1, "dataMax"]}
                  tick={chartAxisTick}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: "STARTING GRID", position: "insideBottom", offset: -4, fill: chartColors.tick, fontSize: 9 }}
                />
                <YAxis
                  type="number"
                  dataKey="win_probability_pct"
                  name="Win score"
                  tick={chartAxisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={chartTooltipStyle}
                  formatter={(value, name) => [
                    name === "Grid position"
                      ? `P${Number(value)}`
                      : `${Number(value).toFixed(2)}%`,
                    name,
                  ]}
                  labelFormatter={(_, entries) => entries[0]?.payload.driver ?? ""}
                />
                <Scatter data={upcomingGridDrivers} fill={chartColors.accent} name="Drivers" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          ) : (
            <ChartEmptyState
              title="Starting grid not published yet"
              message="The current forecast uses a training fallback rather than qualifying positions. This chart will appear when real grid data is available."
            />
          )}
          {upcomingGridDrivers.length > 0 && (
            <p className="dashboard-chart-note">{upcomingPrediction.grid_note}</p>
          )}
        </article>

        <article className="dashboard-chart">
          <div className="dashboard-chart-heading">
            <div>
              <span className="eyebrow">FORECAST HISTORY</span>
              <h3>Prediction snapshots</h3>
              <p>Weekend-to-weekend changes will appear when forecasts are saved</p>
            </div>
          </div>
          <ChartEmptyState
            title="No timestamped snapshots yet"
            message="Only the latest forecast is available. Prediction history will be charted after real dated forecasts are stored."
          />
        </article>
      </div>

      <div className="upcoming-notes">
        <div>
          <strong>Forecast stage</strong>
          <p>{upcomingPrediction.grid_note}</p>
        </div>
        <div>
          <strong>How to read the scores</strong>
          <p>{upcomingPrediction.probability_note}</p>
        </div>
      </div>
      </>
      )}
    </>
  )}
</section>

          <section className="filter-panel">
            <div className="filter-heading">
              <Settings2 size={16} />
              <span>RACE CONFIGURATION</span>
              <span className="filter-divider" />
              <span className="filter-hint">Select a historical event</span>
            </div>
            <div className="filter-controls">
              <label className="select-field">
                <span>SEASON</span>
                <div className="select-wrap">
                  <select value={season} onChange={(e) => setSeason(Number(e.target.value))}>
                    {seasons.map((year) => <option key={year} value={year}>{year} SEASON</option>)}
                  </select>
                  <ChevronDown size={16} />
                </div>
              </label>
              <label className="select-field race-field">
                <span>GRAND PRIX</span>
                <div className="select-wrap">
                  <select value={raceName} onChange={(e) => setRaceName(e.target.value)} disabled={!races.length}>
                    {races.map((race) => <option key={`${race.round}-${race.race_name}`} value={race.race_name}>
                      ROUND {String(race.round).padStart(2, "0")} — {race.race_name.toUpperCase()}
                    </option>)}
                  </select>
                  <ChevronDown size={16} />
                </div>
              </label>
              <label className="select-field model-field">
                <span>PREDICTION MODEL</span>
                <div className="select-wrap">
                  <select value={model} onChange={(e) => setModel(e.target.value)}>
                    {models.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  <ChevronDown size={16} />
                </div>
              </label>
            </div>
          </section>

          {error && (
            <div className="error-banner">
              <Activity size={18} />
              <div><strong>Unable to load prediction</strong><span>{error}</span></div>
            </div>
          )}

          {loading && (
            <div className="loading-panel">
              <div className="loader" />
              <span>RUNNING PREDICTION ENGINE...</span>
            </div>
          )}

          {!loading && prediction && (
            <>
              <section className="hero-grid">
                <div className="winner-card">
                  <div className="winner-watermark">01</div>
                  <div className="winner-topline"><span className="red-line" /> MODEL LEADER <span className="winner-round">ROUND {String(races.find(r => r.race_name === raceName)?.round ?? "-").padStart(2, "0")}</span></div>
                  <div className="winner-label">HIGHEST PREDICTED WIN SCORE</div>
                  <h2>{leader?.driver ?? "Awaiting prediction"}</h2>
                  <div className="winner-team"><span style={{ background: teamColor(leader?.constructor ?? "") }} />{leader?.constructor ?? "—"}</div>
                  <div className="winner-score-row">
                    <strong>{leader?.win_probability_pct.toFixed(2)}<small>%</small></strong>
                    <div className="score-caption"><span>WIN SCORE</span><span>MODEL ESTIMATE</span></div>
                  </div>
                  <div className="winner-progress"><span style={{ width: `${Math.min(leader?.win_probability_pct ?? 0, 100)}%` }} /></div>
                  <div className="winner-footnote">Ranked first by the selected model · {season} historical data</div>
                </div>

                <div className="quick-stats">
                  <Metric label="CLASSIFIED DRIVERS" value={String(prediction.drivers.length).padStart(2, "0")} detail="Entries in this race dataset" />
                  <Metric label="MODEL" value={model === "logistic" ? "LR / 01" : model === "random_forest" ? "RF / 02" : "BASE / 03"} detail={models.find(m => m.value === model)?.label ?? model} />
                  <Metric label="SCORE TOTAL" value={`${probabilityTotal.toFixed(1)}%`} detail="Normalized across this race" />
                </div>
              </section>

              <section className="content-grid" id="predictions">
                <div className="panel leaderboard-panel">
                  <div className="panel-header">
                    <div>
                      <div className="section-kicker"><span /> PREDICTION OUTPUT</div>
                      <h3>Driver leaderboard</h3>
                      <p>Ranked by model-estimated win score</p>
                    </div>
                    <span className="count-pill">{prediction.drivers.length} DRIVERS</span>
                  </div>

                  <div className="search-box">
                    <Search size={16} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search driver or constructor..." />
                  </div>

                  <div className="driver-table-wrap">
                    <table className="driver-table">
                      <thead><tr><th>POS</th><th>DRIVER / CONSTRUCTOR</th><th>WIN SCORE</th><th>SHARE</th></tr></thead>
                      <tbody>
                        {visibleDrivers.map((driver) => (
                          <tr key={`${driver.rank}-${driver.driver}`}>
                            <td><span className={`position ${driver.rank === 1 ? "position-first" : ""}`}>{String(driver.rank).padStart(2, "0")}</span></td>
                            <td>
                              <div className="driver-cell">
                                <span className="team-stripe" style={{ background: teamColor(driver.constructor) }} />
                                <div><strong>{driver.driver}</strong><span>{driver.constructor}</span></div>
                              </div>
                            </td>
                            <td><strong className="probability-value">{driver.win_probability_pct.toFixed(2)}%</strong></td>
                            <td><div className="mini-bar"><span style={{ width: `${Math.min(driver.win_probability_pct, 100)}%`, background: teamColor(driver.constructor) }} /></div></td>
                          </tr>
                        ))}
                        {!visibleDrivers.length && <tr><td colSpan={4} className="empty-state">No matching drivers found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="table-footer">SCORES ARE NORMALIZED WITHIN THE SELECTED RACE</div>
                </div>

                <div className="panel contenders-panel">
                  <div className="panel-header">
                    <div>
                      <div className="section-kicker"><span /> FRONT RUNNERS</div>
                      <h3>Top contenders</h3>
                      <p>Highest-ranked entries</p>
                    </div>
                    <Trophy size={19} className="muted-icon" />
                  </div>
                  <div className="contender-chart">
                    {topThree.length ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={topThree.map((driver) => ({
                          ...driver,
                          chart_label: driver.driver_code || driver.driver,
                        }))}
                        layout="vertical"
                        margin={{ top: 4, right: 18, left: 0, bottom: 4 }}
                      >
                        <CartesianGrid stroke={chartColors.grid} horizontal={false} />
                        <XAxis type="number" tick={chartAxisTick} axisLine={false} tickLine={false} tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
                        <YAxis type="category" dataKey="chart_label" tick={chartAxisTick} axisLine={false} tickLine={false} width={72} />
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)}%`, "Win score"]} labelFormatter={(_, entries) => entries[0]?.payload.driver ?? ""} />
                        <Bar dataKey="win_probability_pct" radius={[0, 0, 0, 0]} barSize={22}>
                          {topThree.map((entry, index) => <Cell key={entry.driver} fill={index === 0 ? chartColors.accent : chartColors.secondary} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    ) : (
                      <ChartEmptyState
                        title="No contender scores"
                        message="The selected race has no model scores to chart."
                      />
                    )}
                  </div>
                  <div className="contender-list">
                    {topThree.map((driver, index) => (
                      <div className="contender-row" key={driver.driver}>
                        <span className={`contender-number ${index === 0 ? "number-red" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
                        <div className="contender-info"><strong>{driver.driver}</strong><span>{driver.constructor}</span></div>
                        <strong className="contender-score">{driver.win_probability_pct.toFixed(2)}%</strong>
                      </div>
                    ))}
                  </div>
                  <div className="method-note"><Zap size={15} /><span>Scores reflect model output, not guaranteed race outcomes.</span></div>
                </div>
              </section>

              <section className="panel analysis-panel" id="analysis">
                <div className="panel-header">
                  <div>
                    <div className="section-kicker"><span /> MODEL INTERPRETATION</div>
                    <h3>Reading this prediction</h3>
                    <p>What the current model output means</p>
                  </div>
                  <Gauge size={20} className="muted-icon" />
                </div>
                <div className="interpretation-grid">
                  <div className="interpretation-item"><span className="interpretation-index">01</span><div><strong>Relative ranking</strong><p>Drivers are ordered by their model scores within the selected race. The top-ranked driver has the highest score from this model.</p></div></div>
                  <div className="interpretation-item"><span className="interpretation-index">02</span><div><strong>Normalized scores</strong><p>The API rescales scores to total approximately 100% across the field. This does not establish that the scores are calibrated probabilities.</p></div></div>
                  <div className="interpretation-item"><span className="interpretation-index">03</span><div><strong>Historical context</strong><p>This view uses the saved historical dataset. It does not represent a live forecast for an upcoming race weekend.</p></div></div>
                </div>
              </section>

              <section className="panel historical-panel" id="historical">
                <div className="panel-header">
                  <div>
                    <div className="section-kicker"><span /> RACE RECORD</div>
                    <h3>Historical result check</h3>
                    <p>Compare the model ranking with the recorded winner</p>
                  </div>
                  <History size={20} className="muted-icon" />
                </div>
                <div className="historical-summary">
                  <div><span className="eyebrow">PREDICTED LEADER</span><strong>{leader?.driver ?? "—"}</strong></div>
                  <div><span className="eyebrow">RECORDED WINNER</span><strong>{prediction.drivers.find(d => d.actual_winner === 1)?.driver ?? "Not available"}</strong></div>
                  <div><span className="eyebrow">TOP-1 MATCH</span><strong className={leader?.actual_winner === 1 ? "match-yes" : "match-no"}>{leader?.actual_winner === 1 ? "CORRECT" : "NOT MATCHED"}</strong></div>
                </div>
                <div className="historical-chart-heading">
                  <div>
                    <span className="eyebrow">MODEL RANK × CLASSIFIED RESULT</span>
                    <h4>Predicted vs. actual finishing position</h4>
                  </div>
                  <span className="chart-unit">{prediction.season} · {prediction.race}</span>
                </div>
                {historicalDrivers.length ? (
                  <div className="historical-chart-plot">
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart margin={{ top: 12, right: 18, left: 4, bottom: 8 }}>
                        <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                        <XAxis
                          type="number"
                          dataKey="predicted_position"
                          name="Predicted position"
                          domain={[1, "dataMax"]}
                          tick={chartAxisTick}
                          axisLine={false}
                          tickLine={false}
                          label={{ value: "MODEL RANK", position: "insideBottom", offset: -4, fill: "#91a1b5", fontSize: 9 }}
                        />
                        <YAxis
                          type="number"
                          dataKey="actual_position"
                          name="Actual finish"
                          domain={[1, "dataMax"]}
                          reversed
                          tick={chartAxisTick}
                          axisLine={false}
                          tickLine={false}
                          label={{ value: "ACTUAL FINISH", angle: -90, position: "insideLeft", fill: chartColors.tick, fontSize: 9 }}
                        />
                        <ReferenceLine
                          segment={[{ x: 1, y: 1 }, { x: maxFinishPosition, y: maxFinishPosition }]}
                          stroke={chartColors.secondary}
                          strokeDasharray="4 4"
                        />
                        <Tooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          contentStyle={chartTooltipStyle}
                          formatter={(value, name) => [`P${Number(value)}`, name]}
                          labelFormatter={(_, entries) => entries[0]?.payload.driver ?? ""}
                        />
                        <Scatter data={historicalDrivers} fill={chartColors.accent} name="Drivers" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <ChartEmptyState
                    title="Finishing positions unavailable"
                    message="This race has no recorded classified results, so actual finishing positions cannot be compared."
                  />
                )}
              </section>
            </>
          )}

          {!loading && !prediction && !error && (
            <div className="empty-panel"><Activity size={25} /><strong>Preparing race data</strong><span>Select a season and Grand Prix to view the model output.</span></div>
          )}

          <footer className="page-footer">
            <span>APEX F1 <span className="footer-separator">/</span> INDEPENDENT ANALYTICS PROJECT</span>
            <span>HISTORICAL MODEL VIEW <span className="footer-separator">·</span> NOT OFFICIAL F1 DATA SERVICES</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
