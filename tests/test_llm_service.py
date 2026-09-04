from backend.services.llm_service import (
    MockLLMProvider,
    SimulatedDeepSeekProvider,
    SimulatedQwenProvider,
)


def test_mock_provider_result_fields():
    provider = MockLLMProvider()
    result = provider.analyze("投诉无人管理，环境脏乱差", "物业管理")
    assert result.sentiment in ("positive", "neutral", "negative", "uncertain")
    assert 0 <= result.sentiment_confidence <= 1
    assert result.risk_level in ("low", "medium", "high", "uncertain")
    assert 0 <= result.risk_confidence <= 1
    assert result.summary
    assert result.theory_perspective


def test_deepseek_differs_from_mock():
    text = "投诉无人管理，环境脏乱差，安全隐患严重"
    mock = MockLLMProvider()
    deepseek = SimulatedDeepSeekProvider()
    r_mock = mock.analyze(text, "环境卫生")
    r_deep = deepseek.analyze(text, "环境卫生")
    assert r_deep.sentiment in ("positive", "neutral", "negative", "uncertain")
    assert r_deep.summary.startswith("[DeepSeek]")


def test_qwen_differs_from_mock():
    text = "点赞，改善很多，效率不错，满意"
    mock = MockLLMProvider()
    qwen = SimulatedQwenProvider()
    r_mock = mock.analyze(text, "政务服务")
    r_qwen = qwen.analyze(text, "政务服务")
    assert r_qwen.sentiment in ("positive", "neutral", "negative", "uncertain")
    assert r_qwen.summary.startswith("[Qwen]")


def test_providers_deterministic():
    text = "投诉噪音扰民，危险"
    provider = SimulatedDeepSeekProvider()
    r1 = provider.analyze(text, "环境卫生")
    r2 = provider.analyze(text, "环境卫生")
    assert r1.sentiment == r2.sentiment
    assert r1.risk_level == r2.risk_level
    assert r1.sentiment_confidence == r2.sentiment_confidence
