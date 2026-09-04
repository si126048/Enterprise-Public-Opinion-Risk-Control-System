import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

import numpy as np

from backend.config import get_config
from backend.db.database import get_connection
from backend.services import embedding_service, vector_store

logger = logging.getLogger(__name__)

_topic_cache = {}


def refresh_topic_cache():
    global _topic_cache
    conn = get_connection()
    try:
        rows = conn.execute("SELECT id, name FROM topics WHERE status = 'active'").fetchall()
        _topic_cache = {r["id"]: r["name"] for r in rows}
    finally:
        conn.close()


def _get_topic_name(topic_id: str) -> str:
    if not _topic_cache:
        refresh_topic_cache()
    return _topic_cache.get(topic_id, "未知主题")


@dataclass
class TopicCandidate:
    topic_id: str
    topic_name: str
    similarity: float
    matched_anchor: str
    matched_anchor_distance: float
    status: str


def route_topic(embedding: np.ndarray) -> List[TopicCandidate]:
    config = get_config()
    routing_cfg = config.get("routing", {})
    top_k = routing_cfg.get("top_k_anchors", 5)
    max_candidates = routing_cfg.get("candidate_topics", 3)
    known_threshold = routing_cfg.get("known_topic_threshold", 0.65)
    unknown_threshold = routing_cfg.get("unknown_threshold", 0.55)

    anchor_results = vector_store.search_anchors(embedding, top_k=top_k)
    if not anchor_results:
        return []

    topic_best = {}
    for item in anchor_results:
        meta = item.get("metadata", {})
        topic_id = meta.get("topic_id")
        if not topic_id:
            continue
        distance = item["distance"]
        if topic_id not in topic_best or distance < topic_best[topic_id]["distance"]:
            topic_best[topic_id] = {
                "distance": distance,
                "anchor_text": meta.get("text", ""),
            }

    candidates = []
    for topic_id, info in topic_best.items():
        similarity = 1.0 - info["distance"]
        if similarity >= known_threshold:
            status = "known"
        elif similarity >= unknown_threshold:
            status = "uncertain"
        else:
            status = "unknown"

        candidates.append(TopicCandidate(
            topic_id=topic_id,
            topic_name=_get_topic_name(topic_id),
            similarity=similarity,
            matched_anchor=info["anchor_text"],
            matched_anchor_distance=info["distance"],
            status=status,
        ))

    candidates.sort(key=lambda c: c.similarity, reverse=True)
    return candidates[:max_candidates]


def get_best_topic(embedding: np.ndarray) -> Optional[TopicCandidate]:
    candidates = route_topic(embedding)
    if not candidates:
        return None
    best = candidates[0]
    if best.status == "unknown":
        return None
    return best


def analyze_pending_content(batch_size: int = 50) -> dict:
    from backend.services import llm_service

    config = get_config()

    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT rc.id, rc.clean_text
            FROM raw_content rc
            LEFT JOIN content_analysis ca ON rc.id = ca.content_id
            WHERE ca.content_id IS NULL
              AND rc.clean_text IS NOT NULL
              AND rc.clean_text != ''
            ORDER BY rc.created_at DESC
            LIMIT ?
        """, (batch_size,)).fetchall()
        items = [(r["id"], r["clean_text"]) for r in rows]
    finally:
        conn.close()

    stats = {"total": len(items), "analyzed": 0, "skipped": 0, "errors": 0}

    for content_id, text in items:
        try:
            embedding = embedding_service.embed_text(text)
            candidates = route_topic(embedding)
            best = candidates[0] if candidates else None

            topic_id = best.topic_id if best and best.status != "unknown" else None
            topic_name = best.topic_name if best else "未知主题"
            topic_similarity = best.similarity if best else 0.0

            result = llm_service.analyze_content(
                text=text,
                topic_name=topic_name,
                content_id=content_id,
            )

            now = datetime.now().isoformat()
            wconn = get_connection()
            try:
                wconn.execute("""
                    INSERT OR REPLACE INTO content_analysis
                    (content_id, topic_id, topic_similarity,
                     sentiment, sentiment_confidence,
                     risk_level, risk_confidence,
                     summary, theory_perspective,
                     llm_model, analysis_version,
                     review_status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                """, (
                    content_id, topic_id, topic_similarity,
                    result.sentiment, result.sentiment_confidence,
                    result.risk_level, result.risk_confidence,
                    result.summary, result.theory_perspective,
                    config["llm"]["model"], "v1",
                    now, now,
                ))
                wconn.commit()
            finally:
                wconn.close()
            stats["analyzed"] += 1

        except Exception as e:
            logger.error("Failed to analyze %s: %s", content_id, e)
            stats["errors"] += 1

    logger.info("Analysis complete: %d analyzed, %d errors", stats["analyzed"], stats["errors"])
    return stats
