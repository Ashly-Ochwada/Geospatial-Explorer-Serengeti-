import React, { useEffect, useRef } from "react";
import maplibregl, { Map, LngLatBoundsLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StacItemLite } from "../lib/type";

const TITILER = import.meta.env.VITE_TITILER_URL || "http://localhost:8081";

const AOI_SRC = "aoi-src";
const AOI_LINE = "aoi-line";
const AOI_FILL = "aoi-fill";
const STAC_SRC = "stac-src";
const STAC_OUTLINE = "stac-outline";
const COG_SRC_ID = "cog-tiles";
const COG_LAYER_ID = "cog-raster";
const SELECTED_SRC = "selected-stac-src";
const SELECTED_OUTLINE = "selected-stac-outline";

const BASEMAPS: Record<string, string> = {
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  streets: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
};

type Props = {
  aoi: GeoJSON.FeatureCollection | null;
  stacItems: StacItemLite[];
  selected: StacItemLite | null;
  onSelect: (it: StacItemLite | null) => void;

  showAoi: boolean;
  showFootprints: boolean;
  showRaster: boolean;
  rasterOpacity: number; 
  basemap: string;       
};

export default function MapView({
  aoi,
  stacItems,
  selected,
  onSelect,
  showAoi,
  showFootprints,
  showRaster,
  rasterOpacity,
  basemap,
}: Props) {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current && !mapRef.current) {
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: BASEMAPS[basemap] || BASEMAPS.dark,
        center: [35.05, -1.40],
        zoom: 7.8,
        renderWorldCopies: false,     
        fadeDuration: 100,            
        collectResourceTiming: false,
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        addCoreSourcesAndLayers(map, aoi);
        updateStacFootprints(map, stacItems);

        if (!map.getSource(SELECTED_SRC)) {
          map.addSource(SELECTED_SRC, { type: "geojson", data: emptyFC() });
        }
        if (!map.getLayer(SELECTED_OUTLINE)) {
          map.addLayer({
            id: SELECTED_OUTLINE,
            type: "line",
            source: SELECTED_SRC,
            paint: { "line-color": "#f59e0b", "line-width": 3 },
          });
        }

        map.on("mouseenter", STAC_OUTLINE, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", STAC_OUTLINE, () => (map.getCanvas().style.cursor = ""));

        setLayerVisibility(map, AOI_LINE, showAoi);
        setLayerVisibility(map, AOI_FILL, showAoi);
        setLayerVisibility(map, STAC_OUTLINE, showFootprints);

        fitToAoi(map, aoi);
        ensureRaster(map, selected, showRaster, rasterOpacity);
        updateSelectedLayer(map, selected);
      });
    }
    return () => {  };
  }, []); 

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const styleUrl = BASEMAPS[basemap] || BASEMAPS.dark;
    map.setStyle(styleUrl);

    const reAdd = () => {
      addCoreSourcesAndLayers(map, aoi);
      updateStacFootprints(map, stacItems);

      if (!map.getSource(SELECTED_SRC)) {
        map.addSource(SELECTED_SRC, { type: "geojson", data: emptyFC() });
      }
      if (!map.getLayer(SELECTED_OUTLINE)) {
        map.addLayer({
          id: SELECTED_OUTLINE,
          type: "line",
          source: SELECTED_SRC,
          paint: { "line-color": "#f59e0b", "line-width": 3 },
        });
      }

      setLayerVisibility(map, AOI_LINE, showAoi);
      setLayerVisibility(map, AOI_FILL, showAoi);
      setLayerVisibility(map, STAC_OUTLINE, showFootprints);

      ensureRaster(map, selected, showRaster, rasterOpacity);
      updateSelectedLayer(map, selected);
    };

    map.once("styledata", reAdd);
  }, [basemap]); 

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const src = map.getSource(AOI_SRC) as maplibregl.GeoJSONSource | undefined;
    if (src && aoi) {
      src.setData(aoi as any);
      fitToAoi(map, aoi);
    }
    setLayerVisibility(map, AOI_LINE, showAoi);
    setLayerVisibility(map, AOI_FILL, showAoi);
  }, [aoi, showAoi]);

  
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    updateStacFootprints(map, stacItems);
    setLayerVisibility(map, STAC_OUTLINE, showFootprints);
  }, [stacItems, showFootprints]);


  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    ensureRaster(map, selected, showRaster, rasterOpacity);
    updateSelectedLayer(map, selected);

    if (selected?.geometry) {
      const [minx, miny, maxx, maxy] = bboxFromGeom(selected.geometry);
      if (isFinite(minx)) {
        map.fitBounds([[minx, miny], [maxx, maxy]] as LngLatBoundsLike, { padding: 24, duration: 500 });
      }
    }
  }, [selected, showRaster, rasterOpacity]);


  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;

    const handler = (e: maplibregl.MapLayerMouseEvent) => {
      const feats = m.queryRenderedFeatures(e.point, { layers: [STAC_OUTLINE] });
      if (feats[0]) {
        const fid = feats[0].properties?.id as string;
        const it = stacItems.find(i => i.id === fid) || null;
        onSelect(it);
      }
    };

    m.on("click", STAC_OUTLINE, handler);
    return () => {
      m.off("click", STAC_OUTLINE, handler);
    };
  }, [stacItems, onSelect]);

  return <div ref={containerRef} className="h-full w-full" />;
}


function emptyFC(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function addCoreSourcesAndLayers(map: Map, aoi: GeoJSON.FeatureCollection | null) {
  if (!map.getSource(AOI_SRC)) {
    map.addSource(AOI_SRC, { type: "geojson", data: aoi || emptyFC() });
  }
  if (!map.getLayer(AOI_LINE)) {
    map.addLayer({
      id: AOI_LINE, type: "line", source: AOI_SRC,
      paint: { "line-color": "#22c55e", "line-width": 2 }
    });
  }
  if (!map.getLayer(AOI_FILL)) {
    map.addLayer({
      id: AOI_FILL, type: "fill", source: AOI_SRC,
      paint: { "fill-color": "#22c55e", "fill-opacity": 0.08 }
    });
  }

  if (!map.getSource(STAC_SRC)) {
    map.addSource(STAC_SRC, { type: "geojson", data: emptyFC() });
  }
  if (!map.getLayer(STAC_OUTLINE)) {
    map.addLayer({
      id: STAC_OUTLINE, type: "line", source: STAC_SRC,minzoom: 6, 
      paint: { "line-color": "#60a5fa", "line-width": 1 }
    });
  }
}

function updateStacFootprints(map: Map, items: StacItemLite[]) {
  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: items.map((it) => ({
      type: "Feature",
      properties: { id: it.id },
      geometry: it.geometry
    })) as any
  };
  const src = map.getSource(STAC_SRC) as maplibregl.GeoJSONSource | undefined;
  src?.setData(fc as any);
}

function updateSelectedLayer(map: Map, selected: StacItemLite | null) {
  const src = map.getSource(SELECTED_SRC) as maplibregl.GeoJSONSource | undefined;
  if (!src) return;
  if (selected?.geometry) {
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [{ type: "Feature", properties: { id: selected.id }, geometry: selected.geometry } as any],
    };
    src.setData(fc as any);
  } else {
    src.setData(emptyFC() as any);
  }
}

function ensureRaster(map: Map, selected: StacItemLite | null, showRaster: boolean, opacity: number) {
  const removeCog = () => {
    if (map.getLayer(COG_LAYER_ID)) map.removeLayer(COG_LAYER_ID);
    if (map.getSource(COG_SRC_ID)) map.removeSource(COG_SRC_ID);
  };

  if (!selected?.visual_href || !showRaster) {
    removeCog();
    return;
  }


  const tileUrl = new URL(`${TITILER}/cog/tiles/{z}/{x}/{y}.png`);
  tileUrl.searchParams.set("url", selected.visual_href);

  removeCog();
  map.addSource(COG_SRC_ID, { type: "raster", tiles: [tileUrl.toString()], tileSize: 256 } as any);
  map.addLayer({
    id: COG_LAYER_ID, type: "raster", source: COG_SRC_ID,
    paint: { "raster-opacity": opacity }
  });
}

function setLayerVisibility(map: Map, layerId: string, visible: boolean) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
}

function fitToAoi(map: Map, aoi: GeoJSON.FeatureCollection | null) {
  if (!aoi || aoi.features.length === 0) return;

  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  aoi.features.forEach(feature => {
    if (!feature.geometry) return;
    const coords = extractCoords(feature.geometry);
    coords.forEach(([x, y]) => {
      if (x < minx) minx = x;
      if (y < miny) miny = y;
      if (x > maxx) maxx = x;
      if (y > maxy) maxy = y;
    });
  });

  if (isFinite(minx) && isFinite(miny) && isFinite(maxx) && isFinite(maxy)) {
    map.fitBounds([[minx, miny], [maxx, maxy]] as LngLatBoundsLike, { padding: 20, duration: 500 });
  }
}

function bboxFromGeom(geom: GeoJSON.Geometry): [number, number, number, number] {
  const pts = extractCoords(geom);
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const [x, y] of pts) {
    if (x < minx) minx = x;
    if (y < miny) miny = y;
    if (x > maxx) maxx = x;
    if (y > maxy) maxy = y;
  }
  return [minx, miny, maxx, maxy];
}

function extractCoords(geom: GeoJSON.Geometry): [number, number][] {
  switch (geom.type) {
    case "Point":
      return [geom.coordinates as [number, number]];
    case "MultiPoint":
    case "LineString":
      return geom.coordinates as [number, number][];
    case "MultiLineString":
    case "Polygon":
      return (geom.coordinates as [number, number][][]).flat();
    case "MultiPolygon":
      return (geom.coordinates as [number, number][][][]).flat(2);
    default:
      return [];
  }
}
