"use client";

import { useMemo } from "react";
import {
  CheckCircle2,
  Loader2,
  Database,
  Cpu,
  ShieldCheck,
  Play,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  Code2,
  Layers,
} from "lucide-react";
import type { TraceStep } from "@/app/page";

interface PipelineProgressBarProps {
  steps: TraceStep[];
  isActive: boolean;
}

interface PipelineStage {
  id: string;
  nodeName: string;
  label: string;
  shortLabel: string;
  icon: typeof Database;
  description: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "query",
    nodeName: "query_input",
    label: "Question Received",
    shortLabel: "Query",
    icon: MessageSquare,
    description: "Input parsed and normalized",
  },
  {
    id: "schema",
    nodeName: "retrieve_schema_node",
    label: "Schema Pruning",
    shortLabel: "Schema",
    icon: Database,
    description: "Extracting relevant tables & FKs",
  },
  {
    id: "generate",
    nodeName: "generate_sql_node",
    label: "Translating to SQL",
    shortLabel: "SQL Synthesis",
    icon: Cpu,
    description: "Synthesizing SQLite query via LLM",
  },
  {
    id: "validate",
    nodeName: "validate_sql_node",
    label: "Safety & AST Check",
    shortLabel: "Validation",
    icon: ShieldCheck,
    description: "Enforcing read-only AST rules",
  },
  {
    id: "execute",
    nodeName: "execute_sql_node",
    label: "Executing SQLite",
    shortLabel: "Execution",
    icon: Play,
    description: "Running query on local database",
  },
  {
    id: "synthesize",
    nodeName: "synthesize_insights_node",
    label: "Synthesizing Visuals",
    shortLabel: "Insights",
    icon: Sparkles,
    description: "Compiling Plotly visual charts",
  },
];

export default function PipelineProgressBar({ steps, isActive }: PipelineProgressBarProps) {
  // Determine status of each stage
  const stageStatuses = useMemo(() => {
    const statuses: Record<string, "waiting" | "running" | "done" | "error"> = {
      query_input: "done",
    };

    let foundActive = false;

    for (const s of steps) {
      statuses[s.node] = s.status;
      if (s.status === "running") {
        foundActive = true;
      }
    }

    // If active and no stage is marked running, mark the first waiting stage as running
    if (isActive && !foundActive) {
      for (const stage of PIPELINE_STAGES) {
        if (!statuses[stage.nodeName] || statuses[stage.nodeName] === "waiting") {
          statuses[stage.nodeName] = "running";
          break;
        }
      }
    }

    return statuses;
  }, [steps, isActive]);

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    let completedCount = 0;
    for (const stage of PIPELINE_STAGES) {
      if (stageStatuses[stage.nodeName] === "done") {
        completedCount++;
      } else if (stageStatuses[stage.nodeName] === "running") {
        completedCount += 0.5;
      }
    }
    return Math.min(100, Math.round((completedCount / PIPELINE_STAGES.length) * 100));
  }, [stageStatuses]);

  // Current active stage description for live subtitle
  const activeMessage = useMemo(() => {
    const lastStep = steps[steps.length - 1];
    if (lastStep?.message) return lastStep.message;
    if (stageStatuses["synthesize_insights_node"] === "running")
      return "Compiling Plotly interactive chart and executive summary…";
    if (stageStatuses["execute_sql_node"] === "running")
      return "Executing validated SQL against SQLite database…";
    if (stageStatuses["validate_sql_node"] === "running")
      return "Inspecting AST syntax and checking read-only permissions…";
    if (stageStatuses["generate_sql_node"] === "running")
      return "Translating question to SQLite query with multi-key rotation…";
    if (stageStatuses["retrieve_schema_node"] === "running")
      return "Identifying relevant tables and relational constraints…";
    return "Initializing autonomous pipeline…";
  }, [steps, stageStatuses]);

  if (!isActive) return null;

  return (
    <div className="w-full h-full flex flex-col justify-center items-center p-6 md:p-10 animate-fade-in overflow-y-auto">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl shadow-indigo-500/10 backdrop-blur-xl">
        {/* Header: Title + Progress Badge */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="w-3 h-3 rounded-full bg-indigo-500 block animate-ping absolute" />
              <span className="w-3 h-3 rounded-full bg-indigo-600 block relative" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Autonomous Pipeline Execution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Multi-agent workflow in progress · Auto-hides on completion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
              {progressPercent}%
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 animate-pulse">
              Live Stream
            </span>
          </div>
        </div>

        {/* ── Progress Bar Fill ── */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-8">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* ── Horizontal Stepper ── */}
        <div className="relative flex items-center justify-between mb-8 px-2">
          {/* Background Connecting Track Line */}
          <div className="absolute top-5 left-8 right-8 h-1 bg-slate-100 dark:bg-slate-800 -z-0 rounded-full" />

          {PIPELINE_STAGES.map((stage) => {
            const status = stageStatuses[stage.nodeName] || "waiting";
            const Icon = stage.icon;
            const isDone = status === "done";
            const isRunning = status === "running";
            const isError = status === "error";

            return (
              <div
                key={stage.id}
                className="relative z-10 flex flex-col items-center group transition-transform"
                style={{ width: `${100 / PIPELINE_STAGES.length}%` }}
              >
                {/* Stage Icon Node */}
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isDone
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25 scale-100 ring-4 ring-emerald-50 dark:ring-emerald-950/40"
                      : isRunning
                      ? "bg-indigo-600 text-white shadow-xl shadow-indigo-600/40 scale-110 ring-4 ring-indigo-100 dark:ring-indigo-950/60 animate-pulse"
                      : isError
                      ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-5 h-5 transition-transform duration-200" />
                  ) : isRunning ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : isError ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                {/* Stage Name */}
                <span
                  className={`mt-3 text-[11px] font-bold text-center tracking-tight transition-colors line-clamp-1 ${
                    isDone
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isRunning
                      ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
                      : isError
                      ? "text-rose-500 font-bold"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {stage.shortLabel}
                </span>

                {/* Mini Status Tag */}
                <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:inline-block mt-0.5">
                  {isDone ? "Done" : isRunning ? "Running" : "Pending"}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Real-Time Step Activity Feed (Moved to Right Side!) ── */}
        <div className="rounded-2xl border bg-slate-50/70 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800 p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              Live Stage Activity
            </span>
            <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
              {activeMessage}
            </span>
          </div>

          {/* List of past steps in current run */}
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {steps.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                <span>Initializing agent pipeline and connecting to SQLite…</span>
              </div>
            ) : (
              steps.map((step, idx) => (
                <div
                  key={`${step.node}-${idx}`}
                  className="flex items-center justify-between gap-3 text-xs p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 truncate">
                    {step.status === "done" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : step.status === "running" ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    )}
                    <span className="font-mono text-slate-800 dark:text-slate-200 font-medium truncate">
                      {step.node.replace("_node", "").replace(/_/g, " ")}
                    </span>
                    {step.message && (
                      <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
                        — {step.message}
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                      step.status === "done"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : step.status === "running"
                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        : "bg-rose-500/10 text-rose-500"
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
