"""
nodes/advanced_analyzer.py – advanced_analysis_node

When the query requires statistical analysis, forecasting, or hypothesis testing,
this node:
  1. Asks the LLM to write a Python analysis script.
  2. Executes the script in the secure sandbox runner.
  3. Returns a structured Plotly JSON chart spec and an analysis summary.

The sandbox enforces a whitelist of safe modules (pandas, numpy, scipy,
statsmodels, plotly) and no filesystem or network access.
"""

from __future__ import annotations

import json
from typing import Any

from langchain_core.messages import SystemMessage, HumanMessage

from app.state import AgentState, TraceStep
from app.config import settings
from app.sandbox.runner import run_in_sandbox


# ── Prompt ────────────────────────────────────────────────────────────────────

ANALYSIS_SYSTEM_PROMPT = """You are an expert data scientist. Your task is to write a complete Python script that performs statistical analysis on a pandas DataFrame and produces a Plotly chart specification.

The script will be executed in a sandboxed environment that has access to:
  - pandas (as pd)
  - numpy (as np)
  - scipy (scipy.stats, scipy.signal)
  - statsmodels
  - plotly (plotly.graph_objects as go, plotly.express as px)

The script receives the data as a variable named `df` (already a pandas DataFrame).

REQUIREMENTS:
1. Perform the requested analysis (correlations, forecasting, hypothesis tests, etc.).
2. Create exactly one Plotly figure stored in a variable named `fig`.
3. Store the Plotly JSON spec in a variable named `chart_json` using:
   chart_json = fig.to_json()
4. Store a plain-English summary string in a variable named `summary` that describes:
   - What analysis was performed
   - Key statistical findings (with numbers)
   - Any notable patterns or recommendations
5. Do NOT include any print() statements.
6. Do NOT write to files or make network requests.
7. Import only from the allowed modules listed above.
8. Return ONLY raw Python code — no markdown, no code fences.
"""

ANALYSIS_HUMAN_TEMPLATE = """User Question: {query}

DataFrame columns: {columns}

DataFrame sample (first 5 rows):
{sample}

Total rows: {row_count}

Write a Python analysis script that answers this question with statistical rigour."""


# ── Node function ─────────────────────────────────────────────────────────────

def advanced_analysis_node(state: AgentState) -> dict:
    """
    LangGraph node: advanced_analysis_node

    Generates and sandboxed-executes a Python analytics script.
    Returns chart_spec (Plotly JSON) and analysis_summary.
    """
    import pandas as pd

    rows = state.get("query_result", [])
    if not rows:
        trace_step: TraceStep = {
            "node": "advanced_analysis_node",
            "message": "Skipped: no result data for analysis",
            "status": "done",
        }
        return {
            "analysis_summary": "No data available for advanced analysis.",
            "chart_spec": None,
            "analysis_code": "",
            "trace_steps": state.get("trace_steps", []) + [trace_step],
        }

    df = pd.DataFrame(rows)
    columns = list(df.columns)
    sample_str = df.head(5).to_string(index=False)

    llm = settings.get_llm(temperature=0.1)

    human_content = ANALYSIS_HUMAN_TEMPLATE.format(
        query=state["user_query"],
        columns=columns,
        sample=sample_str,
        row_count=len(rows),
    )

    messages = [
        SystemMessage(content=ANALYSIS_SYSTEM_PROMPT),
        HumanMessage(content=human_content),
    ]

    response = llm.invoke(messages)
    raw_code = response.content if hasattr(response, "content") else str(response)

    # Strip code fences if the LLM added them anyway
    import re
    raw_code = re.sub(r"```(?:python)?\s*", "", str(raw_code), flags=re.IGNORECASE)
    raw_code = raw_code.replace("```", "").strip()

    # ── Execute in sandbox ────────────────────────────────────────────────────
    sandbox_result = run_in_sandbox(code=raw_code, df=df)

    chart_spec: dict[str, Any] | None = None
    analysis_summary = ""

    if sandbox_result["success"]:
        # Parse Plotly JSON
        if sandbox_result.get("chart_json"):
            try:
                chart_spec = json.loads(sandbox_result["chart_json"])
            except (json.JSONDecodeError, TypeError):
                chart_spec = None

        analysis_summary = sandbox_result.get("summary", "Analysis completed.")

        trace_step = {
            "node": "advanced_analysis_node",
            "message": (
                f"Advanced analysis completed — "
                f"chart {'generated' if chart_spec else 'unavailable'}, "
                f"summary ready"
            ),
            "status": "done",
        }
    else:
        # Sandbox execution failed — degrade gracefully
        error = sandbox_result.get("error", "Unknown sandbox error")
        analysis_summary = (
            f"Advanced analysis could not be completed due to an execution error: {error}. "
            f"The raw query results are still available below."
        )
        trace_step = {
            "node": "advanced_analysis_node",
            "message": f"Sandbox execution failed: {error[:100]}",
            "status": "error",
        }

    return {
        "analysis_code": raw_code,
        "analysis_summary": analysis_summary,
        "chart_spec": chart_spec,
        "trace_steps": state.get("trace_steps", []) + [trace_step],
    }
