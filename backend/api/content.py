from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from backend.db.database import get_connection

router = APIRouter(prefix="/api", tags=["content"])


@router.get("/content")
async def list_content(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source: Optional[str] = None,
    sentiment: Optional[str] = None,
    topic_id: Optional[str] = None,
    search: Optional[str] = None,
    risk_level: Optional[str] = None,
    sort_by: str = Query("publish_time", pattern="^(publish_time|risk_level|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    conn = get_connection()
    try:
        conditions = []
        params = []

        if source:
            conditions.append("rc.source = ?")
            params.append(source)
        if sentiment:
            conditions.append("ca.sentiment = ?")
            params.append(sentiment)
        if topic_id:
            conditions.append("ca.topic_id = ?")
            params.append(topic_id)
        if search:
            conditions.append("(rc.title LIKE ? OR rc.clean_text LIKE ?)")
            params.extend([f"%{search}%", f"%{search}%"])
        if risk_level:
            conditions.append("ca.risk_level = ?")
            params.append(risk_level)
        if date_from:
            conditions.append("rc.publish_time >= ?")
            params.append(date_from)
        if date_to:
            conditions.append("rc.publish_time <= ?")
            params.append(date_to + " 23:59:59")

        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)

        order_col = f"rc.{sort_by}" if sort_by != "risk_level" else "ca.risk_level"
        order_dir = sort_order.upper()

        count_sql = f"""
            SELECT COUNT(*) as total
            FROM raw_content rc
            LEFT JOIN content_analysis ca ON rc.id = ca.content_id
            {where_clause}
        """
        total = conn.execute(count_sql, params).fetchone()["total"]

        data_sql = f"""
            SELECT
                rc.id, rc.source, rc.url, rc.publish_time, rc.crawl_time,
                rc.title, rc.clean_text, rc.content_hash, rc.created_at,
                ca.topic_id, ca.sentiment, ca.sentiment_confidence,
                ca.risk_level, ca.risk_confidence, ca.summary,
                ca.review_status, ca.topic_similarity
            FROM raw_content rc
            LEFT JOIN content_analysis ca ON rc.id = ca.content_id
            {where_clause}
            ORDER BY {order_col} {order_dir}
            LIMIT ? OFFSET ?
        """
        rows = conn.execute(data_sql, params + [page_size, (page - 1) * page_size]).fetchall()

        items = [dict(r) for r in rows]

        sources = [r[0] for r in conn.execute(
            "SELECT DISTINCT source FROM raw_content ORDER BY source"
        ).fetchall()]

        return {
            "items": items,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size,
            },
            "filters": {
                "sources": sources,
            },
        }
    finally:
        conn.close()


@router.get("/content/{content_id}")
async def get_content(content_id: str):
    conn = get_connection()
    try:
        row = conn.execute(
            """SELECT
                rc.id, rc.source, rc.url, rc.publish_time, rc.crawl_time,
                rc.title, rc.raw_text, rc.clean_text, rc.clean_text_hash,
                rc.content_hash, rc.language, rc.metadata_json, rc.created_at,
                ca.topic_id, ca.sentiment, ca.sentiment_confidence,
                ca.risk_level, ca.risk_confidence, ca.summary,
                ca.theory_perspective, ca.llm_model, ca.analysis_version,
                ca.review_status, ca.topic_similarity
            FROM raw_content rc
            LEFT JOIN content_analysis ca ON rc.id = ca.content_id
            WHERE rc.id = ?""",
            (content_id,),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Content not found")

        return dict(row)
    finally:
        conn.close()


@router.get("/stats/overview")
async def stats_overview():
    conn = get_connection()
    try:
        total = conn.execute("SELECT COUNT(*) as c FROM raw_content").fetchone()["c"]
        analyzed = conn.execute("SELECT COUNT(*) as c FROM content_analysis").fetchone()["c"]

        sentiment_rows = conn.execute("""
            SELECT sentiment, COUNT(*) as count
            FROM content_analysis
            GROUP BY sentiment
        """).fetchall()
        sentiment_dist = {r["sentiment"]: r["count"] for r in sentiment_rows}

        negative = sentiment_dist.get("negative", 0)
        negative_rate = round(negative / analyzed, 4) if analyzed > 0 else 0

        topic_rows = conn.execute("""
            SELECT t.id, t.name, COUNT(ca.content_id) as count
            FROM content_analysis ca
            JOIN topics t ON ca.topic_id = t.id
            WHERE ca.topic_id IS NOT NULL
            GROUP BY ca.topic_id
            ORDER BY count DESC
        """).fetchall()
        topic_dist = [{"topic_id": r["id"], "topic_name": r["name"], "count": r["count"]} for r in topic_rows]

        source_rows = conn.execute("""
            SELECT source, COUNT(*) as count
            FROM raw_content
            GROUP BY source
            ORDER BY count DESC
        """).fetchall()
        source_dist = {r["source"]: r["count"] for r in source_rows}

        risk_rows = conn.execute("""
            SELECT risk_level, COUNT(*) as count
            FROM content_analysis
            GROUP BY risk_level
        """).fetchall()
        risk_dist = {r["risk_level"]: r["count"] for r in risk_rows}

        high_risk_rows = conn.execute("""
            SELECT rc.id, rc.title, rc.source, rc.publish_time,
                   ca.sentiment, ca.risk_level
            FROM raw_content rc
            JOIN content_analysis ca ON rc.id = ca.content_id
            WHERE ca.risk_level IN ('high', 'medium')
            ORDER BY rc.publish_time DESC
            LIMIT 5
        """).fetchall()
        recent_high_risk = [dict(r) for r in high_risk_rows]

        trend_rows = conn.execute("""
            SELECT DATE(publish_time) as day, COUNT(*) as count
            FROM raw_content
            WHERE publish_time >= DATE('now', '-14 days')
            GROUP BY DATE(publish_time)
            ORDER BY day
        """).fetchall()
        daily_trend = [{"date": r["day"], "count": r["count"]} for r in trend_rows]

        return {
            "total_content": total,
            "total_analyzed": analyzed,
            "negative_count": negative,
            "negative_rate": negative_rate,
            "sentiment_distribution": sentiment_dist,
            "topic_distribution": topic_dist,
            "source_distribution": source_dist,
            "risk_distribution": risk_dist,
            "recent_high_risk": recent_high_risk,
            "daily_trend": daily_trend,
        }
    finally:
        conn.close()
