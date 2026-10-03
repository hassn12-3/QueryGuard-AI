"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import { Code2, ChevronDown, BarChart3, Copy, Check, Maximize2, Minimize2, X } from "lucide-react";

// Dynamically import lightweight Plotly bundle to avoid chunk timeout and SSR issues
const Plot = dynamic(
  () =>
    Promise.all([
      import("react-plotly.js/factory"),
      import("plotly.js-dist-min"),
    ]).then(([factoryMod, plotlyDist]) => {
      const createPlotlyComponent = factoryMod.default || factoryMod;
      const Plotly = (plotlyDist as any).default || plotlyDist;
      return createPlotlyComponent(Plotly);
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-500">Rendering interactive chart…</span>
        </div>
      </div>
    ),
  }
);

interface ChartRendererProps {
  spec: Record<string, unknown> | null;
  sql: string;
  theme?: "dark" | "light";
}

// ── Layout defaults for Light and Dark themes ─────────────────────────────────

const DARK_LAYOUT_DEFAULTS = {
  plot_bgcolor: "#0f172a",
  paper_bgcolor: "#0f172a",
  font: { color: "#e2e8f0", family: "Inter, system-ui, sans-serif", size: 12 },
  xaxis: {
    gridcolor: "rgba(148,163,184,0.08)",
    zerolinecolor: "rgba(148,163,184,0.15)",
    tickfont: { color: "#94a3b8" },
  },
  yaxis: {
    gridcolor: "rgba(148,163,184,0.08)",
    zerolinecolor: "rgba(148,163,184,0.15)",
    tickfont: { color: "#94a3b8" },
  },
  legend: {
    bgcolor: "rgba(15,23,42,0.8)",
    bordercolor: "rgba(148,163,184,0.15)",
    borderwidth: 1,
    font: { color: "#e2e8f0" },
  },
  margin: { t: 50, r: 20, b: 60, l: 60 },
};

const LIGHT_LAYOUT_DEFAULTS = {
  plot_bgcolor: "#ffffff",
  paper_bgcolor: "#ffffff",
  font: { color: "#1e293b", family: "Inter, system-ui, sans-serif", size: 12 },
  xaxis: {
    gridcolor: "rgba(226,232,240,0.8)",
    zerolinecolor: "rgba(203,213,225,0.8)",
    tickfont: { color: "#64748b" },
  },
  yaxis: {
    gridcolor: "rgba(226,232,240,0.8)",
    zerolinecolor: "rgba(203,213,225,0.8)",
    tickfont: { color: "#64748b" },
  },
  legend: {
    bgcolor: "rgba(255,255,255,0.9)",
    bordercolor: "rgba(226,232,240,0.8)",
    borderwidth: 1,
    font: { color: "#1e293b" },
  },
  margin: { t: 50, r: 20, b: 60, l: 60 },
};

// ── Deep merge helper ──────────────────────────────────────────────────────────

function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override)) {
    if (
      typeof base[key] === "object" &&
      base[key] !== null &&
      !Array.isArray(base[key]) &&
      typeof override[key] === "object" &&
      override[key] !== null &&
      !Array.isArray(override[key])
    ) {
      result[key] = deepMerge(
        base[key] as Record<string, unknown>,
        override[key] as Record<string, unknown>
      );
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

// ── No-chart placeholder ───────────────────────────────────────────────────────

function NoChartPlaceholder({ sql }: { sql: string }) {
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8 text-slate-400 dark:text-slate-500" />
      </div>
      <h3 className="text-slate-800 dark:text-slate-200 font-bold text-base mb-1">
        Direct Data Response
      </h3>
      <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mb-5 leading-relaxed">
        This query returned specific single-value records or categorical lookups. Switch to the <strong>Data Table</strong> tab to view the complete dataset.
      </p>
      {sql && (
        <div className="w-full max-w-lg">
          <button
            id="show-sql-fallback"
            onClick={() => setShowSql((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>{showSql ? "Hide Generated SQL" : "Inspect Generated SQL"}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${showSql ? "rotate-180" : ""}`}
            />
          </button>

          {showSql && (
            <div className="mt-3 relative text-left animate-fade-in">
              <button
                onClick={handleCopy}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Copy SQL"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <pre className="p-4 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs leading-relaxed max-h-48 overflow-auto border border-slate-800 shadow-md">
                {sql}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ChartRenderer({ spec, sql, theme = "dark" }: ChartRendererProps) {
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Close fullscreen on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  if (!spec) {
    return <NoChartPlaceholder sql={sql} />;
  }

  const rawData = (spec.data ?? []) as Plotly.Data[];
  const rawLayout = (spec.layout ?? {}) as Record<string, unknown>;

  // Merge theme defaults under the chart layout
  const themeDefaults = theme === "light" ? LIGHT_LAYOUT_DEFAULTS : DARK_LAYOUT_DEFAULTS;
  const mergedLayout = deepMerge(themeDefaults, rawLayout);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* ── Normal Chart View ── */}
      <div className="flex flex-col h-full bg-white dark:bg-slate-950 transition-colors">
        {/* Top Control Bar with Fullscreen Button */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Interactive Visualisation
          </span>
          <button
            onClick={() => setIsFullscreen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
            title="Open Graph in Full Screen"
          >
            <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>Full Screen</span>
          </button>
        </div>

        {/* Chart area */}
        <div className="flex-1 overflow-hidden p-2 min-h-0">
          <Plot
            data={rawData}
            layout={mergedLayout as Partial<Plotly.Layout>}
            config={{
              responsive: true,
              displayModeBar: true,
              modeBarButtonsToRemove: ["lasso2d", "select2d"],
              displaylogo: false,
              toImageButtonOptions: {
                format: "png",
                filename: "datamind_chart",
                scale: 2,
              },
            }}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
          />
        </div>

        {/* SQL Inspector Footer */}
        {sql && (
          <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-800 px-4 py-2.5 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <button
                id="chart-toggle-sql"
                onClick={() => setShowSql((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                <span>{showSql ? "Hide Generated SQL" : "View Generated SQL Statement"}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${showSql ? "rotate-180" : ""}`}
                />
              </button>

              {showSql && (
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              )}
            </div>

            {showSql && (
              <div className="animate-fade-in">
                <pre className="p-3.5 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs leading-relaxed max-h-36 overflow-auto border border-slate-800 shadow-inner">
                  {sql}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fullscreen Modal View ── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl p-6 flex flex-col animate-fade-in">
          {/* Header */}
          <div className="flex-shrink-0 flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Full Screen Visualisation
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFullscreen(false)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
              >
                <Minimize2 className="w-4 h-4 text-indigo-500" />
                <span>Exit Full Screen (ESC)</span>
              </button>
              <button
                onClick={() => setIsFullscreen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Full-width and full-height Plotly Canvas */}
          <div className="flex-1 w-full h-full min-h-0 pt-4">
            <Plot
              data={rawData}
              layout={{
                ...mergedLayout,
                autosize: true,
              } as Partial<Plotly.Layout>}
              config={{
                responsive: true,
                displayModeBar: true,
                displaylogo: false,
                toImageButtonOptions: {
                  format: "png",
                  filename: "datamind_chart_fullscreen",
                  scale: 3,
                },
              }}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler
            />
          </div>
        </div>
      )}
    </>
  );
}
