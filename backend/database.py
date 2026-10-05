import sqlite3
import os
from datetime import datetime
from typing import List, Dict, Any

DB_FILE = os.getenv("SQLITE_DB_PATH", "app.db")

def init_db():
    """Initialize the SQLite database schema."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS emergency_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            query TEXT NOT NULL,
            answer TEXT NOT NULL,
            sources TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

def log_query(query: str, answer: str, sources: List[str]) -> int:
    """Log an emergency query and response into SQLite."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    timestamp = datetime.utcnow().isoformat()
    sources_str = ", ".join(sources) if sources else "None"
    
    cursor.execute(
        "INSERT INTO emergency_logs (timestamp, query, answer, sources) VALUES (?, ?, ?, ?)",
        (timestamp, query, answer, sources_str)
    )
    conn.commit()
    log_id = cursor.lastrowid
    conn.close()
    return log_id

def get_recent_logs(limit: int = 10) -> List[Dict[str, Any]]:
    """Retrieve recent emergency logs."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM emergency_logs ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    
    return [
        {
            "id": row["id"],
            "timestamp": row["timestamp"],
            "query": row["query"],
            "answer": row["answer"],
            "sources": row["sources"].split(", ") if row["sources"] != "None" else []
        }
        for row in rows
    ]
