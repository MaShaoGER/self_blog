import './register-source.mjs';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-login-attempt-'));
const legacyPassword = 'x'.repeat(129);
process.env.BLOG_DATA_DIR = dir;
process.env.BLOG_ADMIN_PASSWORD = legacyPassword;
const { attemptLogin } = await import('../lib/login-attempt.ts');
after(() => fs.rm(dir, { recursive: true, force: true }));

test('malformed scalar credentials fail without creating an account store', async () => {
  for (const [username, password] of [[{}, 'secret'], ['a'.repeat(33), 'secret'], ['admin', {}], ['admin', '']]) {
    assert.deepEqual(await attemptLogin('malformed-ip', username, password), { status: 'invalid' });
  }
  assert.deepEqual(await fs.readdir(dir), []);
});

test('twelve concurrent invalid logins reserve only five authentication attempts', async () => {
  const results = await Promise.all(Array.from({ length: 12 }, () => attemptLogin('concurrent-ip', 'missing', 'wrong-password')));
  assert.equal(results.filter((item) => item.status === 'invalid').length, 5);
  assert.equal(results.filter((item) => item.status === 'limited').length, 7);
});

test('a correct password submitted sixth in a concurrent batch cannot bypass exhausted admission', async () => {
  const requests = Array.from({ length: 5 }, () => attemptLogin('mixed-ip', 'missing', 'wrong-password'));
  requests.push(attemptLogin('mixed-ip', 'admin', legacyPassword));
  const results = await Promise.all(requests);
  assert.equal(results[5].status, 'limited');
  assert.equal(results.filter((item) => item.status === 'invalid').length, 5);
});

test('different IP addresses have independent attempt budgets', async () => {
  for (let index = 0; index < 5; index++) assert.deepEqual(await attemptLogin('first-ip', null, ''), { status: 'invalid' });
  assert.deepEqual(await attemptLogin('first-ip', null, ''), { status: 'limited' });
  assert.deepEqual(await attemptLogin('second-ip', null, ''), { status: 'invalid' });
});

test('a legacy bootstrap password longer than 128 characters authenticates and resets the attempt budget', async () => {
  for (let index = 0; index < 4; index++) assert.deepEqual(await attemptLogin('successful-ip', null, ''), { status: 'invalid' });
  const result = await attemptLogin('successful-ip', 'admin', legacyPassword);
  assert.equal(result.status, 'authenticated');
  assert.equal(result.account.username, 'admin');
  assert.equal(result.account.passwordHash, undefined);
  for (let index = 0; index < 5; index++) assert.deepEqual(await attemptLogin('successful-ip', null, ''), { status: 'invalid' });
  assert.deepEqual(await attemptLogin('successful-ip', null, ''), { status: 'limited' });
});
