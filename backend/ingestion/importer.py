import csv
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Tuple

from backend.db.database import get_connection
from backend.ingestion.cleaner import clean_text, compute_content_hash, compute_clean_text_hash


def _generate_id() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


def _upsert_source_ledger(conn, source_name: str, count: int):
    existing = conn.execute(
        "SELECT id, record_count FROM source_ledger WHERE source_name = ?",
        (source_name,),
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE source_ledger SET record_count = record_count + ? WHERE id = ?",
            (count, existing["id"]),
        )
    else:
        conn.execute(
            """INSERT INTO source_ledger
               (id, source_name, data_type, access_date, record_count, verified)
               VALUES (?, ?, 'csv_import', ?, ?, 0)""",
            (
                str(uuid.uuid4()),
                source_name,
                datetime.utcnow().strftime("%Y-%m-%d"),
                count,
            ),
        )


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
                raw_text = row.get("raw_text", "").strip()
                if not raw_text:
                    stats["errors"] += 1
                    stats["error_details"].append(f"Row {row_num}: empty raw_text")
                    continue

                source = row.get("source", "").strip()
                if not source:
                    stats["errors"] += 1
                    stats["error_details"].append(f"Row {row_num}: empty source")
                    continue

                publish_time = row.get("publish_time", "").strip() or None
                crawl_time = row.get("crawl_time", "").strip()
                if not crawl_time:
                    crawl_time = _now()

                content_hash = compute_content_hash(source, raw_text, publish_time or "")

                existing = conn.execute(
                    "SELECT id FROM raw_content WHERE content_hash = ?", (content_hash,)
                ).fetchone()
                if existing:
                    stats["skipped_duplicate"] += 1
                    continue

                ct = clean_text(raw_text)
                ct_hash = compute_clean_text_hash(ct)

                content_id = row.get("id", "").strip() or _generate_id()
                title = row.get("title", "").strip() or None
                url = row.get("url", "").strip() or None
                metadata_json = row.get("metadata_json", "").strip() or None

                conn.execute(
                    """INSERT INTO raw_content
                       (id, source, url, publish_time, crawl_time, title,
                        raw_text, clean_text, clean_text_hash, content_hash,
                        metadata_json, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        content_id, source, url, publish_time, crawl_time, title,
                        raw_text, ct, ct_hash, content_hash,
                        metadata_json, _now(),
                    ),
                )
                stats["imported"] += 1

            except Exception as e:
                stats["errors"] += 1
                stats["error_details"].append(f"Row {row_num}: {str(e)}")

        conn.commit()

        if stats["imported"] > 0:
            _upsert_source_ledger(conn, path.stem, stats["imported"])

    finally:
        conn.close()

    return stats


def import_from_dict(records: List[Dict]) -> Dict:
    stats = {"total": len(records), "imported": 0, "skipped_duplicate": 0, "errors": 0, "error_details": []}

    conn = get_connection()
    try:
        for idx, row in enumerate(records, start=1):
            try:
                raw_text = row.get("raw_text", "").strip()
                source = row.get("source", "").strip()
                if not raw_text or not source:
                    stats["errors"] += 1
                    stats["error_details"].append(f"Record {idx}: missing raw_text or source")
                    continue

                publish_time = row.get("publish_time", "") or None
                content_hash = compute_content_hash(source, raw_text, publish_time or "")

                existing = conn.execute(
                    "SELECT id FROM raw_content WHERE content_hash = ?", (content_hash,)
                ).fetchone()
                if existing:
                    stats["skipped_duplicate"] += 1
                    continue

                ct = clean_text(raw_text)
                ct_hash = compute_clean_text_hash(ct)
                content_id = row.get("id", "") or _generate_id()
                crawl_time = row.get("crawl_time", "") or _now()

                conn.execute(
                    """INSERT INTO raw_content
                       (id, source, url, publish_time, crawl_time, title,
                        raw_text, clean_text, clean_text_hash, content_hash,
                        metadata_json, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        content_id,
                        source,
                        row.get("url"),
                        publish_time,
                        crawl_time,
                        row.get("title"),
                        raw_text,
                        ct,
                        ct_hash,
                        content_hash,
                        row.get("metadata_json"),
                        _now(),
                    ),
                )
                stats["imported"] += 1

            except Exception as e:
                stats["errors"] += 1
                stats["error_details"].append(f"Record {idx}: {str(e)}")

        conn.commit()

        if stats["imported"] > 0:
            source_counts = {}
            for idx2, row2 in enumerate(records, start=1):
                src = row2.get("source", "").strip()
                if src:
                    source_counts[src] = source_counts.get(src, 0) + 1
            for src_name, cnt in source_counts.items():
                _upsert_source_ledger(conn, src_name, cnt)

    finally:
        conn.close()

    return stats
