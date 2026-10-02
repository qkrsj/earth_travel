import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import type { Config } from '../config.js';

export interface StoredFile { key: string; url: string }

export interface Storage {
  save(data: Buffer, ext: string, contentType: string): Promise<StoredFile>;
  remove(key: string): Promise<void>;
  urlFor(key: string): string;
}

function newKey(ext: string) {
  const d = new Date();
  const prefix = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `photos/${prefix}/${randomUUID()}.${ext}`;
}

/** 개발용: 서버 디스크에 저장하고 /uploads 로 서빙 */
export class LocalStorage implements Storage {
  constructor(private dir: string, private baseUrl: string) {}

  async save(data: Buffer, ext: string): Promise<StoredFile> {
    const key = newKey(ext);
    const full = path.join(this.dir, key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return { key, url: this.urlFor(key) };
  }

  urlFor(key: string) {
    return `${this.baseUrl.replace(/\/$/, '')}/uploads/${key}`;
  }

  async remove(key: string) {
    await unlink(path.join(this.dir, key)).catch(() => undefined);
  }
}

/** 운영용: S3 / Cloudflare R2 / MinIO 등 S3 호환 스토리지 */
export class S3Storage implements Storage {
  private client: S3Client;

  constructor(private cfg: Config) {
    this.client = new S3Client({
      region: cfg.S3_REGION || 'auto',
      endpoint: cfg.S3_ENDPOINT || undefined,
      forcePathStyle: !!cfg.S3_ENDPOINT,
      credentials: cfg.S3_ACCESS_KEY_ID
        ? { accessKeyId: cfg.S3_ACCESS_KEY_ID, secretAccessKey: cfg.S3_SECRET_ACCESS_KEY ?? '' }
        : undefined,
    });
  }

  async save(data: Buffer, ext: string, contentType: string): Promise<StoredFile> {
    const key = newKey(ext);
    await this.client.send(new PutObjectCommand({
      Bucket: this.cfg.S3_BUCKET, Key: key, Body: data, ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));
    return { key, url: this.urlFor(key) };
  }

  urlFor(key: string) {
    return `${(this.cfg.S3_PUBLIC_URL ?? '').replace(/\/$/, '')}/${key}`;
  }

  async remove(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.cfg.S3_BUCKET, Key: key }));
  }
}

export function createStorage(cfg: Config): Storage {
  if (cfg.STORAGE_DRIVER === 's3') {
    if (!cfg.S3_BUCKET || !cfg.S3_PUBLIC_URL) throw new Error('S3_BUCKET, S3_PUBLIC_URL 이 필요합니다');
    return new S3Storage(cfg);
  }
  return new LocalStorage(path.resolve(cfg.UPLOAD_DIR), cfg.PUBLIC_BASE_URL);
}

export const STORAGE_KEY_RE = /^photos\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|heic)$/;
