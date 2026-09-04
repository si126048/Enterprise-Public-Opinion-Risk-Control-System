"""Complete analysis pipeline: topic seeding → keyword routing → LLM analysis → credibility → heat score."""
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.db.database import get_connection, init_db
from backend.services.llm_service import get_provider, LLMAnalysisResult
from backend.services.credibility import compute_credibility

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

TOPIC_SEEDS = [
    {
        "id": "G001", "name": "版本节奏与内容",
        "description": "版本延期、内容量不足、长草期过长、活动设计不佳",
        "risk_weight": "高",
        "keywords": ["版本", "长草", "延期", "活动", "内容", "探索", "地图", "更新", "补偿", "海灯节"],
        "anchors": [
            "3.8版本长草期太长了，一个月没新内容",
            "海灯节活动就这？奖励抠门，内容敷衍",
            "版本延期又不发补偿，米哈游在干嘛",
            "新地图探索内容越来越少，每天上线5分钟下线",
        ],
    },
    {
        "id": "G002", "name": "抽卡与付费机制",
        "description": "抽卡概率争议、保底机制、氪金体验、价格歧视",
        "risk_weight": "高",
        "keywords": ["抽卡", "保底", "氪", "付费", "概率", "五星", "月卡", "专武", "平民", "大保底"],
        "anchors": [
            "抽卡概率绝对是假的，我连着吃满大保底",
            "这游戏越来越贵了，月卡党根本玩不起",
            "新角色专武必须抽，平民玩家没法玩",
            "100抽才出一个五星，这游戏真敢",
        ],
    },
    {
        "id": "G003", "name": "角色设计与平衡",
        "description": "角色强度失衡、美术翻车、剧情争议、人设崩塌",
        "risk_weight": "中高",
        "keywords": ["角色", "强度", "平衡", "立绘", "美术", "人设", "剧情", "配音", "退环境", "超标"],
        "anchors": [
            "新角色强度超标，旧角色直接退环境",
            "角色剧情写得像流水账，毫无魅力",
            "立绘越画越崩，和宣传图差距太大了",
            "配音太出戏了，完全不符合角色人设",
        ],
    },
    {
        "id": "G004", "name": "技术性能与优化",
        "description": "游戏卡顿、闪退、优化差、设备适配问题",
        "risk_weight": "中",
        "keywords": ["卡顿", "闪退", "优化", "发烫", "帧率", "加载", "崩溃", "bug", "掉帧", "性能"],
        "anchors": [
            "更新完又卡了，手机发烫到不行",
            "进游戏就闪退，重启了好几次",
            "PC端帧率掉得厉害，3060都带不动",
            "加载时间越来越长，优化越来越差",
        ],
    },
    {
        "id": "G005", "name": "社区运营与公关",
        "description": "官方回应不当、冷处理、社区管理、玩家对立",
        "risk_weight": "高",
        "keywords": ["公关", "冷处理", "装死", "回应", "敷衍", "禁言", "删帖", "控评", "社区", "运营"],
        "anchors": [
            "官方装死不说话，冷处理玩家诉求",
            "社区管理只会禁言，正常反馈都被删",
            "米哈游公关回应太敷衍了，毫无诚意",
            "玩家群体被挑拨对立，官方不管不顾",
        ],
    },
    {
        "id": "G006", "name": "竞品与市场压力",
        "description": "竞品对比、市场份额下滑、用户流失",
        "risk_weight": "中",
        "keywords": ["竞品", "流失", "退坑", "凉了", "流水", "市场份额", "对比", "越来越少", "好玩"],
        "anchors": [
            "隔壁游戏更好玩，准备退坑了",
            "原神流水下滑严重，是不是要凉了",
            "竞品出了个类似玩法，比米哈游做得好",
            "身边玩原神的人越来越少了",
        ],
    },
    {
        "id": "G007", "name": "公司治理与舆情",
        "description": "高管言论、员工动态、薪酬争议、资本动作",
        "risk_weight": "高",
        "keywords": ["估值", "IPO", "蔡浩宇", "大伟哥", "员工", "加班", "资产", "高管", "治理"],
        "anchors": [
            "大伟哥又在发布会上画大饼了",
            "米哈游员工爆料加班太严重",
            "蔡浩宇移民了？对公司有什么影响",
            "米哈游估值又涨了，准备IPO吗",
        ],
    },
    {
        "id": "G008", "name": "合规与监管",
        "description": "版号、防沉迷、数据合规、政策风险",
        "risk_weight": "高",
        "keywords": ["防沉迷", "未成年", "版号", "合规", "监管", "隐私", "数据", "政策", "审批", "举报"],
        "anchors": [
            "未成年人防沉迷系统又出问题了",
            "游戏版号审批会不会影响新版本",
            "用户数据泄露了？米哈游数据安全堪忧",
            "海外版隐私合规被调查了",
        ],
    },
]


def seed_topics_to_db():
    now = datetime.now().isoformat()
    conn = get_connection()
    try:
        conn.execute("DELETE FROM topic_anchors")
        conn.execute("DELETE FROM topics")
        for topic in TOPIC_SEEDS:
            conn.execute(
                """INSERT INTO topics (id, name, description, risk_weight, company_id, status, version, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 'mihoyo', 'active', 1, ?, ?)""",
                (topic["id"], topic["name"], topic["description"], topic["risk_weight"], now, now),
            )
            for idx, anchor_text in enumerate(topic["anchors"]):
                anchor_id = f"anchor_{topic['id']}_{idx}"
                conn.execute(
                    """INSERT INTO topic_anchors (id, topic_id, text, embedding_space_id, status, created_at)
                       VALUES (?, ?, ?, '', 'active', ?)""",
                    (anchor_id, topic["id"], anchor_text, now),
                )
        conn.commit()
        tc = conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
        ac = conn.execute("SELECT COUNT(*) FROM topic_anchors").fetchone()[0]
        logger.info("Seeded %d topics, %d anchors", tc, ac)
    finally:
        conn.close()


def match_topic_by_keywords(text):
    best_topic = None
    best_score = 0
    for topic in TOPIC_SEEDS:
        score = sum(1 for kw in topic["keywords"] if kw in text)
        if score > best_score:
            best_score = score
            best_topic = topic
    if best_topic and best_score > 0:
        return best_topic["id"], best_topic["name"], best_score
    return None, "未知主题", 0.0


def compute_heat_score(followers, likes, comments, shares):
    import math
    engagement = likes + comments * 2 + shares * 3
    influence = math.log10(max(followers, 1) + 1) / 5.0
    heat = min(1.0, (engagement / 1000.0) * 0.6 + influence * 0.4)
    return round(heat, 4)


def run_analysis():
    init_db()
    seed_topics_to_db()

    provider = get_provider()
    logger.info("LLM provider: %s", provider.__class__.__name__)

    conn = get_connection()
    try:
        rows = conn.execute("""
            SELECT rc.id, rc.content, rc.clean_text, rc.followers,
                   rc.likes, rc.comments, rc.shares, rc.platform,
                   rc.product_name, LENGTH(rc.clean_text) as content_length
            FROM raw_content rc
            LEFT JOIN content_analysis ca ON rc.id = ca.content_id
            WHERE ca.content_id IS NULL
              AND rc.clean_text IS NOT NULL AND rc.clean_text != ''
            ORDER BY rc.publish_time
        """).fetchall()
        items = [dict(r) for r in rows]
    finally:
        conn.close()

    stats = {"total": len(items), "analyzed": 0, "errors": 0}
    logger.info("Found %d unanalyzed records", len(items))

    for item in items:
        content_id = item["id"]
        text = item["clean_text"] or item["content"]
        try:
            topic_id, topic_name, kw_score = match_topic_by_keywords(text)
            topic_similarity = min(1.0, kw_score / 3.0) if kw_score > 0 else 0.0

            result = provider.analyze(text, topic_name)

            cred = compute_credibility(
                followers=item["followers"] or 0,
                likes=item["likes"] or 0,
                comments=item["comments"] or 0,
                shares=item["shares"] or 0,
                credibility_level=result.credibility_level,
                platform=item["platform"] or "weibo",
                content_length=item["content_length"] or len(text),
            )

            heat = compute_heat_score(
                item["followers"] or 0,
                item["likes"] or 0,
                item["comments"] or 0,
                item["shares"] or 0,
            )

            risk_advice = ""
            if result.risk_level == "high":
                risk_advice = "高风险舆情，建议立即启动公关预案，关注事态发展"
            elif result.risk_level == "medium":
                risk_advice = "中等风险，建议持续监测并准备应对方案"
            else:
                risk_advice = "低风险，常规监测即可"

            now = datetime.now().isoformat()
            wconn = get_connection()
            try:
                wconn.execute("""
                    INSERT OR REPLACE INTO content_analysis
                    (content_id, topic_id, topic_similarity,
                     credibility_level, credibility_confidence,
                     risk_level, risk_confidence,
                     summary, theory_perspective,
                     credibility_score, credibility_factors,
                     community_heat_score, risk_advice,
                     llm_model, analysis_version,
                     review_status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
                """, (
                    content_id, topic_id, topic_similarity,
                    result.credibility_level, result.credibility_confidence,
                    result.risk_level, result.risk_confidence,
                    result.summary, result.theory_perspective,
                    cred.overall, json.dumps(cred.factors, ensure_ascii=False),
                    heat, risk_advice,
                    "mock", "v1",
                    now, now,
                ))
                wconn.commit()
            finally:
                wconn.close()

            stats["analyzed"] += 1
            logger.info("[%d/%d] %s → %s | %s | %s | cred=%.2f | heat=%.4f",
                        stats["analyzed"], stats["total"],
                        content_id[:8], topic_name,
                        result.credibility_level, result.risk_level,
                        cred.overall, heat)

        except Exception as e:
            logger.error("Failed to analyze %s: %s", content_id, e)
            stats["errors"] += 1

    logger.info("Analysis complete: %d/%d analyzed, %d errors",
                stats["analyzed"], stats["total"], stats["errors"])
    return stats


if __name__ == "__main__":
    result = run_analysis()
    print(f"\nResult: {result}")
