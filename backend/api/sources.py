import uuid
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_connection

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sources", tags=["sources"])


class SourceCreate(BaseModel):
    source_name: str
    source_url: Optional[str] = None
    data_type: Optional[str] = None
    access_date: Optional[str] = None
    description: Optional[str] = None
    record_count: Optional[int] = 0
    verified: Optional[bool] = False


class SourceUpdate(BaseModel):
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    data_type: Optional[str] = None
    access_date: Optional[str] = None
    description: Optional[str] = None
    record_count: Optional[int] = None
    verified: Optional[bool] = None


@router.get("")
async def list_sources(offset: int = 0, limit: int = 50):
    conn = get_connection()
    try:
        total = conn.execute("SELECT COUNT(*) FROM source_ledger").fetchone()[0]
        rows = conn.execute(
            "SELECT * FROM source_ledger ORDER BY access_date DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        return {
            "total": total,
            "sources": [dict(r) for r in rows],
        }
    finally:
        conn.close()


@router.get("/{source_id}")
async def get_source(source_id: str):
    conn = get_connection()
    try:
        source = conn.execute(
            "SELECT * FROM source_ledger WHERE id = ?", (source_id,)
        ).fetchone()
        if not source:
            raise HTTPException(404, "Source not found")

        content_stats = conn.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN ca.content_id IS NOT NULL THEN 1 ELSE 0 END) as analyzed
            FROM raw_content rc
            LEFT JOIN content_analysis ca ON rc.id = ca.content_id
            WHERE rc.source = ?
        """, (source["source_name"],)).fetchone()

        return {
            "source": dict(source),
            "content_stats": {
                "total": content_stats["total"] or 0,
                "analyzed": content_stats["analyzed"] or 0,
            },
        }
    finally:
        conn.close()


@router.post("")
async def create_source(payload: SourceCreate):
    source_id = str(uuid.uuid4())
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    access_date = payload.access_date or datetime.utcnow().strftime("%Y-%m-%d")

    conn = get_connection()
    try:
        conn.execute(
            """INSERT INTO source_ledger
               (id, source_name, source_url, data_type, access_date, description, record_count, verified)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                source_id,
                payload.source_name,
                payload.source_url,
                payload.data_type,
                access_date,
                payload.description,
                payload.record_count or 0,
                1 if payload.verified else 0,
            ),
        )
        conn.commit()

        row = conn.execute(
            "SELECT * FROM source_ledger WHERE id = ?", (source_id,)
        ).fetchone()
        return {"status": "created", "source": dict(row)}
    finally:
        conn.close()


@router.put("/{source_id}")
async def update_source(source_id: str, payload: SourceUpdate):
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT * FROM source_ledger WHERE id = ?", (source_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Source not found")

        updates = {}
        if payload.source_name is not None:
            updates["source_name"] = payload.source_name
        if payload.source_url is not None:
            updates["source_url"] = payload.source_url
        if payload.data_type is not None:
            updates["data_type"] = payload.data_type
        if payload.access_date is not None:
            updates["access_date"] = payload.access_date
        if payload.description is not None:
            updates["description"] = payload.description
        if payload.record_count is not None:
            updates["record_count"] = payload.record_count
        if payload.verified is not None:
            updates["verified"] = 1 if payload.verified else 0

        if not updates:
            return {"status": "no_change", "source": dict(existing)}

        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [source_id]
        conn.execute(f"UPDATE source_ledger SET {set_clause} WHERE id = ?", values)
        conn.commit()

        updated = conn.execute(
            "SELECT * FROM source_ledger WHERE id = ?", (source_id,)
        ).fetchone()
        return {"status": "updated", "source": dict(updated)}
    finally:
        conn.close()


@router.delete("/{source_id}")
async def delete_source(source_id: str):
    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT * FROM source_ledger WHERE id = ?", (source_id,)
        ).fetchone()
        if not existing:
            raise HTTPException(404, "Source not found")

        conn.execute("DELETE FROM source_ledger WHERE id = ?", (source_id,))
        conn.commit()
        return {"status": "deleted", "id": source_id}
    finally:
        conn.close()


@router.post("/sync")
async def sync_sources():
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT source, COUNT(*) as cnt
            FROM raw_content
            GROUP BY source
        """).fetchall()

        synced = 0
        for row in rows:
            source_name = row["source"]
            count = row["cnt"]

            existing = conn.execute(
                "SELECT id FROM source_ledger WHERE source_name = ?", (source_name,)
            ).fetchone()

            if existing:
                conn.execute(
                    "UPDATE source_ledger SET record_count = ? WHERE id = ?",
                    (count, existing["id"]),
                )
            else:
                conn.execute(
                    """INSERT INTO source_ledger
                       (id, source_name, data_type, access_date, record_count, verified)
                       VALUES (?, ?, 'csv_import', ?, ?, 0)""",
                    (
                        str(uuid.uuid4()),
                        source_name,
                        datetime.utcnow().strftime("%Y-%m-%d"),
                        count,
                    ),
                )
            synced += 1

        conn.commit()
        return {"status": "ok", "synced": synced}
    finally:
        conn.close()
