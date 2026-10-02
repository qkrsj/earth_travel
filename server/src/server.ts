import { loadConfig } from './config.js';
import { createDb } from './db/index.js';
import { createStorage } from './storage/index.js';
import { buildApp } from './app.js';

const config = loadConfig();
const { db } = createDb(config.DATABASE_URL);
const app = await buildApp({ config, db, storage: createStorage(config), logger: true });

await app.listen({ port: config.PORT, host: '0.0.0.0' });
