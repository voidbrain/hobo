import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export const SUPPORTED_MAP_PROVIDERS = ['openrouteservice'] as const;
export type ConfiguredMapProvider = (typeof SUPPORTED_MAP_PROVIDERS)[number];

const DEFAULT_ORS_BASE_URL = 'https://api.openrouteservice.org';

/** Where the local service listens, keeps its data, and reads map provider settings (F-007). */
export interface ServerConfig {
  host: string;
  port: number;
  dataDir: string;
  mapProvider: ConfiguredMapProvider;
  openRouteServiceApiKey: string | null;
  openRouteServiceBaseUrl: string;
  /** Milliseconds one OpenRouteService call may take (default 10000). */
  openRouteServiceTimeoutMs: number;
  /** Cached legs older than this are fetched again (default 30). */
  legCacheMaxAgeDays: number;
}

const KEYS = [
  'host',
  'port',
  'dataDir',
  'mapProvider',
  'openRouteServiceApiKey',
  'openRouteServiceBaseUrl',
  'openRouteServiceTimeoutMs',
  'legCacheMaxAgeDays',
] as const;

function parseOptionalSecret(raw: unknown, name: string): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') throw new Error(`${name} must be text or null`);
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseHttpUrl(raw: unknown, name: string): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error(`${name} must be an http or https URL`);
  }
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(`${name} must be an http or https URL`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`${name} must be an http or https URL`);
  }
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Defaults, then `config.local.json` in `dir` (git-ignored), then HOBO_HOST, HOBO_PORT,
 * HOBO_DATA_DIR, HOBO_MAP_PROVIDER, HOBO_ORS_API_KEY, HOBO_ORS_BASE_URL,
 * HOBO_ORS_TIMEOUT_MS and HOBO_LEG_CACHE_MAX_AGE_DAYS.
 * A relative dataDir is relative to `dir`. API keys never leave `server/`.
 */
export function loadConfig(dir: string, env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const file = join(dir, 'config.local.json');
  let local: Record<string, unknown> = {};
  if (existsSync(file)) {
    try {
      local = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    } catch (error) {
      throw new Error(`server/config.local.json is not valid JSON: ${(error as Error).message}`, {
        cause: error,
      });
    }
    const unknown = Object.keys(local).filter((k) => !(KEYS as readonly string[]).includes(k));
    if (unknown.length)
      throw new Error(`server/config.local.json: unknown setting ${unknown.join(', ')}`);
  }
  const host = env['HOBO_HOST'] ?? local['host'] ?? '127.0.0.1';
  const port = Number(env['HOBO_PORT'] ?? local['port'] ?? 4310);
  const dataDir = env['HOBO_DATA_DIR'] ?? local['dataDir'] ?? 'data';
  const rawProvider = env['HOBO_MAP_PROVIDER'] ?? local['mapProvider'] ?? 'openrouteservice';
  const openRouteServiceApiKey = parseOptionalSecret(
    env['HOBO_ORS_API_KEY'] !== undefined
      ? env['HOBO_ORS_API_KEY']
      : local['openRouteServiceApiKey'],
    'openRouteServiceApiKey',
  );
  const openRouteServiceBaseUrl = parseHttpUrl(
    env['HOBO_ORS_BASE_URL'] ?? local['openRouteServiceBaseUrl'] ?? DEFAULT_ORS_BASE_URL,
    'openRouteServiceBaseUrl',
  );
  const openRouteServiceTimeoutMs = Number(
    env['HOBO_ORS_TIMEOUT_MS'] ?? local['openRouteServiceTimeoutMs'] ?? 10_000,
  );
  const legCacheMaxAgeDays = Number(
    env['HOBO_LEG_CACHE_MAX_AGE_DAYS'] ?? local['legCacheMaxAgeDays'] ?? 30,
  );

  if (typeof host !== 'string' || !host) throw new Error('host must be a host name');
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('port must be 0 to 65535');
  if (typeof dataDir !== 'string' || !dataDir) throw new Error('dataDir must be a folder');
  if (!Number.isInteger(openRouteServiceTimeoutMs) || openRouteServiceTimeoutMs < 1)
    throw new Error('openRouteServiceTimeoutMs must be a whole number of milliseconds, at least 1');
  if (!Number.isInteger(legCacheMaxAgeDays) || legCacheMaxAgeDays < 1)
    throw new Error('legCacheMaxAgeDays must be a whole number of days, at least 1');
  if (
    typeof rawProvider !== 'string' ||
    !(SUPPORTED_MAP_PROVIDERS as readonly string[]).includes(rawProvider)
  ) {
    throw new Error(`mapProvider must be one of ${SUPPORTED_MAP_PROVIDERS.join(', ')}`);
  }

  return {
    host,
    port,
    dataDir: isAbsolute(dataDir) ? dataDir : join(dir, dataDir),
    mapProvider: rawProvider as ConfiguredMapProvider,
    openRouteServiceApiKey,
    openRouteServiceBaseUrl,
    openRouteServiceTimeoutMs,
    legCacheMaxAgeDays,
  };
}
