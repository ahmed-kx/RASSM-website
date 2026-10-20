// pnpm migrate-images: uploads the product photos still served from the website
// (frontend/public/images/products) to Cloudinary and points the products to them.
// Safe to re-run: each file keeps a fixed Cloudinary name (never uploaded twice), and products
// already on Cloudinary are left as they are. Orders keep their photo paths (the files stay).

import { existsSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { connectDatabase, disconnectDatabase } from "./db";
import { loadEnv } from "./env";
import { createRevalidator } from "./lib/revalidate";
import { ProductModel, type ProductDoc } from "./models/product";
import { STORED_IMAGE_TRANSFORMATION } from "./services/image-storage";

/** Progress lines in the terminal. */
const say = (text: string) => process.stdout.write(`${text}\n`);

const LOCAL_PREFIX = "/images/products/";
const PUBLIC_DIR = resolve(import.meta.dirname, "../../frontend/public");

const env = loadEnv();
if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
  console.error(
    "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in backend/.env first.",
  );
  process.exit(1);
}
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

/** Local path → Cloudinary URL (same file uploaded once per run, and once ever). */
const uploaded = new Map<string, string>();

async function upload(localPath: string): Promise<string> {
  const known = uploaded.get(localPath);
  if (known) return known;
  const file = resolve(PUBLIC_DIR, `.${localPath}`);
  if (!file.startsWith(PUBLIC_DIR) || !existsSync(file))
    throw new Error(`Missing file: ${localPath}`);
  const result = await cloudinary.uploader.upload(file, {
    folder: env.CLOUDINARY_FOLDER,
    public_id: basename(file, extname(file)),
    // Already uploaded by a previous run: Cloudinary returns the existing photo.
    overwrite: false,
    resource_type: "image",
    transformation: STORED_IMAGE_TRANSFORMATION,
  });
  uploaded.set(localPath, result.secure_url);
  say(`  ${localPath} → ${result.secure_url}`);
  return result.secure_url;
}

const move = async (urls: readonly string[]) =>
  Promise.all(urls.map((url) => (url.startsWith(LOCAL_PREFIX) ? upload(url) : url)));

try {
  await connectDatabase(env.MONGODB_URI, env.MONGODB_DB_NAME, {
    dnsFallbackServers: env.DNS_FALLBACK_SERVERS,
  });
  const products = await ProductModel.find().lean<ProductDoc[]>();
  let changed = 0;
  for (const product of products) {
    const local = [
      ...product.images,
      ...product.colors.flatMap((color) => color.images ?? []),
    ].some((url) => url.startsWith(LOCAL_PREFIX));
    if (!local) continue;
    say(`${product.name} (${product.sku ?? product._id})`);
    const images = await move(product.images);
    const colors = await Promise.all(
      product.colors.map(async (color) => ({
        ...color,
        ...(color.images ? { images: await move(color.images) } : {}),
      })),
    );
    // Keeps the stock as it is now (only the photo fields change).
    await ProductModel.updateOne(
      { _id: product._id },
      {
        $set: {
          images,
          ...Object.fromEntries(
            colors.map((color, index) => [`colors.${index}.images`, color.images]),
          ),
        },
      },
    );
    changed += 1;
  }
  say(
    changed === 0
      ? "Nothing to migrate: every product photo is already on Cloudinary."
      : `${changed} product(s) now use Cloudinary photos (${uploaded.size} file(s)).`,
  );
  if (changed > 0 && env.REVALIDATE_SECRET) {
    createRevalidator({
      url: env.REVALIDATE_URL ?? `${env.FRONTEND_ORIGIN[0]}/api/revalidate`,
      secret: env.REVALIDATE_SECRET,
    }).revalidate(["products"]);
    await new Promise((done) => setTimeout(done, 1500));
  }
} catch (error) {
  console.error("Migration stopped:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await disconnectDatabase().catch(() => undefined);
}
