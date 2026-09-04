import csv
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict

from backend.db.database import get_connection
from backend.ingestion.cleaner import clean_text, compute_content_hash, compute_clean_text_hash


def _generate_id() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def import_csv(file_path: str) -> Dict:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {file_path}")

    stats = {"total": 0, "imported": 0, "skipped_duplicate": 0, "errors": 0, "error_details": []}

    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    stats["total"] = len(rows)
    conn = get_connection()
    try:
        for row_num, row in enumerate(rows, start=1):
            try:
                content = row.get("content", "").strip()
                if not content:
                    stats["errors"] += 1
                    stats["error_details"].append(f"Row {row_num}: empty content")
                    continue

                platform = row.get("platform", "").strip()
                if not platform:
                    stats["errors"] += 1
                    stats["error_details"].append(f"Row {row_num}: empty platform")
                    continue

                company_id = row.get("company_id", "mihoyo").strip()
                company_name = row.get("company_name", "米哈游").strip()
                publish_time = row.get("publish_time", "").strip() or row.get("publish_date", "").strip() or None
                crawl_time = row.get("crawl_time", "").strip() or _now()

                content_hash = compute_content_hash(platform, content, publish_time or "")

                existing = conn.execute(
                    "SELECT id FROM raw_content WHERE content_hash = ?", (content_hash,)
                ).fetchone()
                if existing:
                    stats["skipped_duplicate"] += 1
                    continue

                ct = clean_text(content)
                ct_hash = compute_clean_text_hash(ct)

                content_id = row.get("id", "").strip() or _generate_id()

                conn.execute(
                    """INSERT INTO raw_content
                       (id, company_id, company_name, product_name, platform, source_type,
                        author, author_id, followers, content, clean_text, clean_text_hash,
                        content_hash, publish_time, crawl_time, url,
                        likes, comments, shares, title, tags, metadata_json, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        content_id,
                        company_id,
                        company_name,
                        row.get("product_name", "").strip() or None,
                        platform,
                        row.get("source_type", "social_media").strip(),
                        row.get("author", "").strip() or None,
                        row.get("author_id", "").strip() or None,
                        int(row.get("followers", 0) or 0),
                        content,
                        ct,
                        ct_hash,
                        content_hash,
                        publish_time,
                        crawl_time,
                        row.get("url", "").strip() or None,
                        int(row.get("likes", 0) or 0),
                        int(row.get("comments", 0) or 0),
                        int(row.get("shares", 0) or 0),
                        row.get("title", "").strip() or None,
                        row.get("tags", "").strip() or None,
                        row.get("metadata_json", "").strip() or None,
                        _now(),
                    ),
                )
                stats["imported"] += 1

            except Exception as e:
                stats["errors"] += 1
                stats["error_details"].append(f"Row {row_num}: {str(e)}")

        conn.commit()
    finally:
        conn.close()

    return stats


def import_from_dict(records: List[Dict]) -> Dict:
    stats = {"total": len(records), "imported": 0, "skipped_duplicate": 0, "errors": 0, "error_details": []}

    conn = get_connection()
    try:
        for idx, row in enumerate(records, start=1):
            try:
                content = row.get("content", "").strip()
                platform = row.get("platform", "").strip()
                if not content or not platform:
                    stats["errors"] += 1
                    stats["error_details"].append(f"Record {idx}: missing content or platform")
                    continue

                publish_time = row.get("publish_time", "") or None
                content_hash = compute_content_hash(platform, content, publish_time or "")

                existing = conn.execute(
                    "SELECT id FROM raw_content WHERE content_hash = ?", (content_hash,)
                ).fetchone()
                if existing:
                    stats["skipped_duplicate"] += 1
                    continue

                ct = clean_text(content)
                ct_hash = compute_clean_text_hash(ct)
                content_id = row.get("id", "") or _generate_id()
                crawl_time = row.get("crawl_time", "") or _now()

                conn.execute(
                    """INSERT INTO raw_content
                       (id, company_id, company_name, product_name, platform, source_type,
                        author, author_id, followers, content, clean_text, clean_text_hash,
                        content_hash, publish_time, crawl_time, url,
                        likes, comments, shares, title, tags, metadata_json, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        content_id,
                        row.get("company_id", "mihoyo"),
                        row.get("company_name", "米哈游"),
                        row.get("product_name"),
                        platform,
                        row.get("source_type", "social_media"),
                        row.get("author"),
                        row.get("author_id"),
                        int(row.get("followers", 0) or 0),
                        content,
                        ct,
                        ct_hash,
                        content_hash,
                        publish_time,
                        crawl_time,
                        row.get("url"),
                        int(row.get("likes", 0) or 0),
                        int(row.get("comments", 0) or 0),
                        int(row.get("shares", 0) or 0),
                        row.get("title"),
                        row.get("tags"),
                        row.get("metadata_json"),
                        _now(),
                    ),
                )
                stats["imported"] += 1

            except Exception as e:
                stats["errors"] += 1
                stats["error_details"].append(f"Record {idx}: {str(e)}")

        conn.commit()
    finally:
        conn.close()

    return stats
