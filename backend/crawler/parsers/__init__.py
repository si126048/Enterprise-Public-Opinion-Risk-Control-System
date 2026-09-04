from typing import Dict, Type

from backend.crawler.parsers.gov_portal import GovPortalCrawler
from backend.crawler.parsers.gov_hotline import GovHotlineCrawler
from backend.crawler.parsers.news_forum import NewsForumCrawler
from backend.crawler.parsers.social_weibo import SocialWeiboCrawler
from backend.crawler.parsers.social_zhihu import SocialZhihuCrawler

_REGISTRY: Dict[str, Type] = {
    "gov_portal": GovPortalCrawler,
    "gov_hotline": GovHotlineCrawler,
    "news_forum": NewsForumCrawler,
    "social_weibo": SocialWeiboCrawler,
    "social_zhihu": SocialZhihuCrawler,
}


def get_parser_registry() -> Dict[str, Type]:
    return _REGISTRY
