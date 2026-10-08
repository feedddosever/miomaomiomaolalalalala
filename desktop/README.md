# Daily Chest Kitty (Mac)

A menu bar companion to The Daily Chest website. It opens the same chest,
shows the same quests and saves ticks to the same Supabase tables, so the
Mac and the website always agree. An invisible kitty leaves paw prints
across the screen, and grows braver every 3 ticked quests (prints →
shadow → ear tips → peek → see-through visit → moved in, with a ball of
yarn) as quests get ticked.

## How it fits together

- `src/main.js` – the menu bar paw, the panel window, the click-through
  overlay window that covers the screen, walk timing, meows, the daily
  update check, and every database write (queued, so quick taps never
  race).
- `src/db.js` – PostgREST over `fetch`, mirroring the website's logic for
  which chest Today shows (today → planned → missed day → opened today).
  A tick re-reads the row first, so it never overwrites a tick made on the
  website in the meantime.
- `src/panel.*` – the first meeting (paw prints, "who's here?",
  "meeeoow!", a name and a title from the carousel), the chest, quests,
  bonus, settings, the update banner and the strawberry cake.
- `src/overlay.*` – paw-print trails, the kitty at each level, the
  arrival sparkle and meow bubbles.
- `src/logic.js` – dates, quest normalising, levels (one every 3 ticks
  since the kitty was named, up to 10; the kitty never gets shyer).
- `src/assets/sounds` – real cat recordings (CC0 / public domain, see
  `CREDITS.md`).

The kitty's name lives in the `kitty` table (one row, `id = 1`), together
with `baseline_done`: how many quests were already ticked when it was
named, so bravery only counts ticks made from then on.

### Meows

Every 30 seconds the app asks macOS which app is in front, using the
built-in `lsappinfo` (no permission needed; nothing is stored or sent).
After 5 minutes in the same app it may meow, at most once every 30
minutes. It skips call apps (Zoom, Teams, FaceTime, …) and resets the
timer when the Mac has been idle for over a minute. The "Meows now and
then" switch turns this off.

### Updates

Once every 24 hours the app reads the latest GitHub Release of this
repository (`releases/latest`). If its tag (`v1.2.0` or `1.2.0`) is newer
than the app's version, the panel shows a banner and the kitty brings a
🎁. "Get it" opens the release page; installing is the same as the first
time. The first launch of a newer version serves a strawberry cake.

To publish an update: bump `version` in `package.json`, run
`npm run build:mac`, and attach the zip to a new GitHub Release tagged
`v<version>`. Drafts and pre-releases are ignored.

## Building

```sh
npm install
npm run config      # copies the Supabase URL + anon key from ../.env.local
npm run build:mac   # dist/Daily-Chest-Kitty-<version>-mac-apple-silicon.zip
npm start           # run it locally
```

`npm run icons` redraws the icons in `src/assets` (needs Playwright).
The app is unsigned; see `INSTALL.txt` for the one-time step on the Mac.
