from fastapi import APIRouter
from backend.config import get_config
from backend.db.database import get_connection
from backend.services import embedding_service
from backend.services import vector_store

router = APIRouter()


@router.get("/api/health")
async def health_check():
    config = get_config()

    db_status = "not_initialized"
    content_count = 0
    try:
        conn = get_connection()
        content_count = conn.execute("SELECT COUNT(*) FROM raw_content").fetchone()[0]
        db_status = "connected"
        conn.close()
    except Exception:
        db_status = "error"

    emb_health = embedding_service.health()
    vs_health = vector_store.health()

    analyzed_count = 0
    try:
        conn = get_connection()
        analyzed_count = conn.execute("SELECT COUNT(*) FROM content_analysis").fetchone()[0]
        conn.close()
    except Exception:
        pass

    return {
        "status": "ok",
        "version": config["app"]["version"],
        "demo_mode": config["app"]["demo_mode"],
        "display_name": config["app"]["display_name"],
        "embedding": {
            "status": "loaded" if emb_health["model_loaded"] else "not_loaded",
            "provider": config["embedding"]["provider"],
            "model": config["embedding"]["model_name"],
            "dimension": emb_health["dimension"],
            "device": emb_health["device"],
            "space_id": emb_health["space_id"],
        },
        "llm": {
            "status": "ready",
            "provider": config["llm"]["provider"],
            "model": config["llm"]["model"],
        },
        "database": {
            "status": db_status,
            "content_count": content_count,
            "analyzed_count": analyzed_count,
        },
        "vector_store": vs_health,
    }
