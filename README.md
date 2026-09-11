# Best Self

A quiet daily habit dashboard. Black and white, typographic, in the spirit of the Stendig wall calendar, with a game layer borrowed from Monument Valley: the day numeral inks itself in slat by slat as you check habits, and the progress bar is a Penrose triangle drawn one hairline stroke at a time. The stroke that makes the figure impossible is reserved for the check that completes the day.

Live: https://anikethsukhtankar.github.io/best-self/

## What it does

- **Today.** Habits grouped by time block (Morning, Pre-Work, Afternoon, Post-Work, Evening), each block only shown when it has something scheduled. A circular checkbox per habit, a week strip with a dot per day, a month calendar, and on desktop a schedule timeline for the day.
- **Completion.** A day is complete when you reach your threshold (default 80%). The numeral is struck through, the figure closes, the week-strip dot fills.
- **Habits.** Add, edit, archive and restore from the "+" in the header, the Edit label on a row, or Settings → Manage Habits. Daily or specific-day recurrence, optional duration. Archiving keeps history.
- **Tasks.** One-off tasks scoped to a day. Open tasks from earlier days carry forward onto today with a small date tag; completed tasks stay on the day you finished them.
- **Insights.** Current and best streak, this week's percentage, a twelve-month consistency grid, a 90-day rolling trend line (7 or 30 day window), and a per-habit breakdown sorted worst first.
- **Settings.** Dark mode, completion threshold, time-block names and order, JSON export and import.
- **Installable.** A web app manifest and service worker make it installable on a phone and usable offline after the first visit.

There are no points, badges, leaderboards or streak penalties. A missed day is weather.

## Development

```bash
npm install
npm run dev        # http://localhost:5173/best-self/
npm run build      # production build in dist/
npm run preview    # serve the production build
npm run lint       # eslint, kept at zero problems
npm test           # node:test suites in tests/
npm run smoke      # server-renders the Insights tree with synthetic data
npm run visual     # builds a browser harness for Insights into dist-visual/
```

Node 20 or newer. No test runner to install: tests use Node's built-in `node --test`.

## Data

Everything lives in one JSON document under the `best-self-state` key in localStorage. Export it from Settings any time; import restores it.

```
habits[]       id, text, timeBlock, recurrence {daily | specific_days, days[]}, durationMinutes?, createdAt, archivedAt?, sortOrder
todos[]        id, text, dueDate? (YYYY-MM-DD), completedAt?, createdAt
completions    { "YYYY-MM-DD": { [habitId]: true } }
settings       completionThreshold, timeBlockLabels, timeBlockOrder, darkMode
```

All analytics are derived from `completions` in `src/utils/insights.js`, which is pure and tested.

### Optional cloud sync (Firebase)

Without configuration the app is local-only and the Firebase SDK is never downloaded. To sync across devices:

1. Create a Firebase project with Google sign-in and Firestore.
2. Copy `.env.example` to `.env` and fill in the `VITE_FIREBASE_*` values (they are baked into the build; for GitHub Pages, add them as repository secrets and uncomment the `env` block in the deploy workflow).
3. Deploy `firestore.rules`, which lets each person read and write only their own `users/{uid}` document. Do not skip this: without rules the data is world-readable.

Sync currently writes the whole document on every change, so two devices editing at the same moment resolve last-write-wins. Splitting completions into per-day documents is the planned fix.

## Deploying

Pushing to `main` runs `.github/workflows/deploy.yml`: install, lint, test, build, publish `dist/` to the `gh-pages` branch. The app is built with `base: '/best-self/'` in `vite.config.js`; change that if the repository name changes.

## Design rules

- Pure black, white and greys. Hatching is the only texture.
- No radii except circles, no shadows, no gradients, no icon fonts.
- Instrument Sans: thin for display numerals, regular for body. Tabular numerals for data.
- Motion is 150 to 250 ms, ease-out, and respects `prefers-reduced-motion`. The day strike is the one orchestrated moment.
- Ink only what was built. Unchecked is absent, not grey.

## Layout of the code

```
src/App.jsx                 screens and wiring
src/components/             HabitRow, HabitModal, ManageHabits, TimeBlockEditor, LouverNumeral, PenroseFigure, YearGrid, TrendLine, AuthScreen
src/hooks/                  useData (persistence), useAuth (optional Firebase), useTheme + ThemeProvider
src/utils/                  pure logic: habits, todos, insights, penrose, date, constants (seed habits)
src/styles/theme.js         light and dark tokens and style objects
public/                     manifest, service worker, icons
tests/                      node:test suites and the visual / smoke harness
```

## Roadmap

- The Turn: press the month name and the calendar tilts into an isometric elevation of the month.
- Per-day completion documents for multi-device sync.
- Reminders as an opt-in, once installed.
