# Pulse Sim

Pulse Sim is a medical emergency simulation monitor and tutor control panel. It is for simulation and training only, not real patient monitoring or clinical decision-making.

## Local development

```sh
npm install
npm run dev
```

Open `/monitor` on the display computer. A new session code and controller QR are generated for that monitor. Scan the QR with the tutor phone to open the matching `/control` session. You can also open `/ekg-library` to manage patterns.

For a phone to reach a locally running monitor, open the monitor using the computer's LAN URL shown by Vite (for example `http://192.168.1.20:5173/monitor`), not `localhost`. Local session and ECG catalog data are stored under `data/` and ignored by Git.

## Vercel and Neon

Vercel serves the Vite app and `/api` functions. The Vercel-managed Neon integration is connected to this project with Neon Managed Better Auth enabled. It supplies `DATABASE_URL`, `NEON_AUTH_BASE_URL`, and `VITE_NEON_AUTH_URL`; `server/neonDb.js` creates the session, ECG, and preset tables idempotently on first API use. Local Vite development continues to use the Socket.IO server.

For another deployment, install the Neon integration from **Vercel → Integrations → Neon**, create or link a Neon Free database, enable Managed Auth, and connect Production, Preview, and Development environments. Add the Vercel production URL to Neon Auth's trusted domains. Pull generated Development variables locally with `vercel env pull`.

The root route and `/login` open monitor sign-in; `/register` opens account creation. Monitor APIs require a Neon Auth JWT. `/control` remains public to anyone holding its session QR, and tutor operations are limited to that session. Vercel SSO protection is disabled so QR users can reach the app. Keep session IDs private and use synthetic training data only.

ECG pattern metadata, sessions, and editable scenario presets are stored in Neon Postgres. Image references remain HTTPS URLs; Vercel Blob can be added later if uploaded images are needed.

## Rhythm morphology references

The waveform traces are original schematic simulations informed by these ECG teaching references:

- [Normal sinus rhythm](https://litfl.com/normal-sinus-rhythm-ecg-library/), [sinus bradycardia](https://litfl.com/sinus-bradycardia-ecg-library/), [sinus tachycardia](https://litfl.com/sinus-tachycardia-ecg-library/), and [atrial fibrillation](https://litfl.com/atrial-fibrillation-ecg-library/)
- [SVT](https://litfl.com/supraventricular-tachycardia-svt-ecg-library/) and [atrial flutter](https://litfl.com/atrial-flutter-ecg-library/)
- [Monomorphic VT](https://litfl.com/ventricular-tachycardia-monomorphic-ecg-library/), [VF](https://litfl.com/ventricular-fibrillation-vf-ecg-library/), [torsades](https://litfl.com/polymorphic-vt-and-torsades-de-pointes-tdp/), and [ventricular flutter](https://litfl.com/ventricular-flutter-ecg-library/)
- [Junctional escape](https://litfl.com/junctional-escape-rhythm-ecg-library/), [ventricular escape](https://litfl.com/ventricular-escape-rhythm-ecg-library/), and [AIVR](https://litfl.com/accelerated-idioventricular-rhythm-aivr/)
- [Mobitz I](https://litfl.com/av-block-2nd-degree-mobitz-i-wenckebach-phenomenon/), [Mobitz II](https://litfl.com/av-block-2nd-degree-mobitz-ii-hay-block/), and [complete heart block](https://litfl.com/av-block-3rd-degree-complete-heart-block/)

PEA is represented as organized electrical activity with pulse absent; it is not treated as a unique ECG morphology.

## Checks

```sh
npm run build
npm run lint
```
