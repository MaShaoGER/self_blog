import './register-source.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Real stream/file IO against a throwaway data directory; nothing outside it is touched.
const dataDir = await mkdtemp(path.join(os.tmpdir(), 'blog-videos-'));
process.env.BLOG_DATA_DIR = dataDir;

const { saveVideoStream, deleteStoredVideo, serveVideoRequest, VideoUploadError } = await import('../lib/videos.ts');
const { parseVideoLink, VideoLinkError } = await import('../shared/video-links.ts');
const { MAX_VIDEO_BYTES } = await import('../shared/video-types.ts');

const videosDir = path.join(dataDir, 'uploads', 'videos');

test.after(() => rm(dataDir, { recursive: true, force: true }));

async function storedEntries() {
  try {
    return await readdir(videosDir);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Minimal ISO-BMFF header: an ftyp box with the usual isom/iso2/avc1/mp41 brands
 * followed by an mdat box. This is the byte layout browsers serve for normal MP4.
 */
function mp4Fixture(payloadBytes = 2048) {
  const ftyp = Buffer.alloc(32);
  ftyp.writeUInt32BE(32, 0);
  ftyp.write('ftyp', 4, 'ascii');
  ftyp.write('isom', 8, 'ascii');
  ftyp.writeUInt32BE(0x200, 12);
  ftyp.write('isomiso2avc1mp41', 16, 'ascii');
  const payload = Buffer.alloc(payloadBytes, 0x21);
  const mdat = Buffer.alloc(8);
  mdat.writeUInt32BE(8 + payloadBytes, 0);
  mdat.write('mdat', 4, 'ascii');
  return Buffer.concat([ftyp, mdat, payload]);
}

/** Minimal EBML header carrying DocType "webm", then an unknown-size Segment. */
function webmFixture(payloadBytes = 2048) {
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0xa0]),
    Buffer.from([0x42, 0x86, 0x81, 0x01]),
    Buffer.from([0x42, 0xf7, 0x81, 0x01]),
    Buffer.from([0x42, 0xf2, 0x81, 0x04]),
    Buffer.from([0x42, 0xf3, 0x81, 0x08]),
    Buffer.from([0x42, 0x82, 0x84]),
    Buffer.from('webm', 'ascii'),
    Buffer.from([0x42, 0x87, 0x81, 0x02]),
    Buffer.from([0x42, 0x85, 0x81, 0x02]),
    Buffer.from([0x18, 0x53, 0x80, 0x67, 0xff]),
    Buffer.alloc(payloadBytes, 0x55),
  ]);
}

function streamOf(buffer, chunkSize = 512) {
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

async function responseBytes(response) {
  return Buffer.from(await response.arrayBuffer());
}

async function putVideoFile(name, bytes) {
  await mkdir(videosDir, { recursive: true });
  await writeFile(path.join(videosDir, name), bytes, { mode: 0o600 });
}

function GET(name, headers = {}) {
  return new Request(`http://localhost/uploads/videos/${name}`, { headers });
}

// ---------- Link normalisation (no network access) ----------

test('youtube page, short, shorts and embed links normalise to an exact eleven character id', () => {
  const cases = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
    'https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=tracking',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
  ];
  for (const link of cases) {
    assert.deepEqual(parseVideoLink(`  ${link}  `), {
      type: 'embed',
      provider: 'youtube',
      videoId: 'dQw4w9WgXcQ',
    });
  }
});

test('bilibili video pages and canonical player links normalise to BV/av ids', () => {
  assert.deepEqual(parseVideoLink('https://www.bilibili.com/video/BV1xx411c7mD?p=2'), {
    type: 'embed',
    provider: 'bilibili',
    videoId: 'BV1xx411c7mD',
  });
  assert.deepEqual(parseVideoLink('https://bilibili.com/video/BV1xx411c7mD/'), {
    type: 'embed',
    provider: 'bilibili',
    videoId: 'BV1xx411c7mD',
  });
  assert.deepEqual(parseVideoLink('https://m.bilibili.com/video/av170001'), {
    type: 'embed',
    provider: 'bilibili',
    videoId: 'av170001',
  });
  assert.deepEqual(parseVideoLink('https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&page=1'), {
    type: 'embed',
    provider: 'bilibili',
    videoId: 'BV1xx411c7mD',
  });
  assert.deepEqual(parseVideoLink('https://player.bilibili.com/player.html?aid=170001&autoplay=0'), {
    type: 'embed',
    provider: 'bilibili',
    videoId: 'av170001',
  });
});

test('short links and host spoofing never turn into remote fetches', () => {
  for (const link of ['https://b23.tv/abc123', 'https://www.b23.tv/abc123']) {
    assert.throws(() => parseVideoLink(link), VideoLinkError);
  }
  // A lookalike host is not YouTube, so it falls back to the opaque-direct rule.
  assert.throws(() => parseVideoLink('https://www.youtube.com.evil.example/watch?v=dQw4w9WgXcQ'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://evil.example/www.youtube.com/watch?v=dQw4w9WgXcQ'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://www.youtube.com@evil.example/watch?v=dQw4w9WgXcQ'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://www.youtube.com/watch?v=short'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&v=aaaaaaaaaaa'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://youtu.be/dQw4w9WgXcQ/extra'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://www.youtube.com/playlist?list=PL123'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://www.bilibili.com/video/BV123'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://www.bilibili.com/video/BV1xx411c7mD/extra'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://player.bilibili.com/player.html?bvid=short&aid=170001'), VideoLinkError);
});

test('direct media URLs infer their format from the pathname only', () => {
  assert.deepEqual(parseVideoLink('https://cdn.example.com/media/clip.mp4?token=abc#t=4'), {
    type: 'direct',
    url: 'https://cdn.example.com/media/clip.mp4?token=abc#t=4',
    format: 'mp4',
  });
  assert.deepEqual(parseVideoLink('https://cdn.example.com/media/CLIP.WEBM'), {
    type: 'direct',
    url: 'https://cdn.example.com/media/CLIP.WEBM',
    format: 'webm',
  });
  assert.deepEqual(parseVideoLink('https://cdn.example.com/live/index.m3u8'), {
    type: 'direct',
    url: 'https://cdn.example.com/live/index.m3u8',
    format: 'hls',
  });
  // Query strings are ignored for detection, so an opaque path needs an explicit format.
  assert.throws(() => parseVideoLink('https://cdn.example.com/stream?id=clip.mp4'), VideoLinkError);
  assert.deepEqual(parseVideoLink('https://cdn.example.com/stream?id=clip', 'mp4'), {
    type: 'direct',
    url: 'https://cdn.example.com/stream?id=clip',
    format: 'mp4',
  });
  assert.throws(() => parseVideoLink('https://cdn.example.com/clip.mp4', 'webm'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://cdn.example.com/clip.mp4', 'hls'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://cdn.example.com/clip.mp4', 'avi'), VideoLinkError);
  assert.throws(() => parseVideoLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'mp4'), VideoLinkError);
});

test('encoded query strings remain opaque while encoded traversal paths are rejected', () => {
  for (const url of [
    'https://cdn.example.com/clip.mp4?name=100%25',
    'https://cdn.example.com/clip.mp4?token=%252F%252E%252E%252F#part%25',
  ]) {
    assert.deepEqual(parseVideoLink(url), { type: 'direct', url, format: 'mp4' });
  }
  assert.throws(() => parseVideoLink('https://cdn.example.com/%252e%252e/clip.mp4?name=100%25'), VideoLinkError);
});


test('unsafe schemes, credentials, internal hosts and local paths are rejected', () => {
  const unsafe = [
    'http://cdn.example.com/clip.mp4',
    'javascript:alert(1)',
    'data:video/mp4;base64,AAAA',
    'file:///etc/passwd',
    'ftp://cdn.example.com/clip.mp4',
    'https://user:pass@cdn.example.com/clip.mp4',
    'https://user@cdn.example.com/clip.mp4',
    'https://localhost/clip.mp4',
    'https://foo.localhost/clip.mp4',
    'https://printer.local/clip.mp4',
    'https://127.0.0.1/clip.mp4',
    'https://10.0.0.5/clip.mp4',
    'https://192.168.1.9/clip.mp4',
    'https://169.254.1.1/clip.mp4',
    'https://[::1]/clip.mp4',
    'https://[fc00::1]/clip.mp4',
    'https://cdn.example.com/clip.mp4\\@evil.example',
    'https://cdn.example.com/../clip.mp4',
    '//cdn.example.com/clip.mp4',
    '/uploads/videos/../../resources.json',
    '/uploads/videos/not-a-uuid.mp4',
    `/uploads/videos/${randomUUID()}.mov`,
    '   ',
    '',
  ];
  for (const link of unsafe) {
    assert.throws(() => parseVideoLink(link), VideoLinkError);
  }
  assert.throws(() => parseVideoLink(`https://cdn.example.com/${'a'.repeat(9000)}.mp4`), VideoLinkError);
  assert.throws(() => parseVideoLink('https://cdn.example.com/clip.mp4', 'mp4'.repeat(30)), VideoLinkError);
});

test('own uploaded videos are accepted as a direct same-origin source', () => {
  const id = randomUUID();
  assert.deepEqual(parseVideoLink(`/uploads/videos/${id}.mp4`), {
    type: 'direct',
    url: `/uploads/videos/${id}.mp4`,
    format: 'mp4',
  });
  assert.deepEqual(parseVideoLink(`/uploads/videos/${id}.webm`, 'webm'), {
    type: 'direct',
    url: `/uploads/videos/${id}.webm`,
    format: 'webm',
  });
  assert.throws(() => parseVideoLink(`/uploads/videos/${id}.webm`, 'mp4'), VideoLinkError);
});

// ---------- Streaming storage ----------

test('streamed MP4 and WebM uploads land atomically with private permissions', async () => {
  await rm(videosDir, { recursive: true, force: true });
  const mp4 = mp4Fixture(4096);
  const savedMp4 = await saveVideoStream(streamOf(mp4, 700), {
    name: '旅行 片段.mp4',
    mimeType: 'video/mp4',
    size: mp4.length,
  });
  assert.match(savedMp4.url, /^\/uploads\/videos\/[0-9a-f-]{36}\.mp4$/);
  assert.equal(savedMp4.format, 'mp4');
  assert.equal(savedMp4.mimeType, 'video/mp4');
  assert.equal(savedMp4.size, mp4.length);
  const mp4OnDisk = await readFile(savedMp4.path);
  assert.deepEqual(mp4OnDisk, mp4);
  assert.equal((await stat(savedMp4.path)).mode & 0o777, 0o600);

  const webm = webmFixture(3000);
  const savedWebm = await saveVideoStream(streamOf(webm, 333), {
    name: 'clip.webm',
    mimeType: 'video/webm',
  });
  assert.match(savedWebm.url, /^\/uploads\/videos\/[0-9a-f-]{36}\.webm$/);
  assert.equal(savedWebm.size, webm.length);
  assert.deepEqual(await readFile(savedWebm.path), webm);

  const entries = await storedEntries();
  assert.deepEqual(entries.sort(), [path.basename(savedMp4.path), path.basename(savedWebm.path)].sort());
  assert.equal(entries.some((name) => name.endsWith('.part') || name.endsWith('.tmp')), false);
});

test('forged MIME, wrong extensions, empty bodies and truncated headers leave no files', async () => {
  await rm(videosDir, { recursive: true, force: true });
  const mp4 = mp4Fixture(64);
  const webm = webmFixture(64);

  const cases = [
    { name: 'clip.mp4', mimeType: 'video/mp4', body: webm, status: 415 },
    { name: 'clip.webm', mimeType: 'video/webm', body: mp4, status: 415 },
    { name: 'clip.webm', mimeType: 'video/mp4', body: mp4, status: 415 },
    { name: 'clip.mp4', mimeType: 'video/quicktime', body: mp4, status: 415 },
    { name: 'clip.mp4', mimeType: 'video/webm', body: webm, status: 415 },
    { name: 'clip.mp4', mimeType: 'video/mp4', body: Buffer.alloc(0), status: 400 },
    { name: 'clip.mp4', mimeType: 'video/mp4', body: Buffer.from('not a video'), status: 415 },
    { name: 'clip.mp4', mimeType: 'video/mp4', body: Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70]), status: 400 },
    { name: 'clip.webm', mimeType: 'video/webm', body: webm.subarray(0, 12), status: 400 },
  ];
  // QuickTime/MOV ftyp must not pass as MP4.
  const mov = Buffer.from(mp4Fixture(32));
  mov.write('qt  ', 8, 'ascii');
  cases.push({ name: 'clip.mp4', mimeType: 'video/mp4', body: mov, status: 415 });

  for (const item of cases) {
    await assert.rejects(
      saveVideoStream(streamOf(item.body), { name: item.name, mimeType: item.mimeType }),
      (error) => error instanceof VideoUploadError && error.status === item.status,
    );
  }
  assert.deepEqual(await storedEntries(), []);
});

test('ftyp box boundaries reject truncated uploads without confusing the sniff window with EOF', async () => {
  await rm(videosDir, { recursive: true, force: true });
  const ordinary = mp4Fixture(64);
  const oversizedBox = mp4Fixture(5000);
  oversizedBox.writeUInt32BE(9000, 0);
  for (const body of [ordinary.subarray(0, 12), ordinary.subarray(0, 16), oversizedBox]) {
    await assert.rejects(
      saveVideoStream(streamOf(body, 7), { name: 'cut.mp4', mimeType: 'video/mp4', size: body.length }),
      error => error instanceof VideoUploadError && error.status === 400,
    );
    assert.deepEqual(await storedEntries(), []);
  }

  const largeFtyp = Buffer.alloc(5000);
  largeFtyp.writeUInt32BE(largeFtyp.length, 0);
  largeFtyp.write('ftyp', 4);
  largeFtyp.write('isom', 8);
  const valid = Buffer.concat([largeFtyp, ordinary.subarray(32)]);
  const stored = await saveVideoStream(streamOf(valid, 113), { name: 'large-header.mp4', mimeType: 'video/mp4', size: valid.length });
  assert.deepEqual(await readFile(stored.path), valid);
});


test('declared and actual stream sizes are both capped at 200 MiB', async () => {
  await rm(videosDir, { recursive: true, force: true });
  const header = mp4Fixture(16);
  await assert.rejects(
    saveVideoStream(streamOf(header), {
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      size: MAX_VIDEO_BYTES + 1,
    }),
    (error) => error instanceof VideoUploadError && error.status === 413,
  );
  assert.deepEqual(await storedEntries(), []);

  const chunk = Buffer.alloc(1024 * 1024, 0x42);
  let sent = 0;
  const oversized = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(header));
      sent += header.length;
    },
    pull(controller) {
      if (sent > MAX_VIDEO_BYTES) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array(chunk));
      sent += chunk.length;
    },
  });
  await assert.rejects(
    saveVideoStream(oversized, { name: 'clip.mp4', mimeType: 'video/mp4' }),
    (error) => error instanceof VideoUploadError && error.status === 413,
  );
  assert.deepEqual(await storedEntries(), []);

  // A declared length that disagrees with the received body is treated as truncated.
  await assert.rejects(
    saveVideoStream(streamOf(header), { name: 'clip.mp4', mimeType: 'video/mp4', size: header.length + 10 }),
    (error) => error instanceof VideoUploadError && error.status === 400,
  );
  assert.deepEqual(await storedEntries(), []);
});

test('an aborted upload cancels the stream and removes its temp file', async () => {
  await rm(videosDir, { recursive: true, force: true });
  const controller = new AbortController();
  let pulls = 0;
  const body = new ReadableStream({
    start(streamController) {
      streamController.enqueue(new Uint8Array(mp4Fixture(64)));
    },
    pull(streamController) {
      pulls += 1;
      if (pulls === 1) controller.abort();
      streamController.close();
    },
  });
  await assert.rejects(
    saveVideoStream(body, { name: 'clip.mp4', mimeType: 'video/mp4', signal: controller.signal }),
    VideoUploadError,
  );
  assert.deepEqual(await storedEntries(), []);
});

test('deleteStoredVideo only removes the exact created path', async () => {
  await rm(videosDir, { recursive: true, force: true });
  const saved = await saveVideoStream(streamOf(mp4Fixture(32)), { name: 'clip.mp4', mimeType: 'video/mp4' });
  await deleteStoredVideo(saved.url);
  assert.deepEqual(await storedEntries(), []);

  for (const bad of [
    '/uploads/videos/../../secret.mp4',
    '/uploads/videos/not-a-uuid.mp4',
    '/uploads/2024/01/photo.webp',
    'https://cdn.example.com/clip.mp4',
    '',
  ]) {
    await assert.rejects(deleteStoredVideo(bad), VideoUploadError);
  }
});

// ---------- Range serving ----------

test('video GET serves the whole file without publicly caching permission-gated bytes', async () => {
  await rm(videosDir, { recursive: true, force: true });
  const body = mp4Fixture(1000);
  const name = `${randomUUID()}.mp4`;
  await putVideoFile(name, body);

  const response = await serveVideoRequest(GET(name), ['videos', name]);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'video/mp4');
  assert.equal(response.headers.get('accept-ranges'), 'bytes');
  assert.equal(response.headers.get('content-length'), String(body.length));
  // Video bytes follow catalogue permissions, so they must never be publicly cacheable.
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(await responseBytes(response), body);

  const webmName = `${randomUUID()}.webm`;
  await putVideoFile(webmName, webmFixture(256));
  const webmResponse = await serveVideoRequest(GET(webmName), ['videos', webmName]);
  assert.equal(webmResponse.headers.get('content-type'), 'video/webm');
});

test('single byte ranges, open-ended ranges and suffixes return exactly those bytes', async () => {
  await rm(videosDir, { recursive: true, force: true });
  const body = mp4Fixture(1000);
  const name = `${randomUUID()}.mp4`;
  await putVideoFile(name, body);

  const explicit = await serveVideoRequest(GET(name, { range: 'bytes=10-19' }), ['videos', name]);
  assert.equal(explicit.status, 206);
  assert.equal(explicit.headers.get('content-range'), `bytes 10-19/${body.length}`);
  assert.equal(explicit.headers.get('content-length'), '10');
  assert.deepEqual(await responseBytes(explicit), body.subarray(10, 20));

  const openEnded = await serveVideoRequest(GET(name, { range: `bytes=${body.length - 7}-` }), ['videos', name]);
  assert.equal(openEnded.status, 206);
  assert.equal(openEnded.headers.get('content-range'), `bytes ${body.length - 7}-${body.length - 1}/${body.length}`);
  assert.deepEqual(await responseBytes(openEnded), body.subarray(body.length - 7));

  const suffix = await serveVideoRequest(GET(name, { range: 'bytes=-5' }), ['videos', name]);
  assert.equal(suffix.status, 206);
  assert.equal(suffix.headers.get('content-range'), `bytes ${body.length - 5}-${body.length - 1}/${body.length}`);
  assert.deepEqual(await responseBytes(suffix), body.subarray(body.length - 5));

  const oversizedSuffix = await serveVideoRequest(GET(name, { range: 'bytes=-999999' }), ['videos', name]);
  assert.equal(oversizedSuffix.status, 206);
  assert.equal(oversizedSuffix.headers.get('content-range'), `bytes 0-${body.length - 1}/${body.length}`);
  assert.deepEqual(await responseBytes(oversizedSuffix), body);

  const clamped = await serveVideoRequest(GET(name, { range: 'bytes=1-999999' }), ['videos', name]);
  assert.equal(clamped.status, 206);
  assert.equal(clamped.headers.get('content-range'), `bytes 1-${body.length - 1}/${body.length}`);
  assert.equal(clamped.headers.get('content-length'), String(body.length - 1));

  const wholeAsRange = await serveVideoRequest(GET(name, { range: 'bytes=0-' }), ['videos', name]);
  assert.equal(wholeAsRange.status, 206);
  assert.equal(wholeAsRange.headers.get('content-range'), `bytes 0-${body.length - 1}/${body.length}`);
});

test('malformed, multiple and out-of-bounds ranges return 416 without a body stream', async () => {
  await rm(videosDir, { recursive: true, force: true });
  const body = mp4Fixture(64);
  const name = `${randomUUID()}.mp4`;
  await putVideoFile(name, body);

  for (const range of [
    'bytes=0-1,4-5',
    `bytes=${body.length}-`,
    `bytes=${body.length}-${body.length + 5}`,
    'bytes=9-3',
    'bytes=abc',
    'bytes=',
    'items=0-1',
    'bytes=--1',
    'bytes=999999999999999999999999-',
  ]) {
    const response = await serveVideoRequest(GET(name, { range }), ['videos', name]);
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('content-range'), `bytes */${body.length}`);
    assert.equal(response.body, null);
  }
});

test('HEAD returns the real file length with no body and ignores Range', async () => {
  await rm(videosDir, { recursive: true, force: true });
  const body = webmFixture(2000);
  const name = `${randomUUID()}.webm`;
  await putVideoFile(name, body);

  const response = await serveVideoRequest(GET(name, { range: 'bytes=0-4' }), ['videos', name], true);
  assert.equal(response.status, 200);
  assert.equal(response.body, null);
  assert.equal(response.headers.get('content-length'), String(body.length));
  assert.equal(response.headers.get('content-type'), 'video/webm');
  assert.equal(response.headers.get('accept-ranges'), 'bytes');
});

test('serving rejects traversal, non-video paths, missing files and symlinks', async () => {
  await rm(videosDir, { recursive: true, force: true });
  await mkdir(videosDir, { recursive: true });
  const idle = GET('anything.mp4');

  assert.equal((await serveVideoRequest(idle, ['videos'])).status, 404);
  assert.equal((await serveVideoRequest(idle, ['videos', '..', 'x.mp4'])).status, 404);
  assert.equal((await serveVideoRequest(idle, ['videos', '../../secret.mp4'])).status, 404);
  assert.equal((await serveVideoRequest(idle, ['videos', 'not-a-uuid.mp4'])).status, 404);
  assert.equal((await serveVideoRequest(idle, ['videos', `${randomUUID()}.mov`])).status, 404);
  assert.equal((await serveVideoRequest(idle, ['images', `${randomUUID()}.mp4`])).status, 404);
  assert.equal((await serveVideoRequest(idle, ['videos', `${randomUUID()}.mp4`])).status, 404);

  const outside = path.join(dataDir, 'outside.mp4');
  await writeFile(outside, mp4Fixture(16));
  const linkName = `${randomUUID()}.mp4`;
  await symlink(outside, path.join(videosDir, linkName));
  assert.equal((await serveVideoRequest(GET(linkName), ['videos', linkName])).status, 404);
  assert.equal((await serveVideoRequest(GET(linkName), ['videos', linkName], true)).status, 404);
});
