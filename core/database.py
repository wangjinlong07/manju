"""Database layer: asyncpg connection pool + CRUD for projects & assets."""

import json
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import asyncpg
from loguru import logger


_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Get or create the asyncpg connection pool (singleton)."""
    global _pool
    if _pool is None:
        dsn = os.getenv("DATABASE_URL", "postgresql://localhost:5432/manju")
        _pool = await asyncpg.create_pool(dsn, min_size=2, max_size=10)
        logger.info(f"[DB] Connection pool created → {dsn.split('@')[-1]}")
    return _pool


async def close_pool():
    """Gracefully close the pool on shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("[DB] Connection pool closed")


# ─────────────────────────────────────────────
# Projects CRUD
# ─────────────────────────────────────────────

async def create_project(name: str, canvas_json: dict = None) -> dict:
    """Create a new project, return its record as dict."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """INSERT INTO projects (name, canvas_json)
           VALUES ($1, $2::jsonb)
           RETURNING id, name, canvas_json, created_at, updated_at""",
        name,
        json.dumps(canvas_json or {}),
    )
    return _row_to_project(row)


async def list_projects(limit: int = 50, offset: int = 0) -> list[dict]:
    """List projects ordered by updated_at DESC."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT id, name, canvas_json->>'ratio' AS ratio, created_at, updated_at
           FROM projects ORDER BY updated_at DESC
           LIMIT $1 OFFSET $2""",
        limit, offset,
    )
    return [_row_to_project_summary(r) for r in rows]


async def get_project(project_id: str) -> Optional[dict]:
    """Get a single project by ID (full canvas_json included)."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT id, name, canvas_json, created_at, updated_at
           FROM projects WHERE id = $1""",
        uuid.UUID(project_id),
    )
    return _row_to_project(row) if row else None


async def update_project(project_id: str, name: str = None, canvas_json: dict = None) -> Optional[dict]:
    """Update project fields. Returns updated record or None if not found."""
    pool = await get_pool()
    sets = []
    params = []
    idx = 1

    if name is not None:
        sets.append(f"name = ${idx}")
        params.append(name)
        idx += 1
    if canvas_json is not None:
        sets.append(f"canvas_json = ${idx}::jsonb")
        params.append(json.dumps(canvas_json))
        idx += 1

    if not sets:
        return await get_project(project_id)

    sets.append(f"updated_at = ${idx}")
    params.append(datetime.now(timezone.utc))
    idx += 1

    params.append(uuid.UUID(project_id))
    query = f"""UPDATE projects SET {', '.join(sets)}
                WHERE id = ${idx}
                RETURNING id, name, canvas_json, created_at, updated_at"""

    row = await pool.fetchrow(query, *params)
    return _row_to_project(row) if row else None


async def delete_project(project_id: str) -> bool:
    """Delete a project (cascades to assets). Returns True if deleted."""
    pool = await get_pool()
    result = await pool.execute(
        "DELETE FROM projects WHERE id = $1",
        uuid.UUID(project_id),
    )
    return result == "DELETE 1"


# ─────────────────────────────────────────────
# Assets CRUD
# ─────────────────────────────────────────────

async def create_asset(
    project_id: str,
    asset_type: str,
    url: str,
    prompt: str = "",
    provider: str = "",
    node_id: str = "",
) -> dict:
    """Record a generated asset (image/video/script)."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """INSERT INTO assets (project_id, type, url, prompt, provider, node_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, project_id, type, url, prompt, provider, node_id, created_at""",
        uuid.UUID(project_id),
        asset_type,
        url,
        prompt,
        provider,
        node_id,
    )
    return _row_to_asset(row)


async def list_assets(project_id: str) -> list[dict]:
    """List all assets for a project, newest first."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT id, project_id, type, url, prompt, provider, node_id, created_at
           FROM assets WHERE project_id = $1
           ORDER BY created_at DESC""",
        uuid.UUID(project_id),
    )
    return [_row_to_asset(r) for r in rows]


# ─────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────

def _row_to_project(row) -> dict:
    if not row:
        return {}
    canvas = row["canvas_json"]
    if isinstance(canvas, str):
        canvas = json.loads(canvas)
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "canvas_json": canvas,
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
    }


def _row_to_project_summary(row) -> dict:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "ratio": row.get("ratio") or "16:9",
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
    }


def _row_to_asset(row) -> dict:
    if not row:
        return {}
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "type": row["type"],
        "url": row["url"],
        "prompt": row["prompt"],
        "provider": row["provider"],
        "node_id": row["node_id"],
        "created_at": row["created_at"].isoformat(),
    }
