import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

vi.mock('maplibre-gl', () => {
  class Map {
    constructor(_: any) {}
    on() {}
    once() {}
    off() {}

    addControl() {}
    setStyle() {}
    getStyle() { return {} as any; }
    isStyleLoaded() { return true; }
    setLayoutProperty() {}           

    
    addSource() {}
    addLayer() {}
    getSource() { return { setData: () => {} } as any; }
    getLayer() { return true as any; }
    removeLayer() {}
    removeSource() {}

    
    fitBounds() {}
    queryRenderedFeatures() { return [] as any; }
    getCanvas() { return { style: {} } as any; }
  }
  class NavigationControl {}
  return { default: { Map, NavigationControl }, Map, NavigationControl };
});
