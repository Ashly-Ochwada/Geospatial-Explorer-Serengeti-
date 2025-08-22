import { beforeEach, afterEach, vi, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

beforeEach(() => {
  globalThis.fetch = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ type: 'FeatureCollection', features: [] }),
    } as any)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'demo-id',
            datetime: '2024-01-01',
            cloud_cover: 12,
            collection: 's2',
            geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] },
            visual_href: 'https://example.com/a.tif',
          },
        ],
      }),
    } as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('auto-selects first STAC item with a visual_href', async () => {
  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: /search stac/i }));

  await waitFor(() => {
    expect(screen.getByText(/Selected Item/i)).toBeInTheDocument();
  });
  expect(screen.getByText(/ID: demo-id/i)).toBeInTheDocument();
});
