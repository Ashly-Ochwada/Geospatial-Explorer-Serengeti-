
# 🌍 Interactive Geospatial Conservation Explorer

A lightweight web application that displays interactive geospatial data for environmental monitoring, aligned with **Space4Good's conservation mission**.

The focus of this assignment was **clean, maintainable code architecture**, clear documentation, and a minimal but working set of core features.



# Setup Instructions

# Prerequisites

  **Node.js** (>= 18.x)
  **Python** (>= 3.10)
  **Docker & Docker Compose** (for backend + TiTiler)

# Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit: `http://localhost:5173`

# Run Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

Backend will run at `http://localhost:8000`

# Run via Docker Compose

```bash
docker-compose up --build
```

This spins up:

* Frontend (React + MapLibre)
* Backend (FastAPI proxy)
* TiTiler (for Cloud-Optimized GeoTIFF streaming)

---

# Architecture Overview

```plaintext
geospatial-explorer/
├── backend/                  # FastAPI backend
│   ├── api/                  # API logic
│   │   └── main.py           # Entry point: STAC proxy + AOI endpoints
│   ├── data/                 # Local GeoJSON AOIs
│   │   └── aoi_serengeti.geojson
│   ├── tests/                # Backend tests (pytest)
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                 # React + MapLibre frontend
│   ├── public/               # Static assets
│   ├── src/
│   │   ├── assets/           # Logos/icons
│   │   ├── lib/              # Helpers (geo utils, types)
│   │   ├── map/              # MapLibre components
│   │   ├── test/             # Frontend tests (Vitest + RTL)
│   │   ├── App.tsx           # Main app
│   │   └── main.tsx          # React entry point
│   ├── vite.config.ts        # Vite bundler config
│   ├── package.json
│   └── index.html
│
├── docker-compose.yml        # Orchestration
├── .env                      # Environment config
└── README.md                 # Documentation
```

# Data Flow

```mermaid
flowchart LR
  subgraph Frontend [Frontend (React + MapLibre)]
    A[Load AOI GeoJSON] --> B[STAC Query UI]
    B --> C[Display Map + Raster Layer]
  end

  subgraph Backend [FastAPI Proxy]
    D[AOI Endpoint] --> E[STAC API Call]
    E --> F[Return imagery + metadata]
  end

  subgraph TiTiler [TiTiler Service]
    G[Stream COG Raster Tiles]
  end

  A -->|GeoJSON| Backend
  B -->|Search imagery| Backend
  Backend --> Frontend
  Backend --> TiTiler
  TiTiler --> Frontend
```

---

# Features Implemented (Prioritized)

# Core (Priority 1)

1. **Map Foundation**

   * Interactive map with MapLibre GL
   * GeoJSON boundary layer (`aoi_serengeti.geojson`)

2. **Raster Data**

   * Integration with **TiTiler** for Cloud-Optimized GeoTIFF (COG) streaming
   * Renders raster tiles on the map

3. **STAC Integration**

   * Query a public **STAC API**
   * Auto-selects first STAC item with `visual_href`
   * Displays satellite imagery + metadata

# Not Implemented (due to time)

* UI controls (layer toggles, opacity sliders, basemap switcher)
* Backend caching/performance optimizations
* Expanded FastAPI endpoints

 **Reasoning**: We prioritized **Points 1–3** (core requirements) to deliver a clean, working foundation over adding half-finished extras.

---

# Testing Strategy

* **Frontend**:

  * **Vitest + React Testing Library** for component testing
  * Example: verifies STAC search auto-selects first imagery

* **Backend**:

  * Minimal **pytest** for FastAPI endpoints

* **CI-ready**: tests can run locally or in Docker.

---

# Decisions & Trade-offs

* **Stack choice**: Used **React + MapLibre + Tailwind** (instead of SvelteKit) for speed, since React was more familiar.
* **Backend**: Kept backend minimal (FastAPI proxy + TiTiler) to show architecture without over-engineering.
* **Performance**: Focused on correctness over optimization; raster loads are functional but could be cached.
* **Testing**: Implemented minimal tests to demonstrate approach, prioritizing architecture clarity.

---

# Challenges & Next Steps

# Challenges

* Handling **COG performance** (tile streaming can be slow without caching).
* Ensuring **STAC metadata parsing** worked consistently across APIs.

### If Given More Time

* Add **layer toggles & opacity controls** for better UX.
* Implement **caching & pagination** in backend for performance.
* Add **error boundaries** + graceful UI fallback.
* Improve **test coverage** (integration + end-to-end).
* Deploy a demo (e.g. on Vercel + Render).


## 📌 Summary

This project demonstrates:

* Clean and modular **architecture**
* Working core geospatial features (GeoJSON + COG + STAC)
* A minimal but real **testing setup**
* Clear **documentation of trade-offs and decisions**

 **Quality over completeness** — the core features are working, code is maintainable, and future extensions are easy to add.

