import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from backend.config import get_config
from backend.db.database import get_connection
from backend.discovery import clusterer
from backend.services import embedding_service, vector_store
from backend.services.review_agent import _do_approve, _do_ignore, _do_merge, review_all_pending

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


@router.post("/run")
async def run_discovery():
    result = clusterer.run_discovery()
    agent_result = None
    config = get_config()
    if result.get("candidates_created", 0) > 0 and config.get("review_agent", {}).get("auto_run_after_discovery"):
        try:
            agent_result = review_all_pending()
        except Exception as e:
            logger.warning("Auto review after discovery failed: %s", e)
    return {"status": "ok", "result": result, "agent_review": agent_result}


@router.get("/candidates")
async def list_candidates(status: Optional[str] = None):
    conn = get_connection()
    try:
        if status:
            rows = conn.execute(
                "SELECT * FROM candidate_topics WHERE status = ? ORDER BY created_at DESC",
                (status,),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM candidate_topics ORDER BY created_at DESC"
            ).fetchall()

        candidates = [dict(r) for r in rows]

        unknown_count = clusterer.get_unknown_count()
        status_rows = conn.execute(
            "SELECT status, COUNT(*) as cnt FROM candidate_topics GROUP BY status"
        ).fetchall()
        status_counts = {r["status"]: r["cnt"] for r in status_rows}

        return {
            "candidates": candidates,
            "stats": {
                "unknown_count": unknown_count,
                "pending": status_counts.get("pending", 0),
                "approved": status_counts.get("approved", 0),
                "merged": status_counts.get("merged", 0),
                "ignored": status_counts.get("ignored", 0),
                "total": len(candidates) if not status else sum(status_counts.values()),
            },
        }
    finally:
        conn.close()


@router.get("/candidates/{candidate_id}")
async def get_candidate_detail(candidate_id: str):
    conn = get_connection()
    try:
        candidate = conn.execute(
            "SELECT * FROM candidate_topics WHERE id = ?", (candidate_id,)
        ).fetchone()
        if not candidate:
            raise HTTPException(404, "Candidate not found")

        candidate = dict(candidate)
        repr_ids = json.loads(candidate.get("representative_ids_json") or "[]")
        proposed_anchors = json.loads(candidate.get("proposed_anchors_json") or "[]")

        representative_content = []
        if repr_ids:
            placeholders = ",".join("?" * len(repr_ids))
            rows = conn.execute(
                f"""SELECT rc.id, rc.title, rc.clean_text, rc.source, rc.publish_time,
                           ca.credibility_level, ca.risk_level, ca.summary
                    FROM raw_content rc
                    LEFT JOIN content_analysis ca ON rc.id = ca.content_id
                    WHERE rc.id IN ({placeholders})""",
                repr_ids,
            ).fetchall()
            representative_content = [dict(r) for r in rows]

        return {
            "candidate": candidate,
            "representative_content": representative_content,
            "proposed_anchors": proposed_anchors,
        }
    finally:
        conn.close()


@router.post("/candidates/{candidate_id}/approve")
async def approve_candidate(candidate_id: str):
    conn = get_connection()
    try:
        candidate = conn.execute(
            "SELECT * FROM candidate_topics WHERE id = ?", (candidate_id,)
        ).fetchone()
        if not candidate:
            raise HTTPException(404, "Candidate not found")
        candidate = dict(candidate)
        if candidate["status"] != "pending":
            raise HTTPException(400, f"Candidate status is '{candidate['status']}', not 'pending'")

        topic_id = _do_approve(conn, candidate)
    finally:
        conn.close()

    return {"status": "ok", "topic_id": topic_id}


@router.post("/candidates/{candidate_id}/ignore")
async def ignore_candidate(candidate_id: str, request: Request):
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    comment = body.get("comment", "")

    conn = get_connection()
    try:
        candidate = conn.execute(
            "SELECT * FROM candidate_topics WHERE id = ?", (candidate_id,)
        ).fetchone()
        if not candidate:
            raise HTTPException(404, "Candidate not found")
        if dict(candidate)["status"] != "pending":
            raise HTTPException(400, "Candidate is not pending")

        _do_ignore(conn, candidate_id, comment)
    finally:
        conn.close()

    return {"status": "ok"}


@router.post("/candidates/{candidate_id}/merge")
async def merge_candidate(candidate_id: str, request: Request):
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    target_topic_id = body.get("target_topic_id")
    if not target_topic_id:
        raise HTTPException(400, "target_topic_id is required")

    conn = get_connection()
    try:
        candidate = conn.execute(
            "SELECT * FROM candidate_topics WHERE id = ?", (candidate_id,)
        ).fetchone()
        if not candidate:
            raise HTTPException(404, "Candidate not found")
        candidate = dict(candidate)
        if candidate["status"] != "pending":
            raise HTTPException(400, "Candidate is not pending")

        target = conn.execute(
            "SELECT id FROM topics WHERE id = ? AND status = 'active'", (target_topic_id,)
        ).fetchone()
        if not target:
            raise HTTPException(404, "Target topic not found")

        _do_merge(conn, candidate, target_topic_id)
    finally:
        conn.close()

    return {"status": "ok", "target_topic_id": target_topic_id}


@router.get("/topics-for-merge")
async def topics_for_merge():
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id, name FROM topics WHERE status = 'active' ORDER BY name"
        ).fetchall()
        return {"topics": [dict(r) for r in rows]}
    finally:
        conn.close()
