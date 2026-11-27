import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import * as L from 'leaflet';
import { firstValueFrom } from 'rxjs';
import { DEFAULT_OSM_TILES, type MapPoint, type RouteResult } from './map-provider';
import { MapsApi } from './maps-api';
import { MapView, type MapMarker } from './map-view';

// Invented places and coordinates only.
const PORTWIND: MapPoint = { lat: 45.1, lng: 9.1 };
const MILLHAVEN: MapPoint = { lat: 45.22, lng: 9.25 };
const GREYFELL: MapPoint = { lat: 45.3, lng: 9.4 };

// jsdom lays nothing out; give elements a size so Leaflet projects and draws the layers.
const SIZE_PROPS = ['clientWidth', 'clientHeight'] as const;
beforeAll(() => {
  for (const prop of SIZE_PROPS) {
    Object.defineProperty(HTMLElement.prototype, prop, { configurable: true, get: () => 400 });
  }
});
afterAll(() => {
  for (const prop of SIZE_PROPS) delete (HTMLElement.prototype as Partial<HTMLElement>)[prop];
});

async function render(inputs: {
  markers?: readonly MapMarker[];
  routes?: readonly (readonly MapPoint[])[];
}): Promise<{ fixture: ComponentFixture<MapView>; el: HTMLElement }> {
  const fixture = TestBed.createComponent(MapView);
  if (inputs.markers) fixture.componentRef.setInput('markers', inputs.markers);
  if (inputs.routes) fixture.componentRef.setInput('routes', inputs.routes);
  await fixture.whenStable();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('MapView (F-007-T02)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('shows OpenStreetMap tiles with visible attribution and no key in any tile URL', async () => {
    const { el } = await render({});
    const attribution = el.querySelector('.leaflet-control-attribution');
    expect(attribution?.textContent).toContain('OpenStreetMap contributors');
    const tiles = [...el.querySelectorAll<HTMLImageElement>('img.leaflet-tile')];
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tile.src).toMatch(/^https:\/\/[abc]\.tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
    }
    expect(DEFAULT_OSM_TILES.urlTemplate).not.toMatch(/key|token/i);
    expect(el.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Map');
  });

  it('draws markers and route lines from its inputs, styled by token classes', async () => {
    const { fixture, el } = await render({
      markers: [
        { location: PORTWIND, label: 'Harbour Quay' },
        { location: GREYFELL, label: 'Fell Road' },
      ],
      routes: [[PORTWIND, MILLHAVEN, GREYFELL]],
    });
    expect(el.querySelectorAll('path.hobo-map-marker').length).toBe(2);
    expect(el.querySelectorAll('path.hobo-map-route').length).toBe(1);
    const places = [...el.querySelectorAll('.hobo-map-view__places li')].map((li) =>
      li.textContent?.trim(),
    );
    expect(places).toEqual(['Harbour Quay', 'Fell Road']);

    fixture.componentRef.setInput('routes', []);
    fixture.componentRef.setInput('markers', [{ location: MILLHAVEN, label: 'Mill Lane' }]);
    await fixture.whenStable();
    expect(el.querySelectorAll('path.hobo-map-route').length).toBe(0);
    expect(el.querySelectorAll('path.hobo-map-marker').length).toBe(1);
  });

  it('emits a picked map coordinate when the map is clicked', async () => {
    const { fixture, el } = await render({});
    const picked: MapPoint[] = [];
    fixture.componentInstance.picked.subscribe((point) => picked.push(point));
    el.querySelector<HTMLElement>('.hobo-map-view__map')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 200, clientY: 200 }),
    );
    await fixture.whenStable();

    expect(picked).toHaveLength(1);
    expect(Number.isFinite(picked[0]?.lat)).toBe(true);
    expect(Number.isFinite(picked[0]?.lng)).toBe(true);
  });

  it('emits the map centre when its keyboard-operable control is activated', async () => {
    const { fixture, el } = await render({});
    const picked: MapPoint[] = [];
    fixture.componentInstance.picked.subscribe((point) => picked.push(point));
    const button = el.querySelector<HTMLButtonElement>('.hobo-map-view__center')!;
    button.focus();
    button.click();

    expect(document.activeElement).toBe(button);
    expect(picked).toHaveLength(1);
    expect(picked[0]?.lng).toBeGreaterThanOrEqual(-180);
    expect(picked[0]?.lng).toBeLessThanOrEqual(180);
  });

  it('wraps a click beyond the antimeridian into a valid longitude', async () => {
    const { fixture } = await render({});
    const picked: MapPoint[] = [];
    fixture.componentInstance.picked.subscribe((point) => picked.push(point));
    const map = (fixture.componentInstance as unknown as { map: L.Map }).map;
    map.fire('click', { latlng: L.latLng(4, 200) });

    expect(picked).toEqual([{ lat: 4, lng: -160 }]);
  });

  it('shows a place name with markup as plain text in its tooltip', async () => {
    const label = '<img src="x" onerror="alert(1)">Harbour Quay';
    const { el } = await render({ markers: [{ location: PORTWIND, label }] });
    el.querySelector('path.hobo-map-marker')!.dispatchEvent(
      new MouseEvent('mouseover', { bubbles: true }),
    );
    const tooltip = el.querySelector('.leaflet-tooltip');
    expect(tooltip?.textContent).toBe(label);
    expect(tooltip?.querySelector('img')).toBeNull();
  });

  it('keeps the view while the same points arrive again, and refits when they change', async () => {
    const markers = [
      { location: PORTWIND, label: 'Harbour Quay' },
      { location: GREYFELL, label: 'Fell Road' },
    ];
    const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
    const setView = vi.spyOn(L.Map.prototype, 'setView');
    try {
      const { fixture } = await render({ markers });
      expect(fitBounds).toHaveBeenCalledTimes(1);
      const viewsAfterFit = setView.mock.calls.length;
      // A new array with the same points (as a page re-render gives) must not undo a user's pan.
      fixture.componentRef.setInput(
        'markers',
        markers.map((m) => ({ ...m })),
      );
      await fixture.whenStable();
      expect(fitBounds).toHaveBeenCalledTimes(1);
      expect(setView.mock.calls.length).toBe(viewsAfterFit);
      fixture.componentRef.setInput('markers', [{ location: MILLHAVEN, label: 'Mill Lane' }]);
      await fixture.whenStable();
      expect(setView.mock.calls.at(-1)?.[0]).toEqual(MILLHAVEN);
    } finally {
      fitBounds.mockRestore();
      setView.mockRestore();
    }
  });

  it('removes the Leaflet map when destroyed', async () => {
    const { fixture, el } = await render({
      markers: [{ location: PORTWIND, label: 'Harbour Quay' }],
    });
    const container = el.querySelector('.hobo-map-view__map')!;
    expect(container.querySelector('.leaflet-map-pane')).not.toBeNull();
    fixture.destroy();
    expect(container.querySelector('.leaflet-map-pane')).toBeNull();
  });
});

describe('MapsApi route into MapView (F-007-T02 join)', () => {
  it('draws the geometry of a cached leg answered by /api/maps/route', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(MapsApi);
    const http = TestBed.inject(HttpTestingController);

    const answer = firstValueFrom(api.route({ from: PORTWIND, to: GREYFELL }));
    const cachedLeg: RouteResult = {
      provider: 'openrouteservice',
      profile: 'driving-car',
      from: PORTWIND,
      to: GREYFELL,
      distanceMetres: 38_900,
      travelMinutes: 48,
      geometry: [PORTWIND, MILLHAVEN, GREYFELL],
      cached: true,
    };
    http.expectOne({ method: 'POST', url: '/api/maps/route' }).flush(cachedLeg);
    const leg = await answer;
    http.verify();

    const { el } = await render({
      markers: [
        { location: leg.from, label: 'Harbour Quay' },
        { location: leg.to, label: 'Fell Road' },
      ],
      routes: [leg.geometry],
    });
    const line = el.querySelector('path.hobo-map-route');
    expect(line).not.toBeNull();
    // Three points of the leg: one move and two line segments in the SVG path.
    expect(line?.getAttribute('d')?.match(/L/g)?.length).toBe(2);
  });
});
