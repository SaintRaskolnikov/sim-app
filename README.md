# Pulse Sim

Pulse Sim is a medical emergency simulation monitor and tutor control panel. It is for simulation and training only, not real patient monitoring or clinical decision-making.

## Local development

```sh
npm install
npm run dev
```

Open `/monitor` on the display computer. A new session code and controller QR are generated for that monitor. Scan the QR with the tutor phone to open the matching `/control` session. You can also open `/ekg-library` to manage patterns.

For a phone to reach a locally running monitor, open the monitor using the computer's LAN URL shown by Vite (for example `http://192.168.1.20:5173/monitor`), not `localhost`. Local session and ECG catalog data are stored under `data/` and ignored by Git.

## Vercel deployment

Vercel serves the Vite app and its `/api` serverless functions. Supabase provides persistent storage and Realtime notifications; the local Socket.IO server is only used by `npm run dev`.

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL editor.
2. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in Vercel's project environment variables. The anon key is public; keep the service-role key server-only and never give it a `VITE_` prefix.
3. Import the repository into Vercel and deploy with the included [`vercel.json`](vercel.json).

The first connected client seeds the ECG table with the built-in emergency patterns. Session rows are created as monitors are opened. The catalog is shared across simulation sessions; custom entries can use an optional public HTTPS image URL.

Anonymous clients can read ECG catalog rows for realtime updates. Session and catalog writes go through Vercel Functions with the server-only service-role key. Session IDs in pairing URLs act as bearer links, and the API does not authenticate tutors. This is intended for isolated training scenarios with synthetic data only; add authentication and rate limits before exposing it to untrusted users.

## Checks

```sh
npm run build
npm run lint
```
