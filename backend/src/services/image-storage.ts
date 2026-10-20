import type { UploadedImage } from "@rassm/shared";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

/** Where product photos are stored. Cloudinary in production, a fake in the tests. */
export interface ImageStorage {
  /** Uploads one photo (already checked: JPG, PNG or WebP, size limit). */
  upload(file: Buffer): Promise<UploadedImage>;
  /** True for a URL this storage created (only those are ever deleted). */
  owns(url: string): boolean;
  /** Deletes a photo of this storage. */
  remove(url: string): Promise<void>;
}

/**
 * Applied when a photo is stored: at most 2 000 px, compressed, converted to WebP. The format
 * must be `fetch_format` inside the transformation: Cloudinary ignores a top-level `format`
 * when an incoming transformation is set (the photo would stay a JPG).
 */
export const STORED_IMAGE_TRANSFORMATION = [
  { width: 2000, height: 2000, crop: "limit", quality: "auto:good", fetch_format: "webp" },
];

export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
}

/**
 * Signed uploads from the API (the secret never reaches the browser). Photos are stored
 * resized to 2 000 px at most and compressed as WebP; next/image then serves each screen
 * the size and format it needs.
 */
export function createCloudinaryStorage(config: CloudinaryConfig): ImageStorage {
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  });
  const base = `https://res.cloudinary.com/${config.cloudName}/image/upload/`;

  /** "https://res.cloudinary.com/<cloud>/image/upload/v123/rassm/products/x.webp" → "rassm/products/x". */
  const publicIdOf = (url: string): string | null => {
    if (!url.startsWith(base)) return null;
    const path = url
      .slice(base.length)
      .replace(/^v\d+\//, "")
      .replace(/\.[a-z0-9]+$/i, "");
    return path.startsWith(`${config.folder}/`) ? path : null;
  };

  return {
    upload: (file) =>
      new Promise<UploadedImage>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              folder: config.folder,
              resource_type: "image",
              allowed_formats: ["jpg", "jpeg", "png", "webp"],
              transformation: STORED_IMAGE_TRANSFORMATION,
            },
            (error, result?: UploadApiResponse) => {
              if (error || !result) reject(error ?? new Error("Cloudinary upload failed"));
              else resolve({ url: result.secure_url, width: result.width, height: result.height });
            },
          )
          .end(file);
      }),
    owns: (url) => publicIdOf(url) !== null,
    remove: async (url) => {
      const publicId = publicIdOf(url);
      if (!publicId) return;
      await cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: "image" });
    },
  };
}

const SIGNATURES: { type: string; matches: (bytes: Buffer) => boolean }[] = [
  { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    matches: (b) =>
      b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    type: "image/webp",
    matches: (b) =>
      b.subarray(0, 4).toString("latin1") === "RIFF" &&
      b.subarray(8, 12).toString("latin1") === "WEBP",
  },
];

/** The real type of a file from its first bytes (the declared type can lie). */
export function detectImageType(file: Buffer): string | null {
  return SIGNATURES.find((signature) => signature.matches(file))?.type ?? null;
}
