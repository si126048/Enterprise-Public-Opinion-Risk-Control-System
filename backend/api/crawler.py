import logging
from typing import Dict, List

from fastapi import APIRouter, HTTPException, Query

from backend.crawler.manager import CrawlerManager
from backend.crawler.models import (
    CrawlerInfo,
    CrawlRunRequest,
    CrawlerStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/crawler", tags=["crawler"])


def _get_manager() -> CrawlerManager:
    return CrawlerManager()


@router.get("/crawlers", response_model=List[CrawlerInfo])
def list_crawlers():
    manager = _get_manager()
    return manager.list_crawlers()


@router.post("/run/{name}")
def run_crawler(name: str, body: CrawlRunRequest = None):
    manager = _get_manager()
    triggered_by = body.triggered_by if body else "api"
    try:
        result = manager.run_crawler(name, triggered_by=triggered_by)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Crawler %s failed", name)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run-all")
def run_all(body: CrawlRunRequest = None):
    manager = _get_manager()
    triggered_by = body.triggered_by if body else "api"
    return manager.run_all(triggered_by=triggered_by)


@router.get("/runs")
def list_runs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    manager = _get_manager()
    return {"runs": manager.get_run_history(limit=limit, offset=offset)}


@router.get("/runs/{run_id}")
def get_run(run_id: str):
    manager = _get_manager()
    detail = manager.get_run_detail(run_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Run not found")
    return detail


@router.get("/status", response_model=CrawlerStatusResponse)
def get_status():
    manager = _get_manager()
    return manager.get_status()
