import type { FastifyInstance } from 'fastify';
import { requireUser } from '../lib/auth.js';
import { HttpError } from '../lib/http.js';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

export default async function uploadRoutes(app: FastifyInstance) {
  const { storage } = app.deps;

  // 사진 업로드 → { key, url } 반환. 기록 저장 시 key 를 photos[].storageKey 로 전달
  app.post('/uploads', async (req, reply) => {
    requireUser(req);
    if (!req.isMultipart()) throw new HttpError(400, 'multipart/form-data 로 업로드하세요');
    const file = await req.file();
    if (!file) throw new HttpError(400, '파일이 없습니다');
    const ext = EXT_BY_MIME[file.mimetype];
    if (!ext) throw new HttpError(415, 'jpg, png, webp, heic 이미지만 업로드할 수 있습니다');
    const buffer = await file.toBuffer();
    if (file.file.truncated) throw new HttpError(413, '파일이 너무 큽니다 (최대 10MB)');
    const stored = await storage.save(buffer, ext, file.mimetype);
    return reply.status(201).send(stored);
  });
}
