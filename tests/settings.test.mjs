import './register-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const dir = await mkdtemp(path.join(os.tmpdir(), 'blog-settings-'));
process.env.BLOG_DATA_DIR = dir;
const { getSettings, saveSettings } = await import('../lib/settings.ts');
test.after(() => rm(dir, { recursive: true, force: true }));
const file = path.join(dir, 'settings.json');

test('legacy files receive homepage defaults without losing authored settings', async () => {
  await writeFile(file, JSON.stringify({ title: '我的笔记', futureSetting: { enabled: true }, homepage: { latestLabel: '开始阅读', futureLabel: '保留' } }));
  const value = await getSettings();
  assert.equal(value.title, '我的笔记');
  assert.equal(value.homepage.latestLabel, '开始阅读');
  assert.equal(value.homepage.indexLabel, 'INDEX / 目录');
  assert.deepEqual(value.futureSetting, { enabled: true });
});

test('partial homepage changes persist and preserve other labels and unknown settings', async () => {
  await writeFile(file, JSON.stringify({ title: '旧标题', futureSetting: 7, homepage: { latestLabel: '继续阅读', futureLabel: '保留' } }));
  await saveSettings({ homepage: { indexLabel: '文章目录' } });
  await saveSettings({ title: '新标题' });
  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(saved.title, '新标题');
  assert.equal(saved.homepage.indexLabel, '文章目录');
  assert.equal(saved.homepage.latestLabel, '继续阅读');
  assert.equal(saved.homepage.futureLabel, '保留');
  assert.equal(saved.futureSetting, 7);
  assert.equal((await getSettings()).homepage.statusOnline, 'SYS.ONLINE');
});

test('invalid patches are rejected before changing the settings file', async () => {
  await writeFile(file, JSON.stringify({ title: '原始标题' }));
  const before = await readFile(file, 'utf8');
  for (const patch of [
    { homepage: { latestLabel: '' } },
    { homepage: { latestLabel: 42 } },
    { homepage: { latestLabel: 'a'.repeat(121) } },
    { homepage: null },
    { title: '' },
    { commentsAutoApprove: 'yes' },
  ]) await assert.rejects(saveSettings(patch));
  assert.equal(await readFile(file, 'utf8'), before);
});

test('optional homepage category copy can be cleared and required labels are trimmed', async () => {
  await saveSettings({ homepage: { categoryLine: '', latestLabel: ' 阅读最新 ' } });
  const value = await getSettings();
  assert.equal(value.homepage.categoryLine, '');
  assert.equal(value.homepage.latestLabel, '阅读最新');
});
