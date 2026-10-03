"""
db/connection.py – SQLite connection helpers.

Provides a simple factory for getting a SQLite connection to analytics.db,
plus utilities for schema introspection used by the schema retriever node.
"""

from __future__ import annotations

import sqlite3
from typing import Any

from app.config import settings


def get_connection() -> sqlite3.Connection:
    """
    Returns a new SQLite connection to analytics.db.
    Uses Row factory for dict-like row access where needed.
    """
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn


def get_full_schema_structured() -> list[dict[str, Any]]:
    """
    Returns full schema metadata as a list of table descriptors.

    Each descriptor has:
      {
        "table": str,
        "columns": [{"cid", "name", "type", "notnull", "default", "pk"}],
        "foreign_keys": [{"id", "seq", "table", "from", "to", ...}],
      }
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Get all user tables (exclude SQLite internals)
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;"
    )
    table_names = [row[0] for row in cursor.fetchall()]

    schema: list[dict[str, Any]] = []
    for table_name in table_names:
        # Column info
        cursor.execute(f"PRAGMA table_info('{table_name}');")
        columns = [
            {
                "cid": row[0],
                "name": row[1],
                "type": row[2],
                "notnull": bool(row[3]),
                "default": row[4],
                "pk": bool(row[5]),
            }
            for row in cursor.fetchall()
        ]

        # Foreign key info
        cursor.execute(f"PRAGMA foreign_key_list('{table_name}');")
        foreign_keys = [
            {
                "id": row[0],
                "seq": row[1],
                "table": row[2],
                "from": row[3],
                "to": row[4],
                "on_update": row[5],
                "on_delete": row[6],
            }
            for row in cursor.fetchall()
        ]

        schema.append(
            {
                "table": table_name,
                "columns": columns,
                "foreign_keys": foreign_keys,
            }
        )

    conn.close()
    return schema


def get_full_schema() -> dict[str, Any]:
    """
    Returns schema in a format suitable for the /api/schema endpoint.
    """
    structured = get_full_schema_structured()
    return {
        "tables": [
            {
                "name": t["table"],
                "columns": [
                    {
                        "name": c["name"],
                        "type": c["type"],
                        "primary_key": c["pk"],
                        "nullable": not c["notnull"],
                    }
                    for c in t["columns"]
                ],
                "foreign_keys": t["foreign_keys"],
            }
            for t in structured
        ]
    }
