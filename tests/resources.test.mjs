import './register-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = await mkdtemp(path.join(os.tmpdir(), 'blog-resources-'));
process.env.BLOG_DATA_DIR = dir;
const resources = await import('../lib/resources.ts');
const file = path.join(dir, 'resources.json');

test.after(() => rm(dir, { recursive: true, force: true }));

const BASE = { name: '资源', description: '', kind: 'file', parentId: null, visibility: 'public' };
const fileSource = { type: 'direct', url: 'https://files.example.com/sample.pdf' };

function fileInput(patch = {}) {
  return { ...BASE, source: { ...fileSource }, ...patch };
}
function folderInput(patch = {}) {
  return { ...BASE, kind: 'folder', ...patch };
}
function storedInput(record) {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...value } = record;
  return value;
}
function rejectsWith(promise, name, field) {
  return assert.rejects(promise, (error) => {
    assert.equal(error.name, name);
    if (field !== undefined) assert.equal(error.field, field);
    return true;
  });
}
async function reset() {
  await writeFile(file, '[]');
}

test('missing file starts empty and listing hides sources with stable folder-first order', async () => {
  await rm(file, { force: true });
  assert.deepEqual(await resources.listResourcesForAdmin(), []);

  const folder = await resources.createResource(folderInput({ name: 'z-folder' }));
  const later = await resources.createResource(fileInput({ name: 'm-file' }));
  const first = await resources.createResource(fileInput({ name: 'a-file' }));

  const root = await resources.listResourceChildren(null, false);
  assert.deepEqual(root.items.map((item) => item.name), ['z-folder', 'a-file', 'm-file']);
  assert.deepEqual(root.breadcrumbs, []);
  assert.equal(root.nextCursor, null);
  for (const item of root.items) assert.equal('source' in item, false);

  const child = await resources.createResource(fileInput({ name: 'child', parentId: folder.id }));
  const nested = await resources.listResourceChildren(folder.id, false);
  assert.deepEqual(nested.items.map((item) => item.id), [child.id]);
  assert.deepEqual(nested.breadcrumbs, [{ id: folder.id, name: 'z-folder' }]);

  const detail = await resources.getResource(first.id);
  assert.equal(detail.source.url, fileSource.url);
  assert.equal(detail.id, first.id);
  assert.equal(later.parentId, null);

  await resources.createResource(folderInput({ name: 'sub', parentId: folder.id }));
  const deep = await resources.listResourceChildren(folder.id, false);
  assert.deepEqual(deep.breadcrumbs.map((crumb) => crumb.id), [folder.id]);
});

test('private ancestors hide otherwise-public metadata from guests', async () => {
  await reset();
  const privateParent = await resources.createResource(folderInput({ name: '私有文件夹', visibility: 'private' }));
  const privateChild = await resources.createResource(fileInput({ name: '私有文件', parentId: privateParent.id, visibility: 'private' }));
  const publicChild = await resources.createResource(fileInput({ name: '公开文件', parentId: privateParent.id, visibility: 'public' }));
  const nested = await resources.createResource(folderInput({ name: '嵌套私有', parentId: privateParent.id, visibility: 'private' }));
  const grandchild = await resources.createResource(fileInput({ name: '孙级文件', parentId: nested.id, visibility: 'private' }));

  const stored = (await resources.listResourcesForAdmin()).find((item) => item.id === publicChild.id);
  assert.equal(stored.visibility, 'public');
  assert.equal(stored.parentId, privateParent.id);

  assert.equal(await resources.getResource(privateParent.id), null);
  assert.equal(await resources.getResource(privateChild.id), null);
  assert.equal(await resources.getResource(publicChild.id), null);
  assert.equal(await resources.getResource(nested.id), null);
  assert.equal(await resources.getResource(grandchild.id), null);
  assert.equal((await resources.getResource(privateChild.id, true)).id, privateChild.id);
  assert.equal((await resources.getResource(publicChild.id, true)).id, publicChild.id);
  assert.equal((await resources.getResource(grandchild.id, true)).id, grandchild.id);

  await rejectsWith(resources.listResourceChildren(privateParent.id, false), 'ResourceValidationError', 'parentId');
  const privileged = await resources.listResourceChildren(privateParent.id, true);
  assert.deepEqual(
    privileged.items.map((item) => item.id).sort(),
    [privateChild.id, publicChild.id, nested.id].sort(),
  );

  await assert.rejects(
    resources.resolveResourceAccess(publicChild.id, false, 'preview'),
    (error) => error.name === 'ResourceAccessError' && error.status === 404,
  );
  await assert.rejects(
    resources.resolveResourceAccess(publicChild.id, false, 'download'),
    (error) => error.name === 'ResourceAccessError' && error.status === 404,
  );
  const preview = await resources.resolveResourceAccess(publicChild.id, true, 'preview');
  assert.equal(preview.url, fileSource.url);
  const download = await resources.resolveResourceAccess(publicChild.id, true, 'download');
  assert.equal(download.url, fileSource.url);

  const publicParent = await resources.createResource(folderInput({ name: '公开文件夹' }));
  const hidden = await resources.createResource(fileInput({ name: '隐藏文件', parentId: publicParent.id, visibility: 'private' }));
  const visible = await resources.createResource(fileInput({ name: '可见文件', parentId: publicParent.id }));
  const anonymous = await resources.listResourceChildren(publicParent.id, false);
  assert.deepEqual(anonymous.items.map((item) => item.id), [visible.id]);
  assert.equal(await resources.getResource(hidden.id), null);
  const privilegedChild = await resources.listResourceChildren(publicParent.id, true);
  assert.deepEqual(privilegedChild.items.map((item) => item.id).sort(), [hidden.id, visible.id].sort());
});

test('ancestor visibility flips take effect immediately without rewriting descendants', async () => {
  await reset();
  const parent = await resources.createResource(folderInput({ name: '父级' }));
  const childFolder = await resources.createResource(folderInput({ name: '子文件夹', parentId: parent.id }));
  const childFile = await resources.createResource(fileInput({ name: '子文件', parentId: childFolder.id }));

  const privateParent = await resources.updateResource(parent.id, { ...storedInput(parent), visibility: 'private' });
  assert.equal(await resources.getResource(childFolder.id), null);
  assert.equal(await resources.getResource(childFile.id), null);
  assert.equal((await resources.getResource(childFile.id, true)).id, childFile.id);
  await rejectsWith(resources.listResourceChildren(parent.id, false), 'ResourceValidationError', 'parentId');
  const privileged = await resources.listResourceChildren(parent.id, true);
  assert.deepEqual(privileged.items.map((item) => item.id), [childFolder.id]);
  await assert.rejects(
    resources.resolveResourceAccess(childFile.id, false, 'preview'),
    (error) => error.name === 'ResourceAccessError' && error.status === 404,
  );

  const publicParentAgain = await resources.updateResource(parent.id, { ...storedInput(privateParent), visibility: 'public' });
  assert.equal((await resources.getResource(childFolder.id)).id, childFolder.id);
  assert.equal((await resources.getResource(childFile.id)).id, childFile.id);
  await resources.updateResource(parent.id, { ...storedInput(publicParentAgain), visibility: 'private' });
  assert.equal(await resources.getResource(childFile.id), null);

  const privateBox = await resources.createResource(folderInput({ name: '私有盒', visibility: 'private' }));
  const moved = await resources.createResource(folderInput({ name: '被移动', visibility: 'public' }));
  const movedChild = await resources.createResource(fileInput({ name: '移动子项', parentId: moved.id, visibility: 'public' }));
  const movedRecord = await resources.updateResource(moved.id, { ...storedInput(moved), parentId: privateBox.id });
  assert.equal(movedRecord.parentId, privateBox.id);
  assert.equal(movedRecord.visibility, 'public');
  assert.equal(await resources.getResource(moved.id), null);
  assert.equal(await resources.getResource(movedChild.id), null);
  assert.equal((await resources.getResource(movedChild.id, true)).id, movedChild.id);

  await resources.updateResource(privateBox.id, { ...storedInput(privateBox), visibility: 'public' });
  assert.equal((await resources.getResource(moved.id)).id, moved.id);
  assert.equal((await resources.getResource(movedChild.id)).id, movedChild.id);
  const guestMoved = await resources.listResourceChildren(privateBox.id, false);
  assert.deepEqual(guestMoved.items.map((item) => item.id), [moved.id]);

  const saved = JSON.parse(await readFile(file, 'utf8'));
  const savedChildFolder = saved.find((item) => item.id === childFolder.id);
  assert.equal(savedChildFolder.visibility, 'public');
  assert.equal(savedChildFolder.updatedAt, childFolder.updatedAt);
  assert.equal(saved.find((item) => item.id === childFile.id).updatedAt, childFile.updatedAt);
  assert.equal(saved.find((item) => item.id === movedChild.id).updatedAt, movedChild.updatedAt);
});

test('updates cannot create cycles or move resources into their own subtree', async () => {
  await reset();
  const a = await resources.createResource(folderInput({ name: 'A' }));
  const b = await resources.createResource(folderInput({ name: 'B', parentId: a.id }));
  const leaf = await resources.createResource(fileInput({ name: 'leaf', parentId: b.id }));
  const before = await readFile(file, 'utf8');

  await rejectsWith(resources.updateResource(a.id, { ...storedInput(a), parentId: b.id }), 'ResourceValidationError', 'parentId');
  await rejectsWith(resources.updateResource(a.id, { ...storedInput(a), parentId: a.id }), 'ResourceValidationError', 'parentId');
  await rejectsWith(resources.updateResource(b.id, { ...storedInput(b), parentId: leaf.id }), 'ResourceValidationError', 'parentId');
  assert.equal(await readFile(file, 'utf8'), before);

  await rejectsWith(resources.updateResource(leaf.id, { ...storedInput(leaf), unit: 'mb' }), 'ResourceValidationError', 'unit');
  assert.equal(await readFile(file, 'utf8'), before);
});

test('deleting a folder removes only its subtree from the index', async () => {
  await reset();
  const root = await resources.createResource(folderInput({ name: 'root' }));
  const branch = await resources.createResource(folderInput({ name: 'branch', parentId: root.id }));
  const leaf = await resources.createResource(fileInput({ name: 'leaf', parentId: branch.id }));
  const sibling = await resources.createResource(fileInput({ name: 'sibling', parentId: root.id }));
  const outside = await resources.createResource(fileInput({ name: 'outside' }));

  await resources.deleteResource(branch.id);

  const remaining = (await resources.listResourcesForAdmin()).map((item) => item.id).sort();
  assert.deepEqual(remaining, [root.id, sibling.id, outside.id].sort());
  assert.equal(await resources.getResource(branch.id), null);
  assert.equal(await resources.getResource(leaf.id), null);
  assert.equal((await resources.getResource(sibling.id)).id, sibling.id);
  await rejectsWith(resources.deleteResource(branch.id), 'ResourceValidationError', 'id');
});

test('unsafe URLs, credential leaks and invalid source combinations are rejected without writing', async () => {
  await reset();
  const before = await readFile(file, 'utf8');

  const badUrls = [
    'http://cdn.example.com/a.mp4',
    'https://user:pass@cdn.example.com/a.mp4',
    'https://user@cdn.example.com/a.mp4',
    'https://localhost/a.mp4',
    'https://foo.localhost/a.mp4',
    'https://printer.local/a.mp4',
    'https://127.0.0.1/a.mp4',
    'https://127.1/a.mp4',
    'https://2130706433/a.mp4',
    'https://0x7f000001/a.mp4',
    'https://10.1.2.3/a.mp4',
    'https://172.16.4.4/a.mp4',
    'https://192.168.1.9/a.mp4',
    'https://169.254.10.10/a.mp4',
    'https://0.0.0.0/a.mp4',
    'https://224.0.0.1/a.mp4',
    'https://[::1]/a.mp4',
    'https://[::ffff:127.0.0.1]/a.mp4',
    'https://[::ffff:10.0.0.1]/a.mp4',
    'https://[fc00::1]/a.mp4',
    'https://[fe80::1]/a.mp4',
    '/lab/demo.glb',
    '/uploads/../secret.mp4',
    '/uploads/%2e%2e/secret.mp4',
    '/uploads/%252e%252e/secret.mp4',
    '/uploads/./secret.mp4',
    '//evil.example/a.mp4',
    'https://cdn.example.com/a b.mp4',
    'https://cdn.example.com\\@evil.example/a.mp4',
    `https://cdn.example.com/${'a'.repeat(8200)}.mp4`,
  ];
  for (const url of badUrls) {
    await rejectsWith(
      resources.createResource(fileInput({
        name: '视频',
        kind: 'video',
        source: { type: 'direct', url, format: 'mp4' },
      })),
      'ResourceValidationError',
      'source',
    );
  }

  const badSources = [
    { kind: 'video', source: { type: 'direct', url: 'https://cdn.example.com/a.mp4', format: 'avi' } },
    { kind: 'video', source: { type: 'direct', url: 'https://cdn.example.com/no-extension' } },
    { kind: 'video', source: { type: 'embed', provider: 'vimeo', videoId: 'abc' } },
    { kind: 'video', source: { type: 'embed', provider: 'youtube', videoId: 'short' } },
    { kind: 'video', source: { type: 'embed', provider: 'bilibili', videoId: 'BV123' } },
    { kind: 'video', source: { type: 'embed', provider: 'youtube', videoId: 'dQw4w9WgXcQ', url: 'https://x' } },
    { kind: 'model', source: { type: 'direct', url: 'https://cdn.example.com/a.glb', format: 'mp4' } },
    { kind: 'model', source: { type: 'direct', url: 'https://cdn.example.com/a.mp4' } },
    { kind: 'model', source: { type: 'embed', provider: 'youtube', videoId: 'dQw4w9WgXcQ' } },
    { kind: 'image', source: { type: 'direct', url: 'https://cdn.example.com/a.png', format: 'png' } },
    { kind: 'file', source: { type: 'direct', url: 'https://cdn.example.com/a.pdf', format: 'mp4' } },
    { kind: 'file' },
    { kind: 'folder', source: fileSource },
    { kind: 'video', source: { type: 'direct', url: 'https://cdn.example.com/a.mp4', format: 'mp4', expiresAt: 'tomorrow' } },
    { kind: 'video', source: { type: 'direct', url: 'https://cdn.example.com/a.mp4', format: 'mp4', token: 'secret' } },
    { kind: 'video', source: { type: 'raw', url: 'https://cdn.example.com/a.mp4' } },
  ];
  for (const patch of badSources) {
    await rejectsWith(resources.createResource({ ...BASE, name: '资源', ...patch }), 'ResourceValidationError', 'source');
  }

  for (const patch of [{ name: '' }, { name: 'a'.repeat(121) }, { description: 'a'.repeat(2001) }, { size: -1 }, { size: 1.5 }, { size: '10' }, { unit: 'mb' }, { kind: 'audio' }, { visibility: 'hidden' }, { parentId: 'not a valid id' }]) {
    await rejectsWith(resources.createResource(fileInput(patch)), 'ResourceValidationError');
  }

  assert.equal(await readFile(file, 'utf8'), before);
  assert.deepEqual(await resources.listResourcesForAdmin(), []);
});

test('valid direct, embed and same-origin sources are stored with inferred formats', async () => {
  await reset();
  const hls = await resources.createResource(fileInput({
    name: 'hls',
    kind: 'video',
    source: { type: 'direct', url: 'https://cdn.example.com/live/index.m3u8' },
  }));
  assert.equal(hls.source.format, 'hls');

  const externalModel = await resources.createResource(fileInput({
    name: '外部模型',
    kind: 'model',
    source: { type: 'direct', url: 'https://cdn.example.com/models/demo.glb' },
  }));
  assert.equal(externalModel.source.format, 'glb');

  const uploadModel = await resources.createResource(fileInput({
    name: '上传模型',
    kind: 'model',
    source: { type: 'direct', url: '/uploads/models/scene.glb' },
  }));
  assert.equal(uploadModel.source.format, 'glb');

  const publicV6 = await resources.createResource(fileInput({
    name: '公网 IPv6',
    kind: 'video',
    source: { type: 'direct', url: 'https://[2606:4700:4700::1111]/a.mp4', format: 'mp4' },
  }));
  assert.equal(publicV6.source.format, 'mp4');

  const publicV4 = await resources.createResource(fileInput({
    name: '公网 IPv4',
    kind: 'video',
    source: { type: 'direct', url: 'https://172.15.0.1/a.mp4', format: 'mp4' },
  }));
  assert.equal(publicV4.source.format, 'mp4');

  const embed = await resources.createResource(fileInput({
    name: '嵌入视频',
    kind: 'video',
    source: { type: 'embed', provider: 'youtube', videoId: 'dQw4w9WgXcQ' },
  }));
  assert.deepEqual(embed.source, { type: 'embed', provider: 'youtube', videoId: 'dQw4w9WgXcQ' });
});

test('expired and privatised sources fail with the right access status', async () => {
  await reset();
  const past = await resources.createResource(fileInput({
    name: '过期',
    kind: 'video',
    source: { type: 'direct', url: 'https://cdn.example.com/old.mp4', format: 'mp4', expiresAt: '2020-01-01T00:00:00Z' },
  }));
  assert.equal(past.source.expiresAt, '2020-01-01T00:00:00.000Z');
  await assert.rejects(
    resources.resolveResourceAccess(past.id, true, 'preview'),
    (error) => error.name === 'ResourceAccessError' && error.status === 410,
  );

  const future = await resources.createResource(fileInput({
    name: '有效',
    kind: 'video',
    source: { type: 'direct', url: 'https://cdn.example.com/new.mp4', format: 'mp4', expiresAt: '2999-01-01T00:00:00Z' },
  }));
  const source = await resources.resolveResourceAccess(future.id, false, 'preview');
  assert.equal(source.url, 'https://cdn.example.com/new.mp4');

  const privateVideo = await resources.createResource(fileInput({
    name: '私有视频',
    kind: 'video',
    visibility: 'private',
    source: { type: 'embed', provider: 'youtube', videoId: 'dQw4w9WgXcQ' },
  }));
  await assert.rejects(
    resources.resolveResourceAccess(privateVideo.id, false, 'preview'),
    (error) => error.name === 'ResourceAccessError' && error.status === 404,
  );
  const preview = await resources.resolveResourceAccess(privateVideo.id, true, 'preview');
  assert.equal(preview.provider, 'youtube');
  await assert.rejects(
    resources.resolveResourceAccess(privateVideo.id, true, 'download'),
    (error) => error.name === 'ResourceAccessError' && error.status === 400,
  );

  const folder = await resources.createResource(folderInput({ name: '文件夹' }));
  await assert.rejects(
    resources.resolveResourceAccess(folder.id, true, 'download'),
    (error) => error.name === 'ResourceAccessError' && error.status === 400,
  );
  await assert.rejects(
    resources.resolveResourceAccess('missing', true, 'preview'),
    (error) => error.name === 'ResourceAccessError' && error.status === 404,
  );
  await assert.rejects(
    resources.resolveResourceAccess('bad id!', true, 'preview'),
    (error) => error.name === 'ResourceAccessError' && error.status === 404,
  );
});

test('corrupt or inconsistent files stay untouched and every write fails closed', async () => {
  const now = new Date().toISOString();
  const record = (id, patch = {}) => ({
    id,
    name: '资源',
    description: '',
    kind: 'file',
    parentId: null,
    visibility: 'public',
    source: { type: 'direct', url: 'https://files.example.com/x.pdf' },
    createdAt: now,
    updatedAt: now,
    ...patch,
  });
  const brokenFiles = [
    '{broken',
    '{}',
    '[null]',
    JSON.stringify([record('same'), record('same')]),
    JSON.stringify([record('video', { kind: 'video' })]),
    JSON.stringify([record('child', { parentId: 'missing' })]),
    JSON.stringify([record('parent-file'), record('child', { parentId: 'parent-file' })]),
    JSON.stringify([record('a', { kind: 'folder', parentId: 'b', source: undefined }), record('b', { kind: 'folder', parentId: 'a', source: undefined })]),
    JSON.stringify([record('bad-time', { createdAt: 'yesterday' })]),
  ];

  for (const broken of brokenFiles) {
    await writeFile(file, broken);
    await rejectsWith(resources.listResourcesForAdmin(), 'ResourcesDataError');
    await rejectsWith(resources.createResource(folderInput({ name: '新文件夹' })), 'ResourcesDataError');
    await rejectsWith(resources.deleteResource('same'), 'ResourcesDataError');
    assert.equal(await readFile(file, 'utf8'), broken);
  }
});

test('concurrent creates and cursor pagination keep every record', async () => {
  await reset();
  const folder = await resources.createResource(folderInput({ name: '分页' }));
  const created = await Promise.all(
    Array.from({ length: 55 }, (_, index) => resources.createResource(fileInput({
      name: `f-${String(index).padStart(2, '0')}`,
      parentId: folder.id,
    }))),
  );
  assert.equal(new Set(created.map((item) => item.id)).size, 55);
  const admin = await resources.listResourcesForAdmin();
  assert.equal(admin.length, 56);

  const first = await resources.listResourceChildren(folder.id, false);
  assert.equal(first.items.length, 50);
  assert.equal(first.nextCursor, '50');
  assert.deepEqual(first.items.map((item) => item.name), created.map((item) => item.name).sort().slice(0, 50));

  const second = await resources.listResourceChildren(folder.id, false, first.nextCursor);
  assert.equal(second.items.length, 5);
  assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 55);

  const beyond = await resources.listResourceChildren(folder.id, false, '500');
  assert.deepEqual(beyond.items, []);
  assert.equal(beyond.nextCursor, null);

  for (const cursor of ['-1', '1.5', 'abc', '99999999999999999999']) {
    await rejectsWith(resources.listResourceChildren(folder.id, false, cursor), 'ResourceValidationError', 'cursor');
  }
  await rejectsWith(resources.listResourceChildren('missing', false), 'ResourceValidationError', 'parentId');
});

test('resource origins are deduplicated HTTPS origins only', async () => {
  await reset();
  await resources.createResource(fileInput({
    name: '一',
    kind: 'video',
    source: { type: 'direct', url: 'https://cdn.example.com/a.mp4', format: 'mp4' },
  }));
  await resources.createResource(fileInput({
    name: '二',
    kind: 'video',
    visibility: 'private',
    source: { type: 'direct', url: 'https://cdn.example.com/other/b.webm', format: 'webm' },
  }));
  await resources.createResource(fileInput({
    name: '三',
    kind: 'model',
    source: { type: 'direct', url: '/uploads/models/scene.glb' },
  }));
  assert.deepEqual(await resources.getResourceOrigins(), ['https://cdn.example.com']);
});

test('unlisted resources stay out of anonymous listings but remain readable by id', async () => {
  await reset();
  const unlisted = await resources.createResource(fileInput({
    name: '未列目录视频',
    kind: 'video',
    listed: false,
    source: { type: 'direct', url: 'https://media.example.com/quiet.mp4', format: 'mp4' },
  }));
  assert.equal(unlisted.listed, false);
  const listedByDefault = await resources.createResource(fileInput({
    name: '默认列出',
    kind: 'video',
    source: { type: 'direct', url: 'https://media.example.com/loud.mp4', format: 'mp4' },
  }));
  assert.equal('listed' in listedByDefault, false);

  const anonymous = await resources.listResourceChildren(null, false);
  assert.deepEqual(anonymous.items.map((item) => item.id), [listedByDefault.id]);
  const staff = await resources.listResourceChildren(null, true);
  assert.deepEqual(staff.items.map((item) => item.id).sort(), [unlisted.id, listedByDefault.id].sort());

  // Direct access is unchanged: listed only hides the entry from directory listings.
  const detail = await resources.getResource(unlisted.id);
  assert.equal(detail.id, unlisted.id);
  const source = await resources.resolveResourceAccess(unlisted.id, false, 'preview');
  assert.equal(source.url, 'https://media.example.com/quiet.mp4');
  const summary = (await resources.listResourceChildren(null, true)).items.find((item) => item.id === unlisted.id);
  assert.equal(summary.listed, false);
  assert.equal('source' in summary, false);

  // Unlisted external origins still need to pass CSP for a published article to play them.
  assert.deepEqual(await resources.getResourceOrigins(), ['https://media.example.com']);

  // Omitting or sending true keeps an entry listed; a non-boolean is rejected outright.
  const explicitListed = await resources.createResource(fileInput({ name: '显式列出', listed: true }));
  assert.equal(explicitListed.listed, true);
  const visible = await resources.listResourceChildren(null, false);
  assert.equal(visible.items.some((item) => item.id === explicitListed.id), true);
  await rejectsWith(resources.createResource(fileInput({ name: '错误', listed: 'no' })), 'ResourceValidationError', 'listed');
  await rejectsWith(resources.createResource(fileInput({ name: '错误', listed: 1 })), 'ResourceValidationError', 'listed');
});

test('private ancestors hide unlisted entries from staff-less listings and direct reads', async () => {
  await reset();
  const privateFolder = await resources.createResource(folderInput({ name: '私有', visibility: 'private', listed: false }));
  const child = await resources.createResource(fileInput({
    name: '子视频',
    kind: 'video',
    parentId: privateFolder.id,
    listed: false,
    source: { type: 'direct', url: 'https://media.example.com/hidden.mp4', format: 'mp4' },
  }));
  assert.equal(await resources.getResource(child.id), null);
  assert.equal((await resources.getResource(child.id, true)).id, child.id);
  await rejectsWith(resources.listResourceChildren(privateFolder.id, false), 'ResourceValidationError', 'parentId');
  const staff = await resources.listResourceChildren(privateFolder.id, true);
  assert.deepEqual(staff.items.map((item) => item.id), [child.id]);
  assert.equal((await resources.listResourceChildren(null, false)).items.length, 0);
  assert.equal((await resources.listResourceChildren(null, true)).items.length, 1);
});

test('stored video bytes follow the records that point at them', async () => {
  await reset();
  const publicUnlistedUrl = '/uploads/videos/11111111-1111-4111-8111-111111111111.mp4';
  const privateUrl = '/uploads/videos/22222222-2222-4222-8222-222222222222.webm';
  const orphanUrl = '/uploads/videos/33333333-3333-4333-8333-333333333333.mp4';
  const nestedUrl = '/uploads/videos/44444444-4444-4444-8444-444444444444.mp4';

  const publicUnlisted = await resources.createResource(fileInput({
    name: '公开但未列目录',
    kind: 'video',
    listed: false,
    source: { type: 'direct', url: publicUnlistedUrl, format: 'mp4' },
  }));
  await resources.createResource(fileInput({
    name: '私有视频',
    kind: 'video',
    visibility: 'private',
    listed: false,
    source: { type: 'direct', url: privateUrl, format: 'webm' },
  }));
  const privateFolder = await resources.createResource(folderInput({ name: '私有目录', visibility: 'private' }));
  await resources.createResource(fileInput({
    name: '私有目录中的公开视频',
    kind: 'video',
    parentId: privateFolder.id,
    listed: false,
    source: { type: 'direct', url: nestedUrl, format: 'mp4' },
  }));

  assert.equal(await resources.canAccessStoredVideo(publicUnlistedUrl, false), true);
  assert.equal(await resources.canAccessStoredVideo(publicUnlistedUrl, true), true);
  assert.equal(await resources.canAccessStoredVideo(privateUrl, false), false);
  assert.equal(await resources.canAccessStoredVideo(privateUrl, true), true);
  // Ancestor visibility still decides, even though the child itself is public.
  assert.equal(await resources.canAccessStoredVideo(nestedUrl, false), false);
  assert.equal(await resources.canAccessStoredVideo(nestedUrl, true), true);
  // No record, a different record's URL, or a traversal-laden string never grants access.
  assert.equal(await resources.canAccessStoredVideo(orphanUrl, false), false);
  assert.equal(await resources.canAccessStoredVideo(orphanUrl, true), false);
  assert.equal(await resources.canAccessStoredVideo('https://media.example.com/a.mp4', true), false);
  assert.equal(await resources.canAccessStoredVideo('/uploads/videos/../resources.json', true), false);

  await resources.deleteResource(publicUnlisted.id);
  assert.equal(await resources.canAccessStoredVideo(publicUnlistedUrl, false), false);
  assert.equal(await resources.canAccessStoredVideo(publicUnlistedUrl, true), false);

  // Making the owning record private revokes anonymous access without touching the file.
  const record = (await resources.listResourcesForAdmin()).find((item) => item.source?.url === privateUrl);
  await resources.updateResource(record.id, { ...storedInput(record), visibility: 'private', listed: false });
  assert.equal(await resources.canAccessStoredVideo(privateUrl, false), false);
  await resources.updateResource(record.id, { ...storedInput(record), visibility: 'public', listed: true });
  assert.equal(await resources.canAccessStoredVideo(privateUrl, false), true);
});
