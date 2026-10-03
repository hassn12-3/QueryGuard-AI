"use client";

import { useEffect, useRef } from "react";
import {
  Database,
  Cpu,
  ShieldCheck,
  Play,
  BarChart3,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import type { TraceStep } from "@/app/page";

interface TraceViewerProps {
  steps: TraceStep[];
  isActive: boolean;
}

// ── Node metadata ─────────────────────────────────────────────────────────────

const NODE_META: Record<
  string,
  { label: string; Icon: React.ElementType; color: string; bgColor: string }
> = {
  retrieve_schema_node: {
    label: "Pruning schema",
    Icon: Database,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/40",
  },
  generate_sql_node: {
    label: "Generating SQL",
    Icon: Cpu,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40",
  },
  validate_sql_node: {
    label: "Validating AST",
    Icon: ShieldCheck,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40",
  },
  execute_sql_node: {
    label: "Executing query",
    Icon: Play,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40",
  },
  advanced_analysis_node: {
    label: "Running analysis",
    Icon: BarChart3,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40",
  },
  synthesize_insights_node: {
    label: "Synthesising insights",
    Icon: FileText,
    color: "text-rose-600 dark:text-rose-400",
    bgColor: "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40",
  },
};

// ── Status Icon ───────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: TraceStep["status"] }) {
  if (status === "running") {
    return <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin flex-shrink-0" />;
  }
  if (status === "done") {
    return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />;
  }
  return <XCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />;
}

// ── Trace Step Row ────────────────────────────────────────────────────────────

function TraceStepRow({ step }: { step: TraceStep }) {
  const meta = NODE_META[step.node] ?? {
    label: step.node,
    Icon: Cpu,
    color: "text-slate-500 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
  };
  const { Icon } = meta;

  return (
    <div className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bgColor} ${meta.color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-semibold ${meta.color}`}>
            {meta.label}
          </span>
          <StatusIcon status={step.status} />
        </div>
        {step.message && step.status !== "running" && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed truncate">
            {step.message}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TraceViewer({ steps, isActive }: TraceViewerProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps]);

  return (
    <div className="h-full flex flex-col bg-slate-50/70 dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">
            Live Agent Execution Trace
          </span>
          {isActive && (
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              Active
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
          {steps.length} node{steps.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Steps */}
      <div className="flex-1 overflow-y-auto py-1 divide-y divide-slate-100 dark:divide-slate-900">
        {steps.length === 0 && isActive ? (
          <div className="px-4 py-3 flex items-center gap-2 text-slate-500">
            <Loader2 className="w-3.5 h-3.5 text-indigo-500 animate-spin" />
            <span className="text-xs">
              Initialising multi-agent LangGraph workflow…
            </span>
          </div>
        ) : (
          steps.map((step, i) => (
            <TraceStepRow
              key={`${step.node}-${i}`}
              step={step}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
