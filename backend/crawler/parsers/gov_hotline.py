import json
import logging
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from backend.crawler.base import BaseCrawler

logger = logging.getLogger(__name__)


class GovHotlineCrawler(BaseCrawler):

    def get_source_name(self) -> str:
        return "gov_hotline"

    def crawl(self) -> List[Dict]:
        records = []
        for start_url in self.config.get("urls", []):
            html = self.fetch(start_url)
            if not html:
                continue
            soup = BeautifulSoup(html, "lxml")
            links = self._extract_complaint_links(soup, start_url)
            for link in links[:self.max_pages]:
                page_html = self.fetch(link["url"])
                if not page_html:
                    continue
                record = self._parse_complaint(page_html, link)
                if record:
                    records.append(record)
        self.stats["parsed"] = len(records)
        return records

    def _extract_complaint_links(self, soup: BeautifulSoup, base_url: str) -> List[Dict]:
        links = []
        seen = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            full_url = urljoin(base_url, href)
            if full_url in seen:
                continue
            if any(kw in full_url.lower() for kw in ["detail", "letter", "complaint", "reply", "question"]):
                title = a.get_text(strip=True)
                if title and len(title) > 4:
                    seen.add(full_url)
                    links.append({"url": full_url, "title": title})
        return links

    def _parse_complaint(self, html: str, link_meta: Dict) -> Optional[Dict]:
        soup = BeautifulSoup(html, "lxml")

        for tag in soup.find_all(["script", "style", "nav", "footer"]):
            tag.decompose()

        title = link_meta.get("title", "")
        title_el = soup.find("h1") or soup.find("title")
        if title_el:
            title = title_el.get_text(strip=True)

        content_parts = []

        complaint_el = soup.find(class_=re.compile(r"(complaint|question|ask|letter-content|detail)", re.I))
        if complaint_el:
            content_parts.append("【群众诉求】" + complaint_el.get_text(separator="\n", strip=True))

        reply_el = soup.find(class_=re.compile(r"(reply|response|answer|reply-content|reply)", re.I))
        if reply_el:
            content_parts.append("【官方回复】" + reply_el.get_text(separator="\n", strip=True))

        if not content_parts:
            content_el = (
                soup.find("article")
                or soup.find("main")
                or soup.find(class_=re.compile(r"(content|detail|body)", re.I))
                or soup.find("body")
            )
            if content_el:
                content_parts.append(content_el.get_text(separator="\n", strip=True))

        raw_text = "\n\n".join(content_parts)
        if len(raw_text) < 20:
            return None

        publish_time = self._extract_time(soup)

        return {
            "source": self.get_source_name(),
            "url": link_meta["url"],
            "title": title,
            "raw_text": raw_text,
            "publish_time": publish_time,
            "metadata_json": json.dumps({"category": "hotline"}, ensure_ascii=False),
        }

    def _extract_time(self, soup: BeautifulSoup) -> Optional[str]:
        for el in soup.find_all(string=re.compile(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}")):
            m = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)", str(el))
            if m:
                return m.group(1).replace("/", "-")
        return None
