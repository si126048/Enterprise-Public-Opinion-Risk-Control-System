"""Review Agent API — 模型代理审核接口"""
import logging
from typing import Optional

from fastapi import APIRouter, Query

from backend.services import review_agent

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/review-agent", tags=["review-agent"])


@router.post("/run")
async def run_review_agent():
    """触发模型代理审核所有 pending 候选主题"""
    result = review_agent.review_all_pending()
    return {"status": "ok", "result": result}


@router.get("/log")
async def get_review_log(limit: int = Query(20, ge=1, le=100)):
    """获取代理审核决策历史"""
    log = review_agent.get_review_log(limit=limit)
    return {"log": log, "total": len(log)}
