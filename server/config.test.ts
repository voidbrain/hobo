import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { loadConfig } from './config.ts';

describe('server config', () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), 'hobo-config-'))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('uses local defaults without a config file', () => {
    assert.deepEqual(loadConfig(dir, {}), {
      host: '127.0.0.1',
      port: 4310,
      dataDir: join(dir, 'data'),
    });
  });

  it('reads config.local.json, then the environment', () => {
    writeFileSync(
      join(dir, 'config.local.json'),
      JSON.stringify({ port: 5000, dataDir: 'elsewhere' }),
    );
    assert.deepEqual(loadConfig(dir, {}), {
      host: '127.0.0.1',
      port: 5000,
      dataDir: join(dir, 'elsewhere'),
    });
    assert.deepEqual(loadConfig(dir, { HOBO_PORT: '6000', HOBO_DATA_DIR: '/tmp/hobo-x' }), {
      host: '127.0.0.1',
      port: 6000,
      dataDir: '/tmp/hobo-x',
    });
  });

  it('refuses invalid settings', () => {
    assert.throws(() => loadConfig(dir, { HOBO_PORT: 'eighty' }), /port/);
    writeFileSync(join(dir, 'config.local.json'), JSON.stringify({ colour: 'red' }));
    assert.throws(() => loadConfig(dir, {}), /colour/);
    writeFileSync(join(dir, 'config.local.json'), '{nope');
    assert.throws(() => loadConfig(dir, {}), /config.local.json/);
  });
});
