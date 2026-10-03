"""
nodes/schema_retriever.py – retrieve_schema_node

Inspects the local SQLite database, extracts full schema metadata, and
performs keyword-based relevance pruning so only tables/columns related
to the user query are injected into the SQL generation prompt.

This keeps the prompt concise, reduces hallucination, and speeds up
the LLM call.
"""

from __future__ import annotations

import re
from typing import Any

from app.state import AgentState, TraceStep
from app.db.connection import get_full_schema_structured


# ── Relevance scoring ─────────────────────────────────────────────────────────

_STOP_WORDS = frozenset(
    {
        "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "should",
        "could", "may", "might", "shall", "can", "need", "dare", "ought",
        "used", "get", "got", "me", "my", "we", "our", "you", "your", "he",
        "she", "it", "they", "them", "their", "this", "that", "these",
        "those", "i", "of", "in", "on", "at", "to", "for", "with", "by",
        "from", "up", "about", "into", "through", "during", "before",
        "after", "above", "below", "between", "show", "give", "list",
        "find", "get", "what", "how", "many", "much", "which", "where",
        "when", "who", "and", "or", "but", "not", "no", "all", "each",
        "every", "both", "few", "more", "most", "other", "some", "such",
        "than", "too", "very", "just", "because", "as", "until", "while",
    }
)


def _tokenise(text: str) -> set[str]:
    """Lower-cases and extracts alpha-numeric tokens, filtering stop words."""
    tokens = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", text.lower())
    return {t for t in tokens if t not in _STOP_WORDS and len(t) > 2}


def _score_table(
    query_tokens: set[str],
    table_name: str,
    columns: list[dict[str, Any]],
) -> int:
    """
    Returns a relevance score for a table given the query tokens.
    Scores are additive:
      +3 for an exact table name match
      +2 for a partial table name match
      +1 for each matching column name
    """
    score = 0
    table_lower = table_name.lower()

    for qt in query_tokens:
        if qt == table_lower:
            score += 3
        elif qt in table_lower or table_lower in qt:
            score += 2

    col_names = {col["name"].lower() for col in columns}
    for qt in query_tokens:
        for col in col_names:
            if qt == col:
                score += 1
            elif qt in col or col in qt:
                score += 1

    return score


# ── DDL formatter ─────────────────────────────────────────────────────────────

def _format_table_ddl(table_name: str, columns: list[dict[str, Any]]) -> str:
    """Formats table metadata as a compact DDL snippet."""
    col_lines = []
    for col in columns:
        nullable = "" if col["notnull"] else " -- nullable"
        pk_flag = " PRIMARY KEY" if col["pk"] else ""
        col_lines.append(
            f"    {col['name']} {col['type']}{pk_flag}{nullable}"
        )
    return f"CREATE TABLE {table_name} (\n" + ",\n".join(col_lines) + "\n);"


# ── Node function ─────────────────────────────────────────────────────────────

def retrieve_schema_node(state: AgentState) -> dict:
    """
    LangGraph node: retrieve_schema_node

    1. Fetches full schema from SQLite.
    2. Scores each table by relevance to the user query.
    3. Selects top-K tables (min 2, max 6) to include in the prompt.
    4. Returns the pruned DDL string in `relevant_schema`.
    """
    query = state["user_query"]
    query_tokens = _tokenise(query)

    schema_data = get_full_schema_structured()  # list[{table, columns, foreign_keys}]

    # Score all tables
    scored = []
    for table_info in schema_data:
        score = _score_table(query_tokens, table_info["table"], table_info["columns"])
        # Always include tables with score > 0; fall back to all if nothing matches
        scored.append((score, table_info))

    scored.sort(key=lambda x: x[0], reverse=True)

    # Select top tables (at least 2 if available, at most 6)
    top_tables = scored[:6] if len(scored) >= 6 else scored
    if all(s == 0 for s, _ in top_tables):
        # No signal from query → include all tables (schema is small)
        selected = [info for _, info in scored]
    else:
        # Take tables with score > 0, plus ensure at least 2
        selected = [info for score, info in scored if score > 0]
        if len(selected) < 2 and len(scored) >= 2:
            selected = [info for _, info in scored[:2]]

    # Build DDL string
    ddl_parts = []
    for table_info in selected:
        ddl_parts.append(
            _format_table_ddl(table_info["table"], table_info["columns"])
        )
        if table_info.get("foreign_keys"):
            fk_comments = []
            for fk in table_info["foreign_keys"]:
                fk_comments.append(
                    f"-- FK: {table_info['table']}.{fk['from']} → {fk['table']}.{fk['to']}"
                )
            ddl_parts.append("\n".join(fk_comments))

    relevant_schema = "\n\n".join(ddl_parts)

    trace_step: TraceStep = {
        "node": "retrieve_schema_node",
        "message": (
            f"Pruned schema to {len(selected)}/{len(schema_data)} tables "
            f"relevant to query: {[t['table'] for t in selected]}"
        ),
        "status": "done",
    }

    return {
        "relevant_schema": relevant_schema,
        "trace_steps": state.get("trace_steps", []) + [trace_step],
    }
