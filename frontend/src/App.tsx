import React, { useEffect, useState, useRef } from "react";
import MapView from "./map/MapView";
import { StacItemLite } from "./lib/type";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const BASEMAP_KEYS = ["dark", "streets"] as const;
type BasemapKey = (typeof BASEMAP_KEYS)[number];

const SERENGETI_BBOX: [number, number, number, number] = [33.70, -3.00, 35.50, -1.20];

function fcFromBbox([minx, miny, maxx, maxy]: [number, number, number, number]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "Serengeti (approx)" },
        geometry: {
          type: "Polygon",
          coordinates: [[[minx,miny],[maxx,miny],[maxx,maxy],[minx,maxy],[minx,miny]]]
        }
      } as any
    ]
  };
}

export default function App() {
  const [aoi, setAoi] = useState<GeoJSON.FeatureCollection | null>(null);
  const [items, setItems] = useState<StacItemLite[]>([]);
  const [selected, setSelected] = useState<StacItemLite | null>(null);
  const [loading, setLoading] = useState(false);

  const [showAoi, setShowAoi] = useState(true);
  const [showFootprints, setShowFootprints] = useState(true);
  const [showRaster, setShowRaster] = useState(true);
  const [rasterOpacity, setRasterOpacity] = useState(0.85);
  const [basemap, setBasemap] = useState<BasemapKey>("dark");


  useEffect(() => {
    fetch(`${API_URL}/aoi`)
      .then(r => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((fc: GeoJSON.FeatureCollection) => setAoi(fc))
      .catch(() => setAoi(fcFromBbox(SERENGETI_BBOX)));
  }, []);

  const abortRef = useRef<AbortController | null>(null);

  const search = async (bbox?: [number, number, number, number]) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {

      const bb = bbox ?? SERENGETI_BBOX;
      const r = await fetch(
        `${API_URL}/stac/search?limit=6&cloud_cover=20&bbox=${bb.join(",")}`,
        { signal: ac.signal }
      );
      const { items } = await r.json();
      setItems(items);

      setSelected(items.find((it: StacItemLite) => !!it.visual_href) ?? null);
    } catch (e: any) {
      if (e.name !== "AbortError") console.error(e);
    } finally {
      if (abortRef.current === ac) setLoading(false);
    }
  };


  useEffect(() => {
    if (aoi && items.length === 0 && !loading) {
      void search(SERENGETI_BBOX);
    }
  }, [aoi]); 

  return (
    <div className="h-full grid grid-rows-[auto,1fr]">
      <header className="p-3 border-b border-slate-700 bg-slate-800/60 backdrop-blur">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-4 items-center">
          <h1 className="font-semibold text-lg">Geospatial Conservation Explorer — Serengeti</h1>

          <div className="flex gap-3 text-sm ml-auto items-center">

            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showAoi} onChange={e => setShowAoi(e.target.checked)} />
              AOI
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showFootprints} onChange={e => setShowFootprints(e.target.checked)} />
              Footprints
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={showRaster} onChange={e => setShowRaster(e.target.checked)} />
              Raster
            </label>


            <label className="flex items-center gap-2">
              <span>Opacity</span>
              <input
                aria-label="Raster opacity"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={rasterOpacity}
                onChange={e => setRasterOpacity(parseFloat(e.target.value))}
              />
            </label>


            <select
              value={basemap}
              onChange={e => setBasemap(e.target.value as BasemapKey)}
              className="bg-slate-700 rounded px-2 py-1"
            >
              {BASEMAP_KEYS.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>


            <button
              onClick={() => search(SERENGETI_BBOX)}
              className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 text-sm font-medium"
            >
              Search STAC (S2 L2A)
            </button>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-12 h-full">
        <section className="col-span-12 md:col-span-9 border-r border-slate-800">
          <MapView
            aoi={aoi}
            stacItems={items}
            selected={selected}
            onSelect={setSelected}
            showAoi={showAoi}
            showFootprints={showFootprints}
            showRaster={showRaster}
            rasterOpacity={rasterOpacity}
            basemap={basemap}
          />
        </section>

        <aside className="col-span-12 md:col-span-3 p-3 overflow-y-auto">
          <h2 className="text-sm font-semibold mb-2">Results</h2>
          {loading && <div className="text-xs">Loading…</div>}
          {items.length === 0 && !loading && (
            <div className="text-xs text-slate-400">No results yet. (Auto-search targets Serengeti)</div>
          )}
          <ul className="space-y-2">
            {items.map(it => (
              <li
                key={it.id}
                className={`p-2 rounded border border-slate-700 hover:border-emerald-500 cursor-pointer ${
                  selected?.id === it.id ? "bg-slate-800" : ""
                }`}
                onClick={() => setSelected(it)}
              >
                <div className="text-xs font-mono">{it.id}</div>
                <div className="text-[11px] text-slate-400">
                  {it.datetime?.slice(0, 10)} · cc: {it.cloud_cover ?? "—"}%
                </div>
                <div className="text-[11px] truncate">{it.visual_href || "No COG asset"}</div>
              </li>
            ))}
          </ul>

          {selected && (
            <div className="mt-4 p-2 border border-slate-700 rounded text-xs">
              <h3 className="font-semibold mb-1">Selected Item</h3>
              <p>ID: {selected.id}</p>
              <p>Date: {selected.datetime?.slice(0, 10)}</p>
              <p>Cloud Cover: {selected.cloud_cover ?? "—"}%</p>
              <p>Collection: {selected.collection}</p>
              <p className="truncate">COG: {selected.visual_href || "N/A"}</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}
