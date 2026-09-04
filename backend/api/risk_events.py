"""
risk_events.py — 风控事件 API
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from backend.db.database import get_connection
from backend.services.risk_advisor import generate_advice

router = APIRouter(prefix="/api/risk", tags=["risk"])


class CreateEventRequest(BaseModel):
    company_id: str = "mihoyo"
    topic_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    risk_level: str = "medium"
    content_ids: Optional[List[str]] = None


class GenerateAdviceRequest(BaseModel):
    topic_id: str
    risk_level: str
    content_count: int = 0


@router.get("/events")
async def list_events(company_id: Optional[str] = None, status: Optional[str] = None):
    conn = get_connection()
    try:
        conditions = []
        params = []
        if company_id:
            conditions.append("company_id = ?")
            params.append(company_id)
        if status:
            conditions.append("status = ?")
            params.append(status)

        where = ""
        if conditions:
            where = "WHERE " + " AND ".join(conditions)

        rows = conn.execute(
            f"SELECT * FROM risk_events {where} ORDER BY created_at DESC",
            params,
        ).fetchall()
        events = [dict(r) for r in rows]

        for ev in events:
            if ev.get("sample_content_ids"):
                ev["sample_content_ids"] = ev["sample_content_ids"].split(",")
            else:
                ev["sample_content_ids"] = []

        return {"events": events, "total": len(events)}
    finally:
        conn.close()


@router.post("/events")
async def create_event(req: CreateEventRequest):
    conn = get_connection()
    try:
        event_id = f"RE-{uuid.uuid4().hex[:8].upper()}"
        now = datetime.utcnow().isoformat()
        sample_ids = ",".join(req.content_ids) if req.content_ids else ""

        conn.execute(
            """INSERT INTO risk_events
               (id, company_id, topic_id, title, description, risk_level,
                content_count, sample_content_ids, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)""",
            (
                event_id, req.company_id, req.topic_id, req.title,
                req.description, req.risk_level,
                len(req.content_ids) if req.content_ids else 0,
                sample_ids, now, now,
            ),
        )
        conn.commit()

        event = conn.execute(
            "SELECT * FROM risk_events WHERE id = ?", (event_id,)
        ).fetchone()
        return dict(event)
    finally:
        conn.close()


@router.post("/events/{event_id}/status")
async def update_event_status(event_id: str, status: str = "closed"):
    conn = get_connection()
    try:
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE risk_events SET status = ?, updated_at = ? WHERE id = ?",
            (status, now, event_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM risk_events WHERE id = ?", (event_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Event not found")
        return dict(row)
    finally:
        conn.close()


@router.post("/generate_advice")
async def gen_advice(req: GenerateAdviceRequest):
    advice = generate_advice(req.topic_id, req.risk_level, req.content_count)
    return {"advice": advice}


@router.post("/events/{event_id}/generate_advice")
async def gen_event_advice(event_id: str):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM risk_events WHERE id = ?", (event_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Event not found")

        event = dict(row)
        advice = generate_advice(
            event.get("topic_id"), event.get("risk_level", "low"),
            event.get("content_count", 0),
        )
        now = datetime.utcnow().isoformat()
        conn.execute(
            "UPDATE risk_events SET advice = ?, updated_at = ? WHERE id = ?",
            (advice, now, event_id),
        )
        conn.commit()
        return {"advice": advice}
    finally:
        conn.close()


@router.post("/auto_generate")
async def auto_generate_events(company_id: str = "mihoyo"):
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT ca.topic_id, ca.risk_level, COUNT(*) as cnt,
                   GROUP_CONCAT(rc.id) as content_ids
            FROM content_analysis ca
            JOIN raw_content rc ON rc.id = ca.content_id
            WHERE ca.risk_level IN ('medium', 'high')
              AND ca.topic_id IS NOT NULL
              AND rc.company_id = ?
            GROUP BY ca.topic_id, ca.risk_level
            HAVING cnt >= 2
            ORDER BY cnt DESC
        """, (company_id,)).fetchall()

        existing = conn.execute(
            "SELECT topic_id, risk_level FROM risk_events WHERE company_id = ?",
            (company_id,),
        ).fetchall()
        existing_keys = {(r["topic_id"], r["risk_level"]) for r in existing}

        created = []
        now = datetime.utcnow().isoformat()
        for r in rows:
            key = (r["topic_id"], r["risk_level"])
            if key in existing_keys:
                continue

            event_id = f"RE-{uuid.uuid4().hex[:8].upper()}"
            topic_name = conn.execute(
                "SELECT name FROM topics WHERE id = ?", (r["topic_id"],)
            ).fetchone()
            title = f"{topic_name['name'] if topic_name else r['topic_id']} - {r['risk_level']}级风险"
            advice = generate_advice(r["topic_id"], r["risk_level"], r["cnt"])
            ids = r["content_ids"].split(",")[:10] if r["content_ids"] else []

            conn.execute(
                """INSERT INTO risk_events
                   (id, company_id, topic_id, title, risk_level, content_count,
                    sample_content_ids, advice, status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)""",
                (event_id, company_id, r["topic_id"], title, r["risk_level"],
                 r["cnt"], ",".join(ids), advice, now, now),
            )
            created.append({"event_id": event_id, "title": title, "count": r["cnt"]})

        conn.commit()
        return {"created": len(created), "events": created}
    finally:
        conn.close()
