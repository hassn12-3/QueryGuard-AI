"""
nodes/sql_generator.py – generate_sql_node

Translates a plain-English query into a SQLite-dialect SQL SELECT statement
using the LLM. When `sql_error` is non-empty (self-healing mode), the error
message is appended to the prompt so the LLM can correct its previous attempt.
"""

from __future__ import annotations

import re
from langchain_core.messages import SystemMessage, HumanMessage

from app.state import AgentState, TraceStep
from app.config import settings


# ── Prompt templates ──────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are an expert SQLite query generator. Your task is to translate natural language questions into precise, efficient SQLite SQL queries.

Rules:
1. Generate ONLY a single SELECT statement. Never use INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, or any DDL/DML.
2. Use only the tables and columns present in the provided schema.
3. Always use table aliases for joins (e.g., c for customers, o for orders).
4. Use proper SQLite date functions: date(), strftime(), julianday().
5. For aggregations, always include a GROUP BY clause for non-aggregated columns.
6. Do NOT include a LIMIT clause — the system will add one automatically.
7. Write clean, readable SQL with proper indentation.
8. Return ONLY the raw SQL query with no markdown, no code fences, no explanation.
9. If the question is ambiguous, make reasonable assumptions and generate the best possible query.
10. For date ranges, use ISO 8601 format (YYYY-MM-DD).
"""

HUMAN_PROMPT_TEMPLATE = """Database Schema:
{schema}

User Question:
{query}

Generate a SQLite SELECT query to answer this question."""

SELF_HEALING_SUFFIX = """

IMPORTANT — Previous Attempt Failed:
The SQL query you generated previously produced the following error:
  {error}

Previous (broken) SQL:
  {broken_sql}

Please analyse the error carefully and generate a corrected SQL query. Do NOT repeat the same mistake."""


# ── SQL extraction ────────────────────────────────────────────────────────────

def _extract_sql(raw: str) -> str:
    """
    Strips markdown code fences and whitespace from the LLM response,
    returning a clean SQL string.
    """
    # Remove ```sql ... ``` or ``` ... ```
    raw = re.sub(r"```(?:sql)?\s*", "", raw, flags=re.IGNORECASE)
    raw = raw.replace("```", "").strip()

    # If the LLM prefixed with "SQL:" or "Query:"
    raw = re.sub(r"^(SQL|Query|Answer)\s*:\s*", "", raw, flags=re.IGNORECASE)

    return raw.strip()


# ── Node function ─────────────────────────────────────────────────────────────

def generate_sql_node(state: AgentState) -> dict:
    """
    LangGraph node: generate_sql_node

    Calls the LLM to generate SQLite SQL from the user's natural language query.
    In self-healing mode, includes the previous error for correction context.
    """
    llm = settings.get_llm(temperature=0.0)

    human_content = HUMAN_PROMPT_TEMPLATE.format(
        schema=state["relevant_schema"],
        query=state["user_query"],
    )

    # Append error context in self-healing mode
    if state.get("sql_error") and state.get("generated_sql"):
        human_content += SELF_HEALING_SUFFIX.format(
            error=state["sql_error"],
            broken_sql=state["generated_sql"],
        )

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=human_content),
    ]

    response = llm.invoke(messages)
    raw_sql = response.content if hasattr(response, "content") else str(response)
    clean_sql = _extract_sql(str(raw_sql))

    retry = state.get("retry_count", 0)
    is_retry = bool(state.get("sql_error"))
    if is_retry:
        retry += 1

    trace_step: TraceStep = {
        "node": "generate_sql_node",
        "message": (
            f"SQL generated (attempt {retry + 1})"
            if not is_retry
            else f"Self-healing iteration {retry} — regenerated SQL after error: {state['sql_error'][:80]}"
        ),
        "status": "done",
    }

    return {
        "generated_sql": clean_sql,
        "sql_error": "",          # Reset error; validator will set it again if needed
        "retry_count": retry,
        "trace_steps": state.get("trace_steps", []) + [trace_step],
    }
