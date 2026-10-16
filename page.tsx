
"use client";

import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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

const metrics = [
  {
    title: "Winner accuracy",
    description: "How often the model ranked the race winner first.",
    key: "accuracy",
    lowerIsBetter: false,
    values: [
      { model: "Logistic Regression", value: "48.18%", note: "Average of five seasonal accuracies" },
      { model: "Random Forest", value: "41.21%", note: "Average of five seasonal accuracies" },
      { model: "Grid Baseline", value: "54.32%", note: "Average of five seasonal accuracies" },
    ],
  },
  {
    title: "Log Loss",
    description: "Penalizes confident predictions that are wrong. Lower is better.",
    key: "logloss",
    lowerIsBetter: true,
    values: [
      { model: "Logistic Regression", value: "1.676", note: "Mean of five seasonal results" },
      { model: "Random Forest", value: "1.703", note: "Mean of five seasonal results" },
      { model: "Grid Baseline", value: "1.958", note: "Mean of five seasonal results" },
    ],
  },
  {
    title: "Brier Score",
    description: "Measures probability prediction error. Lower is better.",
    key: "brier",
    lowerIsBetter: true,
    values: [
      { model: "Logistic Regression", value: "0.763", note: "Mean of five seasonal results" },
      { model: "Random Forest", value: "0.695", note: "Mean of five seasonal results" },
      { model: "Grid Baseline", value: "0.807", note: "Mean of five seasonal results" },
    ],
  },
];

export default function ComparisonPage() {
  return (
    <main className="min-h-screen bg-[#101010] px-5 py-8 text-white md:px-10">
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
              detail: "Grid baseline across these seasons",
            },
            {
              label: "Best average Brier score",
              value: "0.695",
              detail: "Random Forest across these seasons",
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
            </p>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={validationData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#333333" strokeDasharray="3 3" />
                <XAxis dataKey="season" stroke="#999999" />
                <YAxis
                  stroke="#999999"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#191919",
                    border: "1px solid #444",
                    borderRadius: 8,
                  }}
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, "Accuracy"]}
                />
                <Legend />
                <Bar dataKey="logistic" name="Logistic Regression" fill="#E10600" radius={[4, 4, 0, 0]} />
                <Bar dataKey="randomForest" name="Random Forest" fill="#8B8B8B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="baseline" name="Grid Baseline" fill="#E5E5E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Evaluation metrics</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Different metrics measure different aspects of model performance.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {metrics.map((metric) => (
              <article
                key={metric.key}
                className="rounded-xl border border-white/10 bg-[#191919] p-5"
              >
                <h3 className="text-lg font-bold">{metric.title}</h3>
                <p className="mt-2 min-h-12 text-sm leading-5 text-neutral-400">
                  {metric.description}
                </p>
                <div className="mt-5 space-y-4">
                  {metric.values.map((item) => (
                    <div
                      key={item.model}
                      className="border-t border-white/10 pt-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-neutral-300">{item.model}</p>
                        <p className="font-bold tabular-nums">{item.value}</p>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{item.note}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
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
              <strong className="text-white">Probability error:</strong> Random
              Forest had the lowest average Brier score in this validation run,
              while Logistic Regression had the lowest average Log Loss.
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
