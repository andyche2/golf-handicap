# Golf Handicap Calculator

Local or web: static HTML/CSS/JS. Optional [GolfCourseAPI](https://golfcourseapi.com) course lookup (your API key stays in the browser).

## Host on GitHub Pages

1. **Create a new repository** on GitHub (any name, e.g. `golf-handicap`). Do not add a README from the template if you want this folder to be the only content.

2. **Push this project** from your machine (replace `YOUR_USER` and `YOUR_REPO`).

   This folder is already a git repo with an initial commit. From the parent of `golf-handicap`:

   ```bash
   cd golf-handicap
   git branch -M main
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git push -u origin main
   ```

   If Git complains about your name or email, set them **for this repo only**, then commit again if needed:

   ```bash
   git config user.name "Your Name"
   git config user.email "you@users.noreply.github.com"
   ```

   (If you are starting from a **zip** without `.git`, run `git init`, `git add .`, and `git commit` first.)

3. **Turn on GitHub Pages**

   - Repo → **Settings** → **Pages** (left sidebar).
   - **Build and deployment** → Source: **Deploy from a branch**.
   - Branch: **main**, folder: **/ (root)** → Save.

4. After a minute or two, the site is live at:

   `https://YOUR_USER.github.io/YOUR_REPO/`

   (If the repo is named `YOUR_USER.github.io`, the site is `https://YOUR_USER.github.io/` at the root.)

The `.nojekyll` file tells GitHub not to run Jekyll on this site, which avoids odd processing of static files.

## Develop locally

**Recommended** (static files + built-in GolfCourseAPI proxy so course search works in the browser):

```bash
cd golf-handicap
npm start
# or: node server.mjs
```

Open `http://localhost:8765/` (landing) or `http://localhost:8765/app.html` (calculator).

**Alternative:** `python3 -m http.server 8765` only serves files; GolfCourseAPI will still hit CORS from the browser unless you set an **API proxy base** in the app or deploy the worker in `proxy/`.

## GolfCourseAPI from the browser (CORS)

GolfCourseAPI’s CORS preflight response does not allow **GET** in `Access-Control-Allow-Methods`, so authenticated `fetch` from a normal web page often fails with **“Failed to fetch”** even though the same request works in `curl`.

**Workaround:** deploy the tiny **Cloudflare Worker** in the `proxy/` folder (free tier is enough), then in **Course lookup** on `app.html` paste the worker URL including `/v1` (for example `https://golf-handicap-api-proxy.your-account.workers.dev/v1`) and click **Save**.

```bash
cd proxy
npx wrangler login   # once
npx wrangler deploy
```

The worker forwards `/v1/*` to `https://api.golfcourseapi.com/v1/*` and adds browser-friendly CORS headers.
