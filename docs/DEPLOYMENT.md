# Going live: Vercel + Render

This guide puts RASSM online, one click at a time. Follow the parts **in order**: each one needs the
one before it. Budget about 3 hours, plus waiting for DNS (usually minutes, sometimes a few hours).

| What                     | Where                                       | Address                                              |
| ------------------------ | ------------------------------------------- | ---------------------------------------------------- |
| Website (shop)           | Vercel, Pro plan, functions in Frankfurt    | `https://rassmstore.live` (`www.` redirects to it)   |
| Dashboard                | Vercel (same project)                       | `https://admin.rassmstore.live/admin`                |
| API                      | Render, Starter plan, Frankfurt             | `https://api.rassmstore.live`                        |
| Nightly backup           | Render cron job → Backblaze B2 (EU)         | every night at 03:00 in Algeria, copies kept 14 days |
| Database, photos, e-mail | MongoDB Atlas, Cloudinary, Brevo (as today) |                                                      |
| Domain and DNS           | Name.com                                    |                                                      |

Every environment variable, per platform, with its format: [`ENV-PRODUCTION.md`](ENV-PRODUCTION.md)
(print it and tick each line). Security background: [`SECURITY.md`](SECURITY.md).

**Golden rules**

- Secrets go only into the Vercel and Render dashboards and your password manager. Never into a
  file in the project, a chat, a screenshot or an e-mail.
- When a step says "copy the value", paste it into your password manager first, then into the
  dashboard.
- Never use `0.0.0.0/0` in Atlas once the site is live (part 8).

---

## Part 0. Prepare (15 minutes)

1. Open your password manager and create a folder **RASSM production**.
2. Create the three random values the two apps share. On your computer, in a terminal in the
   project folder, run this command **twice** and save each result in the password manager:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

   - the first one is `ADMIN_PROXY_SECRET`;
   - the second one is `REVALIDATE_SECRET`.

3. Choose the **backup passphrase** (`BACKUP_PASSPHRASE`): 5 or more random words, e.g.
   `lampe-dune-orange-piano-sel-vingt` (use your own). Save it in the password manager. **Without it a
   backup can never be restored.**
4. Have these ready (they are in your current `backend/.env`, or in each service): the MongoDB Atlas
   connection string, the Brevo API key and list ID, the Cloudinary cloud name / key / secret, the
   Meta Pixel ID and Conversions API token, and the e-mail address that receives the team e-mails.
5. You need a bank card that works online (Vercel Pro and Render are paid).

---

## Part 1. GitHub (the code)

The code is already on GitHub: `https://github.com/ahmed-kx/RASSM-website`, branch `main`.

1. Check it is **private**: open the repository > **Settings** > **General** > scroll to
   **Danger Zone**. It must say "This repository is currently private". If it is public: **Change
   visibility** > **Make private**.
2. Send the latest commit: in VS Code, a terminal in the project folder:

   ```bash
   git push
   ```

   Your local branch `master` is linked to `main` on GitHub, so `git push` updates `main`, the branch
   Vercel and Render deploy. (The local branch named `main` on your computer is old and unused; you
   can ignore it.)

If you ever start from a new computer without the repository: GitHub > **+** (top right) > **New
repository** > name `RASSM-website`, **Private**, no README > **Create repository**, then in the
project folder: `git remote add origin https://github.com/<you>/RASSM-website.git` and
`git push -u origin master:main`.

---

## Part 2. MongoDB Atlas: a read-only user for the backups

The backup only reads the database, so it gets its own user who **cannot change anything**.

1. https://cloud.mongodb.com > your project > left menu **Database Access** (under Security) >
   **+ Add New Database User**.
2. Authentication Method: **Password**. Username: `rassm-backup`. Click **Autogenerate Secure
   Password**, then **Copy**, and save it in the password manager.
3. **Database User Privileges** > **Built-in Role** > **Only read any database**.
4. **Add User**.
5. Build its connection string: take your current `MONGODB_URI` and replace the user and password
   with `rassm-backup` and the new password:
   `mongodb+srv://rassm-backup:<new password>@<your cluster address>/?retryWrites=true&w=majority`.
   Save it in the password manager as **MONGODB_URI (backup)**.

Do not touch **Network Access** yet: it stays open until Render's addresses are known (part 8).

---

## Part 3. Backblaze B2: the off-site backup bucket (free)

The nightly backup is copied here. Backblaze gives the first 10 GB free; RASSM's backups are a few
MB each.

1. Go to https://www.backblaze.com > **Sign Up** > **B2 Cloud Storage**. When asked for the
   **region**, choose **EU Central** (data stays in Europe). Confirm your e-mail.
2. Left menu **B2 Cloud Storage** > **Buckets** > **Create a Bucket**:
   - **Bucket Unique Name**: `rassm-backups-` followed by 6 random letters (names are global);
   - **Files in Bucket are**: **Private**;
   - **Default Encryption**: **Enable**;
   - **Object Lock**: **Disable**;
   - **Create a Bucket**.
3. On the new bucket's card, copy the **Endpoint** (it looks like
   `s3.eu-central-003.backblazeb2.com`). Your `BACKUP_S3_ENDPOINT` is `https://` + that value.
4. Keep copies 14 days: on the bucket's card > **Lifecycle Settings** > **Use custom lifecycle
   rules**:
   - **File Path**: `rassm/`;
   - **Days Till Hide**: `14`;
   - **Days Till Delete**: `1`.

   Then click **Update Bucket**. Backblaze checks once a day, so a copy is deleted 15 to 16 days
   after it was made.

5. Create the key the backup job uses: left menu **Application Keys** > **Add a New Application
   Key**:
   - **Name of Key**: `rassm-render-backup`;
   - **Allow access to Bucket(s)**: your `rassm-backups-…` bucket;
   - **Type of Access**: **Write Only** (it can add files, never read or delete them);
   - **Allow List All Bucket Names**: unchecked;
   - **File name prefix**: `rassm/`;
   - **Duration**: empty.

   Click **Create New Key**.

6. The page shows the key **once**: save `keyID` (→ `BACKUP_S3_ACCESS_KEY_ID`) and
   `applicationKey` (→ `BACKUP_S3_SECRET_ACCESS_KEY`) in the password manager now.

---

## Part 4. Render: the API and the nightly backup

### 4.1 Account

1. https://render.com > **Get Started** > **GitHub** (sign in with the GitHub account that owns the
   repository). Workspace plan: **Hobby** (free; you pay only for the services).
2. Add your card: avatar (top right) > **Billing** > **Payment Method**.

### 4.2 Create both services from the Blueprint

The file `render.yaml` in the project describes both services: region Frankfurt, Starter plan,
build and start commands, health check, Node.js version.

1. Render dashboard > **+ New** > **Blueprint**.
2. **Connect a repository**: click **Configure account** if `RASSM-website` is not listed, allow
   Render to access **only** this repository, then **Connect** next to it.
3. **Blueprint Name**: `rassm`. Branch: `main`. Render reads `render.yaml` and lists
   `rassm-api` (Web Service) and `rassm-backup` (Cron Job).
4. Render asks for every value marked "secret" in the file. Fill them in from the password manager.
   For the details and formats of each one, see [`ENV-PRODUCTION.md`](ENV-PRODUCTION.md):

   **rassm-api**
   - `MONGODB_URI`: your current connection string (the API user, read and write).
   - `ADMIN_PROXY_SECRET`, `REVALIDATE_SECRET`: the two values from part 0.
   - `META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`: from Meta Events Manager (as in your `.env`).
   - `BREVO_API_KEY`, `BREVO_NEWSLETTER_LIST_ID`, `NOTIFY_EMAIL`: as in your `.env`.
   - `EMAIL_FROM`: for now, the sender already validated in Brevo (as in your `.env`); you change it
     to `commandes@rassmstore.live` in part 9.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: as in your `.env`.

   **rassm-backup**
   - `MONGODB_URI`: the **backup** connection string (part 2).
   - `BACKUP_PASSPHRASE`: from part 0.
   - `BACKUP_S3_ENDPOINT`: `https://s3.eu-central-003.backblazeb2.com` (yours, part 3).
   - `BACKUP_S3_BUCKET`: the bucket name.
   - `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`: the key from part 3.

5. Click **Apply** (or **Deploy Blueprint**). Render builds both services (3 to 5 minutes). Follow it
   in `rassm-api` > **Events** / **Logs**.
6. When `rassm-api` shows **Live**, open the address shown under its name, like
   `https://rassm-api.onrender.com/health`: it must answer `{"ok":true}`. Copy that
   `https://rassm-api.onrender.com` address: Vercel needs it (`API_URL`).

If the deploy fails, open **Logs**: the API says exactly which variable is missing or wrong
("Invalid environment variables…"). Fix it in **Environment** > **Save, rebuild, and deploy**.

The non-secret values (`NODE_ENV=production`, `FRONTEND_ORIGIN`, `ADMIN_ORIGIN`, `ADMIN_URL`,
`TRUST_PROXY=1`, `MONGODB_DB_NAME`, `CLOUDINARY_FOLDER`, `BACKUP_S3_PREFIX`) come from `render.yaml`:
nothing to type.

### 4.3 The domain of the API

1. `rassm-api` > **Settings** > **Custom Domains** > **+ Add Custom Domain** > `api.rassmstore.live` >
   **Save**.
2. Render shows a **CNAME** to create, pointing to `rassm-api.onrender.com`. You add it in part 6;
   Render then checks it and installs the HTTPS certificate by itself.

### 4.4 Be told when something fails

Render dashboard > **Integrations** > **Notifications** > **Notification Destination**: **Email** >
**Default Service Notifications**: **Only failure notifications**. You then get an e-mail when a
deploy fails, when the API stops answering, or when a nightly backup fails.

The daily deletion of IP addresses older than 12 months runs inside the API (at startup and every
24 hours): no extra job is needed.

---

## Part 5. Vercel: the website and the dashboard

### 5.1 Account and project

1. https://vercel.com/signup > **Continue with GitHub**. Choose **Pro** when asked for a plan (or
   later: team **Settings** > **Billing** > **Upgrade to Pro**).
2. **Add New…** > **Project** > **Import Git Repository**: if `RASSM-website` is not listed, click
   **Adjust GitHub App Permissions** and allow Vercel to access **only** this repository. Then
   **Import**.
3. **Configure Project**:
   - **Project Name**: `rassm`.
   - **Framework Preset**: **Next.js** (detected).
   - **Root Directory**: **Edit** > select `frontend` > **Continue**.
   - **Build and Output Settings**: leave them; the file `frontend/vercel.json` sets the install
     command (exact pnpm version, lockfile), the build command, the Frankfurt region, and that only
     `main` is deployed (no preview deployments).
   - **Environment Variables**: add each line below (**Key** / **Value** / **Add**). Values and
     formats: [`ENV-PRODUCTION.md`](ENV-PRODUCTION.md) > Vercel.

     | Key                         | Value                                         |
     | --------------------------- | --------------------------------------------- |
     | `NEXT_PUBLIC_SITE_URL`      | `https://rassmstore.live`                     |
     | `NEXT_PUBLIC_API_URL`       | `https://api.rassmstore.live`                 |
     | `API_URL`                   | `https://rassm-api.onrender.com` (yours, 4.2) |
     | `ADMIN_HOST`                | `admin.rassmstore.live`                       |
     | `TRUST_PROXY`               | `1`                                           |
     | `ADMIN_PROXY_SECRET`        | the same value as in Render                   |
     | `REVALIDATE_SECRET`         | the same value as in Render                   |
     | `NEXT_PUBLIC_META_PIXEL_ID` | your Pixel ID                                 |
     | `CLOUDINARY_CLOUD_NAME`     | your Cloudinary cloud name                    |

     **Do not add `NODE_ENV`**: Vercel sets it itself, and setting it would break the build.

4. **Deploy**. The build takes 2 to 4 minutes. It reads the products from the API, so Render must
   be **Live** first (part 4). It succeeds with a "Congratulations" screen; the site is reachable on
   a `….vercel.app` address until the domain is connected.

If the build stops with "Invalid environment variables for production", the message lists the
variables to fix: **Settings** > **Environment Variables**, then **Deployments** > the latest >
**⋯** > **Redeploy**.

### 5.2 Settings to check once

In the project > **Settings**:

1. **Environment Variables**: open `ADMIN_PROXY_SECRET` and `REVALIDATE_SECRET` > **Edit** > turn on
   **Sensitive** (nobody can read them back) and keep only the **Production** environment ticked
   (also for the other variables: there are no preview deployments).
2. **Build and Deployment**: **Root Directory** `frontend`; **Include files outside the root
   directory in the Build Step**: **Enabled** (the site uses `shared/`); **Node.js Version**: 24.x.
   Optional: **Skip deployments when there are no changes to the root directory or its
   dependencies**: **Enabled** (a change to the API alone then does not rebuild the site).
3. **Functions** > **Function Region**: it shows **Frankfurt (fra1)**, from `vercel.json`. Frankfurt
   is next to the API on Render, which keeps the pages fast.
4. **Deployment Protection**: leave the default (**Standard Protection**: the public site stays
   public).

### 5.3 The domains

Project > **Settings** > **Domains**:

1. **Add Domain** > `rassmstore.live` > **Add**. If Vercel offers to also add `www.rassmstore.live`
   with a redirect, accept **Redirect www.rassmstore.live to rassmstore.live** (otherwise add
   `www.rassmstore.live` yourself, then **Edit** > **Redirect to** `rassmstore.live` > **308**).
2. **Add Domain** > `admin.rassmstore.live` > **Add**, with **no** redirect (it serves the
   dashboard).
3. Each domain shows **Invalid Configuration** with the DNS record to create (type, name, value).
   **Write down the exact values Vercel shows**: the A record of `rassmstore.live` (often
   `76.76.21.21`, newer projects show another Vercel IP such as `216.198.79.1`) and the CNAME of
   `www` and `admin` (often `cname.vercel-dns.com`, or a project-specific address ending in
   `vercel-dns-0xx.com`). Use Vercel's values, not the examples.

---

## Part 6. Name.com: the DNS records

### 6.1 Open the DNS page

1. https://www.name.com > **Sign In** > **My Account** (top right) > **My Domains**.
2. Click **rassmstore.live**.
3. Check the **Nameservers** of the domain: they must be Name.com's (`ns1.name.com` … `ns4.name.com`).
   If they are something else, the records below have no effect: set them back to the Name.com
   defaults first.
4. Open **Manage DNS Records** (the DNS records page of the domain).

### 6.2 Remove what conflicts

A new Name.com domain usually comes with default records that send the domain to a parking page.

1. Delete every **A**, **AAAA**, **ALIAS / ANAME** and **CNAME** record whose **Host** is empty
   (the bare domain), `www`, `*` (wildcard), `admin` or `api`.
2. Keep **MX** and **TXT** records unless you know they are parking leftovers.
3. In the domain's **URL Forwarding** page: delete any forwarding of `rassmstore.live` or `www`.
4. If you see **CAA** records: keep them only if they include `letsencrypt.org` and `pki.goog`
   (the certificate authorities of Vercel and Render), otherwise delete them.

### 6.3 Add the records

In Name.com, **Host** is only the part before the domain (empty for `rassmstore.live` itself), and
the shortest **TTL** is 300 seconds. For each line: choose the **Type**, fill **Host** and
**Answer** (the value), set the **TTL**, then **Add Record**.

| Type  | Host    | Answer (value)                                                  | TTL |
| ----- | ------- | --------------------------------------------------------------- | --- |
| A     | (empty) | the IP Vercel shows for `rassmstore.live`, e.g. `76.76.21.21`   | 300 |
| CNAME | `www`   | the value Vercel shows for `www`, e.g. `cname.vercel-dns.com`   | 300 |
| CNAME | `admin` | the value Vercel shows for `admin`, e.g. `cname.vercel-dns.com` | 300 |
| CNAME | `api`   | `rassm-api.onrender.com` (the value Render shows, part 4.3)     | 300 |

Later parts add more records here: Brevo (part 9) and Meta (part 10).

### 6.4 Wait, then check

- Usually 5 to 30 minutes, sometimes up to 24 hours (48 at worst). Check progress on
  https://dnschecker.org (type `rassmstore.live`, then `api.rassmstore.live`).
- Vercel > **Settings** > **Domains**: each domain turns **Valid Configuration**, and the HTTPS
  certificate is created by itself.
- Render > `rassm-api` > **Settings** > **Custom Domains**: click **Verify** next to
  `api.rassmstore.live` if it is not verified yet; then **Certificate Issued**.

When all are green:

1. `https://rassmstore.live` shows the shop; `https://www.rassmstore.live` lands on
   `https://rassmstore.live`.
2. `https://rassmstore.live/admin` goes to `https://admin.rassmstore.live/admin/connexion`; log in
   with your dashboard account.
3. `https://rassmstore.live/api/admin/auth/me` answers **404** (the dashboard API only exists on
   `admin.`).
4. `https://api.rassmstore.live/health` answers `{"ok":true}`.

---

## Part 7. Check that the API sees real visitor IPs (`TRUST_PROXY`)

The fraud rules count orders per IP address. If the API saw Render's proxy instead of the customer,
every customer would share one IP and real orders would be flagged. Check it once:

1. On your phone, **Wi-Fi off** (mobile data), open https://www.whatismyip.com and note your IP.
2. On the same phone, open `https://api.rassmstore.live/health/ip`. It shows
   `{"ip":"…","forwardedFor":[…]}`.
3. `ip` must be **the same IP** as in step 1. Then `TRUST_PROXY=1` is right: nothing to do.
4. If `ip` is different: look at the `forwardedFor` list. Count its entries **from the right** up to
   the one equal to your IP (the last entry is 1). That count is the correct value: Render >
   `rassm-api` > **Environment** > `TRUST_PROXY` > the new value > **Save and deploy**. Check again.

The website's own value is always `1` on Vercel (Vercel replaces that header with the visitor's IP,
so nobody can fake it).

---

## Part 8. MongoDB Atlas: only Render may connect

Today Atlas accepts connections from anywhere (`0.0.0.0/0`). Now that the API runs, allow only
Render's Frankfurt addresses.

1. Render > `rassm-api` > **Connect** (button top right) > **Outbound** tab: a short list of IP
   ranges written like `1.2.3.0/24`. These ranges are shared by every Render service in Frankfurt (the
   API and the backup job). Copy them.
2. Atlas > your project > left menu **Network Access** (under Security) > **IP Access List** >
   **+ Add IP Address**. Paste the first range in **Access List Entry**, comment `Render Frankfurt`,
   **Confirm**. Repeat for each range.
3. Wait until each new line shows **Active**.
4. Delete the `0.0.0.0/0` line: **Delete** on its row > **Delete**.
5. Restart the API to prove it still connects: Render > `rassm-api` > **Manual Deploy** >
   **Restart service** (or **Deploy latest commit**), then check `https://api.rassmstore.live/health`.

**When you need to work from your computer** (`pnpm create-admin`, `pnpm restore`, local
development on the real database): Atlas > **Network Access** > **+ Add IP Address** > **Add
Current IP Address**, turn on **This entry is temporary and will be deleted in** > **1 day**, then
**Confirm**. Your home IP changes from time to time: add it again when needed.

If Render ever announces new outbound ranges, add them in Atlas **before** the date they give.

---

## Part 9. Brevo: send from commandes@rassmstore.live

### 9.1 Authenticate the domain

1. Brevo > your name (top right) > **Senders, Domains & Dedicated IPs** > **Domains** tab > **Add a
   domain** > `rassmstore.live` > **Add domain**.
2. Choose **Authenticate the domain yourself** (manual setup). Brevo lists the records to create.
   Today they are usually:

   | Type  | Host (at Name.com)  | Value (copy it from Brevo, these are examples)     |
   | ----- | ------------------- | -------------------------------------------------- |
   | TXT   | (empty)             | `brevo-code:0123456789abcdef…`                     |
   | CNAME | `brevo1._domainkey` | `b1.rassmstore-live.dkim.brevo.com`                |
   | CNAME | `brevo2._domainkey` | `b2.rassmstore-live.dkim.brevo.com`                |
   | TXT   | `_dmarc`            | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |

   Copy **exactly** what Brevo shows (older accounts show the DKIM key as one TXT record
   `mail._domainkey` instead of two CNAMEs; if Brevo lists an SPF TXT record, add it too). Brevo
   shows the full host, like `brevo1._domainkey.rassmstore.live`: at Name.com type only the part
   before `.rassmstore.live`.

3. Add them at Name.com (part 6.1, **Manage DNS Records**), TTL 300. Only one DMARC record may
   exist: if `_dmarc` already has one, edit it instead of adding a second.
4. Wait 15 to 30 minutes, then in Brevo click **Authenticate this email domain** (or **Verify**).
   Each record turns green.

### 9.2 Receive the e-mails sent to commandes@ (recommended)

`commandes@rassmstore.live` has no mailbox. Brevo may send a code to it, and customers may answer
the newsletter e-mail. Forward it to your own address:

1. Name.com > **My Domains** > `rassmstore.live` > **Email Forwarding** > add `commandes` →
   your Gmail address > **Save**. Name.com adds its MX records by itself.
2. Send a test e-mail from another address to `commandes@rassmstore.live`: it must arrive in Gmail.

### 9.3 Add the sender, then switch

1. Brevo > **Senders, Domains & Dedicated IPs** > **Senders** tab > **Add sender**: From name
   `RASSM`, From email `commandes@rassmstore.live` > **Save**. If Brevo asks for a code, it arrives in
   your Gmail through the forwarding.
2. Render > `rassm-api` > **Environment** > `EMAIL_FROM` > **Edit** > `commandes@rassmstore.live` >
   **Save and deploy**.
3. Test: on the site, send a contact message. The team e-mail arrives from
   `commandes@rassmstore.live`. In Gmail, **⋮** > **Show original**: SPF, DKIM and DMARC say
   **PASS**.

---

## Part 10. Meta: verify the domain, test the events

### 10.1 Verify rassmstore.live

1. https://business.facebook.com > **Settings** (gear icon) > **Brand safety and suitability** >
   **Domains** > **+ Add** > `rassmstore.live` > **Add**.
2. Choose **Update DNS TXT record**. Meta shows a value like
   `facebook-domain-verification=abc123…`.
3. Name.com > **Manage DNS Records** > Type **TXT**, Host empty, Answer = that value, TTL 300 >
   **Add Record**. (Several TXT records on the bare domain are fine: Brevo's and Meta's live side by
   side.)
4. Back in Meta, after 10 to 30 minutes: **Verify domain**. It turns **Verified**.

### 10.2 Turn off automatic matching (once)

Events Manager > **Data sources** > your Pixel > **Settings**: **Automatic advanced matching**: Off,
and **Track events automatically without code**: Off. (The site already turns them off in its code;
this is the Meta-side switch.)

### 10.3 Final test of the events

This is done together with the launch day test order (part 11, step 5): the same order checks the
e-mail, the dashboard and Meta.

1. Events Manager > your Pixel > **Test events** tab.
2. **Confirm your server events are set up correctly**: copy the test code shown (like `TEST12345`).
   Render > `rassm-api` > **Environment** > **Add Environment Variable**: `META_TEST_EVENT_CODE` =
   that code > **Save and deploy**. (While it is set, the server events go to **Test events** only,
   and the API logs a loud warning: that is expected.)
3. **Test browser events**: type `https://rassmstore.live` > **Open website**.
4. Place the launch day test order in that window (part 11).
5. In **Test events** you must see, within a minute: **PageView**, **ViewContent**,
   **InitiateCheckout**, **Purchase** from the **Browser** and **Purchase** from the **Server**
   marked **Deduplicated** (same event id). After you confirm the order in the dashboard:
   **ConfirmedOrder** (Server).
6. **Remove the test code**: Render > `rassm-api` > **Environment** > `META_TEST_EVENT_CODE` > the
   delete (trash) icon > **Save and deploy**. From now on, events count in your ads statistics.

---

## Part 11. Launch day checklist

Do it in this order, the day you open the shop.

1. **Back up first**, from your computer (with your IP temporarily allowed in Atlas, part 8):
   `pnpm backup`. Keep the file until the shop has run for a week.
2. **Delete the test data** (orders, messages and sign-ups made while building the site):
   1. Dashboard > **Commandes** > tab **Toutes**: select every test order still **Nouvelle** or
      **Confirmée** > **Annuler** (their stock goes back to the products).
   2. Atlas > **Database** > **Browse Collections** > database `rassm`. For each of these
      collections, hover its name > trash icon **Drop Collection** > type its name > **Drop**:
      `orders`, `counters` (the internal numbers start again at RSM-000001), `contactmessages`,
      `newslettersubscribers`, `adspends`, `alertlogs`, `blacklists`, `loginthrottles`.
      **Never** drop `products`, `deliveryfees`, `settings`, `admins` or `adminsessions`.
   3. Render > `rassm-api` > **Manual Deploy** > **Restart service** (or **Deploy latest
      commit**; the API recreates the
      indexes of the dropped collections at startup).
   4. In Brevo > **Contacts**, delete the test addresses from the newsletter list, if any.
3. **Your admin account**:
   - Dashboard > **Paramètres** > **Sécurité** > **Changer le mot de passe**: a new password used
     nowhere else (12+ characters, saved in the password manager).
   - **Déconnecter toutes les autres sessions**.
   - Atlas > **Browse Collections** > `admins`: only your account must be listed. Delete test admin
     accounts if any.
4. **Products and costs**:
   - Dashboard > **Produits**: each product's real stock per color and size, and its **Prix de
     revient**.
   - **Paramètres**: packaging and return costs, and the low stock threshold.
   - **Livraison**: check the Anderson prices.
5. **A real test order from your phone** (mobile data, not Wi-Fi), with `META_TEST_EVENT_CODE` still
   set (part 10.3):
   1. Open the shop from Instagram or a link, choose a product, fill the form with your real name
      and number, and order.
   2. `/merci` says the order is received.
   3. The new order e-mail arrives at `NOTIFY_EMAIL`, from `commandes@rassmstore.live`.
   4. The dashboard (`https://admin.rassmstore.live/admin`) shows the order, with a sound and a
      toast if open. Open it: **Adresse IP** must be your phone's IP (part 7).
   5. **Confirmer** the order (after "calling" yourself).
   6. Meta **Test events**: Purchase (browser + server, deduplicated) and ConfirmedOrder (part 10.3).
   7. Order **⋯** > **Marquer comme commande de test**, then **Annuler** it: the stock goes back, and
      it stays out of every statistic.
   8. Remove `META_TEST_EVENT_CODE` (part 10.3, step 6).
6. **Backups**: Render > `rassm-backup` > **Trigger Run**. The run's **Logs** end with "Backup copied
   off-site". Backblaze > **Buckets** > **Browse Files** > `rassm/`: the file is there. Once, test a
   restore of that file on your computer (`docs/SECURITY.md` > Restore).
7. **Final looks**: open `https://rassmstore.live` on a phone and a computer, check the privacy page
   `/confidentialite` (to be reviewed with a legal advisor, see `docs/TODO.md`).

---

## Part 12. Updating the site later

Everything deploys by itself when `main` changes on GitHub:

1. Change the code on your computer, check it (`pnpm typecheck`, `pnpm lint`, `pnpm test`), commit.
2. `git push`.
3. **Vercel** rebuilds the website (about 3 minutes; project > **Deployments**). **Render** redeploys
   the API and the backup job only when `backend/`, `shared/` or the dependencies changed (about 3
   minutes; `rassm-api` > **Events**). The old version keeps serving until the new one is ready
   (no downtime).

**Changing an environment variable**:

- **Vercel**: **Settings** > **Environment Variables** > edit > **Save**, then **Deployments** > the
  latest > **⋯** > **Redeploy**. Variables starting with `NEXT_PUBLIC_` are written into the pages
  at build time: they need this redeploy.
- **Render**: the service > **Environment** > edit > **Save and deploy** (or **Save, rebuild, and
  deploy** when told to).

**When upgrading Node.js or pnpm**: Node.js is in `.node-version` (Render) and `engines` in the
`package.json` files (Vercel); pnpm is in `packageManager` (root `package.json`) and must be the
same in `frontend/vercel.json` and `render.yaml` (a test checks it).

Every **month**: download one backup from Backblaze and restore it into a test database
(`docs/SECURITY.md` > Restore). Every **year**: rotate the secrets (`docs/SECURITY.md`).

---

## Part 13. When something breaks

### Where to look

| Problem on…               | Look at                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| The website build         | Vercel > **Deployments** > the failed one > **Building** (the build log)                          |
| The website while it runs | Vercel > project > **Logs** (filter **Error**)                                                    |
| The API                   | Render > `rassm-api` > **Logs** (and **Events** for deploys)                                      |
| The nightly backup        | Render > `rassm-backup` > **Logs** of the run; Render e-mails you when a run fails                |
| E-mails                   | Brevo > **Transactional** > **Logs**; the order's "Informations internes" in the dashboard        |
| Meta events               | Events Manager > your Pixel > **Overview** / **Diagnostics**; the order's "Informations internes" |

The API logs never contain passwords, keys, addresses or full phone numbers.

### Common causes

| Symptom                                                      | Cause and fix                                                                                                                       |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Vercel build: "Invalid environment variables for production" | The message lists them: fix them in Vercel, then **Redeploy**                                                                       |
| Vercel build fails while reading products                    | The API is down or `API_URL` is wrong: check `https://rassm-api.onrender.com/health`                                                |
| Render: "Invalid environment variables"                      | Fix the variable named in the log (**Environment**)                                                                                 |
| Render: "Could not connect to MongoDB"                       | Atlas **Network Access** misses a Render range (part 8), or the password in `MONGODB_URI` changed                                   |
| Dashboard login answers "Requête refusée"                    | Open the dashboard on `https://admin.rassmstore.live` (not the `vercel.app` address); `ADMIN_ORIGIN` in Render must be that address |
| A product change does not show on the shop                   | `REVALIDATE_SECRET` differs between Vercel and Render (or the page refreshes within 30 seconds anyway)                              |
| Every order is flagged "Suspecte" with the same IP           | `TRUST_PROXY` of the API (part 7)                                                                                                   |
| The order form says "Impossible de joindre le serveur"       | `https://api.rassmstore.live/health` down (Render), or `NEXT_PUBLIC_API_URL` wrong in Vercel (then **Redeploy**)                    |

### Going back to the previous version (rollback)

- **Website**: Vercel > **Deployments** > the last deployment that worked > **⋯** > **Instant
  Rollback** (or **Promote to Production**). Takes seconds.
- **API**: Render > `rassm-api` > **Events** > the last deploy that worked > **Rollback** (or
  **Deploys** > **⋯** > **Rollback to this deploy**). If Render turned off automatic deploys after the
  rollback, turn them back on (**Settings** > **Auto-Deploy**) once the fix is pushed.
- A rollback changes the code only, **never the data**. To go back in the data, restore a backup
  (`docs/SECURITY.md` > Restore; into a new database first).
- Then fix the problem on your computer, push, and check that the new deploy is green.

---

## Monthly costs

Prices as of October 2026; check each pricing page, they change.

| Service                     | Plan                                    | Per month                              |
| --------------------------- | --------------------------------------- | -------------------------------------- |
| Vercel                      | Pro, 1 member                           | $20 (includes a monthly usage credit)  |
| Render, API                 | Starter web service (always on, 512 MB) | $7                                     |
| Render, nightly backup      | Starter cron job (a minute per night)   | $1 (Render's minimum per cron job)     |
| Render workspace            | Hobby                                   | $0                                     |
| Backblaze B2                | first 10 GB free                        | $0 (the backups are a few MB)          |
| MongoDB Atlas               | unchanged                               | as today                               |
| Cloudinary, Brevo           | unchanged (free plans)                  | $0 (Brevo free: 300 e-mails a day)     |
| Name.com, `rassmstore.live` | yearly renewal                          | the renewal price in Name.com ÷ 12     |
| **Total**                   |                                         | **about $28 a month**, plus the domain |

Meta ads are paid separately in Meta Ads Manager. If the shop grows past what one Starter instance
handles (slow answers, memory alerts in Render), the next step is Render **Standard** ($25): change
`plan: starter` to `plan: standard` for `rassm-api` in `render.yaml` and push.
