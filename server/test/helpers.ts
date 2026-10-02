import path from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/index.js';
import { cities } from '../src/db/schema.js';
import { createStorage } from '../src/storage/index.js';

export const TEST_DB_URL = process.env.TEST_DATABASE_URL ?? 'postgres://earth:earth@localhost:5432/earth_travel_test';

export async function setup() {
  const config = loadConfig({
    DATABASE_URL: TEST_DB_URL,
    JWT_SECRET: 'test-secret-test-secret',
    PUBLIC_BASE_URL: 'http://test.local',
    UPLOAD_DIR: mkdtempSync(path.join(tmpdir(), 'earth-uploads-')),
  });
  const { db, client } = createDb(config.DATABASE_URL);
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, '../drizzle') });
  await db.execute(sql`truncate users, cities, country_visits, city_visits, records, record_stops, record_photos cascade`);
  await db.insert(cities).values([
    { id: 1835848, name: 'Seoul', countryCode: 'KR', lat: 37.566, lng: 126.978, population: 10349312 },
    { id: 1838524, name: 'Busan', countryCode: 'KR', lat: 35.102, lng: 129.040, population: 3678555 },
    { id: 1850147, name: 'Tokyo', countryCode: 'JP', lat: 35.689, lng: 139.692, population: 8336599 },
  ]);
  const app = await buildApp({ config, db, storage: createStorage(config) });
  return { app, db, close: async () => { await app.close(); await client.end(); } };
}

export type Ctx = Awaited<ReturnType<typeof setup>>;

export async function signup(app: Ctx['app'], email: string, nickname = 'traveler') {
  const res = await app.inject({ method: 'POST', url: '/auth/signup', payload: { email, password: 'password123', nickname } });
  if (res.statusCode !== 201) throw new Error(res.body);
  const { token, user } = res.json();
  return { token, user, auth: { authorization: `Bearer ${token}` } };
}

/** 작은 PNG(1x1) 를 multipart 로 업로드 */
export async function uploadPng(app: Ctx['app'], auth: Record<string, string>) {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const boundary = '----earthtest';
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return app.inject({
    method: 'POST', url: '/uploads', payload: body,
    headers: { ...auth, 'content-type': `multipart/form-data; boundary=${boundary}` },
  });
}
