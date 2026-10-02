import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup, signup, uploadPng, type Ctx } from './helpers.js';

let ctx: Ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await ctx?.close(); });

describe('auth', () => {
  it('회원가입 / 로그인 / 내 정보', async () => {
    const { app } = ctx;
    const { auth } = await signup(app, 'a@example.com', '앨리스');
    const dup = await app.inject({ method: 'POST', url: '/auth/signup', payload: { email: 'A@example.com', password: 'password123', nickname: 'x' } });
    expect(dup.statusCode).toBe(409);

    const bad = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'a@example.com', password: 'nope' } });
    expect(bad.statusCode).toBe(401);
    const ok = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'a@example.com', password: 'password123' } });
    expect(ok.statusCode).toBe(200);

    const me = await app.inject({ method: 'GET', url: '/me', headers: auth });
    expect(me.json().user.nickname).toBe('앨리스');
    expect((await app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
  });
});

describe('geo', () => {
  it('국가 경계 GeoJSON 에 ISO 코드와 한국어 이름이 있다', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/geo/countries' });
    const fc = res.json();
    expect(fc.features.length).toBeGreaterThan(150);
    const kr = fc.features.find((f: any) => f.properties.code === 'KR');
    expect(kr.properties.nameKo).toBe('대한민국');

    const one = await ctx.app.inject({ method: 'GET', url: '/geo/countries/kr' });
    expect(one.json().features[0].properties.code).toBe('KR');
    expect((await ctx.app.inject({ method: 'GET', url: '/geo/countries/ZZ' })).statusCode).toBe(404);
  });

  it('나라별 도시 목록은 인구순', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/countries/KR/cities' });
    expect(res.json().cities.map((c: any) => c.name)).toEqual(['Seoul', 'Busan']);
  });
});

describe('visits', () => {
  it('나라 방문 횟수와 도시 색상을 저장한다', async () => {
    const { app } = ctx;
    const { auth } = await signup(app, 'v@example.com');

    expect((await app.inject({ method: 'PUT', url: '/me/countries/JP', headers: auth, payload: { visitCount: 3 } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: '/me/countries/ZZ', headers: auth, payload: { visitCount: 1 } })).statusCode).toBe(404);

    // 도시를 체크하면 나라도 자동으로 방문 처리
    const put = await app.inject({ method: 'PUT', url: '/me/cities/1838524', headers: auth, payload: { color: '#ff8800' } });
    expect(put.statusCode).toBe(200);
    const badColor = await app.inject({ method: 'PUT', url: '/me/cities/1838524', headers: auth, payload: { color: 'red' } });
    expect(badColor.statusCode).toBe(400);

    const countries = (await app.inject({ method: 'GET', url: '/me/countries', headers: auth })).json().countries;
    expect(countries).toEqual(expect.arrayContaining([
      { countryCode: 'JP', visitCount: 3, cityCount: 0 },
      { countryCode: 'KR', visitCount: 1, cityCount: 1 },
    ]));

    const cities = (await app.inject({ method: 'GET', url: '/me/countries/KR/cities', headers: auth })).json().visits;
    expect(cities).toEqual([{ cityId: 1838524, color: '#ff8800' }]);

    expect((await app.inject({ method: 'DELETE', url: '/me/cities/1838524', headers: auth })).statusCode).toBe(204);
    await app.inject({ method: 'PUT', url: '/me/countries/JP', headers: auth, payload: { visitCount: 0 } });
    const after = (await app.inject({ method: 'GET', url: '/me/countries', headers: auth })).json().countries;
    expect(after).toEqual([{ countryCode: 'KR', visitCount: 1, cityCount: 0 }]);
  });
});

describe('records', () => {
  it('기록 작성 / 공개 범위 / 수정 / 삭제', async () => {
    const { app } = ctx;
    const owner = await signup(app, 'owner@example.com', '작성자');
    const other = await signup(app, 'other@example.com', '구경꾼');

    const up = await uploadPng(app, owner.auth);
    expect(up.statusCode).toBe(201);
    const { key, url } = up.json();
    expect(url).toBe(`http://test.local/uploads/${key}`);
    const served = await app.inject({ method: 'GET', url: `/uploads/${key}` });
    expect(served.statusCode).toBe(200);

    const create = await app.inject({
      method: 'POST', url: '/records', headers: owner.auth,
      payload: {
        cityId: 1850147, title: '도쿄 3박 4일', content: '라멘 최고', tripStart: '2026-03-01', tripEnd: '2026-03-04',
        visibility: 'private',
        stops: [{ name: '시부야', day: 1 }, { name: '아사쿠사', note: '센소지', day: 2 }],
        photos: [{ storageKey: key, caption: '야경' }],
      },
    });
    expect(create.statusCode).toBe(201);
    const rec = create.json().record;
    expect(rec.stops.map((s: any) => s.name)).toEqual(['시부야', '아사쿠사']);
    expect(rec.photos[0].url).toBe(url);
    expect(rec.city.name).toBe('Tokyo');

    // 임의 URL 은 첨부 불가
    const evil = await app.inject({
      method: 'POST', url: '/records', headers: owner.auth,
      payload: { cityId: 1850147, title: 'x', photos: [{ storageKey: 'https://evil.example/x.png' }] },
    });
    expect(evil.statusCode).toBe(400);

    // 비공개: 다른 사람은 볼 수 없음
    expect((await app.inject({ method: 'GET', url: `/records/${rec.id}`, headers: other.auth })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: `/records/${rec.id}`, headers: owner.auth })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/records/public?cityId=1850147' })).json().records).toHaveLength(0);

    // 기록하면 나라 방문 자동 처리
    const countries = (await app.inject({ method: 'GET', url: '/me/countries', headers: owner.auth })).json().countries;
    expect(countries.map((c: any) => c.countryCode)).toContain('JP');

    // 다른 사람은 수정 불가
    const hijack = await app.inject({ method: 'PATCH', url: `/records/${rec.id}`, headers: other.auth, payload: { title: 'hack' } });
    expect(hijack.statusCode).toBe(404);

    // 공개로 전환 + 사진 제거
    const patch = await app.inject({
      method: 'PATCH', url: `/records/${rec.id}`, headers: owner.auth,
      payload: { title: '도쿄 여행', content: '라멘', visibility: 'public', stops: [{ name: '시부야' }], photos: [] },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().record.photos).toHaveLength(0);
    expect((await app.inject({ method: 'GET', url: `/uploads/${key}` })).statusCode).toBe(404);

    const feed = (await app.inject({ method: 'GET', url: '/records/public?countryCode=jp' })).json();
    expect(feed.records).toHaveLength(1);
    expect(feed.records[0]).toMatchObject({ title: '도쿄 여행', cityName: 'Tokyo', author: { nickname: '작성자' } });
    expect((await app.inject({ method: 'GET', url: `/records/${rec.id}` })).statusCode).toBe(200);

    const stats = (await app.inject({ method: 'GET', url: '/cities/1850147/stats', headers: owner.auth })).json();
    expect(stats).toEqual({ publicCount: 1, mineCount: 1 });

    expect((await app.inject({ method: 'DELETE', url: `/records/${rec.id}`, headers: other.auth })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/records/${rec.id}`, headers: owner.auth })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/records/${rec.id}`, headers: owner.auth })).statusCode).toBe(404);
  });

  it('커서 페이지네이션', async () => {
    const { app } = ctx;
    const u = await signup(app, 'pager@example.com');
    for (let i = 0; i < 5; i++) {
      await app.inject({ method: 'POST', url: '/records', headers: u.auth, payload: { cityId: 1835848, title: `기록 ${i}` } });
    }
    const p1 = (await app.inject({ method: 'GET', url: '/me/records?limit=3', headers: u.auth })).json();
    expect(p1.records.map((r: any) => r.title)).toEqual(['기록 4', '기록 3', '기록 2']);
    const p2 = (await app.inject({ method: 'GET', url: `/me/records?limit=3&cursor=${p1.nextCursor}`, headers: u.auth })).json();
    expect(p2.records.map((r: any) => r.title)).toEqual(['기록 1', '기록 0']);
    expect(p2.nextCursor).toBeNull();
  });

  it('이미지가 아닌 파일 업로드 거부', async () => {
    const { app } = ctx;
    const u = await signup(app, 'up@example.com');
    const boundary = '----x';
    const res = await app.inject({
      method: 'POST', url: '/uploads', headers: { ...u.auth, 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--${boundary}--\r\n`,
    });
    expect(res.statusCode).toBe(415);
  });
});

describe('globe page', () => {
  it('지구본 페이지와 자산을 서빙한다', async () => {
    const page = await ctx.app.inject({ method: 'GET', url: '/globe/' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('globe.gl.min.js');
    expect((await ctx.app.inject({ method: 'GET', url: '/globe/earth-blue-marble.jpg' })).statusCode).toBe(200);
    expect((await ctx.app.inject({ method: 'GET', url: '/globe/../package.json' })).statusCode).toBe(404);
  });
});
