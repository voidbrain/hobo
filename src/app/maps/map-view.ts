import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterRenderEffect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { DEFAULT_OSM_TILES, type MapPoint, type TileLayerConfig } from './map-provider';

/** A place to pin on the map: where it is and the name read out for it. */
export interface MapMarker {
  readonly location: MapPoint;
  readonly label: string;
}

/** Shown before there is anything to fit: the whole world. */
const WORLD_VIEW = { center: { lat: 20, lng: 0 }, zoom: 2 } as const;
/** Zoom for a single place, close enough to see its streets. */
const SINGLE_POINT_ZOOM = 14;

/**
 * Leaflet map with OpenStreetMap tiles and their attribution, place markers and route lines
 * (F-007-T02). Inputs only: it calls no provider and injects no app service, so it can move to
 * bricks; routes are the `geometry` of `RouteResult`s the app got from `/api/maps` (cached legs).
 * Colours come from tokens: Leaflet's vector layers get class names styled below.
 */
@Component({
  selector: 'hobo-map-view',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div #map class="hobo-map-view__map" role="region" [attr.aria-label]="label()"></div>
    <button type="button" class="hobo-map-view__center" (click)="pickCenter()">
      Use map centre
    </button>
    @if (markers().length > 0) {
      <ol class="hobo-map-view__places" [attr.aria-label]="label() + ': places'">
        @for (marker of markers(); track $index) {
          <li>{{ marker.label }}</li>
        }
      </ol>
    }
  `,
  styles: `
    hobo-map-view {
      display: block;
      position: relative;
      min-height: 16rem;
    }
    .hobo-map-view__map {
      height: 100%;
      min-height: inherit;
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
    }
    .hobo-map-view__map:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    .hobo-map-view__places {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    hobo-map-view .hobo-map-view__center {
      position: absolute;
      z-index: 1000;
      top: var(--space-2);
      right: var(--space-2);
      padding: var(--space-1) var(--space-2);
      border: 1px solid var(--color-border);
      border-radius: var(--radius);
      background: var(--color-surface);
      color: var(--color-text);
      font: inherit;
      cursor: pointer;
    }
    hobo-map-view .hobo-map-view__center:focus-visible {
      outline: 2px solid var(--color-accent);
      outline-offset: 2px;
    }
    hobo-map-view .hobo-map-route {
      stroke: var(--color-accent);
      stroke-width: 4;
      stroke-opacity: 0.9;
      fill: none;
    }
    hobo-map-view .hobo-map-marker {
      stroke: var(--color-surface);
      stroke-width: 2;
      fill: var(--color-accent);
      fill-opacity: 1;
    }
  `,
})
export class MapView {
  /** Accessible name of the map region. */
  readonly label = input('Map');
  readonly markers = input<readonly MapMarker[]>([]);
  /** One line per leg, each the leg's `geometry` from `/api/maps/route`. */
  readonly routes = input<readonly (readonly MapPoint[])[]>([]);
  readonly tiles = input<TileLayerConfig>(DEFAULT_OSM_TILES);
  /** Coordinate picked by clicking the map. */
  readonly picked = output<MapPoint>();

  protected pickCenter(): void {
    const point = this.map?.getCenter().wrap();
    if (point) this.picked.emit({ lat: point.lat, lng: point.lng });
  }

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('map');
  private map?: L.Map;
  private tileLayer?: L.TileLayer;
  private tileConfig?: TileLayerConfig;
  private readonly overlays = L.layerGroup();
  /** The points the view was last fitted to: refit only when they change, keeping a user's pan. */
  private fittedTo?: string;

  constructor() {
    const destroyRef = inject(DestroyRef);
    let resize: ResizeObserver | undefined;

    afterRenderEffect(() => {
      // Read every signal first so each one is tracked (docs/agents/angular.md).
      const markers = this.markers();
      const routes = this.routes();
      const tiles = this.tiles();
      const element = this.host().nativeElement;

      if (!this.map) {
        // An explicit SVG renderer: vector layers stay styleable by class, in every browser.
        this.map = L.map(element, { renderer: new L.SVG() });
        this.map.on('click', ({ latlng }) => {
          const point = latlng.wrap();
          this.picked.emit({ lat: point.lat, lng: point.lng });
        });
        this.overlays.addTo(this.map);
        if (typeof ResizeObserver !== 'undefined') {
          resize = new ResizeObserver(() => this.map?.invalidateSize());
          resize.observe(element);
        }
      }
      const map = this.map;

      if (tiles !== this.tileConfig) {
        this.tileLayer?.remove();
        this.tileLayer = L.tileLayer(tiles.urlTemplate, {
          attribution: tiles.attribution,
          maxZoom: tiles.maxZoom,
        }).addTo(map);
        this.tileConfig = tiles;
      }

      this.overlays.clearLayers();
      for (const line of routes) {
        if (line.length < 2) continue;
        L.polyline(
          line.map((p) => [p.lat, p.lng] as L.LatLngTuple),
          { className: 'hobo-map-route', interactive: false },
        ).addTo(this.overlays);
      }
      for (const marker of markers) {
        L.circleMarker([marker.location.lat, marker.location.lng], {
          className: 'hobo-map-marker',
          radius: 7,
        })
          .bindTooltip(textOnly(marker.label))
          .addTo(this.overlays);
      }

      const points = [...markers.map((m) => m.location), ...routes.flat()];
      const fitKey = JSON.stringify([points.map((p) => [p.lat, p.lng]), tiles.maxZoom]);
      if (fitKey === this.fittedTo) return;
      this.fittedTo = fitKey;
      if (points.length === 0) {
        map.setView(WORLD_VIEW.center, WORLD_VIEW.zoom);
      } else if (points.length === 1 || samePoint(points)) {
        map.setView(points[0]!, Math.min(SINGLE_POINT_ZOOM, tiles.maxZoom));
      } else {
        map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as L.LatLngTuple)), {
          padding: [24, 24],
          maxZoom: Math.min(SINGLE_POINT_ZOOM, tiles.maxZoom),
        });
      }
    });

    destroyRef.onDestroy(() => {
      resize?.disconnect();
      this.map?.remove();
      this.map = undefined;
    });
  }
}

function samePoint(points: readonly MapPoint[]): boolean {
  const [first] = points;
  return points.every((p) => p.lat === first!.lat && p.lng === first!.lng);
}

/** Leaflet writes string tooltips as HTML; a text node keeps a place name plain text. */
function textOnly(text: string): HTMLElement {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
}
