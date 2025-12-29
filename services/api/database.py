"""
Database connection and utilities
SQLite with async support
"""
import os
import aiosqlite
from typing import Optional, List, Dict, Any
from datetime import datetime


class Database:
    """Async SQLite database connection manager"""
    
    def __init__(self):
        self.db_path = os.getenv("DATABASE_PATH", "./data/dual_track.db")
        self._conn: Optional[aiosqlite.Connection] = None
    
    async def connect(self):
        """Establish database connection"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self._conn = await aiosqlite.connect(self.db_path)
        self._conn.row_factory = aiosqlite.Row
        await self._conn.execute("PRAGMA foreign_keys = ON")
        return self._conn
    
    async def close(self):
        """Close database connection"""
        if self._conn:
            await self._conn.close()
    
    async def execute(self, query: str, params: tuple = ()) -> aiosqlite.Cursor:
        """Execute a query"""
        if not self._conn:
            await self.connect()
        return await self._conn.execute(query, params)
    
    async def fetch_one(self, query: str, params: tuple = ()) -> Optional[Dict]:
        """Fetch one row as dict"""
        cursor = await self.execute(query, params)
        row = await cursor.fetchone()
        return dict(row) if row else None
    
    async def fetch_all(self, query: str, params: tuple = ()) -> List[Dict]:
        """Fetch all rows as list of dicts"""
        cursor = await self.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
    
    async def commit(self):
        """Commit transaction"""
        if self._conn:
            await self._conn.commit()


# Global database instance
db = Database()


async def init_db():
    """Initialize database with schema"""
    await db.connect()
    
    # Check if database already initialized
    try:
        result = await db.fetch_one("SELECT name FROM sqlite_master WHERE type='table' AND name='cases'")
        if result:
            print(f"✓ Database already initialized: {db.db_path}")
            return
    except Exception:
        pass
    
    # Read and execute schema
    schema_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "schema.sql")
    
    if os.path.exists(schema_path):
        with open(schema_path, 'r') as f:
            schema = f.read()
        
        # Execute schema (split by semicolon for multiple statements)
        for statement in schema.split(';'):
            if statement.strip():
                try:
                    await db.execute(statement)
                except Exception as e:
                    # Ignore errors for already existing objects
                    if "already exists" not in str(e):
                        raise
        await db.commit()
        print(f"✓ Database initialized: {db.db_path}")
    else:
        print(f"⚠ Schema file not found: {schema_path}")


async def log_event(
    track: str,
    event_type: str,
    ollama_model: str,
    payload: Dict[str, Any],
    case_id: Optional[int] = None,
    draft_id: Optional[str] = None,
    prompt_version_id: Optional[int] = None,
    user_id: Optional[str] = None,
    risk_level: Optional[str] = None
) -> int:
    """
    Log event to unified audit trail
    
    Returns:
        event_id
    """
    import json
    
    query = """
        INSERT INTO event_logs 
        (track, event_type, case_id, draft_id, ollama_model, prompt_version_id, user_id, payload_json, risk_level, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    cursor = await db.execute(query, (
        track,
        event_type,
        case_id,
        draft_id,
        ollama_model,
        prompt_version_id,
        user_id,
        json.dumps(payload),
        risk_level,
        datetime.utcnow().isoformat()
    ))
    await db.commit()
    
    return cursor.lastrowid


def get_db() -> Database:
    """Get database instance"""
    return db
