// The local service: `npm run server`. Settings in server/config.local.json (git-ignored; see config.example.json).
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './app.ts';
import { loadConfig } from './config.ts';

const config = loadConfig(dirname(fileURLToPath(import.meta.url)));
const server = await startServer(config);
console.log(`Hobo server on ${server.url}, data in ${config.dataDir}`);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => void server.close().then(() => process.exit(0)));
