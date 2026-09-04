from typing import Dict, Type

from backend.crawler.parsers.weibo import WeiboCrawler
from backend.crawler.parsers.xiaohongshu import XiaohongshuCrawler
from backend.crawler.parsers.zhihu import ZhihuCrawler
from backend.crawler.parsers.bilibili import BilibiliCrawler
from backend.crawler.parsers.taptap import TaptapCrawler
from backend.crawler.parsers.xiaoheihe import XiaoheiheCrawler
from backend.crawler.parsers.miyoushe import MiyousheCrawler

_REGISTRY: Dict[str, Type] = {
    "weibo": WeiboCrawler,
    "xiaohongshu": XiaohongshuCrawler,
    "zhihu": ZhihuCrawler,
    "bilibili": BilibiliCrawler,
    "taptap": TaptapCrawler,
    "xiaoheihe": XiaoheiheCrawler,
    "miyoushe": MiyousheCrawler,
}


def get_parser_registry() -> Dict[str, Type]:
    return _REGISTRY
