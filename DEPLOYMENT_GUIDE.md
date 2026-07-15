# SuccessViews Dashboard — GitHub + Live Deployment Guide

Your stack: **React + Vite (SPA)** frontend, **Supabase** backend (DB + Auth). There is **no custom server** — the build is static files (`dist/`) that talk to Supabase directly. That makes this a "static site + managed backend," which is the easiest, cheapest kind of app to host.

Repo: `https://github.com/Shubh081298/Succesviews-Dash.git` · Branch: `main`

---

## What I already set up for you
- **`vercel.json`** and **`public/_redirects`** — SPA rewrite rules so deep links like `/admin` and page refreshes don't 404 in production. (BrowserRouter needs this.)
- **`.gitignore`** — confirmed `.env`, `node_modules`, `dist` are ignored, and added the stray `vite.config.js.timestamp-*` temp files so they won't be committed.
- Your **`.env` is NOT tracked** — your Supabase keys stay out of GitHub. ✅

---

## PART 1 — Push the code to GitHub

Git is already initialized and connected to your repo, so you only need to commit and push. Open a terminal **in the project folder** (`successviews-app`) and run:

```bash
# 1. See what will be committed (optional)
git status

# 2. Stage everything (respects .gitignore)
git add .

# 3. Commit
git commit -m "Premium redesign + Expense module + dark mode + deploy config"

# 4. Push to GitHub (main branch)
git push origin main
```

If `git push` asks you to sign in, use a **Personal Access Token** (GitHub no longer accepts your account password on the command line):
1. GitHub → your avatar → **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token**.
2. Scope: check **repo**. Copy the token.
3. When the terminal prompts for a password, paste the **token** (not your GitHub password).

*(Tip: GitHub Desktop app is a no-command alternative — "Add existing repository" → Commit → Push.)*

After this, refresh your repo page on GitHub — all files should be there.

---

## PART 2 — Choose a host

| Platform | Best for | Pros | Cons |
|---|---|---|---|
| **Vercel** ⭐ *(recommended)* | Vite/React SPAs | Zero-config for Vite; auto CI/CD from GitHub (push = deploy); free HTTPS + global CDN; preview URLs per branch; env-var UI; generous free tier | Team features are paid; functions are Vercel-specific (you don't use any) |
| **Netlify** | Same class as Vercel | Nearly identical DX; great free tier; simple redirects (`_redirects` already added) | Slightly slower builds for some setups |
| **Cloudflare Pages** | Cost/scale | Unlimited bandwidth on free tier; fast global network | Slightly more setup; smaller ecosystem of guides |
| **GitHub Pages** | Simple static sites | Free, lives next to your repo | Awkward for SPA routing + env vars; not ideal here — avoid for this app |

**Recommendation: Vercel.** It's the smoothest path for a Vite SPA, it auto-deploys every time you push to `main`, and everything you need is free. Netlify is an equally fine second choice.

---

## PART 3 — Deploy to Vercel (recommended)

1. Go to **https://vercel.com** → **Sign up with GitHub** → authorize.
2. **Add New… → Project** → **Import** `Shubh081298/Succesviews-Dash`.
3. Vercel auto-detects the settings. Confirm:
   - **Framework Preset:** Vite
   - **Build Command:** `vite build` (or `npm run build`)
   - **Output Directory:** `dist`
   - **Root Directory:** `./` (the repo root is the app)
4. **Environment Variables** — add these two (from your local `.env`):
   - `VITE_SUPABASE_URL` = `https://jfwbdllfnhmdmeawiyef.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = *(your anon key from `.env`)*
   > The anon key is meant to be public (it ships in the browser bundle), but it's still cleaner to set it here than commit it.
5. Click **Deploy**. In ~1–2 minutes you'll get a live URL like `https://succesviews-dash.vercel.app`.

**Every future `git push origin main` will redeploy automatically.**

### Netlify alternative (if you prefer)
1. **https://netlify.com** → **Add new site → Import from GitHub** → pick the repo.
2. Build command `vite build`, publish directory `dist`.
3. **Site settings → Environment variables** → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Deploy. The `public/_redirects` file already handles SPA routing.

---

## PART 4 — Point Supabase at your live domain (IMPORTANT)

Your employee login uses **Supabase Auth**, and password-reset emails link back to your app. You must whitelist the live domain or login/reset will break in production.

In the Supabase dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://your-live-url.vercel.app`
- **Redirect URLs:** add `https://your-live-url.vercel.app/**` (and your custom domain later)

Also make sure the database is ready in the project you're pointing at:
- Run any pending migrations there — notably **`supabase/expenses_v2.sql`** (the Expense module's table + the RLS-disable line). If you skip it, "Add Expense" will 404/RLS-error in production too.

---

## PART 5 — Custom domain (optional)
1. Buy a domain (Namecheap, GoDaddy, Cloudflare, etc.).
2. Vercel → your project → **Settings → Domains → Add** → enter your domain.
3. Add the DNS records Vercel shows (usually an `A` record or `CNAME`) at your registrar.
4. HTTPS is issued automatically. Then update the Supabase **Site URL / Redirect URLs** to the custom domain too.

---

## Go-live checklist
- [ ] `git add . && git commit && git push origin main`
- [ ] Vercel project imported; **env vars** set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] First deploy succeeds; live URL loads
- [ ] Supabase **Auth URL Configuration** updated with the live domain
- [ ] `expenses_v2.sql` run in the production Supabase project
- [ ] Test: admin login, employee login, DSR submit, salary, expense add
- [ ] (Recommended before real launch) revisit the RLS security hardening — right now tables run with RLS off; anyone with the public anon key can read/write. See `supabase/security-hardening.sql`. This is a data-privacy concern for a public production app.

---

### Security note (please read)
The anon key is safe to expose, **but** your tables currently have **Row-Level Security disabled**, meaning the public key can read/write everything. That's fine for a private demo, but for a real public deployment you should enable per-user RLS (there's a prepared script at `supabase/security-hardening.sql`, and it requires the admin to become a real Supabase Auth user). Consider doing this before sharing the live URL publicly.
