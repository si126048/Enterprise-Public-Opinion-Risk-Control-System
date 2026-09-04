"""Weibo crawler for miHoYo-related posts."""
import logging
from typing import Dict, List, Optional

from backend.crawler.base import BaseCrawler
from backend.crawler.product_identifier import identify_product

logger = logging.getLogger(__name__)


class WeiboCrawler(BaseCrawler):

    def get_source_name(self) -> str:
        return "weibo"

    def crawl(self, keywords: Optional[List[str]] = None, company_id: str = "mihoyo") -> List[Dict]:
        results = []
        if not keywords:
            return results

        for keyword in keywords:
            items = self._search_keyword(keyword, company_id)
            results.extend(items)
        return results

    def _search_keyword(self, keyword: str, company_id: str) -> List[Dict]:
        items = []
        api_url = f"https://m.weibo.cn/api/container/getIndex?containerid=100103type%3D1%26q%3D{keyword}&page_type=searchall"

        html = self.fetch(api_url)
        if not html:
            return items

        try:
            import json
            data = json.loads(html)
            cards = data.get("data", {}).get("cards", [])
            for card in cards:
                card_group = card.get("card_group", [])
                for item in card_group:
                    mblog = item.get("mblog")
                    if not mblog:
                        continue
                    text = mblog.get("text", "")
                    import re
                    clean = re.sub(r"<[^>]+>", "", text)
                    product = identify_product(clean)
                    record = {
                        "company_id": company_id,
                        "company_name": "米哈游",
                        "product_name": product,
                        "platform": "weibo",
                        "source_type": "social_media",
                        "author": mblog.get("user", {}).get("screen_name", ""),
                        "author_id": str(mblog.get("user", {}).get("id", "")),
                        "followers": mblog.get("user", {}).get("followers_count", 0),
                        "content": clean,
                        "title": "",
                        "url": f"https://m.weibo.cn/detail/{mblog.get('id', '')}",
                        "publish_time": mblog.get("created_at", ""),
                        "likes": mblog.get("attitudes_count", 0),
                        "comments": mblog.get("comments_count", 0),
                        "shares": mblog.get("reposts_count", 0),
                        "tags": ",".join(t.get("text", "") for t in mblog.get("topic_struct", []) if t.get("text")),
                    }
                    items.append(record)
                    self.stats["parsed"] += 1
        except Exception as e:
            logger.warning("[weibo] Parse error for keyword '%s': %s", keyword, e)
            self.stats["errors"] += 1

        return items
