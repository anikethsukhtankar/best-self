# Best Self

A quiet place for habits that grow. Black and white, typographic, in the spirit of the Stendig wall calendar, with a game layer borrowed from Monument Valley: the day numeral inks itself in slat by slat as you check habits, and the progress bar is a Penrose triangle drawn one hairline stroke at a time. The stroke that makes the figure impossible is reserved for the check that completes the day.

Habits grow in dated stages (Meditate 2 min, then 5, then 10), each offered only once the one before has held, and the record you keep is built into something you can turn in your hands: the month as an isometric elevation, each habit as a staircase, each year as a printed plate.

Live: https://anikethsukhtankar.github.io/best-self/

## What it does

- **Today.** Habits grouped by time block (Morning, Pre-Work, Afternoon, Post-Work, Evening), each block only shown when it has something scheduled. A circular checkbox per habit, a week strip with a dot per day, a month calendar, and on desktop a schedule timeline for the day.
- **Completion.** A day is complete when you reach your threshold (default 80%). The numeral is struck through, the figure closes, the week-strip dot fills.
- **Habits.** Add, edit, archive and restore from the "+" in the header, the Edit label on a row, or Settings → Manage Habits. Daily or specific-day recurrence, optional duration. Archiving keeps history.
- **Habits that grow.** A habit is a ledger of dated stages; every past day is judged by the stage in force that day, so growing a habit never rewrites the past. When a habit has held (three weeks on its stage, missed at most once in its last twelve times), and only once the day is done, Today offers its next step: the next round number at least 10% longer, or the step you wrote ahead under "Grows into". A heavy habit is offered a lighter step or rest in the editor. Nothing changes without a tap, one step at a time.
- **Rest for a season.** A week, two weeks, a month or until you bring it back. A resting habit leaves Today; rest days break nothing.
- **The Turn.** Press the month name and the calendar turns into an isometric elevation: each week a walkway, kept days standing as blocks that share walls, a bridge over a single missed day so the path never drops, the traveller on today, and the month's chapter line.
- **Tasks.** One-off tasks scoped to a day. Open tasks from earlier days carry forward onto today with a small date tag; completed tasks stay on the day you finished them.
- **Insights.** Current and best streak, this week's percentage, a twelve-month consistency grid, a 90-day rolling trend line (7 or 30 day window), each habit as the staircase it has climbed (weekly stone, a tread that rises with each step, and how rooted it is: new, taking root, second nature), and the almanac: each year as twelve printed months with their chapter lines (rewrite any in your own words), the steps taken and the rests.
- **Welcome and a sample year.** A first visit can begin, or look around fourteen months of sample history held in memory only.
- **Settings.** Dark mode, completion threshold, time-block names and order, next-step offers on or off, JSON export and import, and Start over (asks first, then begins again with the core list).
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
habits[]       id, timeBlock, sortOrder, createdAt, archivedAt?, next? (the step written ahead), growth? {snoozeUntil}
               stages[]: { from: YYYY-MM-DD, text, durationMinutes, recurrence {daily | specific_days, days[]}, rest?, until? }
               text, durationMinutes, recurrence mirror the latest stage, so old readers keep working
todos[]        id, text, dueDate? (YYYY-MM-DD), completedAt?, createdAt
completions    { "YYYY-MM-DD": { [habitId]: true } }
chapters       { "YYYY-MM": a month's chapter line in your own words }
settings       completionThreshold, timeBlockLabels, timeBlockOrder, darkMode
```

`sanitizeData` (in `src/utils/habits.js`) migrates older data on every load: a habit without stages begins on the day it was created, or the first day it was checked if that came earlier. All analytics are derived from `completions` and the stages, in pure, tested modules under `src/utils/`.

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
src/components/             HabitRow, HabitBlocks, TaskList, HabitModal, ManageHabits, TimeBlockEditor, LouverNumeral, PenroseFigure,
                            StendigCalendar (with The Turn), NextStep, InsightsView, YearGrid, TrendLine, Staircase, Almanac,
                            Welcome, AuthScreen
src/hooks/                  useData (persistence, sample mode), useAuth (optional Firebase), useTheme + ThemeProvider, useWidth
src/utils/                  pure logic: habits (stages, rest, migration), growth (offers), staircase, almanac, turn, calendar,
                            insights, todos, penrose, sample (the sample year), date, constants (seed habits)
src/styles/theme.js         light and dark tokens and style objects
public/                     manifest, service worker, icons
tests/                      node:test suites and the visual / smoke harness
```

## Roadmap

- Anchors: write when a habit happens ("after coffee", or after another habit) and stack routines.
- One line a day, with the line from a year ago returning beneath it.
- Seasons: mark travel or illness, carry the habits that come with you, rest the others.
- Per-day completion documents for multi-device sync.
- Reminders as an opt-in, once installed.
