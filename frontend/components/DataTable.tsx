"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Download,
  Search,
} from "lucide-react";

interface DataTableProps {
  rows: Record<string, unknown>[];
  pageSize?: number;
}

type SortConfig = { key: string; direction: "asc" | "desc" } | null;

// ── Cell formatter ────────────────────────────────────────────────────────────

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const str = String(value);
  return str.length > 80 ? str.slice(0, 77) + "…" : str;
}

// ── Cell value classifier for colouring ──────────────────────────────────────

function cellClass(value: unknown): string {
  if (value === null || value === undefined)
    return "text-slate-400 dark:text-slate-600 italic";
  if (typeof value === "number")
    return "text-indigo-600 dark:text-cyan-300 font-mono tabular-nums font-medium";
  if (typeof value === "boolean")
    return value ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-600 dark:text-rose-400 font-medium";
  return "text-slate-800 dark:text-slate-200";
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv(columns: string[], rows: Record<string, unknown>[]) {
  const header = columns.join(",");
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = row[col];
          const str = val === null || val === undefined ? "" : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "datamind_export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DataTable({ rows, pageSize = 50 }: DataTableProps) {
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [filterText, setFilterText] = useState("");

  const columns = useMemo(() => {
    if (!rows.length) return [];
    return Object.keys(rows[0]);
  }, [rows]);

  // Client search filter
  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows;
    const lower = filterText.toLowerCase();
    return rows.filter((r) =>
      columns.some((c) => {
        const val = r[c];
        return val !== null && val !== undefined && String(val).toLowerCase().includes(lower);
      })
    );
  }, [rows, columns, filterText]);

  // Sort
  const sortedRows = useMemo(() => {
    if (!sortConfig) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp =
        typeof aVal === "number" && typeof bVal === "number"
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortConfig]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (col: string) => {
    setSortConfig((prev) => {
      if (prev?.key === col) {
        return prev.direction === "asc" ? { key: col, direction: "desc" } : null;
      }
      return { key: col, direction: "asc" };
    });
    setPage(1);
  };

  if (!rows.length) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        No results to display
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 transition-colors">
      {/* ── Toolbar ── */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Showing{" "}
            <span className="text-slate-900 dark:text-slate-200 font-semibold">
              {filteredRows.length > 0 ? (page - 1) * pageSize + 1 : 0}–
              {Math.min(page * pageSize, filteredRows.length).toLocaleString()}
            </span>{" "}
            of{" "}
            <span className="text-slate-900 dark:text-slate-200 font-semibold">
              {filteredRows.length.toLocaleString()}
            </span>{" "}
            rows {filteredRows.length !== rows.length && `(filtered from ${rows.length.toLocaleString()})`}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search box */}
          <div className="relative flex-1 sm:w-52">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search table…"
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <button
            id="export-csv-btn"
            onClick={() => exportCsv(columns, sortedRows)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            <Download className="w-3 h-3 text-indigo-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── Table Content ── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100/80 dark:bg-slate-900 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 shadow-sm backdrop-blur">
            <tr>
              {columns.map((col) => (
                <th key={col} className="py-2.5 px-4 whitespace-nowrap">
                  <button
                    id={`sort-col-${col}`}
                    onClick={() => toggleSort(col)}
                    className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-mono uppercase tracking-wider text-[11px]"
                  >
                    <span>{col}</span>
                    <ArrowUpDown
                      className={`w-3 h-3 flex-shrink-0 ${
                        sortConfig?.key === col
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-400"
                      }`}
                    />
                    {sortConfig?.key === col && (
                      <span className="text-indigo-600 dark:text-indigo-400">
                        {sortConfig.direction === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {currentRows.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className={`py-2 px-4 whitespace-nowrap max-w-[240px] truncate ${cellClass(row[col])}`}
                    title={String(row[col] ?? "")}
                  >
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination Footer ── */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
          <span className="text-slate-500 dark:text-slate-400 text-[11px]">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-slate-700 dark:text-slate-300 font-semibold font-mono text-[11px]">
              {page}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="p-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
