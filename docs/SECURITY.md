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

| Secret                                         | Where                                                     | If it leaks                                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI` (the database user's password)   | `backend/.env`                                            | Full read and write access to every order, customer and admin                                                   |
| `BREVO_API_KEY`                                | `backend/.env`                                            | E-mails sent in your name; the contact lists can be read                                                        |
| `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` | `backend/.env`                                            | Photos uploaded or deleted in your Cloudinary account                                                           |
| `META_CAPI_ACCESS_TOKEN`                       | `backend/.env`                                            | Fake conversion events sent to your Pixel (ads optimisation broken)                                             |
| `REVALIDATE_SECRET`                            | `backend/.env` **and** `frontend/.env.local` (same value) | Someone can force the site to rebuild its pages (load, no data leak)                                            |
| `ADMIN_PROXY_SECRET`                           | `backend/.env` **and** `frontend/.env.local` (same value) | Someone who can reach the API directly can choose the IP the dashboard sees (gets around the per-IP login lock) |
| `BACKUP_PASSPHRASE`                            | `backend/.env` + your password manager                    | The encrypted backups can be read by whoever has the files                                                      |
| `BACKUP_S3_SECRET_ACCESS_KEY`                  | Render (cron job `rassm-backup`)                          | Files can be written to the backup bucket (a "Write Only" key cannot read or delete the backups)                |

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

#### `ADMIN_PROXY_SECRET`

1. Generate a value: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.
2. Put the **same** value in `backend/.env` and `frontend/.env.local` (or both hosting environments).
3. Restart both apps. Log in to the dashboard: Paramètres > Sécurité shows your real IP.

#### `BACKUP_PASSPHRASE`

1. Choose a long passphrase (5+ random words), save it in your password manager.
2. Put it in `BACKUP_PASSPHRASE`. New backups use it.
3. **Keep the old passphrase** in the password manager until the backups made with it are deleted
   (14 days by default): they can only be restored with the passphrase they were made with.

#### Backup bucket key (`BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`)

1. Backblaze > **Application Keys** > **Add a New Application Key** (same settings as in
   `docs/DEPLOYMENT.md`: the backup bucket only, **Write Only**).
2. Put the new key ID and key in the Render cron job `rassm-backup` > **Environment**, then
   **Trigger Run** and check that a new file appears in the bucket.
3. Delete the old key in the same Backblaze page.

#### Your dashboard password

Paramètres > Sécurité > "Changer le mot de passe", or "Mot de passe oublié ?" on the login page, or
`pnpm create-admin` from a computer with access to the database.

### Production refuses weak secrets

An `https://` `FRONTEND_ORIGIN` is a deployed site: without `NODE_ENV=production` the API refuses to
start, so forgetting it never turns off the checks below, the `Secure` cookies, or puts reset links
in the logs. With `NODE_ENV=production`, the API does not start (and says which variable is wrong)
when:

- `MONGODB_URI` has no user or password, a password shorter than 12 characters or a placeholder
  (`password`, `changeme`…), or points to `localhost` or an example host;
- `FRONTEND_ORIGIN`, `ADMIN_ORIGIN`, `ADMIN_URL` or `REVALIDATE_URL` are not `https://` (or are
  `localhost`);
- `TRUST_PROXY` is not set (it must be explicit: see "Before going live");
- `ADMIN_PROXY_SECRET` is missing, shorter than 32 characters, a placeholder or too repetitive;
- `REVALIDATE_SECRET` is shorter than 32 characters, a placeholder, or too repetitive;
- `BREVO_API_KEY` does not look like a Brevo key (`xkeysib-…`), `META_CAPI_ACCESS_TOKEN` like a Meta
  token (100+ letters and digits), or `CLOUDINARY_API_SECRET` is short or a placeholder.

In every mode, `BREVO_API_KEY` needs `NOTIFY_EMAIL` and `EMAIL_FROM` (no address is written in the
code). `META_TEST_EVENT_CODE` in production starts, but with a loud warning: remove it.

One-off commands such as the nightly backup run as a "task" (`loadEnv("task")`): they never serve
requests, so `TRUST_PROXY`, `ADMIN_PROXY_SECRET` and `ADMIN_URL` are not required there; every
other check stays. `BACKUP_S3_*` must be all set or all empty.

**The website does the same** (`frontend/src/lib/production-env.ts`, run by `next.config.ts`): with
an `https://` `NEXT_PUBLIC_SITE_URL`, `next build` and `next start` stop with the list of problems
when `ADMIN_PROXY_SECRET` or `REVALIDATE_SECRET` is missing or weak (32+ characters), `TRUST_PROXY`
is not set, `NEXT_PUBLIC_API_URL` / `API_URL` is not `https://`, or `ADMIN_HOST` is not a bare host
name.

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

**Fake orders and spam** (never a CAPTCHA, customers are never slowed down). Many mobile customers in
Algeria share one IP address (carrier-grade NAT): rules per IP flag and alert at normal volumes and
refuse only far above them.

- Rate limits per IP: orders 30, contact 5, newsletter 10, catalog 1 200, everything 5 000 per 15
  minutes. Per phone: at most 5 orders in 24 hours (then a French message pointing to WhatsApp).
- At most 5 units per order. Per IP in 24 hours: beyond 5 orders or 15 units the orders are flagged
  "Suspecte" and the team gets one e-mail alert; beyond 60 units (cancelled orders not counted) the
  order is refused with a French message pointing to WhatsApp. A suspicious order still reserves
  its stock but holds 3 units at most.
- An e-mail alert when a size loses more than half of its stock within an hour (at least 3 units).
- "Annuler" on several selected orders in the dashboard (after a confirmation), never automatic:
  call a "Suspecte" order first.
- Phone numbers are normalised everywhere (`normalizeAlgerianPhone`: spaces, dashes, `+213`, `00213`,
  Arabic digits → `0555123456`), so duplicates, counts and the blacklist always match.
- Honeypot field on the order, contact and newsletter forms: a bot that fills it gets a normal
  answer and nothing is saved.
- Time check: each form sends how long it was on screen (`elapsedMs`). Under 2 seconds, or sent
  without the form, it is **saved and flagged** "Suspecte" / "Suspect" with the reason (fast
  newsletter sign-ups are kept but not sent to Brevo).
- Same phone + same product within 30 minutes: nothing created, and the answer only repeats what
  was sent with a new random id (never another customer's name, address or order id). 3+ orders per
  phone in 24 h: flagged. Blacklisted numbers: flagged "Liste noire".
- Newsletter: double opt-in. A French confirmation e-mail (Brevo); the address joins the Brevo
  list only once its link is clicked (7 days, single use). Nobody can fill the list with other
  people's addresses.

**Dashboard and API.**

- Every `/api/admin` route except login, logout and the password reset needs a valid session (a test
  lists every route of the router and checks it).
- CSRF, two locks on every change: the request must come from the dashboard's origin (`Origin`,
  and `Sec-Fetch-Site` not `cross-site`), and carry the session's token in `X-CSRF-Token`. The token
  is given in the answer of the login and of `GET /auth/me` and kept in the dashboard's memory,
  never in a cookie, so no other script of the site can read it. On top of the SameSite=Strict
  session cookie.
- Cookies: in production `__Host-rassm_admin` and `__Host-rassm_device` (httpOnly, Secure,
  SameSite=Strict, path "/", no domain: the browser keeps them to that exact host, never shared
  with or set by a subdomain).
- The dashboard can run on its own subdomain (`admin.rassmstore.live`, see "Before going live").
  Then the public pages (which allow inline scripts and load Meta's Pixel) never share an origin
  or a cookie with the dashboard: a flaw on a public page cannot reach it.
- The client IP: public routes read `X-Forwarded-For` only for the `TRUST_PROXY` proxies of the host.
  Dashboard requests go through the website, which signs the visitor's IP with `ADMIN_PROXY_SECRET`;
  the API ignores `X-Forwarded-For` there (a visitor could write any IP in it and get around the
  per-IP login lock). Tested with a forged header.
- Login: 5 failures lock the account and the IP (doubling up to 24 h); a browser the admin already
  logged in with is only stopped by its own IP lock, so nobody can keep the admin locked out. A
  wrong current password when changing it counts as a failure; when it locks the account, that
  session is closed. At most 3 password checks at once (64 MiB each; beyond that a 503 at once),
  and 100 logins per 15 minutes from every IP together (known browsers excepted). "Mot de passe
  oublié ?" answers at once and handles the requests one after the other (same timing whether the
  e-mail is an admin's or not).
- Every body is validated with a shared Zod schema; JSON bodies limited to 20 kB (200 kB for the
  dashboard); keys like `$gt` or `a.b` refused (NoSQL injection); unexpected errors answer a generic
  French message, never a stack trace or a database message.
- Public answers contain public data only: products without cost price, SKU or exact stock (each
  size is available, low with its number when 3 or less, or sold out), the customer's own order
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
also inside error messages. On a local computer only (`ADMIN_URL` on localhost, not production):
without Brevo, the password reset and newsletter confirmation links are printed in the API terminal
so you can open them; a deployed server never prints them.

**Data retention**: the IP address and browser kept with orders, contact messages and newsletter
sign-ups are deleted 12 months after them (the API runs it at startup and once a day; `pnpm
purge-client-data` by hand). The privacy page `/confidentialite` describes what is collected, why,
how long, and how to ask for deletion (WhatsApp). It must be reviewed with a legal advisor (Law
18-07, ANPDP: see `docs/TODO.md`).

**Rate limits are kept in memory** (decided: fine for one API server). They start again from zero
when the API restarts, and with several instances (or serverless hosting) each instance counts
separately: then move them to a shared store (Redis, `rate-limit-redis`). The login locks are in
MongoDB and are not affected.

## What is sent to Meta

Only when the Meta variables are set. Nothing else, and nothing from the dashboard.

- **Browser (Pixel)**: PageView, ViewContent, InitiateCheckout, Purchase (product, value, DZD).
  The site turns off Meta's automatic configuration (`fbq("set", "autoConfig", false, …)`): no
  automatic events and no automatic advanced matching, so the Pixel never reads the order form's
  name or phone. Also turn it off on Meta's side: Events Manager > Data sources > your Pixel >
  **Settings** > **Automatic advanced matching** > off (and **Track events automatically without
  code** > off).
- **Server (Conversions API), two events, the same customer data for both**: the phone, first name,
  last name, wilaya (city) and country, **hashed with SHA-256** before leaving the server; the IP and
  browser of the order; Meta's `_fbp` (browser id) and `_fbc` (ad click id) cookies; the order
  value in DZD and the product.
  - **Purchase**: when the order is placed (same event id as the browser Purchase, so Meta counts
    it once). Never for a bot (a form sent in under 2 seconds or straight to the API: "Non envoyé :
    robot probable" in the order), so the ads do not learn to find bots. Other suspicious orders
    are sent.
  - **ConfirmedOrder**: once per order, when the team confirms it by phone. Never for an order marked
    "Commande de test" or a blacklisted number; a "Suspecte" order is sent only once shipped. Its
    status is in the order's "Informations internes".
- **Ad click id**: a visitor arriving from an ad has `?fbclid=` in the address; the site keeps it in
  the `_fbc` cookie for 90 days (Meta's format), only to link the order to the ad.
- `META_TEST_EVENT_CODE` sends the server events to Events Manager > Test events instead of the real
  statistics: **remove it in production**.

## Backups

MongoDB Atlas free clusters (M0) have no automatic backups. `pnpm backup` saves the whole database in
one compressed file, encrypted with AES-256-GCM when `BACKUP_PASSPHRASE` is set (in production it
refuses to write an unencrypted file, unless `pnpm backup -- --unencrypted` on purpose):
`backend/backups/rassm-backup-2026-10-21T03-00-00Z.ndjson.gz.enc`. It keeps the 14 newest
(`BACKUP_KEEP`) and deletes older ones. It only reads the database (safe at any time) and exits with
an error code when it fails (so a scheduler can alert you).

```bash
pnpm backup
```

The files contain every customer's name, phone and address: keep them encrypted, never in git (the
`backups/` folder is ignored and the pre-commit check refuses them), and keep a copy somewhere else
than the server (another disk, a private cloud folder).

### Run it automatically (production)

The Render cron job `rassm-backup` (`render.yaml`) runs `pnpm backup` every night at 03:00 in
Algeria (02:00 UTC), with a **read-only** database user, and copies the encrypted file to a private
**Backblaze B2** bucket (`BACKUP_S3_*`, `backend/src/lib/offsite-storage.ts`). Render's disk is
wiped after each run, so the bucket is the real copy:

- the bucket deletes copies older than 14 days itself (lifecycle rule: hide 14 days after upload,
  delete 1 day later);
- the cron job's key is **Write Only**: someone who got into Render could add files, but never read
  or delete the backups;
- an unencrypted backup is never sent off-site;
- a failed run (database, encryption or upload) exits with an error and Render e-mails you
  (Integrations > Notifications: "Only failure notifications").

Setup, step by step: `docs/DEPLOYMENT.md` > Backups. Cloudflare R2 works too (S3-compatible: set
its endpoint and `BACKUP_S3_REGION=auto` is found automatically), but it needs a payment card and
its keys cannot be write-only.

To restore a copy: Backblaze > **Buckets** > the bucket > **Browse Files** > download the file, then
follow "Restore" below on your computer (with the passphrase from your password manager).

On your own computer, `pnpm backup` without `BACKUP_S3_*` keeps the file in `backend/backups/` only.

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

The click-by-click guide is `docs/DEPLOYMENT.md` (Vercel, Render, DNS, Brevo, Meta, Atlas, backups,
launch day). It covers every point below.

- Atlas **Network Access**: only Render's outbound IP ranges for Frankfurt (remove `0.0.0.0/0`).
- `TRUST_PROXY`: website on Vercel `1` (Vercel replaces `X-Forwarded-For` with the visitor's IP).
  API on Render: start with `1`, then open `https://api.rassmstore.live/health/ip` from your phone
  on mobile data: `ip` must be the IP that a "what is my IP" site shows. If it is not, count the
  `forwardedFor` entries from the right up to your IP: that number is `TRUST_PROXY`. Too low: every
  customer gets the proxy's IP (shared limits, every order flagged). Too high: anyone can choose
  their IP. Also check a test order in the dashboard (Adresse IP must be yours) and Paramètres >
  Sécurité.
- `NODE_ENV=production` in the API (not in Vercel: Vercel sets it itself) and `https://` URLs in
  both apps.
- `ADMIN_PROXY_SECRET`: the same 32+ random characters in both apps.
- Dashboard on its own subdomain: DNS `admin.rassmstore.live` pointing to the website, then in the
  website `ADMIN_HOST=admin.rassmstore.live`, in the API `ADMIN_ORIGIN=https://admin.rassmstore.live`
  and `ADMIN_URL=https://admin.rassmstore.live/admin`. Check that `https://rassmstore.live/admin`
  redirects there and `https://rassmstore.live/api/admin/auth/me` answers 404.
- Remove `META_TEST_EVENT_CODE`; turn off Automatic advanced matching in Events Manager (above).
- `BACKUP_PASSPHRASE` set, the Render cron job's first run copied a file to the B2 bucket, and that
  file restored once into a test database.
- `/confidentialite` reviewed with a legal advisor (Law 18-07), and the ANPDP declaration done if
  needed.
- Once the whole domain is on HTTPS for good, optionally submit it to https://hstspreload.org (add
  `; preload` to the HSTS header first). This cannot be undone quickly.
