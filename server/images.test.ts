import { strict as assert } from 'node:assert';
import { deflateSync } from 'node:zlib';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import type { Place } from '../src/app/core/place.ts';
import { startServer, type RunningServer } from './app.ts';
import { MAX_IMAGE_BYTES, sanitizeImage } from './images.ts';

// Neutral, synthetic 1x1 test images constructed in memory (no real photos, no files in git).
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** Synthetic 1x1 RGB PNG carrying eXIf (fake GPS tag) and tEXt metadata chunks. */
function makeSyntheticPngWithGps(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0); // width = 1
  ihdr.writeUInt32BE(1, 4); // height = 1
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const exifPayload = Buffer.from('MM\x00*\x00\x00\x00\x08GPS-FAKE-COORDS-12.34,56.78', 'latin1');
  const textPayload = Buffer.from('Comment\x00Invented camera GPS note', 'latin1');
  const rawScanline = Buffer.from([0x00, 0x30, 0x60, 0x90]); // filter 0 + 1 RGB pixel
  const idat = deflateSync(rawScanline);
  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('eXIf', exifPayload),
    pngChunk('tEXt', textPayload),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function jpegSegment(marker: number, payload: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head[0] = 0xff;
  head[1] = marker;
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

/** Synthetic 1x1 grayscale baseline JPEG carrying APP1 EXIF/GPS and COM comment segments. */
function makeSyntheticJpegWithExifGps(): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const app0 = jpegSegment(
    0xe0,
    Buffer.from('JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00', 'latin1'),
  );
  const app1Exif = jpegSegment(
    0xe1,
    Buffer.from('Exif\x00\x00II*\x00\x08\x00\x00\x00GPS-EXIF-INVENTED-LAT-LNG', 'latin1'),
  );
  const com = jpegSegment(0xfe, Buffer.from('SECRET-CAMERA-SERIAL-0000', 'latin1'));
  const dqt = jpegSegment(0xdb, Buffer.concat([Buffer.from([0x00]), Buffer.alloc(64, 16)]));
  const sof0 = jpegSegment(
    0xc0,
    Buffer.from([0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00]),
  );
  const dht = jpegSegment(
    0xc4,
    Buffer.from([
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00,
    ]),
  );
  const sosHeader = jpegSegment(0xda, Buffer.from([0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]));
  const scanAndEoi = Buffer.from([0x7f, 0xff, 0x00, 0x12, 0xff, 0xd9]);
  return Buffer.concat([soi, app0, app1Exif, com, dqt, sof0, dht, sosHeader, scanAndEoi]);
}

/** Synthetic Extended WebP (VP8X) carrying an EXIF subchunk. */
function makeSyntheticWebpWithExif(): Buffer {
  const vp8xPayload = Buffer.alloc(10);
  vp8xPayload[0] = 0x08; // EXIF flag set
  vp8xPayload.writeUIntLE(0, 4, 3); // width - 1 = 0
  vp8xPayload.writeUIntLE(0, 7, 3); // height - 1 = 0
  const vp8Payload = Buffer.from([0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00]);
  const exifPayload = Buffer.from('Exif\x00\x00WEBP-GPS-INVENTED', 'latin1');

  const riffChunk = (fourcc: string, data: Buffer) => {
    const pad = data.length % 2 === 1 ? Buffer.from([0x00]) : Buffer.alloc(0);
    const head = Buffer.alloc(8);
    head.write(fourcc, 0, 4, 'ascii');
    head.writeUInt32LE(data.length, 4);
    return Buffer.concat([head, data, pad]);
  };

  const body = Buffer.concat([
    Buffer.from('WEBP', 'ascii'),
    riffChunk('VP8X', vp8xPayload),
    riffChunk('VP8 ', vp8Payload),
    riffChunk('EXIF', exifPayload),
  ]);
  const riffHead = Buffer.alloc(8);
  riffHead.write('RIFF', 0, 4, 'ascii');
  riffHead.writeUInt32LE(body.length, 4);
  return Buffer.concat([riffHead, body]);
}

describe('image sanitization and place images API (F-002-T03)', () => {
  let dataDir: string;
  let server: RunningServer;

  beforeEach(async () => {
    dataDir = join(mkdtempSync(join(tmpdir(), 'hobo-img-')), 'data');
    server = await startServer({ host: '127.0.0.1', port: 0, dataDir });
  });
  afterEach(async () => {
    await server.close();
    rmSync(join(dataDir, '..'), { recursive: true, force: true });
  });

  it('strips EXIF, GPS, XMP and comment chunks from JPEG, PNG and WebP buffers, and rejects empty input', () => {
    const empty = sanitizeImage(Buffer.alloc(0));
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.status, 400);

    const jpeg = sanitizeImage(makeSyntheticJpegWithExifGps());
    assert.equal(jpeg.ok, true);
    if (jpeg.ok) {
      assert.equal(jpeg.mime, 'image/jpeg');
      assert.equal(jpeg.ext, 'jpg');
      assert.equal(jpeg.data.includes(Buffer.from('GPS-EXIF-INVENTED-LAT-LNG')), false);
      assert.equal(jpeg.data.includes(Buffer.from('SECRET-CAMERA-SERIAL-0000')), false);
    }

    const png = sanitizeImage(makeSyntheticPngWithGps());
    assert.equal(png.ok, true);
    if (png.ok) {
      assert.equal(png.mime, 'image/png');
      assert.equal(png.ext, 'png');
      assert.equal(png.data.includes(Buffer.from('GPS-FAKE-COORDS')), false);
      assert.equal(png.data.includes(Buffer.from('Invented camera GPS note')), false);
    }

    const webp = sanitizeImage(makeSyntheticWebpWithExif());
    assert.equal(webp.ok, true);
    if (webp.ok) {
      assert.equal(webp.mime, 'image/webp');
      assert.equal(webp.ext, 'webp');
      assert.equal(webp.data.includes(Buffer.from('WEBP-GPS-INVENTED')), false);
    }
  });

  it('checks file type by content bytes (rejecting disguised SVG/HTML) and enforces MAX_IMAGE_BYTES', async () => {
    const place = (await (
      await fetch(server.url + '/api/places', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Lantern Hill' }),
      })
    ).json()) as Place;

    // Empty 0-byte upload must be rejected with 400
    const emptyRes = await fetch(`${server.url}/api/places/${place.id}/images`, {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: Buffer.alloc(0),
    });
    assert.equal(emptyRes.status, 400);

    // SVG/HTML disguised with image/jpeg header and .jpg query name must be rejected by content check
    const disguised = await fetch(
      `${server.url}/api/places/${place.id}/images?filename=photo.jpg`,
      {
        method: 'POST',
        headers: { 'content-type': 'image/jpeg' },
        body: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ),
      },
    );
    assert.equal(disguised.status, 415);

    // Truncated 3-byte fake JPEG magic header without valid frame/EOI must be rejected
    const fakeJpeg = await fetch(`${server.url}/api/places/${place.id}/images`, {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg' },
      body: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]),
    });
    assert.equal(fakeJpeg.status, 400);

    // Oversized upload must be rejected with 413 and write nothing on disk
    const huge = Buffer.alloc(MAX_IMAGE_BYTES + 1024, 0x41);
    const tooBig = await fetch(`${server.url}/api/places/${place.id}/images`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: huge,
    });
    assert.equal(tooBig.status, 413);
    assert.equal(existsSync(join(dataDir, 'images')), false);
  });

  it('attaches sanitized images in the local data folder, serves them with nosniff, and deletes cleanly', async () => {
    const place = (await (
      await fetch(server.url + '/api/places', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Quiet Bay' }),
      })
    ).json()) as Place;

    // Upload PNG bytes even with generic octet-stream header: content sniffing detects PNG and strips GPS
    const uploadRes = await fetch(`${server.url}/api/places/${place.id}/images`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: makeSyntheticPngWithGps(),
    });
    assert.equal(uploadRes.status, 201);
    const updated = (await uploadRes.json()) as Place;
    assert.equal(updated.images.length, 1);
    const imageName = updated.images[0]!;
    assert.match(imageName, /^[0-9a-f-]{36}\.png$/);

    // Stored on disk in dataDir/images with GPS stripped
    const diskBytes = readFileSync(join(dataDir, 'images', imageName));
    assert.equal(diskBytes.includes(Buffer.from('GPS-FAKE-COORDS')), false);

    // Served over GET /api/places/:id/images/:name
    const getRes = await fetch(`${server.url}/api/places/${place.id}/images/${imageName}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get('content-type'), 'image/png');
    assert.equal(getRes.headers.get('x-content-type-options'), 'nosniff');
    const servedBytes = Buffer.from(await getRes.arrayBuffer());
    assert.deepEqual(servedBytes, diskBytes);

    // Deleting the image removes it from the place and unlinks the file
    const delRes = await fetch(`${server.url}/api/places/${place.id}/images/${imageName}`, {
      method: 'DELETE',
    });
    assert.equal(delRes.status, 204);
    assert.deepEqual(readdirSync(join(dataDir, 'images')), []);
    const reloaded = (await (await fetch(`${server.url}/api/places/${place.id}`)).json()) as Place;
    assert.deepEqual(reloaded.images, []);
  });
});
