import './register-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';

async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'blog-health-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'posts'));
  await mkdir(path.join(dir, 'uploads'));
  return dir;
}

test('health accepts fresh storage and leaves no probe files', async (t) => {
  const { checkDataHealth } = await import('../lib/health.ts');
  const dir = await fixture(t);
  await checkDataHealth(dir);
  assert.deepEqual((await readdir(dir)).sort(), ['posts', 'uploads']);
  assert.deepEqual(await readdir(path.join(dir, 'posts')), []);
  assert.deepEqual(await readdir(path.join(dir, 'uploads')), []);
});

test('health rejects a missing uploads directory', async (t) => {
  const { checkDataHealth } = await import('../lib/health.ts');
  const dir = await fixture(t);
  await rm(path.join(dir, 'uploads'), { recursive: true });
  await assert.rejects(checkDataHealth(dir));
});

test('health rejects corrupt stored JSON without modifying it', async (t) => {
  const { checkDataHealth } = await import('../lib/health.ts');
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'settings.json'), '{broken');
  await assert.rejects(checkDataHealth(dir));
  assert.deepEqual((await readdir(dir)).sort(), ['posts', 'settings.json', 'uploads']);
});

test('health route fails for an absent mount and recovers after storage is provisioned', async (t) => {
  const dir = await fixture(t);
  const previous = process.env.BLOG_DATA_DIR;
  t.after(() => { if (previous === undefined) delete process.env.BLOG_DATA_DIR; else process.env.BLOG_DATA_DIR = previous; });
  const mount = path.join(dir, 'missing');
  process.env.BLOG_DATA_DIR = mount;
  const { GET } = await import('../app/healthz/route.ts');
  const response = await GET();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { status: 'unhealthy' });
  await mkdir(path.join(mount, 'posts'), { recursive: true });
  await mkdir(path.join(mount, 'uploads'));
  const recovered = await GET();
  assert.equal(recovered.status, 200);
  assert.equal(recovered.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await recovered.json(), { status: 'healthy' });
});

async function endpoint(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}/healthz`;
}
test('container healthcheck accepts a healthy response', async (t) => {
  const { checkHealth } = await import('../scripts/healthcheck.mjs');
  const url = await endpoint(t, (_req, res) => res.end('{"status":"healthy"}'));
  await checkHealth(url);
});
test('container healthcheck rejects HTTP failure and misleading success bodies', async (t) => {
  const { checkHealth } = await import('../scripts/healthcheck.mjs');
  const failed = await endpoint(t, (_req, res) => { res.statusCode = 503; res.end('{"status":"unhealthy"}'); });
  await assert.rejects(checkHealth(failed));
  const misleading = await endpoint(t, (_req, res) => res.end('{"status":"unhealthy"}'));
  await assert.rejects(checkHealth(misleading));
});
test('container healthcheck times out when the server never responds', async (t) => {
  const { checkHealth } = await import('../scripts/healthcheck.mjs');
  const url = await endpoint(t, () => {});
  await assert.rejects(checkHealth(url, 50));
});
