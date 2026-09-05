import json
from typing import Optional

from fastapi import APIRouter
from backend.db.database import get_connection

router = APIRouter(prefix="/api/credibility", tags=["credibility"])


@router.get("/overview")
async def credibility_overview(company_id: Optional[str] = None):
    conn = get_connection()
    try:
        company_filter = ""
        company_params = []
        if company_id:
            company_filter = "WHERE rc.company_id = ?"
            company_params = [company_id]

        score_rows = conn.execute(f"""
            SELECT ca.credibility_score, ca.credibility_factors,
                   ca.credibility_level, rc.platform,
                   rc.id, rc.content, rc.title
            FROM content_analysis ca
            JOIN raw_content rc ON ca.content_id = rc.id
            {company_filter}
        """, company_params).fetchall()

        if not score_rows:
            return {
                "distribution": {"high": 0, "medium": 0, "low": 0, "uncertain": 0},
                "avg_score": 0,
                "factor_averages": {},
                "platform_trust": {},
                "top_low_credibility": [],
            }

        distribution = {"high": 0, "medium": 0, "low": 0, "uncertain": 0}
        total_score = 0
        factor_sums = {}
        factor_counts = {}
        platform_sums = {}
        platform_counts = {}
        scored_items = []

        for row in score_rows:
            level = row["credibility_level"] or "uncertain"
            if level in distribution:
                distribution[level] += 1
            else:
                distribution["uncertain"] += 1

            score = row["credibility_score"]
            if score is not None:
                total_score += score
                scored_items.append({
                    "id": row["id"],
                    "title": row["title"] or (row["content"] or "")[:60],
                    "content": (row["content"] or "")[:120],
                    "credibility_score": score,
                    "credibility_level": level,
                    "platform": row["platform"],
                })

            factors_raw = row["credibility_factors"]
            if factors_raw:
                try:
                    factors = json.loads(factors_raw) if isinstance(factors_raw, str) else factors_raw
                    for k, v in factors.items():
                        factor_sums[k] = factor_sums.get(k, 0) + v
                        factor_counts[k] = factor_counts.get(k, 0) + 1
                except (json.JSONDecodeError, TypeError):
                    pass

            platform = row["platform"] or "unknown"
            if score is not None:
                platform_sums[platform] = platform_sums.get(platform, 0) + score
                platform_counts[platform] = platform_counts.get(platform, 0) + 1

        count = len(score_rows)
        avg_score = round(total_score / count, 4) if count > 0 else 0

        factor_averages = {}
        for k in factor_sums:
            factor_averages[k] = round(factor_sums[k] / factor_counts[k], 4)

        platform_trust = {}
        for p in platform_sums:
            platform_trust[p] = round(platform_sums[p] / platform_counts[p], 4)

        scored_items.sort(key=lambda x: x["credibility_score"])
        top_low = scored_items[:10]

        return {
            "distribution": distribution,
            "avg_score": avg_score,
            "factor_averages": factor_averages,
            "platform_trust": platform_trust,
            "top_low_credibility": top_low,
        }
    finally:
        conn.close()
