"""Generate 200+ realistic miHoYo gaming opinion sample data."""
import csv
import random
import sys
import io
from pathlib import Path
from datetime import datetime, timedelta

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

random.seed(42)

PRODUCTS = {
    "原神": {
        "weight": 0.40,
        "authors": ["原神强度党", "旅行者日记", "提瓦特探险家", "原神老玩家", "蒙德城骑士",
                     "璃月港商人", "稻妻武士", "须弥学者", "枫丹审判者", "纳塔战士"],
        "templates_neg": [
            "原神{ver}角色强度越来越离谱了，旧角色直接退环境，抽卡体验也越来越差，保底吃满",
            "原神{ver}版本长草期太长了，一个月没新内容，每天上线5分钟下线",
            "原神抽卡概率绝对是假的，连着吃满大保底，这游戏真敢",
            "原神{ver}活动就这？奖励抠门，内容敷衍，策划是不是不玩游戏",
            "原神新角色立绘越画越崩，和宣传图差距太大了，配音也出戏",
            "原神越来越贵了，月卡党根本玩不起，专武必须抽，平民没法玩",
            "原神{ver}剧情写得像流水账，毫无魅力，角色人设崩坏",
            "原神更新完又卡了，手机发烫到不行，优化越来越差",
            "原神身边玩的人越来越少了，竞品更好玩，准备退坑了",
            "原神策划该换人了，玩家意见从来不听，迟早要凉",
        ],
        "templates_neu": [
            "原神{ver}版本还行吧，内容量一般，不算惊喜也不失望",
            "原神依然是好游戏，但有些问题确实需要改进",
            "原神{ver}新角色设计中规中矩，强度适中，值得抽",
            "玩原神三年了，感觉游戏在走下坡路但还能接受",
            "原神{ver}地图探索内容还可以，就是日常太肝了",
        ],
        "templates_pos": [
            "原神{ver}太惊艳了，新地图设计绝了，探索体验拉满",
            "原神音乐永远的神，新版本BGM听哭了",
            "原神{ver}剧情封神了，米哈游编剧终于在线了",
            "原神优化好多了，新版本流畅很多，好评",
            "原神福利增多，良心运营，尊重玩家体验",
        ],
    },
    "崩坏：星穹铁道": {
        "weight": 0.28,
        "authors": ["星铁开拓者", "崩铁老玩家", "星核猎人", "银河铁路员", "铁道党",
                     "崩铁数据帝", "星穹列车长", "模拟宇宙达人"],
        "templates_neg": [
            "崩铁{ver}版本长草期太长了，每天上线10分钟就没事干，内容产能跟不上了",
            "崩铁剧情越来越敷衍了，角色人设崩坏，感觉团队重心都在新项目上了",
            "崩铁抽卡体验太差，大保底才出，概率感人",
            "崩铁{ver}新角色强度超标，旧角色直接下水道，平衡性堪忧",
            "崩铁日常太无聊了，就是刷材料，玩法单一",
            "崩铁{ver}活动设计不行，奖励少，机制复杂",
        ],
        "templates_neu": [
            "崩铁{ver}版本还行，剧情一般般，角色设计可以",
            "星穹铁道算是合格的副游，不肝不氪也能玩",
            "崩铁{ver}新角色中规中矩，强度适中",
            "崩铁音乐一直在线，但游戏玩法需要创新",
        ],
        "templates_pos": [
            "崩铁{ver}剧情太神了，米哈游编剧在线！",
            "崩铁新角色设计绝了，立绘超好看，必须抽",
            "崩铁{ver}福利多多，良心运营，好评",
            "星穹铁道越做越好了，战斗系统越来越成熟",
        ],
    },
    "绝区零": {
        "weight": 0.16,
        "authors": ["游戏测评师", "游戏玩家大白", "新艾利都代理人", "ZZZ玩家", "绝区零爱好者",
                     "绳匠日记"],
        "templates_neg": [
            "绝区零走格子机制太无聊了，打斗手感也一般，和宣传差太多了，不推荐",
            "绝区零公测第一天就炸服？米哈游的技术实力就这？补偿只有100钻也太抠了",
            "绝区零{ver}优化太差了，PC端帧率掉得厉害，3060都带不动",
            "绝区零角色设计没特色，和原神崩铁差距明显",
            "绝区零玩法太单一，走格子走到烦，战斗也不够爽",
            "绝区零内容量太少，长草期比崩铁还长",
        ],
        "templates_neu": [
            "绝区零美术风格不错，但玩法还需要打磨",
            "绝区零算是米哈游的尝试，有亮点也有不足",
            "绝区零{ver}有进步，但距离一线还有差距",
        ],
        "templates_pos": [
            "绝区零战斗手感真爽，打击感拉满！",
            "绝区零美术风格独特，赛博朋克+街头文化，爱了",
            "绝区零{ver}更新后好多了，团队在认真改进",
        ],
    },
    "未定事件簿": {
        "weight": 0.08,
        "authors": ["乙女游戏爱好者", "未定玩家", "左然夫人", "乙游达人", "莫弈粉丝"],
        "templates_neg": [
            "未定事件簿新卡池概率太低了，80抽没出SSR，官方连个说法都没有",
            "未定{ver}剧情太水了，感觉在拖时间，主线推进慢",
            "未定运营越来越敷衍了，活动奖励少，福利差",
        ],
        "templates_neu": [
            "未定事件簿剧情还行，但更新太慢了",
            "未定{ver}新卡面好看，但玩法没新意",
        ],
        "templates_pos": [
            "未定事件簿新剧情太甜了，左然yyds！",
            "未定{ver}卡面绝美，乙女游戏天花板",
        ],
    },
    "公司": {
        "weight": 0.08,
        "authors": ["财经观察", "科技新视野", "游戏行业分析师", "互联网那些事", "手游那点事",
                     "大伟哥粉丝", "游戏产业观察"],
        "templates_neg": [
            "米哈游新作绝区零公测表现不及预期，股价承压，市场担忧其产品线单一化风险",
            "米哈游员工爆料加班太严重，996是常态，企业文化堪忧",
            "米哈游公关回应太敷衍了，毫无诚意，冷处理玩家诉求",
            "米哈游社区管理只会禁言，正常反馈都被删，玩家群体被挑拨对立",
            "米哈游越来越逼氪了，吃相难看，割韭菜",
        ],
        "templates_neu": [
            "米哈游AI技术布局：蔡浩宇亲自带队，下一个十年押注AIGC游戏",
            "米哈游估值又涨了，准备IPO吗？",
            "米哈游三款产品并行，资源分配是个挑战",
        ],
        "templates_pos": [
            "大伟哥又在发布会上画大饼了，但米哈游确实有实力",
            "米哈游技术实力国内顶尖，AIGC布局有远见",
            "米哈游海外收入占比高，中国游戏出海标杆",
        ],
    },
}

PLATFORMS = {
    "微博": {"weight": 0.30, "source_type": "social_media", "url_tpl": "https://weibo.com/{uid}", "followers_range": (500, 50000)},
    "小红书": {"weight": 0.18, "source_type": "social_media", "url_tpl": "https://xiaohongshu.com/{uid}", "followers_range": (200, 20000)},
    "知乎": {"weight": 0.15, "source_type": "forum", "url_tpl": "https://zhihu.com/{uid}", "followers_range": (100, 30000)},
    "B站": {"weight": 0.17, "source_type": "social_media", "url_tpl": "https://bilibili.com/{uid}", "followers_range": (1000, 100000)},
    "TapTap": {"weight": 0.06, "source_type": "forum", "url_tpl": "https://taptap.com/{uid}", "followers_range": (50, 10000)},
    "小黑盒": {"weight": 0.07, "source_type": "forum", "url_tpl": "https://xiaoheihe.cn/{uid}", "followers_range": (100, 30000)},
    "米游社": {"weight": 0.07, "source_type": "forum", "url_tpl": "https://miyoushe.com/{uid}", "followers_range": (200, 50000)},
}

TAGS_MAP = {
    "原神": ["#原神#", "#原神吐槽#", "#米哈游#", "#Genshin#"],
    "崩坏：星穹铁道": ["#崩铁#", "#星穹铁道#", "#米哈游#"],
    "绝区零": ["#绝区零#", "#ZZZ#", "#米哈游#"],
    "未定事件簿": ["#未定事件簿#", "#乙游#", "#米哈游#"],
    "公司": ["#米哈游#", "#miHoYo#", "#游戏行业#"],
}

VER_POOL = ["4.8", "4.9", "5.0", "2.5", "2.6", "1.3", "1.4", "3.0"]

CREDIBILITY_WEIGHTS = {"low": 0.45, "medium": 0.35, "high": 0.20}


def pick_product():
    products = list(PRODUCTS.keys())
    weights = [PRODUCTS[p]["weight"] for p in products]
    return random.choices(products, weights=weights, k=1)[0]


def pick_platform():
    platforms = list(PLATFORMS.keys())
    weights = [PLATFORMS[p]["weight"] for p in platforms]
    return random.choices(platforms, weights=weights, k=1)[0]


def pick_credibility_level():
    return random.choices(
        list(CREDIBILITY_WEIGHTS.keys()),
        weights=list(CREDIBILITY_WEIGHTS.values()),
        k=1
    )[0]


def generate_content(product, credibility_level):
    pdata = PRODUCTS[product]
    key_map = {"low": "templates_neg", "medium": "templates_neu", "high": "templates_pos"}
    templates = pdata[key_map[credibility_level]]
    text = random.choice(templates)
    ver = random.choice(VER_POOL)
    text = text.replace("{ver}", ver)
    return text


def generate_record(record_id):
    product = pick_product()
    platform = pick_platform()
    credibility_level = pick_credibility_level()

    pdata = PRODUCTS[product]
    pldata = PLATFORMS[platform]

    author = random.choice(pdata["authors"])
    followers = random.randint(*pldata["followers_range"])
    content = generate_content(product, credibility_level)
    tags = ",".join(random.sample(TAGS_MAP.get(product, []), k=random.randint(1, 2)))

    uid = f"user_{random.randint(100000, 999999)}"
    url = pldata["url_tpl"].format(uid=uid)

    days_ago = random.randint(0, 30)
    hours_offset = random.randint(0, 23)
    publish_time = (datetime(2026, 9, 4) - timedelta(days=days_ago, hours=hours_offset)).strftime("%Y-%m-%d %H:%M:%S")

    if credibility_level == "low":
        likes = random.randint(50, 2000)
        comments = random.randint(20, 500)
        shares = random.randint(10, 300)
    elif credibility_level == "high":
        likes = random.randint(100, 5000)
        comments = random.randint(30, 800)
        shares = random.randint(20, 500)
    else:
        likes = random.randint(10, 500)
        comments = random.randint(5, 100)
        shares = random.randint(2, 50)

    return {
        "company_id": "mihoyo",
        "company_name": "米哈游",
        "product_name": product,
        "platform": platform,
        "source_type": pldata["source_type"],
        "author": author,
        "author_id": uid,
        "followers": followers,
        "content": content,
        "title": content[:30] + ("..." if len(content) > 30 else ""),
        "publish_time": publish_time,
        "url": url + f"/{random.randint(100000, 999999)}",
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "tags": tags,
    }


def generate_samples(count=220):
    records = []
    for i in range(count):
        rid = f"mhy_{(datetime(2026, 9, 4) - timedelta(days=random.randint(0, 30))).strftime('%Y%m%d')}_{i+1:03d}"
        rec = generate_record(rid)
        rec["id"] = rid
        records.append(rec)
    return records


FIELDNAMES = [
    "id", "company_id", "company_name", "product_name", "platform",
    "source_type", "author", "author_id", "followers", "content", "title",
    "publish_time", "url", "likes", "comments", "shares", "tags",
]


def main():
    records = generate_samples(220)

    out_path = Path(__file__).resolve().parent.parent / "data" / "sample" / "mihoyo_sample.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)

    product_counts = {}
    platform_counts = {}
    for r in records:
        product_counts[r["product_name"]] = product_counts.get(r["product_name"], 0) + 1
        platform_counts[r["platform"]] = platform_counts.get(r["platform"], 0) + 1

    print(f"Generated {len(records)} records -> {out_path}")
    print(f"Product distribution: {product_counts}")
    print(f"Platform distribution: {platform_counts}")


if __name__ == "__main__":
    main()
