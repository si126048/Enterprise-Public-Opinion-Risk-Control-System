import logging

from fastapi import APIRouter, HTTPException

from backend.db.database import get_connection
from backend.services import routing_service, vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/routing", tags=["routing"])


@router.post("/analyze")
async def trigger_analysis(batch_size: int = 50):
    stats = routing_service.analyze_pending_content(batch_size=batch_size)
    return {"status": "ok", "stats": stats}


@router.get("/status")
async def analysis_status():
    conn = get_connection()
    try:
        total = conn.execute(
            "SELECT COUNT(*) as c FROM raw_content WHERE clean_text IS NOT NULL AND clean_text != ''"
        ).fetchone()["c"]
        analyzed = conn.execute("SELECT COUNT(*) as c FROM content_analysis").fetchone()["c"]

        sentiment_rows = conn.execute("""
            SELECT sentiment, COUNT(*) as count
            FROM content_analysis GROUP BY sentiment
        """).fetchall()

        topic_rows = conn.execute("""
            SELECT t.id, t.name, COUNT(ca.content_id) as count
            FROM content_analysis ca
            JOIN topics t ON ca.topic_id = t.id
            GROUP BY ca.topic_id ORDER BY count DESC
        """).fetchall()

        risk_rows = conn.execute("""
            SELECT risk_level, COUNT(*) as count
            FROM content_analysis GROUP BY risk_level
        """).fetchall()

        return {
            "total_content": total,
            "analyzed": analyzed,
            "pending": max(0, total - analyzed),
            "sentiment_distribution": {r["sentiment"]: r["count"] for r in sentiment_rows},
            "risk_distribution": {r["risk_level"]: r["count"] for r in risk_rows},
            "topic_distribution": [
                {"topic_id": r["id"], "name": r["name"], "count": r["count"]}
                for r in topic_rows
            ],
        }
    finally:
        conn.close()


@router.get("/topics")
async def list_topics():
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT t.id, t.name, t.description, t.status,
                   COUNT(DISTINCT ta.id) as anchor_count,
                   COUNT(DISTINCT ca.content_id) as content_count
            FROM topics t
            LEFT JOIN topic_anchors ta ON t.id = ta.topic_id
            LEFT JOIN content_analysis ca ON t.id = ca.topic_id
            GROUP BY t.id
            ORDER BY content_count DESC, t.name
        """).fetchall()

        anchor_count = vector_store.get_anchor_count()

        return {
            "topics": [dict(r) for r in rows],
            "total_anchors_in_chroma": anchor_count,
        }
    finally:
        conn.close()


@router.get("/topics/{topic_id}")
async def get_topic_detail(topic_id: str):
    conn = get_connection()
    try:
        topic = conn.execute("SELECT * FROM topics WHERE id = ?", (topic_id,)).fetchone()
        if not topic:
            raise HTTPException(404, "Topic not found")

        anchors = conn.execute(
            "SELECT id, text, status FROM topic_anchors WHERE topic_id = ?",
            (topic_id,),
        ).fetchall()

        content = conn.execute("""
            SELECT ca.content_id, ca.sentiment, ca.risk_level, ca.summary,
                   ca.topic_similarity, ca.review_status,
                   rc.title, rc.source
            FROM content_analysis ca
            JOIN raw_content rc ON ca.content_id = rc.id
            WHERE ca.topic_id = ?
            ORDER BY ca.created_at DESC
        """, (topic_id,)).fetchall()

        return {
            "topic": dict(topic),
            "anchors": [dict(a) for a in anchors],
            "analyzed_content": [dict(c) for c in content],
        }
    finally:
        conn.close()
