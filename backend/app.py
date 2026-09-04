from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import logging

from backend.config import load_config
from backend.api.health import router as health_router
from backend.api.ingest import router as ingest_router
from backend.api.content import router as content_router
from backend.api.embedding import router as embedding_router
from backend.api.routing import router as routing_router
from backend.api.discovery import router as discovery_router
from backend.api.sources import router as sources_router
from backend.api.validation import router as validation_router
from backend.db.database import init_db
from backend.services import embedding_service

logger = logging.getLogger(__name__)

app = FastAPI(
    title="五华区民意诉求语义分析系统",
    version="0.1.0",
    description="Public Opinion Semantic Analysis System for Kunming Wuhua District",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(ingest_router)
app.include_router(content_router)
app.include_router(embedding_router)
app.include_router(routing_router)
app.include_router(discovery_router)
app.include_router(sources_router)
app.include_router(validation_router)


@app.on_event("startup")
async def startup():
    config = load_config()
    logging.basicConfig(
        level=getattr(logging, config["app"].get("log_level", "INFO")),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    logger.info("Starting %s v%s", config["app"]["display_name"], config["app"]["version"])
    logger.info("Demo mode: %s", config["app"]["demo_mode"])
    logger.info("LLM provider: %s", config["llm"]["provider"])
    logger.info("Embedding model: %s", config["embedding"]["model_name"])

    init_db()
    logger.info("Database initialized")

    try:
        space_id = embedding_service.get_space_id()
        logger.info("Embedding space registered: %s", space_id)
    except Exception as e:
        logger.warning("Embedding space registration skipped: %s", e)


frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
