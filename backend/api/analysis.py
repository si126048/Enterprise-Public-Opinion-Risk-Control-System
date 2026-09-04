import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from backend.config import get_config
from backend.db.database import get_connection
from backend.services import embedding_service, routing_service, llm_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["analysis"])


class BatchAnalyzeRequest(BaseModel):
    content_ids: Optional[List[str]] = None
    batch_size: int = 50


@router.post("/api/analyze/batch")
async def analyze_batch(req: BatchAnalyzeRequest):
    if req.content_ids:
        stats = {"total": 0, "analyzed": 0, "skipped": 0, "errors": 0}
        for content_id in req.content_ids:
            try:
                await analyze_single(content_id)
                stats["analyzed"] += 1
            except HTTPException:
                stats["skipped"] += 1
            except Exception:
                stats["errors"] += 1
            stats["total"] += 1
        return {"status": "ok", "stats": stats}
    else:
        stats = routing_service.analyze_pending_content(batch_size=req.batch_size)
        return {"status": "ok", "stats": stats}


@router.post("/api/analyze/{content_id}")
async def analyze_single(content_id: str):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, clean_text FROM raw_content WHERE id = ?", (content_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "Content not found")
        text = row["clean_text"]
        if not text:
            raise HTTPException(400, "Content has no clean_text")
    finally:
        conn.close()

    config = get_config()

    try:
        embedding = embedding_service.embed_text(text)
        candidates = routing_service.route_topic(embedding)
        best = candidates[0] if candidates else None

        topic_id = best.topic_id if best and best.status != "unknown" else None
        topic_name = best.topic_name if best else "未知主题"
        topic_similarity = best.similarity if best else 0.0

        result = llm_service.analyze_content(
            text=text, topic_name=topic_name, content_id=content_id
        )

        now = datetime.now().isoformat()
        wconn = get_connection()
        try:
            wconn.execute("""
                INSERT OR REPLACE INTO content_analysis
                (content_id, topic_id, topic_similarity,
                 credibility_level, credibility_confidence,
                 risk_level, risk_confidence,
                 summary, theory_perspective,
                 llm_model, analysis_version,
                 review_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
            """, (
                content_id, topic_id, topic_similarity,
                result.credibility_level, result.credibility_confidence,
                result.risk_level, result.risk_confidence,
                result.summary, result.theory_perspective,
                config["llm"]["model"], "v1",
                now, now,
            ))
            wconn.commit()
        finally:
            wconn.close()

        return {
            "status": "ok",
            "content_id": content_id,
            "credibility_level": result.credibility_level,
            "risk_level": result.risk_level,
            "topic_id": topic_id,
            "topic_name": topic_name,
            "topic_similarity": round(topic_similarity, 4),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to analyze %s: %s", content_id, e)
        raise HTTPException(500, f"Analysis failed: {e}")
