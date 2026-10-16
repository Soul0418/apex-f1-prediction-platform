
"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  Scatter,
  ScatterChart,
} from "recharts";
import {
  ChartEmptyState,
  chartAxisTick,
  chartColors,
  chartTooltipStyle,
} from "../chart-theme";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type CalibrationResponse = {
  model: string;
  season: number;
  race_count: number;
  brier_score: number;
  points: {
    predicted_probability_pct: number;
    observed_win_rate_pct: number;
    sample_size: number;
  }[];
};

const validationData = [
  {
    season: "2021",
    logistic: 36.36,
    randomForest: 27.27,
    baseline: 50.0,
  },
  {
    season: "2022",
    logistic: 40.91,
    randomForest: 22.73,
    baseline: 45.45,
  },
  {
    season: "2023",
    logistic: 72.73,
    randomForest: 68.18,
    baseline: 63.64,
  },
  {
    season: "2024",
    logistic: 45.83,
    randomForest: 45.83,
    baseline: 45.83,
  },
  {
    season: "2025",
    logistic: 50.0,
    randomForest: 45.83,
    baseline: 66.67,
  },
];

const modelMetrics = [
  {
    model: "Logistic Regression",
    accuracy: 49.17,
    logLoss: 1.1693,
    brier: 0.5980,
  },
  {
    model: "Random Forest",
    accuracy: 41.97,
    logLoss: 1.3708,
    brier: 0.6585,
  },
  {
    model: "Grid Baseline",
    accuracy: 54.32,
    logLoss: 1.2254,
    brier: 0.6138,
  },
];

const bestAccuracy = Math.max(...modelMetrics.map((item) => item.accuracy));
const bestLogLoss = Math.min(...modelMetrics.map((item) => item.logLoss));
const bestBrier = Math.min(...modelMetrics.map((item) => item.brier));

export default function ComparisonPage() {
  const [calibrationModel, setCalibrationModel] = useState("logistic");
  const [calibration, setCalibration] = useState<CalibrationResponse | null>(null);
  const [calibrationError, setCalibrationError] = useState<{
    model: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API}/calibration?model=${encodeURIComponent(calibrationModel)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Could not load calibration data.");
        }
        return data as CalibrationResponse;
      })
      .then((data) => {
        if (!cancelled) setCalibration(data);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setCalibrationError({
            model: calibrationModel,
            message:
              reason instanceof Error
                ? reason.message
                : "Could not load calibration data.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [calibrationModel]);

  const selectedCalibration =
    calibration?.model === calibrationModel ? calibration : null;
  const selectedCalibrationError =
    calibrationError?.model === calibrationModel
      ? calibrationError.message
      : "";

  return (
    <main className="comparison-page min-h-screen bg-[#101010] px-5 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#E10600]">
            APEX F1 / MODEL LAB
          </p>
          <h1 className="text-4xl font-extrabold uppercase tracking-tight md:text-5xl">
            Model comparison
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-400">
            A season-by-season review of winner selection and probability
            evaluation. Validation results use chronological splits.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Validation seasons",
              value: "2021–2025",
              detail: "Five held-out seasons",
            },
            {
              label: "Best average winner accuracy",
              value: "54.32%",
              detail: "Grid baseline · mean across 2021–2025",
            },
            {
              label: "Best 2025 Brier score",
              value: "0.598",
              detail: "Logistic Regression · 24 races",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-white/10 bg-[#191919] p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-bold">{item.value}</p>
              <p className="mt-2 text-sm text-neutral-500">{item.detail}</p>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-white/10 bg-[#191919] p-5 md:p-7">
          <div className="mb-6">
            <h2 className="text-xl font-bold">Winner accuracy by season</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Percentage of races where the model ranked the actual winner first.
              Higher is better; the summary below averages the five seasons equally.
            </p>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={validationData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                <XAxis dataKey="season" tick={chartAxisTick} axisLine={false} tickLine={false} />
                <YAxis
                  tick={chartAxisTick}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, "Accuracy"]}
                />
                <Legend />
                <Bar dataKey="logistic" name="Logistic Regression" fill={chartColors.accent} radius={[4, 4, 0, 0]} />
                <Bar dataKey="randomForest" name="Random Forest" fill={chartColors.secondary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="baseline" name="Grid Baseline" fill="#d9e1eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-[#191919] p-5 md:p-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Probability calibration</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                Compare each score band’s average predicted win chance with how
                often those drivers actually won. The dashed diagonal represents
                perfect calibration.
              </p>
            </div>
            <label className="grid gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Model
              <select
                className="rounded-md border border-white/15 bg-[#101010] px-3 py-2 text-sm normal-case tracking-normal text-white"
                value={calibrationModel}
                onChange={(event) => setCalibrationModel(event.target.value)}
              >
                <option value="logistic">Logistic Regression</option>
                <option value="random_forest">Random Forest</option>
                <option value="baseline">Grid Baseline</option>
              </select>
            </label>
          </div>

          {selectedCalibration && (
            <div className="mb-4 flex flex-wrap gap-x-8 gap-y-3 border-y border-white/10 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Brier score
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums">
                  {selectedCalibration.brier_score.toFixed(3)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Validation sample
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums">
                  {selectedCalibration.race_count} races · {selectedCalibration.season}
                </p>
              </div>
            </div>
          )}

          {selectedCalibrationError ? (
            <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-200">
              {selectedCalibrationError}
            </div>
          ) : selectedCalibration?.points.length ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 12, right: 20, bottom: 24, left: 8 }}>
                  <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="predicted_probability_pct"
                    name="Mean predicted score"
                    domain={[0, 100]}
                    tick={chartAxisTick}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                    label={{
                      value: "AVERAGE NORMALIZED WIN SCORE",
                      position: "insideBottom",
                      offset: -14,
                      fill: chartColors.tick,
                      fontSize: 9,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="observed_win_rate_pct"
                    name="Observed win rate"
                    domain={[0, 100]}
                    tick={chartAxisTick}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
                    label={{
                      value: "OBSERVED WIN RATE",
                      angle: -90,
                      position: "insideLeft",
                      fill: chartColors.tick,
                      fontSize: 9,
                    }}
                  />
                  <ReferenceLine
                    segment={[{ x: 0, y: 0 }, { x: 100, y: 100 }]}
                    stroke={chartColors.secondary}
                    strokeDasharray="5 5"
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={chartTooltipStyle}
                    formatter={(value, name, item) => [
                      `${Number(value).toFixed(1)}%`,
                      `${name} · ${item.payload.sample_size} drivers`,
                    ]}
                  />
                  <Scatter
                    name="Observed win rate"
                    data={selectedCalibration.points}
                    fill={chartColors.accent}
                    shape="circle"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : selectedCalibration ? (
            <ChartEmptyState
              title="Calibration data unavailable"
              message={`No valid score observations were found for ${calibrationModel} in ${selectedCalibration.season}.`}
            />
          ) : (
            <div className="grid h-80 place-items-center text-sm text-neutral-400">
              Loading calibration results…
            </div>
          )}

          <p className="mt-3 text-xs leading-5 text-neutral-500">
            Each point groups drivers with similar normalized score, with
            sample size shown on hover. Scores sum to 100% within a race and
            are not calibrated win probabilities; the diagonal is a reference,
            not a probability claim.
          </p>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Evaluation metrics</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Winner accuracy is averaged equally across 2021–2025. Log loss
              and Brier score use normalized 2025 results across 24 races.
              Accuracy is better when higher; error scores are better when lower.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#191919]">
            <table className="w-full min-w-[700px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">Model</th>
                  <th className="px-5 py-4 font-semibold">
                    <span className="block">Winner accuracy</span>
                    <span className="mt-1 block font-normal normal-case tracking-normal text-neutral-500">5-season mean · higher is better</span>
                  </th>
                  <th className="px-5 py-4 font-semibold">
                    <span className="block">Log loss</span>
                    <span className="mt-1 block font-normal normal-case tracking-normal text-neutral-500">2025 · lower is better</span>
                  </th>
                  <th className="px-5 py-4 font-semibold">
                    <span className="block">Brier score</span>
                    <span className="mt-1 block font-normal normal-case tracking-normal text-neutral-500">2025 · lower is better</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {modelMetrics.map((item) => (
                  <tr key={item.model} className="border-b border-white/10 last:border-0">
                    <th scope="row" className="px-5 py-4 font-medium text-neutral-200">
                      {item.model}
                    </th>
                    {([
                      { value: item.accuracy, best: item.accuracy === bestAccuracy, format: (value: number) => `${value.toFixed(2)}%` },
                      { value: item.logLoss, best: item.logLoss === bestLogLoss, format: (value: number) => value.toFixed(4) },
                      { value: item.brier, best: item.brier === bestBrier, format: (value: number) => value.toFixed(4) },
                    ]).map((metric, index) => (
                      <td key={`${item.model}-${index}`} className="px-5 py-4 tabular-nums text-white">
                        <span className="font-bold">{metric.format(metric.value)}</span>
                        {metric.best && (
                          <span className="ml-2 rounded-full border border-[#E10600]/30 bg-[#E10600]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#ffb4ab]">
                            Best
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs leading-5 text-neutral-500">
            The accuracy and probability-error columns come from different
            validation summaries, so compare models within each column rather
            than comparing values across columns.
          </p>
        </section>

        <section className="rounded-xl border border-[#E10600]/30 bg-[#E10600]/5 p-5 md:p-7">
          <h2 className="text-lg font-bold">What these results tell us</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-300">
            <li>
              <strong className="text-white">Winner selection:</strong> the grid
              baseline performed best on average across these five validation seasons.
              That is a meaningful benchmark, not a reason to assume the ML models
              are already superior.
            </li>
            <li>
              <strong className="text-white">2025 probability error:</strong>{" "}
              Logistic Regression has the lowest Brier score (0.5980) and Log
              Loss (1.1693) in this normalized evaluation.
            </li>
            <li>
              <strong className="text-white">Next improvement:</strong> compare
              models using the same evaluation protocol and inspect probability
              calibration before presenting scores as real win chances.
            </li>
          </ul>
          <p className="mt-5 border-t border-white/10 pt-4 text-xs leading-5 text-neutral-500">
            Research dashboard only. These figures are from the existing
            chronological validation run and are not live predictions. Historical
            results do not guarantee future performance.
          </p>
        </section>
      </div>
    </main>
  );
}
