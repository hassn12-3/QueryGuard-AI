"""
nodes/insight_synthesizer.py – synthesize_insights_node

Produces an executive plain-English summary, key takeaways, and a default
Plotly chart specification when no advanced analysis was run.

Also detects optimal chart type from the data shape and column types.
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import SystemMessage, HumanMessage

from app.state import AgentState, TraceStep
from app.config import settings


# ── Prompt ────────────────────────────────────────────────────────────────────

SYNTHESIS_SYSTEM_PROMPT = """You are a senior data analyst. Given a user's question, the SQL used to answer it, and the query results, produce:

1. An executive summary (2–4 sentences) explaining the key finding in plain English for a business audience.
2. A JSON object containing a Plotly figure specification that best visualises the data.

Your response MUST be valid JSON with this exact structure:
{
  "summary": "Executive summary text here...",
  "chart_spec": {
    "data": [...],
    "layout": {...}
  }
}

Chart guidelines:
- For time series or trends: use 'scatter' with mode='lines+markers'
- For comparisons across categories: use 'bar'
- For distributions: use 'histogram' or 'box'
- For proportions: use 'pie'
- For correlations: use 'scatter' with mode='markers'
- Always include meaningful title, axis labels, and a clean layout
- Use a dark theme: plot_bgcolor='#0f172a', paper_bgcolor='#0f172a', font.color='#e2e8f0'
- Use vibrant accent colors: '#6366f1' (indigo), '#22d3ee' (cyan), '#f59e0b' (amber)
- Return ONLY the JSON object, no markdown, no explanation.
"""

SYNTHESIS_HUMAN_TEMPLATE = """User Question: {query}

SQL Used:
{sql}

Query Results (first 20 rows):
{sample_data}

Total Rows: {row_count}
Columns: {columns}

Generate the executive summary and Plotly chart specification."""


# ── Auto chart for simple queries ─────────────────────────────────────────────

def _build_fallback_chart(rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    """
    Builds a simple Plotly chart spec from result rows without LLM.
    Used as a fallback if synthesis fails.
    """
    if not rows:
        return None

    columns = list(rows[0].keys())
    if len(columns) < 2:
        return None

    x_col = columns[0]
    y_col = columns[1]

    x_vals = [str(r.get(x_col, "")) for r in rows]
    y_vals = [r.get(y_col) for r in rows]

    return {
        "data": [
            {
                "type": "bar",
                "x": x_vals,
                "y": y_vals,
                "marker": {"color": "#6366f1"},
                "name": str(y_col),
            }
        ],
        "layout": {
            "title": {"text": f"{y_col} by {x_col}", "font": {"color": "#e2e8f0"}},
            "xaxis": {"title": str(x_col), "tickfont": {"color": "#94a3b8"}},
            "yaxis": {"title": str(y_col), "tickfont": {"color": "#94a3b8"}},
            "plot_bgcolor": "#0f172a",
            "paper_bgcolor": "#0f172a",
            "font": {"color": "#e2e8f0"},
        },
    }


# ── Node function ─────────────────────────────────────────────────────────────

def synthesize_insights_node(state: AgentState) -> dict:
    """
    LangGraph node: synthesize_insights_node

    - If advanced analysis already produced chart_spec and analysis_summary,
      merges them with the query result.
    - Otherwise, calls the LLM to generate a summary and chart spec from raw data.
    """
    rows = state.get("query_result", [])
    existing_chart = state.get("chart_spec")
    existing_summary = state.get("analysis_summary", "")

    # If advanced analysis already delivered everything, just confirm synthesis
    if existing_chart and existing_summary:
        trace_step: TraceStep = {
            "node": "synthesize_insights_node",
            "message": "Insights merged from advanced analysis output",
            "status": "done",
        }
        return {
            "trace_steps": state.get("trace_steps", []) + [trace_step],
        }

    # ── LLM-powered synthesis ─────────────────────────────────────────────────
    columns = list(rows[0].keys()) if rows else []
    sample_rows = rows[:20]

    llm = settings.get_llm(temperature=0.2)

    human_content = SYNTHESIS_HUMAN_TEMPLATE.format(
        query=state["user_query"],
        sql=state.get("generated_sql", "N/A"),
        sample_data=json.dumps(sample_rows, default=str, indent=2),
        row_count=len(rows),
        columns=columns,
    )

    messages = [
        SystemMessage(content=SYNTHESIS_SYSTEM_PROMPT),
        HumanMessage(content=human_content),
    ]

    chart_spec: dict[str, Any] | None = None
    summary = ""

    try:
        response = llm.invoke(messages)
        raw = response.content if hasattr(response, "content") else str(response)
        raw_str = str(raw).strip()

        # Strip code fences
        import re
        raw_str = re.sub(r"```(?:json)?\s*", "", raw_str, flags=re.IGNORECASE)
        raw_str = raw_str.replace("```", "").strip()

        parsed = json.loads(raw_str)
        summary = parsed.get("summary", "")
        chart_spec = parsed.get("chart_spec")

    except Exception as exc:
        # Graceful fallback
        summary = (
            f"Query returned {len(rows):,} rows across {len(columns)} columns. "
            f"Review the data table below for detailed results."
        )
        chart_spec = _build_fallback_chart(rows)

    trace_step = {
        "node": "synthesize_insights_node",
        "message": (
            f"Insights synthesised — summary ready, "
            f"chart {'generated' if chart_spec else 'unavailable'}"
        ),
        "status": "done",
    }

    return {
        "analysis_summary": summary,
        "chart_spec": chart_spec,
        "trace_steps": state.get("trace_steps", []) + [trace_step],
    }
