# Daily Chest Kitty (Mac)

A menu bar companion to The Daily Chest website. It opens the same chest,
shows the same quests and saves ticks to the same Supabase tables, so the
Mac and the website always agree. An invisible kitty leaves paw prints
across the screen, and grows braver (prints → shadow → peek → full visit)
as quests get ticked.

## How it fits together

- `src/main.js` – the menu bar paw, the panel window, the click-through
  overlay window that covers the screen, walk timing, and every database
  write (queued, so quick taps never race).
- `src/db.js` – PostgREST over `fetch`, mirroring the website's logic for
  which chest Today shows (today → planned → missed day → opened today).
  A tick re-reads the row first, so it never overwrites a tick made on the
  website in the meantime.
- `src/panel.*` – naming on first run, the chest, quests and bonus.
- `src/overlay.*` – paw-print trails and the kitty at each stage.
- `src/logic.js` – dates, quest normalising, bravery stages (5 / 15 / 30
  ticks since the kitty was named; the kitty never gets shyer).

The kitty's name lives in the `kitty` table (one row, `id = 1`), together
with `baseline_done`: how many quests were already ticked when it was
named, so bravery only counts ticks made from then on.

## Building

```sh
npm install
npm run config      # copies the Supabase URL + anon key from ../.env.local
npm run build:mac   # dist/Daily-Chest-Kitty-<version>-mac-apple-silicon.zip
npm start           # run it locally
```

`npm run icons` redraws the icons in `src/assets` (needs Playwright).
The app is unsigned; see `INSTALL.txt` for the one-time step on the Mac.
