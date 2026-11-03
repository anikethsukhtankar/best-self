// Insights and The Turn: the three numbers, the year grid, the trend, each habit's staircase and its
// own page, the almanac and its chapter lines; and the month calendar turned into an elevation.
// Unless a journey says otherwise: the owner's core list begun Thu Oct 1, every habit kept on each
// day it was due until Mon Nov 2, and today, Tue Nov 3 at 08:00 in Los Angeles, not yet begun.
import { assert, stateWith, coreHabits } from './harness.mjs';

const both = (name, run) => [1440, 375].map((width) => ({ name: `${name} (${width})`, run: (t) => run(t, width) }));

const TUESDAY = ['Push Day', '5K Walk', 'Study 1 Hour', 'Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet'];
const ORDER = ['Cycling', 'Push Day', 'Pull Day', 'Leg Day', 'Rest Day', '5K Walk', 'Study 1 Hour', 'Study 2 Hours', 'Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet'];
// Oct 1 to Nov 2 is 33 days: five Sundays, Mondays, Thursdays, Fridays and Saturdays, four Tuesdays
// and Wednesdays. So each habit was due, and kept, this many times.
const TIMES = { Cycling: 14, 'Push Day': 4, 'Pull Day': 5, 'Leg Day': 5, 'Rest Day': 5, '5K Walk': 28, 'Study 1 Hour': 13, 'Study 2 Hours': 15, Meditate: 28, 'Read 30 min': 28, 'Drink 3L Water': 28, 'Healthy Diet': 28 };

const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Every habit checked on each day it was due from `from` to `to`, as the app saves checks.
function keptScheduled(habits, from, to) {
  const out = {};
  for (let d = new Date(`${from}T12:00:00`); d <= new Date(`${to}T12:00:00`); d.setDate(d.getDate() + 1)) {
    const due = habits.filter((h) => h.stages[0].from <= key(d) && (h.recurrence.type === 'daily' || h.recurrence.days.includes(d.getDay())));
    if (due.length) out[key(d)] = Object.fromEntries(due.map((h) => [h.id, true]));
  }
  return out;
}
// The core list begun `since`, kept every due day until `to`; `edit` can change the completions.
function kept({ since = '2026-10-01', to = '2026-11-02', settings = {}, chapters = {}, edit, habits: change } = {}) {
  let habits = coreHabits(since);
  const completions = keptScheduled(habits, since, to);
  if (edit) edit(completions);
  if (change) habits = change(habits);
  return stateWith({ habits, completions, settings, chapters });
}

// The bottom bar on the phone ("○Today"), the tabs along the top on a desktop.
const nav = (app, name) => (app.phone ? app.page.getByRole('button', { name: new RegExp(`^\\W*${name}$`) }).first() : app.button(name));
async function openInsights(app) {
  await app.tap(nav(app, 'Insights'));
  await app.page.getByText('Day streak', { exact: true }).waitFor({ timeout: 3000 });
  await app.wait(150);
}

// A stat on Insights, by its label ('Day streak', 'Best streak', 'This week').
const stat = (app, name) => app.page.evaluate((l) => {
  const el = [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === l && d.children.length === 0);
  return el?.previousElementSibling?.textContent.trim() ?? null;
}, name);
const stats = async (app) => ({ streak: await stat(app, 'Day streak'), best: await stat(app, 'Best streak'), week: await stat(app, 'This week') });

// "Habits, as they grew": each row's name, how rooted it is, and its count on the right.
const stairs = (app) => app.page.evaluate(() => {
  const head = [...document.querySelectorAll('div')].find((d) => !d.children.length && d.textContent.trim() === 'Habits, as they grew');
  if (!head) return null;
  return [...head.parentElement.children].filter((r) => r.querySelector('button')).map((r) => {
    const [left, right] = r.firstElementChild.children;
    return { name: left.querySelector('button').textContent.trim(), state: left.children[1]?.textContent.trim(), right: right.textContent.trim() };
  });
});

// The year grid: its month labels, the scroller's visible box, and each week column's cells.
const yearGrid = (app) => app.page.evaluate(() => {
  const head = [...document.querySelectorAll('div')].find((d) => !d.children.length && d.textContent.trim() === 'Consistency · 12 months');
  const scroller = head.nextElementSibling;
  const [labelRow, body] = scroller.firstElementChild.children;
  const box = (e) => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right }; };
  return {
    labels: [...labelRow.children].map((s) => ({ text: s.textContent.trim(), ...box(s) })),
    view: box(scroller),
    columns: [...body.children[1].children].map((col) => ({ ...box(col), cells: [...col.children].map((c) => ({ title: c.getAttribute('title'), bg: getComputedStyle(c).backgroundColor })) })),
    tip: head.parentElement.lastElementChild.firstElementChild.textContent.trim(),
  };
});
const gridCell = (grid, day) => grid.columns.flatMap((c) => c.cells).find((c) => c.title.startsWith(`${day} · `));

// The trend: its drawn paths, the line under the heading when nothing is drawn, the hover readout.
const trend = (app) => app.page.evaluate(() => {
  const head = [...document.querySelectorAll('div')].find((d) => !d.children.length && d.textContent.trim() === 'Trend · 90 days');
  const box = head.parentElement.parentElement;
  const svg = box.querySelector('svg');
  return {
    paths: svg ? [...svg.querySelectorAll('path')].map((p) => ({ length: (p.getAttribute('d') || '').length, stroke: p.getAttribute('stroke') })) : [],
    note: box.querySelector('p')?.textContent.trim() || null,
    readout: head.nextElementSibling.textContent.trim(),
    underlined: [...box.querySelectorAll('button')].filter((b) => getComputedStyle(b).textDecorationLine === 'underline').map((b) => b.textContent.trim()),
  };
});

// The almanac: the year shown, the arrows, and each month's name, plate marks and chapter.
const almanac = (app) => app.page.evaluate(() => {
  const head = [...document.querySelectorAll('div')].find((d) => !d.children.length && d.textContent.trim() === 'Almanac');
  const root = head.parentElement;
  const bar = head.nextElementSibling;
  const grid = bar.nextElementSibling;
  const visible = (b) => Boolean(b) && getComputedStyle(b).visibility !== 'hidden';
  const list = (name) => {
    const l = [...root.querySelectorAll('div')].find((d) => !d.children.length && d.textContent.trim() === name);
    return l ? [...l.parentElement.children].slice(1).map((r) => r.textContent.replace(/\s+/g, ' ').trim()) : [];
  };
  return {
    year: [...bar.querySelectorAll('span')].map((s) => s.textContent.trim()).find((t) => /^\d{4}$/.test(t)) || null,
    previous: visible(bar.querySelector('[aria-label="Previous year"]')),
    next: visible(bar.querySelector('[aria-label="Next year"]')),
    months: [...grid.children].map((m) => {
      const svg = m.querySelector('svg');
      const ch = m.lastElementChild !== m.firstElementChild && m.lastElementChild.tagName === 'DIV' ? m.lastElementChild : null;
      return {
        name: m.firstElementChild.textContent.trim(),
        marks: svg ? svg.querySelectorAll('path').length : null,
        numeral: ch?.firstElementChild.textContent.trim() ?? null,
        line: ch ? (ch.querySelector('input')?.value ?? ch.querySelector('button')?.textContent.trim()) : null,
      };
    }),
    steps: list('Steps taken'),
    rests: list('Rests'),
  };
});
const chapterOf = (app, month) => app.page.locator('div')
  .filter({ has: app.page.getByText(month, { exact: true }) })
  .filter({ has: app.page.getByTitle('Write this chapter in your own words') })
  .last()
  .getByTitle('Write this chapter in your own words');

// A habit's own page: its heading, the line over and under it, and its two big numbers.
const habitPage = (app) => app.page.evaluate(() => {
  const h2 = document.querySelector('h2');
  const numbers = [...document.querySelectorAll('div')].filter((d) => !d.children.length && /^(Times? kept|Hours? given)$/.test(d.textContent.trim()))
    .map((d) => [d.textContent.trim(), d.previousElementSibling.textContent.trim()]);
  const stagesHead = [...document.querySelectorAll('div')].find((d) => !d.children.length && d.textContent.trim() === 'Stages');
  const stages = [];
  for (let n = stagesHead?.nextElementSibling; n && n.tagName === 'DIV' && n.children.length === 3; n = n.nextElementSibling) stages.push([...n.children].map((c) => c.textContent.trim()));
  return { heading: h2?.textContent.trim() ?? null, over: h2?.previousElementSibling?.textContent.trim(), under: h2?.nextElementSibling?.textContent.trim(), numbers: Object.fromEntries(numbers), stages, color: h2 && getComputedStyle(h2).color };
});

// The month calendar: on a desktop it is the right column; on the phone it lives in the month
// sheet, opened from the date in the header.
const monthName = (app) => app.page.getByRole('button', { name: /^[A-Z][a-z]+ \d{4}\. / });
async function showMonth(app) {
  if (app.phone) await app.tap(app.page.getByRole('button', { name: /▼/ }));
  await monthName(app).waitFor({ timeout: 3000 });
}
const turned = async (app) => (await monthName(app).getAttribute('aria-pressed')) === 'true';
const monthShown = async (app) => (await monthName(app).textContent()).trim();
const elevation = (app) => app.page.locator('svg[role=img][aria-label^="Chapter "]');
const planDays = (app) => app.page.locator('[data-calendar-day]');
const monthArrow = (app, ch) => monthName(app).locator('xpath=..').getByText(ch, { exact: true });
// The days drawn with the selected circle behind them.
const circled = (app) => app.page.evaluate(() => [...document.querySelectorAll('[data-calendar-day]')].filter((g) => g.querySelector('rect[rx]')).map((g) => g.getAttribute('data-calendar-day')));
// A day in the turned month, by its tooltip ('Mon, Nov 2').
const block = (app, day) => elevation(app).locator('polygon').filter({ has: app.page.locator('title', { hasText: new RegExp(`^${day}( ·|$)`) }) });

async function expectTurned(app, where) {
  await app.wait(150);
  assert.equal(await turned(app), true, `the month name is pressed ${where}`);
  assert.equal(await elevation(app).count(), 1, `the month stands as an elevation ${where}`);
  assert.equal(await planDays(app).count(), 0, `the flat days are gone ${where}`);
}
async function expectFlat(app, where) {
  await app.wait(150);
  assert.equal(await turned(app), false, `the month name is not pressed ${where}`);
  assert.equal(await elevation(app).count(), 0, `no elevation ${where}`);
  assert.equal(await planDays(app).count(), 42, `the six weeks of days are back ${where}`);
}

// Press and hold at the middle of `loc` for `ms`, look with `during`, then let go.
async function hold(app, loc, ms, during) {
  await loc.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const b = await loc.boundingBox();
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  let seen;
  if (app.phone) {
    const cdp = await app.ctx.newCDPSession(app.page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await app.wait(ms);
    seen = await during();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await app.page.mouse.move(x, y);
    await app.page.mouse.down();
    await app.wait(ms);
    seen = await during();
    await app.page.mouse.up();
  }
  await app.wait(300);
  return seen;
}

async function expectDay(app, { wd, month, day }) {
  const shown = await app.shownDay();
  assert.equal(shown.weekday, wd, `weekday shown: ${JSON.stringify(shown)}`);
  assert.equal(shown.numeral, day, `numeral shown: ${JSON.stringify(shown)}`);
  assert.equal(shown.header, app.phone ? `${month.slice(0, 3)} ${day}` : `${wd}, ${month} ${day}`, `header shown: ${JSON.stringify(shown)}`);
}

// Pure black, white and greys: every ink on the page has r = g = b.
const nonGreys = (app) => app.page.evaluate(() => {
  const grey = (c) => {
    if (!c || c === 'none' || c === 'transparent' || c.startsWith('url(') || /^currentcolor$/i.test(c)) return true;
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) {
      const h = c.replace('#', '');
      if (/^[0-9a-f]{3}$/i.test(h)) return h[0] === h[1] && h[1] === h[2];
      if (/^[0-9a-f]{6}$/i.test(h)) return h.slice(0, 2) === h.slice(2, 4) && h.slice(2, 4) === h.slice(4, 6);
      return true;
    }
    const [r, g, b, a] = m[1].split(',').map(Number);
    return a === 0 || (r === g && g === b);
  };
  const bad = [];
  for (const el of document.querySelectorAll('#root *')) {
    const cs = getComputedStyle(el);
    for (const p of ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor']) if (!grey(cs[p])) bad.push(`${el.tagName} ${p} ${cs[p]}`);
    for (const a of ['fill', 'stroke']) { const v = el.getAttribute(a); if (v && !grey(v)) bad.push(`${el.tagName} ${a}=${v}`); }
  }
  return bad.slice(0, 8);
});
const pageBg = (app) => app.page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const DARK_BG = 'rgb(10, 10, 10)';
const WHITE = 'rgb(255, 255, 255)';

export default [
  // ---- The three numbers -------------------------------------------------------------------------

  ...both('Insights counts the streaks and the week exactly; an unfinished today breaks nothing, and finishing it counts', async (t, width) => {
    const app = await t.open({ state: kept(), width });
    await openInsights(app);
    assert.equal(await app.page.getByText('Insights fill in as you check things off.').count(), 0, 'no empty-state note with history');
    // 33 complete days, Oct 1 to Nov 2; today is under way. This week: Sun 1 of 1, Mon 7 of 7, Tue 0 of 7.
    assert.deepEqual(await stats(app), { streak: '33', best: '33', week: '53%' });
    if (app.phone) await app.assertNoHorizontalScroll('on Insights');

    await app.tap(nav(app, 'Today'));
    for (const text of TUESDAY) await app.tap(app.page.locator(`[data-habit-row="${text}"]`));
    await openInsights(app);
    assert.deepEqual(await stats(app), { streak: '34', best: '34', week: '100%' }, 'today, done, joins the streak');
    await app.reload();
    await openInsights(app);
    assert.deepEqual(await stats(app), { streak: '34', best: '34', week: '100%' }, 'after a reload');
    if (app.phone) await app.assertNoHorizontalScroll('on Insights with three-digit numbers');
    app.assertNoErrors();
  }),

  ...both('a missed day and a day under the threshold break the streak; a day over it holds, and the grid inks each', async (t, width) => {
    const state = kept({
      edit: (c) => {
        delete c['2026-10-13']; // Tue: nothing
        delete c['2026-10-22'].diet; // Thu: 6 of 7, over 80%
        delete c['2026-10-27'].read; // Tue: 5 of 7, under 80%
        delete c['2026-10-27'].water;
      },
    });
    const app = await t.open({ state, width });
    await openInsights(app);
    // Runs: Oct 1-12 (12), Oct 14-26 (13, with the 6 of 7), Oct 28-Nov 2 (6).
    assert.deepEqual(await stats(app), { streak: '6', best: '13', week: '53%' });
    const grid = await yearGrid(app);
    assert.deepEqual(gridCell(grid, 'Tue, Oct 13'), { title: 'Tue, Oct 13 · 0% (0/7)', bg: 'rgb(221, 221, 221)' }, 'a missed day is pale');
    assert.deepEqual(gridCell(grid, 'Thu, Oct 22'), { title: 'Thu, Oct 22 · 86% (6/7)', bg: 'rgb(0, 0, 0)' }, '6 of 7 met the threshold');
    assert.deepEqual(gridCell(grid, 'Tue, Oct 27'), { title: 'Tue, Oct 27 · 71% (5/7)', bg: 'rgb(136, 136, 136)' }, '5 of 7 is partial');
    assert.deepEqual(gridCell(grid, 'Tue, Nov 3'), { title: 'Tue, Nov 3 · 0% (0/7)', bg: 'rgb(221, 221, 221)' }, 'today so far');
    if (!app.phone) {
      const cell = app.page.locator('[title="Tue, Oct 27 · 71% (5/7)"]');
      await cell.hover();
      assert.equal((await yearGrid(app)).tip, 'Tue, Oct 27 · 71% (5/7)', 'hovering a day reads it out');
    }
    if (app.phone) await app.assertNoHorizontalScroll('on Insights');
    app.assertNoErrors();
  }),

  ...both('left open overnight on Insights, the numbers follow the new day', async (t, width) => {
    // Kept every day through Saturday Nov 7, and it is 23:58 that Saturday.
    const app = await t.open({ state: kept({ to: '2026-11-07' }), width, now: '2026-11-07T23:58:00' });
    await openInsights(app);
    assert.deepEqual(await stats(app), { streak: '38', best: '38', week: '100%' }, 'Saturday night');
    await app.later('05:00');
    const grid = await yearGrid(app);
    assert.equal(grid.columns[grid.columns.length - 1].cells[0].title, 'Sun, Nov 8 · 0% (0/1)', 'the year grid has moved to the new week');
    // Sunday has begun: the streak stands (today is not over), and the new week has 0 of 1 done.
    assert.deepEqual(await stats(app), { streak: '38', best: '38', week: '0%' }, 'Sunday, just after midnight');
    app.assertNoErrors();
  }),

  {
    name: 'on the first day, Insights is empty but whole, and counts nothing as missed (375)',
    run: async (t) => {
      const app = await t.open({ state: stateWith({ habits: coreHabits('2026-11-03') }), width: 375 });
      await openInsights(app);
      assert.ok(await app.page.getByText('Insights fill in as you check things off.').isVisible(), 'the empty-state note');
      assert.deepEqual(await stats(app), { streak: '0', best: '0', week: '0%' });
      const rows = await stairs(app);
      assert.deepEqual(rows.map((r) => r.name), ORDER);
      for (const r of rows) assert.match(r.right, /^0 times/, `${r.name}: ${r.right}`);
      const a = await almanac(app);
      assert.equal(a.year, '2026');
      assert.equal(a.previous, false, 'no earlier year to turn to');
      assert.deepEqual(a.months.filter((m) => m.marks !== null).map((m) => m.name), ['November'], 'only this month has a plate');
      await app.assertNoHorizontalScroll('on an empty Insights');
      app.assertNoErrors();
      // Nothing has been checked off, so the trend says when its line will come, rather than
      // leaving its space blank.
      const tr = await trend(app);
      assert.equal(tr.note, 'The line appears once a few days have been checked off.', `the trend on day one: ${JSON.stringify(tr)}`);
    },
  },

  {
    name: 'an archived habit leaves "Habits, as they grew", and the days it was kept still count (1440)',
    run: async (t) => {
      const state = kept({ habits: (hs) => hs.map((h) => (h.id === 'diet' ? { ...h, archivedAt: '2026-11-03T15:00:00.000Z' } : h)) });
      const app = await t.open({ state });
      await openInsights(app);
      assert.deepEqual((await stairs(app)).map((r) => r.name), ORDER.filter((n) => n !== 'Healthy Diet'));
      // Sun 1 of 1, Mon 7 of 7, Tue 0 of the 6 left.
      assert.deepEqual(await stats(app), { streak: '33', best: '33', week: '57%' });
      app.assertNoErrors();
    },
  },

  // ---- The year grid and the trend ---------------------------------------------------------------

  ...both('the year grid labels its months without collisions and ends on this week; the trend is drawn and switches windows', async (t, width) => {
    const MONTHS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
    const cases = [
      { now: '2026-11-03T08:00:00', to: '2026-11-02', months: MONTHS, today: 'Tue, Nov 3' },
      // The grid begins Sun Jan 18, 2026: January labels the first column and February the third.
      { now: '2027-01-12T08:00:00', to: '2027-01-11', months: [...MONTHS.slice(2, 12), 'Nov', 'Dec', 'Jan'], today: 'Tue, Jan 12' },
    ];
    for (const c of cases) {
      const app = await t.open({ state: kept({ to: c.to }), width, now: c.now });
      await openInsights(app);
      const grid = await yearGrid(app);
      assert.equal(grid.columns.length, 52, 'a year of weeks');
      assert.ok(grid.columns.every((col) => col.cells.length === 7));
      assert.deepEqual(grid.labels.map((l) => l.text), c.months, `month labels on ${c.now}`);
      const sorted = [...grid.labels].sort((a, b) => a.left - b.left);
      for (let i = 1; i < sorted.length; i++) {
        assert.ok(sorted[i - 1].right + 2 <= sorted[i].left, `"${sorted[i - 1].text}" and "${sorted[i].text}" collide: ${JSON.stringify([sorted[i - 1], sorted[i]])}`);
      }
      // Each label after the first sits over the week its month begins in.
      for (const l of grid.labels.slice(1)) {
        const col = grid.columns.find((cl) => cl.cells.some((cell) => new RegExp(`^\\w{3}, ${l.text} 1 ·`).test(cell.title)));
        assert.ok(col && Math.abs(col.left - l.left) < 1, `"${l.text}" sits over the week of the 1st`);
      }
      const last = grid.columns[grid.columns.length - 1];
      assert.ok(last.left >= grid.view.left - 0.5 && last.right <= grid.view.right + 0.5, `this week is in view: ${JSON.stringify({ last: [last.left, last.right], view: grid.view })}`);
      const lastLabel = grid.labels[grid.labels.length - 1];
      assert.ok(lastLabel.right <= grid.view.right + 0.5, `the latest month label is not cut off: ${JSON.stringify({ lastLabel, view: grid.view })}`);
      assert.ok(last.cells.some((cell) => cell.title.startsWith(`${c.today} · `)), `today is in the last week: ${c.today}`);

      const tr = await trend(app);
      assert.ok(tr.paths.length >= 1 && tr.paths[0].length > 50, `the trend line is drawn: ${JSON.stringify(tr)}`);
      assert.deepEqual(tr.underlined, ['7 days']);
      await app.tap(app.button('30 days'));
      const tr30 = await trend(app);
      assert.ok(tr30.paths.length >= 1 && tr30.paths[0].length > 50, 'the 30-day line is drawn');
      assert.deepEqual(tr30.underlined, ['30 days'], 'the chosen window is underlined');
      if (!app.phone && c === cases[0]) {
        // Hover over Nov 2, the next to last point: the week to it was all kept.
        await app.tap(app.button('7 days'));
        const svg = app.page.locator('svg').filter({ has: app.page.locator('path[stroke-linecap="round"]') }).first();
        const b = await svg.boundingBox();
        await app.page.mouse.move(b.x + (b.width * 88) / 89, b.y + b.height / 2);
        assert.equal((await trend(app)).readout, 'Nov 2 · 100%', 'the trend reads out the day under the pointer');
      }
      if (app.phone) await app.assertNoHorizontalScroll(`on Insights on ${c.now}`);
      app.assertNoErrors();
      await app.close();
    }
  }),

  // ---- Habits, as they grew, and a habit's own page ----------------------------------------------

  ...both('"Habits, as they grew" lists each habit in the order of the day with the times kept; a name opens its page, and back returns', async (t, width) => {
    const app = await t.open({ state: kept(), width });
    await openInsights(app);
    const rows = await stairs(app);
    assert.deepEqual(rows.map((r) => r.name), ORDER, 'every habit, in the order of the day');
    for (const r of rows) assert.match(r.right, new RegExp(`^${TIMES[r.name]} times\\b`), `${r.name} was kept ${TIMES[r.name]} times: ${r.right}`);
    const study = rows.find((r) => r.name === 'Study 1 Hour');

    await app.tap(app.button('Study 1 Hour'));
    await app.page.getByRole('heading', { name: 'Study 1 Hour' }).waitFor({ timeout: 3000 });
    const p = await habitPage(app);
    assert.equal(p.heading, 'Study 1 Hour');
    assert.equal(p.over, 'Post-Work · since Oct 2026');
    assert.equal(p.under, `60 min · Mon · Tue · Wed · ${study.state}`, 'its terms, and as rooted as the list said');
    assert.deepEqual(p.numbers, { 'Times kept': '13', 'Hours given': '13' });
    assert.deepEqual(p.stages, [['I', 'Study 1 Hour · 60 min · Mon · Tue · Wed', 'since Oct 113 of 13']], 'one stage, kept every time it was due');
    if (app.phone) await app.assertNoHorizontalScroll('on a habit page');

    // Edit this habit opens the editor over the page; Escape closes it and the page stays.
    await app.tap(app.button('Edit this habit'));
    const editor = app.page.getByRole('dialog', { name: 'Edit habit' });
    await editor.waitFor({ timeout: 3000 });
    await app.press('Escape');
    assert.equal(await editor.count(), 0, 'Escape closes the editor');
    assert.ok(await app.page.getByRole('heading', { name: 'Study 1 Hour' }).isVisible(), 'still on the habit page');

    await app.tap(app.button('‹ Insights'));
    await app.page.getByText('Habits, as they grew', { exact: true }).waitFor({ timeout: 3000 });
    assert.equal(await app.page.getByRole('heading', { name: 'Study 1 Hour' }).count(), 0, 'the page is gone');
    assert.deepEqual(await stats(app), { streak: '33', best: '33', week: '53%' }, 'back on Insights');
    app.assertNoErrors();
  }),

  {
    name: '"% lately" does not count today as missed while the day is still under way (1440)',
    run: async (t) => {
      // Every habit has been kept every time it was due; today, at 08:00, nothing is checked yet.
      const app = await t.open({ state: kept() });
      await openInsights(app);
      const rows = await stairs(app);
      const wrong = rows.filter((r) => r.right !== `${TIMES[r.name]} times · 100% lately`).map((r) => `${r.name}: ${r.right}`);
      assert.deepEqual(wrong, [], 'a habit never missed reads 100% lately');
      app.assertNoErrors();
    },
  },

  // ---- The almanac -------------------------------------------------------------------------------

  ...both('the Almanac shows this year, turns back to last year when there is history, and forward again', async (t, width) => {
    const app = await t.open({ state: kept({ since: '2025-09-01' }), width });
    await openInsights(app);
    let a = await almanac(app);
    assert.equal(a.year, '2026');
    assert.equal(a.previous, true, 'an arrow back to 2025');
    assert.equal(a.next, false, 'no arrow into next year');
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    assert.deepEqual(a.months.map((m) => m.name), MONTHS);
    assert.deepEqual(a.months.filter((m) => m.marks !== null).map((m) => m.name), MONTHS.slice(0, 11), 'every month so far has a plate; December is to come');
    assert.deepEqual(a.months.map((m) => m.numeral), ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', null]);
    assert.equal(a.months[9].marks, 31, 'October: every day kept is an X');
    assert.equal(a.months[10].marks, 2, 'November: Nov 1 and 2 kept, today not yet');
    if (app.phone) await app.assertNoHorizontalScroll('on the Almanac');

    await app.tap(app.button('Previous year'));
    a = await almanac(app);
    assert.equal(a.year, '2025');
    assert.equal(a.previous, false, 'the record begins in 2025');
    assert.equal(a.next, true, 'an arrow on to 2026');
    assert.deepEqual(a.months.filter((m) => m.marks !== null).map((m) => m.name), MONTHS.slice(8), 'the record begins in September');
    assert.deepEqual(a.months.filter((m) => m.numeral).map((m) => m.numeral), ['IX', 'X', 'XI', 'XII']);
    assert.equal(a.months[8].marks, 30, 'September 2025: thirty X');
    assert.ok(a.months.slice(8).every((m) => m.line && m.line.startsWith('in which')), `each month has its line: ${JSON.stringify(a.months.slice(8))}`);
    if (app.phone) await app.assertNoHorizontalScroll('on the Almanac for 2025');

    await app.tap(app.button('Next year'));
    a = await almanac(app);
    assert.equal(a.year, '2026');
    assert.equal(a.next, false);
    app.assertNoErrors();
  }),

  ...both('a chapter line is rewritten: Enter keeps it across a reload, Escape lets an edit go, and an emptied line gets its own line back', async (t, width) => {
    const app = await t.open({ state: kept(), width });
    await openInsights(app);
    const line = chapterOf(app, 'November');
    const given = (await line.textContent()).trim();
    assert.match(given, /^in which /, 'November has a line of its own');
    const OWN = 'in which I walked — & ran <fast> "every" day';

    await app.tap(line);
    const field = app.page.getByLabel('Chapter XI, in your own words');
    await field.waitFor({ timeout: 3000 });
    assert.equal(await field.evaluate((e) => e === document.activeElement), true, 'the field has focus');
    assert.equal(await field.inputValue(), '', 'a given line starts the field empty');
    await app.type(OWN);
    await app.press('Enter');
    assert.equal(await field.count(), 0, 'Enter closes the field');
    assert.equal((await line.textContent()).trim(), OWN, 'the chapter reads as written, every character kept');
    assert.equal((await app.stored()).chapters['2026-11'], OWN, 'and it is saved');
    if (!app.phone) {
      // The month on the right, turned, carries the same words.
      await app.tap(monthName(app));
      assert.equal(await elevation(app).getAttribute('aria-label'), `Chapter XI, ${OWN}`);
      await app.tap(monthName(app));
    }

    await app.reload();
    await openInsights(app);
    assert.equal((await chapterOf(app, 'November').textContent()).trim(), OWN, 'after a reload');

    await app.tap(chapterOf(app, 'November'));
    await field.waitFor({ timeout: 3000 });
    assert.equal(await field.inputValue(), OWN, 'the field starts from your words');
    await app.press('ControlOrMeta+A');
    await app.type('in which nothing happened');
    await app.press('Escape');
    assert.equal(await field.count(), 0, 'Escape closes the field');
    assert.equal((await chapterOf(app, 'November').textContent()).trim(), OWN, 'Escape keeps the line as it was');
    assert.equal((await app.stored()).chapters['2026-11'], OWN, 'and saves nothing');

    await app.tap(chapterOf(app, 'November'));
    await field.waitFor({ timeout: 3000 });
    await app.press('ControlOrMeta+A');
    await app.press('Backspace');
    await app.press('Enter');
    assert.equal((await chapterOf(app, 'November').textContent()).trim(), given, 'an emptied line gives the month its own line back');
    assert.equal((await app.stored()).chapters['2026-11'], undefined, 'and nothing is kept for it');

    // Tapping away keeps what was typed.
    await app.tap(chapterOf(app, 'November'));
    await field.waitFor({ timeout: 3000 });
    await app.type('in which the rain came');
    await app.tap(app.page.getByText('Almanac', { exact: true }));
    assert.equal(await field.count(), 0);
    assert.equal((await chapterOf(app, 'November').textContent()).trim(), 'in which the rain came', 'tapping away keeps the words');
    if (app.phone) await app.assertNoHorizontalScroll('after writing a chapter');
    app.assertNoErrors();
  }),

  {
    name: 'Escape in a chapter field lets the edit go and leaves the turned month turned; a second Escape settles it (1440)',
    run: async (t) => {
      const app = await t.open({ state: kept() });
      await openInsights(app);
      await app.tap(monthName(app));
      await expectTurned(app, 'before writing');
      const before = (await chapterOf(app, 'November').textContent()).trim();
      await app.tap(chapterOf(app, 'November'));
      await app.type('half a thought');
      await app.press('Escape');
      assert.equal(await app.page.getByLabel('Chapter XI, in your own words').count(), 0, 'the field closes');
      assert.equal((await chapterOf(app, 'November').textContent()).trim(), before, 'the line is as it was');
      assert.equal(await turned(app), true, 'the first Escape was the field\'s');
      await app.press('Escape');
      await expectFlat(app, 'after the second Escape');
      app.assertNoErrors();
    },
  },

  // ---- The Turn ----------------------------------------------------------------------------------

  ...both('tapping the month name turns the month into an elevation, and tapping again settles it', async (t, width) => {
    const app = await t.open({ state: kept(), width });
    await showMonth(app);
    assert.equal(await monthShown(app), 'November 2026');
    await expectFlat(app, 'at first');
    await app.tap(monthName(app));
    await expectTurned(app, 'after a tap');
    assert.match(await elevation(app).getAttribute('aria-label'), /^Chapter XI, in which /, 'the elevation names its chapter');
    assert.ok(await app.page.getByText('CHAPTER XI', { exact: true }).isVisible(), 'the chapter caption shows');
    if (app.phone) {
      assert.ok(await monthName(app).isVisible(), 'the month sheet stays open while turned');
      await app.assertNoHorizontalScroll('with the month turned');
    }
    await app.tap(monthName(app));
    await expectFlat(app, 'after a second tap');
    assert.deepEqual(await circled(app), ['2026-11-03'], 'today is still the chosen day');
    await expectDay(app, { wd: 'Tue', month: 'November', day: 3 });
    app.assertNoErrors();
  }),

  ...both('press and hold the month name to look; letting go settles it', async (t, width) => {
    const app = await t.open({ state: kept(), width });
    await showMonth(app);
    const during = await hold(app, monthName(app), 700, async () => ({ pressed: await turned(app), elevation: await elevation(app).count() }));
    assert.deepEqual(during, { pressed: true, elevation: 1 }, 'held, the month stands');
    await expectFlat(app, 'once let go');
    if (app.phone) assert.ok(await monthName(app).isVisible(), 'the month sheet is still open');
    app.assertNoErrors();
  }),

  {
    name: 'Enter and Space on the focused month name turn and settle it, and Escape settles it (1440)',
    run: async (t) => {
      const app = await t.open({ state: kept() });
      await monthName(app).focus();
      await app.press('Enter');
      await expectTurned(app, 'after Enter');
      assert.equal(await monthName(app).evaluate((e) => e === document.activeElement), true, 'focus stays on the month name');
      await app.press('Enter');
      await expectFlat(app, 'after Enter again');
      await app.press('Space');
      await expectTurned(app, 'after Space');
      await app.press('Space');
      await expectFlat(app, 'after Space again');
      await app.press('Space');
      await expectTurned(app, 'after Space once more');
      await app.press('Escape');
      await expectFlat(app, 'after Escape');
      app.assertNoErrors();
    },
  },

  {
    name: 'in the month sheet, Enter turns the month and Escape puts the sheet away; it opens flat again (375)',
    run: async (t) => {
      const app = await t.open({ state: kept(), width: 375 });
      await showMonth(app);
      await monthName(app).focus();
      await app.press('Enter');
      await expectTurned(app, 'in the sheet');
      await app.press('Escape');
      assert.equal(await monthName(app).count(), 0, 'Escape closes the month sheet');
      await showMonth(app);
      await expectFlat(app, 'when the sheet opens again');
      app.assertNoErrors();
    },
  },

  ...both('tapping a day of the turned month chooses it and settles the month: Sunday, then Monday', async (t, width) => {
    // Kept through Sunday Nov 1; Monday Nov 2 was missed, so it lies flat beside Sunday's block.
    const app = await t.open({ state: kept({ to: '2026-11-01' }), width });
    await showMonth(app);
    await app.tap(monthName(app));
    await expectTurned(app, 'to choose Sunday');
    await app.tap(block(app, 'Sun, Nov 1'));
    if (app.phone) assert.equal(await monthName(app).count(), 0, 'the month sheet closes once a day is chosen');
    await expectDay(app, { wd: 'Sun', month: 'November', day: 1 });
    assert.deepEqual((await app.habitRows()).map((r) => r.text), ['Rest Day']);

    await showMonth(app);
    if (!app.phone) await expectFlat(app, 'once Sunday was chosen');
    else await expectFlat(app, 'when the sheet opens again');
    assert.deepEqual(await circled(app), ['2026-11-01']);
    await app.tap(monthName(app));
    await expectTurned(app, 'to choose Monday');
    await app.tap(block(app, 'Mon, Nov 2'));
    await expectDay(app, { wd: 'Mon', month: 'November', day: 2 });
    assert.deepEqual((await app.habitRows()).map((r) => r.text), ['Cycling', '5K Walk', 'Study 1 Hour', 'Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet']);
    await showMonth(app);
    await expectFlat(app, 'once Monday was chosen');
    assert.deepEqual(await circled(app), ['2026-11-02']);
    app.assertNoErrors();
  }),

  ...both('the month arrows show the months before and after, and a day there can be chosen', async (t, width) => {
    const app = await t.open({ state: kept(), width });
    await showMonth(app);
    await app.tap(monthArrow(app, '‹'));
    assert.equal(await monthShown(app), 'October 2026');
    assert.equal(await app.page.locator('[data-calendar-day][data-in-month="true"]').count(), 31, 'October has 31 days');
    assert.equal(await app.page.locator('[data-calendar-day="2026-10-01"] rect').count(), 3, 'Oct 1, kept, is struck through');
    await app.tap(monthArrow(app, '›'));
    await app.tap(monthArrow(app, '›'));
    assert.equal(await monthShown(app), 'December 2026');
    assert.equal(await app.page.locator('[data-calendar-day][data-in-month="true"]').count(), 31);
    if (app.phone) assert.ok(await monthName(app).isVisible(), 'the sheet stays open while browsing months');
    else await expectDay(app, { wd: 'Tue', month: 'November', day: 3 });

    // Turned, the arrows still move the month.
    await app.tap(monthName(app));
    await expectTurned(app, 'in December');
    await app.tap(monthArrow(app, '‹'));
    assert.equal(await monthShown(app), 'November 2026');
    assert.match(await elevation(app).getAttribute('aria-label'), /^Chapter XI, /, 'the elevation is November\'s');
    await app.tap(monthName(app));
    await expectFlat(app, 'settled in November');

    await app.tap(monthArrow(app, '‹'));
    await app.tap(app.calendarDay(20));
    await expectDay(app, { wd: 'Tue', month: 'October', day: 20 });
    if (app.phone) await app.assertNoHorizontalScroll('after choosing a day in October');
    app.assertNoErrors();
  }),

  {
    name: 'the month arrows can be reached and pressed from the keyboard (1440)',
    run: async (t) => {
      const app = await t.open({ state: kept() });
      await monthName(app).focus();
      await app.press('Shift+Tab');
      const focused = () => app.page.evaluate(() => ({ role: document.activeElement.getAttribute('role'), name: document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim().slice(0, 40) }));
      assert.match((await focused()).name, /previous month/i, `Shift+Tab from the month name reaches the previous-month arrow: ${JSON.stringify(await focused())}`);
      await app.press('Enter');
      assert.equal(await monthShown(app), 'October 2026', 'Enter on it shows October');
      await app.press('Tab');
      await app.press('Tab');
      assert.match((await focused()).name, /next month/i, `Tab past the month name reaches the next-month arrow: ${JSON.stringify(await focused())}`);
      await app.press('Enter');
      await app.press('Space');
      assert.equal(await monthShown(app), 'December 2026', 'Enter and Space on it move on two months');
      app.assertNoErrors();
    },
  },

  {
    name: 'the desktop month calendar follows the day shown into the month before (1440)',
    run: async (t) => {
      const app = await t.open({ state: kept() });
      await app.tap(app.weekDay(1));
      await app.tap(app.button('Previous day'));
      await expectDay(app, { wd: 'Sat', month: 'October', day: 31 });
      assert.equal(await monthShown(app), 'October 2026', 'the calendar shows the month of the day shown');
      assert.deepEqual(await circled(app), ['2026-10-31'], 'with that day circled');
      app.assertNoErrors();
    },
  },

  {
    name: 'left open at midnight on Oct 31, the desktop month calendar turns over to November (1440)',
    run: async (t) => {
      const app = await t.open({ state: kept({ to: '2026-10-30' }), now: '2026-10-31T23:58:00' });
      assert.equal(await monthShown(app), 'October 2026');
      await app.later('05:00');
      await expectDay(app, { wd: 'Sun', month: 'November', day: 1 });
      assert.equal(await monthShown(app), 'November 2026', 'the calendar shows the new month');
      assert.deepEqual(await circled(app), ['2026-11-01'], 'with today circled');
      app.assertNoErrors();
    },
  },

  {
    name: 'with reduced motion the month turns and settles at once (1440)',
    run: async (t) => {
      const app = await t.open({ state: kept(), reducedMotion: 'reduce' });
      const b = await monthName(app).boundingBox();
      await app.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await app.wait(40);
      const caption = await elevation(app).evaluate((svg) => svg.lastElementChild.getAttribute('opacity'));
      assert.equal(caption, '1', 'the elevation is complete straight away');
      await app.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      await app.wait(40);
      assert.equal(await planDays(app).count(), 42, 'and the plan is back straight away');
      app.assertNoErrors();
    },
  },

  // ---- Dark mode ---------------------------------------------------------------------------------

  ...both('in dark mode, Insights, a habit page and the turned month are light ink on a dark page', async (t, width) => {
    const app = await t.open({ state: kept({ settings: { darkMode: true } }), width });
    await openInsights(app);
    await app.wait(350); // the page background eases in
    assert.equal(await pageBg(app), DARK_BG);
    assert.equal(await app.page.getByText('Day streak', { exact: true }).evaluate((e) => getComputedStyle(e.previousElementSibling).color), WHITE, 'the streak numeral is white');
    assert.equal(gridCell(await yearGrid(app), 'Mon, Nov 2').bg, WHITE, 'a kept day in the year grid is white');
    assert.equal((await trend(app)).paths[0].stroke, '#fff', 'the trend line is white');
    assert.deepEqual(await nonGreys(app), [], 'only black, white and greys on Insights');
    if (app.phone) await app.assertNoHorizontalScroll('on Insights in dark mode');

    await app.tap(app.button('Meditate'));
    await app.page.getByRole('heading', { name: 'Meditate' }).waitFor({ timeout: 3000 });
    assert.equal((await habitPage(app)).color, WHITE, 'the habit page heading is white');
    assert.equal(await pageBg(app), DARK_BG);
    assert.deepEqual(await nonGreys(app), [], 'only black, white and greys on the habit page');
    if (app.phone) await app.assertNoHorizontalScroll('on a habit page in dark mode');
    await app.tap(app.button('‹ Insights'));

    await showMonth(app);
    await app.tap(monthName(app));
    await expectTurned(app, 'in dark mode');
    const tops = await elevation(app).evaluate((svg) => [...svg.querySelectorAll('polygon')].map((p) => p.getAttribute('fill')).filter((f) => f && f !== 'transparent' && f !== 'none' && !f.startsWith('url(')));
    assert.ok(tops.length >= 2 && tops.every((f) => f === '#fff'), `the kept days stand white: ${JSON.stringify(tops)}`);
    assert.deepEqual(await nonGreys(app), [], 'only black, white and greys in the turned month');
    if (app.phone) await app.assertNoHorizontalScroll('with the month turned in dark mode');
    app.assertNoErrors();
  }),

  // ---- The sample year ---------------------------------------------------------------------------

  ...[1440, 375].flatMap((width) => ['light', 'dark'].map((scheme) => ({
    name: `the sample year's Insights shows every section, both years of the almanac and a habit's page (${width}, ${scheme})`,
    run: async (t) => {
      const app = await t.open({ state: false, width, scheme });
      await app.tap(app.button('Look around a sample year first'));
      await openInsights(app);
      if (scheme === 'dark') { await app.wait(350); assert.equal(await pageBg(app), DARK_BG); }
      const s = await stats(app);
      assert.match(s.streak, /^\d+$/);
      assert.match(s.best, /^\d+$/);
      assert.ok(Number(s.best) >= Number(s.streak) && Number(s.best) > 0, JSON.stringify(s));
      assert.match(s.week, /^\d+%$/);

      const grid = await yearGrid(app);
      assert.equal(grid.columns.length, 52);
      assert.equal(grid.labels.length, 13, `month labels: ${grid.labels.map((l) => l.text)}`);
      assert.ok(grid.columns.flatMap((c) => c.cells).filter((c) => c.bg === (scheme === 'dark' ? WHITE : 'rgb(0, 0, 0)')).length > 100, 'a year of kept days');
      assert.ok((await trend(app)).paths.length >= 1, 'the trend is drawn');

      const rows = await stairs(app);
      assert.deepEqual(rows.map((r) => r.name), ['Drink a glass of water on waking', 'Meditate 12 min', 'Run 25 min', 'Plan the day on paper', 'Stretch 10 min', 'Call someone you love', 'Read 20 pages', 'Write three lines', 'Lights out by 11']);
      assert.equal(await app.page.locator('svg[role=img][aria-label*=" times since it began"]').count(), 9, 'each habit has its staircase');

      let a = await almanac(app);
      assert.equal(a.year, '2026');
      assert.equal(a.months[0].line, 'in which I learned to run', 'January in the sample\'s own words');
      assert.equal(a.months[5].line, 'in which we went to the sea', 'June in the sample\'s own words');
      // The sample began Oct 1, 2025: six steps and one rest fall in 2026.
      assert.equal(a.steps.length, 6, `steps taken in 2026: ${JSON.stringify(a.steps)}`);
      assert.ok(a.steps.some((r) => /Meditate 10 min\s*→\s*Meditate 12 min/.test(r)), JSON.stringify(a.steps));
      assert.equal(a.rests.length, 1, JSON.stringify(a.rests));
      assert.match(a.rests[0], /Write three lines\s*until [A-Z][a-z]{2} \d{1,2}$/);
      assert.deepEqual(await nonGreys(app), [], 'only black, white and greys');
      if (app.phone) await app.assertNoHorizontalScroll('on the sample Insights');

      await app.tap(app.button('Previous year'));
      a = await almanac(app);
      assert.equal(a.year, '2025');
      assert.deepEqual(a.months.filter((m) => m.marks !== null).map((m) => m.name), ['October', 'November', 'December']);
      assert.equal(a.steps.length, 1, `steps taken in 2025: ${JSON.stringify(a.steps)}`);
      assert.ok(a.steps.some((r) => /Meditate 2 min\s*→\s*Meditate 5 min/.test(r)), JSON.stringify(a.steps));
      if (app.phone) await app.assertNoHorizontalScroll('on the sample\'s 2025');
      await app.tap(app.button('Next year'));

      await app.tap(app.button('Meditate 12 min'));
      await app.page.getByRole('heading', { name: 'Meditate 12 min' }).waitFor({ timeout: 3000 });
      const p = await habitPage(app);
      assert.deepEqual(p.stages.map((st) => st[0]), ['I', 'II', 'III', 'IV'], 'four stages climbed');
      const listed = rows.find((r) => r.name === 'Meditate 12 min').right.match(/^(\d+) times?\b/)?.[1];
      assert.equal(p.numbers['Times kept'], listed, 'the page counts the times the list did');
      if (app.phone) await app.assertNoHorizontalScroll('on a sample habit page');
      await app.tap(app.button('‹ Insights'));
      await app.page.getByText('Habits, as they grew', { exact: true }).waitFor({ timeout: 3000 });
      assert.equal(await app.stored(), null, 'nothing from the sample is stored');
      app.assertNoErrors();
    },
  }))),
];
