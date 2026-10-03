"""
state.py – LangGraph shared state definition.

All nodes read from and write to AgentState. The TypedDict approach
gives us strong typing while remaining compatible with LangGraph's
state-reducer machinery.
"""

from __future__ import annotations

from typing import Any, Optional
from typing_extensions import TypedDict


class TraceStep(TypedDict):
    node: str
    message: str
    status: str  # "running" | "done" | "error"


class AgentState(TypedDict):
    # ── Input ────────────────────────────────────────────────────────────────
    user_query: str

    # ── Schema retrieval ─────────────────────────────────────────────────────
    relevant_schema: str  # Pruned DDL injected into the SQL generation prompt

    # ── SQL lifecycle ────────────────────────────────────────────────────────
    generated_sql: str
    sql_error: str       # Non-empty triggers self-healing retry
    retry_count: int

    # ── Execution result ─────────────────────────────────────────────────────
    query_result: list[dict[str, Any]]

    # ── Advanced analytics ───────────────────────────────────────────────────
    needs_advanced_analysis: bool
    analysis_code: str         # Python code executed in the sandbox
    analysis_summary: str      # Executive plain-English summary

    # ── Visualisation ────────────────────────────────────────────────────────
    chart_spec: Optional[dict[str, Any]]  # Plotly JSON spec

    # ── Observability ────────────────────────────────────────────────────────
    trace_steps: list[TraceStep]
