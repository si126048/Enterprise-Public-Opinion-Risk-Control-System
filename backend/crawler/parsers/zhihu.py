"""Zhihu crawler for miHoYo-related questions and answers."""
import json
import logging
from typing import Dict, List, Optional

from backend.crawler.base import BaseCrawler
from backend.crawler.product_identifier import identify_product

logger = logging.getLogger(__name__)


class ZhihuCrawler(BaseCrawler):

    def get_source_name(self) -> str:
        return "zhihu"

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
        api_url = f"https://www.zhihu.com/api/v4/search_v3?t=general&q={keyword}"

        html = self.fetch(api_url)
        if not html:
            return items

        try:
            data = json.loads(html)
            results_list = data.get("data", [])
            for item_data in results_list:
                obj = item_data.get("object", {})
                item_type = item_data.get("type", "")

                if item_type == "search_result":
                    content_text = obj.get("title", "") + " " + obj.get("excerpt", "")
                    import re
                    clean = re.sub(r"<[^>]+>", "", content_text).strip()
                    product = identify_product(clean)
                    author_info = obj.get("author", {})
                    answer_count = obj.get("answer_count", 0)
                    follower_count = obj.get("follower_count", 0)

                    record = {
                        "company_id": company_id,
                        "company_name": "米哈游",
                        "product_name": product,
                        "platform": "zhihu",
                        "source_type": "forum",
                        "author": author_info.get("name", ""),
                        "author_id": str(author_info.get("id", "")),
                        "followers": follower_count,
                        "content": clean,
                        "title": re.sub(r"<[^>]+>", "", obj.get("title", "")),
                        "url": f"https://www.zhihu.com/question/{obj.get('id', '')}",
                        "publish_time": "",
                        "likes": obj.get("voteup_count", 0),
                        "comments": obj.get("comment_count", 0),
                        "shares": 0,
                        "tags": "",
                        "metadata_json": json.dumps({"answer_count": answer_count, "type": item_type}, ensure_ascii=False),
                    }
                    items.append(record)
                    self.stats["parsed"] += 1
        except Exception as e:
            logger.warning("[zhihu] Parse error for keyword '%s': %s", keyword, e)
            self.stats["errors"] += 1

        return items
