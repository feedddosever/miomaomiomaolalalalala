# The Daily Chest 🐾

A little single-user web app: tap today's treasure chest, get a list of
quests to do today plus a bonus recipe or Instagram link, and keep every
past chest you've opened in "My Treasures." Content is planned ahead of
time from the "Plan Ahead" tab and stored in Supabase, so you can add or
edit days without redeploying.

## What's inside

- **Today** — shows a cat-eared chest. Tap it to reveal today's quests
  (which you can check off) and the day's bonus. Once opened, it's saved
  automatically.
- **My Treasures** — every day you've opened, in one place, with your
  check-offs preserved.
- **Plan Ahead** — a form to set each date's quests and bonus (recipe or
  Instagram link) ahead of time, plus a list of everything already
  planned, with edit/delete.

## 1. The database is already set up ✅

A Supabase project called **the-daily-chest** has been created in the
`feedddosever` org (region: eu-central-1, free tier), and both tables
already exist:

- `daily_content` — your planned calendar (date, quests, bonus)
- `collected_treasures` — what you've actually opened and saved

The SQL that created them is kept in
[`supabase/schema.sql`](supabase/schema.sql) for reference. Your
credentials are already filled into `.env.local`:

```
VITE_SUPABASE_URL=https://itxitfhvxxafknfevjhz.supabase.co
```

(The anon key is in `.env.local` too. That file is git-ignored, so it
won't be committed — but you'll need to paste both values into Vercel in
step 4.)

There's also one sample day seeded for 2026-09-18 so you can tap the
chest immediately and see it work. Delete it from the **Plan Ahead** tab
whenever you like.

> This is a single-user app that talks to Supabase directly from the
> browser, so the tables are open to anyone holding that anon key (i.e.
> anyone who visits your deployed site). That's a reasonable trade-off
> for a personal hobby project, but don't store anything sensitive in
> it. If you want it locked down further, the simplest upgrade is
> turning on Supabase's built-in email/password auth and scoping the
> row-level-security policies to your user id instead of `true`.

## 2. Run it locally

`.env.local` is already filled in, so this is just:

```bash
npm install
npm run dev
```

Open the printed local URL and tap the chest.

Use the **Plan Ahead** tab to add content for future days.

## 3. Push to GitHub

From inside the unzipped project folder:

```bash
git init
git add .
git commit -m "The Daily Chest"
git branch -M main
git remote add origin https://github.com/<your-username>/miomaomiomaolalalalala.git
git push -u origin main
```

Replace `<your-username>` with your GitHub username. If the repo doesn't
exist yet, create it first at
[github.com/new](https://github.com/new) named
`miomaomiomaolalalalala`, empty (no README, no .gitignore).

(`.env.local` is git-ignored, so your keys won't be committed.)

## 4. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com), sign in, and click **Add New
   → Project**, then import the GitHub repo you just pushed.
2. Vercel will auto-detect Vite — leave the default build settings
   (`npm run build`, output directory `dist`).
3. Before deploying, open **Environment Variables** and add these two,
   copying the values straight out of your local `.env.local`:
   - `VITE_SUPABASE_URL` → `https://itxitfhvxxafknfevjhz.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → (the long key in `.env.local`)
   - `VITE_ADMIN_PASSCODE` → optional; set it if you want the Plan Ahead
     tab behind a passcode
4. Click **Deploy**. Once it finishes, your chest is live at the
   `*.vercel.app` URL Vercel gives you.

Without these two variables the deployed site will build fine but show
the "Supabase isn't connected yet" message instead of the chest.

Any time you edit `daily_content` from the "Plan Ahead" tab, that's a
database write, not a code change — no redeploy needed. You only need to
redeploy if you change the app's code itself.

## On phones and on a computer

The same page adapts to whatever you're holding:

- **Phones** get a single column, three equal nav tabs that don't wrap,
  and touch targets of at least 44px everywhere (the paw check-offs have
  an invisible 40px hit area around them, so a thumb can't miss). Form
  fields are set to exactly 16px, which is what stops iOS Safari from
  zooming the page in the moment you tap one. The layout also pads
  around notches and home indicators.
- **Turn a phone sideways** and the chest shrinks and moves next to the
  quests, so the list stays on screen in a short landscape window.
- **Tablets** (from 600px) get roomier padding and the nav tabs shrink
  back to content-width pills.
- **Laptops and desktops** (from 900px) get real use of the width: Today
  puts the chest beside the quests instead of above them, My Treasures
  becomes a two-up shelf, and Plan Ahead shows the form and the planned
  days side by side so you can see what's scheduled while you type. At
  1280px and up the shell widens again, the chest grows, and the shelf
  goes three across. Hover styling is applied only on devices with a real
  pointer, so phones never get stuck in a hover state.

Keyboard navigation is covered too — every control has a visible focus
ring — and the chest animation and sparkles are dropped for anyone with
"reduce motion" turned on.

Breakpoints, touch-target sizes and the layout switches all live in
`src/styles/index.css`, grouped under the `responsive:` comment banners
near the bottom.

## Customizing

- **Colors** live as CSS variables at the top of
  `src/styles/index.css` (`--cream`, `--caramel`, `--mocha`, etc.) —
  change those to retint everything at once.
- **Fonts** are Fraunces (headings) and Outfit (body), loaded from
  Google Fonts in `index.html`.
- **The chest illustration** (cat ears, whiskers, paw-print latch) is
  a hand-built SVG in `src/components/Chest.jsx` if you want to tweak
  its shape or add more cat details.
- **Bonus shape**: a recipe bonus is `{ title, ingredients: [...],
  instructions: [...] }`; an Instagram bonus is `{ url, caption }`.
  Both are stored as-is in the `bonus` jsonb column.
