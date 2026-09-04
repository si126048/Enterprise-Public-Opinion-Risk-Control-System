"""Bulk generate ~4500 realistic mock records and import into database."""
import sys
import io
import random
import uuid
from pathlib import Path
from datetime import datetime, timedelta

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.ingestion.importer import import_from_dict
from backend.db.database import init_db

random.seed(2026)

PRODUCTS = {
    "原神": {
        "weight": 0.40,
        "authors": [
            "旅行者日记", "提瓦特探险家", "原神老玩家", "蒙德城骑士", "璃月港商人",
            "稻妻武士", "须弥学者", "枫丹审判者", "纳塔战士", "原神强度党",
            "深渊满星选手", "原神攻略组", "抽卡非酋", "月卡党玩家", "原神音乐粉",
            "地图探索爱好者", "原神剧情党", "角色厨力党", "原神截图党", "开放世界爱好者",
        ],
        "templates_neg": [
            "原神{ver}角色强度越来越离谱了，旧角色直接退环境，抽卡体验也越来越差，保底吃满才出",
            "原神{ver}版本长草期太长了，一个月没新内容，每天上线5分钟下线，无聊透顶",
            "原神抽卡概率绝对是假的，连着吃满大保底，这游戏真敢啊，投诉都没用",
            "原神{ver}活动就这？奖励抠门，内容敷衍，策划是不是不玩游戏",
            "原神新角色立绘越画越崩，和宣传图差距太大了，配音也出戏，完全不符合人设",
            "原神越来越贵了，月卡党根本玩不起，专武必须抽，平民没法玩",
            "原神{ver}剧情写得像流水账，毫无魅力，角色人设崩坏，失望",
            "原神更新完又卡了，手机发烫到不行，优化越来越差，闪退频繁",
            "原神身边玩的人越来越少了，竞品更好玩，准备退坑了",
            "原神策划该换人了，玩家意见从来不听，迟早要凉",
            "原神{ver}深渊难度不合理，怪物血量太厚，没有合适角色根本打不过",
            "原神地图越来越空洞，探索奖励少，开宝箱全是摩拉，没意思",
            "原神{ver}圣遗物系统太坑了，刷了三个月全是防御词条",
            "原神联机体验差，匹配不到人，副本机制也不适合多人",
            "原神{ver}剧情跳过键都没有，对话又长又无聊",
        ],
        "templates_neu": [
            "原神{ver}版本还行吧，内容量一般，不算惊喜也不失望",
            "原神依然是好游戏，但有些问题确实需要改进",
            "原神{ver}新角色设计中规中矩，强度适中，值得抽",
            "玩原神三年了，感觉游戏在走下坡路但还能接受",
            "原神{ver}地图探索内容还可以，就是日常太肝了",
            "原神音乐一直在线，但游戏玩法需要更多创新",
            "原神{ver}整体体验尚可，希望后续版本能改善优化问题",
            "作为开放世界游戏原神算合格，但期待更高一些会更好",
        ],
        "templates_pos": [
            "原神{ver}太惊艳了，新地图设计绝了，探索体验拉满",
            "原神音乐永远的神，新版本BGM听哭了",
            "原神{ver}剧情封神了，米哈游编剧终于在线了",
            "原神优化好多了，新版本流畅很多，好评",
            "原神福利增多，良心运营，尊重玩家体验",
            "原神{ver}新角色太帅了，技能特效拉满，必须抽",
            "原神开放世界越做越好，每个国家都有特色，期待下一站",
            "原神{ver}活动设计用心，奖励丰厚，玩法有趣",
        ],
    },
    "崩坏：星穹铁道": {
        "weight": 0.28,
        "authors": [
            "星铁开拓者", "崩铁老玩家", "星核猎人", "银河铁路员", "铁道党",
            "崩铁数据帝", "星穹列车长", "模拟宇宙达人", "崩铁剧情粉", "忘却之庭攻略组",
            "崩铁角色厨", "铁道萌新", "星铁截图党", "回合制爱好者",
        ],
        "templates_neg": [
            "崩铁{ver}版本长草期太长了，每天上线10分钟就没事干，内容产能跟不上了",
            "崩铁剧情越来越敷衍了，角色人设崩坏，感觉团队重心都在新项目上了",
            "崩铁抽卡体验太差，大保底才出，概率感人，氪金体验不好",
            "崩铁{ver}新角色强度超标，旧角色直接下水道，平衡性堪忧",
            "崩铁日常太无聊了，就是刷材料，玩法单一，缺乏创新",
            "崩铁{ver}活动设计不行，奖励少，机制复杂，参与感差",
            "崩铁回合制玩腻了，战斗节奏太慢，没有操作感",
            "崩铁{ver}优化还是差，手机发热严重，加载时间长",
        ],
        "templates_neu": [
            "崩铁{ver}版本还行，剧情一般般，角色设计可以",
            "星穹铁道算是合格的副游，不肝不氪也能玩",
            "崩铁{ver}新角色中规中矩，强度适中",
            "崩铁音乐一直在线，但游戏玩法需要创新",
            "崩铁{ver}内容量适中，适合休闲玩家",
        ],
        "templates_pos": [
            "崩铁{ver}剧情太神了，米哈游编剧在线！",
            "崩铁新角色设计绝了，立绘超好看，必须抽",
            "崩铁{ver}福利多多，良心运营，好评",
            "星穹铁道越做越好了，战斗系统越来越成熟",
            "崩铁{ver}忘却之庭设计精妙，挑战性强，通关有成就感",
        ],
    },
    "绝区零": {
        "weight": 0.16,
        "authors": [
            "游戏测评师", "游戏玩家大白", "新艾利都代理人", "ZZZ玩家", "绝区零爱好者",
            "绳匠日记", "绝区零动作粉", "ZZZ攻略组", "绝区零萌新",
        ],
        "templates_neg": [
            "绝区零走格子机制太无聊了，打斗手感也一般，和宣传差太多了，不推荐",
            "绝区零公测第一天就炸服？米哈游的技术实力就这？补偿只有100钻也太抠了",
            "绝区零{ver}优化太差了，PC端帧率掉得厉害，3060都带不动",
            "绝区零角色设计没特色，和原神崩铁差距明显",
            "绝区零玩法太单一，走格子走到烦，战斗也不够爽",
            "绝区零内容量太少，长草期比崩铁还长，没啥可玩的",
            "绝区零{ver}更新修复了啥？bug反而更多了",
        ],
        "templates_neu": [
            "绝区零美术风格不错，但玩法还需要打磨",
            "绝区零算是米哈游的尝试，有亮点也有不足",
            "绝区零{ver}有进步，但距离一线还有差距",
            "绝区零战斗系统有潜力，但需要更多玩法支撑",
        ],
        "templates_pos": [
            "绝区零战斗手感真爽，打击感拉满！",
            "绝区零美术风格独特，赛博朋克+街头文化，爱了",
            "绝区零{ver}更新后好多了，团队在认真改进",
            "绝区零角色设计有个性，动作流畅，值得推荐",
        ],
    },
    "未定事件簿": {
        "weight": 0.08,
        "authors": [
            "乙女游戏爱好者", "未定玩家", "左然夫人", "乙游达人", "莫弈粉丝",
            "未定剧情粉", "乙游收藏家",
        ],
        "templates_neg": [
            "未定事件簿新卡池概率太低了，80抽没出SSR，官方连个说法都没有",
            "未定{ver}剧情太水了，感觉在拖时间，主线推进慢",
            "未定运营越来越敷衍了，活动奖励少，福利差",
            "未定事件簿更新太慢，一个月等不来新内容",
        ],
        "templates_neu": [
            "未定事件簿剧情还行，但更新太慢了",
            "未定{ver}新卡面好看，但玩法没新意",
            "未定事件簿作为乙游中规中矩，期待更多突破",
        ],
        "templates_pos": [
            "未定事件簿新剧情太甜了，左然yyds！",
            "未定{ver}卡面绝美，乙女游戏天花板",
            "未定事件簿配音阵容豪华，代入感强",
        ],
    },
    "公司": {
        "weight": 0.08,
        "authors": [
            "财经观察", "科技新视野", "游戏行业分析师", "互联网那些事", "手游那点事",
            "大伟哥粉丝", "游戏产业观察", "科技媒体人", "投资圈老张",
        ],
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
    "微博": {"weight": 0.30, "source_type": "social_media", "url_tpl": "https://weibo.com/u/{uid}", "followers_range": (500, 80000)},
    "小红书": {"weight": 0.18, "source_type": "social_media", "url_tpl": "https://xiaohongshu.com/user/profile/{uid}", "followers_range": (200, 30000)},
    "知乎": {"weight": 0.15, "source_type": "forum", "url_tpl": "https://zhihu.com/people/{uid}", "followers_range": (100, 50000)},
    "B站": {"weight": 0.17, "source_type": "video", "url_tpl": "https://space.bilibili.com/{uid}", "followers_range": (1000, 150000)},
    "TapTap": {"weight": 0.06, "source_type": "forum", "url_tpl": "https://www.taptap.com/user/{uid}", "followers_range": (50, 15000)},
    "小黑盒": {"weight": 0.07, "source_type": "forum", "url_tpl": "https://xiaoheihe.cn/user/{uid}", "followers_range": (100, 40000)},
    "米游社": {"weight": 0.07, "source_type": "forum", "url_tpl": "https://www.miyoushe.com/ys/account/{uid}", "followers_range": (200, 60000)},
}

TAGS_MAP = {
    "原神": ["#原神#", "#原神吐槽#", "#米哈游#", "#Genshin#", "#提瓦特#", "#原神攻略#"],
    "崩坏：星穹铁道": ["#崩铁#", "#星穹铁道#", "#米哈游#", "#星铁攻略#"],
    "绝区零": ["#绝区零#", "#ZZZ#", "#米哈游#", "#绝区零攻略#"],
    "未定事件簿": ["#未定事件簿#", "#乙游#", "#米哈游#", "#左然#"],
    "公司": ["#米哈游#", "#miHoYo#", "#游戏行业#", "#游戏出海#"],
}

VER_POOL = ["4.8", "4.9", "5.0", "5.1", "2.5", "2.6", "2.7", "1.3", "1.4", "1.5", "3.0", "3.1"]

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
    suffix = random.choice([
        "", " #游戏#", " 你们怎么看？", " 有人一样吗？",
        " 求解答", " 不吐不快", " 理性讨论", " 个人感受",
        f" [来自{random.choice(['iPhone 15', '小米14', '华为Mate60', '三星S24', 'iPad Pro'])}]",
    ])
    return text + suffix


def generate_record(idx):
    product = pick_product()
    platform = pick_platform()
    credibility_level = pick_credibility_level()

    pdata = PRODUCTS[product]
    pldata = PLATFORMS[platform]

    author = random.choice(pdata["authors"])
    if random.random() < 0.3:
        author = author + str(random.randint(1, 99))

    followers = int(random.uniform(*pldata["followers_range"]))
    content = generate_content(product, credibility_level)
    tags = ",".join(random.sample(TAGS_MAP.get(product, []), k=random.randint(1, 3)))

    uid = f"{random.randint(100000, 9999999)}"
    url = pldata["url_tpl"].format(uid=uid) + f"/{random.randint(100000, 9999999)}"

    days_ago = random.randint(0, 60)
    hours_offset = random.randint(0, 23)
    minutes_offset = random.randint(0, 59)
    publish_time = (datetime(2026, 9, 4) - timedelta(
        days=days_ago, hours=hours_offset, minutes=minutes_offset
    )).strftime("%Y-%m-%d %H:%M:%S")

    if credibility_level == "low":
        likes = int(random.uniform(50, 3000) * random.uniform(0.8, 1.2))
        comments = int(random.uniform(20, 600) * random.uniform(0.7, 1.3))
        shares = int(random.uniform(10, 400) * random.uniform(0.6, 1.4))
    elif credibility_level == "high":
        likes = int(random.uniform(100, 8000) * random.uniform(0.85, 1.15))
        comments = int(random.uniform(30, 1000) * random.uniform(0.75, 1.25))
        shares = int(random.uniform(20, 600) * random.uniform(0.7, 1.3))
    else:
        likes = int(random.uniform(10, 800) * random.uniform(0.8, 1.2))
        comments = int(random.uniform(5, 150) * random.uniform(0.7, 1.3))
        shares = int(random.uniform(2, 80) * random.uniform(0.6, 1.4))

    record_id = f"bulk_{datetime.now().strftime('%Y%m%d')}_{idx:05d}_{uuid.uuid4().hex[:6]}"

    return {
        "id": record_id,
        "company_id": "mihoyo",
        "company_name": "米哈游",
        "product_name": product,
        "platform": platform,
        "source_type": pldata["source_type"],
        "author": author,
        "author_id": f"user_{uid}",
        "followers": followers,
        "content": content,
        "title": content[:40] + ("..." if len(content) > 40 else ""),
        "publish_time": publish_time,
        "url": url,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "tags": tags,
    }


def main():
    init_db()

    target = 4500
    records = []
    for i in range(target):
        records.append(generate_record(i))
        if (i + 1) % 1000 == 0:
            print(f"Generated {i + 1}/{target} records...")

    print(f"\nImporting {len(records)} records into database...")
    stats = import_from_dict(records)

    print(f"\nImport results:")
    print(f"  Total: {stats['total']}")
    print(f"  Imported: {stats['imported']}")
    print(f"  Skipped (duplicate): {stats['skipped_duplicate']}")
    print(f"  Errors: {stats['errors']}")

    product_counts = {}
    platform_counts = {}
    for r in records:
        product_counts[r["product_name"]] = product_counts.get(r["product_name"], 0) + 1
        platform_counts[r["platform"]] = platform_counts.get(r["platform"], 0) + 1

    print(f"\nProduct distribution: {product_counts}")
    print(f"Platform distribution: {platform_counts}")

    from backend.db.database import get_connection
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) FROM raw_content").fetchone()[0]
    conn.close()
    print(f"\nTotal raw_content in DB: {total}")


if __name__ == "__main__":
    main()
