"""Review Agent — 模型代理自动审核候选主题"""
import json
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np

from backend.config import get_config
from backend.db.database import get_connection
from backend.services import embedding_service, llm_service, routing_service, vector_store

logger = logging.getLogger(__name__)


@dataclass
class ReviewDecision:
    candidate_id: str
    candidate_name: str
    decision: str
    target_topic_id: str
    reason: str
    confidence: float


def _do_approve(conn, candidate: Dict) -> str:
    """创建新主题 + 锚点 + 嵌入，返回 topic_id"""
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
           SET status = 'approved', reviewed_at = ?
           WHERE id = ?""",
        (now, candidate["id"]),
    )
    conn.commit()

    if anchor_texts:
        vectors = embedding_service.embed_batch(anchor_texts)
        vector_store.add_anchor_embeddings(anchor_ids, vectors, anchor_metas)
        logger.info("Agent approved candidate %s → topic %s with %d anchors",
                     candidate["id"], topic_id, len(anchor_ids))

    return topic_id


def _do_ignore(conn, candidate_id: str, comment: str):
    """标记候选主题为忽略"""
    now = datetime.now().isoformat()
    conn.execute(
        """UPDATE candidate_topics
           SET status = 'ignored', reviewed_at = ?, review_comment = ?
           WHERE id = ?""",
        (now, comment, candidate_id),
    )
    conn.commit()
    logger.info("Agent ignored candidate %s: %s", candidate_id, comment)


def _do_merge(conn, candidate: Dict, target_topic_id: str) -> str:
    """合并候选主题到已有主题，返回 target_topic_id"""
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
        (now, f"Merged into {target_topic_id}", candidate["id"]),
    )
    conn.commit()

    if anchor_texts:
        vectors = embedding_service.embed_batch(anchor_texts)
        vector_store.add_anchor_embeddings(anchor_ids, vectors, anchor_metas)
        logger.info("Agent merged candidate %s → topic %s with %d anchors",
                     candidate["id"], target_topic_id, len(anchor_ids))

    return target_topic_id


def _evaluate_candidate(conn, candidate: Dict) -> ReviewDecision:
    """评估单个候选主题，返回决策"""
    config = get_config()
    agent_cfg = config.get("review_agent", {})
    min_samples = agent_cfg.get("min_samples_for_approve", 3)
    merge_threshold = agent_cfg.get("merge_threshold", 0.70)
    coherence_ratio = agent_cfg.get("coherence_ratio", 0.60)

    candidate_id = candidate["id"]
    candidate_name = candidate["name"]
    sample_count = candidate.get("sample_count", 0)

    if sample_count < min_samples:
        return ReviewDecision(
            candidate_id=candidate_id,
            candidate_name=candidate_name,
            decision="ignore",
            target_topic_id="",
            reason=f"样本数量不足（{sample_count} < {min_samples}）",
            confidence=0.90,
        )

    repr_ids = json.loads(candidate.get("representative_ids_json") or "[]")
    if not repr_ids:
        return ReviewDecision(
            candidate_id=candidate_id,
            candidate_name=candidate_name,
            decision="ignore",
            target_topic_id="",
            reason="无代表内容",
            confidence=0.95,
        )

    placeholders = ",".join("?" * len(repr_ids))
    rows = conn.execute(
        f"SELECT id, clean_text FROM raw_content WHERE id IN ({placeholders})",
        repr_ids,
    ).fetchall()
    texts = [r["clean_text"] for r in rows if r["clean_text"]]

    if not texts:
        return ReviewDecision(
            candidate_id=candidate_id,
            candidate_name=candidate_name,
            decision="ignore",
            target_topic_id="",
            reason="代表内容为空",
            confidence=0.95,
        )

    embeddings = []
    credibilities = []
    for text in texts[:5]:
        try:
            emb = embedding_service.embed_text(text)
            embeddings.append(emb)
            result = llm_service.analyze_content(text, candidate_name)
            credibilities.append(result.credibility_level)
        except Exception as e:
            logger.warning("Failed to analyze text for candidate %s: %s", candidate_id, e)

    if not embeddings:
        return ReviewDecision(
            candidate_id=candidate_id,
            candidate_name=candidate_name,
            decision="ignore",
            target_topic_id="",
            reason="嵌入计算失败",
            confidence=0.80,
        )

    centroid = np.mean(embeddings, axis=0)
    topic_candidates = routing_service.route_topic(centroid)

    if topic_candidates and topic_candidates[0].similarity >= merge_threshold:
        best = topic_candidates[0]
        return ReviewDecision(
            candidate_id=candidate_id,
            candidate_name=candidate_name,
            decision="merge",
            target_topic_id=best.topic_id,
            reason=f"与已有主题「{best.topic_name}」相似度过高（{best.similarity:.2f}）",
            confidence=best.similarity,
        )

    if credibilities:
        low_count = credibilities.count("low")
        high_count = credibilities.count("high")
        total = len(credibilities)
        max_ratio = max(low_count, high_count) / total if total > 0 else 0

        if max_ratio >= coherence_ratio and (low_count > 0 or high_count > 0):
            return ReviewDecision(
                candidate_id=candidate_id,
                candidate_name=candidate_name,
                decision="approve",
                target_topic_id="",
                reason=f"信度一致性高（{max_ratio:.0%} {'低可信' if low_count > high_count else '高可信'}）",
                confidence=max_ratio,
            )

    return ReviewDecision(
        candidate_id=candidate_id,
        candidate_name=candidate_name,
        decision="ignore",
        target_topic_id="",
        reason="信度信号不一致或质量不足",
        confidence=0.50,
    )


def _log_decision(decision: ReviewDecision, success: bool, error: str = None):
    """记录决策到 ai_run_log"""
    config = get_config()
    model = config["llm"]["model"]
    run_id = f"review_{uuid.uuid4().hex[:12]}"

    conn = get_connection()
    try:
        conn.execute(
            """INSERT INTO ai_run_log
               (run_id, task_type, model, timestamp, input_record_ids,
                prompt_version, raw_output, parsed_output, success, error_message)
               VALUES (?, 'review_agent', ?, ?, ?, ?, ?, ?, ?, ?)""",
            (run_id, model, datetime.now().isoformat(),
             json.dumps([decision.candidate_id]), "review-agent-v1",
             json.dumps({"candidate_name": decision.candidate_name}),
             json.dumps({
                 "decision": decision.decision,
                 "target_topic_id": decision.target_topic_id,
                 "reason": decision.reason,
                 "confidence": decision.confidence,
             }),
             1 if success else 0, error),
        )
        conn.commit()
    finally:
        conn.close()


def review_all_pending() -> Dict:
    """审核所有 pending 状态的候选主题"""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM candidate_topics WHERE status = 'pending' ORDER BY created_at"
        ).fetchall()
        candidates = [dict(r) for r in rows]
    finally:
        conn.close()

    if not candidates:
        return {"reviewed": 0, "decisions": []}

    decisions = []
    approved = 0
    merged = 0
    ignored = 0

    conn = get_connection()
    try:
        for candidate in candidates:
            try:
                decision = _evaluate_candidate(conn, candidate)

                if decision.decision == "approve":
                    topic_id = _do_approve(conn, candidate)
                    decision.target_topic_id = topic_id
                    approved += 1
                elif decision.decision == "merge":
                    _do_merge(conn, candidate, decision.target_topic_id)
                    merged += 1
                else:
                    _do_ignore(conn, candidate["id"], decision.reason)
                    ignored += 1

                _log_decision(decision, success=True)
                decisions.append({
                    "candidate_id": decision.candidate_id,
                    "candidate_name": decision.candidate_name,
                    "decision": decision.decision,
                    "target_topic_id": decision.target_topic_id,
                    "reason": decision.reason,
                    "confidence": decision.confidence,
                })

            except Exception as e:
                logger.exception("Failed to review candidate %s: %s", candidate["id"], e)
                _log_decision(
                    ReviewDecision(
                        candidate_id=candidate["id"],
                        candidate_name=candidate.get("name", ""),
                        decision="error",
                        target_topic_id="",
                        reason=str(e),
                        confidence=0.0,
                    ),
                    success=False,
                    error=str(e),
                )
    finally:
        conn.close()

    return {
        "reviewed": len(decisions),
        "approved": approved,
        "merged": merged,
        "ignored": ignored,
        "decisions": decisions,
    }


def get_review_log(limit: int = 20) -> List[Dict]:
    """获取代理审核决策历史"""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT * FROM ai_run_log
               WHERE task_type = 'review_agent'
               ORDER BY timestamp DESC
               LIMIT ?""",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
