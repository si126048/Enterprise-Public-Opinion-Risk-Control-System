import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException

from backend.ingestion.importer import import_csv

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


@router.post("/import")
async def import_data(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".csv", ".json"):
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix}. Use .csv or .json")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        stats = import_csv(tmp_path)
        return {
            "status": "ok",
            "filename": file.filename,
            "stats": stats,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")
    finally:
        if tmp_path:
            Path(tmp_path).unlink(missing_ok=True)
