import {
  cachedMapProvider,
  type LegCache,
  type MapProvider,
} from '../src/app/maps/map-provider.ts';
import type { ConfiguredMapProvider, ServerConfig } from './config.ts';

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
