import json
import logging
import uuid
from collections import Counter
from datetime import datetime
from typing import List, Tuple, Dict

import numpy as np

from backend.config import get_config
from backend.db.database import get_connection
from backend.services import embedding_service, vector_store

logger = logging.getLogger(__name__)


def get_unknown_count() -> int:
    conn = get_connection()
    try:
        return conn.execute(
            "SELECT COUNT(*) FROM content_analysis WHERE topic_id IS NULL"
        ).fetchone()[0]
    finally:
        conn.close()


def collect_unknown_content() -> List[dict]:
    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT rc.id, rc.clean_text, rc.title
            FROM raw_content rc
            JOIN content_analysis ca ON rc.id = ca.content_id
            WHERE ca.topic_id IS NULL
              AND rc.clean_text IS NOT NULL
              AND rc.clean_text != ''
            ORDER BY rc.created_at DESC
        """).fetchall()
        return [{"id": r["id"], "clean_text": r["clean_text"], "title": r["title"]} for r in rows]
    finally:
        conn.close()


def retrieve_embeddings(items: List[dict]) -> Tuple[List[str], np.ndarray, List[dict]]:
    chroma_ids = ["content_" + item["id"] for item in items]
    existing = vector_store.get_embeddings_by_ids(chroma_ids)

    valid_ids = []
    embeddings_list = []
    valid_items = []

    for item, cid in zip(items, chroma_ids):
        if cid in existing:
            valid_ids.append(cid)
            embeddings_list.append(existing[cid])
            valid_items.append(item)
        else:
            try:
                vec = embedding_service.embed_text(item["clean_text"])
                valid_ids.append(cid)
                embeddings_list.append(vec)
                valid_items.append(item)
            except Exception as e:
                logger.warning("Failed to embed %s: %s", item["id"], e)

    if not embeddings_list:
        return [], np.array([]), []

    matrix = np.stack(embeddings_list)
    return valid_ids, matrix, valid_items


def run_clustering(embeddings: np.ndarray) -> Tuple[np.ndarray, int]:
    import hdbscan

    config = get_config()
    disc_cfg = config.get("discovery", {})

    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=disc_cfg.get("min_cluster_size", 5),
        min_samples=disc_cfg.get("min_samples", 3),
        cluster_selection_method=disc_cfg.get("cluster_selection_method", "eom"),
        metric="euclidean",
    )
    labels = clusterer.fit_predict(embeddings)
    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    return labels, n_clusters


def pick_representative_indices(embeddings: np.ndarray, max_count: int = 5) -> List[int]:
    centroid = embeddings.mean(axis=0)
    centroid_norm = np.linalg.norm(centroid)
    if centroid_norm == 0:
        return list(range(min(max_count, len(embeddings))))
    centroid = centroid / centroid_norm
    similarities = embeddings @ centroid
    top_indices = np.argsort(similarities)[::-1][:max_count]
    return top_indices.tolist()


def generate_candidate_label(texts: List[str], cluster_index: int) -> dict:
    from backend.services.llm_service import MockLLMProvider

    all_keywords = (
        MockLLMProvider.NEGATIVE_KEYWORDS
        + MockLLMProvider.POSITIVE_KEYWORDS
        + MockLLMProvider.HIGH_RISK_KEYWORDS
    )

    keyword_counts = Counter()
    for text in texts:
        for kw in all_keywords:
            if kw in text:
                keyword_counts[kw] += 1

    if keyword_counts:
        top_keyword = keyword_counts.most_common(1)[0][0]
        name = f"未分类-{top_keyword}-{cluster_index + 1}"
    else:
        name = f"未分类簇-{cluster_index + 1}"

    combined = " ".join(texts[:3])
    first_sentence = combined.split("。")[0].split("！")[0].split("\n")[0]
    if len(first_sentence) > 80:
        first_sentence = first_sentence[:80] + "..."
    description = f"聚类{cluster_index + 1}：{first_sentence}"

    anchor_texts = []
    for text in texts[:4]:
        clean = text.strip().replace("\n", " ")
        if len(clean) > 30:
            clean = clean[:30]
        if clean and clean not in anchor_texts:
            anchor_texts.append(clean)

    return {
        "name": name,
        "description": description,
        "proposed_anchors": anchor_texts,
    }


def run_discovery() -> dict:
    config = get_config()
    disc_cfg = config.get("discovery", {})
    min_unknown = disc_cfg.get("min_unknown_for_clustering", 5)
    max_repr = disc_cfg.get("max_representative_samples", 5)

    unknown_items = collect_unknown_content()
    unknown_count = len(unknown_items)

    if unknown_count < min_unknown:
        return {
            "status": "insufficient_data",
            "unknown_count": unknown_count,
            "clusters_found": 0,
            "candidates_created": 0,
            "message": f"仅有 {unknown_count} 条未知内容，至少需要 {min_unknown} 条才能聚类",
        }

    logger.info("Collecting %d unknown items for clustering", unknown_count)
    valid_ids, embeddings, valid_items = retrieve_embeddings(unknown_items)

    if len(valid_items) < min_unknown:
        return {
            "status": "insufficient_data",
            "unknown_count": len(valid_items),
            "clusters_found": 0,
            "candidates_created": 0,
            "message": f"有效嵌入仅 {len(valid_items)} 条，不足以聚类",
        }

    labels, n_clusters = run_clustering(embeddings)
    logger.info("HDBSCAN found %d clusters from %d items", n_clusters, len(valid_items))

    if n_clusters == 0:
        return {
            "status": "ok",
            "unknown_count": unknown_count,
            "clusters_found": 0,
            "candidates_created": 0,
            "message": "未发现有效聚类，所有未知内容可能过于分散",
        }

    now = datetime.now().isoformat()
    candidates_created = 0

    for cluster_label in range(n_clusters):
        cluster_mask = labels == cluster_label
        cluster_indices = np.where(cluster_mask)[0]
        cluster_texts = [valid_items[i]["clean_text"] for i in cluster_indices]
        cluster_embeddings = embeddings[cluster_indices]

        repr_indices = pick_representative_indices(cluster_embeddings, max_repr)
        repr_content_ids = [valid_items[cluster_indices[i]]["id"] for i in repr_indices]
        repr_texts = [cluster_texts[i] for i in repr_indices]

        label_info = generate_candidate_label(repr_texts, cluster_label)

        candidate_id = "cand_" + uuid.uuid4().hex[:12]

        conn = get_connection()
        try:
            conn.execute(
                """INSERT INTO candidate_topics
                   (id, name, description, sample_count, cluster_method,
                    representative_ids_json, proposed_anchors_json,
                    status, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
                (
                    candidate_id,
                    label_info["name"],
                    label_info["description"],
                    len(cluster_indices),
                    disc_cfg.get("method", "hdbscan"),
                    json.dumps(repr_content_ids, ensure_ascii=False),
                    json.dumps(label_info["proposed_anchors"], ensure_ascii=False),
                    now,
                ),
            )
            conn.commit()
            candidates_created += 1
            logger.info("Candidate %s created: %s (%d samples)",
                        candidate_id, label_info["name"], len(cluster_indices))
        finally:
            conn.close()

    return {
        "status": "ok",
        "unknown_count": unknown_count,
        "clusters_found": n_clusters,
        "candidates_created": candidates_created,
        "message": f"发现 {n_clusters} 个聚类，创建 {candidates_created} 个候选主题",
    }
