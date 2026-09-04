"""米游社 (miyoushe) crawler for miHoYo official community posts."""
import logging
from typing import Dict, List, Optional

from backend.crawler.base import BaseCrawler
from backend.crawler.product_identifier import identify_product

logger = logging.getLogger(__name__)

MIYOUSHE_FORUM_IDS = {
    "原神": 6,
    "崩坏：星穹铁道": 53,
    "绝区零": 56,
    "未定事件簿": 44,
}


class MiyousheCrawler(BaseCrawler):

    def get_source_name(self) -> str:
        return "miyoushe"

    def crawl(self, keywords: Optional[List[str]] = None, company_id: str = "mihoyo") -> List[Dict]:
        results = []
        for product_name, forum_id in MIYOUSHE_FORUM_IDS.items():
            items = self._get_posts(forum_id, product_name, company_id)
            results.extend(items)
        return results

    def _get_posts(self, forum_id: int, product_name: str, company_id: str) -> List[Dict]:
        items = []
        api_url = f"https://bbs-api.miyoushe.com/post/wapi/getPostFullInCollection?gids={forum_id}&collection_id=&offset=0&size=30"

        data = self.fetch(api_url)
        if not data:
            return items

        try:
            import json as json_mod
            if isinstance(data, str):
                parsed = json_mod.loads(data)
            else:
                parsed = data

            posts = parsed.get("data", {}).get("list", [])
            if not posts:
                posts = parsed.get("data", {}).get("posts", [])

            for post in posts[:30]:
                p = post.get("post", post) if isinstance(post.get("post"), dict) else post
                content = p.get("content", "") or p.get("describe", "") or ""
                title = p.get("subject", "") or ""
                author = p.get("user", {}).get("nickname", "") if isinstance(p.get("user"), dict) else ""

                if not content and not title:
                    continue

                product = identify_product(content or title) or product_name
                post_id = p.get("post_id", "") or p.get("id", "")
                url = f"https://www.miyoushe.com/ys/article/{post_id}" if post_id else ""

                record = {
                    "company_id": company_id,
                    "company_name": "米哈游",
                    "product_name": product,
                    "platform": "miyoushe",
                    "source_type": "community",
                    "author": author,
                    "author_id": str(p.get("uid", "")) if p.get("uid") else "",
                    "followers": 0,
                    "content": content,
                    "title": title,
                    "url": url,
                    "publish_time": "",
                    "likes": p.get("like_num", 0) or 0,
                    "comments": p.get("reply_num", 0) or 0,
                    "shares": p.get("share_num", 0) or 0,
                    "tags": "",
                }
                items.append(record)
                self.stats["parsed"] += 1
        except Exception as e:
            logger.warning("[miyoushe] Parse error for forum %d: %s", forum_id, e)
            self.stats["errors"] += 1

        return items
