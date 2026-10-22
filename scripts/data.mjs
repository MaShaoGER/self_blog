import { promises as fs, constants } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { resolveDataDir } from '../lib/data-path.mjs';

const repository = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const within = (root, target) => target === root || target.startsWith(root + path.sep);

function safeTarget(target) {
  if (within(repository, target)) throw new Error('运行数据目录必须位于源码目录之外');
}

async function manifest(root) {
  const files = new Map();
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.name.endsWith('.tmp')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error('数据目录包含符号链接，请先处理后再迁移');
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        files.set(path.relative(root, full), createHash('sha256').update(await fs.readFile(full)).digest('hex'));
      } else throw new Error('数据目录中有不支持的特殊文件');
    }
  }
  await walk(root);
  return files;
}

const same = (left, right) => left.size === right.size && [...left].every(([name, hash]) => right.get(name) === hash);

async function ensureDirectories(target) {
  await fs.mkdir(path.join(target, 'posts'), { recursive: true });
  await fs.mkdir(path.join(target, 'uploads'), { recursive: true });
}

export async function migrateData(source, target) {
  source = path.resolve(source); target = path.resolve(target);
  safeTarget(target);
  if (within(source, target) || within(target, source)) throw new Error('源目录与目标目录必须互相独立');
  const original = await manifest(source);
  await fs.mkdir(target, { recursive: true });
  const existing = await manifest(target);
  if (existing.size) {
    if (!same(original, existing)) throw new Error('目标目录已有不同数据，拒绝覆盖');
    await ensureDirectories(target);
    return { status: 'already-copied', files: original.size };
  }
  for (const name of original.keys()) {
    const destination = path.join(target, name);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(path.join(source, name), destination, constants.COPYFILE_EXCL);
    if (name === 'accounts.json') await fs.chmod(destination, 0o600);
  }
  if (!same(original, await manifest(source))) throw new Error('源数据在复制期间发生变化，请停止应用后重新迁移');
  if (!same(original, await manifest(target))) throw new Error('迁移校验失败，原目录保持完整');
  await ensureDirectories(target);
  return { status: 'copied-and-verified', files: original.size };
}

export async function initializeData(target, demo = false) {
  target = path.resolve(target);
  safeTarget(target);
  if (demo) return migrateData(path.join(repository, 'examples/data'), target);
  await ensureDirectories(target);
  return { status: 'initialized', directory: target };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  let target;
  let source;
  let demo = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--') continue;
    if (argument === '--demo') { demo = true; continue; }
    if ((argument === '--to' || argument === '--from') && args[index + 1]) {
      if (argument === '--to') target = path.resolve(args[++index]);
      else source = path.resolve(args[++index]);
      continue;
    }
    throw new Error(`未知参数：${argument}`);
  }
  if (!target) {
    if (!process.env.BLOG_DATA_DIR) {
      for (const name of ['.env.local', '.env']) {
        try { loadEnvFile(path.join(repository, name)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    }
    target = resolveDataDir(repository);
  }
  if (command === 'init') console.log(JSON.stringify(await initializeData(target, demo)));
  else if (command === 'migrate' && source) console.log(JSON.stringify(await migrateData(source, target)));
  else throw new Error('用法：node scripts/data.mjs init [--demo] [--to PATH]，或 migrate --from PATH [--to PATH]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
