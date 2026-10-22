import './register-source.mjs';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-accounts-'));
process.env.BLOG_DATA_DIR = dir;
process.env.BLOG_ADMIN_PASSWORD = 'bootstrap-secret';
const accounts = await import('../lib/accounts.ts').catch((error) => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const file = path.join(dir, 'accounts.json');
after(() => fs.rm(dir, { recursive: true, force: true }));

test('bootstrap creates exactly one administrator under concurrent initialization and never stores plaintext', async () => {
  assert.equal(typeof accounts.ensureAccounts, 'function');
  const results = await Promise.all(Array.from({ length: 5 }, () => accounts.ensureAccounts()));
  assert.equal(results[0].length, 1);
  assert.equal(new Set(results.map((rows) => rows[0].id)).size, 1);
  assert.deepEqual(Object.keys(results[0][0]).sort(), ['createdAt', 'displayName', 'enabled', 'id', 'role', 'updatedAt', 'username', 'version']);
  assert.equal(results[0][0].username, 'admin');
  assert.equal(results[0][0].displayName, '管理员');
  assert.equal(results[0][0].role, 'admin');
  const stored = await fs.readFile(file, 'utf8');
  assert.equal(stored.includes('bootstrap-secret'), false);
  assert.equal((await accounts.authenticateAccount(' ADMIN ', 'bootstrap-secret')).id, results[0][0].id);
  process.env.BLOG_ADMIN_PASSWORD = 'changed-bootstrap';
  assert.equal(await accounts.authenticateAccount('admin', 'changed-bootstrap'), null);
  assert.equal(await accounts.authenticateAccount('missing', 'bootstrap-secret'), null);
});

const password = 'editor-secret-123';
const isCode = (code) => (error) => error instanceof accounts.AccountError && error.code === code;

test('account creation normalizes usernames, serializes duplicate writes, salts independently and hides hashes', async () => {
  const [admin] = await accounts.listAccounts();
  assert.equal(typeof accounts.createAccount, 'function');
  const results = await Promise.allSettled(Array.from({ length: 3 }, () => accounts.createAccount(admin.id, {
    username: ' Writer ', displayName: '作者', role: 'editor', password,
  })));
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(results.filter((item) => item.status === 'rejected' && item.reason.code === 'conflict').length, 2);
  const editor = (await accounts.listAccounts()).find((item) => item.username === 'writer');
  assert.equal(editor.role, 'editor');
  assert.equal(editor.enabled, true);
  assert.equal(editor.passwordHash, undefined);
  assert.equal((await accounts.getAccountById(editor.id)).username, 'writer');
  assert.equal(await accounts.getAccountById('absent'), null);
  const second = await accounts.createAccount(admin.id, { username: 'writer2', displayName: '作者二', role: 'editor', password });
  const stored = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.notEqual(stored.find((item) => item.id === editor.id).passwordHash, stored.find((item) => item.id === second.id).passwordHash);
  assert.equal((await accounts.authenticateAccount('writer', password)).id, editor.id);
});

test('creation validates names, roles and password boundaries without changing stored accounts', async () => {
  const [admin] = await accounts.listAccounts();
  const before = await fs.readFile(file, 'utf8');
  for (const invalid of [
    { username: '../escape' }, { username: 'ab' }, { username: 'a'.repeat(33) },
    { displayName: ' ' }, { displayName: 'x'.repeat(61) }, { role: 'owner' },
    { password: 'x'.repeat(11) }, { password: 'x'.repeat(129) },
  ]) {
    await assert.rejects(accounts.createAccount(admin.id, {
      username: 'valid-user', displayName: '有效作者', role: 'editor', password, ...invalid,
    }), isCode('validation'));
  }
  assert.equal(await fs.readFile(file, 'utf8'), before);
});

test('editor cannot create, update or reset accounts and cannot disable the administrator', async () => {
  const rows = await accounts.listAccounts();
  const admin = rows.find((item) => item.role === 'admin');
  const editor = rows.find((item) => item.username === 'writer');
  await assert.rejects(accounts.createAccount(editor.id, { username: 'other', displayName: '其他', role: 'editor', password }), isCode('forbidden'));
  await assert.rejects(accounts.updateAccount(editor.id, admin.id, { enabled: false }), isCode('forbidden'));
  await assert.rejects(accounts.resetAccountPassword(editor.id, admin.id, password), isCode('forbidden'));
});

test('session identity rejects missing, legacy, disabled and stale versions while role changes and resets revoke sessions', async () => {
  const [admin] = await accounts.listAccounts();
  let editor = (await accounts.listAccounts()).find((item) => item.username === 'writer');
  const session = { accountId: editor.id, accountVersion: editor.version };
  assert.equal((await accounts.getSessionAccount(session)).id, editor.id);
  assert.equal(await accounts.getSessionAccount({}), null);
  assert.equal(await accounts.getSessionAccount({ accountId: editor.id }), null);
  await accounts.updateAccount(admin.id, editor.id, { displayName: '新名字' });
  assert.equal((await accounts.getSessionAccount(session)).displayName, '新名字');
  editor = await accounts.updateAccount(admin.id, editor.id, { role: 'admin' });
  assert.equal(await accounts.getSessionAccount(session), null);
  assert.equal(editor.version, 2);
  await accounts.resetAccountPassword(admin.id, editor.id, 'reset-secret-123');
  assert.equal(await accounts.getSessionAccount({ accountId: editor.id, accountVersion: 2 }), null);
  assert.equal(await accounts.authenticateAccount('writer', password), null);
  assert.equal((await accounts.authenticateAccount('writer', 'reset-secret-123')).version, 3);
  editor = await accounts.updateAccount(admin.id, editor.id, { enabled: false });
  assert.equal(await accounts.authenticateAccount('writer', 'reset-secret-123'), null);
  assert.equal(await accounts.getSessionAccount({ accountId: editor.id, accountVersion: editor.version }), null);
  await assert.rejects(accounts.createAccount(editor.id, { username: 'bad-actor', displayName: '其他', role: 'editor', password }), isCode('forbidden'));
});

test('self-disable and self-demotion are rejected and concurrent admin actions cannot remove every administrator', async () => {
  const admin = (await accounts.listAccounts()).find((item) => item.username === 'admin');
  await assert.rejects(accounts.updateAccount(admin.id, admin.id, { enabled: false }), isCode('self_lockout'));
  await assert.rejects(accounts.updateAccount(admin.id, admin.id, { role: 'editor' }), isCode('self_lockout'));
  const second = await accounts.createAccount(admin.id, { username: 'other-admin', displayName: '管理员二', role: 'admin', password });
  const results = await Promise.allSettled([
    accounts.updateAccount(admin.id, second.id, { role: 'editor' }),
    accounts.updateAccount(second.id, admin.id, { enabled: false }),
  ]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await accounts.listAccounts()).filter((item) => item.role === 'admin' && item.enabled).length, 1);
  await assert.rejects(accounts.resetAccountPassword(second.id, admin.id, password), isCode('forbidden'));
});

test('own password change requires the old password and revokes the old session', async () => {
  const editor = (await accounts.listAccounts()).find((item) => item.username === 'writer2');
  await assert.rejects(accounts.changeOwnPassword(editor.id, 'wrong', 'new-secret-123'), isCode('invalid_password'));
  await assert.rejects(accounts.changeOwnPassword(editor.id, password, 'short'), isCode('validation'));
  await accounts.changeOwnPassword(editor.id, password, 'new-secret-123');
  assert.equal(await accounts.authenticateAccount(editor.username, password), null);
  assert.equal((await accounts.authenticateAccount(editor.username, 'new-secret-123')).version, editor.version + 1);
  assert.equal(await accounts.getSessionAccount({ accountId: editor.id, accountVersion: editor.version }), null);
});

test('existing corrupt, null, empty or no-enabled-admin storage fails closed without bootstrap replacement', async () => {
  const good = await fs.readFile(file, 'utf8');
  const stored = JSON.parse(good);
  try {
    for (const invalid of [
      '{broken', 'null', '[]',
      JSON.stringify(stored.map((item) => ({ ...item, enabled: false }))),
      JSON.stringify(stored.map((item) => ({ ...item, passwordHash: 'plaintext' }))),
      JSON.stringify([...stored, stored[0]]),
    ]) {
      await fs.writeFile(file, invalid);
      await assert.rejects(accounts.ensureAccounts(), (error) => !(error instanceof accounts.AccountError));
      assert.equal(await fs.readFile(file, 'utf8'), invalid);
    }
  } finally {
    await fs.writeFile(file, good);
  }
});

test('storage failures propagate as filesystem errors rather than user validation errors', async () => {
  const backup = `${file}.backup`;
  await fs.rename(file, backup);
  await fs.mkdir(file);
  try {
    await assert.rejects(accounts.listAccounts(), (error) => !(error instanceof accounts.AccountError) && Boolean(error.code));
  } finally {
    await fs.rmdir(file);
    await fs.rename(backup, file);
  }
});
