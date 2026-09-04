import json
import logging
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from backend.crawler.base import BaseCrawler

logger = logging.getLogger(__name__)


class SocialZhihuCrawler(BaseCrawler):

    def get_source_name(self) -> str:
        return "social_zhihu"

    def crawl(self) -> List[Dict]:
        records = []
        for start_url in self.config.get("urls", []):
            html = self.fetch(start_url)
            if not html:
                continue
            soup = BeautifulSoup(html, "lxml")
            items = self._extract_zhihu_items(soup, start_url)
            for item in items[:self.max_pages]:
                if item.get("raw_text") and len(item["raw_text"]) >= 20:
                    records.append(item)
        self.stats["parsed"] = len(records)
        return records

    def _extract_zhihu_items(self, soup: BeautifulSoup, base_url: str) -> List[Dict]:
        records = []

        items = soup.find_all(class_=re.compile(r"(SearchResult|Card|List-item)", re.I))
        if not items:
            items = soup.find_all("div", class_=re.compile(r"(ContentItem|AnswerItem)", re.I))

        for item in items:
            content_el = item.find(class_=re.compile(r"(content|RichContent-inner|CopyrightRichText)", re.I))
            if not content_el:
                content_el = item

            raw_text = content_el.get_text(separator="\n", strip=True)
            if len(raw_text) < 20:
                continue

            title = ""
            title_el = item.find(class_=re.compile(r"(ContentItem-title|QuestionItem-title)", re.I))
            if title_el:
                title = title_el.get_text(strip=True)
            if not title:
                h2 = item.find("h2")
                if h2:
                    title = h2.get_text(strip=True)

            time_str = None
            time_el = item.find(class_=re.compile(r"(ContentItem-time|time)", re.I))
            if time_el:
                m = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2})", time_el.get_text())
                if m:
                    time_str = m.group(1).replace("/", "-")

            link_el = item.find("a", href=re.compile(r"/question/\d+"))
            if not link_el:
                link_el = item.find("a", href=re.compile(r"/p/\d+"))
            url = urljoin(base_url, link_el["href"]) if link_el else base_url

            records.append({
                "source": self.get_source_name(),
                "url": url,
                "title": title or raw_text[:50],
                "raw_text": raw_text,
                "publish_time": time_str,
                "metadata_json": json.dumps({"category": "social", "platform": "zhihu"}, ensure_ascii=False),
            })

        return records
