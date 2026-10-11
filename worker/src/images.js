/**
 * Server-side upload checks. The browser re-encodes first; this path does
 * not trust Content-Type. Pixel decode and resize need an image transform
 * binding that is not available in this pull request, so oversize dimensions
 * are rejected and container metadata is stripped.
 */

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_EDGE = 8000;
const MAX_PIXELS = 24_000_000;
const OUTPUT_EDGE = 1600;

function u32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function u16(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (~crc) >>> 0;
}

function limits(width, height) {
  if (!width || !height || width > MAX_EDGE || height > MAX_EDGE) return "dimensions";
  if (width * height > MAX_PIXELS) return "dimensions";
  if (width > OUTPUT_EDGE || height > OUTPUT_EDGE) return "dimensions";
  return "";
}

function parsePng(bytes) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 24 || !sig.every((b, i) => bytes[i] === b)) return null;
  let offset = 8;
  let width = 0;
  let height = 0;
  const keep = [bytes.subarray(0, 8)];
  while (offset + 12 <= bytes.length) {
    const length = u32(bytes, offset);
    if (length > bytes.length || offset + 12 + length > bytes.length) return null;
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    const expected = u32(bytes, offset + 8 + length);
    const crcInput = bytes.subarray(offset + 4, offset + 8 + length);
    if (crc32(crcInput) !== expected) return null;
    if (type === "IHDR") {
      width = u32(chunk, 0);
      height = u32(chunk, 4);
    }
    if (type === "IHDR" || type === "PLTE" || type === "IDAT" || type === "IEND" || type === "tRNS") {
      keep.push(bytes.subarray(offset, offset + 12 + length));
    }
    offset += 12 + length;
    if (type === "IEND") break;
  }
  if (!width) return null;
  const out = new Uint8Array(keep.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of keep) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return { mime: "image/png", ext: "png", width, height, bytes: out };
}

function parseJpeg(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  let width = 0;
  let height = 0;
  const parts = [bytes.subarray(0, 2)];
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) {
      parts.push(bytes.subarray(offset));
      break;
    }
    const size = u16(bytes, offset + 2);
    if (size < 2 || offset + 2 + size > bytes.length) return null;
    const drop = (marker >= 0xe1 && marker <= 0xef) || marker === 0xfe;
    if (!drop) parts.push(bytes.subarray(offset, offset + 2 + size));
    if (marker >= 0xc0 && marker <= 0xc2) {
      height = u16(bytes, offset + 5);
      width = u16(bytes, offset + 7);
    }
    offset += 2 + size;
  }
  if (!width) return null;
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return { mime: "image/jpeg", ext: "jpg", width, height, bytes: out };
}

function parseWebp(bytes) {
  if (bytes.length < 30) return null;
  const riff = String.fromCharCode(...bytes.subarray(0, 4));
  const webp = String.fromCharCode(...bytes.subarray(8, 12));
  if (riff !== "RIFF" || webp !== "WEBP") return null;
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  let width = 0;
  let height = 0;
  if (chunk === "VP8 " && bytes.length > 30) {
    width = u16(bytes, 26) & 0x3fff;
    height = u16(bytes, 28) & 0x3fff;
  } else if (chunk === "VP8L" && bytes.length > 25 && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    width = (bits & 0x3fff) + 1;
    height = ((bits >> 14) & 0x3fff) + 1;
  } else if (chunk === "VP8X" && bytes.length > 30) {
    width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
  }
  if (!width) return null;
  const cleaned = stripWebpMeta(bytes);
  return { mime: "image/webp", ext: "webp", width, height, bytes: cleaned };
}

function stripWebpMeta(bytes) {
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
    const padded = size + (size % 2);
    if (offset + 8 + padded > bytes.length) break;
    if (type !== "EXIF" && type !== "XMP ") chunks.push(bytes.subarray(offset, offset + 8 + padded));
    offset += 8 + padded;
  }
  const body = chunks.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(12 + body);
  out.set(bytes.subarray(0, 12), 0);
  const total = body + 4;
  out[4] = total & 255;
  out[5] = (total >> 8) & 255;
  out[6] = (total >> 16) & 255;
  out[7] = (total >> 24) & 255;
  let cursor = 12;
  for (const part of chunks) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

export function inspectImage(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
  if (!bytes.length || bytes.length > MAX_BYTES) return { ok: false, error: "too_large" };
  const parsed = parsePng(bytes) || parseJpeg(bytes) || parseWebp(bytes);
  if (!parsed) return { ok: false, error: "type" };
  const problem = limits(parsed.width, parsed.height);
  if (problem) return { ok: false, error: problem };
  return { ok: true, ...parsed };
}

export async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const UPLOAD_MAX_BYTES = MAX_BYTES;
