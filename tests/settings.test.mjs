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

test('legacy settings receive complete navigation/footer defaults and merge nested patches', async () => {
  await writeFile(file, JSON.stringify({ title: '旧站', navigation: { archive: { label: '旧档案' } }, footer: { buildValue: '手写站点' } }));
  const initial = await getSettings();
  assert.equal(initial.navigation.archive.label, '旧档案');
  assert.equal(initial.navigation.archive.en, 'INDEX');
  assert.equal(initial.navigation.search.label, '搜索');
  assert.equal(initial.footer.brandPrefix, 'SELF_BLOG');
  await saveSettings({ navigation: { archive: { en: '' }, home: { label: '随笔' } }, footer: { description: ' 新的页脚说明 ' } });
  await saveSettings({ title: '新站' });
  const saved = await getSettings();
  assert.equal(saved.navigation.archive.label, '旧档案');
  assert.equal(saved.navigation.archive.en, '');
  assert.equal(saved.navigation.home.label, '随笔');
  assert.equal(saved.footer.description, '新的页脚说明');
  assert.equal(saved.footer.buildValue, '手写站点');
});

test('malformed navigation and footer patches do not change the file', async () => {
  await writeFile(file, JSON.stringify({ title: '原始标题' }));
  const before = await readFile(file, 'utf8');
  for (const patch of [
    { navigation: null }, { navigation: [] }, { navigation: { archive: null } },
    { navigation: { home: { label: '' } } }, { navigation: { home: { label: '长'.repeat(9) } } },
    { navigation: { home: { en: 'a'.repeat(17) } } }, { navigation: { search: { label: 2 } } },
    { navigation: { arbitrary: { label: '链接' } } }, { navigation: { home: { href: 'https://other.test' } } },
    { footer: [] }, { footer: null }, { footer: { brandPrefix: '' } },
    { footer: { buildValue: 'a'.repeat(101) } }, { footer: { manageLabel: 2 } },
  ]) await assert.rejects(saveSettings(patch));
  assert.equal(await readFile(file, 'utf8'), before);
});
