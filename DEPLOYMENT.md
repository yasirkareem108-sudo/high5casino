# Deploying High 5 Casino

Two independent deploys: the Express/Socket.io API to **Render**, and the Vite/React
client to **Vercel**. Deploy the backend first — the frontend needs its URL.

## 1. Backend → Render

This repo includes `render.yaml` at the project root, so Render can create the
service automatically from a Blueprint.

1. Push this repo to GitHub (Render deploys from a connected Git repo).
2. In the Render dashboard: **New → Blueprint**, pick this repo. Render reads
   `render.yaml` and creates a `high5-casino-api` web service with root dir `server/`.
3. Render prompts for the env vars marked `sync: false` in `render.yaml`. Set them
   from your local `server/.env` (see `server/.env.example` for the full list):
   - `MONGO_URI`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
   - `CLIENT_URL` — set this **after** step 2 below, once you have the Vercel URL
     (leave it as `*` or your local URL for now; update it once deployed)
4. Deploy. Render gives you a URL like `https://high5-casino-api.onrender.com`.
   Confirm it's alive: `GET /` should return the "API is running smoothly" text.

Note: Render's free tier spins the service down after 15 minutes of inactivity;
the first request after idling takes ~30-50s to wake back up.

## 2. Frontend → Vercel

1. From `client/`, either connect the GitHub repo in the Vercel dashboard
   (Vercel auto-detects Vite) or deploy directly from your machine:
   ```
   cd client
   vercel --prod
   ```
2. Set one environment variable in the Vercel project settings:
   - `VITE_API_URL` = the Render URL from step 1 (e.g. `https://high5-casino-api.onrender.com`)
3. Redeploy after setting the env var (Vercel env vars are baked in at build time
   for Vite, so a rebuild is required — `vercel --prod` again, or use the
   dashboard's "Redeploy").
4. `client/vercel.json` already adds the SPA rewrite so `/admin`, `/login`,
   `/register` work on refresh, not just via client-side navigation.

## 3. Close the CORS loop

Once you have the Vercel URL (e.g. `https://high5-casino.vercel.app`), go back to
the Render service's environment variables and set `CLIENT_URL` to that exact
URL, then let Render redeploy. This restricts the API's CORS/Socket.io origin to
your real frontend instead of `*`.

## 4. Verify

- Open the Vercel URL → lobby loads, games render.
- Register an account, click a game, submit a deposit → chat widget shows the card.
- Open `<vercel-url>/admin`, log in with `ADMIN_USERNAME` / the password matching
  `ADMIN_PASSWORD_HASH`, confirm the conversation and deposit card appear live.
- On `/admin`, allow the notification permission prompt — this subscribes the
  device to Web Push. Trigger a deposit from another device/tab and confirm a
  push notification arrives even with the admin tab unfocused.
- On a phone, visit `<vercel-url>/admin` and use "Add to Home Screen" — the PWA
  manifest (`manifest.webmanifest`) lets it install like a native app.

## Notes / limitations

- The demo admin account is a single hardcoded user, not a real staff-accounts
  system — fine for a demo, not for production.
- `/api/upload` (chat image attachments) has no auth, since both the player and
  admin need it — rate-limit or auth-gate it before any real-world use.
- Push notifications require the admin to grant browser notification permission
  once; browsers also block audio/vibration until after the first user gesture
  on the page.
