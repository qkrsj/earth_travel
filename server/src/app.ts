import path from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import type { Config } from './config.js';
import type { Db } from './db/index.js';
import type { Storage } from './storage/index.js';
import { registerAuth } from './lib/auth.js';
import { HttpError } from './lib/http.js';
import authRoutes from './routes/auth.js';
import geoRoutes from './routes/geo.js';
import visitRoutes from './routes/visits.js';
import recordRoutes from './routes/records.js';
import uploadRoutes from './routes/uploads.js';
import globeRoutes from './routes/globe.js';

export interface AppDeps { config: Config; db: Db; storage: Storage; logger?: boolean }

declare module 'fastify' {
  interface FastifyInstance {
    deps: AppDeps;
  }
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function buildApp(deps: AppDeps) {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 2 * 1024 * 1024 });
  app.decorate('deps', deps);

  await app.register(cors, { origin: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  await app.register(jwt, { secret: deps.config.JWT_SECRET, sign: { expiresIn: '30d' } });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
  if (deps.config.STORAGE_DRIVER === 'local') {
    await app.register(fastifyStatic, {
      root: path.resolve(deps.config.UPLOAD_DIR),
      prefix: '/uploads/',
      decorateReply: false,
    });
  }
  registerAuth(app);

  app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.statusCode).send({ error: err.message });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: err.message });
    req.log.error(err);
    return reply.status(500).send({ error: '서버 오류가 발생했습니다' });
  });

  app.get('/health', async () => ({ ok: true }));
  await app.register(authRoutes);
  await app.register(geoRoutes);
  await app.register(visitRoutes);
  await app.register(recordRoutes);
  await app.register(uploadRoutes);
  await app.register(globeRoutes);
  return app;
}
