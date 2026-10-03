"""
nodes/db_executor.py – execute_sql_node

Executes the validated SQL against the local SQLite database.
Catches runtime errors and routes them back to the generator for self-healing.
Also decides whether advanced analytics is needed based on row count and query type.
"""

from __future__ import annotations

import re
import sqlite3
from typing import Any

from app.state import AgentState, TraceStep
from app.db.connection import get_connection


# ── Advanced analysis detection ───────────────────────────────────────────────

_ANALYSIS_KEYWORDS = re.compile(
    r"\b(correlation|forecast|predict|regression|trend|anomaly|outlier|"
    r"hypothesis|statistical|significance|distribution|variance|std(?:dev)?|"
    r"coefficient|cluster|segment|classify|anova|chi.?square|t.?test|"
    r"p.?value|confidence)\b",
    re.IGNORECASE,
)


def _needs_advanced_analysis(query: str, row_count: int) -> bool:
    """
    Returns True when the user query contains advanced analytics keywords
    and the result set has enough rows to analyse (≥ 5).
    """
    return bool(_ANALYSIS_KEYWORDS.search(query)) and row_count >= 5


# ── Node function ─────────────────────────────────────────────────────────────

def execute_sql_node(state: AgentState) -> dict:
    """
    LangGraph node: execute_sql_node

    1. Executes the validated SQL against SQLite.
    2. On success: returns rows as list[dict] and checks for advanced analysis.
    3. On failure: populates sql_error for self-healing retry.
    """
    sql = state.get("generated_sql", "").strip()
    retry_count = state.get("retry_count", 0)

    if not sql:
        trace_step: TraceStep = {
            "node": "execute_sql_node",
            "message": "Execution skipped: no SQL to execute",
            "status": "error",
        }
        return {
            "sql_error": "No SQL available for execution.",
            "query_result": [],
            "trace_steps": state.get("trace_steps", []) + [trace_step],
        }

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(sql)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        raw_rows = cursor.fetchall()
        conn.close()

        # Convert to list of dicts for JSON-serialisability
        rows: list[dict[str, Any]] = [
            dict(zip(columns, row)) for row in raw_rows
        ]

        needs_advanced = _needs_advanced_analysis(state["user_query"], len(rows))

        trace_step = {
            "node": "execute_sql_node",
            "message": (
                f"Query executed successfully — {len(rows):,} rows returned"
                + (" → advanced analysis queued" if needs_advanced else "")
            ),
            "status": "done",
        }

        return {
            "query_result": rows,
            "sql_error": "",
            "needs_advanced_analysis": needs_advanced,
            "trace_steps": state.get("trace_steps", []) + [trace_step],
        }

    except sqlite3.OperationalError as exc:
        error_msg = str(exc)
        trace_step = {
            "node": "execute_sql_node",
            "message": f"SQLite OperationalError: {error_msg[:120]}",
            "status": "error",
        }
        return {
            "sql_error": f"SQLite OperationalError: {error_msg}",
            "query_result": [],
            "needs_advanced_analysis": False,
            "retry_count": retry_count,
            "trace_steps": state.get("trace_steps", []) + [trace_step],
        }

    except sqlite3.Error as exc:
        error_msg = str(exc)
        trace_step = {
            "node": "execute_sql_node",
            "message": f"Database error: {error_msg[:120]}",
            "status": "error",
        }
        return {
            "sql_error": f"Database error: {error_msg}",
            "query_result": [],
            "needs_advanced_analysis": False,
            "retry_count": retry_count,
            "trace_steps": state.get("trace_steps", []) + [trace_step],
        }

    except Exception as exc:
        error_msg = str(exc)
        trace_step = {
            "node": "execute_sql_node",
            "message": f"Unexpected execution error: {error_msg[:120]}",
            "status": "error",
        }
        return {
            "sql_error": f"Unexpected error during execution: {error_msg}",
            "query_result": [],
            "needs_advanced_analysis": False,
            "retry_count": retry_count,
            "trace_steps": state.get("trace_steps", []) + [trace_step],
        }
