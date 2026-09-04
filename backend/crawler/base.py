import logging
import time
import urllib.robotparser
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)


class BaseCrawler(ABC):

    def __init__(self, name: str, site_config: Dict, global_config: Optional[Dict] = None):
        self.name = name
        self.config = site_config
        self.global_config = global_config or {}
        self.delay: float = site_config.get("delay", self.global_config.get("default_delay", 2.0))
        self.max_pages: int = site_config.get("max_pages", self.global_config.get("max_pages_per_crawl", 200))
        self._session: Optional[requests.Session] = None
        self._last_request_time: float = 0.0
        self._robots_cache: Dict[str, urllib.robotparser.RobotFileParser] = {}
        self.errors: List[str] = []
        self.stats: Dict = {"fetched": 0, "parsed": 0, "errors": 0}

    def _get_session(self) -> requests.Session:
        if self._session is None:
            self._session = requests.Session()
            retry_strategy = Retry(
                total=self.global_config.get("max_retries", 3),
                backoff_factor=self.global_config.get("retry_backoff", 5.0),
                status_forcelist=[429, 500, 502, 503, 504],
                allowed_methods=["GET"],
            )
            adapter = HTTPAdapter(max_retries=retry_strategy)
            self._session.mount("http://", adapter)
            self._session.mount("https://", adapter)
            self._session.headers.update({
                "User-Agent": self.global_config.get("user_agent", "EnterpriseRiskMonitor/1.0"),
                **self.global_config.get("default_headers", {}),
            })
        return self._session

    def _rate_limit(self):
        elapsed = time.time() - self._last_request_time
        if elapsed < self.delay:
            time.sleep(self.delay - elapsed)
        self._last_request_time = time.time()

    def _is_allowed(self, url: str) -> bool:
        if not self.global_config.get("respect_robots_txt", True):
            return True
        parsed = urlparse(url)
        domain = f"{parsed.scheme}://{parsed.netloc}"
        if domain not in self._robots_cache:
            rp = urllib.robotparser.RobotFileParser()
            rp.set_url(f"{domain}/robots.txt")
            try:
                rp.read()
            except Exception:
                self._robots_cache[domain] = None
                return True
            if getattr(rp, "disallow_all", False) and not rp.entries:
                self._robots_cache[domain] = None
                return True
            self._robots_cache[domain] = rp
        rp = self._robots_cache[domain]
        if rp is None:
            return True
        return rp.can_fetch(
            self._get_session().headers.get("User-Agent", "*"), url
        )

    def fetch(self, url: str, timeout: Optional[int] = None) -> Optional[str]:
        if not self._is_allowed(url):
            logger.info("[%s] Blocked by robots.txt: %s", self.name, url)
            return None

        self._rate_limit()
        try:
            resp = self._get_session().get(
                url, timeout=timeout or self.global_config.get("request_timeout", 30)
            )
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding
            self.stats["fetched"] += 1
            return resp.text
        except requests.RequestException as e:
            msg = f"[{self.name}] Fetch error {url}: {e}"
            logger.warning(msg)
            self.errors.append(msg)
            self.stats["errors"] += 1
            return None

    @abstractmethod
    def crawl(self) -> List[Dict]:
        ...

    @abstractmethod
    def get_source_name(self) -> str:
        ...

    def cleanup(self):
        if self._session:
            self._session.close()
            self._session = None
