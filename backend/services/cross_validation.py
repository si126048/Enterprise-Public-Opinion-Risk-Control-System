import uuid
import logging
from datetime import datetime

from backend.db.database import get_connection
from backend.services.llm_service import get_all_providers

logger = logging.getLogger(__name__)

MODEL_NAMES = {
    "mock": "mock-v1",
    "deepseek": "deepseek-simulated-v1",
    "qwen": "qwen-simulated-v1",
}


def run_cross_validation(content_id=None, batch_size=50):
    conn = get_connection()
    try:
        if content_id:
            rows = conn.execute(
                """SELECT rc.id, rc.clean_text, ca.topic_id, t.name as topic_name
                   FROM raw_content rc
                   LEFT JOIN content_analysis ca ON rc.id = ca.content_id
                   LEFT JOIN topics t ON ca.topic_id = t.id
                   WHERE rc.id = ?""",
                (content_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT rc.id, rc.clean_text, ca.topic_id, t.name as topic_name
                   FROM raw_content rc
                   LEFT JOIN content_analysis ca ON rc.id = ca.content_id
                   LEFT JOIN topics t ON ca.topic_id = t.id
                   WHERE rc.clean_text IS NOT NULL AND rc.clean_text != ''
                   LIMIT ?""",
                (batch_size,),
            ).fetchall()

        providers = get_all_providers()
        processed = 0

        for row in rows:
            text = row["clean_text"] or ""
            topic_name = row["topic_name"] or "未分类"

            for provider_name, provider in providers:
                result_id = str(uuid.uuid4())
                model_name = MODEL_NAMES.get(provider_name, provider_name)

                try:
                    result = provider.analyze(text, topic_name)

                    existing = conn.execute(
                        """SELECT id FROM cross_validation_results
                           WHERE content_id = ? AND provider = ?""",
                        (row["id"], provider_name),
                    ).fetchone()

                    if existing:
                        conn.execute(
                            """UPDATE cross_validation_results
                               SET sentiment=?, sentiment_confidence=?,
                                   risk_level=?, risk_confidence=?,
                                   summary=?, theory_perspective=?,
                                   model=?, created_at=?
                               WHERE id = ?""",
                            (
                                result.sentiment, result.sentiment_confidence,
                                result.risk_level, result.risk_confidence,
                                result.summary, result.theory_perspective,
                                model_name, datetime.now().isoformat(),
                                existing["id"],
                            ),
                        )
                    else:
                        conn.execute(
                            """INSERT INTO cross_validation_results
                               (id, content_id, provider, model, sentiment,
                                sentiment_confidence, risk_level, risk_confidence,
                                summary, theory_perspective, created_at)
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                            (
                                result_id, row["id"], provider_name, model_name,
                                result.sentiment, result.sentiment_confidence,
                                result.risk_level, result.risk_confidence,
                                result.summary, result.theory_perspective,
                                datetime.now().isoformat(),
                            ),
                        )
                    processed += 1
                except Exception as e:
                    logger.warning("Cross-validation failed for %s/%s: %s",
                                   row["id"], provider_name, e)

        conn.commit()
        return {"processed": processed, "content_count": len(rows), "provider_count": len(providers)}
    finally:
        conn.close()


def get_validation_results(content_id=None, limit=100):
    conn = get_connection()
    try:
        if content_id:
            rows = conn.execute(
                """SELECT cvr.*, rc.clean_text, rc.source, rc.title
                   FROM cross_validation_results cvr
                   JOIN raw_content rc ON cvr.content_id = rc.id
                   WHERE cvr.content_id = ?
                   ORDER BY cvr.provider""",
                (content_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT cvr.*, rc.clean_text, rc.source, rc.title
                   FROM cross_validation_results cvr
                   JOIN raw_content rc ON cvr.content_id = rc.id
                   ORDER BY cvr.created_at DESC
                   LIMIT ?""",
                (limit,),
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_validation_summary():
    conn = get_connection()
    try:
        total_results = conn.execute(
            "SELECT COUNT(*) FROM cross_validation_results"
        ).fetchone()[0]

        provider_stats = {}
        for provider in ["mock", "deepseek", "qwen"]:
            sentiment_rows = conn.execute(
                """SELECT sentiment, COUNT(*) as cnt
                   FROM cross_validation_results WHERE provider = ?
                   GROUP BY sentiment""",
                (provider,),
            ).fetchall()
            risk_rows = conn.execute(
                """SELECT risk_level, COUNT(*) as cnt
                   FROM cross_validation_results WHERE provider = ?
                   GROUP BY risk_level""",
                (provider,),
            ).fetchall()
            provider_stats[provider] = {
                "sentiment": {r["sentiment"]: r["cnt"] for r in sentiment_rows},
                "risk": {r["risk_level"]: r["cnt"] for r in risk_rows},
            }

        content_count = conn.execute(
            "SELECT COUNT(DISTINCT content_id) FROM cross_validation_results"
        ).fetchone()[0]

        agreement_sql = """
            SELECT content_id,
                   COUNT(DISTINCT sentiment) as sent_variants,
                   COUNT(DISTINCT risk_level) as risk_variants
            FROM cross_validation_results
            GROUP BY content_id
            HAVING COUNT(DISTINCT provider) = 3
        """
        agreement_rows = conn.execute(agreement_sql).fetchall()
        full_agree = sum(1 for r in agreement_rows
                         if r["sent_variants"] == 1 and r["risk_variants"] == 1)
        partial_agree = sum(1 for r in agreement_rows
                            if r["sent_variants"] == 1 or r["risk_variants"] == 1)
        total_compared = len(agreement_rows)

        return {
            "total_results": total_results,
            "content_count": content_count,
            "provider_stats": provider_stats,
            "full_agreement": full_agree,
            "partial_agreement": partial_agree,
            "total_compared": total_compared,
            "full_agreement_rate": round(full_agree / total_compared, 3) if total_compared > 0 else 0,
            "partial_agreement_rate": round(partial_agree / total_compared, 3) if total_compared > 0 else 0,
        }
    finally:
        conn.close()
