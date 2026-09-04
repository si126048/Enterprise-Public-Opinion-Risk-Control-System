"""Identify which miHoYo product a piece of text refers to."""
from typing import Optional

PRODUCT_PATTERNS = {
    "原神": [
        "原神", "Genshin", "Genshin Impact", "提瓦特", "旅行者",
        "草神", "水神", "雷神", "岩神", "风神", "火神",
        "蒙德", "璃月", "稻妻", "须弥", "枫丹", "纳塔",
        "冒险等级", "深渊", "树脂", "原石",
    ],
    "崩坏：星穹铁道": [
        "崩铁", "星穹铁道", "HSR", "Honkai Star Rail",
        "开拓者", "星核", "星穹列车", "模拟宇宙",
        "黑塔", "仙舟罗浮", "匹诺康尼",
    ],
    "绝区零": [
        "绝区零", "ZZZ", "Zenless Zone Zero",
        "新艾利都", "代理人", "绳匠", "空洞",
    ],
    "未定事件簿": [
        "未定", "未定事件簿", "Tears of Themis",
        "左然", "莫弈", "陆景和", "夏彦",
    ],
}


def identify_product(text: str) -> Optional[str]:
    if not text:
        return None
    for product, keywords in PRODUCT_PATTERNS.items():
        for kw in keywords:
            if kw in text:
                return product
    return None
