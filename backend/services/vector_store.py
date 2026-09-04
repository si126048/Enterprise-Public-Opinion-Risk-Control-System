import logging
from pathlib import Path
from typing import List, Optional, Dict, Any

import numpy as np

from backend.config import get_config

logger = logging.getLogger(__name__)

_client = None
_content_collection = None
_anchor_collection = None

CONTENT_COLLECTION = "content_embeddings"
ANCHOR_COLLECTION = "anchor_embeddings"


def _get_client():
    global _client
    if _client is not None:
        return _client

    import chromadb

    config = get_config()
    vs_cfg = config.get("vector_store", {})
    persist_dir = vs_cfg.get("persist_directory", "data/chroma_db")

    project_root = Path(__file__).resolve().parent.parent.parent
    full_path = project_root / persist_dir
    full_path.mkdir(parents=True, exist_ok=True)

    _client = chromadb.PersistentClient(path=str(full_path))
    logger.info("Chroma client initialized at %s", full_path)
    return _client


def _get_content_collection():
    global _content_collection
    if _content_collection is not None:
        return _content_collection
    client = _get_client()
    _content_collection = client.get_or_create_collection(
        name=CONTENT_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )
    return _content_collection


def _get_anchor_collection():
    global _anchor_collection
    if _anchor_collection is not None:
        return _anchor_collection
    client = _get_client()
    _anchor_collection = client.get_or_create_collection(
        name=ANCHOR_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )
    return _anchor_collection


def add_content_embeddings(ids: List[str], embeddings: List[np.ndarray], metadatas: List[Dict] = None):
    collection = _get_content_collection()
    emb_list = [e.tolist() if isinstance(e, np.ndarray) else e for e in embeddings]
    collection.add(ids=ids, embeddings=emb_list, metadatas=metadatas)
    logger.info("Added %d content embeddings", len(ids))


def add_anchor_embeddings(ids: List[str], embeddings: List[np.ndarray], metadatas: List[Dict] = None):
    collection = _get_anchor_collection()
    emb_list = [e.tolist() if isinstance(e, np.ndarray) else e for e in embeddings]
    collection.add(ids=ids, embeddings=emb_list, metadatas=metadatas)
    logger.info("Added %d anchor embeddings", len(ids))


def search_content(query_embedding: np.ndarray, top_k: int = 10, where: Dict = None) -> List[Dict[str, Any]]:
    collection = _get_content_collection()
    kwargs = {
        "query_embeddings": [query_embedding.tolist() if isinstance(query_embedding, np.ndarray) else query_embedding],
        "n_results": top_k,
        "include": ["metadatas", "distances"],
    }
    if where:
        kwargs["where"] = where

    results = collection.query(**kwargs)
    items = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            items.append({
                "id": doc_id,
                "distance": results["distances"][0][i],
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
            })
    return items


def search_anchors(query_embedding: np.ndarray, top_k: int = 5) -> List[Dict[str, Any]]:
    collection = _get_anchor_collection()
    results = collection.query(
        query_embeddings=[query_embedding.tolist() if isinstance(query_embedding, np.ndarray) else query_embedding],
        n_results=top_k,
        include=["metadatas", "distances"],
    )
    items = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            items.append({
                "id": doc_id,
                "distance": results["distances"][0][i],
                "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
            })
    return items


def get_content_count() -> int:
    collection = _get_content_collection()
    return collection.count()


def get_anchor_count() -> int:
    collection = _get_anchor_collection()
    return collection.count()


def delete_content(ids: List[str]):
    collection = _get_content_collection()
    collection.delete(ids=ids)


def delete_anchors(ids: List[str]):
    collection = _get_anchor_collection()
    collection.delete(ids=ids)


def health() -> dict:
    try:
        return {
            "status": "ok",
            "content_count": get_content_count(),
            "anchor_count": get_anchor_count(),
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
        }
