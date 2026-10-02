/**
 * GeoNames(all-the-cities) 데이터로 도시 마스터 테이블을 채움.
 * 나라별 인구 상위 30개 + 인구 5만 이상 + 수도/주도 를 포함 (약 1.3만개).
 */
import { createRequire } from 'node:module';
import { sql } from 'drizzle-orm';
import { loadConfig } from '../src/config.js';
import { createDb } from '../src/db/index.js';
import { cities } from '../src/db/schema.js';

interface RawCity {
  cityId: number; name: string; country: string; featureCode: string; population: number;
  loc: { coordinates: [number, number] };
}

export function selectCities(all: RawCity[]) {
  const byCountry = new Map<string, RawCity[]>();
  for (const c of all) {
    const list = byCountry.get(c.country) ?? [];
    list.push(c);
    byCountry.set(c.country, list);
  }
  const selected: (typeof cities.$inferInsert)[] = [];
  for (const list of byCountry.values()) {
    list.sort((a, b) => b.population - a.population);
    list.forEach((c, i) => {
      if (i < 30 || c.population >= 50000 || c.featureCode === 'PPLC' || c.featureCode === 'PPLA') {
        selected.push({
          id: c.cityId, name: c.name, countryCode: c.country,
          lng: c.loc.coordinates[0], lat: c.loc.coordinates[1], population: c.population,
        });
      }
    });
  }
  return selected;
}

const require = createRequire(import.meta.url);
const rows = selectCities(require('all-the-cities'));
const { db, client } = createDb(loadConfig().DATABASE_URL);
for (let i = 0; i < rows.length; i += 1000) {
  await db.insert(cities).values(rows.slice(i, i + 1000)).onConflictDoUpdate({
    target: cities.id,
    set: {
      name: sql`excluded.name`, countryCode: sql`excluded.country_code`,
      lat: sql`excluded.lat`, lng: sql`excluded.lng`, population: sql`excluded.population`,
    },
  });
}
console.log(`seeded ${rows.length} cities`);
await client.end();
