import json
import logging
import re
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse, parse_qs

from bs4 import BeautifulSoup

from backend.crawler.base import BaseCrawler

logger = logging.getLogger(__name__)


class NewsForumCrawler(BaseCrawler):

    def get_source_name(self) -> str:
        return "news_forum"

    def crawl(self) -> List[Dict]:
        records = []
        for start_url in self.config.get("urls", []):
            parsed = urlparse(start_url)
            if "tieba.baidu.com" in parsed.netloc:
                records.extend(self._crawl_tieba(start_url))
            else:
                records.extend(self._crawl_generic_news(start_url))
        self.stats["parsed"] = len(records)
        return records

    def _crawl_tieba(self, start_url: str) -> List[Dict]:
        records = []
        html = self.fetch(start_url)
        if not html:
            return records

        soup = BeautifulSoup(html, "lxml")
        thread_links = self._extract_tieba_threads(soup, start_url)

        for link in thread_links[:self.max_pages]:
            page_html = self.fetch(link["url"])
            if not page_html:
                continue
            record = self._parse_tieba_thread(page_html, link)
            if record:
                records.append(record)

        return records

    def _extract_tieba_threads(self, soup: BeautifulSoup, base_url: str) -> List[Dict]:
        links = []
        seen = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/p/" not in href:
                continue
            full_url = urljoin(base_url, href)
            if full_url in seen:
                continue
            title = a.get_text(strip=True)
            if title and len(title) > 2:
                seen.add(full_url)
                links.append({"url": full_url, "title": title})
        return links

    def _parse_tieba_thread(self, html: str, link_meta: Dict) -> Optional[Dict]:
        soup = BeautifulSoup(html, "lxml")

        for tag in soup.find_all(["script", "style"]):
            tag.decompose()

        title = link_meta.get("title", "")
        title_el = soup.find(class_="core_title_txt") or soup.find("h1") or soup.find("title")
        if title_el:
            title = title_el.get_text(strip=True)

        posts = soup.find_all(class_=re.compile(r"(post_content|d_post_content)", re.I))
        if posts:
            text_parts = []
            for post in posts:
                text = post.get_text(separator="\n", strip=True)
                if text:
                    text_parts.append(text)
            raw_text = "\n---\n".join(text_parts)
        else:
            content_el = soup.find(class_="p_content") or soup.find("body")
            raw_text = content_el.get_text(separator="\n", strip=True) if content_el else ""

        if len(raw_text) < 10:
            return None

        publish_time = self._extract_tieba_time(soup)

        return {
            "source": self.get_source_name(),
            "url": link_meta["url"],
            "title": title,
            "raw_text": raw_text,
            "publish_time": publish_time,
            "metadata_json": json.dumps({"category": "forum", "platform": "tieba"}, ensure_ascii=False),
        }

    def _extract_tieba_time(self, soup: BeautifulSoup) -> Optional[str]:
        time_el = soup.find(class_=re.compile(r"post-tail-wrap"))
        if time_el:
            m = re.search(r"(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})", time_el.get_text())
            if m:
                return m.group(1)
        return None

    def _crawl_generic_news(self, start_url: str) -> List[Dict]:
        records = []
        html = self.fetch(start_url)
        if not html:
            return records

        soup = BeautifulSoup(html, "lxml")
        links = []
        seen = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            full_url = urljoin(start_url, href)
            if full_url in seen:
                continue
            if re.search(r"\.(html?|shtml|jsp)(\?|$)", full_url, re.I):
                title = a.get_text(strip=True)
                if title and len(title) > 6:
                    seen.add(full_url)
                    links.append({"url": full_url, "title": title})

        for link in links[:self.max_pages]:
            page_html = self.fetch(link["url"])
            if not page_html:
                continue
            record = self._parse_news_article(page_html, link)
            if record:
                records.append(record)

        return records

    def _parse_news_article(self, html: str, link_meta: Dict) -> Optional[Dict]:
        soup = BeautifulSoup(html, "lxml")

        for tag in soup.find_all(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        title = link_meta.get("title", "")
        title_el = soup.find("h1") or soup.find("title")
        if title_el:
            title = title_el.get_text(strip=True)

        content_el = (
            soup.find("article")
            or soup.find(class_=re.compile(r"(article|content|detail|text|body)", re.I))
            or soup.find("main")
            or soup.find("body")
        )
        if not content_el:
            return None

        raw_text = content_el.get_text(separator="\n", strip=True)
        if len(raw_text) < 20:
            return None

        publish_time = self._extract_news_time(soup)

        return {
            "source": self.get_source_name(),
            "url": link_meta["url"],
            "title": title,
            "raw_text": raw_text,
            "publish_time": publish_time,
            "metadata_json": json.dumps({"category": "news"}, ensure_ascii=False),
        }

    def _extract_news_time(self, soup: BeautifulSoup) -> Optional[str]:
        time_el = soup.find(class_=re.compile(r"(time|date|pub|info)", re.I))
        if time_el:
            m = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)", time_el.get_text())
            if m:
                return m.group(1).replace("/", "-")
        for el in soup.find_all(string=re.compile(r"\d{4}[-/]\d{1,2}[-/]\d{1,2}")):
            m = re.search(r"(\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)", str(el))
            if m:
                return m.group(1).replace("/", "-")
        return None
