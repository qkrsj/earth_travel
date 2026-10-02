import {
  pgTable, uuid, text, integer, doublePrecision, timestamp, date, primaryKey, index, pgEnum, serial,
} from 'drizzle-orm/pg-core';

export const visibilityEnum = pgEnum('visibility', ['public', 'private']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  nickname: text('nickname').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** 도시 마스터 데이터 (GeoNames 기반 시드) */
export const cities = pgTable('cities', {
  id: integer('id').primaryKey(), // GeoNames id
  name: text('name').notNull(),
  countryCode: text('country_code').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  population: integer('population').notNull().default(0),
}, (t) => [index('cities_country_idx').on(t.countryCode)]);

/** 사용자가 방문한 나라 + 방문 횟수 (지구본 색상 결정) */
export const countryVisits = pgTable('country_visits', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  countryCode: text('country_code').notNull(),
  visitCount: integer('visit_count').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.countryCode] })]);

/** 사용자가 방문 체크한 도시 + 사용자가 지정한 색 */
export const cityVisits = pgTable('city_visits', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cityId: integer('city_id').notNull().references(() => cities.id, { onDelete: 'cascade' }),
  countryCode: text('country_code').notNull(),
  color: text('color').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.cityId] }),
  index('city_visits_user_country_idx').on(t.userId, t.countryCode),
]);

/** 도시별 여행 기록 (일기/메모 + 코스 + 사진) */
export const records = pgTable('records', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  cityId: integer('city_id').notNull().references(() => cities.id),
  countryCode: text('country_code').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  tripStart: date('trip_start'),
  tripEnd: date('trip_end'),
  visibility: visibilityEnum('visibility').notNull().default('private'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('records_user_city_idx').on(t.userId, t.cityId),
  index('records_public_city_idx').on(t.visibility, t.cityId, t.createdAt),
  index('records_public_country_idx').on(t.visibility, t.countryCode, t.createdAt),
]);

/** 여행 코스 (순서가 있는 장소 목록) */
export const recordStops = pgTable('record_stops', {
  id: serial('id').primaryKey(),
  recordId: uuid('record_id').notNull().references(() => records.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  day: integer('day'),
  name: text('name').notNull(),
  note: text('note').notNull().default(''),
}, (t) => [index('record_stops_record_idx').on(t.recordId)]);

export const recordPhotos = pgTable('record_photos', {
  id: serial('id').primaryKey(),
  recordId: uuid('record_id').notNull().references(() => records.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  url: text('url').notNull(),
  storageKey: text('storage_key').notNull(),
  caption: text('caption').notNull().default(''),
}, (t) => [index('record_photos_record_idx').on(t.recordId)]);
