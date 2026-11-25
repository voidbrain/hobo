export const MAX_IMAGE_BYTES = 5_000_000;

export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export type ImageExt = 'jpg' | 'png' | 'webp';

export type SanitizedImage =
  | { ok: true; mime: ImageMime; ext: ImageExt; data: Buffer }
  | { ok: false; status: 400 | 413 | 415; error: string };

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const STRIPPED_PNG_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

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

function sanitizePng(buf: Buffer): SanitizedImage {
  if (buf.length < 33) return { ok: false, status: 400, error: 'corrupt PNG image' };
  const kept: Buffer[] = [PNG_SIG];
  let pos = 8;
  let sawIhdr = false;
  let sawIdat = false;
  let sawIend = false;

  while (pos < buf.length) {
    if (pos + 12 > buf.length) return { ok: false, status: 400, error: 'corrupt PNG image' };
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
    if (!/^[A-Za-z]{4}$/.test(type)) {
      return { ok: false, status: 400, error: 'corrupt PNG chunk' };
    }
    const end = pos + 12 + len;
    if (end > buf.length) return { ok: false, status: 400, error: 'truncated PNG chunk' };

    const expectedCrc = buf.readUInt32BE(pos + 8 + len);
    const actualCrc = crc32(buf.subarray(pos + 4, pos + 8 + len));
    if (expectedCrc !== actualCrc) {
      return { ok: false, status: 400, error: 'corrupt PNG chunk CRC' };
    }

    if (!sawIhdr) {
      if (type !== 'IHDR' || len !== 13) {
        return { ok: false, status: 400, error: 'missing PNG IHDR' };
      }
      const width = buf.readUInt32BE(pos + 8);
      const height = buf.readUInt32BE(pos + 12);
      if (width === 0 || height === 0) {
        return { ok: false, status: 400, error: 'invalid PNG dimensions' };
      }
      sawIhdr = true;
    }
    if (type === 'IDAT') sawIdat = true;
    if (!STRIPPED_PNG_CHUNKS.has(type)) {
      kept.push(buf.subarray(pos, end));
    }
    pos = end;
    if (type === 'IEND') {
      if (len !== 0 || pos !== buf.length) {
        return { ok: false, status: 400, error: 'invalid PNG IEND' };
      }
      sawIend = true;
      break;
    }
  }

  if (!sawIhdr || !sawIdat || !sawIend) {
    return { ok: false, status: 400, error: 'incomplete PNG image' };
  }
  return { ok: true, mime: 'image/png', ext: 'png', data: Buffer.concat(kept) };
}

function isSofMarker(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function isStrippedJpegMarker(marker: number): boolean {
  // Strip APP1..APP13 (EXIF, GPS, XMP, IPTC, MPF), APP15, and COM comments; keep APP0 (JFIF) and APP14 (Adobe).
  if (marker === 0xfe) return true;
  if (marker >= 0xe1 && marker <= 0xed) return true;
  if (marker === 0xef) return true;
  return false;
}

function sanitizeJpeg(buf: Buffer): SanitizedImage {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    return { ok: false, status: 400, error: 'corrupt JPEG image' };
  }
  const kept: Buffer[] = [Buffer.from([0xff, 0xd8])];
  let pos = 2;
  let sawSof = false;
  let sawSos = false;

  while (pos < buf.length) {
    if (buf[pos] !== 0xff) {
      return { ok: false, status: 400, error: 'corrupt JPEG marker alignment' };
    }
    while (pos < buf.length && buf[pos] === 0xff) pos++;
    if (pos >= buf.length) return { ok: false, status: 400, error: 'truncated JPEG marker' };
    const marker = buf[pos]!;
    pos++;

    if (marker === 0xd9) {
      if (!sawSof || !sawSos) {
        return { ok: false, status: 400, error: 'incomplete JPEG image' };
      }
      kept.push(Buffer.from([0xff, 0xd9]));
      return { ok: true, mime: 'image/jpeg', ext: 'jpg', data: Buffer.concat(kept) };
    }

    // Standalone markers without payload length
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      kept.push(Buffer.from([0xff, marker]));
      continue;
    }

    if (pos + 2 > buf.length) {
      return { ok: false, status: 400, error: 'truncated JPEG segment length' };
    }
    const segLen = buf.readUInt16BE(pos);
    if (segLen < 2 || pos + segLen > buf.length) {
      return { ok: false, status: 400, error: 'invalid JPEG segment length' };
    }

    if (isSofMarker(marker)) {
      if (segLen < 7) return { ok: false, status: 400, error: 'invalid JPEG SOF header' };
      const height = buf.readUInt16BE(pos + 3);
      const width = buf.readUInt16BE(pos + 5);
      if (width === 0 || height === 0) {
        return { ok: false, status: 400, error: 'invalid JPEG dimensions' };
      }
      sawSof = true;
    }

    if (!isStrippedJpegMarker(marker)) {
      kept.push(Buffer.from([0xff, marker]));
      kept.push(buf.subarray(pos, pos + segLen));
    }
    pos += segLen;

    if (marker === 0xda) {
      sawSos = true;
      const scanStart = pos;
      while (pos < buf.length) {
        if (buf[pos] !== 0xff) {
          pos++;
          continue;
        }
        const ffStart = pos;
        while (pos < buf.length && buf[pos] === 0xff) pos++;
        if (pos >= buf.length) {
          return { ok: false, status: 400, error: 'truncated JPEG scan data' };
        }
        const next = buf[pos]!;
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
          pos++;
          continue;
        }
        // Reached the next marker (e.g. EOI 0xD9 or another scan in progressive JPEG)
        kept.push(buf.subarray(scanStart, ffStart));
        pos = ffStart;
        break;
      }
    }
  }

  return { ok: false, status: 400, error: 'missing JPEG EOI marker' };
}

function sanitizeWebp(buf: Buffer): SanitizedImage {
  if (buf.length < 20) return { ok: false, status: 400, error: 'corrupt WebP image' };
  const declaredSize = buf.readUInt32LE(4);
  const riffEnd = 8 + declaredSize;
  if (declaredSize < 12 || riffEnd > buf.length) {
    return { ok: false, status: 400, error: 'invalid WebP RIFF size' };
  }

  const chunks: Buffer[] = [];
  let pos = 12;
  let sawBitstream = false;

  while (pos < riffEnd) {
    if (pos + 8 > riffEnd) return { ok: false, status: 400, error: 'truncated WebP chunk' };
    const fourcc = buf.subarray(pos, pos + 4).toString('ascii');
    const size = buf.readUInt32LE(pos + 4);
    const padded = size + (size % 2);
    const dataStart = pos + 8;
    const nextPos = dataStart + padded;
    if (dataStart + size > riffEnd || nextPos > buf.length) {
      return { ok: false, status: 400, error: 'invalid WebP chunk size' };
    }

    if (fourcc === 'VP8 ' || fourcc === 'VP8L' || fourcc === 'ANMF') {
      if (size === 0) return { ok: false, status: 400, error: 'empty WebP image bitstream' };
      sawBitstream = true;
    }

    if (fourcc !== 'EXIF' && fourcc !== 'XMP ') {
      if (fourcc === 'VP8X') {
        if (size !== 10) return { ok: false, status: 400, error: 'invalid WebP VP8X header' };
        const copy = Buffer.from(buf.subarray(pos, dataStart + size));
        // Clear EXIF (0x08) and XMP (0x04) metadata flags
        copy[8] = copy[8]! & ~0x0c;
        chunks.push(copy);
      } else {
        chunks.push(buf.subarray(pos, Math.min(nextPos, buf.length)));
      }
    }

    pos = nextPos;
  }

  if (!sawBitstream) {
    return { ok: false, status: 400, error: 'WebP has no image bitstream' };
  }

  const body = Buffer.concat([Buffer.from('WEBP', 'ascii'), ...chunks]);
  const head = Buffer.alloc(8);
  head.write('RIFF', 0, 4, 'ascii');
  head.writeUInt32LE(body.length, 4);
  return { ok: true, mime: 'image/webp', ext: 'webp', data: Buffer.concat([head, body]) };
}

/**
 * Validates image type strictly from content magic bytes and container structure,
 * enforces `MAX_IMAGE_BYTES`, and strips EXIF/GPS/XMP/comment metadata.
 */
export function sanitizeImage(buf: Buffer): SanitizedImage {
  if (buf.length === 0) {
    return { ok: false, status: 400, error: 'image file is empty' };
  }
  if (buf.length > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `image is larger than ${MAX_IMAGE_BYTES} bytes`,
    };
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIG)) {
    return sanitizePng(buf);
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return sanitizeJpeg(buf);
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return sanitizeWebp(buf);
  }
  return {
    ok: false,
    status: 415,
    error: 'unsupported image content: send a valid JPEG, PNG or WebP image',
  };
}

export function mimeForImageName(name: string): ImageMime | null {
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return null;
}
