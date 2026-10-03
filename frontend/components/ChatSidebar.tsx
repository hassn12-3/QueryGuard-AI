"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Square,
  ChevronDown,
  Code2,
  User,
  Bot,
  Sparkles,
  TrendingUp,
  Users,
  CreditCard,
  LifeBuoy,
  CornerDownLeft,
} from "lucide-react";
import type { Message } from "@/app/page";

interface ChatSidebarProps {
  messages: Message[];
  isStreaming: boolean;
  onSubmit: (query: string) => void;
  onStop: () => void;
  theme?: "dark" | "light";
}

// ── Categorized Suggested Queries (Exclusively inside Chat) ───────────────────

interface QueryCategory {
  id: string;
  name: string;
  icon: typeof TrendingUp;
  queries: string[];
}

const CATEGORIES: QueryCategory[] = [
  {
    id: "revenue",
    name: "Revenue & Sales",
    icon: TrendingUp,
    queries: [
      "Show monthly revenue trends for the last 12 months",
      "Compare order volume across product categories",
      "Show top 10 customers by total spending",
    ],
  },
  {
    id: "customers",
    name: "Customer LTV",
    icon: Users,
    queries: [
      "Which customer segments generate the highest lifetime value?",
      "What countries have the most active customers?",
      "List customer count and avg lifetime value by country",
    ],
  },
  {
    id: "subscriptions",
    name: "Subscriptions & MRR",
    icon: CreditCard,
    queries: [
      "What is the average subscription churn rate by plan?",
      "Calculate current monthly recurring revenue (MRR) by plan",
      "Compare active vs cancelled subscriptions",
    ],
  },
  {
    id: "support",
    name: "Support & Quality",
    icon: LifeBuoy,
    queries: [
      "Analyze support ticket resolution time by priority",
      "What are the most common support ticket categories?",
      "Show average CSAT score by support category",
    ],
  },
];

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const [showSql, setShowSql] = useState(false);
  const isUser = message.role === "user";

  return (
    <div className={`animate-fade-in flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400"
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      {/* Bubble Content */}
      <div className={`max-w-[88%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed transition-colors ${
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm shadow-md shadow-indigo-600/10 font-medium"
              : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm max-h-[380px] overflow-y-auto"
          }`}
        >
          {message.isStreaming && !message.content ? (
            <div className="flex gap-1.5 items-center py-1">
              <span className="w-2 h-2 bg-indigo-500 dark:bg-cyan-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-indigo-500 dark:bg-cyan-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-indigo-500 dark:bg-cyan-400 rounded-full animate-bounce [animation-delay:300ms]" />
              <span className="text-xs font-normal text-slate-500 ml-1.5">Analyzing schema & generating SQL…</span>
            </div>
          ) : (
            <div className="whitespace-pre-wrap">{message.content}</div>
          )}
        </div>

        {/* Result Metadata Badge & SQL View */}
        {message.result && (
          <div className="flex flex-wrap items-center gap-2 px-1 mt-0.5">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700/50">
              {message.result.row_count.toLocaleString()} rows
            </span>
            {message.result.retry_count > 0 && (
              <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                {message.result.retry_count} self-heal
              </span>
            )}
            {message.result.generated_sql && (
              <button
                id={`toggle-sql-${message.id}`}
                onClick={() => setShowSql((v) => !v)}
                className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
              >
                <Code2 className="w-3 h-3" />
                {showSql ? "Hide SQL" : "View SQL"}
                <ChevronDown className={`w-3 h-3 transition-transform ${showSql ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
        )}

        {/* Inline SQL Viewer */}
        {showSql && message.result?.generated_sql && (
          <div className="w-full animate-fade-in mt-1">
            <pre className="p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[11px] leading-relaxed max-h-44 overflow-auto border border-slate-800">
              {message.result.generated_sql}
            </pre>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChatSidebar({
  messages,
  isStreaming,
  onSubmit,
  onStop,
}: ChatSidebarProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("revenue");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Smooth scroll contained strictly inside the chat container so screen position is never shifted
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !isStreaming) {
        e.preventDefault();
        if (query.trim()) {
          onSubmit(query.trim());
          setQuery("");
        }
      }
    },
    [query, isStreaming, onSubmit]
  );

  const handleSend = useCallback(() => {
    if (query.trim() && !isStreaming) {
      onSubmit(query.trim());
      setQuery("");
    }
  }, [query, isStreaming, onSubmit]);

  const handleSelectSuggested = useCallback(
    (q: string) => {
      if (!isStreaming) {
        onSubmit(q);
      }
    },
    [isStreaming, onSubmit]
  );

  const selectedCategory = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];

  return (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-slate-950 transition-colors duration-200 overflow-hidden">
      {/* ── Console Header ── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Assistant Chat
          </h2>
        </div>
      </div>

      {/* ── Messages & Fresh State Area: Strict Internal Scroll (No outer page jump) ── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4"
      >
        {messages.length === 0 ? (
          /* Empty Chat Welcome with Categorized Suggestions */
          <div className="py-2 space-y-4 animate-fade-in">
            <div className="text-center py-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Ask Questions in Plain English
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                Select a sample query below or type your own question in the box.
              </p>
            </div>

            {/* Category Pills */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => {
                const isSelected = cat.id === activeCategory;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                        : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Selected Category Query Buttons */}
            <div className="space-y-2 pt-1">
              {selectedCategory.queries.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSelectSuggested(q)}
                  className="w-full text-left p-3 rounded-xl border transition-all duration-150 flex items-start justify-between gap-2 group bg-slate-50/70 hover:bg-indigo-50/60 dark:bg-slate-900/40 dark:hover:bg-indigo-950/30 border-slate-200/80 hover:border-indigo-300 dark:border-slate-800 dark:hover:border-indigo-500/40"
                >
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 leading-relaxed">
                    {q}
                  </span>
                  <CornerDownLeft className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 flex-shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
      </div>

      {/* ── Chat Input Area ── */}
      <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-lg">
        {/* Quick prompt suggestions chip strip when chat is active */}
        {messages.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-none">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex-shrink-0 mr-1">
              Suggestions:
            </span>
            {selectedCategory.queries.slice(0, 2).map((q) => (
              <button
                key={q}
                onClick={() => handleSelectSuggested(q)}
                className="flex-shrink-0 text-[11px] px-2.5 py-1 rounded-full border bg-slate-100 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 border-slate-200 dark:border-slate-800 truncate max-w-[200px]"
                title={q}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            id="query-input"
            className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all resize-none min-h-[44px] max-h-[120px]"
            placeholder="Ask a question about customers, orders, subscriptions… (Enter to send)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            rows={1}
          />

          {isStreaming ? (
            <button
              id="stop-button"
              onClick={onStop}
              className="flex-shrink-0 w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 hover:bg-rose-500/25 transition-all shadow-sm"
              title="Stop Query"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              id="send-button"
              onClick={handleSend}
              disabled={!query.trim()}
              className="flex-shrink-0 w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2 px-1">
          <span>{isStreaming ? "Generating answer…" : "Ready"}</span>
          <span>Shift+Enter for newline</span>
        </div>
      </div>
    </div>
  );
}
