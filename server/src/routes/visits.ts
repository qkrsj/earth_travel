import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { cities, cityVisits, countryVisits } from '../db/schema.js';
import { requireUser } from '../lib/auth.js';
import { HttpError, notFound, parse } from '../lib/http.js';
import { isKnownCountry } from '../geo/countries.js';
import type { Db } from '../db/index.js';

export const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const codeParams = z.object({ code: z.string().length(2).transform((s) => s.toUpperCase()) });
const cityParams = z.object({ cityId: z.coerce.number().int() });

/** 도시를 방문/기록하면 해당 나라도 최소 1회 방문으로 표시 */
export async function ensureCountryVisited(db: Db, userId: string, countryCode: string) {
  await db.insert(countryVisits).values({ userId, countryCode, visitCount: 1 }).onConflictDoNothing();
}

export default async function visitRoutes(app: FastifyInstance) {
  const { db } = app.deps;

  // 내가 방문한 나라 목록 (지구본 색칠용) + 나라별 방문 도시 수
  app.get('/me/countries', async (req) => {
    const userId = requireUser(req);
    const visits = await db.select().from(countryVisits).where(eq(countryVisits.userId, userId));
    const cityCounts = await db
      .select({ countryCode: cityVisits.countryCode, count: sql<number>`count(*)::int` })
      .from(cityVisits).where(eq(cityVisits.userId, userId)).groupBy(cityVisits.countryCode);
    const countMap = new Map(cityCounts.map((c) => [c.countryCode, c.count]));
    return {
      countries: visits.map((v) => ({
        countryCode: v.countryCode,
        visitCount: v.visitCount,
        cityCount: countMap.get(v.countryCode) ?? 0,
      })),
    };
  });

  // 나라 방문 횟수 설정 (0 이면 방문 해제)
  app.put('/me/countries/:code', async (req) => {
    const userId = requireUser(req);
    const { code } = parse(codeParams, req.params);
    const { visitCount } = parse(z.object({ visitCount: z.number().int().min(0).max(999) }), req.body);
    if (!isKnownCountry(code)) throw notFound('나라');

    if (visitCount === 0) {
      await db.delete(countryVisits).where(and(eq(countryVisits.userId, userId), eq(countryVisits.countryCode, code)));
      return { countryCode: code, visitCount: 0 };
    }
    await db.insert(countryVisits).values({ userId, countryCode: code, visitCount })
      .onConflictDoUpdate({
        target: [countryVisits.userId, countryVisits.countryCode],
        set: { visitCount, updatedAt: new Date() },
      });
    return { countryCode: code, visitCount };
  });

  // 한 나라에서 내가 방문한 도시들 (도시 색상 포함)
  app.get('/me/countries/:code/cities', async (req) => {
    const userId = requireUser(req);
    const { code } = parse(codeParams, req.params);
    const rows = await db.select({ cityId: cityVisits.cityId, color: cityVisits.color })
      .from(cityVisits)
      .where(and(eq(cityVisits.userId, userId), eq(cityVisits.countryCode, code)));
    return { visits: rows };
  });

  // 도시 방문 체크 + 색 지정
  app.put('/me/cities/:cityId', async (req) => {
    const userId = requireUser(req);
    const { cityId } = parse(cityParams, req.params);
    const { color } = parse(z.object({ color: z.string().regex(COLOR_RE, '색상은 #RRGGBB 형식이어야 합니다') }), req.body);
    const city = await db.query.cities.findFirst({ where: eq(cities.id, cityId) });
    if (!city) throw notFound('도시');

    await db.insert(cityVisits).values({ userId, cityId, countryCode: city.countryCode, color })
      .onConflictDoUpdate({ target: [cityVisits.userId, cityVisits.cityId], set: { color } });
    await ensureCountryVisited(db, userId, city.countryCode);
    return { cityId, color };
  });

  app.delete('/me/cities/:cityId', async (req, reply) => {
    const userId = requireUser(req);
    const { cityId } = parse(cityParams, req.params);
    const res = await db.delete(cityVisits)
      .where(and(eq(cityVisits.userId, userId), eq(cityVisits.cityId, cityId))).returning();
    if (res.length === 0) throw new HttpError(404, '방문 기록이 없습니다');
    return reply.status(204).send();
  });
}
