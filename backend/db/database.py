import sqlite3
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DB_PATH = PROJECT_ROOT / "data" / "app.db"

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS raw_content (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    url TEXT,
    publish_time DATETIME,
    crawl_time DATETIME NOT NULL,
    title TEXT,
    raw_text TEXT NOT NULL,
    clean_text TEXT,
    clean_text_hash TEXT,
    content_hash TEXT UNIQUE,
    language TEXT DEFAULT 'zh',
    metadata_json TEXT,
    created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS content_analysis (
    content_id TEXT PRIMARY KEY,
    topic_id TEXT,
    topic_similarity REAL,
    sentiment TEXT CHECK(sentiment IN ('positive','neutral','negative','uncertain')),
    sentiment_confidence REAL,
    risk_level TEXT CHECK(risk_level IN ('low','medium','high','uncertain')),
    risk_confidence REAL,
    summary TEXT,
    theory_perspective TEXT,
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

CREATE TABLE IF NOT EXISTS source_ledger (
    id TEXT PRIMARY KEY,
    source_name TEXT NOT NULL,
    source_url TEXT,
    data_type TEXT,
    access_date DATE,
    description TEXT,
    record_count INTEGER,
    verified BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cross_validation_results (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    sentiment TEXT,
    sentiment_confidence REAL,
    risk_level TEXT,
    risk_confidence REAL,
    summary TEXT,
    theory_perspective TEXT,
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
    total_fetched INTEGER DEFAULT 0,
    total_imported INTEGER DEFAULT 0,
    total_skipped_dup INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    error_details TEXT,
    config_snapshot TEXT
);
"""


def get_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_connection()
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()
