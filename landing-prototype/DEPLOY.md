# Deploy the ZENO landing page

A standalone static site (`landing-prototype/`) deployed on Vercel as its own project,
with the root domain pointed at it. The ZENO product app stays separate (later: `app.yourdomain`).

Three short steps. The only parts that need *you* are the ones requiring your Vercel /
registrar login — I can't sign in or change DNS on your behalf.

---

## 1 · Hook up the waitlist (Formspree) — ~2 min

The form is already wired; it just needs your form ID.

1. Go to https://formspree.io and create a free account.
2. Create a new form (name it e.g. "ZENO waitlist"). Formspree gives you an endpoint like
   `https://formspree.io/f/abcdwxyz`.
3. In `landing-prototype/index.html`, find this line (near the bottom, in the `<script>`):

   ```js
   const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";
   ```

   Replace `YOUR_FORM_ID` with your real id, so it reads e.g.
   `https://formspree.io/f/abcdwxyz`.
4. Commit + push (the deploy in step 2 picks it up automatically).

Until you do this, the form still shows the success state but does **not** store the email
(it logs a warning to the console). After this, every signup lands in your Formspree inbox.

> Tell me the form id and I'll paste it in for you.

---

## 2 · Deploy to Vercel — ~3 min

Deploy `landing-prototype/` as a **new, separate** Vercel project (not the product app).

1. Push this repo to GitHub (it already is).
2. In Vercel: **Add New… → Project → Import** this Git repository.
3. In the import screen, set:
   - **Root Directory:** `landing-prototype`  ← important
   - **Framework Preset:** `Other`
   - **Build Command:** *(leave empty)*
   - **Output Directory:** *(leave empty — it serves the folder as static)*
4. Click **Deploy**. You'll get a live `*.vercel.app` URL in ~30s — open it to confirm.

That `vercel.json` in the folder handles clean URLs, caching, and security headers; no build
step is needed because the site is plain HTML/CSS/JS.

---

## 3 · Connect your domain — ~5 min + DNS propagation

1. In the new Vercel project → **Settings → Domains → Add** → type your domain
   (e.g. `yourdomain.com`). Add `www.yourdomain.com` too if you want it.
2. Vercel then shows the **exact DNS records to set**. Use those values verbatim — they are
   authoritative and override anything written here. Typically it's one of:
   - **Apex (`yourdomain.com`):** an `A` record → the IP Vercel shows, **or** switch your
     domain to Vercel's nameservers (Vercel offers this if your registrar supports it).
   - **`www`:** a `CNAME` → the target Vercel shows (usually `cname.vercel-dns.com`).
3. Log in to your **domain registrar** (where you bought it), open its DNS settings, and add
   the records Vercel gave you. (This is the step only you can do — it needs your registrar login.)
4. Back in Vercel, the domain flips to **Valid** once DNS propagates (minutes to a couple
   hours). HTTPS is issued automatically.

---

## Notes

- **HTTPS / SSL:** automatic on Vercel — nothing to configure.
- **Editing later:** change the HTML in `landing-prototype/`, push to GitHub → Vercel
  redeploys automatically.
- **The product app** can later live on a subdomain (`app.yourdomain.com`) as its own Vercel
  project from the repo root — no conflict with this landing site.
- **Logo:** loads from `landing-prototype/assets/zeno-logo.svg`. Keep that file alongside
  `index.html`.

If you paste me your domain name and Formspree id, I'll prefill them and hand you a version
that's ready to deploy with zero edits.
