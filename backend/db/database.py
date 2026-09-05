import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH = PROJECT_ROOT / "data" / "app.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS company_config (
    id TEXT PRIMARY KEY,
    company_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT,
    keywords_json TEXT,
    products_json TEXT,
    platforms_json TEXT,
    is_active BOOLEAN DEFAULT 1,
    config_version TEXT,
    created_at DATETIME,
    updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS raw_content (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    company_name TEXT NOT NULL,
    product_name TEXT,
    platform TEXT NOT NULL,
    source_type TEXT NOT NULL,
    author TEXT,
    author_id TEXT,
    followers INTEGER DEFAULT 0,
    content TEXT NOT NULL,
    clean_text TEXT,
    clean_text_hash TEXT,
    content_hash TEXT UNIQUE,
    publish_time DATETIME,
    crawl_time DATETIME NOT NULL,
    url TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    title TEXT,
    tags TEXT,
    metadata_json TEXT,
    created_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_company ON raw_content(company_id);
CREATE INDEX IF NOT EXISTS idx_content_product ON raw_content(product_name);
CREATE INDEX IF NOT EXISTS idx_content_platform ON raw_content(platform);
CREATE INDEX IF NOT EXISTS idx_content_publish ON raw_content(publish_time);

CREATE TABLE IF NOT EXISTS content_analysis (
    content_id TEXT PRIMARY KEY,
    topic_id TEXT,
    topic_similarity REAL,
    credibility_level TEXT CHECK(credibility_level IN ('high','medium','low','uncertain')),
    credibility_confidence REAL,
    risk_level TEXT CHECK(risk_level IN ('low','medium','high','uncertain')),
    risk_confidence REAL,
    credibility_score REAL,
    credibility_factors TEXT,
    summary TEXT,
    theory_perspective TEXT,
    risk_advice TEXT,
    community_heat_score REAL,
    llm_model TEXT,
    analysis_version TEXT,
    review_status TEXT DEFAULT 'pending',
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (content_id) REFERENCES raw_content(id)
);

CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    risk_weight TEXT DEFAULT '中',
    company_id TEXT,
    status TEXT DEFAULT 'active',
    version INTEGER DEFAULT 1,
    created_at DATETIME,
    updated_at DATETIME
);

CREATE TABLE IF NOT EXISTS topic_anchors (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    text TEXT NOT NULL,
    embedding_space_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at DATETIME,
    FOREIGN KEY (topic_id) REFERENCES topics(id)
);

CREATE TABLE IF NOT EXISTS candidate_topics (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    sample_count INTEGER,
    cluster_method TEXT,
    representative_ids_json TEXT,
    proposed_anchors_json TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME,
    reviewed_at DATETIME,
    review_comment TEXT
);

CREATE TABLE IF NOT EXISTS embedding_spaces (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL,
    model_revision TEXT NOT NULL,
    vector_dimension INTEGER NOT NULL,
    normalize BOOLEAN DEFAULT 1,
    preprocess_version TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME
);

CREATE TABLE IF NOT EXISTS ai_run_log (
    run_id TEXT PRIMARY KEY,
    task_type TEXT,
    model TEXT,
    timestamp DATETIME,
    input_record_ids TEXT,
    prompt_version TEXT,
    raw_output TEXT,
    parsed_output TEXT,
    success BOOLEAN,
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS cross_validation_results (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    credibility_level TEXT,
    credibility_confidence REAL,
    risk_level TEXT,
    risk_confidence REAL,
    summary TEXT,
    created_at DATETIME,
    FOREIGN KEY (content_id) REFERENCES raw_content(id)
);

CREATE TABLE IF NOT EXISTS crawl_run_log (
    id TEXT PRIMARY KEY,
    started_at DATETIME NOT NULL,
    finished_at DATETIME,
    status TEXT CHECK(status IN ('running','completed','failed','partial')),
    triggered_by TEXT DEFAULT 'manual',
    crawler_name TEXT,
    platform TEXT,
    company_id TEXT,
    total_fetched INTEGER DEFAULT 0,
    total_imported INTEGER DEFAULT 0,
    total_skipped_dup INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    error_details TEXT,
    config_snapshot TEXT
);

CREATE TABLE IF NOT EXISTS risk_events (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    topic_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    risk_level TEXT CHECK(risk_level IN ('low','medium','high','critical')),
    content_count INTEGER DEFAULT 0,
    sample_content_ids TEXT,
    advice TEXT,
    status TEXT DEFAULT 'open',
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES company_config(company_id)
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT,
    created_at DATETIME,
    last_login DATETIME
);
"""

COMPANY_SEED = [
    (
        "cfg_mihoyo",
        "mihoyo",
        "米哈游",
        "miHoYo",
        '["米哈游","原神","崩坏星穹铁道","绝区零","未定事件簿","Hoyoverse","大伟哥"]',
        '[{"name":"原神","aliases":["原神","Genshin","Genshin Impact","提瓦特","旅行者"]},{"name":"崩坏：星穹铁道","aliases":["崩铁","星穹铁道","HSR","Honkai Star Rail","开拓者","星核"]},{"name":"绝区零","aliases":["绝区零","ZZZ","Zenless Zone Zero","新艾利都","代理人"]},{"name":"未定事件簿","aliases":["未定","未定事件簿","Tears of Themis","律师","左然"]}]',
        '["weibo","xiaohongshu","zhihu","bilibili","taptap"]',
        1,
        "1.0",
    ),
]


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _migrate_schema(conn: sqlite3.Connection):
    """Migrate old sentiment columns to credibility_level."""
    SENTIMENT_TO_CREDIBILITY = {
        "positive": "high",
        "neutral": "medium",
        "negative": "low",
        "uncertain": "uncertain",
    }
    tables = ["content_analysis", "cross_validation_results"]
    for table in tables:
        cols = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        if "sentiment" not in cols or "credibility_level" in cols:
            # Check if values need mapping even though column is already renamed
            if "credibility_level" in cols:
                existing_vals = [r[0] for r in conn.execute(f"SELECT DISTINCT credibility_level FROM {table}").fetchall()]
                old_vals = set(SENTIMENT_TO_CREDIBILITY.keys())
                needs_update = any(v in old_vals for v in existing_vals)
                new_vals = set(SENTIMENT_TO_CREDIBILITY.values())
                if needs_update:
                    old_sql_row = conn.execute(
                        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
                    ).fetchone()
                    if old_sql_row:
                        old_sql = old_sql_row[0]
                        new_sql = old_sql.replace(
                            "CHECK(credibility_level IN ('positive','neutral','negative','uncertain'))",
                            "CHECK(credibility_level IN ('high','medium','low','uncertain'))"
                        ).replace(
                            "CHECK (credibility_level IN ('positive', 'neutral', 'negative', 'uncertain'))",
                            "CHECK (credibility_level IN ('high', 'medium', 'low', 'uncertain'))"
                        )
                        conn.execute(f"ALTER TABLE {table} RENAME TO {table}_migration_backup")
                        conn.execute(new_sql)
                        new_cols = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
                        col_list = ", ".join(new_cols)
                        for old_val, new_val in SENTIMENT_TO_CREDIBILITY.items():
                            select_exprs = []
                            for c in new_cols:
                                if c == "credibility_level":
                                    select_exprs.append(f"'{new_val}'")
                                else:
                                    select_exprs.append(c)
                            mapped_select = ", ".join(select_exprs)
                            conn.execute(f"""
                                INSERT INTO {table} ({col_list})
                                SELECT {mapped_select}
                                FROM {table}_migration_backup WHERE credibility_level = ?
                            """, (old_val,))
                        already_new = [v for v in existing_vals if v in new_vals and v not in old_vals]
                        for val in already_new:
                            conn.execute(f"""
                                INSERT INTO {table} ({col_list})
                                SELECT {col_list}
                                FROM {table}_migration_backup WHERE credibility_level = ?
                            """, (val,))
                        conn.execute(f"DROP TABLE {table}_migration_backup")
            continue

        # Get old table SQL and build new schema
        old_sql_row = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
        ).fetchone()
        if not old_sql_row:
            continue
        old_sql = old_sql_row[0]

        # Build new CREATE TABLE SQL by replacing column names and CHECK values
        new_sql = old_sql
        new_sql = new_sql.replace("sentiment_confidence", "credibility_confidence")
        new_sql = new_sql.replace("sentiment", "credibility_level")
        new_sql = new_sql.replace(
            "CHECK(credibility_level IN ('positive','neutral','negative','uncertain'))",
            "CHECK(credibility_level IN ('high','medium','low','uncertain'))"
        )
        # Handle variations in CHECK constraint formatting
        new_sql = new_sql.replace(
            "CHECK (credibility_level IN ('positive', 'neutral', 'negative', 'uncertain'))",
            "CHECK (credibility_level IN ('high', 'medium', 'low', 'uncertain'))"
        )

        # Rename old table, create new, copy data
        conn.execute(f"ALTER TABLE {table} RENAME TO {table}_migration_backup")
        conn.execute(new_sql.replace(table + "_migration_backup", table))

        # Build column mapping for INSERT
        new_cols = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        col_pairs = []
        for c in new_cols:
            old_name = c
            if c == "credibility_level":
                old_name = "sentiment"
            elif c == "credibility_confidence":
                old_name = "sentiment_confidence"
            col_pairs.append((c, old_name))

        insert_cols = ", ".join(c[0] for c in col_pairs)

        # Copy all rows, mapping sentiment values
        for old_val, new_val in SENTIMENT_TO_CREDIBILITY.items():
            # Build SELECT with sentiment replaced by literal, sentiment_confidence kept as column
            select_exprs = []
            for new_name, old_name in col_pairs:
                if old_name == "sentiment":
                    select_exprs.append(f"'{new_val}'")
                else:
                    select_exprs.append(old_name)
            mapped_select = ", ".join(select_exprs)
            conn.execute(f"""
                INSERT INTO {table} ({insert_cols})
                SELECT {mapped_select}
                FROM {table}_migration_backup WHERE sentiment = ?
            """, (old_val,))

        conn.execute(f"DROP TABLE {table}_migration_backup")


def init_db():
    import datetime
    conn = get_connection()
    try:
        conn.executescript(SCHEMA_SQL)
        _migrate_schema(conn)
        conn.commit()

        now = datetime.datetime.now().isoformat()
        for seed in COMPANY_SEED:
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO company_config
                       (id, company_id, name, display_name, keywords_json, products_json, platforms_json, is_active, config_version, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (*seed, now, now),
                )
            except Exception:
                pass
        conn.commit()
    finally:
        conn.close()
