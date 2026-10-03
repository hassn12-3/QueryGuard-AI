"use client";

import { useState } from "react";
import {
  Database,
  Users,
  ShoppingCart,
  CreditCard,
  LifeBuoy,
  Key,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  ArrowRight,
  Search,
} from "lucide-react";

interface DatabaseOverviewProps {
  onSelectQuery: (query: string) => void;
  theme: "dark" | "light";
}

interface TableSchema {
  name: string;
  icon: typeof Users;
  color: string;
  badgeColor: string;
  rowCount: string;
  description: string;
  columns: { name: string; type: string; isPk?: boolean; isFk?: boolean; note?: string }[];
  exampleQueries: string[];
}

const SCHEMA_DATA: TableSchema[] = [
  {
    name: "customers",
    icon: Users,
    color: "from-blue-500 to-indigo-600",
    badgeColor: "bg-blue-500/10 text-blue-500 border-blue-500/20 dark:text-blue-400",
    rowCount: "500 records",
    description: "Profiles of registered users including company segment, country, and lifetime spend.",
    columns: [
      { name: "customer_id", type: "INTEGER", isPk: true, note: "Primary Key" },
      { name: "first_name", type: "TEXT" },
      { name: "last_name", type: "TEXT" },
      { name: "email", type: "TEXT", note: "Unique" },
      { name: "country", type: "TEXT", note: "e.g. US, UK, DE" },
      { name: "segment", type: "TEXT", note: "SMB, Enterprise, Startup" },
      { name: "signup_date", type: "DATE" },
      { name: "is_active", type: "BOOLEAN", note: "1 = Active, 0 = Inactive" },
      { name: "lifetime_value", type: "REAL", note: "Total monetary value" },
    ],
    exampleQueries: [
      "Which customer segments generate the highest lifetime value?",
      "What countries have the most active customers?",
    ],
  },
  {
    name: "orders",
    icon: ShoppingCart,
    color: "from-emerald-500 to-teal-600",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    rowCount: "4,049 records",
    description: "Historical transactions across 2 years with categories, order totals, and fulfillment status.",
    columns: [
      { name: "order_id", type: "INTEGER", isPk: true, note: "Primary Key" },
      { name: "customer_id", type: "INTEGER", isFk: true, note: "FK -> customers.customer_id" },
      { name: "order_date", type: "DATE" },
      { name: "amount", type: "REAL", note: "Order total in USD" },
      { name: "status", type: "TEXT", note: "Completed, Pending, Refunded" },
      { name: "product_category", type: "TEXT", note: "Analytics, CRM, Security..." },
      { name: "payment_method", type: "TEXT", note: "Credit Card, PayPal, Wire" },
    ],
    exampleQueries: [
      "Show me monthly revenue trends for the last 12 months",
      "Compare order volume across product categories",
    ],
  },
  {
    name: "subscriptions",
    icon: CreditCard,
    color: "from-purple-500 to-indigo-600",
    badgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400",
    rowCount: "662 records",
    description: "SaaS recurring subscription plans (Starter, Professional, Business, Enterprise) with MRR metrics.",
    columns: [
      { name: "subscription_id", type: "INTEGER", isPk: true, note: "Primary Key" },
      { name: "customer_id", type: "INTEGER", isFk: true, note: "FK -> customers.customer_id" },
      { name: "plan", type: "TEXT", note: "Starter, Pro, Business, Enterprise" },
      { name: "monthly_price", type: "REAL", note: "$29 to $999/mo" },
      { name: "start_date", type: "DATE" },
      { name: "status", type: "TEXT", note: "Active, Cancelled, Paused" },
      { name: "churn_date", type: "DATE", note: "Nullable if active" },
    ],
    exampleQueries: [
      "What is the average subscription churn rate by plan?",
      "Calculate current monthly recurring revenue (MRR) by plan",
    ],
  },
  {
    name: "support_tickets",
    icon: LifeBuoy,
    color: "from-amber-500 to-orange-600",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
    rowCount: "856 records",
    description: "Customer service history with priority levels, resolution times, and customer satisfaction (CSAT) scores.",
    columns: [
      { name: "ticket_id", type: "INTEGER", isPk: true, note: "Primary Key" },
      { name: "customer_id", type: "INTEGER", isFk: true, note: "FK -> customers.customer_id" },
      { name: "category", type: "TEXT", note: "Billing, Tech, Feature, Bug" },
      { name: "priority", type: "TEXT", note: "Low, Medium, High, Critical" },
      { name: "status", type: "TEXT", note: "Open, Resolved, Closed" },
      { name: "created_at", type: "TIMESTAMP" },
      { name: "resolved_at", type: "TIMESTAMP" },
      { name: "csat_score", type: "INTEGER", note: "1 to 5 scale" },
    ],
    exampleQueries: [
      "Analyze support ticket resolution time by priority",
      "Show average CSAT score by support category",
    ],
  },
];

export default function DatabaseOverview({ onSelectQuery, theme }: DatabaseOverviewProps) {
  const [selectedTable, setSelectedTable] = useState<string>("customers");
  const [columnSearch, setColumnSearch] = useState("");

  const activeTable = SCHEMA_DATA.find((t) => t.name === selectedTable) || SCHEMA_DATA[0];

  const filteredColumns = activeTable.columns.filter((c) =>
    c.name.toLowerCase().includes(columnSearch.toLowerCase()) ||
    c.type.toLowerCase().includes(columnSearch.toLowerCase()) ||
    (c.note && c.note.toLowerCase().includes(columnSearch.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6">
      {/* ── Header & Status Card ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl border transition-all duration-200 bg-white/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Database className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Live Analytics Database
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Connected
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              4 Connected Business Tables · Real-Time Relational Data
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
            <Layers className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>4 Relational Tables</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Read-Only Protected</span>
          </div>
        </div>
      </div>

      {/* ── Table Selector Cards ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Relational Schema Tables
          </h3>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Select a table to inspect schema
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SCHEMA_DATA.map((t) => {
            const Icon = t.icon;
            const isSelected = t.name === selectedTable;
            return (
              <button
                key={t.name}
                id={`table-card-${t.name}`}
                onClick={() => setSelectedTable(t.name)}
                className={`text-left p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
                  isSelected
                    ? "bg-indigo-50/80 dark:bg-indigo-950/30 border-indigo-500 dark:border-indigo-500/60 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                    : "bg-white/80 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${t.color} flex items-center justify-center text-white shadow-sm`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${t.badgeColor}`}>
                    {t.rowCount}
                  </span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-mono">
                    {t.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {t.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active Table Detailed Schema Inspector ── */}
      <div className="rounded-2xl border bg-white/70 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
        {/* Table Details Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Columns in <span className="font-mono text-indigo-600 dark:text-indigo-400">{activeTable.name}</span>
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              ({activeTable.columns.length} columns)
            </span>
          </div>

          {/* Column Search Filter */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter columns..."
              value={columnSearch}
              onChange={(e) => setColumnSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Columns Grid / Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4">Column</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Key / Constraint</th>
                <th className="py-2.5 px-4">Details / Values</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredColumns.map((col) => (
                <tr key={col.name} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-2 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                    {col.name}
                  </td>
                  <td className="py-2 px-4">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {col.type}
                    </span>
                  </td>
                  <td className="py-2 px-4">
                    {col.isPk && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Key className="w-2.5 h-2.5" /> PRIMARY KEY
                      </span>
                    )}
                    {col.isFk && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                        FOREIGN KEY
                      </span>
                    )}
                    {!col.isPk && !col.isFk && (
                      <span className="text-slate-400 text-[11px]">—</span>
                    )}
                  </td>
                  <td className="py-2 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                    {col.note || "Standard attribute"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Multi-Agent Pipeline Architecture Info ── */}
      <div className="p-5 rounded-2xl border bg-gradient-to-br from-indigo-500/5 via-slate-50/50 to-cyan-500/5 dark:from-indigo-950/20 dark:via-slate-900/40 dark:to-cyan-950/20 border-slate-200/80 dark:border-slate-800">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            How DataMind Processes Your Questions
          </h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
              <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] flex items-center justify-center font-bold">1</span>
              Schema Pruner
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Analyzes question intent and retrieves relevant tables & foreign keys.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
              <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] flex items-center justify-center font-bold">2</span>
              SQL Synthesizer
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Generates high-precision SQL queries with automated multi-key load balancing.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] flex items-center justify-center font-bold">3</span>
              AST Safety & Auto-Heal
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Enforces read-only safety, verifies table access, and self-heals any query errors.
            </p>
          </div>
          <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 mb-1">
              <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 text-[10px] flex items-center justify-center font-bold">4</span>
              Visual Intelligence
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Synthesizes executive business takeaways and interactive Plotly visual charts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
