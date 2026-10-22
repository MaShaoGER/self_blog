import "./register-source.mjs";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import sharp from "sharp";

const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "self-blog-uploads-"));
process.env.BLOG_DATA_DIR = dataDir;
const { saveUpload, resolveUpload, UploadError } = await import("../lib/uploads.ts");
after(() => fs.rm(dataDir, { recursive: true, force: true }));

test("loading the upload module blocks SVG before native metadata parsing", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>');
  await assert.rejects(sharp(svg).metadata(), /unsupported|blocked/i);
  await assert.rejects(saveUpload(svg), UploadError);
  assert.deepEqual(await fs.readdir(dataDir), []);
});

test("raster upload produces a bounded WebP without source metadata", async () => {
  const source = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#e8531f" } })
    .jpeg()
    .withMetadata()
    .toBuffer();
  const item = await saveUpload(source);
  const file = resolveUpload(item.path);
  assert.ok(file);
  assert.match(item.url, /^\/uploads\/\d{4}\/\d{2}\/[\w-]+\.webp$/);
  assert.equal(item.width, 2400);
  assert.equal(item.height, 1200);
  const saved = await fs.readFile(file);
  assert.equal(item.size, saved.length);
  const metadata = await sharp(saved).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 2400);
  assert.equal(metadata.height, 1200);
  assert.equal(metadata.exif, undefined);
  assert.equal(metadata.icc, undefined);
});

test("invalid image buffers fail as upload errors", async () => {
  await assert.rejects(saveUpload(Buffer.alloc(0)), UploadError);
  await assert.rejects(saveUpload(Buffer.from("not an image")), UploadError);
  await assert.rejects(saveUpload(Buffer.alloc(15 * 1024 * 1024 + 1)), UploadError);
});

test("upload paths cannot escape the data directory", () => {
  assert.equal(resolveUpload("../settings.json"), null);
  assert.equal(resolveUpload("../../secret.png"), null);
  assert.equal(resolveUpload(""), null);
  assert.equal(resolveUpload(path.join(dataDir, "outside.webp")), null);
});
