"""Xiaohongshu crawler for miHoYo-related notes."""
import logging
from typing import Dict, List, Optional

from backend.crawler.base import BaseCrawler
from backend.crawler.product_identifier import identify_product

logger = logging.getLogger(__name__)


class XiaohongshuCrawler(BaseCrawler):

    def get_source_name(self) -> str:
        return "xiaohongshu"

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
        search_url = f"https://www.xiaohongshu.com/search_result?keyword={keyword}&source=web_search_result_note"

        html = self.fetch(search_url)
        if not html:
            return items

        try:
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(html, "html.parser")
            note_cards = soup.select("section.note-item, div.note-item, a.cover")

            for card in note_cards[:50]:
                title_el = card.select_one("span.title, div.title, a.title")
                title = title_el.get_text(strip=True) if title_el else ""
                author_el = card.select_one("span.author, div.author-wrapper span.name")
                author = author_el.get_text(strip=True) if author_el else ""
                link_el = card.select_one("a[href*='/explore/']") or card.select_one("a[href*='/discovery/item/']")
                note_url = ""
                if link_el and link_el.get("href"):
                    href = link_el["href"]
                    note_url = f"https://www.xiaohongshu.com{href}" if href.startswith("/") else href

                content = title
                product = identify_product(content)
                record = {
                    "company_id": company_id,
                    "company_name": "米哈游",
                    "product_name": product,
                    "platform": "xiaohongshu",
                    "source_type": "social_media",
                    "author": author,
                    "author_id": "",
                    "followers": 0,
                    "content": content,
                    "title": title,
                    "url": note_url or search_url,
                    "publish_time": "",
                    "likes": 0,
                    "comments": 0,
                    "shares": 0,
                    "tags": "",
                }
                items.append(record)
                self.stats["parsed"] += 1
        except Exception as e:
            logger.warning("[xiaohongshu] Parse error for keyword '%s': %s", keyword, e)
            self.stats["errors"] += 1

        return items
