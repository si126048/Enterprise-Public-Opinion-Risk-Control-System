from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from backend.db.database import get_connection

router = APIRouter(prefix="/api", tags=["content"])


@router.get("/content")
async def list_content(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    company_id: Optional[str] = None,
    product_name: Optional[str] = None,
    platform: Optional[str] = None,
    sentiment: Optional[str] = None,
    topic_id: Optional[str] = None,
    search: Optional[str] = None,
    risk_level: Optional[str] = None,
    sort_by: str = Query("publish_time", pattern="^(publish_time|likes|created_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    conn = get_connection()
    try:
        conditions = []
        params = []

        if company_id:
            conditions.append("rc.company_id = ?")
            params.append(company_id)
        if product_name:
            conditions.append("rc.product_name = ?")
            params.append(product_name)
        if platform:
            conditions.append("rc.platform = ?")
            params.append(platform)
        if sentiment:
            conditions.append("ca.sentiment = ?")
            params.append(sentiment)
        if topic_id:
            conditions.append("ca.topic_id = ?")
            params.append(topic_id)
        if search:
            conditions.append("(rc.title LIKE ? OR rc.content LIKE ?)")
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

        order_col = f"rc.{sort_by}"
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
                rc.id, rc.company_id, rc.company_name, rc.product_name,
                rc.platform, rc.source_type, rc.author, rc.followers,
                rc.content, rc.title, rc.url, rc.publish_time, rc.crawl_time,
                rc.likes, rc.comments, rc.shares, rc.tags, rc.created_at,
                ca.topic_id, ca.sentiment, ca.sentiment_confidence,
                ca.risk_level, ca.risk_confidence, ca.summary,
                ca.credibility_score, ca.community_heat_score,
                ca.review_status, ca.topic_similarity
            FROM raw_content rc
            LEFT JOIN content_analysis ca ON rc.id = ca.content_id
            {where_clause}
            ORDER BY {order_col} {order_dir}
            LIMIT ? OFFSET ?
        """
        rows = conn.execute(data_sql, params + [page_size, (page - 1) * page_size]).fetchall()
        items = [dict(r) for r in rows]

        platforms = [r[0] for r in conn.execute(
            "SELECT DISTINCT platform FROM raw_content ORDER BY platform"
        ).fetchall()]
        products = [r[0] for r in conn.execute(
            "SELECT DISTINCT product_name FROM raw_content WHERE product_name IS NOT NULL ORDER BY product_name"
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
                "platforms": platforms,
                "products": products,
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
                rc.id, rc.company_id, rc.company_name, rc.product_name,
                rc.platform, rc.source_type, rc.author, rc.author_id,
                rc.followers, rc.content, rc.clean_text, rc.clean_text_hash,
                rc.content_hash, rc.title, rc.url, rc.publish_time, rc.crawl_time,
                rc.likes, rc.comments, rc.shares, rc.tags, rc.metadata_json,
                rc.created_at,
                ca.topic_id, ca.sentiment, ca.sentiment_confidence,
                ca.risk_level, ca.risk_confidence, ca.summary,
                ca.credibility_score, ca.credibility_factors,
                ca.community_heat_score, ca.risk_advice,
                ca.llm_model, ca.analysis_version,
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
async def stats_overview(company_id: Optional[str] = None):
    conn = get_connection()
    try:
        company_filter = ""
        company_params = []
        if company_id:
            company_filter = "WHERE rc.company_id = ?"
            company_params = [company_id]

        total = conn.execute(f"SELECT COUNT(*) as c FROM raw_content rc {company_filter}", company_params).fetchone()["c"]
        analyzed = conn.execute(f"""
            SELECT COUNT(*) as c FROM content_analysis ca
            JOIN raw_content rc ON ca.content_id = rc.id {company_filter}
        """, company_params).fetchone()["c"]

        sentiment_rows = conn.execute(f"""
            SELECT ca.sentiment, COUNT(*) as count
            FROM content_analysis ca
            JOIN raw_content rc ON ca.content_id = rc.id
            {company_filter}
            GROUP BY ca.sentiment
        """, company_params).fetchall()
        sentiment_dist = {r["sentiment"]: r["count"] for r in sentiment_rows}

        negative = sentiment_dist.get("negative", 0)
        negative_rate = round(negative / analyzed, 4) if analyzed > 0 else 0

        topic_rows = conn.execute(f"""
            SELECT t.id, t.name, COUNT(ca.content_id) as count
            FROM content_analysis ca
            JOIN raw_content rc ON ca.content_id = rc.id
            JOIN topics t ON ca.topic_id = t.id
            {"WHERE" if not company_filter else company_filter + " AND"} ca.topic_id IS NOT NULL
            GROUP BY ca.topic_id
            ORDER BY count DESC
        """, company_params).fetchall() if company_filter else conn.execute("""
            SELECT t.id, t.name, COUNT(ca.content_id) as count
            FROM content_analysis ca
            JOIN topics t ON ca.topic_id = t.id
            WHERE ca.topic_id IS NOT NULL
            GROUP BY ca.topic_id
            ORDER BY count DESC
        """).fetchall()
        topic_dist = [{"topic_id": r["id"], "topic_name": r["name"], "count": r["count"]} for r in topic_rows]

        platform_rows = conn.execute(f"""
            SELECT rc.platform, COUNT(*) as count
            FROM raw_content rc
            {company_filter}
            GROUP BY rc.platform
            ORDER BY count DESC
        """, company_params).fetchall()
        platform_dist = {r["platform"]: r["count"] for r in platform_rows}

        product_rows = conn.execute(f"""
            SELECT rc.product_name, COUNT(*) as count
            FROM raw_content rc
            {company_filter}
            WHERE rc.product_name IS NOT NULL
            GROUP BY rc.product_name
            ORDER BY count DESC
        """, company_params).fetchall()
        product_dist = {r["product_name"]: r["count"] for r in product_rows}

        risk_rows = conn.execute(f"""
            SELECT ca.risk_level, COUNT(*) as count
            FROM content_analysis ca
            JOIN raw_content rc ON ca.content_id = rc.id
            {company_filter}
            GROUP BY ca.risk_level
        """, company_params).fetchall()
        risk_dist = {r["risk_level"]: r["count"] for r in risk_rows}

        high_risk_count = conn.execute(f"""
            SELECT COUNT(*) as c FROM content_analysis ca
            JOIN raw_content rc ON ca.content_id = rc.id
            {company_filter}
            {"AND" if company_filter else "WHERE"} ca.risk_level = 'high'
        """, company_params).fetchone()["c"]

        trend_rows = conn.execute(f"""
            SELECT DATE(rc.publish_time) as day, COUNT(*) as total,
                   SUM(CASE WHEN ca.sentiment = 'negative' THEN 1 ELSE 0 END) as negative
            FROM raw_content rc
            LEFT JOIN content_analysis ca ON rc.id = ca.content_id
            {company_filter}
            {"WHERE" if not company_filter else company_filter + " AND"} rc.publish_time >= DATE('now', '-14 days')
            GROUP BY DATE(rc.publish_time)
            ORDER BY day
        """, company_params).fetchall()
        trend_dates = [r["day"] for r in trend_rows]
        trend_total = [r["total"] for r in trend_rows]
        trend_negative = [r["negative"] for r in trend_rows]

        heat_row = conn.execute(f"""
            SELECT AVG(ca.community_heat_score) as avg_heat
            FROM content_analysis ca
            JOIN raw_content rc ON ca.content_id = rc.id
            {company_filter}
        """, company_params).fetchone()
        avg_heat = round(heat_row["avg_heat"] or 0, 1)

        high_risk_where = f"{company_filter}{'AND' if company_filter else 'WHERE'} ca.risk_level = 'high'" if company_filter else "WHERE ca.risk_level = 'high'"
        high_risk_rows = conn.execute(f"""
            SELECT rc.id, rc.title, rc.platform, rc.author, rc.publish_time,
                   ca.sentiment, ca.risk_level, ca.summary
            FROM raw_content rc
            JOIN content_analysis ca ON rc.id = ca.content_id
            {high_risk_where}
            ORDER BY rc.publish_time DESC
            LIMIT 5
        """, company_params).fetchall()
        recent_high_risk = [dict(r) for r in high_risk_rows]

        return {
            "total_count": total,
            "total_analyzed": analyzed,
            "negative_count": negative,
            "negative_rate": negative_rate,
            "high_risk_count": high_risk_count,
            "community_heat_score": avg_heat,
            "sentiment_distribution": sentiment_dist,
            "topic_distribution": topic_dist,
            "platform_distribution": platform_dist,
            "product_distribution": product_dist,
            "risk_distribution": risk_dist,
            "trend_data": {
                "dates": trend_dates,
                "total": trend_total,
                "negative": trend_negative,
            },
            "recent_high_risk": recent_high_risk,
        }
    finally:
        conn.close()


@router.get("/stats/product/{product_name}")
async def stats_product(product_name: str, company_id: Optional[str] = None):
    conn = get_connection()
    try:
        base_filter = "WHERE rc.product_name = ?"
        base_params = [product_name]
        if company_id:
            base_filter += " AND rc.company_id = ?"
            base_params.append(company_id)

        row = conn.execute(f"""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN ca.sentiment = 'negative' THEN 1 ELSE 0 END) as negative,
                   SUM(CASE WHEN ca.risk_level = 'high' THEN 1 ELSE 0 END) as high_risk
            FROM raw_content rc
            LEFT JOIN content_analysis ca ON rc.id = ca.content_id
            {base_filter}
        """, base_params).fetchone()

        if not row or row["total"] == 0:
            raise HTTPException(status_code=404, detail="Product not found")

        platform_rows = conn.execute(f"""
            SELECT rc.platform, COUNT(*) as count
            FROM raw_content rc
            {base_filter}
            GROUP BY rc.platform
            ORDER BY count DESC
        """, base_params).fetchall()
        platform_dist = {r["platform"]: r["count"] for r in platform_rows}

        sentiment_rows = conn.execute(f"""
            SELECT ca.sentiment, COUNT(*) as count
            FROM content_analysis ca
            JOIN raw_content rc ON ca.content_id = rc.id
            {base_filter}
            GROUP BY ca.sentiment
        """, base_params).fetchall()
        sentiment_dist = {r["sentiment"]: r["count"] for r in sentiment_rows}

        topic_rows = conn.execute(f"""
            SELECT t.id, t.name, COUNT(ca.content_id) as count
            FROM content_analysis ca
            JOIN raw_content rc ON ca.content_id = rc.id
            JOIN topics t ON ca.topic_id = t.id
            {base_filter} AND ca.topic_id IS NOT NULL
            GROUP BY ca.topic_id
            ORDER BY count DESC
        """, base_params).fetchall()
        topic_dist = [{"topic_id": r["id"], "topic_name": r["name"], "count": r["count"]} for r in topic_rows]

        return {
            "product": product_name,
            "total": row["total"],
            "negative": row["negative"],
            "high_risk": row["high_risk"],
            "negative_rate": round(row["negative"] / row["total"], 4) if row["total"] > 0 else 0,
            "platform_distribution": platform_dist,
            "sentiment_distribution": sentiment_dist,
            "topic_distribution": topic_dist,
        }
    finally:
        conn.close()
