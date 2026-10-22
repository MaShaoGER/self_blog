import './register-source.mjs';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-auth-sessions-'));
process.env.BLOG_DATA_DIR = dir;
process.env.BLOG_ADMIN_PASSWORD = 'initial-admin-password-2026';
process.env.BLOG_SESSION_SECRET = 'test-only-session-signing-secret-over-32-characters';
after(() => fs.rm(dir, { recursive: true, force: true }));

const accounts = await import('../lib/accounts.ts');
const sessions = await import('../lib/sessions.ts');
const { hmac } = await import('../lib/crypto.ts');
const metadata = { device: 'Windows · Edge', ip: '本机' };

test('signed sessions retain account identity and return only public profile data', async () => {
  const admin = await accounts.authenticateAccount('admin', 'initial-admin-password-2026');
  assert.ok(admin);
  const { session, token } = await sessions.issueSession(admin, metadata);
  const current = await sessions.readSession(token);
  assert.equal(current.accountId, admin.id);
  assert.equal(current.account.role, 'admin');
  assert.equal(current.account.username, 'admin');
  assert.equal(current.id, session.id);
  assert.equal(current.account.passwordHash, undefined);
  assert.equal(await sessions.readSession(`${token}tampered`), null);
});

test('device listing and revocation cannot affect another account', async () => {
  const admin = await accounts.authenticateAccount('admin', 'initial-admin-password-2026');
  const editor = await accounts.createAccount(admin.id, {
    username: 'writer', displayName: '编辑', role: 'editor', password: 'editor-password-2026',
  });
  const a = await sessions.issueSession(admin, metadata);
  const b = await sessions.issueSession(admin, metadata);
  const e = await sessions.issueSession(editor, metadata);
  const listed = await sessions.getSessionsForAccount(admin.id);
  assert.ok(listed.every((item) => item.accountId === admin.id));
  assert.equal(listed.some((item) => item.id === e.session.id), false);
  await sessions.revokeAccountSession(admin.id, e.session.id);
  assert.ok(await sessions.readSession(e.token));
  await sessions.revokeOtherAccountSessions(admin.id, a.session.id);
  assert.equal((await sessions.getSessionsForAccount(admin.id)).length, 1);
  assert.equal(await sessions.readSession(b.token), null);
  assert.ok(await sessions.readSession(e.token));
});

test('a password reset rejects existing tokens and stale session creation', async () => {
  const admin = await accounts.authenticateAccount('admin', 'initial-admin-password-2026');
  const editor = await accounts.authenticateAccount('writer', 'editor-password-2026');
  const old = await sessions.issueSession(editor, metadata);
  await accounts.resetAccountPassword(admin.id, editor.id, 'replacement-editor-password');
  assert.equal(await sessions.readSession(old.token), null);
  await assert.rejects(sessions.issueSession(editor, metadata));
  const updated = await accounts.authenticateAccount('writer', 'replacement-editor-password');
  assert.ok(await sessions.readSession((await sessions.issueSession(updated, metadata)).token));
});

test('legacy unowned sessions and expired sessions do not authenticate', async () => {
  const legacy = {
    id: 'a'.repeat(32), createdAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(), ...metadata,
  };
  const file = path.join(dir, 'sessions.json');
  await fs.writeFile(file, JSON.stringify({ sessions: [legacy] }));
  const token = `${legacy.id}.${hmac(process.env.BLOG_SESSION_SECRET, `session:${legacy.id}`)}`;
  assert.equal(await sessions.readSession(token), null);
  const admin = await accounts.authenticateAccount('admin', 'initial-admin-password-2026');
  const issued = await sessions.issueSession(admin, metadata);
  const saved = JSON.parse(await fs.readFile(file, 'utf8'));
  saved.sessions.find((item) => item.id === issued.session.id).expiresAt = '2000-01-01T00:00:00.000Z';
  await fs.writeFile(file, JSON.stringify(saved));
  assert.equal(await sessions.readSession(issued.token), null);
});
