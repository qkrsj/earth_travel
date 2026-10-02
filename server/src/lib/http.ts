import type { ZodType } from 'zod';

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export const notFound = (what = '리소스') => new HttpError(404, `${what}를 찾을 수 없습니다`);

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const msg = r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join(', ');
    throw new HttpError(400, msg);
  }
  return r.data;
}
