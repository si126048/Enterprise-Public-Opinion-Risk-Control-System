import logging

from fastapi import APIRouter, Query
from typing import Optional

from backend.services import cross_validation

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/validation", tags=["validation"])


@router.post("/run")
async def run_validation(
    content_id: Optional[str] = None,
    batch_size: int = 50,
):
    stats = cross_validation.run_cross_validation(
        content_id=content_id, batch_size=batch_size
    )
    return {"status": "ok", "stats": stats}


@router.get("/summary")
async def validation_summary():
    return cross_validation.get_validation_summary()


@router.get("/results")
async def validation_results(
    content_id: Optional[str] = None,
    limit: int = Query(default=100, le=500),
):
    results = cross_validation.get_validation_results(
        content_id=content_id, limit=limit
    )
    return {"results": results, "count": len(results)}


@router.get("/results/{content_id}")
async def validation_detail(content_id: str):
    results = cross_validation.get_validation_results(content_id=content_id)
    return {"content_id": content_id, "results": results}
