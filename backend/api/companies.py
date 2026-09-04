from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.db.database import get_connection
from backend.models.company import get_all_companies, get_active_company

router = APIRouter(prefix="/api", tags=["companies"])


@router.get("/companies")
async def list_companies():
    conn = get_connection()
    try:
        companies = get_all_companies(conn)
        return {
            "companies": [
                {
                    "id": c.company_id,
                    "name": c.name,
                    "display_name": c.display_name,
                    "is_active": c.is_active,
                    "keywords": c.keywords,
                    "products": [{"name": p.name, "aliases": p.aliases} for p in c.products],
                    "platforms": [{"name": p.name, "enabled": p.enabled} for p in c.platforms],
                }
                for c in companies
            ]
        }
    finally:
        conn.close()


@router.get("/companies/{company_id}")
async def get_company(company_id: str):
    conn = get_connection()
    try:
        company = get_active_company(conn, company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        return {
            "id": company.company_id,
            "name": company.name,
            "display_name": company.display_name,
            "is_active": company.is_active,
            "keywords": company.keywords,
            "products": [{"name": p.name, "aliases": p.aliases} for p in company.products],
            "platforms": [{"name": p.name, "enabled": p.enabled, "search_type": p.search_type} for p in company.platforms],
            "config_version": company.config_version,
        }
    finally:
        conn.close()
