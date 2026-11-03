// Today: moving between days, the day turning over while the app is open, and checking habits.
import { assert, stateWith, coreHabits } from './harness.mjs';

const SUNDAY = ['Rest Day'];
const MONDAY = ['Cycling', '5K Walk', 'Study 1 Hour', 'Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet'];
const TUESDAY = ['Push Day', '5K Walk', 'Study 1 Hour', 'Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet'];
const core = () => stateWith({ habits: coreHabits('2026-10-01') });
const header = (app, wd, month, day) => (app.phone ? `${month.slice(0, 3)} ${day}` : `${wd}, ${month} ${day}`);

async function expectDay(app, { wd, month, day, rows }) {
  const shown = await app.shownDay();
  assert.equal(shown.weekday, wd, `weekday shown: ${JSON.stringify(shown)}`);
  assert.equal(shown.numeral, day, `numeral shown: ${JSON.stringify(shown)}`);
  assert.equal(shown.header, header(app, wd, month, day), `header shown: ${JSON.stringify(shown)}`);
  if (rows) assert.deepEqual((await app.habitRows()).map((r) => r.text), rows);
}

const both = (name, run) => [1440, 375].map((width) => ({ name: `${name} (${width})`, run: (t) => run(t, width) }));

export default [
  ...both('Monday after Sunday in the week strip shows Monday', async (t, width) => {
    const app = await t.open({ state: core(), width, now: '2026-11-03T08:00:00' });
    await expectDay(app, { wd: 'Tue', month: 'November', day: 3, rows: TUESDAY });
    await app.tap(app.weekDay(1));
    await expectDay(app, { wd: 'Sun', month: 'November', day: 1, rows: SUNDAY });
    await app.tap(app.weekDay(2));
    await expectDay(app, { wd: 'Mon', month: 'November', day: 2, rows: MONDAY });
    app.assertNoErrors();
  }),

  ...both('the arrows step one day at a time, across the start of a week', async (t, width) => {
    const app = await t.open({ state: core(), width, now: '2026-11-03T08:00:00' });
    await app.tap(app.weekDay(1));
    await app.tap(app.button('Previous day'));
    await expectDay(app, { wd: 'Sat', month: 'October', day: 31 });
    assert.ok(await app.weekDay(31).count(), 'the week strip moved to the week of Oct 25');
    await app.tap(app.button('Next day'));
    await expectDay(app, { wd: 'Sun', month: 'November', day: 1, rows: SUNDAY });
    await app.tap(app.button('Next day'));
    await expectDay(app, { wd: 'Mon', month: 'November', day: 2, rows: MONDAY });
    app.assertNoErrors();
  }),

  ...both('the month calendar selects the day tapped', async (t, width) => {
    const app = await t.open({ state: core(), width, now: '2026-11-03T08:00:00' });
    if (app.phone) await app.tap(app.page.getByRole('button', { name: /▼/ }));
    await app.tap(app.calendarDay(1));
    if (app.phone) assert.equal(await app.calendarDay(2).count(), 0, 'the month sheet closes after a day is picked');
    await expectDay(app, { wd: 'Sun', month: 'November', day: 1, rows: SUNDAY });
    if (app.phone) await app.tap(app.page.getByRole('button', { name: /▼/ }));
    await app.tap(app.calendarDay(2));
    await expectDay(app, { wd: 'Mon', month: 'November', day: 2, rows: MONDAY });
    app.assertNoErrors();
  }),

  ...both('Today brings a chosen day back to today', async (t, width) => {
    const app = await t.open({ state: core(), width, now: '2026-11-03T08:00:00' });
    await app.tap(app.weekDay(1));
    await app.tap(app.button('Back to today'));
    await expectDay(app, { wd: 'Tue', month: 'November', day: 3, rows: TUESDAY });
    assert.equal(await app.button('Back to today').count(), 0, 'the Today link hides on today');
    app.assertNoErrors();
  }),

  ...both('left open overnight, Today turns over to the new day', async (t, width) => {
    const app = await t.open({ state: core(), width, now: '2026-11-01T23:58:00' });
    await expectDay(app, { wd: 'Sun', month: 'November', day: 1, rows: SUNDAY });
    await app.later('05:00');
    await expectDay(app, { wd: 'Mon', month: 'November', day: 2, rows: MONDAY });
    await app.later('08:00:00');
    await expectDay(app, { wd: 'Mon', month: 'November', day: 2, rows: MONDAY });
    app.assertNoErrors();
  }),

  {
    name: 'a day chosen on purpose stays chosen when midnight passes',
    run: async (t) => {
      const app = await t.open({ state: core(), now: '2026-11-01T23:58:00' });
      await app.tap(app.button('Previous day'));
      await expectDay(app, { wd: 'Sat', month: 'October', day: 31 });
      await app.later('05:00');
      await expectDay(app, { wd: 'Sat', month: 'October', day: 31 });
      app.assertNoErrors();
    },
  },

  {
    name: 'after midnight, a check is saved to the new day, not yesterday',
    run: async (t) => {
      const app = await t.open({ state: core(), width: 375, now: '2026-11-01T23:58:00' });
      await app.later('05:00');
      await app.tap(app.page.locator('[data-habit-row="Cycling"]'));
      const saved = await app.stored();
      assert.equal(saved.completions['2026-11-02']?.cycling, true);
      assert.equal(saved.completions['2026-11-01']?.cycling, undefined);
      app.assertNoErrors();
    },
  },

  ...both('a habit checks and unchecks, and the check survives a reload', async (t, width) => {
    const app = await t.open({ state: core(), width, now: '2026-11-03T08:00:00' });
    const row = app.page.locator('[data-habit-row="Meditate"]');
    await app.tap(row);
    assert.deepEqual((await app.habitRows()).find((r) => r.text === 'Meditate'), { text: 'Meditate', checked: true });
    assert.equal((await app.stored()).completions['2026-11-03'].meditate, true);
    await app.reload();
    assert.equal((await app.habitRows()).find((r) => r.text === 'Meditate').checked, true, 'still checked after a reload');
    await app.tap(row);
    assert.equal((await app.habitRows()).find((r) => r.text === 'Meditate').checked, false);
    assert.equal(Boolean((await app.stored()).completions['2026-11-03'].meditate), false);
    app.assertNoErrors();
  }),

  {
    name: 'a habit can be checked from the keyboard',
    run: async (t) => {
      const app = await t.open({ state: core(), now: '2026-11-03T08:00:00' });
      await app.page.locator('[data-habit-row="Push Day"]').focus();
      await app.press('Space');
      assert.equal((await app.habitRows()).find((r) => r.text === 'Push Day').checked, true);
      await app.press('Enter');
      assert.equal((await app.habitRows()).find((r) => r.text === 'Push Day').checked, false);
      app.assertNoErrors();
    },
  },

  ...both('checking every habit completes the day', async (t, width) => {
    const app = await t.open({ state: core(), width, now: '2026-11-03T08:00:00' });
    for (const text of TUESDAY) await app.tap(app.page.locator(`[data-habit-row="${text}"]`));
    const shown = await app.shownDay();
    assert.match(shown.louver, /7 of 7 habits done/);
    await app.assertNoHorizontalScroll('on a completed day');
    app.assertNoErrors();
  }),
];
