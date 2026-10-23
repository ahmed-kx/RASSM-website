# Production environment variables (checklist)

Print this page and tick each line as you enter it. **It contains no real value**: the examples show
the format only. Real secrets live in your password manager and in the Vercel / Render dashboards,
never in a file of the project. How to set everything up: [`DEPLOYMENT.md`](DEPLOYMENT.md).

- **Secret = yes**: never share, never in a screenshot; in Vercel, mark it **Sensitive**.
- **Same value** (⇄): must be identical in Vercel and Render.
- "From `render.yaml`": already written in the Blueprint, nothing to type.
- Generate a random value:
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

## Vercel (project `rassm`, Root Directory `frontend`, environment **Production**)

| ☐   | Variable                    | Example format                     | Secret  | Notes                                                                  |
| --- | --------------------------- | ---------------------------------- | ------- | ---------------------------------------------------------------------- |
| ☐   | `NEXT_PUBLIC_SITE_URL`      | `https://rassmstore.live`          | no      | The shop's address (canonical URLs, HSTS)                              |
| ☐   | `NEXT_PUBLIC_API_URL`       | `https://api.rassmstore.live`      | no      | Called by the browser (order, contact, newsletter); allowed by the CSP |
| ☐   | `API_URL`                   | `https://rassm-api.onrender.com`   | no      | Server-side calls and the dashboard API (Render's own address)         |
| ☐   | `ADMIN_HOST`                | `admin.rassmstore.live`            | no      | Host name only, no `https://`                                          |
| ☐   | `TRUST_PROXY`               | `1`                                | no      | Always `1` on Vercel                                                   |
| ☐   | `ADMIN_PROXY_SECRET`        | 43 random characters (`q7Vd-2mX…`) | **yes** | ⇄ same as Render `rassm-api`; 32+ characters                           |
| ☐   | `REVALIDATE_SECRET`         | 43 random characters               | **yes** | ⇄ same as Render `rassm-api`; 32+ characters                           |
| ☐   | `NEXT_PUBLIC_META_PIXEL_ID` | `1234567890123456` (digits)        | no      | Events Manager > Data sources; empty = no Meta script                  |
| ☐   | `CLOUDINARY_CLOUD_NAME`     | `rassm-photos`                     | no      | Optional: only this account's photos are accepted by next/image        |

Do **not** set `NODE_ENV` in Vercel (Vercel sets it; setting it breaks the build).

The build stops with a list when one of `ADMIN_PROXY_SECRET`, `REVALIDATE_SECRET`, `TRUST_PROXY` is
missing or weak, or when an API URL is not `https://`.

## Render: `rassm-api` (web service, Frankfurt, Starter)

| ☐   | Variable                   | Example format                                                                       | Secret  | Notes                                                                       |
| --- | -------------------------- | ------------------------------------------------------------------------------------ | ------- | --------------------------------------------------------------------------- |
| ☐   | `NODE_ENV`                 | `production`                                                                         | no      | From `render.yaml`                                                          |
| ☐   | `MONGODB_URI`              | `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority` | **yes** | Atlas > Database > Connect > Drivers; the read-write API user               |
| ☐   | `MONGODB_DB_NAME`          | `rassm`                                                                              | no      | From `render.yaml`                                                          |
| ☐   | `FRONTEND_ORIGIN`          | `https://rassmstore.live,https://www.rassmstore.live`                                | no      | From `render.yaml`; the first one builds e-mail links                       |
| ☐   | `ADMIN_ORIGIN`             | `https://admin.rassmstore.live`                                                      | no      | From `render.yaml`                                                          |
| ☐   | `ADMIN_URL`                | `https://admin.rassmstore.live/admin`                                                | no      | From `render.yaml`; links in the e-mails                                    |
| ☐   | `TRUST_PROXY`              | `1`                                                                                  | no      | From `render.yaml`; check with `/health/ip` (DEPLOYMENT.md part 7)          |
| ☐   | `ADMIN_PROXY_SECRET`       | 43 random characters                                                                 | **yes** | ⇄ same as Vercel                                                            |
| ☐   | `REVALIDATE_SECRET`        | 43 random characters                                                                 | **yes** | ⇄ same as Vercel                                                            |
| ☐   | `META_PIXEL_ID`            | `1234567890123456`                                                                   | no      | Same ID as `NEXT_PUBLIC_META_PIXEL_ID`                                      |
| ☐   | `META_CAPI_ACCESS_TOKEN`   | `EAAG…` (100+ letters and digits)                                                    | **yes** | Events Manager > Pixel > Settings > Conversions API > Generate access token |
| ☐   | `META_TEST_EVENT_CODE`     | `TEST12345`                                                                          | no      | **Only during the launch test**, then delete it (DEPLOYMENT.md part 10)     |
| ☐   | `BREVO_API_KEY`            | `xkeysib-…`                                                                          | **yes** | Brevo > SMTP & API > API keys                                               |
| ☐   | `BREVO_NEWSLETTER_LIST_ID` | `3`                                                                                  | no      | Brevo > Contacts > Lists, the ID number                                     |
| ☐   | `NOTIFY_EMAIL`             | `you@gmail.com`                                                                      | no      | Receives new orders, messages and alerts                                    |
| ☐   | `EMAIL_FROM`               | `commandes@rassmstore.live`                                                          | no      | Must be a sender validated in Brevo (DEPLOYMENT.md part 9)                  |
| ☐   | `CLOUDINARY_CLOUD_NAME`    | `rassm-photos`                                                                       | no      | Cloudinary > Settings > API Keys                                            |
| ☐   | `CLOUDINARY_API_KEY`       | `123456789012345` (digits)                                                           | no      | Same page (identifies the key; the secret is below)                         |
| ☐   | `CLOUDINARY_API_SECRET`    | 27 letters, digits, `-` / `_`                                                        | **yes** | Same page                                                                   |
| ☐   | `CLOUDINARY_FOLDER`        | `rassm/products`                                                                     | no      | From `render.yaml`                                                          |

Not to set (Render or the API handle them): `PORT` (given by Render), `REVALIDATE_URL` (defaults to
`https://rassmstore.live/api/revalidate`), `META_GRAPH_API_VERSION` (default `v23.0`),
`DNS_FALLBACK_SERVERS` (default). Not on this service: `BACKUP_*` (the backup job has them).

## Render: `rassm-backup` (cron job, Frankfurt, every night 02:00 UTC)

| ☐   | Variable                      | Example format                                                  | Secret  | Notes                                                                |
| --- | ----------------------------- | --------------------------------------------------------------- | ------- | -------------------------------------------------------------------- |
| ☐   | `NODE_ENV`                    | `production`                                                    | no      | From `render.yaml`                                                   |
| ☐   | `MONGODB_URI`                 | `mongodb+srv://rassm-backup:<password>@<cluster>.mongodb.net/…` | **yes** | The **read-only** user (DEPLOYMENT.md part 2)                        |
| ☐   | `MONGODB_DB_NAME`             | `rassm`                                                         | no      | From `render.yaml`                                                   |
| ☐   | `FRONTEND_ORIGIN`             | `https://rassmstore.live`                                       | no      | From `render.yaml` (marks it as production)                          |
| ☐   | `BACKUP_PASSPHRASE`           | 5+ random words, 16+ characters                                 | **yes** | Also in your password manager: **without it no restore is possible** |
| ☐   | `BACKUP_S3_ENDPOINT`          | `https://s3.eu-central-003.backblazeb2.com`                     | no      | Backblaze > the bucket's **Endpoint**, with `https://`               |
| ☐   | `BACKUP_S3_BUCKET`            | `rassm-backups-abcdef`                                          | no      | The bucket name                                                      |
| ☐   | `BACKUP_S3_ACCESS_KEY_ID`     | `003…` (25 characters)                                          | no      | Backblaze application key **keyID** (Write Only key)                 |
| ☐   | `BACKUP_S3_SECRET_ACCESS_KEY` | `K003…` (31 characters)                                         | **yes** | Backblaze **applicationKey**, shown once                             |
| ☐   | `BACKUP_S3_PREFIX`            | `rassm/`                                                        | no      | From `render.yaml`; must match the key's file name prefix            |

Optional: `BACKUP_S3_REGION` (only for a storage that is neither Backblaze B2 nor Cloudflare R2).

## Kept only in your password manager

| ☐   | What                                                                       | Why                                                         |
| --- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| ☐   | `BACKUP_PASSPHRASE` (and older ones)                                       | Each backup needs the passphrase it was made with (14 days) |
| ☐   | Atlas API user and backup user passwords                                   | To rebuild `MONGODB_URI` after a rotation                   |
| ☐   | Your dashboard password                                                    | `admin.rassmstore.live` login                               |
| ☐   | Backblaze, Render, Vercel, Name.com, Brevo, Meta, Cloudinary, Atlas logins | Turn on two-factor authentication on each                   |
