import type { FastifyInstance, FastifyRequest } from 'fastify';
import { HttpError } from './http.js';

export interface TokenPayload { sub: string }

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

/** 로그인 필수 */
export function requireUser(req: FastifyRequest): string {
  if (!req.userId) throw new HttpError(401, '로그인이 필요합니다');
  return req.userId;
}

declare module 'fastify' {
  interface FastifyRequest {
    userId: string | null;
  }
}

/** Authorization 헤더가 있으면 검증해서 req.userId 를 채움 (없으면 null) */
export function registerAuth(app: FastifyInstance) {
  app.decorateRequest('userId', null);
  app.addHook('onRequest', async (req) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return;
    try {
      const payload = await req.jwtVerify<TokenPayload>();
      req.userId = payload.sub;
    } catch {
      throw new HttpError(401, '토큰이 유효하지 않습니다');
    }
  });
}
