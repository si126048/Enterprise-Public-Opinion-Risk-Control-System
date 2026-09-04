import logging
from dataclasses import dataclass
from typing import Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class CredibilityScore:
    overall: float
    factors: Dict[str, float]
    weights: Dict[str, float]


PLATFORM_TRUST = {
    "weibo": 0.75,
    "xiaohongshu": 0.70,
    "zhihu": 0.80,
    "bilibili": 0.85,
    "taptap": 0.90,
}

DEFAULT_WEIGHTS = {
    "follower_score": 0.10,
    "activity_score": 0.15,
    "interaction_authenticity": 0.20,
    "content_consistency": 0.15,
    "sentiment_intensity": 0.15,
    "platform_trust": 0.15,
    "engagement_depth": 0.10,
}


def compute_credibility(
    followers: int = 0,
    post_count: int = 0,
    likes: int = 0,
    comments: int = 0,
    shares: int = 0,
    sentiment: str = "neutral",
    platform: str = "weibo",
    content_length: int = 0,
    has_screenshot: bool = False,
    game_level: int = 0,
) -> CredibilityScore:
    follower_score = _score_followers(followers)
    activity_score = _score_activity(post_count)
    interaction_authenticity = _score_interaction_authenticity(likes, comments, shares)
    content_consistency = _score_content_consistency(content_length, has_screenshot)
    sentiment_intensity = _score_sentiment_intensity(sentiment)
    platform_trust = PLATFORM_TRUST.get(platform, 0.70)
    engagement_depth = _score_engagement_depth(game_level)

    factors = {
        "follower_score": follower_score,
        "activity_score": activity_score,
        "interaction_authenticity": interaction_authenticity,
        "content_consistency": content_consistency,
        "sentiment_intensity": sentiment_intensity,
        "platform_trust": platform_trust,
        "engagement_depth": engagement_depth,
    }

    overall = sum(factors[k] * DEFAULT_WEIGHTS[k] for k in DEFAULT_WEIGHTS)

    return CredibilityScore(
        overall=round(overall, 4),
        factors={k: round(v, 4) for k, v in factors.items()},
        weights=dict(DEFAULT_WEIGHTS),
    )


def _score_followers(followers: int) -> float:
    if followers >= 100000:
        return 1.0
    if followers >= 10000:
        return 0.85
    if followers >= 1000:
        return 0.65
    if followers >= 100:
        return 0.45
    if followers >= 10:
        return 0.25
    return 0.10


def _score_activity(post_count: int) -> float:
    if post_count >= 500:
        return 1.0
    if post_count >= 100:
        return 0.80
    if post_count >= 30:
        return 0.60
    if post_count >= 5:
        return 0.35
    return 0.10


def _score_interaction_authenticity(likes: int, comments: int, shares: int) -> float:
    total = likes + comments + shares
    if total == 0:
        return 0.30

    comment_ratio = comments / max(total, 1)
    share_ratio = shares / max(total, 1)

    if 0.05 <= comment_ratio <= 0.40 and 0.01 <= share_ratio <= 0.20:
        return 0.90
    if comment_ratio > 0.60:
        return 0.40
    if likes > 0 and comments == 0 and shares == 0:
        return 0.30
    return 0.60


def _score_content_consistency(content_length: int, has_screenshot: bool) -> float:
    score = 0.40
    if content_length >= 200:
        score += 0.30
    elif content_length >= 50:
        score += 0.15
    if has_screenshot:
        score += 0.30
    return min(score, 1.0)


def _score_sentiment_intensity(sentiment: str) -> float:
    if sentiment in ("positive", "negative"):
        return 0.80
    if sentiment == "neutral":
        return 0.50
    return 0.30


def _score_engagement_depth(game_level: int) -> float:
    if game_level >= 55:
        return 1.0
    if game_level >= 40:
        return 0.80
    if game_level >= 20:
        return 0.55
    if game_level > 0:
        return 0.30
    return 0.15


def batch_credibility(items: list) -> list:
    results = []
    for item in items:
        result = compute_credibility(
            followers=item.get("followers", 0),
            post_count=item.get("post_count", 0),
            likes=item.get("likes", 0),
            comments=item.get("comments", 0),
            shares=item.get("shares", 0),
            sentiment=item.get("sentiment", "neutral"),
            platform=item.get("platform", "weibo"),
            content_length=len(item.get("content", "")),
            has_screenshot=item.get("has_screenshot", False),
            game_level=item.get("game_level", 0),
        )
        results.append({
            "content_id": item.get("id"),
            "credibility": result.overall,
            "factors": result.factors,
        })
    return results
