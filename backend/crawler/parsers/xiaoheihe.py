"""小黑盒 (xiaoheihe) crawler for miHoYo game community posts."""
import logging
from typing import Dict, List, Optional

from backend.crawler.base import BaseCrawler
from backend.crawler.product_identifier import identify_product

logger = logging.getLogger(__name__)

XIAOHEIHE_GAME_IDS = {
    "原神": 1013,
    "崩坏：星穹铁道": 1056,
    "绝区零": 1065,
    "未定事件簿": 1031,
}


class XiaoheiheCrawler(BaseCrawler):

    def get_source_name(self) -> str:
        return "xiaoheihe"

    def crawl(self, keywords: Optional[List[str]] = None, company_id: str = "mihoyo") -> List[Dict]:
        results = []
        for product_name, game_id in XIAOHEIHE_GAME_IDS.items():
            items = self._get_posts(game_id, product_name, company_id)
            results.extend(items)
        return results

    def _get_posts(self, game_id: int, product_name: str, company_id: str) -> List[Dict]:
        items = []
        feed_url = f"https://api.xiaoheihe.cn/bbs/app/feed/flow?os_type=web&app=heybox&client_type=mobile&version=999.0.3&x_client_type=web&x_os=Web&heybox_id=-1&offset=0&limit=30&rec_mark=timeline&is_first=1&game_id={game_id}"

        data = self.fetch(feed_url)
        if not data:
            return items

        try:
            import json as json_mod
            if isinstance(data, str):
                parsed = json_mod.loads(data)
            else:
                parsed = data

            posts = parsed.get("result", {}).get("feeds", [])
            if not posts:
                posts = parsed.get("result", {}).get("list", [])

            for post in posts[:30]:
                content = post.get("description", "") or post.get("content", "") or ""
                title = post.get("title", "") or ""
                author = post.get("user", {}).get("username", "") if isinstance(post.get("user"), dict) else ""

                if not content and not title:
                    continue

                product = identify_product(content or title) or product_name
                post_id = post.get("id", "")
                url = f"https://www.xiaoheihe.cn/app/heybox/bbs/web/link/detail/{post_id}" if post_id else ""

                record = {
                    "company_id": company_id,
                    "company_name": "米哈游",
                    "product_name": product,
                    "platform": "xiaoheihe",
                    "source_type": "community",
                    "author": author,
                    "author_id": str(post.get("user", {}).get("userid", "")) if isinstance(post.get("user"), dict) else "",
                    "followers": 0,
                    "content": content,
                    "title": title,
                    "url": url,
                    "publish_time": "",
                    "likes": post.get("like_num", 0) or post.get("up_num", 0) or 0,
                    "comments": post.get("comment_num", 0) or 0,
                    "shares": post.get("share_num", 0) or 0,
                    "tags": "",
                }
                items.append(record)
                self.stats["parsed"] += 1
        except Exception as e:
            logger.warning("[xiaoheihe] Parse error for game %d: %s", game_id, e)
            self.stats["errors"] += 1

        return items
