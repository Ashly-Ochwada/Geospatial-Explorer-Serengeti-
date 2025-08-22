export type StacItemLite = {
    id: string
    datetime?: string
    cloud_cover?: number
    collection?: string
    geometry: GeoJSON.Geometry
    visual_href?: string | null
  }
  