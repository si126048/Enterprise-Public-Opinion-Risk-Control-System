"""Bilibili crawler for miHoYo-related video comments."""
import json
import logging
from typing import Dict, List, Optional

from backend.crawler.base import BaseCrawler
from backend.crawler.product_identifier import identify_product

logger = logging.getLogger(__name__)


class BilibiliCrawler(BaseCrawler):

    def get_source_name(self) -> str:
        return "bilibili"

    def crawl(self, keywords: Optional[List[str]] = None, company_id: str = "mihoyo") -> List[Dict]:
        results = []
        if not keywords:
            return results

        for keyword in keywords:
            videos = self._search_videos(keyword)
            for video in videos:
                comments = self._get_comments(video.get("bvid", ""), video.get("aid", 0))
                for comment in comments:
                    comment["company_id"] = company_id
                    comment["company_name"] = "米哈游"
                    comment["title"] = video.get("title", "")
                    comment["metadata_json"] = json.dumps({
                        "video_title": video.get("title", ""),
                        "video_author": video.get("author", ""),
                        "bvid": video.get("bvid", ""),
                    }, ensure_ascii=False)
                results.extend(comments)
        return results

    def _search_videos(self, keyword: str) -> List[Dict]:
        videos = []
        api_url = f"https://api.bilibili.com/x/web-interface/search/type?search_type=video&keyword={keyword}&page=1"

        html = self.fetch(api_url)
        if not html:
            return videos

        try:
            data = json.loads(html)
            result_list = data.get("data", {}).get("result", [])
            for v in result_list[:20]:
                import re
                title = re.sub(r"<[^>]+>", "", v.get("title", ""))
                videos.append({
                    "bvid": v.get("bvid", ""),
                    "aid": v.get("aid", 0),
                    "title": title,
                    "author": v.get("author", ""),
                    "play": v.get("play", 0),
                    "reply": v.get("review", 0),
                })
                self.stats["parsed"] += 1
        except Exception as e:
            logger.warning("[bilibili] Video search error for '%s': %s", keyword, e)
            self.stats["errors"] += 1

        return videos

    def _get_comments(self, bvid: str, aid: int) -> List[Dict]:
        comments = []
        if not aid:
            return comments

        api_url = f"https://api.bilibili.com/x/v2/reply?type=1&oid={aid}&pn=1&sort=1"
        html = self.fetch(api_url)
        if not html:
            return comments

        try:
            data = json.loads(html)
            replies = data.get("data", {}).get("replies", []) or []
            for reply in replies[:50]:
                content_msg = reply.get("content", {}).get("message", "")
                product = identify_product(content_msg)
                member = reply.get("member", {})
                record = {
                    "product_name": product,
                    "platform": "bilibili",
                    "source_type": "social_media",
                    "author": member.get("uname", ""),
                    "author_id": str(member.get("mid", "")),
                    "followers": 0,
                    "content": content_msg,
                    "url": f"https://www.bilibili.com/video/{bvid}",
                    "publish_time": "",
                    "likes": reply.get("like", 0),
                    "comments": reply.get("rcount", 0),
                    "shares": 0,
                    "tags": "",
                }
                comments.append(record)
                self.stats["parsed"] += 1
        except Exception as e:
            logger.warning("[bilibili] Comment parse error for '%s': %s", bvid, e)
            self.stats["errors"] += 1

        return comments
