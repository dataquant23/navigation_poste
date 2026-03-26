from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd
from pyproj import Transformer

DATA_FILE = "poste_hta_bt.xlsx"
SOURCE_CRS = "EPSG:32630"
TARGET_CRS = "EPSG:4326"


def _data_path() -> Path:
    return Path(__file__).resolve().parent / "data" / DATA_FILE


def _clean_text(value) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def _to_float(value):
    if pd.isna(value):
        return None
    txt = str(value).strip().replace(" ", "").replace(",", ".")
    if not txt:
        return None
    try:
        return float(txt)
    except Exception:
        return None


def _format_dms(value: float | None, kind: str) -> str:
    if value is None:
        return ""
    abs_value = abs(float(value))
    degrees = int(abs_value)
    minutes_float = (abs_value - degrees) * 60
    minutes = int(minutes_float)
    seconds = round((minutes_float - minutes) * 60, 2)

    if kind == "lat":
        direction = "N" if value >= 0 else "S"
    else:
        direction = "E" if value >= 0 else "W"

    return f'{degrees}°{minutes:02d}\'{seconds:05.2f}" {direction}'


@lru_cache(maxsize=1)
def load_postes() -> list[dict]:
    path = _data_path()
    if not path.exists():
        return []

    df = pd.read_excel(path, dtype=str)
    df.columns = [str(c).strip() for c in df.columns]

    required = ["libelle", "nom_poste", "coordx", "coordy"]
    lower_map = {c.lower(): c for c in df.columns}
    missing = [c for c in required if c not in lower_map]
    if missing:
        raise ValueError(
            "Colonnes obligatoires manquantes dans poste_hta_bt.xlsx : "
            + ", ".join(missing)
        )

    rename_map = {
        lower_map["libelle"]: "libelle",
        lower_map["nom_poste"]: "nom_poste",
        lower_map["coordx"]: "coordx",
        lower_map["coordy"]: "coordy",
    }
    for optional in ["quartier", "commune", "region", "departemen", "depart", "dr", "type", "fonction"]:
        if optional in lower_map:
            rename_map[lower_map[optional]] = optional

    df = df.rename(columns=rename_map)

    for col in df.columns:
        df[col] = df[col].apply(_clean_text)

    df["coordx_num"] = df["coordx"].apply(_to_float)
    df["coordy_num"] = df["coordy"].apply(_to_float)
    df = df.dropna(subset=["coordx_num", "coordy_num"]).copy()

    transformer = Transformer.from_crs(SOURCE_CRS, TARGET_CRS, always_xy=True)

    records = []
    for idx, row in df.iterrows():
        x = row["coordx_num"]
        y = row["coordy_num"]
        lon, lat = transformer.transform(x, y)

        if lat is None or lon is None:
            continue

        poste_id = f"{row.get('depart', '')}-{row.get('libelle', '')}-{idx}"
        records.append({
            "id": poste_id,
            "code": _clean_text(row.get("libelle")),
            "nom_poste": _clean_text(row.get("nom_poste")),
            "libelle": _clean_text(row.get("libelle")),
            "quartier": _clean_text(row.get("quartier")),
            "commune": _clean_text(row.get("commune")),
            "region": _clean_text(row.get("region")),
            "departemen": _clean_text(row.get("departemen")),
            "depart": _clean_text(row.get("depart")),
            "dr": _clean_text(row.get("dr")),
            "type": _clean_text(row.get("type")),
            "fonction": _clean_text(row.get("fonction")),
            "coordx": _clean_text(row.get("coordx")),
            "coordy": _clean_text(row.get("coordy")),
            "lat": round(float(lat), 6),
            "lon": round(float(lon), 6),
            "lat_dms": _format_dms(lat, "lat"),
            "lon_dms": _format_dms(lon, "lon"),
            "description": "Poste chargé depuis poste_hta_bt.xlsx",
        })

    return records


def search_postes(query: str, limit: int = 20) -> list[dict]:
    postes = load_postes()
    q = (query or "").strip().lower()

    if not q:
        return postes[:limit]

    results = []
    for item in postes:
        hay = " ".join([
            item.get("libelle", ""),
            item.get("nom_poste", ""),
            item.get("code", ""),
            item.get("quartier", ""),
            item.get("commune", ""),
        ]).lower()
        if q in hay:
            results.append(item)
    return results[:limit]


def get_poste_by_id(poste_id: str | None) -> dict | None:
    if not poste_id:
        return None
    for item in load_postes():
        if str(item.get("id")) == str(poste_id):
            return item
    return None
