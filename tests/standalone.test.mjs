import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, lstat, mkdir, mkdtemp, readFile, readlink, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';

const project = fileURLToPath(new URL('../', import.meta.url));
const execute = promisify(execFile);

async function copyStandalone(source, destination) {
  const links = [];
  await cp(source, destination, {
    recursive: true,
    filter: async (entry, target) => {
      if (path.basename(entry).startsWith('.env')) return false;
      if (!(await lstat(entry)).isSymbolicLink()) return true;
      const original = path.resolve(path.dirname(entry), await readlink(entry));
      const relative = path.relative(source, original);
      assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative), 'package link escapes standalone output');
      links.push([target, path.join(destination, relative)]);
      return false;
    },
  });
  // Windows junctions contain absolute paths; relocate them instead of copying source links.
  for (const [target, original] of links) {
    await symlink(process.platform === 'win32' ? original : path.relative(path.dirname(target), original),
      target, process.platform === 'win32' ? 'junction' : 'dir');
  }
}

async function unusedPort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  return port;
}

async function waitForServer(url, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    assert.equal(child.exitCode, null, 'standalone server exited before accepting requests');
    try {
      return await fetch(url, { signal: AbortSignal.timeout(1_000), redirect: 'manual' });
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('standalone server did not accept requests within 30 seconds');
}

// Removing native-library tracing must fail here, even with a working project node_modules.
test('isolated standalone serves uploads, protects admin, and detects storage health failures', { timeout: 120_000 }, async (t) => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'blog-standalone-'));
  const app = path.join(temporary, 'app');
  const data = path.join(temporary, 'data');
  let child;
  t.after(async () => {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  await copyStandalone(path.join(project, '.next/standalone'), app);
  await cp(path.join(project, '.next/static'), path.join(app, '.next/static'), { recursive: true });
  await mkdir(path.join(app, 'scripts'), { recursive: true });
  await cp(path.join(project, 'scripts/healthcheck.mjs'), path.join(app, 'scripts/healthcheck.mjs'));
  await mkdir(path.join(data, 'posts'), { recursive: true });
  await mkdir(path.join(data, 'uploads'), { recursive: true });

  const env = { ...process.env, NODE_ENV: 'production', NODE_PATH: '', BLOG_DATA_DIR: data,
    BLOG_ADMIN_PASSWORD: 'standalone-test-only-password',
    BLOG_SESSION_SECRET: 'standalone-test-only-secret-at-least-32-characters' };
  const sample = path.join(data, 'uploads/sample.webp');
  // Resolve inside the copied artifact in a fresh process, then exercise the native encoder.
  await execute(process.execPath, ['-e', `
    const path = require('node:path');
    const { createRequire } = require('node:module');
    const req = createRequire(path.resolve('server.js'));
    const sharp = req('sharp');
    sharp({ create: { width: 2, height: 3, channels: 3, background: '#e8531f' } })
      .webp().toFile(process.argv[1]).catch(() => process.exit(1));
  `, sample], { cwd: app, env });

  const port = await unusedPort();
  child = spawn(process.execPath, ['server.js'], {
    cwd: app, env: { ...env, HOSTNAME: '127.0.0.1', PORT: String(port) }, stdio: 'ignore',
  });
  await once(child, 'spawn');
  const origin = `http://127.0.0.1:${port}`;
  const upload = await waitForServer(`${origin}/uploads/sample.webp`, child);
  assert.equal(upload.status, 200);
  assert.equal(upload.headers.get('content-type'), 'image/webp');
  assert.deepEqual(Buffer.from(await upload.arrayBuffer()), await readFile(sample));

  const admin = await fetch(`${origin}/admin/media`, { redirect: 'manual' });
  assert.equal(admin.status, 307);
  const location = new URL(admin.headers.get('location'), origin);
  assert.equal(location.pathname, '/login');
  assert.equal(location.searchParams.get('next'), '/admin/media');

  const healthUrl = `${origin}/healthz`;
  const health = await fetch(healthUrl);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'healthy' });
  const probe = () => execute(process.execPath, ['-e', `
    import('./scripts/healthcheck.mjs').then(({ checkHealth }) => checkHealth(process.argv[1]))
      .catch(() => process.exit(1));
  `, healthUrl], { cwd: app, env });
  await probe();

  await rm(path.join(data, 'uploads'), { recursive: true });
  const unhealthy = await fetch(healthUrl);
  assert.equal(unhealthy.status, 503);
  assert.deepEqual(await unhealthy.json(), { status: 'unhealthy' });
  await assert.rejects(probe(), { code: 1 });
  await mkdir(path.join(data, 'uploads'));
  assert.equal((await fetch(healthUrl)).status, 200);
  await probe();
});
