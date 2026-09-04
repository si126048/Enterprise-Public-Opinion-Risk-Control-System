import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from pathlib import Path
import tempfile
import os


@pytest.fixture
def tmp_db(tmp_path):
    db_path = tmp_path / "test.db"
    with patch("backend.db.database.DB_PATH", db_path):
        from backend.db.database import init_db
        init_db()
        yield db_path


@pytest.fixture
def client(tmp_db):
    from backend.app import app
    from backend.db.database import init_db
    init_db()
    return TestClient(app)
