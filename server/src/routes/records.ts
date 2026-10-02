import type { FastifyInstance } from 'fastify';
import { and, asc, desc, eq, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { cities, recordPhotos, records, recordStops, users } from '../db/schema.js';
import { requireUser } from '../lib/auth.js';
import { HttpError, notFound, parse } from '../lib/http.js';
import { STORAGE_KEY_RE } from '../storage/index.js';
import { ensureCountryVisited } from './visits.js';
import type { Db } from '../db/index.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다');

const recordBody = z.object({
  title: z.string().trim().min(1, '제목을 입력하세요').max(100),
  content: z.string().max(20000).default(''),
  tripStart: dateStr.nullish(),
  tripEnd: dateStr.nullish(),
  visibility: z.enum(['public', 'private']).default('private'),
  stops: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    note: z.string().max(1000).default(''),
    day: z.number().int().min(1).max(365).nullish(),
  })).max(100).default([]),
  photos: z.array(z.object({
    storageKey: z.string().regex(STORAGE_KEY_RE, '업로드된 사진만 첨부할 수 있습니다'),
    caption: z.string().max(500).default(''),
  })).max(50).default([]),
});

const createBody = recordBody.extend({ cityId: z.number().int() });
const idParams = z.object({ id: z.uuid() });

const listQuery = z.object({
  cityId: z.coerce.number().int().optional(),
  countryCode: z.string().length(2).transform((s) => s.toUpperCase()).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // 페이지네이션 커서: 이전 페이지 마지막 항목의 nextCursor
  cursor: z.string().optional(),
});

type RecordRow = typeof records.$inferSelect;

function encodeCursor(r: RecordRow) {
  return Buffer.from(`${r.createdAt.toISOString()}|${r.id}`).toString('base64url');
}

function cursorCondition(cursor?: string): SQL | undefined {
  if (!cursor) return undefined;
  const [iso, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const at = new Date(iso);
  if (Number.isNaN(at.getTime()) || !id) throw new HttpError(400, '잘못된 커서입니다');
  return or(lt(records.createdAt, at), and(eq(records.createdAt, at), lt(records.id, id)));
}

/** 목록용 요약 정보 */
async function summarize(db: Db, rows: RecordRow[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [photos, authors, cityRows] = await Promise.all([
    db.select().from(recordPhotos).where(inArray(recordPhotos.recordId, ids)).orderBy(asc(recordPhotos.position)),
    db.select({ id: users.id, nickname: users.nickname }).from(users)
      .where(inArray(users.id, [...new Set(rows.map((r) => r.userId))])),
    db.select({ id: cities.id, name: cities.name }).from(cities)
      .where(inArray(cities.id, [...new Set(rows.map((r) => r.cityId))])),
  ]);
  const authorMap = new Map(authors.map((a) => [a.id, a.nickname]));
  const cityMap = new Map(cityRows.map((c) => [c.id, c.name]));
  return rows.map((r) => {
    const own = photos.filter((p) => p.recordId === r.id);
    return {
      id: r.id,
      title: r.title,
      excerpt: r.content.slice(0, 120),
      cityId: r.cityId,
      cityName: cityMap.get(r.cityId) ?? '',
      countryCode: r.countryCode,
      tripStart: r.tripStart,
      tripEnd: r.tripEnd,
      visibility: r.visibility,
      coverUrl: own[0]?.url ?? null,
      photoCount: own.length,
      author: { id: r.userId, nickname: authorMap.get(r.userId) ?? '' },
      createdAt: r.createdAt,
    };
  });
}

async function paginate(db: Db, where: SQL | undefined, limit: number) {
  const rows = await db.select().from(records).where(where)
    .orderBy(desc(records.createdAt), desc(records.id)).limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    records: await summarize(db, page),
    nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null,
  };
}

async function loadDetail(db: Db, record: RecordRow) {
  const [stops, photos, author, city] = await Promise.all([
    db.select().from(recordStops).where(eq(recordStops.recordId, record.id)).orderBy(asc(recordStops.position)),
    db.select().from(recordPhotos).where(eq(recordPhotos.recordId, record.id)).orderBy(asc(recordPhotos.position)),
    db.query.users.findFirst({ where: eq(users.id, record.userId) }),
    db.query.cities.findFirst({ where: eq(cities.id, record.cityId) }),
  ]);
  return {
    ...record,
    city: city && { id: city.id, name: city.name, countryCode: city.countryCode, lat: city.lat, lng: city.lng },
    author: { id: record.userId, nickname: author?.nickname ?? '' },
    stops: stops.map(({ id, position, day, name, note }) => ({ id, position, day, name, note })),
    photos: photos.map(({ id, position, url, storageKey, caption }) => ({ id, position, url, storageKey, caption })),
  };
}

export default async function recordRoutes(app: FastifyInstance) {
  const { db, storage } = app.deps;

  async function writeChildren(tx: Db, recordId: string, body: z.infer<typeof recordBody>) {
    await tx.delete(recordStops).where(eq(recordStops.recordId, recordId));
    await tx.delete(recordPhotos).where(eq(recordPhotos.recordId, recordId));
    if (body.stops.length) {
      await tx.insert(recordStops).values(body.stops.map((s, i) => ({
        recordId, position: i, name: s.name, note: s.note, day: s.day ?? null,
      })));
    }
    if (body.photos.length) {
      await tx.insert(recordPhotos).values(body.photos.map((p, i) => ({
        recordId, position: i, storageKey: p.storageKey, url: storage.urlFor(p.storageKey), caption: p.caption,
      })));
    }
  }

  async function findOwned(id: string, userId: string) {
    const record = await db.query.records.findFirst({ where: eq(records.id, id) });
    if (!record || record.userId !== userId) throw notFound('기록');
    return record;
  }

  // 공개 피드 (다른 사람들의 공개 기록 참고)
  app.get('/records/public', async (req) => {
    const q = parse(listQuery, req.query);
    const where = and(
      eq(records.visibility, 'public'),
      q.cityId ? eq(records.cityId, q.cityId) : undefined,
      q.countryCode ? eq(records.countryCode, q.countryCode) : undefined,
      cursorCondition(q.cursor),
    );
    return paginate(db, where, q.limit);
  });

  // 내 기록 목록
  app.get('/me/records', async (req) => {
    const userId = requireUser(req);
    const q = parse(listQuery, req.query);
    const where = and(
      eq(records.userId, userId),
      q.cityId ? eq(records.cityId, q.cityId) : undefined,
      q.countryCode ? eq(records.countryCode, q.countryCode) : undefined,
      cursorCondition(q.cursor),
    );
    return paginate(db, where, q.limit);
  });

  // 도시별 공개 기록 수 / 내 기록 수
  app.get('/cities/:id/stats', async (req) => {
    const { id } = parse(z.object({ id: z.coerce.number().int() }), req.params);
    const [row] = await db.select({
      publicCount: sql<number>`count(*) filter (where ${records.visibility} = 'public')::int`,
      mineCount: req.userId
        ? sql<number>`count(*) filter (where ${records.userId} = ${req.userId})::int`
        : sql<number>`0`,
    }).from(records).where(eq(records.cityId, id));
    return row;
  });

  app.get('/records/:id', async (req) => {
    const { id } = parse(idParams, req.params);
    const record = await db.query.records.findFirst({ where: eq(records.id, id) });
    if (!record || (record.visibility === 'private' && record.userId !== req.userId)) throw notFound('기록');
    return { record: await loadDetail(db, record) };
  });

  app.post('/records', async (req, reply) => {
    const userId = requireUser(req);
    const body = parse(createBody, req.body);
    const city = await db.query.cities.findFirst({ where: eq(cities.id, body.cityId) });
    if (!city) throw notFound('도시');

    const record = await db.transaction(async (tx) => {
      const [created] = await tx.insert(records).values({
        userId, cityId: city.id, countryCode: city.countryCode,
        title: body.title, content: body.content,
        tripStart: body.tripStart ?? null, tripEnd: body.tripEnd ?? null, visibility: body.visibility,
      }).returning();
      await writeChildren(tx as unknown as Db, created.id, body);
      return created;
    });
    await ensureCountryVisited(db, userId, city.countryCode);
    return reply.status(201).send({ record: await loadDetail(db, record) });
  });

  app.patch('/records/:id', async (req) => {
    const userId = requireUser(req);
    const { id } = parse(idParams, req.params);
    await findOwned(id, userId);
    const body = parse(recordBody, req.body);

    const oldPhotos = await db.select().from(recordPhotos).where(eq(recordPhotos.recordId, id));
    const record = await db.transaction(async (tx) => {
      const [updated] = await tx.update(records).set({
        title: body.title, content: body.content,
        tripStart: body.tripStart ?? null, tripEnd: body.tripEnd ?? null,
        visibility: body.visibility, updatedAt: new Date(),
      }).where(eq(records.id, id)).returning();
      await writeChildren(tx as unknown as Db, id, body);
      return updated;
    });
    // 기록에서 빠진 사진은 저장소에서도 삭제
    const keep = new Set(body.photos.map((p) => p.storageKey));
    await Promise.all(oldPhotos.filter((p) => !keep.has(p.storageKey)).map((p) => storage.remove(p.storageKey)));
    return { record: await loadDetail(db, record) };
  });

  app.delete('/records/:id', async (req, reply) => {
    const userId = requireUser(req);
    const { id } = parse(idParams, req.params);
    await findOwned(id, userId);
    const photos = await db.select().from(recordPhotos).where(eq(recordPhotos.recordId, id));
    await db.delete(records).where(eq(records.id, id));
    await Promise.all(photos.map((p) => storage.remove(p.storageKey)));
    return reply.status(204).send();
  });
}
