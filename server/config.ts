import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

/** Where the local service listens and keeps its data. Provider keys join this in F-007. */
export interface ServerConfig {
  host: string;
  port: number;
  dataDir: string;
}

const KEYS = ['host', 'port', 'dataDir'] as const;

/**
 * Defaults, then `config.local.json` in `dir` (git-ignored), then HOBO_HOST, HOBO_PORT and HOBO_DATA_DIR.
 * A relative dataDir is relative to `dir`. The default host keeps the service on this machine.
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
  if (typeof host !== 'string' || !host) throw new Error('host must be a host name');
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('port must be 0 to 65535');
  if (typeof dataDir !== 'string' || !dataDir) throw new Error('dataDir must be a folder');
  return { host, port, dataDir: isAbsolute(dataDir) ? dataDir : join(dir, dataDir) };
}
