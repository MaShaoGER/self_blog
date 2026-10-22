import './register-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir = await mkdtemp(path.join(os.tmpdir(), 'blog-projects-'));
process.env.BLOG_DATA_DIR = dir;
const projects = await import('../lib/projects.ts');
const file = path.join(dir, 'projects.json');
test.after(() => rm(dir, { recursive: true, force: true }));
const input = { title: '工具箱', description: '一个创作工具', year: '2026', tags: ['AE', '工具'], href: 'https://example.com/tool', demo: '', status: '活跃', featured: true };

test('legacy projects have deterministic IDs and migrate only on mutation', async () => {
  const original = JSON.stringify([{ ...input, demo: undefined }, { ...input, title: '旧项目', year: '2025', demo: undefined }]);
  await writeFile(file, original);
  const first = await projects.listProjectsForAdmin();
  assert.equal(typeof first[0].id, 'string');
  assert.deepEqual((await projects.listProjectsForAdmin()).map(p => p.id), first.map(p => p.id));
  assert.equal(await readFile(file, 'utf8'), original);
  await projects.updateProject(first[0].id, { ...input, title: '已更新' });
  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(saved[0].id, first[0].id);
  assert.equal(saved[1].id, first[1].id);
  assert.equal(saved[0].title, '已更新');
});

test('create update delete roundtrip preserves identities and public sort', async () => {
  await writeFile(file, '[]');
  const old = await projects.createProject({ ...input, title: 'Z', year: '2025' });
  const recent = await projects.createProject({ ...input, title: 'A' });
  assert.match(recent.id, /^[0-9a-f-]{36}$/);
  await projects.updateProject(recent.id, { ...input, title: '新标题', href: '', featured: false, status: '' });
  const list = await projects.readProjects();
  assert.deepEqual(list.map(p => p.title), ['新标题', 'Z']);
  assert.equal(list[0].href, undefined);
  assert.equal(list[0].featured, false);
  assert.equal(list[0].status, undefined);
  await projects.deleteProject(old.id);
  assert.deepEqual((await projects.listProjectsForAdmin()).map(p => p.id), [recent.id]);
  await assert.rejects(projects.updateProject(old.id, input));
  await assert.rejects(projects.deleteProject(old.id));
});

test('invalid field values never change stored projects', async () => {
  await writeFile(file, '[]');
  for (const patch of [{ title: '' }, { title: 42 }, { title: 'a'.repeat(121) }, { description: null }, { year: 'tomorrow' }, { year: 2026 }, { tags: 'AE' }, { tags: [42] }, { tags: ['a'.repeat(31)] }, { tags: Array(13).fill('a') }, { href: 'javascript:alert(1)' }, { href: 'https://' }, { demo: {} }, { status: 'published' }, { featured: 'yes' }]) {
    await assert.rejects(projects.createProject({ ...input, ...patch }), error => error.name === 'ProjectValidationError' && !!error.field);
    assert.equal(await readFile(file, 'utf8'), '[]');
  }
});

test('corrupt or structurally invalid files remain untouched and public reads degrade gracefully', async () => {
  for (const broken of ['{broken', '{}', '[null]', JSON.stringify([{ ...input, featured: 'yes' }]), JSON.stringify([{ ...input, id: 'same' }, { ...input, id: 'same' }])]) {
    await writeFile(file, broken);
    await assert.rejects(projects.listProjectsForAdmin(), error => error.name === 'ProjectsDataError');
    await assert.rejects(projects.createProject(input));
    await assert.rejects(projects.deleteProject('missing'));
    assert.equal(await readFile(file, 'utf8'), broken);
    assert.ok(Array.isArray(await projects.readProjects()));
  }
});

test('missing file starts empty and concurrent mutations do not lose projects', async () => {
  await rm(file);
  assert.deepEqual(await projects.listProjectsForAdmin(), []);
  const created = await Promise.all(Array.from({ length: 12 }, (_, i) => projects.createProject({ ...input, title: `项目 ${i}` })));
  assert.equal((await projects.listProjectsForAdmin()).length, 12);
  await Promise.all(created.map(p => projects.updateProject(p.id, { ...input, title: p.title, description: '更新' })));
  const saved = await projects.listProjectsForAdmin();
  assert.equal(new Set(saved.map(p => p.id)).size, 12);
  assert.ok(saved.every(p => p.description === '更新'));
});
