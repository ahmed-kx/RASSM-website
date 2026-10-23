import { timingSafeEqual } from "node:crypto";
import {
  CLIENT_IP_HEADER,
  CLIENT_IP_SIGNATURE_HEADER,
  CLIENT_IP_SIGNATURE_MAX_AGE_MS,
  signClientIp,
} from "@rassm/shared";
import type { NextFunction, Request, Response } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express type augmentation
  namespace Express {
    interface Request {
      /** Dashboard requests: the visitor's IP checked by `dashboardClientIp` (null = unknown). */
      clientIp?: string | null;
    }
  }
}

// Which IP a request comes from.
//
// - Public routes (the browser calls the API directly): `req.ip`, which reads X-Forwarded-For
//   only for the TRUST_PROXY proxies of the host, never further.
// - Dashboard routes (/api/admin, called through the website): the website signs the visitor's IP
//   (CLIENT_IP_HEADER + CLIENT_IP_SIGNATURE_HEADER, HMAC with ADMIN_PROXY_SECRET). X-Forwarded-For
//   is ignored there: Next.js passes on the one a visitor sends, so anyone could choose an IP and
//   get around the login locks. Without a valid signature, the address of the connection is used.

const IP_PATTERN = /^[0-9a-fA-F:.]{2,45}$/;

const normalise = (ip: string) => ip.replace(/^::ffff:/, "");

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The IP signed by the website, or null (missing, forged, too old or no secret). */
export async function verifiedClientIp(
  req: Request,
  secret: string | null,
  now = Date.now(),
): Promise<string | null> {
  const ip = req.get(CLIENT_IP_HEADER)?.trim();
  const signature = req.get(CLIENT_IP_SIGNATURE_HEADER)?.trim();
  if (!secret || !ip || !signature || !IP_PATTERN.test(ip)) return null;
  const time = Number(signature.split(".")[0]);
  if (!Number.isSafeInteger(time) || Math.abs(now - time) > CLIENT_IP_SIGNATURE_MAX_AGE_MS) {
    return null;
  }
  return sameText(signature, await signClientIp(secret, ip, time)) ? normalise(ip) : null;
}

/** Sets `req.clientIp` on dashboard requests: the signed IP, else the connection's address. */
export function dashboardClientIp(secret: string | null) {
  return (req: Request, _res: Response, next: NextFunction) => {
    verifiedClientIp(req, secret)
      .then((ip) => {
        const socket = req.socket.remoteAddress;
        req.clientIp = ip ?? (socket ? normalise(socket) : null);
        next();
      })
      .catch(next);
  };
}

/** The IP to use for limits, locks and logs. */
export function clientIpOf(req: Request): string | null {
  if (req.clientIp !== undefined) return req.clientIp;
  return req.ip ? normalise(req.ip) : null;
}
