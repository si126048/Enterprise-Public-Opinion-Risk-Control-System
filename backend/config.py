from pathlib import Path
import yaml
from dotenv import load_dotenv
import os

PROJECT_ROOT = Path(__file__).resolve().parent.parent
_config = None


def load_config() -> dict:
    global _config
    if _config is not None:
        return _config

    load_dotenv(PROJECT_ROOT / ".env")

    config_path = PROJECT_ROOT / "config.yaml"
    with open(config_path, "r", encoding="utf-8") as f:
        _config = yaml.safe_load(f)

    log_level = os.getenv("LOG_LEVEL")
    if log_level:
        _config.setdefault("app", {})["log_level"] = log_level

    return _config


def get_config() -> dict:
    if _config is None:
        return load_config()
    return _config
