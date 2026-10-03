"""
run.py – Entry-point for the FastAPI development server.
Run with: python run.py
"""

import os
import uvicorn
from app.config import settings
from app.db.seed_mock_data import seed_database


def main() -> None:
    # Ensure the database is seeded before the server starts
    seed_database()

    port = int(os.environ.get("PORT", settings.PORT))
    is_cloud = bool(os.environ.get("RENDER") or os.environ.get("PORT"))

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=not is_cloud,
        log_level="info",
    )


if __name__ == "__main__":
    main()
