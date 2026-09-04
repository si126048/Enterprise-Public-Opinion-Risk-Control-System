import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from backend.db.database import get_connection
from backend.discovery import clusterer
from backend.services import embedding_service, vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


@router.post("/run")
async def run_discovery():
    result = clusterer.run_discovery()
    return {"status": "ok", "result": result}


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
                           ca.sentiment, ca.risk_level, ca.summary
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

        proposed_anchors = json.loads(candidate.get("proposed_anchors_json") or "[]")
        now = datetime.now().isoformat()
        topic_id = "topic_" + uuid.uuid4().hex[:8]

        conn.execute(
            """INSERT INTO topics (id, name, description, status, version, created_at, updated_at)
               VALUES (?, ?, ?, 'active', 1, ?, ?)""",
            (topic_id, candidate["name"], candidate["description"], now, now),
        )

        space_id = embedding_service.get_space_id()
        anchor_ids = []
        anchor_texts = []
        anchor_metas = []
        for idx, anchor_text in enumerate(proposed_anchors):
            anchor_id = f"anchor_{topic_id}_{idx}"
            conn.execute(
                """INSERT INTO topic_anchors
                   (id, topic_id, text, embedding_space_id, status, created_at)
                   VALUES (?, ?, ?, ?, 'active', ?)""",
                (anchor_id, topic_id, anchor_text, space_id, now),
            )
            anchor_ids.append(anchor_id)
            anchor_texts.append(anchor_text)
            anchor_metas.append({"topic_id": topic_id, "text": anchor_text})

        conn.execute(
            """UPDATE candidate_topics
               SET status = 'approved', reviewed_at = ?, updated_at = ?
               WHERE id = ?""",
            (now, now, candidate_id),
        )
        conn.commit()
    finally:
        conn.close()

    if anchor_texts:
        vectors = embedding_service.embed_batch(anchor_texts)
        vector_store.add_anchor_embeddings(anchor_ids, vectors, anchor_metas)
        logger.info("Approved candidate %s → topic %s with %d anchors",
                     candidate_id, topic_id, len(anchor_ids))

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

        now = datetime.now().isoformat()
        conn.execute(
            """UPDATE candidate_topics
               SET status = 'ignored', reviewed_at = ?, review_comment = ?
               WHERE id = ?""",
            (now, comment, candidate_id),
        )
        conn.commit()
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

        proposed_anchors = json.loads(candidate.get("proposed_anchors_json") or "[]")
        now = datetime.now().isoformat()
        space_id = embedding_service.get_space_id()

        anchor_ids = []
        anchor_texts = []
        anchor_metas = []
        existing_count = conn.execute(
            "SELECT COUNT(*) FROM topic_anchors WHERE topic_id = ?", (target_topic_id,)
        ).fetchone()[0]

        for idx, anchor_text in enumerate(proposed_anchors):
            anchor_id = f"anchor_{target_topic_id}_{existing_count + idx}"
            conn.execute(
                """INSERT INTO topic_anchors
                   (id, topic_id, text, embedding_space_id, status, created_at)
                   VALUES (?, ?, ?, ?, 'active', ?)""",
                (anchor_id, target_topic_id, anchor_text, space_id, now),
            )
            anchor_ids.append(anchor_id)
            anchor_texts.append(anchor_text)
            anchor_metas.append({"topic_id": target_topic_id, "text": anchor_text})

        conn.execute(
            """UPDATE candidate_topics
               SET status = 'merged', reviewed_at = ?, review_comment = ?
               WHERE id = ?""",
            (now, f"Merged into {target_topic_id}", candidate_id),
        )
        conn.commit()
    finally:
        conn.close()

    if anchor_texts:
        vectors = embedding_service.embed_batch(anchor_texts)
        vector_store.add_anchor_embeddings(anchor_ids, vectors, anchor_metas)
        logger.info("Merged candidate %s → topic %s with %d anchors",
                     candidate_id, target_topic_id, len(anchor_ids))

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
