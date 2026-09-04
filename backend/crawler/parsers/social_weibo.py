import json
import logging
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from backend.crawler.base import BaseCrawler

logger = logging.getLogger(__name__)


class SocialWeiboCrawler(BaseCrawler):

    def get_source_name(self) -> str:
        return "social_weibo"

    def crawl(self) -> List[Dict]:
        records = []
        for start_url in self.config.get("urls", []):
            html = self.fetch(start_url)
            if not html:
                continue
            soup = BeautifulSoup(html, "lxml")
            posts = self._extract_weibo_posts(soup, start_url)
            for post in posts[:self.max_pages]:
                if post.get("raw_text") and len(post["raw_text"]) >= 10:
                    records.append(post)
        self.stats["parsed"] = len(records)
        return records

    def _extract_weibo_posts(self, soup: BeautifulSoup, base_url: str) -> List[Dict]:
        records = []
        action_cards = soup.find_all(class_=re.compile(r"(card-wrap|card|weibo-text|m-text)", re.I))

        for card in action_cards:
            text_el = card.find(class_=re.compile(r"(txt|text|content|weibo-text)", re.I))
            if not text_el:
                continue

            raw_text = text_el.get_text(separator="\n", strip=True)
            if len(raw_text) < 10:
                continue

            title = ""
            name_el = card.find(class_=re.compile(r"(name|nick|uname)", re.I))
            if name_el:
                title = name_el.get_text(strip=True)

            time_str = None
            time_el = card.find(class_=re.compile(r"(from|time|date)", re.I))
            if time_el:
                m = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{2}:\d{2})?)", time_el.get_text())
                if m:
                    time_str = m.group(1).replace("/", "-")

            link_el = card.find("a", href=re.compile(r"/\d+/\w+"))
            url = urljoin(base_url, link_el["href"]) if link_el else base_url

            records.append({
                "source": self.get_source_name(),
                "url": url,
                "title": title or raw_text[:50],
                "raw_text": raw_text,
                "publish_time": time_str,
                "metadata_json": json.dumps({"category": "social", "platform": "weibo"}, ensure_ascii=False),
            })

        return records
