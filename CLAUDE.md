# Best Self

A quiet, black-and-white daily habit dashboard (Stendig calendar meets Monument Valley). Vite + React 19,
inline style objects, localStorage; Firebase is optional and lazy-loaded. README.md has the full tour:
features, data model, deploy, code layout.

## Commands

```bash
npm install
npm run dev        # http://localhost:5173/best-self/
npm run lint       # must stay at 0 problems
npm test           # node:test suites in tests/ (no runner to install)
npm run smoke      # server-renders the Insights tree with synthetic data; fails loudly
npm run build      # production build to dist/ (base is /best-self/)
```

Before calling a change done: lint, test, build, smoke, and look at it in the browser at desktop width,
375px, and dark mode (Settings → Dark Mode). Prefer a rendered screenshot over a description.

## Design rules (every change must pass "would the Stendig calendar do this?")

- Pure black, white and greys from `src/styles/theme.js`. No colour accents, gradients, shadows or icon fonts.
- No border radius except circles (checkboxes, day pills, the selected calendar day).
- Instrument Sans: weight 100 for display numerals, 300–400 for body; tabular numerals for data.
- Motion 150–250 ms ease-out, always with a `prefers-reduced-motion` fallback. The day strike is the one
  orchestrated moment.
- Ink only what was built: unchecked is absent, not grey. Missed days are weather, never red, never a reset.
- The checklist stays the whole interface; the game layer (louvered numeral, Penrose progress figure) never
  gates checking a box.

## Where things live

- `src/App.jsx` screens and wiring; components in `src/components/`; pure logic in `src/utils/`
  (`insights.js`, `habits.js`, `todos.js`, `penrose.js` are tested, keep them React-free).
- Seed habits in `src/utils/constants.js`. Persistence in `src/hooks/useData.js`.
- `public/sw.js` is the service worker; bump `VERSION` after a breaking change.
- `.github/workflows/deploy.yml` lints, tests, builds and force-publishes `dist/` to `gh-pages` on every
  push to `main`. Pushing a feature branch deploys nothing.

## Conventions

- Small steps, one feature per commit, conventional-commit subjects (`feat(today): …`, `style: …`).
- No `<form>` tags; onClick/onChange/onKeyDown handlers only. Escape closes every modal.
- Never strip characters from people's text; React escapes on render.

## Handoff (as of 2026-10-07)

- Everything through the PWA and deploy workflow is merged to `main` and live. `feat/habit-editor`,
  `game/louvers` and `game/impossible-figure` are merged ancestors and can be deleted.
- Game direction came from a 36-concept ideation sprint; the ranked board with mockups is at
  https://claude.ai/code/artifact/6c349b03-d70e-4676-8065-47b9ea1c9e15 (owner's Claude account).
  Built: The Impossible Figure (progress) and Louvers (numeral). Dropped: Growth Rings (checkboxes read as
  targets). Next: "The Turn", press the month name and the calendar tilts into an isometric elevation of
  completed days with a bridge line over missed days; it needs the month grid ported to SVG first.
- Colour decision is final: pure black and white, hatching is the only texture.
- Open engineering items: per-day Firestore documents before enabling sync (today it is whole-document,
  last-write-wins); opt-in reminders once installed; a visual harness exists in `tests/visual/` but
  has only been exercised by the SSR smoke, not in a browser.
- Working style the owner asked for: one feature per step, committed per step, verified with rendered
  proof before moving on; no multi-agent fan-outs unless asked.
