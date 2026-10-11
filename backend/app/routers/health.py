import sqlite3
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_conn
from app.schemas import Health

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health(conn: Annotated[sqlite3.Connection, Depends(get_conn)]) -> Health:
    # Querying the users table checks both that the database is reachable and that its schema exists.
    try:
        conn.execute("SELECT COUNT(*) FROM users").fetchone()
    except sqlite3.Error as error:
        raise HTTPException(status_code=503, detail="Database unavailable") from error
    return Health(status="ok")
