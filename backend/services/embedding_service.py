import hashlib
import logging
import sqlite3
from typing import List, Optional

import numpy as np

from backend.config import get_config
from backend.db.database import get_connection

logger = logging.getLogger(__name__)

_model = None
_tokenizer = None
_device = None
_space_id = None
_dimension = None


def _get_device() -> str:
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
    except ImportError:
        pass
    return "cpu"


def _compute_space_id(model_name: str, revision: str, dimension: int) -> str:
    raw = f"{model_name}|{revision}|{dimension}"
    return "esp_" + hashlib.sha256(raw.encode()).hexdigest()[:16]


def _ensure_cache_table():
    conn = get_connection()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS embedding_cache (
                cache_key TEXT PRIMARY KEY,
                embedding_blob BLOB NOT NULL,
                dimension INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
    finally:
        conn.close()


def _ensure_embedding_space() -> str:
    config = get_config()
    emb_cfg = config["embedding"]
    model_name = emb_cfg["model_name"]
    revision = emb_cfg.get("model_revision", "main")
    dimension = emb_cfg["vector_dimension"]
    space_id = _compute_space_id(model_name, revision, dimension)

    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id, model_name, vector_dimension FROM embedding_spaces WHERE is_active = 1"
        ).fetchone()

        if existing:
            if existing["id"] != space_id:
                raise RuntimeError(
                    f"Embedding space mismatch! "
                    f"DB has {existing['id']} ({existing['model_name']}, dim={existing['vector_dimension']}), "
                    f"config expects {space_id} ({model_name}, dim={dimension}). "
                    f"Run embedding migration or reset the database."
                )
            logger.info("Embedding space verified: %s", space_id)
        else:
            conn.execute(
                """INSERT INTO embedding_spaces
                   (id, model_name, model_revision, vector_dimension, normalize, preprocess_version, is_active)
                   VALUES (?, ?, ?, ?, ?, ?, 1)""",
                (
                    space_id,
                    model_name,
                    revision,
                    dimension,
                    1 if emb_cfg.get("normalize", True) else 0,
                    emb_cfg.get("preprocess_version", "v1"),
                ),
            )
            conn.commit()
            logger.info("Created embedding space: %s (%s, dim=%d)", space_id, model_name, dimension)

        return space_id
    finally:
        conn.close()


def load_model():
    global _model, _tokenizer, _device, _space_id, _dimension

    if _model is not None:
        return

    config = get_config()
    emb_cfg = config["embedding"]
    model_name = emb_cfg["model_name"]
    _dimension = emb_cfg["vector_dimension"]

    _space_id = _ensure_embedding_space()
    _ensure_cache_table()

    _device = _get_device()
    logger.info("Loading embedding model: %s on %s", model_name, _device)

    import torch
    from transformers import AutoTokenizer, AutoModel

    _tokenizer = AutoTokenizer.from_pretrained(model_name)
    _model = AutoModel.from_pretrained(model_name, torch_dtype=torch.float16 if _device == "cuda" else torch.float32)
    _model = _model.to(_device)
    _model.eval()

    actual_dim = _model.config.hidden_size
    if actual_dim != _dimension:
        logger.warning("Config dimension %d != model hidden_size %d. Using model's actual dimension.", _dimension, actual_dim)
        _dimension = actual_dim

    logger.info("Embedding model loaded. Dimension: %d, Device: %s", _dimension, _device)


def _get_from_cache(text_hash: str) -> Optional[np.ndarray]:
    if not get_config()["embedding"].get("cache_enabled", True):
        return None
    cache_key = f"{text_hash}|{_space_id}"
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT embedding_blob, dimension FROM embedding_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()
        if row and row["dimension"] == _dimension:
            return np.frombuffer(row["embedding_blob"], dtype=np.float32).copy()
        return None
    finally:
        conn.close()


def _save_to_cache(text_hash: str, vector: np.ndarray):
    if not get_config()["embedding"].get("cache_enabled", True):
        return
    cache_key = f"{text_hash}|{_space_id}"
    conn = get_connection()
    try:
        conn.execute(
            "INSERT OR REPLACE INTO embedding_cache (cache_key, embedding_blob, dimension) VALUES (?, ?, ?)",
            (cache_key, vector.astype(np.float32).tobytes(), _dimension),
        )
        conn.commit()
    finally:
        conn.close()


def _encode_texts(texts: List[str]) -> np.ndarray:
    import torch

    all_embeddings = []
    batch_size = get_config()["embedding"].get("batch_size", 32)

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        encoded = _tokenizer(
            batch,
            padding=True,
            truncation=True,
            max_length=512,
            return_tensors="pt",
        )
        encoded = {k: v.to(_device) for k, v in encoded.items()}

        with torch.no_grad():
            outputs = _model(**encoded)

        embeddings = outputs.last_hidden_state.mean(dim=1)

        if get_config()["embedding"].get("normalize", True):
            embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)

        all_embeddings.append(embeddings.cpu().numpy())

    return np.vstack(all_embeddings)


def embed_text(text: str, text_hash: str = None) -> np.ndarray:
    load_model()

    if text_hash is None:
        text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

    cached = _get_from_cache(text_hash)
    if cached is not None:
        return cached

    vector = _encode_texts([text])[0]
    _save_to_cache(text_hash, vector)
    return vector


def embed_batch(texts: List[str], text_hashes: List[str] = None) -> List[np.ndarray]:
    load_model()

    if text_hashes is None:
        text_hashes = [hashlib.sha256(t.encode("utf-8")).hexdigest() for t in texts]

    results = [None] * len(texts)
    to_compute = []
    to_compute_indices = []

    for i, (text, th) in enumerate(zip(texts, text_hashes)):
        cached = _get_from_cache(th)
        if cached is not None:
            results[i] = cached
        else:
            to_compute.append(text)
            to_compute_indices.append(i)

    if to_compute:
        vectors = _encode_texts(to_compute)
        for idx, vec, th in zip(to_compute_indices, vectors, [text_hashes[i] for i in to_compute_indices]):
            results[idx] = vec
            _save_to_cache(th, vec)

    return results


def health() -> dict:
    config = get_config()
    return {
        "model_loaded": _model is not None,
        "model": config["embedding"]["model_name"],
        "dimension": _dimension,
        "device": _device,
        "space_id": _space_id,
    }


def get_space_id() -> Optional[str]:
    global _space_id
    if _space_id is None:
        config = get_config()
        emb_cfg = config["embedding"]
        _space_id = _compute_space_id(
            emb_cfg["model_name"],
            emb_cfg.get("model_revision", "main"),
            emb_cfg["vector_dimension"],
        )
    return _space_id


def get_dimension() -> int:
    global _dimension
    if _dimension is None:
        _dimension = get_config()["embedding"]["vector_dimension"]
    return _dimension
