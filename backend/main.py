"""
main.py – FastAPI application with SSE streaming endpoint.
"""

import json
import asyncio
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel

from app.config import settings
from app.graph import build_graph
from app.state import AgentState


from app.db.seed_mock_data import seed_database


# ── Application ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="QueryGuard AI API",
    description="Autonomous Multi-Agent BI Copilot with AST Security & Self-Healing SQL",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Robust CORS configuration supporting local dev and cloud deployments (Render, Vercel)
_configured_origins = [o.strip() for o in settings.FRONTEND_ORIGIN.split(",") if o.strip()]
_cors_origins = list(set(_configured_origins + [
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]))

if "*" in _configured_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins,
        allow_origin_regex=r"https://.*\.onrender\.com|https://.*\.vercel\.app",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.on_event("startup")
async def startup_event():
    """Ensure mock SQLite database is seeded whenever server boots up."""
    seed_database()


# ── Schema ───────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    query: str


# ── SSE stream generator ─────────────────────────────────────────────────────

async def event_stream(query: str) -> AsyncIterator[dict]:
    """
    Runs the LangGraph agent and yields SSE events for each node execution.
    Each event carries a JSON payload describing the current node's state delta.
    """
    graph = build_graph()

    initial_state: AgentState = {
        "user_query": query,
        "relevant_schema": "",
        "generated_sql": "",
        "sql_error": "",
        "retry_count": 0,
        "query_result": [],
        "needs_advanced_analysis": False,
        "analysis_code": "",
        "analysis_summary": "",
        "chart_spec": None,
        "trace_steps": [],
    }

    try:
        final_state: AgentState = initial_state  # Will be replaced by the last graph output

        # ── Start first node ────────────────────────────────────────────────
        yield {
            "event": "node_start",
            "data": json.dumps({"node": "retrieve_schema_node"}),
        }

        # ── Run the graph with native, fast astream ─────────────────────────
        async for chunk in graph.astream(initial_state):
            for node_name, output in chunk.items():
                if isinstance(output, dict):
                    # Accumulate into final_state snapshot
                    for k, v in output.items():
                        if v is not None:
                            final_state = {**final_state, k: v}  # type: ignore[misc]

                    payload: dict = {"node": node_name, "status": "done"}
                    safe_keys = [
                        "generated_sql",
                        "sql_error",
                        "retry_count",
                        "needs_advanced_analysis",
                        "analysis_summary",
                        "chart_spec",
                        "trace_steps",
                    ]
                    for k in safe_keys:
                        if k in output and output[k] is not None:
                            payload[k] = output[k]

                    if "query_result" in output and output["query_result"]:
                        payload["row_count"] = len(output["query_result"])

                    yield {
                        "event": "node_end",
                        "data": json.dumps(payload, default=str),
                    }

                    # Determine and emit node_start for the next node
                    next_node = None
                    if node_name == "retrieve_schema_node":
                        next_node = "generate_sql_node"
                    elif node_name == "generate_sql_node":
                        next_node = "validate_sql_node"
                    elif node_name == "validate_sql_node":
                        next_node = "generate_sql_node" if output.get("sql_error") else "execute_sql_node"
                    elif node_name == "execute_sql_node":
                        if output.get("sql_error"):
                            next_node = "generate_sql_node"
                        elif output.get("needs_advanced_analysis"):
                            next_node = "advanced_analysis_node"
                        else:
                            next_node = "synthesize_insights_node"
                    elif node_name == "advanced_analysis_node":
                        next_node = "synthesize_insights_node"

                    if next_node:
                        yield {
                            "event": "node_start",
                            "data": json.dumps({"node": next_node}),
                        }

        # ── Final state (built up from node outputs above) ──────────────────
        result_rows = final_state.get("query_result", [])  # type: ignore[attr-defined]
        preview_rows = result_rows[:100]

        yield {
            "event": "final_result",
            "data": json.dumps(
                {
                    "generated_sql": final_state.get("generated_sql", ""),  # type: ignore[attr-defined]
                    "query_result": preview_rows,
                    "row_count": len(result_rows),
                    "analysis_summary": final_state.get("analysis_summary", ""),  # type: ignore[attr-defined]
                    "chart_spec": final_state.get("chart_spec"),  # type: ignore[attr-defined]
                    "trace_steps": final_state.get("trace_steps", []),  # type: ignore[attr-defined]
                    "retry_count": final_state.get("retry_count", 0),  # type: ignore[attr-defined]
                },
                default=str,
            ),
        }

    except Exception as exc:
        yield {
            "event": "error",
            "data": json.dumps({"error": str(exc)}),
        }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Primary endpoint. Accepts a natural-language query and streams back
    step-by-step agent events via Server-Sent Events.
    """
    return EventSourceResponse(
        event_stream(request.query),
        media_type="text/event-stream",
    )


@app.get("/api/health")
async def health():
    """Simple liveness probe."""
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/schema")
async def get_schema():
    """Returns the full database schema for UI display."""
    from app.db.connection import get_full_schema
    return {"schema": get_full_schema()}
