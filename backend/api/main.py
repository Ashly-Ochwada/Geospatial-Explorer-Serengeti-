from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import os, json, httpx, logging

log = logging.getLogger("uvicorn")

STAC_URL = os.getenv("STAC_URL", "https://earth-search.aws.element84.com/v1")
AOI_FILE = os.getenv("AOI_FILE", "data/aoi_serengeti.geojson")  

app = FastAPI(title="Geospatial Explorer API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/aoi")
def get_aoi():
    if not os.path.exists(AOI_FILE):
        log.error("AOI file not found at %s", os.path.abspath(AOI_FILE))
        raise HTTPException(status_code=500, detail="AOI file missing")
    with open(AOI_FILE, "r") as f:
        return json.load(f)

def bbox_from_fc(fc: dict):
    try:
        coords = []
        for feat in fc.get("features", []):
            geom = feat.get("geometry", {})
            t = geom.get("type")
            if t == "Polygon":
                for ring in geom.get("coordinates", []): coords.extend(ring)
            elif t == "MultiPolygon":
                for poly in geom.get("coordinates", []):
                    for ring in poly: coords.extend(ring)
        xs = [c[0] for c in coords]; ys = [c[1] for c in coords]
        return [min(xs), min(ys), max(xs), max(ys)]
    except Exception:
        return None

@app.get("/stac/search")
async def stac_search(
    collections: Optional[List[str]] = Query(default=["sentinel-2-l2a"]),
    limit: int = 5,
    bbox: Optional[str] = None,
    cloud_cover: Optional[int] = Query(default=20),
    datetime: Optional[str] = None
):
    if bbox is None:
        aoi = get_aoi()
        bb = bbox_from_fc(aoi) or [34.7, -1.8, 35.4, -1.0]
    else:
        try:
            bb = [float(x) for x in bbox.split(",")]
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid bbox format")

    payload = {
        "collections": collections,
        "limit": limit,
        "bbox": bb,
        "query": {"eo:cloud_cover": {"lte": cloud_cover}},
        "sort": [{"field": "properties.datetime", "direction": "desc"}],
    }
    if datetime:
        payload["datetime"] = datetime

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(f"{STAC_URL}/search", json=payload)
        r.raise_for_status()
        data = r.json()

    items = []
    for feat in data.get("features", []):
        props = feat.get("properties", {})
        assets = feat.get("assets", {})
        visual_href = None
        for candidate in ["visual", "rendered_preview", "true_color"]:
            if candidate in assets:
                visual_href = assets[candidate].get("href"); break
        if not visual_href:
            for a in assets.values():
                href = a.get("href", "")
                if href.endswith(".tif") or href.endswith(".tiff"):
                    visual_href = href; break

        items.append({
            "id": feat.get("id"),
            "datetime": props.get("datetime"),
            "cloud_cover": props.get("eo:cloud_cover"),
            "geometry": feat.get("geometry"),
            "collection": feat.get("collection"),
            "visual_href": visual_href,
        })
    return {"items": items}
