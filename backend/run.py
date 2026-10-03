"""
run.py – Entry-point for the FastAPI development server.
Run with: python run.py
"""

import uvicorn
from app.config import settings
from app.db.seed_mock_data import seed_database


def main() -> None:
    # Ensure the database is seeded before the server starts
    seed_database()

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        reload_dirs=["app"],
        log_level="info",
    )


if __name__ == "__main__":
    main()
