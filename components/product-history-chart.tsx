"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Legend,
  Tooltip
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Legend, Tooltip);

export interface HistoryPoint {
  captured_at: string;
  price_cents: number | null;
  rating: number | null;
  reviews_count: number | null;
  bsr: number | null;
}

export function ProductHistoryChart({ history }: { history: HistoryPoint[] }) {
  const data = useMemo(() => {
    const labels = history.map(point => new Date(point.captured_at).toLocaleDateString());
    return {
      labels,
      datasets: [
        {
          label: "Best Sellers Rank",
          yAxisID: "y",
          data: history.map(point => point.bsr ?? null),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.15)",
          tension: 0.4,
          spanGaps: true
        },
        {
          label: "Reviews",
          yAxisID: "y1",
          data: history.map(point => point.reviews_count ?? null),
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.15)",
          tension: 0.3,
          spanGaps: true
        },
        {
          label: "Price ($)",
          yAxisID: "y2",
          data: history.map(point => (point.price_cents ?? null) != null ? (point.price_cents ?? 0) / 100 : null),
          borderColor: "#f97316",
          backgroundColor: "rgba(249,115,22,0.15)",
          tension: 0.3,
          spanGaps: true
        }
      ]
    };
  }, [history]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    scales: {
      y: {
        type: "linear" as const,
        position: "left" as const,
        reverse: true,
        ticks: { color: "#1e293b" },
        grid: { color: "rgba(148,163,184,0.2)" }
      },
      y1: {
        type: "linear" as const,
        position: "right" as const,
        ticks: { color: "#047857" },
        grid: { drawOnChartArea: false }
      },
      y2: {
        type: "linear" as const,
        position: "right" as const,
        display: false
      }
    },
    plugins: {
      legend: { position: "bottom" as const }
    }
  }), []);

  return (
    <div className="h-80">
      <Line data={data} options={options} />
    </div>
  );
}
