"use client";

import {
  Sparkles,
  TrendingUp,
  Users,
  CreditCard,
  LifeBuoy,
  ArrowRight,
  Database,
  ShieldCheck,
  Cpu,
  BarChart2,
  CheckCircle2,
} from "lucide-react";

interface WelcomeCanvasProps {
  onSelectQuery: (query: string) => void;
  theme: "dark" | "light";
}

interface ActionPrompt {
  id: string;
  category: string;
  title: string;
  query: string;
  chartType: string;
  icon: typeof TrendingUp;
  gradient: string;
}

const ACTION_PROMPTS: ActionPrompt[] = [
  {
    id: "revenue-trend",
    category: "Revenue & Sales",
    title: "Monthly Revenue Trajectory",
    query: "Show me monthly revenue trends for the last 12 months",
    chartType: "Line / Bar Chart",
    icon: TrendingUp,
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    id: "category-volume",
    category: "Product Analytics",
    title: "Order Volume by Product Category",
    query: "Compare order volume and total revenue across product categories",
    chartType: "Categorical Bar Chart",
    icon: BarChart2,
    gradient: "from-cyan-500 to-teal-600",
  },
  {
    id: "customer-ltv",
    category: "Customer Insights",
    title: "Customer Segment Lifetime Value",
    query: "Which customer segments generate the highest lifetime value and average spend?",
    chartType: "Comparative Bar Chart",
    icon: Users,
    gradient: "from-purple-500 to-indigo-600",
  },
  {
    id: "churn-analysis",
    category: "Subscriptions & MRR",
    title: "Subscription Churn Rate by Plan",
    query: "What is the average subscription churn rate across different plans?",
    chartType: "Percentage Metric Chart",
    icon: CreditCard,
    gradient: "from-amber-500 to-rose-600",
  },
  {
    id: "support-csat",
    category: "Support Operations",
    title: "Support CSAT vs Resolution Time",
    query: "Analyze support ticket resolution time and average CSAT score by priority",
    chartType: "Multi-Axis Chart",
    icon: LifeBuoy,
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    id: "active-countries",
    category: "Geographic Expansion",
    title: "Global Distribution of Active Users",
    query: "What countries have the highest count of active registered customers?",
    chartType: "Geographic Distribution",
    icon: Users,
    gradient: "from-indigo-500 to-cyan-600",
  },
];

export default function WelcomeCanvas({ onSelectQuery }: WelcomeCanvasProps) {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-5 sm:p-6 space-y-5">
      {/* ── Refined Modern Header: Clean, balanced, never clipped ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border bg-white/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Intelligent Natural Language Analytics
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Connected
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ask questions in plain English · Auto SQL generation · Interactive visual charts
            </p>
          </div>
        </div>

        {/* Database & Security Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <Database className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>SQLite Connected</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Read-Only Guardrails</span>
          </div>
        </div>
      </div>

      {/* ── Interactive Starter Query Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Interactive Starter Analytics
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Click any question below to immediately run the live query and generate visuals:
            </p>
          </div>
          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hidden sm:inline">
            Click to execute →
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {ACTION_PROMPTS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.id}
                id={`starter-query-${card.id}`}
                onClick={() => onSelectQuery(card.query)}
                className="group text-left p-4 rounded-2xl border transition-all duration-200 bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/60 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white shadow-sm`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                      {card.chartType}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    {card.category}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                    {card.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                    &ldquo;{card.query}&rdquo;
                  </p>
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 font-medium">
                  <span>Run Analysis</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── System Pipeline Architecture Highlights ── */}
      <div className="p-4 rounded-2xl border bg-white/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-2.5">
          <Cpu className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Autonomous Multi-Agent Pipeline
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/80">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-500" />
              1. Schema Pruning
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Discovers table relationships and filters out irrelevant database columns.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/80">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
              2. SQL Synthesis
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Generates SQLite-compliant queries using multi-key rotation and zero downtime.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/80">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              3. Safety & Healing
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Enforces read-only AST rules and automatically heals SQL syntax errors in a loop.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/80">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
              4. Visual Insights
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Renders responsive Plotly charts with full screen expandability and executive takeaways.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
