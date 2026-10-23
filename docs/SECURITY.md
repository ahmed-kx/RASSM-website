# Security

How the site, the API and the dashboard are protected, where every secret lives, how to change
("rotate") each one, and how to back up and restore the database.

## Secrets

Secrets live only in files that git ignores, and in the hosting provider's environment variables
once deployed. They are never in the code, never in git, never in the logs.

| File                  | Used by                    | Template (committed)    |
| --------------------- | -------------------------- | ----------------------- |
| `backend/.env`        | the API and the `pnpm` CLI | `backend/.env.example`  |
| `frontend/.env.local` | the website (Next.js)      | `frontend/.env.example` |

`git log` was checked (October 2026): no real secret was ever committed. Only placeholders appear in
the history (`user:pass@cluster0.example…`, `xkeysib-test-…`).

### What each secret protects, and how to rotate it

Rotate a secret right away if it may have leaked (a screenshot, a shared file, a former helper), and
once a year anyway. After changing a value, restart the app that reads it.

| Secret                                         | Where                                                     | If it leaks                                                          |
| ---------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------- |
| `MONGODB_URI` (the database user's password)   | `backend/.env`                                            | Full read and write access to every order, customer and admin        |
| `BREVO_API_KEY`                                | `backend/.env`                                            | E-mails sent in your name; the contact lists can be read             |
| `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` | `backend/.env`                                            | Photos uploaded or deleted in your Cloudinary account                |
| `META_CAPI_ACCESS_TOKEN`                       | `backend/.env`                                            | Fake conversion events sent to your Pixel (ads optimisation broken)  |
| `REVALIDATE_SECRET`                            | `backend/.env` **and** `frontend/.env.local` (same value) | Someone can force the site to rebuild its pages (load, no data leak) |
| `BACKUP_PASSPHRASE`                            | `backend/.env` + your password manager                    | The encrypted backups can be read by whoever has the files           |

Not secrets (public by design): `NEXT_PUBLIC_META_PIXEL_ID`, `META_PIXEL_ID`, `CLOUDINARY_CLOUD_NAME`,
`BREVO_NEWSLETTER_LIST_ID`, the URLs.

**There is no session secret.** Dashboard sessions are random tokens (256 bits) stored as SHA-256
hashes in the `adminsessions` collection; the anti-CSRF token is derived from the session token.
Nothing to rotate: to log every device out, use Paramètres > Sécurité > "Déconnecter toutes les
autres sessions", change the password, or run `pnpm create-admin` with the admin's e-mail (it sets
a new password and closes every session).

#### MongoDB password (`MONGODB_URI`)

1. MongoDB Atlas > **Database Access** > the user of the API > **Edit** > **Edit Password** >
   **Autogenerate Secure Password** > copy it > **Update User**.
2. Put it in `MONGODB_URI` (in `backend/.env`, and in the hosting environment once deployed). If the
   password contains `@ : / ? # %`, encode it (`encodeURIComponent`) or autogenerate another one.
3. Restart the API. The old password stops working at once.

Also in Atlas: **Network Access** must list only the IP addresses of the API server (and yours while
developing), never `0.0.0.0/0` in production.

#### Brevo (`BREVO_API_KEY`)

1. Brevo > **SMTP & API** > **API keys** > **Generate a new API key**.
2. Put it in `BREVO_API_KEY`, restart the API, then send yourself a test (a contact message).
3. Delete the old key in the same Brevo page.

#### Cloudinary (`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`)

1. Cloudinary console > **Settings** > **API Keys** > **Generate New API Key**.
2. Put the new key and secret in `backend/.env`, restart the API, upload a test photo in the dashboard.
3. Deactivate (then delete) the old key in the same page.

#### Meta Conversions API (`META_CAPI_ACCESS_TOKEN`)

1. Events Manager > your Pixel > **Settings** > **Conversions API** > **Generate access token**.
2. Put it in `META_CAPI_ACCESS_TOKEN`, restart the API, place a test order (with `META_TEST_EVENT_CODE`
   set, it shows in **Test events**).
3. If the old token leaked: Meta Business Settings > **Users** > **System users** > the Conversions API
   user > **Revoke tokens**.

#### `REVALIDATE_SECRET`

1. Generate a value: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
2. Put the **same** value in `backend/.env` and `frontend/.env.local` (or both hosting environments).
3. Restart both apps. Change a product in the dashboard: the public page shows it at once.

#### `BACKUP_PASSPHRASE`

1. Choose a long passphrase (5+ random words), save it in your password manager.
2. Put it in `BACKUP_PASSPHRASE`. New backups use it.
3. **Keep the old passphrase** in the password manager until the backups made with it are deleted
   (14 days by default): they can only be restored with the passphrase they were made with.

#### Your dashboard password

Paramètres > Sécurité > "Changer le mot de passe", or "Mot de passe oublié ?" on the login page, or
`pnpm create-admin` from a computer with access to the database.

### Production refuses weak secrets

With `NODE_ENV=production`, the API does not start (and says which variable is wrong) when:

- `MONGODB_URI` has no user or password, a password shorter than 12 characters or a placeholder
  (`password`, `changeme`…), or points to `localhost` or an example host;
- `FRONTEND_ORIGIN`, `ADMIN_URL` or `REVALIDATE_URL` are not `https://` (or are `localhost`);
- `REVALIDATE_SECRET` is shorter than 32 characters, a placeholder, or too repetitive;
- `BREVO_API_KEY` does not look like a Brevo key (`xkeysib-…`), `META_CAPI_ACCESS_TOKEN` like a Meta
  token (100+ letters and digits), or `CLOUDINARY_API_SECRET` is short or a placeholder.

### Secret check before each commit

`pnpm install` turns on the git hook in `.githooks/` (`git config core.hooksPath .githooks`). Before
each commit, `scripts/check-secrets.mjs` refuses a `.env` file, a database backup, a private key, or
an added line that looks like a real connection string, Brevo key, Meta token or GitHub/AWS key. It
says where, never the value. `pnpm check-secrets` checks every tracked file. A false alarm can be
committed with `git commit --no-verify`, after checking it.

### If a secret has leaked

1. Rotate it (above) first, then look for traces: Atlas > **Project** > **Activity Feed**, Brevo > **Transactional** > **Logs**, Cloudinary > **Media Library**.
2. If the database was exposed: rotate `MONGODB_URI`, log every admin session out
   (`pnpm create-admin`), and check the latest orders and the Paramètres page.
3. If it was ever pushed to a git host, rotating is the fix: removing it from the history does not
   un-leak it.

## How the site is protected

**HTTP headers.** Website (`frontend/src/lib/security-headers.ts`): a Content-Security-Policy on every
page (scripts only from the site and Meta's Pixel; images from the site, Cloudinary and Meta; requests
to the site, the API and Meta; no plugin, no framing: `frame-ancestors 'none'`). The dashboard gets a
stricter one from `src/proxy.ts`: a new nonce on every request with `'strict-dynamic'`, no inline
script without it, no third party. Also `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy`, `Permissions-Policy` (no camera, microphone, location, payment, USB),
`Cross-Origin-Opener-Policy`, HSTS (2 years, once on https) and no `X-Powered-By`. API (helmet): a
JSON-only policy (`default-src 'none'`), HSTS, `no-referrer`, `nosniff`.

The public pages keep `'unsafe-inline'` for scripts: they are prebuilt and cached (fast for
customers), so they cannot carry a per-request nonce, and Next.js writes its page data as inline
scripts. External scripts are still limited to the site and Meta, React escapes every text, and the
pages show no HTML written by visitors.

**Adding a third-party service** (a chat widget, analytics, a font host…): add its domains to
`security-headers.ts`, or the browser blocks it.

**Fake orders and spam** (never a CAPTCHA, customers are never slowed down):

- Rate limits per IP: orders 10, contact 5, newsletter 10, catalog 1 200, everything 5 000 per 15
  minutes. Per phone: at most 5 orders in 24 hours (then a French message pointing to WhatsApp).
- Phone numbers are normalised everywhere (`normalizeAlgerianPhone`: spaces, dashes, `+213`, `00213`,
  Arabic digits → `0555123456`), so duplicates, counts and the blacklist always match.
- Honeypot field on the order, contact and newsletter forms: a bot that fills it gets a normal
  answer and nothing is saved.
- Time check: each form sends how long it was on screen (`elapsedMs`). Under 2 seconds, or sent
  without the form, it is **saved and flagged** "Suspecte" / "Suspect" with the reason (fast
  newsletter sign-ups are kept but not sent to Brevo).
- Same phone + same product within 30 minutes: nothing created, and the answer only repeats what
  was sent (never another customer's name or address). 3+ orders per phone or 5+ per IP in 24 h:
  flagged. Blacklisted numbers: flagged "Liste noire". Quantity: 10 at most per order.

**Dashboard and API.**

- Every `/api/admin` route except login, logout and the password reset needs a valid session (a test
  lists every route of the router and checks it).
- CSRF, two locks on every change: the request must come from the site (`Origin`, and
  `Sec-Fetch-Site` not `cross-site`), and carry the session's token in `X-CSRF-Token` (cookie
  `rassm_csrf`, readable by the dashboard only, SameSite=Strict). On top of the SameSite=Strict
  session cookie.
- Every body is validated with a shared Zod schema; JSON bodies limited to 20 kB (200 kB for the
  dashboard); keys like `$gt` or `a.b` refused (NoSQL injection); unexpected errors answer a generic
  French message, never a stack trace or a database message.
- Public answers contain public data only: products without cost price, the customer's own order
  summary without order number, IP, history, notes or costs.
- Photo uploads: the real type is read from the file's first bytes (JPG, PNG, WebP only), 8 MB max,
  one file; GPS position, camera, date, comments, XMP and IPTC are removed before the photo leaves
  the server (`lib/image-metadata.ts`; the JPEG orientation is kept). Uploads and CSV exports of
  customer data: 60 per 15 minutes.
- After login, only a dashboard path of the site is accepted as the next page (`safeAdminPath`): no
  open redirect.
- Login lock, sessions, password rules and reset: see `CLAUDE.md` > Admin API.

**Logs** (`backend/src/lib/logger.ts`): phone numbers are masked (`05••••••56`); addresses,
passwords, tokens, keys, cookies and connection-string credentials are replaced by `[redacted]`,
also inside error messages. Development only: without Brevo, the password reset link is printed in
the API terminal so you can open it; production never prints it.

**Rate limits are kept in memory**: fine for one API server. With several instances behind a load
balancer, move them to a shared store (Redis) or each instance counts separately.

## Backups

MongoDB Atlas free clusters (M0) have no automatic backups. `pnpm backup` saves the whole database in
one compressed file, encrypted with AES-256-GCM when `BACKUP_PASSPHRASE` is set:
`backend/backups/rassm-backup-2026-10-21T03-00-00Z.ndjson.gz.enc`. It keeps the 14 newest
(`BACKUP_KEEP`) and deletes older ones. It only reads the database (safe at any time) and exits with
an error code when it fails (so a scheduler can alert you).

```bash
pnpm backup
```

The files contain every customer's name, phone and address: keep them encrypted, never in git (the
`backups/` folder is ignored and the pre-commit check refuses them), and keep a copy somewhere else
than the server (another disk, a private cloud folder).

### Run it automatically (once deployed)

On the API server (its IP is allowed in Atlas), every night at 3:00, Linux cron (`crontab -e`):

```cron
0 3 * * * cd /srv/rassm && pnpm backup >> /var/log/rassm-backup.log 2>&1
```

Windows (Task Scheduler, from a terminal in the project folder):

```bat
schtasks /Create /SC DAILY /ST 03:00 /TN "RASSM backup" /TR "cmd /c cd /d %CD% && pnpm backup >> backups\backup.log 2>&1"
```

Then copy `backend/backups/` to the off-site place regularly (rclone, a synced folder…). On a host
without a disk you keep (serverless), run the backup from another machine whose IP is allowed in
Atlas.

### Restore

Test a restore once a month: a backup that was never restored is not a backup.

1. Restore into a **new, empty** database first (nothing is overwritten):

   ```bash
   MONGODB_DB_NAME=rassm_restore pnpm restore -- backend/backups/rassm-backup-….ndjson.gz.enc
   ```

   (Windows PowerShell: `$env:MONGODB_DB_NAME="rassm_restore"; pnpm restore -- …`.) It needs the
   `BACKUP_PASSPHRASE` the backup was made with, refuses a modified or truncated file, and creates
   the indexes.

2. Check it (Atlas > Browse Collections > `rassm_restore`: orders, products, delivery fees).
3. Switch: set `MONGODB_DB_NAME=rassm_restore` for the API and restart it. Or, to restore into the
   live database instead, stop the API and run `pnpm restore -- <file> --replace`: it asks you to type
   the database name, empties the collections of the backup, then restores them.

## Before going live

- Atlas **Network Access**: only the API server's IP (remove `0.0.0.0/0`).
- `NODE_ENV=production`, `https://` URLs, `TRUST_PROXY` = the number of proxies in front of the API
  (otherwise rate limits and fraud checks see the proxy's IP, not the customer's).
- `BACKUP_PASSPHRASE` set, the nightly backup scheduled, one restore tested.
- Once the whole domain is on HTTPS for good, optionally submit it to https://hstspreload.org (add
  `; preload` to the HSTS header first). This cannot be undone quickly.
