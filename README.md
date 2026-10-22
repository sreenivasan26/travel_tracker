# Travel (phone viewer)

Read-only phone PWA for the Notes and Tasks Travel page. Data comes one way: the website writes `outbox/travel-plan.json` (format `nt-travel-plan` v1); the phone loads it with **Load plan**. Nothing is entered, ticked or exported on the phone.

- `npm install`, `npm test -- --run`, `npm run build` (output `dist/`; `VITE_BASE=/travel_tracker/` for GitHub Pages), `npm run dev` (port 5177).
- Storage: localStorage key `notes-tasks.travel.v1` (plan, loaded_at, file name). Clear data wipes it.
- Code only goes into a repo: no real plan files (`travel-plan*.json` is git-ignored).
- Deployed to GitHub Pages by `.github/workflows/pages.yml` (builds with `VITE_BASE=/travel_tracker/`). Manifest `start_url`/`scope` are relative (`./`), so they follow the base.
- Tests use the invented fixture `src/lib/fixtures/sample-plan.json`.
