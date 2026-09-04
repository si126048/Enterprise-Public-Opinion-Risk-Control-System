import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.db.database import get_connection
from backend.services import embedding_service
from backend.services import vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/embedding", tags=["embedding"])


class SearchRequest(BaseModel):
    query: str
    top_k: int = 10
    source: Optional[str] = None
    sentiment: Optional[str] = None
    topic_id: Optional[str] = None
    risk_level: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    page: int = 1
    page_size: int = 20


@router.get("/status")
async def embedding_status():
    emb_health = embedding_service.health()
    vs_health = vector_store.health()

    conn = get_connection()
    try:
        total_content = conn.execute("SELECT COUNT(*) as c FROM raw_content").fetchone()["c"]
        has_clean = conn.execute(
            "SELECT COUNT(*) as c FROM raw_content WHERE clean_text IS NOT NULL AND clean_text != ''"
        ).fetchone()["c"]
        try:
            cache_count = conn.execute("SELECT COUNT(*) as c FROM embedding_cache").fetchone()["c"]
        except Exception:
            cache_count = 0
    finally:
        conn.close()

    return {
        "embedding_model": emb_health,
        "vector_store": vs_health,
        "content": {
            "total": total_content,
            "with_clean_text": has_clean,
            "embedded": vs_health.get("content_count", 0),
            "pending": max(0, has_clean - vs_health.get("content_count", 0)),
        },
        "cache_entries": cache_count,
    }


@router.post("/content")
async def embed_content(batch_size: int = 32):
    conn = get_connection()
    try:
        embedded_ids = set()
        try:
            vs_health = vector_store.health()
            embedded_count = vs_health.get("content_count", 0)
        except Exception:
            embedded_count = 0

        rows = conn.execute("""
            SELECT id, clean_text, clean_text_hash
            FROM raw_content
            WHERE clean_text IS NOT NULL AND clean_text != ''
            ORDER BY created_at DESC
        """).fetchall()

        to_embed = []
        to_embed_hashes = []
        to_embed_ids = []

        for row in rows:
            chroma_id = f"content_{row['id']}"
            try:
                existing = vector_store._get_content_collection().get(ids=[chroma_id])
                if existing and existing["ids"]:
                    continue
            except Exception:
                pass

            to_embed.append(row["clean_text"])
            to_embed_hashes.append(row["clean_text_hash"])
            to_embed_ids.append(row["id"])

        if not to_embed:
            return {"status": "ok", "message": "All content already embedded", "embedded_count": 0}

        vectors = embedding_service.embed_batch(to_embed, to_embed_hashes)

        chroma_ids = [f"content_{cid}" for cid in to_embed_ids]
        metadatas = []
        for row_id, text in zip(to_embed_ids, to_embed):
            metadatas.append({
                "content_id": row_id,
                "text_preview": text[:200],
            })

        vector_store.add_content_embeddings(chroma_ids, vectors, metadatas)

        return {
            "status": "ok",
            "embedded_count": len(to_embed_ids),
            "total_pending": len(to_embed),
            "message": f"Embedded {len(to_embed_ids)} content items",
        }
    finally:
        conn.close()


@router.post("/search")
async def semantic_search(req: SearchRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    query_vector = embedding_service.embed_text(req.query)

    where_filter = None
    if req.source:
        where_filter = {"source": req.source}

    search_top_k = req.top_k * 3 if req.top_k < 100 else req.top_k
    results = vector_store.search_content(query_vector, top_k=search_top_k, where=where_filter)

    if not results:
        return {"query": req.query, "results": [], "total": 0, "pagination": {"page": 1, "page_size": req.page_size, "total": 0, "total_pages": 0}}

    content_ids = [item["metadata"].get("content_id", "") for item in results]

    conn = get_connection()
    try:
        placeholders = ",".join("?" * len(content_ids))
        filter_conditions = [f"rc.id IN ({placeholders})"]
        filter_params = list(content_ids)

        if req.sentiment:
            filter_conditions.append("ca.sentiment = ?")
            filter_params.append(req.sentiment)
        if req.topic_id:
            filter_conditions.append("ca.topic_id = ?")
            filter_params.append(req.topic_id)
        if req.risk_level:
            filter_conditions.append("ca.risk_level = ?")
            filter_params.append(req.risk_level)
        if req.date_from:
            filter_conditions.append("rc.publish_time >= ?")
            filter_params.append(req.date_from)
        if req.date_to:
            filter_conditions.append("rc.publish_time <= ?")
            filter_params.append(req.date_to + " 23:59:59")

        where_sql = " AND ".join(filter_conditions)

        count = conn.execute(
            f"SELECT COUNT(*) as c FROM raw_content rc LEFT JOIN content_analysis ca ON rc.id = ca.content_id WHERE {where_sql}",
            filter_params,
        ).fetchone()["c"]

        offset = (req.page - 1) * req.page_size
        rows = conn.execute(
            f"""SELECT rc.id, rc.source, rc.title, rc.clean_text, rc.publish_time,
                       ca.sentiment, ca.risk_level, ca.topic_id
                FROM raw_content rc
                LEFT JOIN content_analysis ca ON rc.id = ca.content_id
                WHERE {where_sql}
                ORDER BY rc.publish_time DESC
                LIMIT ? OFFSET ?""",
            filter_params + [req.page_size, offset],
        ).fetchall()

        result_map = {}
        for item in results:
            cid = item["metadata"].get("content_id", "")
            result_map[cid] = item

        enriched = []
        for row in rows:
            cid = row["id"]
            item = result_map.get(cid)
            if not item:
                continue
            entry = dict(row)
            entry["distance"] = item["distance"]
            entry["text_preview"] = item["metadata"].get("text_preview", "")
            enriched.append(entry)

        total_pages = (count + req.page_size - 1) // req.page_size if count > 0 else 0

        return {
            "query": req.query,
            "results": enriched,
            "total": count,
            "pagination": {
                "page": req.page,
                "page_size": req.page_size,
                "total": count,
                "total_pages": total_pages,
            },
        }
    finally:
        conn.close()


@router.get("/health")
async def embedding_health():
    return {
        "embedding": embedding_service.health(),
        "vector_store": vector_store.health(),
    }
