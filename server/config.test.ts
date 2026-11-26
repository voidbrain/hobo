import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.ts';

const SERVER_DIR = dirname(fileURLToPath(import.meta.url));

describe('server config', () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'hobo-config-'))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('uses local defaults without a config file', () => {
    assert.deepEqual(loadConfig(dir, {}), {
      host: '127.0.0.1',
      port: 4310,
      dataDir: join(dir, 'data'),
      mapProvider: 'openrouteservice',
      openRouteServiceApiKey: null,
      openRouteServiceBaseUrl: 'https://api.openrouteservice.org',
      openRouteServiceTimeoutMs: 10_000,
      legCacheMaxAgeDays: 30,
    });
  });

  it('reads config.local.json (including provider and key), then the environment', () => {
    writeFileSync(
      join(dir, 'config.local.json'),
      JSON.stringify({
        port: 5000,
        dataDir: 'elsewhere',
        mapProvider: 'openrouteservice',
        openRouteServiceApiKey: '  test-ors-local-key  ',
        openRouteServiceBaseUrl: 'https://ors.example.test/',
      }),
    );
    assert.deepEqual(loadConfig(dir, {}), {
      host: '127.0.0.1',
      port: 5000,
      dataDir: join(dir, 'elsewhere'),
      mapProvider: 'openrouteservice',
      openRouteServiceApiKey: 'test-ors-local-key',
      openRouteServiceBaseUrl: 'https://ors.example.test',
      openRouteServiceTimeoutMs: 10_000,
      legCacheMaxAgeDays: 30,
    });
    assert.deepEqual(
      loadConfig(dir, {
        HOBO_PORT: '6000',
        HOBO_DATA_DIR: '/tmp/hobo-x',
        HOBO_ORS_API_KEY: 'env-override-key',
        HOBO_ORS_BASE_URL: 'http://127.0.0.1:8080/',
        HOBO_LEG_CACHE_MAX_AGE_DAYS: '7',
        HOBO_ORS_TIMEOUT_MS: '2500',
      }),
      {
        host: '127.0.0.1',
        port: 6000,
        dataDir: '/tmp/hobo-x',
        mapProvider: 'openrouteservice',
        openRouteServiceApiKey: 'env-override-key',
        openRouteServiceBaseUrl: 'http://127.0.0.1:8080',
        openRouteServiceTimeoutMs: 2_500,
        legCacheMaxAgeDays: 7,
      },
    );
  });

  it('treats blank keys as null and ships config.example.json without keys', () => {
    const exampleText = readFileSync(join(SERVER_DIR, 'config.example.json'), 'utf8');
    const example = JSON.parse(exampleText) as Record<string, unknown>;
    assert.equal(example['mapProvider'], 'openrouteservice');
    assert.equal(example['openRouteServiceApiKey'], '');

    writeFileSync(join(dir, 'config.local.json'), exampleText);
    const loaded = loadConfig(dir, {});
    assert.equal(loaded.mapProvider, 'openrouteservice');
    assert.equal(loaded.openRouteServiceApiKey, null);
  });

  it('refuses invalid settings and unknown providers', () => {
    assert.throws(() => loadConfig(dir, { HOBO_PORT: 'eighty' }), /port/);
    assert.throws(() => loadConfig(dir, { HOBO_MAP_PROVIDER: 'mapbox' }), /mapProvider/);
    assert.throws(
      () => loadConfig(dir, { HOBO_ORS_TIMEOUT_MS: 'soon' }),
      /openRouteServiceTimeoutMs/,
    );
    assert.throws(
      () => loadConfig(dir, { HOBO_LEG_CACHE_MAX_AGE_DAYS: '0' }),
      /legCacheMaxAgeDays/,
    );
    assert.throws(
      () => loadConfig(dir, { HOBO_ORS_BASE_URL: 'ftp://ors.example.test' }),
      /openRouteServiceBaseUrl/,
    );
    writeFileSync(join(dir, 'config.local.json'), JSON.stringify({ openRouteServiceApiKey: 123 }));
    assert.throws(() => loadConfig(dir, {}), /openRouteServiceApiKey/);
    writeFileSync(join(dir, 'config.local.json'), JSON.stringify({ colour: 'red' }));
    assert.throws(() => loadConfig(dir, {}), /colour/);
    writeFileSync(join(dir, 'config.local.json'), '{nope');
    assert.throws(() => loadConfig(dir, {}), /config.local.json/);
  });
});
