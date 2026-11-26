import {
  cachedMapProvider,
  type LegCache,
  type MapErrorCode,
  type MapProvider,
} from '../src/app/maps/map-provider.ts';
import type { ConfiguredMapProvider, ServerConfig } from './config.ts';

/** Structured upstream or configuration error from a server-side map provider (F-007-T03; every provider in `server/` throws it). */
export class MapProviderError extends Error {
  readonly status: number;
  readonly code: MapErrorCode;
  readonly userMessage: string;

  constructor(status: number, code: MapErrorCode, userMessage: string) {
    super(userMessage);
    this.name = 'MapProviderError';
    this.status = status;
    this.code = code;
    this.userMessage = userMessage;
  }
}

export type MapProviderFactory = (config: ServerConfig) => MapProvider;

/**
 * Selects the configured provider implementation in `server/` and wraps it with the
 * SQLite-backed leg cache (legs older than `legCacheMaxAgeDays` are fetched again) so trips and what-if comparisons never re-query cached legs.
 */
export function createServerMapProvider(
  config: ServerConfig,
  cache: LegCache,
  factories: Partial<Record<ConfiguredMapProvider, MapProviderFactory>>,
): MapProvider {
  const factory = factories[config.mapProvider];
  if (!factory) {
    throw new Error(`No map provider registered for ${config.mapProvider}`);
  }
  return cachedMapProvider(factory(config), cache, { maxAgeDays: config.legCacheMaxAgeDays });
}
