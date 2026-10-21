// Removes the hidden metadata of a photo before it is stored: EXIF (GPS position, camera,
// date, owner), XMP, IPTC and comments. Only the EXIF orientation of a JPEG is kept (written
// back alone), so phone photos keep the right way up. Works on the bytes, no image decoding.

export class InvalidImageError extends Error {
  constructor() {
    super("Invalid image file");
    this.name = "InvalidImageError";
  }
}

/** JPEG segments removed: APP1 (EXIF, XMP), APP12, APP13 (IPTC) and comments. */
const JPEG_DROPPED = new Set([0xe1, 0xec, 0xed, 0xfe]);
/** PNG chunks removed: EXIF, texts (author, GPS written by some apps…) and the date. */
const PNG_DROPPED = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);
/** WebP chunks removed. */
const WEBP_DROPPED = new Set(["EXIF", "XMP "]);

/** The EXIF orientation (1–8) of an APP1 segment's data, or null. */
function readOrientation(app1: Buffer): number | null {
  if (app1.length < 14 || app1.subarray(0, 6).toString("latin1") !== "Exif\0\0") return null;
  const tiff = app1.subarray(6);
  const order = tiff.subarray(0, 2).toString("latin1");
  if (order !== "II" && order !== "MM") return null;
  const little = order === "II";
  const u16 = (at: number) => (little ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at));
  const u32 = (at: number) => (little ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at));
  try {
    const ifd = u32(4);
    const entries = u16(ifd);
    for (let i = 0; i < entries; i += 1) {
      const entry = ifd + 2 + i * 12;
      if (u16(entry) === 0x0112) {
        const value = u16(entry + 8);
        return value >= 1 && value <= 8 ? value : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** A minimal APP1 segment holding only the orientation. */
function orientationSegment(orientation: number): Buffer {
  const tiff = Buffer.alloc(26);
  tiff.write("MM", 0, "latin1");
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4); // IFD0 right after the header
  tiff.writeUInt16BE(1, 8); // one entry
  tiff.writeUInt16BE(0x0112, 10); // Orientation
  tiff.writeUInt16BE(3, 12); // SHORT
  tiff.writeUInt32BE(1, 14); // count
  tiff.writeUInt16BE(orientation, 18);
  tiff.writeUInt32BE(0, 22); // no next IFD
  const data = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
  const header = Buffer.from([0xff, 0xe1, 0, 0]);
  header.writeUInt16BE(data.length + 2, 2);
  return Buffer.concat([header, data]);
}

function stripJpeg(file: Buffer): Buffer {
  const parts: Buffer[] = [file.subarray(0, 2)];
  let orientation: number | null = null;
  let at = 2;
  while (at < file.length) {
    if (file[at] !== 0xff) throw new InvalidImageError();
    const marker = file[at + 1];
    if (marker === undefined) throw new InvalidImageError();
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    // Start of scan: the compressed image follows, copied as is.
    if (marker === 0xda) {
      parts.push(file.subarray(at));
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(file.subarray(at, at + 2));
      at += 2;
      continue;
    }
    if (at + 4 > file.length) throw new InvalidImageError();
    const end = at + 2 + file.readUInt16BE(at + 2);
    if (end > file.length) throw new InvalidImageError();
    if (JPEG_DROPPED.has(marker)) {
      if (marker === 0xe1) orientation ??= readOrientation(file.subarray(at + 4, end));
    } else {
      parts.push(file.subarray(at, end));
    }
    at = end;
  }
  // The orientation goes right after the start marker (and JFIF APP0, when there is one).
  if (orientation && orientation !== 1) {
    const afterApp0 = parts[1]?.[1] === 0xe0 ? 2 : 1;
    parts.splice(afterApp0, 0, orientationSegment(orientation));
  }
  return Buffer.concat(parts);
}

function stripPng(file: Buffer): Buffer {
  const parts: Buffer[] = [file.subarray(0, 8)];
  let at = 8;
  while (at < file.length) {
    if (at + 12 > file.length) throw new InvalidImageError();
    const end = at + 12 + file.readUInt32BE(at);
    if (end > file.length) throw new InvalidImageError();
    const type = file.subarray(at + 4, at + 8).toString("latin1");
    if (!PNG_DROPPED.has(type)) parts.push(file.subarray(at, end));
    at = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(parts);
}

function stripWebp(file: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let at = 12;
  while (at + 8 <= file.length) {
    const size = file.readUInt32LE(at + 4);
    const end = at + 8 + size + (size % 2);
    if (at + 8 + size > file.length) throw new InvalidImageError();
    const type = file.subarray(at, at + 4).toString("latin1");
    if (!WEBP_DROPPED.has(type)) {
      const chunk = Buffer.from(file.subarray(at, Math.min(end, file.length)));
      // VP8X flags: no EXIF (bit 3), no XMP (bit 2) any more.
      if (type === "VP8X" && chunk.length > 8) chunk[8] = (chunk[8] ?? 0) & ~0x0c;
      chunks.push(chunk);
    }
    at = end;
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.from(file.subarray(0, 12));
  header.writeUInt32LE(body.length + 4, 4);
  return Buffer.concat([header, body]);
}

/**
 * The photo without its metadata. `type` is the real type found from the bytes
 * (detectImageType). Throws InvalidImageError when the file structure is broken.
 */
export function stripImageMetadata(file: Buffer, type: string): Buffer {
  if (type === "image/jpeg") return stripJpeg(file);
  if (type === "image/png") return stripPng(file);
  if (type === "image/webp") return stripWebp(file);
  throw new InvalidImageError();
}
