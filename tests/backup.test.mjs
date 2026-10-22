import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readdir, rm, writeFile, chmod, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/sh.exe' : '/bin/sh';
const script = fileURLToPath(new URL('../deploy/backup.sh', import.meta.url));
async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'blog-backup-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'deploy'));
  await mkdir(path.join(dir, 'data/posts'), { recursive: true });
  await writeFile(path.join(dir, 'data/posts/test.md'), '# Backup me');
  await writeFile(path.join(dir, 'data/sessions.json'), '{"sessions":["secret"]}');
  await writeFile(path.join(dir, 'data/posts/writing.tmp'), 'incomplete');
  await copyFile(script, path.join(dir, 'deploy/backup.sh'));
  // Limit command lookup to the actual shell tools required by the script, with no rclone.
  await mkdir(path.join(dir, 'tools'));
  for (const name of ['dirname', 'mkdir', 'rmdir', 'date', 'tar', 'gzip', 'rm', 'mv', 'ls', 'tail']) {
    const found = spawnSync(shell, ['-c', 'command -v "$1"', 'test', name], { encoding: 'utf8' });
    assert.equal(found.status, 0, `Missing test prerequisite: ${name}`);
    const wrapper = path.join(dir, 'tools', name);
    await writeFile(wrapper, `#!/bin/sh\nexec '${found.stdout.trim().replaceAll("'", "'\\''")}' "$@"\n`);
    await chmod(wrapper, 0o755);
  }
  return dir;
}
function run(dir, env = {}) {
  return spawnSync(shell, ['deploy/backup.sh'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: 'tools', BLOG_HOST_DATA_DIR: 'data', BACKUP_DIR: 'deploy/backups', BACKUP_KEEP: '14', BACKUP_REMOTE: '', ...env },
  });
}
test('configured remote without rclone fails but preserves a valid local archive', async (t) => {
  const dir = await fixture(t);
  const result = run(dir, { BACKUP_REMOTE: 'unavailable:backup' });
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  const names = await readdir(path.join(dir, 'deploy/backups'));
  assert.equal(names.filter((name) => name.endsWith('.tar.gz')).length, 1);
  assert.equal(names.includes('.lock'), false);
  const archive = `deploy/backups/${names.find((name) => name.endsWith('.tar.gz'))}`;
  const listing = spawnSync(shell, ['-c', 'tar -tzf "$1"', 'test', archive], { cwd: dir, encoding: 'utf8' });
  assert.equal(listing.status, 0, listing.stderr);
  assert.match(listing.stdout, /data\/posts\/test.md/);
  assert.doesNotMatch(listing.stdout, /sessions\.json|writing\.tmp/);
});
test('backup rejects retention zero before creating or deleting any archive', async (t) => {
  const dir = await fixture(t);
  await mkdir(path.join(dir, 'deploy/backups'));
  await writeFile(path.join(dir, 'deploy/backups/data-old.tar.gz'), 'old backup');
  const result = run(dir, { BACKUP_KEEP: '0' });
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  assert.deepEqual(await readdir(path.join(dir, 'deploy/backups')), ['data-old.tar.gz']);
});
test('retention preserves the newest archive when backup directory contains spaces', async (t) => {
  const dir = await fixture(t);
  await mkdir(path.join(dir, 'backup copies'));
  await writeFile(path.join(dir, 'backup copies/data-20000101-000000.tar.gz'), 'old backup');
  await utimes(path.join(dir, 'backup copies/data-20000101-000000.tar.gz'), new Date('2000-01-01'), new Date('2000-01-01'));
  const result = run(dir, { BACKUP_DIR: 'backup copies', BACKUP_KEEP: '1' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const names = await readdir(path.join(dir, 'backup copies'));
  assert.equal(names.length, 1);
  assert.notEqual(names[0], 'data-20000101-000000.tar.gz');
});

test('remote copy failure preserves older local archives instead of rotating them away', async (t) => {
  const dir = await fixture(t);
  await mkdir(path.join(dir, 'deploy/backups'));
  await writeFile(path.join(dir, 'deploy/backups/data-20000101-000000.tar.gz'), 'old backup');
  await utimes(path.join(dir, 'deploy/backups/data-20000101-000000.tar.gz'), new Date('2000-01-01'), new Date('2000-01-01'));
  await writeFile(path.join(dir, 'tools/rclone'), '#!/bin/sh\nexit 42\n');
  await chmod(path.join(dir, 'tools/rclone'), 0o755);
  const result = run(dir, { BACKUP_REMOTE: 'remote:backup', BACKUP_KEEP: '1' });
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
  const names = await readdir(path.join(dir, 'deploy/backups'));
  assert.equal(names.length, 2);
  assert.equal(names.includes('data-20000101-000000.tar.gz'), true);
});

test('external data directory keeps the restore data prefix and excludes runtime secrets', async (t) => {
  const dir = await fixture(t);
  await mkdir(path.join(dir, 'external content/posts'), { recursive: true });
  await writeFile(path.join(dir, 'external content/posts/external.md'), 'external content');
  await writeFile(path.join(dir, 'external content/sessions.json'), 'private');
  const result = run(dir, { BLOG_HOST_DATA_DIR: path.join(dir, 'external content').replaceAll('\\', '/') });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const names = await readdir(path.join(dir, 'deploy/backups'));
  const archive = `deploy/backups/${names.find((name) => name.endsWith('.tar.gz'))}`;
  const listing = spawnSync(shell, ['-c', 'tar -tzf "$1"', 'test', archive], { cwd: dir, encoding: 'utf8' });
  assert.equal(listing.status, 0, listing.stderr);
  assert.match(listing.stdout, /data\/posts\/external.md/);
  assert.doesNotMatch(listing.stdout, /test\.md|sessions\.json/);
});
