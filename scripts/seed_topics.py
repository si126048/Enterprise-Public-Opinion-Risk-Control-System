"""Seed 8 gaming industry risk topics for miHoYo enterprise monitoring."""
import sys
import logging
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.db.database import get_connection, init_db
from backend.services import embedding_service, vector_store

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

TOPIC_SEEDS = [
    {
        "id": "G001",
        "name": "版本节奏与内容",
        "description": "版本延期、内容量不足、长草期过长、活动设计不佳",
        "risk_weight": "高",
        "anchors": [
            "3.8版本长草期太长了，一个月没新内容",
            "海灯节活动就这？奖励抠门，内容敷衍",
            "版本延期又不发补偿，米哈游在干嘛",
            "新地图探索内容越来越少，每天上线5分钟下线",
        ],
    },
    {
        "id": "G002",
        "name": "抽卡与付费机制",
        "description": "抽卡概率争议、保底机制、氪金体验、价格歧视",
        "risk_weight": "高",
        "anchors": [
            "抽卡概率绝对是假的，我连着吃满大保底",
            "这游戏越来越贵了，月卡党根本玩不起",
            "新角色专武必须抽，平民玩家没法玩",
            "100抽才出一个五星，这游戏真敢",
        ],
    },
    {
        "id": "G003",
        "name": "角色设计与平衡",
        "description": "角色强度失衡、美术翻车、剧情争议、人设崩塌",
        "risk_weight": "中高",
        "anchors": [
            "新角色强度超标，旧角色直接退环境",
            "角色剧情写得像流水账，毫无魅力",
            "立绘越画越崩，和宣传图差距太大了",
            "配音太出戏了，完全不符合角色人设",
        ],
    },
    {
        "id": "G004",
        "name": "技术性能与优化",
        "description": "游戏卡顿、闪退、优化差、设备适配问题",
        "risk_weight": "中",
        "anchors": [
            "更新完又卡了，手机发烫到不行",
            "进游戏就闪退，重启了好几次",
            "PC端帧率掉得厉害，3060都带不动",
            "加载时间越来越长，优化越来越差",
        ],
    },
    {
        "id": "G005",
        "name": "社区运营与公关",
        "description": "官方回应不当、冷处理、社区管理、玩家对立",
        "risk_weight": "高",
        "anchors": [
            "官方装死不说话，冷处理玩家诉求",
            "社区管理只会禁言，正常反馈都被删",
            "米哈游公关回应太敷衍了，毫无诚意",
            "玩家群体被挑拨对立，官方不管不顾",
        ],
    },
    {
        "id": "G006",
        "name": "竞品与市场压力",
        "description": "竞品对比、市场份额下滑、用户流失",
        "risk_weight": "中",
        "anchors": [
            "隔壁游戏更好玩，准备退坑了",
            "原神流水下滑严重，是不是要凉了",
            "竞品出了个类似玩法，比米哈游做得好",
            "身边玩原神的人越来越少了",
        ],
    },
    {
        "id": "G007",
        "name": "公司治理与舆情",
        "description": "高管言论、员工动态、薪酬争议、资本动作",
        "risk_weight": "高",
        "anchors": [
            "大伟哥又在发布会上画大饼了",
            "米哈游员工爆料加班太严重",
            "蔡浩宇移民了？对公司有什么影响",
            "米哈游估值又涨了，准备IPO吗",
        ],
    },
    {
        "id": "G008",
        "name": "合规与监管",
        "description": "版号、防沉迷、数据合规、政策风险",
        "risk_weight": "高",
        "anchors": [
            "未成年人防沉迷系统又出问题了",
            "游戏版号审批会不会影响新版本",
            "用户数据泄露了？米哈游数据安全堪忧",
            "海外版隐私合规被调查了",
        ],
    },
]


def seed_topics():
    init_db()
    space_id = embedding_service.get_space_id()
    now = datetime.now().isoformat()

    conn = get_connection()
    try:
        old_anchor_ids = [r[0] for r in conn.execute("SELECT id FROM topic_anchors").fetchall()]
        old_topic_ids = [r[0] for r in conn.execute("SELECT id FROM topics").fetchall()]

        conn.execute("DELETE FROM topic_anchors")
        conn.execute("DELETE FROM topics")
        conn.commit()
        logger.info("Cleared %d old topics and %d old anchors", len(old_topic_ids), len(old_anchor_ids))

        for topic in TOPIC_SEEDS:
            conn.execute(
                """INSERT INTO topics (id, name, description, risk_weight, company_id, status, version, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 'mihoyo', 'active', 1, ?, ?)""",
                (topic["id"], topic["name"], topic["description"], topic["risk_weight"], now, now),
            )
            for idx, anchor_text in enumerate(topic["anchors"]):
                anchor_id = f"anchor_{topic['id']}_{idx}"
                conn.execute(
                    """INSERT INTO topic_anchors
                       (id, topic_id, text, embedding_space_id, status, created_at)
                       VALUES (?, ?, ?, ?, 'active', ?)""",
                    (anchor_id, topic["id"], anchor_text, space_id, now),
                )
        conn.commit()
        logger.info("Topics and anchors inserted into SQLite")
    finally:
        conn.close()

    if old_anchor_ids:
        try:
            vector_store.delete_anchors(old_anchor_ids)
            logger.info("Deleted %d old anchors from Chroma", len(old_anchor_ids))
        except Exception as e:
            logger.warning("Could not delete old anchors from Chroma: %s", e)

    all_anchor_texts = []
    all_anchor_ids = []
    all_anchor_metas = []
    for topic in TOPIC_SEEDS:
        for idx, anchor_text in enumerate(topic["anchors"]):
            anchor_id = f"anchor_{topic['id']}_{idx}"
            all_anchor_texts.append(anchor_text)
            all_anchor_ids.append(anchor_id)
            all_anchor_metas.append({"topic_id": topic["id"], "text": anchor_text})

    logger.info("Embedding %d anchors...", len(all_anchor_texts))
    vectors = embedding_service.embed_batch(all_anchor_texts)

    vector_store.add_anchor_embeddings(all_anchor_ids, vectors, all_anchor_metas)
    logger.info("Anchor embeddings stored in Chroma")

    conn = get_connection()
    try:
        topic_count = conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
        anchor_count = conn.execute("SELECT COUNT(*) FROM topic_anchors").fetchone()[0]
    finally:
        conn.close()

    chroma_anchors = vector_store.get_anchor_count()
    logger.info("Seed complete: %d topics, %d anchors in DB, %d anchors in Chroma",
                topic_count, anchor_count, chroma_anchors)


if __name__ == "__main__":
    seed_topics()
