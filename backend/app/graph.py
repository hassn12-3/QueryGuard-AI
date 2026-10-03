"""
graph.py – LangGraph StateGraph construction.

Wires all agent nodes into a directed graph with conditional edges for:
  - SQL self-healing (retry loop between validate and generate)
  - Execution error routing (back to generate_sql with error context)
  - Advanced analysis bypass (skipped when not needed)
"""

from langgraph.graph import StateGraph, END

from app.state import AgentState
from app.config import settings
from app.nodes.schema_retriever import retrieve_schema_node
from app.nodes.sql_generator import generate_sql_node
from app.nodes.sql_validator import validate_sql_node
from app.nodes.db_executor import execute_sql_node
from app.nodes.advanced_analyzer import advanced_analysis_node
from app.nodes.insight_synthesizer import synthesize_insights_node


# ── Routing functions ─────────────────────────────────────────────────────────

def route_after_validation(state: AgentState) -> str:
    """
    After validation:
      - If there's an error AND retries remain → regenerate SQL.
      - If retries are exhausted → end with error.
      - Otherwise → execute the SQL.
    """
    if state["sql_error"]:
        if state["retry_count"] < settings.MAX_RETRY_COUNT:
            return "generate_sql_node"
        else:
            return END  # type: ignore[return-value]
    return "execute_sql_node"


def route_after_execution(state: AgentState) -> str:
    """
    After execution:
      - Runtime error → back to generate_sql if retries remain.
      - Success → check if advanced analysis is needed.
    """
    if state["sql_error"]:
        if state["retry_count"] < settings.MAX_RETRY_COUNT:
            return "generate_sql_node"
        else:
            return END  # type: ignore[return-value]
    if state["needs_advanced_analysis"]:
        return "advanced_analysis_node"
    return "synthesize_insights_node"


def route_after_analysis(state: AgentState) -> str:
    """Always proceed to insight synthesis after advanced analysis."""
    return "synthesize_insights_node"


# ── Graph factory ─────────────────────────────────────────────────────────────

def build_graph() -> StateGraph:
    """
    Constructs and compiles the LangGraph StateGraph.

    Node execution order (happy path):
        retrieve_schema → generate_sql → validate_sql → execute_sql
            → [advanced_analysis] → synthesize_insights → END

    Self-healing loop:
        validate_sql ──error──► generate_sql (up to MAX_RETRY_COUNT times)
        execute_sql  ──error──► generate_sql (up to MAX_RETRY_COUNT times)
    """
    graph = StateGraph(AgentState)

    # ── Register nodes ────────────────────────────────────────────────────────
    graph.add_node("retrieve_schema_node", retrieve_schema_node)
    graph.add_node("generate_sql_node", generate_sql_node)
    graph.add_node("validate_sql_node", validate_sql_node)
    graph.add_node("execute_sql_node", execute_sql_node)
    graph.add_node("advanced_analysis_node", advanced_analysis_node)
    graph.add_node("synthesize_insights_node", synthesize_insights_node)

    # ── Entry point ───────────────────────────────────────────────────────────
    graph.set_entry_point("retrieve_schema_node")

    # ── Deterministic edges ───────────────────────────────────────────────────
    graph.add_edge("retrieve_schema_node", "generate_sql_node")
    graph.add_edge("generate_sql_node", "validate_sql_node")

    # ── Conditional: after validation ─────────────────────────────────────────
    graph.add_conditional_edges(
        "validate_sql_node",
        route_after_validation,
        {
            "generate_sql_node": "generate_sql_node",
            "execute_sql_node": "execute_sql_node",
            END: END,
        },
    )

    # ── Conditional: after execution ──────────────────────────────────────────
    graph.add_conditional_edges(
        "execute_sql_node",
        route_after_execution,
        {
            "generate_sql_node": "generate_sql_node",
            "advanced_analysis_node": "advanced_analysis_node",
            "synthesize_insights_node": "synthesize_insights_node",
            END: END,
        },
    )

    # ── Conditional: after advanced analysis ──────────────────────────────────
    graph.add_conditional_edges(
        "advanced_analysis_node",
        route_after_analysis,
        {"synthesize_insights_node": "synthesize_insights_node"},
    )

    # ── Terminal edge ─────────────────────────────────────────────────────────
    graph.add_edge("synthesize_insights_node", END)

    return graph.compile()
