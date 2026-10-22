import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolveDataDir } from '../lib/data-path.mjs';

test('default runtime is a sibling directory and explicit relative paths resolve against the checkout', () => {
  const cwd = path.join(os.tmpdir(), 'sample-blog');
  assert.equal(resolveDataDir(cwd, ''), path.join(os.tmpdir(), 'sample-blog-data'));
  assert.equal(resolveDataDir(cwd, '../private-content'), path.join(os.tmpdir(), 'private-content'));
});

const cli = path.resolve('scripts/data.mjs');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-data-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}

test('new runtime storage is created outside source with empty posts and uploads', async (t) => {
  const root = await fixture(t);
  const target = path.join(root, 'runtime');
  const result = run('init', '--to', target);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await fs.readdir(target)).sort(), ['posts', 'uploads']);
  assert.deepEqual(await fs.readdir(path.join(target, 'posts')), []);
});

test('migration verifies and preserves all data while leaving original files intact', async (t) => {
  const root = await fixture(t);
  const source = path.join(root, 'old data');
  const target = path.join(root, 'new data');
  await fs.mkdir(path.join(source, 'posts'), { recursive: true });
  await fs.writeFile(path.join(source, 'posts/a.md'), '# hello');
  await fs.writeFile(path.join(source, 'accounts.json'), '[{"passwordHash":"opaque-test-hash"}]');
  await fs.writeFile(path.join(source, 'sessions.json'), '{"sessions":[]}');
  await fs.writeFile(path.join(source, 'writing.tmp'), 'incomplete');
  const result = run('migrate', '--from', source, '--to', target);
  assert.equal(result.status, 0, result.stderr);
  for (const name of ['posts/a.md', 'accounts.json', 'sessions.json']) {
    assert.deepEqual(await fs.readFile(path.join(target, name)), await fs.readFile(path.join(source, name)));
  }
  await assert.rejects(fs.stat(path.join(target, 'writing.tmp')), { code: 'ENOENT' });
  assert.equal(run('migrate', '--from', source, '--to', target).status, 0);
});

test('migration refuses conflicting destinations without overwriting or removing either copy', async (t) => {
  const root = await fixture(t);
  const source = path.join(root, 'old');
  const target = path.join(root, 'new');
  await fs.mkdir(source); await fs.mkdir(target);
  await fs.writeFile(path.join(source, 'settings.json'), '{"title":"original"}');
  await fs.writeFile(path.join(target, 'settings.json'), '{"title":"different"}');
  const result = run('migrate', '--from', source, '--to', target);
  assert.notEqual(result.status, 0);
  assert.equal(await fs.readFile(path.join(source, 'settings.json'), 'utf8'), '{"title":"original"}');
  assert.equal(await fs.readFile(path.join(target, 'settings.json'), 'utf8'), '{"title":"different"}');
});

test('runtime initialization refuses the repository as a target', () => {
  const result = run('init', '--to', process.cwd());
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /源码|source|repository/i);
});
