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
    credibility_level: str
    credibility_confidence: float
    risk_level: str
    risk_confidence: float
    summary: str
    theory_perspective: str


class BaseLLMProvider(ABC):
    @abstractmethod
    def analyze(self, text: str, topic_name: str, metadata: Dict = None) -> LLMAnalysisResult:
        ...


THEORY_MAP = {
    "版本节奏与内容": "游戏版本更新节奏与内容质量评估",
    "抽卡与付费机制": "抽卡概率与付费体验合理性分析",
    "角色设计与平衡": "角色设计审美与数值平衡性评估",
    "技术性能与优化": "客户端性能优化与兼容性分析",
    "社区运营与公关": "社区运营策略与危机公关响应",
    "竞品与市场压力": "同类产品竞争态势与市场份额",
    "公司治理与舆情": "企业治理透明度与舆论引导",
    "合规与监管": "游戏合规运营与监管政策风险",
}


class MockLLMProvider(BaseLLMProvider):
    LOW_KEYWORDS = [
        "听说", "据说", "谣言", "虚假", "编造", "无证据", "不实",
        "道听途说", "未经验证", "存疑", "可疑", "伪造",
        "退坑", "弃坑", "垃圾", "太差", "差评", "失望",
        "逼氪", "骗氪", "割韭菜", "吃相难看",
        "卡顿", "闪退", "掉帧", "bug", "崩溃",
    ]
    HIGH_KEYWORDS = [
        "数据", "来源", "引用", "官方", "证实", "可查",
        "有据可查", "实锤", "确凿", "权威", "可靠",
        "好玩", "神作", "良心", "好评", "推荐", "不错",
        "优化好", "流畅", "福利多", "剧情好", "美术棒",
    ]
    HIGH_RISK_KEYWORDS = [
        "维权", "举报", "投诉", "315", "消费者", "欺诈",
        "诱导充值", "未成年", "沉迷", "退款", "集体", "抵制",
        "舆论", "热搜", "塌房", "暴雷", "关停",
    ]

    def analyze(self, text: str, topic_name: str, metadata: Dict = None) -> LLMAnalysisResult:
        low_count = sum(1 for kw in self.LOW_KEYWORDS if kw in text)
        high_count = sum(1 for kw in self.HIGH_KEYWORDS if kw in text)
        high_risk_count = sum(1 for kw in self.HIGH_RISK_KEYWORDS if kw in text)

        if len(text.strip()) < 10:
            credibility_level = "uncertain"
            credibility_confidence = 0.30
        elif low_count > high_count + 1:
            credibility_level = "low"
            credibility_confidence = min(0.65 + low_count * 0.05, 0.95)
        elif high_count > low_count:
            credibility_level = "high"
            credibility_confidence = min(0.65 + high_count * 0.05, 0.95)
        else:
            credibility_level = "medium"
            credibility_confidence = 0.55

        if high_risk_count >= 2:
            risk_level = "high"
            risk_confidence = 0.85
        elif high_risk_count == 1:
            risk_level = "medium"
            risk_confidence = 0.70
        elif credibility_level == "low":
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
            credibility_level=credibility_level,
            credibility_confidence=round(credibility_confidence, 2),
            risk_level=risk_level,
            risk_confidence=round(risk_confidence, 2),
            summary=summary,
            theory_perspective=theory_perspective,
        )


class SimulatedDeepSeekProvider(BaseLLMProvider):
    LOW_KEYWORDS = [
        "听说", "据说", "谣言", "虚假", "不实", "无证据",
        "投诉", "无人管", "没人修", "太差", "不满", "糟糕",
        "恶劣", "故障", "混乱", "推诿", "不作为",
    ]
    HIGH_KEYWORDS = [
        "数据", "来源", "引用", "官方", "证实", "可查",
        "点赞", "不错", "好评", "完成", "方便", "效率",
        "满意", "感谢", "改善", "安全",
    ]
    HIGH_RISK_KEYWORDS = [
        "安全隐患", "砸到人", "着火", "危险", "爆炸", "坍塌",
        "伤人", "中毒", "紧急", "危及",
    ]

    def analyze(self, text: str, topic_name: str, metadata: Dict = None) -> LLMAnalysisResult:
        h = hash(text) % 1000
        low_count = sum(1 for kw in self.LOW_KEYWORDS if kw in text)
        high_count = sum(1 for kw in self.HIGH_KEYWORDS if kw in text)
        high_risk_count = sum(1 for kw in self.HIGH_RISK_KEYWORDS if kw in text)

        score = low_count - high_count + (h % 3 - 1) * 0.3

        if len(text.strip()) < 10:
            credibility_level = "uncertain"
            credibility_confidence = 0.28
        elif score > 0.5:
            credibility_level = "low"
            credibility_confidence = min(0.60 + low_count * 0.06, 0.92)
        elif score < -0.5:
            credibility_level = "high"
            credibility_confidence = min(0.60 + high_count * 0.06, 0.92)
        else:
            credibility_level = "medium"
            credibility_confidence = 0.50 + (h % 10) * 0.01

        if high_risk_count >= 2:
            risk_level = "high"
            risk_confidence = 0.80
        elif high_risk_count == 1:
            risk_level = "medium"
            risk_confidence = 0.65
        elif credibility_level == "low":
            risk_level = "medium"
            risk_confidence = 0.50
        else:
            risk_level = "low"
            risk_confidence = 0.65

        sentences = text.replace("！", "。").replace("\n", "。").split("。")
        first = sentences[0].strip() if sentences else text[:80]
        summary = f"[DeepSeek] {topic_name}: {first[:70]}..." if len(first) > 70 else f"[DeepSeek] {topic_name}: {first}"

        theory_perspective = THEORY_MAP.get(topic_name, "基层治理综合评估")

        return LLMAnalysisResult(
            credibility_level=credibility_level,
            credibility_confidence=round(credibility_confidence, 2),
            risk_level=risk_level,
            risk_confidence=round(risk_confidence, 2),
            summary=summary,
            theory_perspective=theory_perspective,
        )


class SimulatedQwenProvider(BaseLLMProvider):
    LOW_KEYWORDS = [
        "听说", "据说", "谣言", "虚假", "不实",
        "投诉", "无人管", "没人修", "太差", "不满",
        "恶劣", "故障", "混乱", "不作为",
    ]
    HIGH_KEYWORDS = [
        "数据", "来源", "引用", "官方", "证实", "可查",
        "点赞", "不错", "好评", "完成", "满意",
        "感谢", "改善", "安全",
    ]
    HIGH_RISK_KEYWORDS = [
        "安全隐患", "着火", "危险", "爆炸", "坍塌",
        "伤人", "中毒", "紧急",
    ]

    def analyze(self, text: str, topic_name: str, metadata: Dict = None) -> LLMAnalysisResult:
        h = hash(text) % 1000
        low_count = sum(1 for kw in self.LOW_KEYWORDS if kw in text)
        high_count = sum(1 for kw in self.HIGH_KEYWORDS if kw in text)
        high_risk_count = sum(1 for kw in self.HIGH_RISK_KEYWORDS if kw in text)

        if len(text.strip()) < 10:
            credibility_level = "uncertain"
            credibility_confidence = 0.32
        elif low_count > high_count + 2:
            credibility_level = "low"
            credibility_confidence = min(0.58 + low_count * 0.04, 0.88)
        elif high_count > low_count + 1:
            credibility_level = "high"
            credibility_confidence = min(0.58 + high_count * 0.04, 0.88)
        else:
            credibility_level = "medium"
            credibility_confidence = 0.55 + (h % 8) * 0.01

        if high_risk_count >= 3:
            risk_level = "high"
            risk_confidence = 0.78
        elif high_risk_count >= 1:
            risk_level = "medium"
            risk_confidence = 0.60
        else:
            risk_level = "low"
            risk_confidence = 0.72

        first_part = text.split("。")[0].split("！")[0].strip()
        summary = f"[Qwen] {topic_name} — {first_part[:60]}" if first_part else f"[Qwen] {topic_name}"

        theory_perspective = THEORY_MAP.get(topic_name, "基层治理综合评估")

        return LLMAnalysisResult(
            credibility_level=credibility_level,
            credibility_confidence=round(credibility_confidence, 2),
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
    elif provider_name == "deepseek":
        _provider = SimulatedDeepSeekProvider()
    elif provider_name == "qwen":
        _provider = SimulatedQwenProvider()
    else:
        raise ValueError(f"Unknown LLM provider: {provider_name}")
    return _provider


def get_all_providers():
    return [
        ("mock", MockLLMProvider()),
        ("deepseek", SimulatedDeepSeekProvider()),
        ("qwen", SimulatedQwenProvider()),
    ]


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
                "credibility_level": result.credibility_level,
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
