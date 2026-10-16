
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  Flag,
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
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
  McLaren: "#FF8000",
  Mercedes: "#00A19C",
  "Red Bull": "#3671C6",
  Williams: "#64C4FF",
  Alpine: "#0093CC",
  Aston: "#229971",
  Haas: "#B6BABD",
  Sauber: "#52E252",
  Racing: "#6692FF",
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
          <div className="brand-mark"><Flag size={23} strokeWidth={2.5} /></div>
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
    <div>
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
    </div>

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
              </span>
              <strong className="upcoming-driver-score">
                {driver.win_probability_pct.toFixed(2)}%
              </strong>
            </div>
          ))}
        </div>
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
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={topThree} layout="vertical" margin={{ top: 4, right: 18, left: 0, bottom: 4 }}>
                        <CartesianGrid stroke="#30303A" horizontal={false} />
                        <XAxis type="number" tick={{ fill: "#8B8B99", fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                        <YAxis type="category" dataKey="driver_code" tick={{ fill: "#D8D8DF", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip contentStyle={{ background: "#20202A", border: "1px solid #383843", borderRadius: 8, color: "#fff" }} formatter={(value) => [`${Number(value).toFixed(2)}%`, "Win score"]} />
                        <Bar dataKey="win_probability_pct" radius={[0, 4, 4, 0]} barSize={22}>
                          {topThree.map((entry, index) => <Cell key={entry.driver} fill={index === 0 ? "#E10600" : index === 1 ? "#A83A3A" : "#6E3038"} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
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
