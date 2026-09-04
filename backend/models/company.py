import json
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Product:
    name: str
    aliases: list[str] = field(default_factory=list)


@dataclass
class Platform:
    name: str
    enabled: bool = True
    search_type: str = ""


@dataclass
class CompanyConfig:
    id: str
    company_id: str
    name: str
    display_name: str = ""
    keywords: list[str] = field(default_factory=list)
    products: list[Product] = field(default_factory=list)
    platforms: list[Platform] = field(default_factory=list)
    is_active: bool = True
    config_version: str = "1.0"

    @classmethod
    def from_db_row(cls, row) -> "CompanyConfig":
        return cls(
            id=row["id"],
            company_id=row["company_id"],
            name=row["name"],
            display_name=row["display_name"] or "",
            keywords=json.loads(row["keywords_json"] or "[]"),
            products=[Product(**p) for p in json.loads(row["products_json"] or "[]")],
            platforms=[Platform(**p) if isinstance(p, dict) else Platform(name=p) for p in json.loads(row["platforms_json"] or "[]")],
            is_active=bool(row["is_active"]),
            config_version=row["config_version"] or "1.0",
        )

    @classmethod
    def from_yaml_dict(cls, data: dict) -> "CompanyConfig":
        products = [Product(name=p["name"], aliases=p.get("aliases", [])) for p in data.get("products", [])]
        platforms = [Platform(name=p["name"], enabled=p.get("enabled", True), search_type=p.get("search_type", "")) for p in data.get("platforms", [])]
        return cls(
            id=f"cfg_{data['id']}",
            company_id=data["id"],
            name=data["name"],
            display_name=data.get("display_name", ""),
            keywords=data.get("keywords", []),
            products=products,
            platforms=platforms,
            is_active=data.get("is_active", True),
        )


def get_active_company(conn, company_id: Optional[str] = None) -> Optional[CompanyConfig]:
    if company_id:
        row = conn.execute(
            "SELECT * FROM company_config WHERE company_id = ? AND is_active = 1",
            (company_id,),
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM company_config WHERE is_active = 1 LIMIT 1"
        ).fetchone()
    return CompanyConfig.from_db_row(row) if row else None


def get_all_companies(conn) -> list[CompanyConfig]:
    rows = conn.execute("SELECT * FROM company_config ORDER BY is_active DESC, name").fetchall()
    return [CompanyConfig.from_db_row(r) for r in rows]
