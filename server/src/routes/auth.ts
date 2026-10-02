import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '../db/schema.js';
import { HttpError, parse } from '../lib/http.js';
import { requireUser } from '../lib/auth.js';

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다').max(100),
  nickname: z.string().trim().min(1).max(30),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
});

export default async function authRoutes(app: FastifyInstance) {
  const { db } = app.deps;
  const publicUser = (u: typeof users.$inferSelect) => ({ id: u.id, email: u.email, nickname: u.nickname });

  app.post('/auth/signup', async (req, reply) => {
    const body = parse(signupSchema, req.body);
    const existing = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (existing) throw new HttpError(409, '이미 가입된 이메일입니다');
    const passwordHash = await bcrypt.hash(body.password, 10);
    const [user] = await db.insert(users).values({ email: body.email, passwordHash, nickname: body.nickname }).returning();
    const token = app.jwt.sign({ sub: user.id });
    return reply.status(201).send({ token, user: publicUser(user) });
  });

  app.post('/auth/login', async (req) => {
    const body = parse(loginSchema, req.body);
    const user = await db.query.users.findFirst({ where: eq(users.email, body.email) });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new HttpError(401, '이메일 또는 비밀번호가 올바르지 않습니다');
    }
    return { token: app.jwt.sign({ sub: user.id }), user: publicUser(user) };
  });

  app.get('/me', async (req) => {
    const userId = requireUser(req);
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new HttpError(401, '사용자를 찾을 수 없습니다');
    return { user: publicUser(user) };
  });
}
