# IronLog

A gym progress tracker for **two people**. Open a machine and the first thing you
see is the weight and reps you did **last time** — and whether you improved.

Runs as a website on GitHub Pages, installs on your phone like a real app, works
offline in the gym, and syncs between two phones through a **private** GitHub repo.
No accounts, no server, no subscription.

---

## What it does

| | |
|---|---|
| **224 exercises with pictures** | 210 ship with a real reference photo showing the machine and the muscles it works; the rest have a hand-drawn illustration. Grouped by muscle, searchable, plus your own custom machines. |
| **Your gym's actual machines** | Tap *Use my own photo* on any machine and take a picture of the real thing. It replaces the reference picture everywhere, and syncs to your friend's phone. |
| **Machine numbers** | Give each machine the number written on it in your gym (`#12`). Shown on the card, and searchable. |
| **Last time, front and centre** | Weight × reps from your last session, every set you did, what you did before that, your all-time best, and a green/red badge telling you if you went up or down. |
| **One-tap repeat** | The weight box is pre-filled with last session's top set. Same weight? Just hit *Log set*. |
| **Personal records** | New best gets a celebration. All records listed on the Progress screen. |
| **Workout mode** | Start a session, log sets, rest timer with vibration between sets, finish for a summary with duration, volume and new PRs. |
| **Progress charts** | Top set / estimated 1RM / volume over time per machine, weekly volume, 17-week training calendar, muscle-group balance, bodyweight. |
| **Versus** | You against your friend on every shared machine, with a leaderboard. |
| **kg or lb** | Switch any time — history is stored in kg internally and converts, so nothing is ever corrupted. |
| **Plate calculator** | For barbell lifts, shows which plates to load per side. |
| **Offline** | Once installed it needs no signal at all. Gym basements are fine. |

---

## Part 1 — Put it online (about 5 minutes)

GitHub Pages needs the **app repo to be public** on a free account. That's fine —
it only contains code, never your training data. Your data goes in a *separate
private* repo in Part 3.

The code is already committed and pushed to
[SpectralZero/GYM](https://github.com/SpectralZero/GYM). All that's left is to
switch Pages on:

1. Go to **https://github.com/SpectralZero/GYM/settings/pages**
2. Under *Build and deployment* set **Source: Deploy from a branch**,
   **Branch: `main`**, folder **`/ (root)`** → **Save**
3. Wait a minute, then open:

   ```
   https://spectralzero.github.io/GYM/
   ```

That URL is permanent. To ship a change later:

```bash
git add -A && git commit -m "..." && git push
```

---

## Part 2 — Install it on your phone

On the **Samsung S23 Ultra**, in **Chrome**:

1. Open `https://spectralzero.github.io/GYM/`
2. An **Install IronLog** bar appears at the bottom → tap **Install**.
   (No bar? Use the ⋮ menu → **Add to Home screen** → **Install**.)
3. Launch it from the home screen icon.

It now runs full screen with no browser bars, works with no internet, and the
Android back button behaves normally. Samsung Internet works the same way
(**≡ menu → Add page to → Home screen**).

First launch asks for your name and your friend's name. That's the whole setup.

### On iPhone / iPad

It works on Safari (iOS 16.4 or newer recommended), but **installing is manual** —
Apple gives websites no Install button, so the app shows instructions instead:

1. Open the link in **Safari** (not Chrome on iOS — it can't add web apps to the
   home screen)
2. Tap the **Share** icon (square with an arrow pointing up)
3. Scroll down, tap **Add to Home Screen** → **Add**
4. Launch it from the new icon

Do install it rather than using it as a normal tab. Two reasons: it runs full
screen, and Safari deletes a website's saved data after **7 days without a visit** —
home-screen web apps are exempt from that. With GitHub sync on, even a wipe costs
you nothing, since the log is in your repo.

Two differences on iPhone, both harmless:

- **No vibration.** iOS gives web pages no vibration API, so the rest timer and PR
  celebrations are silent-but-visual. The countdown beep still works (unless the
  ringer switch is on silent).
- **The keyboard may nudge the bottom bar** while typing a weight. Tapping *Log set*
  still works.

Everything else — camera photos, charts, offline, sync, rest timer — behaves the
same as on Android.

---

## Part 3 — Sync between two phones (optional but recommended)

Without this, each phone keeps its own data. With it, you and your friend share
one history and both see each other's numbers on the Versus screen.

Your log is stored as one JSON file in a repo **you** own.

1. **Create a second repo**, called **`ironlog-data`** — and make it **Private**.
   This is the one that holds your training data. Do *not* make it public.

2. **Create a token**: GitHub → *your avatar* → **Settings** →
   **Developer settings** → **Personal access tokens** → **Fine-grained tokens** →
   **Generate new token**.
   - **Repository access**: *Only select repositories* → pick `ironlog-data`
   - **Permissions** → *Repository permissions* → **Contents: Read and write**
   - Expiration: whatever you like (you'll re-paste it when it expires)
   - Generate, then **copy the token** (starts with `github_pat_…`)

3. In the app: **⚙ Settings → Sync between phones → Set up**. Enter your GitHub
   username, `ironlog-data`, and paste the token. Tap **Connect & sync**.

The token is stored **only on that phone** and is never written into the synced
file. A dot on the sync icon shows the status; the app syncs on open, after you
finish a workout, and when you tap the icon.

### Why a new device starts empty

Your log is stored **inside the browser on each device**. Your PC and your phone are
two separate browsers, so a phone that has never synced opens blank — that is normal,
nothing is lost. Sync is what connects them, and each device has to be told about it
once. The pair code does that, and it works for **your own second device**, not just
your friend's.

### Adding a device (your phone, or your friend's)

On the device that already has the data: **Settings → Add another device / invite your
friend** → **Copy** or **Share**, and send yourself the code (WhatsApp to yourself,
email, whatever).

On the new device:

- **Fresh install** — paste the code into *"Already using IronLog somewhere else?"* on
  the welcome screen and tap **Restore from pair code**. Do this *instead of* typing
  names, otherwise you end up with duplicate people.
- **Already set up** — **Settings → Join with code** → paste → **Join**. Your existing
  sets are merged in, not overwritten.

If you already created profiles on the phone by mistake, either delete the extra person
in **Settings → People**, or wipe that phone with
**Settings → Erase all data on this phone** and restore from the code.

### Invite your friend

On your phone: **Settings → Invite your friend (pair code)** → **Copy** or
**Share** and send it over WhatsApp.

On their phone: install the same website, then **Settings → Join with code** →
paste → **Join**. Their existing sets are merged in, not overwritten.

> The pair code contains your token, so only send it to your training partner.
> If you ever want to cut access, delete the token on GitHub and make a new one.

Both phones can log at the same time. Each set is a separate record with its own
id and timestamp, so merges never lose a set — the newer edit wins on conflicts,
and deletions propagate.

### How fresh is the other person's data?

There is no server pushing updates, so it is **near**-real-time, not live. Each app
syncs:

- when it opens
- when you switch back to it (if it's been more than 2 minutes)
- about 12 seconds after you log something
- every 90 seconds while it is open on screen
- instantly when you tap the sync icon

So if your friend logs a set or changes their picture while you're both in the gym
with the app open, you'll see it inside a minute — or immediately if you tap sync.
Offline, everything queues locally and goes up the moment you have signal again.

---

## Part 4 — Using it in the gym

1. Tap the big **+** (or **Start workout**) when you arrive.
2. **Machines** → find the machine (search, filter, favourites, or its number).
3. The **Last time** card tells you what to beat.
4. Adjust weight/reps with the − / + buttons and hit **Log set**.
   The rest timer starts by itself and vibrates when it's done.
5. **Finish** the workout for a summary.

Small things worth knowing:

- **Favourites** (★ on a machine) float to the top of the list.
- The **note** field on a machine is for setup details — "seat position 3".
- **Assisted pull-up** counts *less assist* as stronger, so the arrows read correctly.
- **Bodyweight machines** log reps; **plank** logs seconds; **cardio** logs minutes.
- Tap the avatar top-left to switch between you and your friend at any time.

---

## Backups

**Settings → Backup → Download backup file** writes a JSON file with every set,
note and setting. **Restore / merge from file** brings it back — *Merge* keeps
both sides, *Replace* overwrites. Worth doing occasionally even with sync on.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| No install prompt | Must be `https://…github.io/…`, not a local file. Use ⋮ → Add to Home screen. |
| Pages shows 404 | Give it 1–2 minutes after the first push; check Settings → Pages points at `main` / root. |
| "Token rejected" | The token expired, or was truncated when copied. Generate a new fine-grained token. |
| "Token lacks permission" | It needs **Contents: Read and write** on the data repo specifically. |
| Repo warning says PUBLIC | Your *data* repo must be private. The app repo is the public one. |
| Changes don't show after a push | Bump `CACHE` in `sw.js`, push again, then reopen the app — it offers a *Reload*. |
| Sync icon dot is red | Tap it to see the message. Usually offline, or an expired token. |

---

## Developing locally

```bash
npm run serve      # http://localhost:8080 — also prints a LAN URL for your phone
npm run icons      # regenerate icons/*.png
npm run wger       # re-import exercise photos and data from wger.de
npm test           # 66 data-layer checks + 132 UI checks (needs: npm install)
```

`npm test` boots the real app in a headless DOM and drives every screen — logging
sets, PR detection, unit switching, the two-device merge, every route and all 224
machine screens. Run it after any change.

Installing as an app and offline mode need HTTPS or `localhost`.

**After changing any file in `sw.js`'s `SHELL` list, bump `CACHE = 'ironlog-vN'`**,
otherwise phones keep serving the cached version.

### Layout

```
index.html                app shell + overlay markup
css/app.css               design tokens and every component
js/machines.js            74 curated machines + the SVG illustration library
js/wger.js                GENERATED — 150 more exercises + photo mappings
js/store.js               data model, stats, PR logic, two-device merge
js/sync.js                GitHub API sync, pair codes
js/charts.js              line / column / heatmap / versus charts (no libraries)
js/ui.js                  router, sheets, toasts, rest timer, haptics
js/screens.js             every screen
js/app.js                 bootstrap, onboarding, install prompt
sw.js                     offline cache
img/ex/                   210 reference photos (from wger.de)
tools/                    icon generator, dev server, wger importer
ATTRIBUTION.md            per-image licence and author
```

No build step, no dependencies, no framework. Plain files a browser runs directly.

### Refreshing the exercise photos

`npm run wger` re-imports from the [wger.de open database](https://wger.de/en/software/api)
and regenerates `js/wger.js`, `img/ex/` and `ATTRIBUTION.md`. The mapping table at
the top of `tools/build-wger.mjs` is hand-verified — a wger image is only attached
to one of the 74 curated machines when both names mean the same exercise. Everything
else is added under wger's own name, so a picture can never disagree with its label.
Images already downloaded are reused, so re-running is cheap.

### Design notes

Weights are stored in **kg** always; `lb` is a display conversion. Records are
**append-only with tombstones** (`d: true`) and per-record `u` timestamps — that
is what makes merging two phones safe. Chart colours were validated for
colour-blind separation and contrast against both the dark and light surfaces.
