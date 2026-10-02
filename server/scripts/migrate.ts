import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/index.js';

const { db, client } = createDb(loadConfig().DATABASE_URL);
await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
console.log('migrations applied');
await client.end();
