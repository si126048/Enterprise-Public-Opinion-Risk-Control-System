from typing import Dict, List, Optional

from pydantic import BaseModel


class CrawlerInfo(BaseModel):
    name: str
    enabled: bool
    category: str
    urls: List[str]
    max_pages: int
    delay: float
    registered: bool


class CrawlRunRequest(BaseModel):
    triggered_by: str = "api"


class CrawlRunSummary(BaseModel):
    run_id: str
    crawler: str
    status: str
    started_at: str
    finished_at: Optional[str] = None
    total_fetched: int = 0
    total_imported: int = 0
    total_skipped_dup: int = 0
    total_errors: int = 0


class CrawlerStatusResponse(BaseModel):
    available_crawlers: int
    enabled_crawlers: int
    total_runs: int
    last_run: Optional[Dict] = None
