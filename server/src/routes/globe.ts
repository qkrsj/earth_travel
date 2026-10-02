import { createReadStream } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { notFound } from '../lib/http.js';

const require = createRequire(import.meta.url);
const globeDist = path.dirname(require.resolve('globe.gl'));
const threeGlobeMain = require.resolve('three-globe');
const threeGlobeRoot = threeGlobeMain.slice(0, threeGlobeMain.lastIndexOf(`${path.sep}three-globe${path.sep}`) + '/three-globe'.length);
const textures = path.join(threeGlobeRoot, 'example', 'img');
// 서버는 server/ 디렉터리에서 실행 (npm run dev / start, Docker WORKDIR)
const pageDir = path.resolve(process.cwd(), 'public', 'globe');

// 지구본 페이지에서 쓰는 파일 화이트리스트 (서드파티 CDN 없이 우리 서버에서 서빙)
const FILES: Record<string, { file: string; type: string }> = {
  'index.html': { file: path.join(pageDir, 'index.html'), type: 'text/html; charset=utf-8' },
  'globe.gl.min.js': { file: path.join(globeDist, 'globe.gl.min.js'), type: 'application/javascript' },
  'earth-blue-marble.jpg': { file: path.join(textures, 'earth-blue-marble.jpg'), type: 'image/jpeg' },
  'earth-topology.png': { file: path.join(textures, 'earth-topology.png'), type: 'image/png' },
  'night-sky.png': { file: path.join(textures, 'night-sky.png'), type: 'image/png' },
};

/** 앱(WebView)과 웹(iframe)이 공통으로 쓰는 3D 지구본 페이지 */
export default async function globeRoutes(app: FastifyInstance) {
  app.get('/globe', async (_req, reply) => reply.redirect('/globe/'));
  app.get('/globe/', async (_req, reply) => send(reply, 'index.html'));
  app.get('/globe/:file', async (req, reply) => send(reply, (req.params as { file: string }).file));

  function send(reply: FastifyReply, name: string) {
    const entry = FILES[name];
    if (!entry) throw notFound('파일');
    reply.header('Content-Type', entry.type);
    reply.header('Cache-Control', name === 'index.html' ? 'no-cache' : 'public, max-age=604800');
    return reply.send(createReadStream(entry.file));
  }
}
