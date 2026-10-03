"""
nodes/sql_validator.py – validate_sql_node

Uses sqlglot to parse the SQL AST and enforces:
  1. Read-only: only SELECT statements are allowed.
  2. LIMIT injection: adds LIMIT 1000 if no LIMIT clause is present.
  3. Blocked statement detection: DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, TRUNCATE.
  4. Self-healing: sets sql_error on parse failure so the generator retries.
"""

from __future__ import annotations

import sqlglot
import sqlglot.expressions as exp

from app.state import AgentState, TraceStep
from app.config import settings

# ── Blocked statement types ───────────────────────────────────────────────────

_BLOCKED_TYPES = tuple(
    t for t in (
        exp.Drop,
        exp.Delete,
        exp.Update,
        exp.Insert,
        getattr(exp, "Alter", getattr(exp, "AlterTable", None)),
        exp.Create,
        exp.Command,   # catches TRUNCATE and other raw commands
    ) if t is not None
)

_BLOCKED_KEYWORDS = frozenset(
    {"drop", "delete", "update", "insert", "alter", "create", "truncate", "replace", "merge"}
)


def _contains_blocked_keyword(sql: str) -> bool:
    """Fast pre-check using keyword scan before AST parsing."""
    first_token = sql.strip().split()[0].lower() if sql.strip() else ""
    return first_token in _BLOCKED_KEYWORDS


def _has_limit(statement: exp.Expression) -> bool:
    """Returns True if the statement already contains a LIMIT clause."""
    return statement.find(exp.Limit) is not None


def _inject_limit(sql: str, limit: int) -> str:
    """
    Appends LIMIT <limit> to the SQL string.
    Handles trailing semicolons gracefully.
    """
    clean = sql.rstrip().rstrip(";").rstrip()
    return f"{clean}\nLIMIT {limit};"


# ── Node function ─────────────────────────────────────────────────────────────

def validate_sql_node(state: AgentState) -> dict:
    """
    LangGraph node: validate_sql_node

    Validates the generated SQL for safety and correctness.
    On any validation failure, sets `sql_error` to trigger self-healing.
    On success, returns the (possibly LIMIT-injected) SQL.
    """
    sql = state.get("generated_sql", "").strip()
    retry_count = state.get("retry_count", 0)

    if not sql:
        trace_step: TraceStep = {
            "node": "validate_sql_node",
            "message": "Validation failed: empty SQL received from generator",
            "status": "error",
        }
        return {
            "sql_error": "Generated SQL was empty.",
            "retry_count": retry_count,
            "trace_steps": state.get("trace_steps", []) + [trace_step],
        }

    # ── Fast keyword pre-check ────────────────────────────────────────────────
    if _contains_blocked_keyword(sql):
        trace_step = {
            "node": "validate_sql_node",
            "message": f"Validation failed: blocked statement type detected in: {sql[:60]}",
            "status": "error",
        }
        return {
            "sql_error": (
                f"Only SELECT statements are permitted. "
                f"The query begins with a disallowed keyword. "
                f"Rewrite as a SELECT statement."
            ),
            "retry_count": retry_count,
            "trace_steps": state.get("trace_steps", []) + [trace_step],
        }

    # ── AST parse ─────────────────────────────────────────────────────────────
    try:
        statements = sqlglot.parse(sql, dialect="sqlite", error_level=sqlglot.ErrorLevel.RAISE)
    except sqlglot.errors.ParseError as exc:
        trace_step = {
            "node": "validate_sql_node",
            "message": f"AST parse error: {str(exc)[:120]}",
            "status": "error",
        }
        return {
            "sql_error": f"SQL parse error: {str(exc)}. Fix the syntax and try again.",
            "retry_count": retry_count,
            "trace_steps": state.get("trace_steps", []) + [trace_step],
        }

    if not statements:
        trace_step = {
            "node": "validate_sql_node",
            "message": "Validation failed: parser returned no statements",
            "status": "error",
        }
        return {
            "sql_error": "Parser returned no statements. Ensure the SQL is a valid SELECT.",
            "retry_count": retry_count,
            "trace_steps": state.get("trace_steps", []) + [trace_step],
        }

    # ── Validate each statement ───────────────────────────────────────────────
    for statement in statements:
        if statement is None:
            continue

        # Block any non-SELECT statement
        if not isinstance(statement, exp.Select):
            stmt_type = type(statement).__name__
            trace_step = {
                "node": "validate_sql_node",
                "message": f"Blocked non-SELECT statement: {stmt_type}",
                "status": "error",
            }
            return {
                "sql_error": (
                    f"Statement type '{stmt_type}' is not allowed. "
                    f"Only SELECT queries are permitted."
                ),
                "retry_count": retry_count,
                "trace_steps": state.get("trace_steps", []) + [trace_step],
            }

        # Block dangerous expressions nested inside SELECT (e.g., subqueries with DELETE)
        for node in statement.walk():
            if isinstance(node, _BLOCKED_TYPES):
                node_type = type(node).__name__
                trace_step = {
                    "node": "validate_sql_node",
                    "message": f"Blocked dangerous nested expression: {node_type}",
                    "status": "error",
                }
                return {
                    "sql_error": (
                        f"Dangerous expression '{node_type}' found inside SELECT. "
                        f"Remove it and return a safe read-only query."
                    ),
                    "retry_count": retry_count,
                    "trace_steps": state.get("trace_steps", []) + [trace_step],
                }

    # ── LIMIT enforcement ─────────────────────────────────────────────────────
    first_statement = statements[0]
    limit_injected = False

    if first_statement and not _has_limit(first_statement):
        sql = _inject_limit(sql, settings.SQL_ROW_LIMIT)
        limit_injected = True

    # ── Success ───────────────────────────────────────────────────────────────
    trace_step = {
        "node": "validate_sql_node",
        "message": (
            f"AST validated ✓ "
            + (f"— LIMIT {settings.SQL_ROW_LIMIT} injected" if limit_injected else "— LIMIT already present")
        ),
        "status": "done",
    }

    return {
        "generated_sql": sql,
        "sql_error": "",
        "trace_steps": state.get("trace_steps", []) + [trace_step],
    }
