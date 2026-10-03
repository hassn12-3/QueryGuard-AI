"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Database,
  Sparkles,
  Sun,
  Moon,
  BarChart3,
  Table as TableIcon,
  RotateCcw,
  Volume2,
  VolumeX,
  FileDown,
  Loader2,
} from "lucide-react";
import ChatSidebar from "@/components/ChatSidebar";
import ChartRenderer from "@/components/ChartRenderer";
import DataTable from "@/components/DataTable";
import WelcomeCanvas from "@/components/WelcomeCanvas";
import PipelineProgressBar from "@/components/PipelineProgressBar";
import { generatePDFReport } from "@/lib/pdfReport";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TraceStep {
  node: string;
  message: string;
  status: "running" | "done" | "error";
}

export interface QueryResult {
  generated_sql: string;
  query_result: Record<string, unknown>[];
  row_count: number;
  analysis_summary: string;
  chart_spec: Record<string, unknown> | null;
  trace_steps: TraceStep[];
  retry_count: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: QueryResult;
  timestamp: Date;
  isStreaming?: boolean;
}

// ── Main Page Component ───────────────────────────────────────────────────────

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeResult, setActiveResult] = useState<QueryResult | null>(null);
  const [liveTrace, setLiveTrace] = useState<TraceStep[]>([]);
  const [rightTab, setRightTab] = useState<"chart" | "table">("chart");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeQuery, setActiveQuery] = useState<string>("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSpeakingSummary, setIsSpeakingSummary] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ── Theme initialization ───────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem("datamind-theme") as "dark" | "light" | null;
    const initialTheme = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setTheme(initialTheme);
    if (initialTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("datamind-theme", next);
      if (next === "dark") {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
      }
      return next;
    });
  }, []);

  // ── Handlers for Speech & PDF ───────────────────────────────────────────────

  const handleToggleSpeechSummary = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Speech synthesis is not supported in this browser.");
      return;
    }

    if (isSpeakingSummary) {
      window.speechSynthesis.cancel();
      setIsSpeakingSummary(false);
      return;
    }

    if (!activeResult?.analysis_summary) return;

    window.speechSynthesis.cancel();

    const clean = activeResult.analysis_summary
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[#*_~>]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onend = () => setIsSpeakingSummary(false);
    utterance.onerror = () => setIsSpeakingSummary(false);

    setIsSpeakingSummary(true);
    window.speechSynthesis.speak(utterance);
  }, [isSpeakingSummary, activeResult]);

  const handleDownloadPdf = useCallback(async () => {
    if (!activeResult) return;
    setIsExportingPdf(true);
    try {
      await generatePDFReport({
        userQuery: activeQuery || "Business Analytics Query",
        summary: activeResult.analysis_summary,
        sql: activeResult.generated_sql,
        rowCount: activeResult.row_count,
        retryCount: activeResult.retry_count,
        rows: activeResult.query_result,
        chartElementId: "plotly-chart-container",
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsExportingPdf(false);
    }
  }, [activeResult, activeQuery]);

  // ── Submit Query ────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async (query: string) => {
    if (!query.trim() || isStreaming) return;

    setActiveQuery(query.trim());

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: query.trim(),
      timestamp: new Date(),
    };

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setLiveTrace([]);
    setActiveResult(null);

    abortRef.current = new AbortController();

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiBase.replace(/\/$/, "")}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Server returned error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        let currentEvent = "message";
        let currentData = "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("event:")) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith("data:")) {
            currentData = trimmed.slice(5).trim();
          } else if (trimmed === "" && currentData) {
            try {
              const parsed = JSON.parse(currentData);
              handleSseEvent(currentEvent, parsed, assistantMsgId);
            } catch (e) {
              console.warn("SSE parsing error:", e);
            }
            currentEvent = "message";
            currentData = "";
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return;
      const msg = (err as Error)?.message ?? "Connection to agent server failed.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: `Error: ${msg}`, isStreaming: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [isStreaming]);

  // ── Handle SSE event ────────────────────────────────────────────────────────

  const handleSseEvent = useCallback(
    (
      eventType: string,
      data: Record<string, unknown>,
      assistantMsgId: string
    ) => {
      if (eventType === "node_start") {
        const nodeName = data.node as string;
        setLiveTrace((prev) => {
          const existing = prev.find((s) => s.node === nodeName);
          if (existing) {
            return prev.map((s) =>
              s.node === nodeName ? { ...s, status: "running" } : s
            );
          }
          return [...prev, { node: nodeName, message: "", status: "running" }];
        });
      }

      if (eventType === "node_end") {
        const nodeName = data.node as string;
        let message = "";

        if (data.generated_sql) {
          message = `Generated ${String(data.generated_sql).split("\n")[0]}…`;
        } else if (data.row_count !== undefined) {
          message = `Returned ${Number(data.row_count).toLocaleString()} records`;
        } else if (data.sql_error) {
          message = `Self-healing error: ${String(data.sql_error).slice(0, 60)}…`;
        } else if (data.analysis_summary) {
          message = "Synthesized executive insights";
        }

        setLiveTrace((prev) => {
          const existing = prev.find((s) => s.node === nodeName);
          if (existing) {
            return prev.map((s) =>
              s.node === nodeName
                ? { ...s, status: data.sql_error ? "error" : "done", message }
                : s
            );
          }
          return [
            ...prev,
            { node: nodeName, message, status: data.sql_error ? "error" : "done" },
          ];
        });
      }

      if (eventType === "final_result") {
        const result: QueryResult = {
          generated_sql: (data.generated_sql as string) ?? "",
          query_result: (data.query_result as Record<string, unknown>[]) ?? [],
          row_count: (data.row_count as number) ?? 0,
          analysis_summary: (data.analysis_summary as string) ?? "",
          chart_spec: (data.chart_spec as Record<string, unknown>) ?? null,
          trace_steps: (data.trace_steps as TraceStep[]) ?? [],
          retry_count: (data.retry_count as number) ?? 0,
        };

        setActiveResult(result);
        setIsStreaming(false);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    result.analysis_summary ||
                    `Executed SQL query successfully: ${result.row_count.toLocaleString()} rows returned.`,
                  result,
                  isStreaming: false,
                }
              : m
          )
        );

        // Switch to chart if spec exists, else table
        setRightTab(result.chart_spec ? "chart" : "table");
      }

      if (eventType === "error") {
        const errorText = (data.error as string) ?? "Unknown server error occurred";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: `Error: ${errorText}`, isStreaming: false }
              : m
          )
        );
        setIsStreaming(false);
      }
    },
    []
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden mesh-bg transition-colors duration-200">
      {/* ── Top Bar ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 backdrop-blur-xl z-20 transition-colors">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold tracking-tight gradient-text-indigo-cyan">
                DataMind
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Intelligent SQL Analytics Platform
            </p>
          </div>
        </div>

        {/* Header Right Controls */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"
            title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-600 transition-transform hover:-rotate-12" />
            )}
          </button>
        </div>
      </header>

      {/* ── Main Split Pane: Both sides locked strictly to prevent whole-screen scrolling ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Pane: Chat Area ONLY (Trace widget removed from below input) */}
        <div
          className="flex flex-col h-full min-h-0 border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 transition-colors"
          style={{ width: "430px", minWidth: "340px", maxWidth: "560px" }}
        >
          <ChatSidebar
            messages={messages}
            isStreaming={isStreaming}
            onSubmit={handleSubmit}
            onStop={handleStop}
            theme={theme}
          />
        </div>

        {/* Right Pane: Live Pipeline Progress while query runs ➔ Output Dashboard on completion ➔ Welcome Canvas when idle */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950/40 transition-colors">
          {/* 1. WHILE PROCESSING: Show Smooth Animated Pipeline Progress Bar on Right Side */}
          {isStreaming ? (
            <PipelineProgressBar steps={liveTrace} isActive={isStreaming} />
          ) : activeResult ? (
            /* 2. WHEN COMPLETED (FINAL/END): Pipeline hides and output dashboard shows! */
            <div className="flex flex-col h-full min-h-0 overflow-hidden animate-fade-in">
              {/* Executive Summary Card */}
              {activeResult.analysis_summary && (
                <div className="flex-shrink-0 p-5 border-b border-slate-200/80 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30 backdrop-blur-sm">
                  <div className="insight-card">
                    <div className="flex items-start gap-3.5">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/15 dark:bg-indigo-500/25 flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h2 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                            Executive Insight
                          </h2>
                          <div className="flex items-center gap-2.5">
                            {/* Audio Explanation Button */}
                            <button
                              id="speak-executive-summary"
                              onClick={handleToggleSpeechSummary}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold transition-all ${
                                isSpeakingSummary
                                  ? "bg-rose-500 text-white shadow-sm shadow-rose-500/30 animate-pulse"
                                  : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/60"
                              }`}
                              title={isSpeakingSummary ? "Stop Voice Explanation" : "Listen to Explanation (Audio)"}
                            >
                              {isSpeakingSummary ? (
                                <>
                                  <VolumeX className="w-3.5 h-3.5" />
                                  <span>Stop Audio</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3.5 h-3.5" />
                                  <span>Listen</span>
                                </>
                              )}
                            </button>

                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              <span className="text-slate-900 dark:text-slate-200 font-bold">
                                {activeResult.row_count.toLocaleString()}
                              </span>{" "}
                              rows returned
                            </span>
                            {activeResult.retry_count > 0 && (
                              <span className="badge badge-amber text-[10px]">
                                {activeResult.retry_count} self-heal{activeResult.retry_count > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-slate-800 dark:text-slate-200 text-sm leading-relaxed font-normal">
                          {activeResult.analysis_summary}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* View Tabs */}
              <div className="flex-shrink-0 flex items-center justify-between px-5 pt-3 pb-0 border-b border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
                <div className="flex items-center gap-1">
                  <button
                    id="tab-chart"
                    onClick={() => setRightTab("chart")}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
                      rightTab === "chart"
                        ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Visualisation</span>
                  </button>
                  <button
                    id="tab-table"
                    onClick={() => setRightTab("table")}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-t-xl border-b-2 transition-all ${
                      rightTab === "table"
                        ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40"
                        : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Data Table</span>
                    <span className="text-[10px] font-normal opacity-70">
                      ({activeResult.row_count.toLocaleString()})
                    </span>
                  </button>
                </div>

                {/* Right Tab Controls: Export PDF Report & Overview */}
                <div className="flex items-center gap-2 pb-1">
                  <button
                    id="download-pdf-report-btn"
                    onClick={handleDownloadPdf}
                    disabled={isExportingPdf}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/80 dark:border-indigo-800/60 transition-all shadow-sm disabled:opacity-50"
                    title="Download Executive PDF Report with Visualisation"
                  >
                    {isExportingPdf ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating PDF…</span>
                      </>
                    ) : (
                      <>
                        <FileDown className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Export PDF Report</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setActiveResult(null)}
                    className="text-xs text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 inline-flex items-center gap-1 transition-colors font-medium ml-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Overview</span>
                  </button>
                </div>
              </div>

              {/* Tab Content Panel */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {rightTab === "chart" && (
                  <ChartRenderer
                    spec={activeResult.chart_spec}
                    sql={activeResult.generated_sql}
                    theme={theme}
                  />
                )}
                {rightTab === "table" && (
                  <DataTable rows={activeResult.query_result} />
                )}
              </div>
            </div>
          ) : (
            /* 3. INITIAL STATE: Clean Welcome Canvas with Clickable Action Cards (No idle/confusing table boxes) */
            <WelcomeCanvas onSelectQuery={handleSubmit} theme={theme} />
          )}
        </div>
      </div>
    </div>
  );
}
