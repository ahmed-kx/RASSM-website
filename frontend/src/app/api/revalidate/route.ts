import { timingSafeEqual } from "node:crypto";
import { REVALIDATE_SECRET_HEADER, revalidateRequestSchema } from "@rassm/shared";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

// Called by the API after a dashboard change (products, delivery prices): the pages using
// these cache tags are rebuilt on their next visit, without waiting for their cache time.

function sameSecret(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || secret.length < 24) {
    return Response.json({ error: "Revalidation is not configured." }, { status: 503 });
  }
  if (!sameSecret(request.headers.get(REVALIDATE_SECRET_HEADER), secret)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }
  const body = revalidateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return Response.json({ error: "Invalid tags." }, { status: 400 });

  // expire: 0 = the next visitor gets fresh data (no stale page in between).
  for (const tag of body.data.tags) revalidateTag(tag, { expire: 0 });
  return Response.json({ revalidated: body.data.tags });
}
