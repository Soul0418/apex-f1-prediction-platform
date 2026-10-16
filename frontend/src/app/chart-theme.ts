export const chartColors = {
  accent: "#e10600",
  secondary: "#8b98aa",
  grid: "#29384d",
  tick: "#91a1b5",
  surface: "#111925",
  border: "#263446",
  text: "#e6edf5",
};

export const chartAxisTick = {
  fill: chartColors.tick,
  fontSize: 10,
};

export const chartTooltipStyle = {
  background: chartColors.surface,
  border: `1px solid ${chartColors.border}`,
  borderRadius: 8,
  color: chartColors.text,
  fontSize: 11,
};

export function ChartEmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return createElement(
    "div",
    {
      className: "chart-empty-state",
      role: "status",
      style: {
        display: "flex",
        minHeight: 150,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: 22,
        border: `1px dashed ${chartColors.border}`,
        borderRadius: 8,
        background: "#0c121b",
        textAlign: "center",
      },
    },
    createElement("strong", {
      style: {
        display: "block",
        color: chartColors.text,
        fontSize: 12,
      },
    }, title),
    createElement("span", {
      style: {
        display: "block",
        maxWidth: 480,
        color: chartColors.tick,
        fontSize: 11,
        lineHeight: 1.7,
      },
    }, message),
  );
}
import { createElement } from "react";
