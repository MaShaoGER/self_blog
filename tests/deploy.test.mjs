import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, copyFile, readFile, rm, chmod, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/sh.exe' : '/bin/sh';
const posix = (s) => s.replaceAll('\\', '/');
const quote = (s) => `'${posix(s).replaceAll("'", "'\\''")}'`;
async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'blog-deploy-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const p of ['repo/deploy', 'tools', 'content/posts', 'content/uploads', 'state']) await mkdir(path.join(dir, p), { recursive: true });
  for (const file of ['update.sh', 'backup.sh']) await copyFile(new URL(`../deploy/${file}`, import.meta.url), path.join(dir, 'repo/deploy', file));
  await writeFile(path.join(dir, 'content/posts/private.md'), '# private');
  await writeFile(path.join(dir, 'runtime.env'), 'SECRET=not-logged');
  await writeFile(path.join(dir, 'state/current-image'), 'self-blog:old\n');
  await writeFile(path.join(dir, 'config'), `BLOG_REPO_DIR=${quote(path.join(dir, 'repo'))}\nBLOG_ENV_FILE=${quote(path.join(dir, 'runtime.env'))}\nBLOG_HOST_DATA_DIR=${quote(path.join(dir, 'content'))}\nBLOG_STATE_DIR=${quote(path.join(dir, 'state'))}\nBLOG_DEPLOY_MODE=gateway\nBLOG_COMPOSE_PROJECT_NAME=self-blog-preview\n`);
  const git = `#!/bin/sh\nprintf 'git %s\\n' "$*" >> "$TEST_ROOT/log"\ncase "$*" in\n *'status --porcelain'*) printf '%s' "\${TEST_DIRTY:-}";;\n *'rev-parse --verify HEAD'*) echo abcdef1234567890;;\n *'rev-parse --show-toplevel'*) pwd;;\nesac\n`;
  const docker = `#!/bin/sh\nprintf 'docker %s image=%s\\n' "$*" "\${BLOG_IMAGE:-}" >> "$TEST_ROOT/log"\ncase "$*" in\n *'up --wait'*) printf '%s\\n' "$BLOG_IMAGE" > "$TEST_ROOT/running"; if [ "\${TEST_FAIL_UP:-}" = 1 ] && [ "$BLOG_IMAGE" != self-blog:old ]; then exit 1; fi;;\n *'exec -T blog node scripts/healthcheck.mjs'*) if [ "\${TEST_FAIL_HEALTH:-}" = 1 ] && [ "$BLOG_IMAGE" != self-blog:old ]; then exit 1; fi;;\nesac\n`;
  for (const [name, body] of [['git', git], ['docker', docker]]) { await writeFile(path.join(dir, 'tools', name), body); await chmod(path.join(dir, 'tools', name), 0o755); }
  return dir;
}
function run(dir, args = [], env = {}) {
  return spawnSync(shell, ['-c', 'PATH="$(cd "$TEST_ROOT/tools" && pwd):$PATH"; export PATH; exec sh repo/deploy/update.sh "$@"', 'test', ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, BLOG_DEPLOY_CONFIG: posix(path.join(dir, 'config')), TEST_ROOT: posix(dir), ...env } });
}
test('manual update backs up external content and records a commit image within its project', async (t) => {
  const dir = await fixture(t); const r = run(dir); assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match((await readFile(path.join(dir, 'state/current-image'), 'utf8')).trim(), /^self-blog:abcdef1234567890-/);
  assert.equal((await readFile(path.join(dir, 'state/previous-image'), 'utf8')).trim(), 'self-blog:old');
  assert.equal((await readdir(path.join(dir, 'state/backups'))).filter(n => n.endsWith('.tar.gz')).length, 1);
  const log = await readFile(path.join(dir, 'log'), 'utf8');
  assert.match(log, /git fetch origin main/); assert.match(log, /git merge --ff-only FETCH_HEAD/);
  assert.match(log, /--project-name self-blog-preview .*docker-compose.gateway.yml/);
  assert.doesNotMatch(r.stdout + r.stderr + log, /not-logged|reset --hard|prune/);
});
for (const failure of ['TEST_FAIL_UP', 'TEST_FAIL_HEALTH']) test(`${failure} restores the previous image and preserves deployment state`, async (t) => {
  const dir = await fixture(t); const r = run(dir, [], { [failure]: '1' }); assert.notEqual(r.status, 0);
  assert.equal((await readFile(path.join(dir, 'running'), 'utf8')).trim(), 'self-blog:old');
  assert.equal((await readFile(path.join(dir, 'state/current-image'), 'utf8')).trim(), 'self-blog:old');
  assert.equal((await readdir(path.join(dir, 'state'))).includes('.update-lock'), false);
});
test('dirty checkout is rejected before backups, builds or updates', async (t) => {
  const dir = await fixture(t); const r = run(dir, [], { TEST_DIRTY: ' M modified.ts' }); assert.notEqual(r.status, 0);
  assert.doesNotMatch(await readFile(path.join(dir, 'log'), 'utf8'), /git fetch|docker/);
});
test('explicit rollback uses retained image without fetching or building', async (t) => {
  const dir = await fixture(t); await writeFile(path.join(dir, 'state/previous-image'), 'self-blog:previous\n');
  const r = run(dir, ['--rollback']); assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal((await readFile(path.join(dir, 'running'), 'utf8')).trim(), 'self-blog:previous');
  assert.equal((await readFile(path.join(dir, 'state/previous-image'), 'utf8')).trim(), 'self-blog:old');
  assert.doesNotMatch(await readFile(path.join(dir, 'log'), 'utf8'), /git fetch|docker build/);
});

test('source bundle update skips remote access but still builds and checks health', async (t) => {
  const dir = await fixture(t); const r = run(dir, ['--no-pull']); assert.equal(r.status, 0, r.stdout + r.stderr);
  const log = await readFile(path.join(dir, 'log'), 'utf8');
  assert.doesNotMatch(log, /git fetch|git merge/);
  assert.match(log, /docker build/);
  assert.match(log, /exec -T blog node scripts\/healthcheck.mjs/);
});

test('existing deployment lock blocks any backup or service mutation', async (t) => {
  const dir = await fixture(t); await mkdir(path.join(dir, 'state/.update-lock'));
  const r = run(dir); assert.notEqual(r.status, 0);
  assert.deepEqual((await readdir(path.join(dir, 'state'))).sort(), ['.update-lock', 'current-image']);
});

test('busy backup refuses update before git fetch or image build', async (t) => {
  const dir = await fixture(t); await mkdir(path.join(dir, 'state/backups/.lock'), { recursive: true });
  const r = run(dir); assert.notEqual(r.status, 0, r.stdout + r.stderr);
  assert.doesNotMatch(await readFile(path.join(dir, 'log'), 'utf8'), /git fetch|git merge|docker/);
  assert.equal((await readFile(path.join(dir, 'state/current-image'), 'utf8')).trim(), 'self-blog:old');
});

test('missing external data refuses deployment before backup or services', async (t) => {
  const dir = await fixture(t); await rm(path.join(dir, 'content/uploads'), { recursive: true });
  const r = run(dir); assert.notEqual(r.status, 0);
  assert.deepEqual(await readdir(path.join(dir, 'state')), ['current-image']);
});

test('rebuilding the same commit never overwrites the image needed for rollback', async (t) => {
  const dir = await fixture(t);
  await writeFile(path.join(dir, 'state/current-image'), 'self-blog:abcdef1234567890\n');
  const r = run(dir, ['--no-pull']); assert.equal(r.status, 0, r.stdout + r.stderr);
  const current = (await readFile(path.join(dir, 'state/current-image'), 'utf8')).trim();
  assert.notEqual(current, 'self-blog:abcdef1234567890');
  assert.match(current, /^self-blog:abcdef1234567890-/);
  assert.equal((await readFile(path.join(dir, 'state/previous-image'), 'utf8')).trim(), 'self-blog:abcdef1234567890');
});
