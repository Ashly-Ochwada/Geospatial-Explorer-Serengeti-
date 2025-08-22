import json, os, importlib, sys
from pathlib import Path
from fastapi.testclient import TestClient

# --- Make sure we can import main.py regardless of cwd ---
HERE = Path(__file__).resolve()
API_DIR = HERE.parents[1]        # .../backend/api
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

def build_app_with_tmp_aoi(tmp_path):
    """
    Create a temp AOI and point the app to it via AOI_FILE env var.
    Import main.py from backend/api reliably (path added above).
    """
    aoi = tmp_path / "aoi.geojson"
    aoi.write_text(json.dumps({"type":"FeatureCollection","features": []}))
    os.environ["AOI_FILE"] = str(aoi)

    import main as m           # now resolvable because API_DIR is on sys.path
    importlib.reload(m)        # pick up new env var
    return m.app, m

def test_health(tmp_path):
    app, _ = build_app_with_tmp_aoi(tmp_path)
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True

def test_aoi_served(tmp_path):
    app, _ = build_app_with_tmp_aoi(tmp_path)
    client = TestClient(app)
    r = client.get("/aoi")
    assert r.status_code == 200
    data = r.json()
    assert data["type"] == "FeatureCollection"

def test_stac_search_mocked_network(tmp_path, monkeypatch):
    app, m = build_app_with_tmp_aoi(tmp_path)

    # Mock network call used by /stac/search (no real HTTP)
    class FakeResp:
        def __init__(self):
            self._json = {
                "features": [{
                    "id": "fake-item",
                    "geometry": {"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]},
                    "properties": {"datetime":"2024-01-01T00:00:00Z","eo:cloud_cover":7},
                    "collection":"sentinel-2-l2a",
                    "assets": {"visual": {"href": "https://example.com/fake.tif"}}
                }]
            }
        def raise_for_status(self): pass
        def json(self): return self._json

    class FakeAsyncClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): return False
        async def post(self, *args, **kwargs): return FakeResp()

    monkeypatch.setattr(m.httpx, "AsyncClient", lambda **kw: FakeAsyncClient())

    client = TestClient(app)
    r = client.get("/stac/search?limit=1")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == "fake-item"
    assert items[0]["visual_href"].endswith(".tif")
