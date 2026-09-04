import json
import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional

from backend.config import get_config
from backend.db.database import get_connection

logger = logging.getLogger(__name__)


@dataclass
class LLMAnalysisResult:
    sentiment: str
    sentiment_confidence: float
    risk_level: str
    risk_confidence: float
    summary: str
    theory_perspective: str


class BaseLLMProvider(ABC):
    @abstractmethod
    def analyze(self, text: str, topic_name: str, metadata: Dict = None) -> LLMAnalysisResult:
        ...


THEORY_MAP = {
    "物业管理": "物业管理条例执行与居民权益保障",
    "环境卫生": "城市公共卫生管理效能评估",
    "市容秩序": "城市空间秩序与基层治理能力",
    "基础设施": "市政基础设施维护响应机制",
    "交通出行": "城市交通治理与公共服务可及性",
    "违建/安全": "城市安全风险防控与执法效能",
    "养老服务": "社区养老服务供给与需求匹配",
    "政务服务": "政务服务效率与群众满意度",
}


class MockLLMProvider(BaseLLMProvider):
    NEGATIVE_KEYWORDS = [
        "投诉", "无人管", "没人修", "太差", "意见很大", "不满", "糟糕",
        "严重", "恶劣", "脏乱", "危险", "破损", "故障", "脱落", "堵塞",
        "拥堵", "混乱", "噪音", "扰民", "效率低", "推诿", "不作为",
    ]
    POSITIVE_KEYWORDS = [
        "点赞", "不错", "好评", "完成", "方便多了", "效率不错", "及时",
        "满意", "感谢", "改善", "好评", "整洁", "畅通", "安全", "舒适",
    ]
    HIGH_RISK_KEYWORDS = [
        "安全隐患", "砸到人", "着火", "危险", "爆炸", "坍塌",
        "伤人", "中毒", "严重", "紧急", "危及", "爆裂",
    ]

    def analyze(self, text: str, topic_name: str, metadata: Dict = None) -> LLMAnalysisResult:
        neg_count = sum(1 for kw in self.NEGATIVE_KEYWORDS if kw in text)
        pos_count = sum(1 for kw in self.POSITIVE_KEYWORDS if kw in text)
        high_risk_count = sum(1 for kw in self.HIGH_RISK_KEYWORDS if kw in text)

        if len(text.strip()) < 10:
            sentiment = "uncertain"
            sentiment_confidence = 0.30
        elif neg_count > pos_count + 1:
            sentiment = "negative"
            sentiment_confidence = min(0.65 + neg_count * 0.05, 0.95)
        elif pos_count > neg_count:
            sentiment = "positive"
            sentiment_confidence = min(0.65 + pos_count * 0.05, 0.95)
        else:
            sentiment = "neutral"
            sentiment_confidence = 0.55

        if high_risk_count >= 2:
            risk_level = "high"
            risk_confidence = 0.85
        elif high_risk_count == 1:
            risk_level = "medium"
            risk_confidence = 0.70
        elif sentiment == "negative":
            risk_level = "medium"
            risk_confidence = 0.55
        else:
            risk_level = "low"
            risk_confidence = 0.70

        first_sentence = text.split("。")[0].split("！")[0].split("\n")[0]
        if len(first_sentence) > 80:
            first_sentence = first_sentence[:80] + "..."
        summary = f"[{topic_name}] {first_sentence}"

        theory_perspective = THEORY_MAP.get(topic_name, "基层治理综合评估")

        return LLMAnalysisResult(
            sentiment=sentiment,
            sentiment_confidence=round(sentiment_confidence, 2),
            risk_level=risk_level,
            risk_confidence=round(risk_confidence, 2),
            summary=summary,
            theory_perspective=theory_perspective,
        )


_provider = None


def get_provider() -> BaseLLMProvider:
    global _provider
    if _provider is not None:
        return _provider
    config = get_config()
    provider_name = config["llm"]["provider"]
    if provider_name == "mock":
        _provider = MockLLMProvider()
    else:
        raise ValueError(f"Unknown LLM provider: {provider_name}")
    return _provider


def analyze_content(text: str, topic_name: str, content_id: str = None,
                    metadata: Dict = None) -> LLMAnalysisResult:
    config = get_config()
    provider = get_provider()
    run_id = f"run_{uuid.uuid4().hex[:12]}"
    model = config["llm"]["model"]

    try:
        result = provider.analyze(text, topic_name, metadata)

        _log_run(
            run_id=run_id,
            task_type="content_analysis",
            model=model,
            input_ids=[content_id] if content_id else [],
            raw_output=json.dumps({"text_length": len(text), "topic": topic_name}),
            parsed_output=json.dumps({
                "sentiment": result.sentiment,
                "risk_level": result.risk_level,
                "summary": result.summary,
            }),
            success=True,
        )
        return result

    except Exception as e:
        _log_run(
            run_id=run_id,
            task_type="content_analysis",
            model=model,
            input_ids=[content_id] if content_id else [],
            raw_output="",
            parsed_output="",
            success=False,
            error=str(e),
        )
        raise


def _log_run(run_id: str, task_type: str, model: str,
             input_ids: list, raw_output: str,
             parsed_output: str, success: bool, error: str = None):
    conn = get_connection()
    try:
        conn.execute(
            """INSERT INTO ai_run_log
               (run_id, task_type, model, timestamp, input_record_ids,
                prompt_version, raw_output, parsed_output, success, error_message)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (run_id, task_type, model, datetime.now().isoformat(),
             json.dumps(input_ids), "mock-v1", raw_output, parsed_output,
             1 if success else 0, error),
        )
        conn.commit()
    finally:
        conn.close()
