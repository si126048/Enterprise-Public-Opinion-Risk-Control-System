from backend.services.llm_service import (
    MockLLMProvider,
    SimulatedDeepSeekProvider,
    SimulatedQwenProvider,
)


def test_mock_provider_result_fields():
    provider = MockLLMProvider()
    result = provider.analyze("退坑了，逼氪吃相太难看", "抽卡与付费机制")
    assert result.sentiment in ("positive", "neutral", "negative", "uncertain")
    assert 0 <= result.sentiment_confidence <= 1
    assert result.risk_level in ("low", "medium", "high", "uncertain")
    assert 0 <= result.risk_confidence <= 1
    assert result.summary
    assert result.theory_perspective


def test_deepseek_differs_from_mock():
    text = "退坑了，逼氪吃相难看，bug一堆没人修"
    mock = MockLLMProvider()
    deepseek = SimulatedDeepSeekProvider()
    r_mock = mock.analyze(text, "技术性能与优化")
    r_deep = deepseek.analyze(text, "技术性能与优化")
    assert r_deep.sentiment in ("positive", "neutral", "negative", "uncertain")
    assert r_deep.summary.startswith("[DeepSeek]")


def test_qwen_differs_from_mock():
    text = "好玩，良心运营，福利多，推荐"
    mock = MockLLMProvider()
    qwen = SimulatedQwenProvider()
    r_mock = mock.analyze(text, "社区运营与公关")
    r_qwen = qwen.analyze(text, "社区运营与公关")
    assert r_qwen.sentiment in ("positive", "neutral", "negative", "uncertain")
    assert r_qwen.summary.startswith("[Qwen]")


def test_providers_deterministic():
    text = "卡顿闪退，优化差，崩溃"
    provider = SimulatedDeepSeekProvider()
    r1 = provider.analyze(text, "技术性能与优化")
    r2 = provider.analyze(text, "技术性能与优化")
    assert r1.sentiment == r2.sentiment
    assert r1.risk_level == r2.risk_level
    assert r1.sentiment_confidence == r2.sentiment_confidence
