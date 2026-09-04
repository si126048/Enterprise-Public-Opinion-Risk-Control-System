import json
import uuid
import logging
from datetime import datetime
from typing import Dict, List, Optional

from backend.config import load_config
from backend.crawler.base import BaseCrawler
from backend.crawler.parsers import get_parser_registry
from backend.ingestion.importer import import_from_dict
from backend.db.database import get_connection

logger = logging.getLogger(__name__)


class CrawlerManager:

    def __init__(self):
        config = load_config()
        self.config = config.get("crawler", {})
        self._registry = get_parser_registry()

    def list_crawlers(self) -> List[Dict]:
        result = []
        sites = self.config.get("platforms", {})
        for name, site_cfg in sites.items():
            result.append({
                "name": name,
                "enabled": site_cfg.get("enabled", False),
                "category": site_cfg.get("category", "unknown"),
                "urls": site_cfg.get("urls", []),
                "max_pages": site_cfg.get("max_pages", 200),
                "delay": site_cfg.get("delay", self.config.get("default_delay", 2.0)),
                "registered": name in self._registry,
            })
        return result

    def run_crawler(self, crawler_name: str, triggered_by: str = "manual") -> Dict:
        run_id = str(uuid.uuid4())
        started_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

        crawler_cls = self._registry.get(crawler_name)
        if not crawler_cls:
            raise ValueError(f"Unknown crawler: {crawler_name}")

        site_cfg = self.config.get("platforms", {}).get(crawler_name, {})
        self._create_run_log(run_id, crawler_name, started_at, triggered_by)

        crawler = crawler_cls(name=crawler_name, site_config=site_cfg, global_config=self.config)

        try:
            records = crawler.crawl()

            import_stats = {"total": 0, "imported": 0, "skipped_duplicate": 0, "errors": 0}
            if records:
                import_stats = import_from_dict(records)

            self._finish_run_log(
                run_id, "completed", started_at,
                crawler.stats, import_stats, crawler.errors
            )

            return {
                "run_id": run_id,
                "crawler": crawler_name,
                "status": "completed",
                "started_at": started_at,
                "finished_at": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
                "crawl_stats": crawler.stats,
                "import_stats": import_stats,
            }
        except Exception as e:
            logger.exception("[%s] Crawl failed: %s", crawler_name, e)
            self._finish_run_log(
                run_id, "failed", started_at,
                crawler.stats, {"total": 0, "imported": 0, "skipped_duplicate": 0, "errors": 0},
                [str(e)]
            )
            raise
        finally:
            crawler.cleanup()

    def run_all(self, triggered_by: str = "manual") -> Dict:
        results = {}
        sites = self.config.get("platforms", {})
        for name, site_cfg in sites.items():
            if not site_cfg.get("enabled", False):
                continue
            if name not in self._registry:
                continue
            try:
                results[name] = self.run_crawler(name, triggered_by)
            except Exception as e:
                results[name] = {"error": str(e), "status": "failed"}
        return results

    def get_run_history(self, limit: int = 20, offset: int = 0) -> List[Dict]:
        conn = get_connection()
        try:
            rows = conn.execute(
                "SELECT * FROM crawl_run_log ORDER BY started_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_run_detail(self, run_id: str) -> Optional[Dict]:
        conn = get_connection()
        try:
            row = conn.execute(
                "SELECT * FROM crawl_run_log WHERE id = ?", (run_id,)
            ).fetchone()
            return dict(row) if row else None
        finally:
            conn.close()

    def get_status(self) -> Dict:
        sites = self.config.get("platforms", {})
        enabled = sum(1 for s in sites.values() if s.get("enabled", False))
        history = self.get_run_history(limit=1)
        last_run = history[0] if history else None
        conn = get_connection()
        try:
            total_runs = conn.execute("SELECT COUNT(*) as cnt FROM crawl_run_log").fetchone()["cnt"]
        finally:
            conn.close()
        return {
            "available_crawlers": len(self._registry),
            "enabled_crawlers": enabled,
            "total_runs": total_runs,
            "last_run": last_run,
        }

    def _create_run_log(self, run_id, crawler_name, started_at, triggered_by):
        conn = get_connection()
        try:
            snapshot = {k: v for k, v in self.config.items() if k != "platforms"}
            conn.execute(
                """INSERT INTO crawl_run_log
                   (id, started_at, status, triggered_by, crawler_name, config_snapshot)
                   VALUES (?, ?, 'running', ?, ?, ?)""",
                (run_id, started_at, triggered_by, crawler_name,
                 json.dumps(snapshot, ensure_ascii=True)),
            )
            conn.commit()
        finally:
            conn.close()

    def _finish_run_log(self, run_id, status, started_at, crawl_stats, import_stats, errors):
        finished_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
        conn = get_connection()
        try:
            conn.execute(
                """UPDATE crawl_run_log
                   SET finished_at = ?, status = ?,
                       total_fetched = ?, total_imported = ?,
                       total_skipped_dup = ?, total_errors = ?,
                       error_details = ?
                   WHERE id = ?""",
                (
                    finished_at, status,
                    crawl_stats.get("fetched", 0),
                    import_stats.get("imported", 0),
                    import_stats.get("skipped_duplicate", 0),
                    crawl_stats.get("errors", 0) + import_stats.get("errors", 0),
                    json.dumps(errors[:50], ensure_ascii=True) if errors else None,
                    run_id,
                ),
            )
            conn.commit()
        finally:
            conn.close()
