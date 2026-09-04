"""Seed 8 preset topics with anchor texts into SQLite + Chroma."""
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
        "id": "topic_001",
        "name": "物业管理",
        "description": "小区物业服务、维修响应、费用纠纷",
        "anchors": [
            "物业服务不到位",
            "楼道灯坏了没人修",
            "电梯故障频发",
            "物业费太贵服务跟不上",
        ],
    },
    {
        "id": "topic_002",
        "name": "环境卫生",
        "description": "垃圾清理、污水、噪音、公共区域清洁",
        "anchors": [
            "垃圾堆积无人清理",
            "污水横流臭气熏天",
            "噪音扰民无法入睡",
            "公共区域脏乱差",
        ],
    },
    {
        "id": "topic_003",
        "name": "市容秩序",
        "description": "占道经营、流动摊贩、共享单车乱停放",
        "anchors": [
            "流动摊贩占道经营",
            "共享单车乱停放堵塞道路",
            "商户占道堆货影响通行",
            "小广告泛滥影响市容",
        ],
    },
    {
        "id": "topic_004",
        "name": "基础设施",
        "description": "道路破损、路灯故障、井盖缺失、管网爆裂",
        "anchors": [
            "路面坑洼积水严重",
            "路灯坏了很久没人修",
            "下水道井盖缺失危险",
            "水管爆裂影响供水",
        ],
    },
    {
        "id": "topic_005",
        "name": "交通出行",
        "description": "交通拥堵、停车难、施工影响出行",
        "anchors": [
            "早晚高峰严重拥堵",
            "停车太难找不到车位",
            "道路施工影响出行",
            "公交线路太少出行不便",
        ],
    },
    {
        "id": "topic_006",
        "name": "违建/安全",
        "description": "违法建设、消防通道堵塞、线缆隐患",
        "anchors": [
            "楼顶私搭乱建无人管",
            "消防通道被堵安全隐患大",
            "架空线缆低垂很危险",
            "外墙脱落差点砸到人",
        ],
    },
    {
        "id": "topic_007",
        "name": "养老服务",
        "description": "独居老人照料、社区养老设施、老年活动",
        "anchors": [
            "独居老人无人照料",
            "社区养老服务点太少",
            "老年人活动太少需要更多关怀",
            "日间照料中心不够用",
        ],
    },
    {
        "id": "topic_008",
        "name": "政务服务",
        "description": "办事效率、政策咨询、12345热线反馈",
        "anchors": [
            "办事效率太低跑了好几趟",
            "政策咨询热线打不通",
            "12345反馈处理及时",
            "社区办事材料要求不一致",
        ],
    },
]


def seed_topics():
    init_db()
    space_id = embedding_service.get_space_id()
    now = datetime.now().isoformat()

    conn = get_connection()
    try:
        for topic in TOPIC_SEEDS:
            conn.execute(
                """INSERT OR IGNORE INTO topics (id, name, description, status, version, created_at, updated_at)
                   VALUES (?, ?, ?, 'active', 1, ?, ?)""",
                (topic["id"], topic["name"], topic["description"], now, now),
            )

            for idx, anchor_text in enumerate(topic["anchors"]):
                anchor_id = f"anchor_{topic['id']}_{idx}"
                conn.execute(
                    """INSERT OR IGNORE INTO topic_anchors
                       (id, topic_id, text, embedding_space_id, status, created_at)
                       VALUES (?, ?, ?, ?, 'active', ?)""",
                    (anchor_id, topic["id"], anchor_text, space_id, now),
                )
        conn.commit()
        logger.info("Topics and anchors inserted into SQLite")
    finally:
        conn.close()

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
