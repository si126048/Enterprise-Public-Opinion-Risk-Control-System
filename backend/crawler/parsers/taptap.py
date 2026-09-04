"""TapTap crawler for miHoYo game reviews."""
import logging
from typing import Dict, List, Optional

from backend.crawler.base import BaseCrawler
from backend.crawler.product_identifier import identify_product

logger = logging.getLogger(__name__)

TAPTAP_GAME_IDS = {
    "原神": 191001,
    "崩坏：星穹铁道": 203864,
    "绝区零": 254316,
    "未定事件簿": 167732,
}


class TaptapCrawler(BaseCrawler):

    def get_source_name(self) -> str:
        return "taptap"

    def crawl(self, keywords: Optional[List[str]] = None, company_id: str = "mihoyo") -> List[Dict]:
        results = []
        for product_name, game_id in TAPTAP_GAME_IDS.items():
            items = self._get_reviews(game_id, product_name, company_id)
            results.extend(items)
        return results

    def _get_reviews(self, game_id: int, product_name: str, company_id: str) -> List[Dict]:
        items = []
        review_url = f"https://www.taptap.cn/app/{game_id}/review?order=new"

        html = self.fetch(review_url)
        if not html:
            return items

        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            review_items = soup.select("div.review-item, div[class*='review']")

            for review_el in review_items[:30]:
                content_el = review_el.select_one("div.review-content, div[class*='content']")
                content = content_el.get_text(strip=True) if content_el else ""
                author_el = review_el.select_one("a.user-name, span[class*='name']")
                author = author_el.get_text(strip=True) if author_el else ""
                score_el = review_el.select_one("span[class*='score'], div[class*='rating']")
                score_text = score_el.get_text(strip=True) if score_el else ""

                if not content:
                    continue

                product = identify_product(content) or product_name
                record = {
                    "company_id": company_id,
                    "company_name": "米哈游",
                    "product_name": product,
                    "platform": "taptap",
                    "source_type": "forum",
                    "author": author,
                    "author_id": "",
                    "followers": 0,
                    "content": content,
                    "title": "",
                    "url": review_url,
                    "publish_time": "",
                    "likes": 0,
                    "comments": 0,
                    "shares": 0,
                    "tags": f"score:{score_text}" if score_text else "",
                }
                items.append(record)
                self.stats["parsed"] += 1
        except Exception as e:
            logger.warning("[taptap] Review parse error for game %d: %s", game_id, e)
            self.stats["errors"] += 1

        return items
