import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';
import { cities } from '../db/schema.js';
import { getCountries, getCountry } from '../geo/countries.js';
import { notFound, parse } from '../lib/http.js';

export default async function geoRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  // 지구본용 전 세계 국가 경계 (GeoJSON)
  app.get('/geo/countries', async (req, reply) => {
    const { resolution } = parse(z.object({ resolution: z.enum(['110m', '50m']).default('110m') }), req.query);
    reply.header('Cache-Control', 'public, max-age=86400');
    return getCountries(resolution);
  });

  // 한 나라의 상세 경계
  app.get('/geo/countries/:code', async (req, reply) => {
    const { code } = parse(z.object({ code: z.string().length(2) }), req.params);
    const fc = getCountry(code);
    if (!fc) throw notFound('나라');
    reply.header('Cache-Control', 'public, max-age=86400');
    return fc;
  });

  // 한 나라의 도시 목록 (인구순)
  app.get('/countries/:code/cities', async (req) => {
    const { code } = parse(z.object({ code: z.string().length(2) }), req.params);
    const { q } = parse(z.object({ q: z.string().trim().max(50).optional() }), req.query);
    const where = q
      ? and(eq(cities.countryCode, code.toUpperCase()), ilike(cities.name, `%${q}%`))
      : eq(cities.countryCode, code.toUpperCase());
    const rows = await db.select().from(cities).where(where)
      .orderBy(desc(cities.population), asc(cities.name));
    return { cities: rows };
  });

  app.get('/cities/:id', async (req) => {
    const { id } = parse(z.object({ id: z.coerce.number().int() }), req.params);
    const city = await db.query.cities.findFirst({ where: eq(cities.id, id) });
    if (!city) throw notFound('도시');
    return { city };
  });
}
