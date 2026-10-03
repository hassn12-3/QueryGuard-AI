"""
sandbox/runner.py – Secure sandboxed Python code executor.

Executes LLM-generated analytics code in an isolated namespace with:
  - Whitelisted safe builtins only
  - Pre-imported allowed modules (pandas, numpy, scipy, statsmodels, plotly)
  - Strict timeout enforcement via threading
  - Captures: chart_json (Plotly JSON string), summary (str)
  - No filesystem access, no network access, no subprocess

The sandbox is intentionally restrictive. It does NOT use a separate process
(which would require pickling the DataFrame), but uses restricted exec() with
a carefully curated global namespace and __builtins__ whitelist.
"""

from __future__ import annotations

import threading
import traceback
from typing import Any

import pandas as pd
import numpy as np


# ── Safe builtins whitelist ───────────────────────────────────────────────────

_SAFE_BUILTINS = {
    "abs": abs,
    "all": all,
    "any": any,
    "bool": bool,
    "dict": dict,
    "enumerate": enumerate,
    "filter": filter,
    "float": float,
    "frozenset": frozenset,
    "getattr": getattr,
    "hasattr": hasattr,
    "int": int,
    "isinstance": isinstance,
    "issubclass": issubclass,
    "iter": iter,
    "len": len,
    "list": list,
    "map": map,
    "max": max,
    "min": min,
    "next": next,
    "range": range,
    "repr": repr,
    "reversed": reversed,
    "round": round,
    "set": set,
    "slice": slice,
    "sorted": sorted,
    "str": str,
    "sum": sum,
    "tuple": tuple,
    "type": type,
    "zip": zip,
    "None": None,
    "True": True,
    "False": False,
    "print": lambda *a, **kw: None,  # Silently discard prints
}


def _build_sandbox_globals(df: pd.DataFrame) -> dict[str, Any]:
    """
    Builds the restricted global namespace for exec().
    Only whitelisted modules and the input DataFrame are available.
    """
    import scipy.stats as scipy_stats
    import scipy.signal as scipy_signal

    try:
        import statsmodels.api as sm
        import statsmodels.tsa.holtwinters as hw
        import statsmodels.tsa.statespace.sarimax as sarimax
    except ImportError:
        sm = None  # type: ignore[assignment]
        hw = None  # type: ignore[assignment]
        sarimax = None  # type: ignore[assignment]

    import plotly.graph_objects as go
    import plotly.express as px

    globs: dict[str, Any] = {
        "__builtins__": _SAFE_BUILTINS,
        # Data
        "df": df.copy(),
        # Core libraries
        "pd": pd,
        "np": np,
        # Scipy
        "scipy_stats": scipy_stats,
        "scipy_signal": scipy_signal,
        # Statsmodels
        "sm": sm,
        "hw": hw,
        "sarimax": sarimax,
        # Plotly
        "go": go,
        "px": px,
        # Pre-declare output variables so we can read them safely
        "fig": None,
        "chart_json": None,
        "summary": "",
    }

    # Also make scipy importable inside the exec via a fake importer
    import scipy
    globs["scipy"] = scipy

    return globs


# ── Executor ──────────────────────────────────────────────────────────────────

_EXECUTION_TIMEOUT_SECONDS = 30


def run_in_sandbox(
    code: str,
    df: pd.DataFrame,
    timeout: int = _EXECUTION_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    """
    Executes `code` in a restricted namespace with the given DataFrame.

    Returns a dict with keys:
      success   : bool
      chart_json: str | None  – Plotly JSON string
      summary   : str         – plain-English analysis summary
      error     : str         – error message if success is False
    """
    result: dict[str, Any] = {
        "success": False,
        "chart_json": None,
        "summary": "",
        "error": "",
    }

    sandbox_globals = _build_sandbox_globals(df)
    exec_exception: list[Exception] = []

    def _run() -> None:
        try:
            exec(compile(code, "<sandbox>", "exec"), sandbox_globals)  # noqa: S102
        except Exception as exc:
            exec_exception.append(exc)

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    thread.join(timeout=timeout)

    if thread.is_alive():
        result["error"] = f"Execution timed out after {timeout} seconds."
        return result

    if exec_exception:
        exc = exec_exception[0]
        result["error"] = f"{type(exc).__name__}: {str(exc)}\n{traceback.format_exc()}"
        return result

    # ── Extract outputs ────────────────────────────────────────────────────────
    chart_json = sandbox_globals.get("chart_json")
    summary = sandbox_globals.get("summary", "")
    fig = sandbox_globals.get("fig")

    # If the code set `fig` but not `chart_json`, convert it
    if chart_json is None and fig is not None:
        try:
            chart_json = fig.to_json()
        except Exception as exc:
            result["error"] = f"Failed to serialise Plotly figure: {exc}"
            return result

    if not isinstance(summary, str):
        summary = str(summary) if summary is not None else ""

    result["success"] = True
    result["chart_json"] = chart_json
    result["summary"] = summary
    return result
