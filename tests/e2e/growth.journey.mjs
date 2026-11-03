// Growth: a habit that has held is offered its next step on Today (only once the day is done) and
// in its editor; a heavy one is offered a lighter step or a rest. Begin tomorrow, Not yet, the
// Settings switch, the top of the minutes ladder, and a next step written ahead under "Grows into".
// Every journey starts on the owner's core list, begun Sun Sep 20, on Tue Nov 3, 08:00 in Los Angeles.
import { assert, stateWith, coreHabits } from './harness.mjs';

const SINCE = '2026-09-20';
const both = (name, run) => [1440, 375].map((width) => ({ name: `${name} (${width})`, run: (t) => run(t, width) }));

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// The listed habits checked on each day they were scheduled from `from` to `to`, as the app saves them.
function keptScheduled(habits, from, to, ids) {
  const out = {};
  for (let d = new Date(`${from}T12:00:00`); d <= new Date(`${to}T12:00:00`); d.setDate(d.getDate() + 1)) {
    const on = habits.filter((h) => ids.includes(h.id) && (h.recurrence.type === 'daily' || h.recurrence.days.includes(d.getDay()))).map((h) => h.id);
    if (on.length) out[dateKey(d)] = Object.fromEntries(on.map((id) => [id, true]));
  }
  return out;
}
const merge = (...maps) => {
  const out = {};
  for (const m of maps) for (const [k, v] of Object.entries(m)) out[k] = { ...(out[k] || {}), ...v };
  return out;
};
const ALL = ['cycling', 'push', 'pull', 'leg', 'rest', 'walk', 'study1', 'study2', 'meditate', 'read', 'water', 'diet'];

// The core list since Sep 20, with `held` kept every day it was due until yesterday, Study 1 Hour
// kept since Oct 5 when `study` is set (ready too, but held for less time), and yesterday a full day.
function held(ids, { study = false, settings = {}, until = '2026-11-02' } = {}) {
  const habits = coreHabits(SINCE);
  return stateWith({
    habits,
    completions: merge(
      keptScheduled(habits, SINCE, until, ids),
      study ? keptScheduled(habits, '2026-10-05', until, ['study1']) : {},
      keptScheduled(habits, until, until, ALL),
    ),
    settings,
  });
}

// What Today lists: each row's name, its minutes, and whether it is checked.
const rows = (app) => app.page.evaluate(() => [...document.querySelectorAll('[data-habit-row]')].map((r) => ({
  text: r.getAttribute('data-habit-row'),
  minutes: [...r.querySelectorAll('span')].map((s) => s.textContent.trim()).find((x) => /^\d+ min$/.test(x)) || null,
  checked: r.getAttribute('aria-checked') === 'true',
})));
const row = async (app, text) => (await rows(app)).find((r) => r.text === text) || null;
const rowAt = (app, text) => app.page.locator(`[data-habit-row="${text}"]`);
const check = async (app, texts) => { for (const text of texts) await app.tap(rowAt(app, text)); };
// Check every habit still open today.
async function completeDay(app) {
  for (const r of await rows(app)) if (!r.checked) await app.tap(rowAt(app, r.text));
  assert.match((await app.shownDay()).louver || '', /(\d+) of \1 habits done/, 'the day is done');
}

// The Next step block on Today: its offer sentence, or the line once a step is set.
const offerLine = (app) => app.page.locator('p').filter({ hasText: 'has held for' });
const setLine = (app) => app.page.locator('p').filter({ hasText: /^Set\. Tomorrow,/ });
const words = async (loc) => ((await loc.count()) ? (await loc.first().textContent()).replace(/\s+/g, ' ').trim() : null);
async function expectNoNextStep(app, why) {
  assert.equal(await app.page.getByText('Next step', { exact: true }).count(), 0, `no Next step block ${why}`);
  assert.equal(await app.button('Begin tomorrow').count(), 0, `no Begin tomorrow ${why}`);
}
async function expectOffer(app, sentence) {
  await app.page.getByText('Next step', { exact: true }).waitFor({ timeout: 3000 });
  const said = await words(offerLine(app));
  if (sentence instanceof RegExp) assert.match(said || '', sentence);
  else assert.equal(said, sentence);
  assert.ok(await app.button('Begin tomorrow').isVisible(), 'Begin tomorrow is offered');
  assert.ok(await app.button('Not yet').isVisible(), 'Not yet is offered');
}

const dialog = (app, name) => app.page.getByRole('dialog', { name });
const inDialog = (app, name, button) => dialog(app, name).getByRole('button', { name: button, exact: true });
// The phone's bottom bar buttons read "○ Today" and so on; the desktop tabs are the bare word.
const navButton = (app, name) => (app.phone ? app.page.getByRole('button', { name: new RegExp(`${name}$`) }).first() : app.button(name));
const manageRow = (app, name) => app.page.locator('div')
  .filter({ has: app.page.getByRole('button', { name, exact: true }) })
  .filter({ has: app.page.getByRole('button', { name: /^(Edit|Archive|Restore|Bring back)$/ }) })
  .last();

async function goToday(app) {
  await app.tap(navButton(app, 'Today'));
  await app.page.locator('[data-week-day]').first().waitFor();
}
// The editor of a habit: from the row's Edit on desktop Today, from Settings → Manage Habits on the phone.
async function openEditor(app, name) {
  if (app.phone) {
    await app.tap(navButton(app, 'Settings'));
    await app.tap(inDialog(app, 'Settings', 'Manage Habits'));
    await app.page.getByText('Manage habits', { exact: true }).waitFor();
    await app.assertNoHorizontalScroll('on Manage Habits');
    await app.tap(manageRow(app, name).getByRole('button', { name: 'Edit', exact: true }));
  } else {
    await app.tap(app.button(`Edit ${name}`));
  }
  await dialog(app, 'Edit habit').waitFor();
  if (app.phone) await app.assertNoHorizontalScroll('in the editor');
}
const editor = (app) => dialog(app, 'Edit habit');
const invitation = (app) => editor(app).locator('p').filter({ hasText: /^(Steady for|This one has been heavy)/ });
const nameField = (app) => editor(app).getByPlaceholder('Habit name');
const minutesField = (app) => editor(app).getByPlaceholder('—');
const growsInto = (app) => editor(app).getByPlaceholder(/next step \(optional\)|And after that\?/);
const editorNote = (app) => editor(app).locator('p').filter({ hasText: /^Saves as stage/ });

async function setOffers(app, on) {
  await app.tap(navButton(app, 'Settings'));
  const sw = dialog(app, 'Settings').getByRole('switch', { name: 'Offer a next step on Today' });
  if ((await sw.getAttribute('aria-checked')) !== String(on)) await app.tap(sw);
  assert.equal(await sw.getAttribute('aria-checked'), String(on), 'the switch shows the choice');
  if (app.phone) await app.assertNoHorizontalScroll('in Settings');
  await app.tap(inDialog(app, 'Settings', 'Save Settings'));
  assert.equal(await dialog(app, 'Settings').count(), 0, 'Settings closes on save');
}

const storedHabit = async (app, id) => (await app.stored()).habits.find((h) => h.id === id);
const terms = (st) => ({ from: st.from, text: st.text, durationMinutes: st.durationMinutes });
const color = (loc) => loc.evaluate((e) => {
  let bg = 'rgba(0, 0, 0, 0)';
  for (let n = e; n && bg === 'rgba(0, 0, 0, 0)'; n = n.parentElement) bg = getComputedStyle(n).backgroundColor;
  return { ink: getComputedStyle(e).color, bg };
});
const DARK_BG = 'rgb(10, 10, 10)';
const lightInk = (rgb) => Number(/\d+/.exec(rgb)[0]) >= 150;

const TUESDAY = ['Push Day', '5K Walk', 'Study 1 Hour', 'Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet'];

export default [
  ...both('a habit kept six weeks is offered its next step on Today, and only once the day is done', async (t, width) => {
    const app = await t.open({ state: held(['read']), width });
    assert.deepEqual((await rows(app)).map((r) => r.text), TUESDAY);
    await expectNoNextStep(app, 'before anything is checked');
    // 6 of 7 is the 80% that completes a Tuesday; five is not yet.
    await check(app, TUESDAY.slice(0, 5));
    await expectNoNextStep(app, 'with five of seven checked');
    await check(app, [TUESDAY[5]]);
    await expectOffer(app, 'Read 30 min has held for six weeks. Next: Read 35 min.');
    if (app.phone) await app.assertNoHorizontalScroll('with the next step offered');
    // Unchecking undoes the day, and the offer goes with it.
    await app.tap(rowAt(app, 'Drink 3L Water'));
    await expectNoNextStep(app, 'once the day is no longer done');
    await app.tap(rowAt(app, 'Drink 3L Water'));
    await expectOffer(app, 'Read 30 min has held for six weeks. Next: Read 35 min.');
    // Yesterday was a full day too, but offers are for today only.
    await app.tap(app.button('Previous day'));
    assert.match((await app.shownDay()).louver, /7 of 7 habits done/);
    await expectNoNextStep(app, 'on yesterday, a done day');
    app.assertNoErrors();
  }),

  ...both('Begin tomorrow keeps today as it is, says what tomorrow brings, and tomorrow is the next step', async (t, width) => {
    const app = await t.open({ state: held(['read']), width });
    await completeDay(app);
    await expectOffer(app, 'Read 30 min has held for six weeks. Next: Read 35 min.');
    await app.tap(app.button('Begin tomorrow'));
    assert.equal(await app.button('Begin tomorrow').count(), 0, 'the offer is answered');
    assert.equal(await words(setLine(app)), 'Set. Tomorrow, Read 35 min.');
    assert.deepEqual(await row(app, 'Read 30 min'), { text: 'Read 30 min', minutes: '30 min', checked: true }, 'today keeps Read 30 min, checked');
    assert.match((await app.shownDay()).louver, /7 of 7 habits done/, 'today\'s score does not move');
    const saved = await storedHabit(app, 'read');
    assert.deepEqual(saved.stages.map(terms), [
      { from: SINCE, text: 'Read 30 min', durationMinutes: 30 },
      { from: '2026-11-04', text: 'Read 35 min', durationMinutes: 35 },
    ]);
    if (app.phone) await app.assertNoHorizontalScroll('with the step set');
    // Tomorrow is the next step.
    await app.tap(app.button('Next day'));
    assert.equal((await app.shownDay()).weekday, 'Wed');
    assert.deepEqual(await row(app, 'Read 35 min'), { text: 'Read 35 min', minutes: '35 min', checked: false });
    assert.equal(await row(app, 'Read 30 min'), null);
    // The past is unchanged.
    await app.tap(app.button('Previous day'));
    await app.tap(app.button('Previous day'));
    assert.equal((await app.shownDay()).weekday, 'Mon');
    assert.deepEqual(await row(app, 'Read 30 min'), { text: 'Read 30 min', minutes: '30 min', checked: true });
    // It survives a reload, and the line still says what tomorrow brings.
    await app.reload();
    assert.equal(await words(setLine(app)), 'Set. Tomorrow, Read 35 min.');
    assert.deepEqual(await row(app, 'Read 30 min'), { text: 'Read 30 min', minutes: '30 min', checked: true });
    if (app.phone) {
      // Manage Habits lists it as it is today, and what tomorrow brings.
      await app.tap(navButton(app, 'Settings'));
      await app.tap(inDialog(app, 'Settings', 'Manage Habits'));
      await app.page.getByText('Manage habits', { exact: true }).waitFor();
      const meta = await app.page.getByRole('button', { name: 'Read 30 min', exact: true }).evaluate((b) => b.parentElement.nextElementSibling.textContent.trim());
      assert.match(meta, /30 min · tomorrow: Read 35 min$/);
      await app.assertNoHorizontalScroll('on Manage Habits with a step set');
    }
    app.assertNoErrors();
  }),

  {
    name: 'after a step begins, no other habit is offered one for a week; a week on, the next one is',
    run: async (t) => {
      // Study 1 Hour has held too, since Oct 5; Read has held longer, so Read is offered first.
      const app = await t.open({ state: held(['read'], { study: true }) });
      await completeDay(app);
      await expectOffer(app, 'Read 30 min has held for six weeks. Next: Read 35 min.');
      await app.tap(app.button('Begin tomorrow'));
      const afterStep = await app.stored();
      // Both kept every day since, as before.
      const habits = afterStep.habits;
      const kept = (to) => ({ ...afterStep, completions: merge(afterStep.completions, keptScheduled(habits, '2026-11-04', to, ['read', 'study1'])) });

      const monday = await t.open({ state: kept('2026-11-08'), now: '2026-11-09T19:00:00' });
      assert.deepEqual(await row(monday, 'Read 35 min'), { text: 'Read 35 min', minutes: '35 min', checked: false }, 'a later day has the step');
      await completeDay(monday);
      await expectNoNextStep(monday, 'five days after Read took a step, though Study has held');

      const wednesday = await t.open({ state: kept('2026-11-10'), now: '2026-11-11T19:00:00' });
      await completeDay(wednesday);
      await expectOffer(wednesday, /^Study 1 Hour has held for \w+ weeks\. Next: Study 75 min\.$/);
      app.assertNoErrors();
      monday.assertNoErrors();
      wednesday.assertNoErrors();
    },
  },

  {
    name: 'left open at midnight after Begin tomorrow, the new day is the next step',
    run: async (t) => {
      const app = await t.open({ state: held(['read']), now: '2026-11-03T23:50:00' });
      await completeDay(app);
      await app.tap(app.button('Begin tomorrow'));
      assert.equal(await words(setLine(app)), 'Set. Tomorrow, Read 35 min.');
      await app.later('15:00');
      assert.equal((await app.shownDay()).weekday, 'Wed');
      assert.deepEqual(await row(app, 'Read 35 min'), { text: 'Read 35 min', minutes: '35 min', checked: false });
      await expectNoNextStep(app, 'on a new day not yet done');
      app.assertNoErrors();
    },
  },

  ...both('Not yet puts the offer away and keeps Today quiet for a week', async (t, width) => {
    const app = await t.open({ state: held(['read'], { study: true }), width });
    await completeDay(app);
    await expectOffer(app, 'Read 30 min has held for six weeks. Next: Read 35 min.');
    await app.tap(app.button('Not yet'));
    await expectNoNextStep(app, 'after Not yet');
    const saved = await app.stored();
    assert.deepEqual(saved.habits.find((h) => h.id === 'read').stages.map(terms), [{ from: SINCE, text: 'Read 30 min', durationMinutes: 30 }], 'Read is unchanged');
    assert.equal(saved.habits.find((h) => h.id === 'read').growth?.snoozeUntil, '2026-12-01', 'Read is asked again in four weeks');
    await app.reload();
    await expectNoNextStep(app, 'after Not yet and a reload');
    if (app.phone) await app.assertNoHorizontalScroll('after Not yet');
    app.assertNoErrors();
    if (app.phone) return; // the days after are the same at either width

    const kept = (to) => ({ ...saved, completions: merge(saved.completions, keptScheduled(saved.habits, '2026-11-03', to, ['read', 'study1'])) });
    // Friday: Study 1 Hour has held, but Today stays quiet.
    const friday = await t.open({ state: kept('2026-11-05'), now: '2026-11-06T19:00:00' });
    await completeDay(friday);
    await expectNoNextStep(friday, 'three days after Not yet');
    friday.assertNoErrors();
    // Eight days on, an offer can return: Study, not Read, which was asked to wait four weeks.
    const later = await t.open({ state: kept('2026-11-10'), now: '2026-11-11T19:00:00' });
    await completeDay(later);
    await expectOffer(later, /^Study 1 Hour has held for \w+ weeks\. Next: Study 75 min\.$/);
    later.assertNoErrors();
  }),

  ...both('with next-step offers off in Settings, Today offers nothing; the editor still does; on again, they return', async (t, width) => {
    const app = await t.open({ state: held(['read']), width });
    await setOffers(app, false);
    assert.equal((await app.stored()).settings.offerSteps, false);
    await completeDay(app);
    await expectNoNextStep(app, 'with offers off');
    // Off, a step is still offered in the habit's own editor.
    await openEditor(app, 'Read 30 min');
    assert.equal(await words(invitation(app)), 'Steady for six weeks. Next: Read 35 min.');
    await app.press('Escape');
    assert.equal(await editor(app).count(), 0);
    if (app.phone) await goToday(app);
    await app.reload();
    await expectNoNextStep(app, 'with offers off, after a reload');
    await setOffers(app, true);
    assert.equal((await app.stored()).settings.offerSteps, true);
    await expectOffer(app, 'Read 30 min has held for six weeks. Next: Read 35 min.');
    app.assertNoErrors();
  }),

  ...both('in the editor, Raise a step fills in the next step and Save makes it a new stage from today', async (t, width) => {
    const app = await t.open({ state: held(['read']), width });
    await openEditor(app, 'Read 30 min');
    assert.equal(await words(invitation(app)), 'Steady for six weeks. Next: Read 35 min.');
    assert.equal(await editorNote(app).count(), 0, 'nothing says it will save a stage before a step is taken');
    await app.tap(inDialog(app, 'Edit habit', 'Raise a step'));
    assert.equal(await invitation(app).count(), 0, 'the invitation steps aside once taken');
    assert.equal(await nameField(app).inputValue(), 'Read 35 min');
    assert.equal(await minutesField(app).inputValue(), '35');
    assert.equal(await words(editorNote(app)), 'Saves as stage II, from today. The days before keep stage I.');
    await app.tap(inDialog(app, 'Edit habit', 'Save'));
    assert.equal(await editor(app).count(), 0, 'Save closes the editor');
    assert.deepEqual((await storedHabit(app, 'read')).stages.map(terms), [
      { from: SINCE, text: 'Read 30 min', durationMinutes: 30 },
      { from: '2026-11-03', text: 'Read 35 min', durationMinutes: 35 },
    ]);
    if (app.phone) await goToday(app);
    assert.deepEqual(await row(app, 'Read 35 min'), { text: 'Read 35 min', minutes: '35 min', checked: false });
    await app.tap(app.button('Previous day'));
    assert.deepEqual(await row(app, 'Read 30 min'), { text: 'Read 30 min', minutes: '30 min', checked: true }, 'yesterday keeps Read 30 min');
    await app.tap(app.button('Back to today'));
    // A step was just taken: Today offers nothing more, even with the day done.
    await completeDay(app);
    await expectNoNextStep(app, 'the day a step was taken in the editor');
    app.assertNoErrors();
  }),

  {
    name: 'Raise a step, then Escape, saves nothing, and the editor offers the step again',
    run: async (t) => {
      const app = await t.open({ state: held(['read']) });
      await openEditor(app, 'Read 30 min');
      await app.tap(inDialog(app, 'Edit habit', 'Raise a step'));
      await app.press('Escape');
      assert.equal(await editor(app).count(), 0, 'Escape closes the editor');
      assert.equal((await storedHabit(app, 'read')).stages.length, 1, 'no stage was saved');
      assert.deepEqual(await row(app, 'Read 30 min'), { text: 'Read 30 min', minutes: '30 min', checked: false });
      await openEditor(app, 'Read 30 min');
      assert.equal(await nameField(app).inputValue(), 'Read 30 min');
      assert.equal(await words(invitation(app)), 'Steady for six weeks. Next: Read 35 min.');
      await app.press('Escape');
      app.assertNoErrors();
    },
  },

  {
    name: 'Not yet in the editor closes it, and the habit is not offered again for four weeks (375)',
    run: async (t) => {
      const app = await t.open({ state: held(['read']), width: 375 });
      await openEditor(app, 'Read 30 min');
      await app.tap(inDialog(app, 'Edit habit', 'Not yet'));
      assert.equal(await editor(app).count(), 0, 'Not yet closes the editor');
      assert.equal((await storedHabit(app, 'read')).growth?.snoozeUntil, '2026-12-01');
      await app.tap(manageRow(app, 'Read 30 min').getByRole('button', { name: 'Edit', exact: true }));
      await editor(app).waitFor();
      assert.equal(await invitation(app).count(), 0, 'no invitation while it waits');
      await app.press('Escape');
      await goToday(app);
      await completeDay(app);
      await expectNoNextStep(app, 'for a habit asked to wait');
      app.assertNoErrors();
    },
  },

  ...both('a habit kept 3 of its last 8 times is offered a lighter step or a rest, in the editor only', async (t, width) => {
    const habits = coreHabits(SINCE);
    const state = stateWith({
      habits,
      completions: merge(
        keptScheduled(habits, SINCE, '2026-10-23', ['read']),
        keptScheduled(habits, '2026-10-27', '2026-10-27', ['read']),
        keptScheduled(habits, '2026-10-30', '2026-10-30', ['read']),
        keptScheduled(habits, '2026-11-02', '2026-11-02', ALL),
      ),
    });
    const app = await t.open({ state, width });
    // Today never presses a heavy habit.
    await check(app, TUESDAY.filter((x) => x !== 'Read 30 min'));
    await expectNoNextStep(app, 'for a heavy habit');
    await app.tap(rowAt(app, 'Drink 3L Water')); // back to 5 of 7
    await openEditor(app, 'Read 30 min');
    assert.equal(await words(invitation(app)), 'This one has been heavy lately. Lighter: Read 20 min.');
    assert.ok(await inDialog(app, 'Edit habit', 'Rest it').isVisible(), 'Rest it is offered');
    assert.ok(await inDialog(app, 'Edit habit', 'Keep as it is').isVisible(), 'Keep as it is is offered');
    if (!app.phone) {
      await app.tap(inDialog(app, 'Edit habit', 'Take a lighter step'));
      assert.equal(await nameField(app).inputValue(), 'Read 20 min');
      assert.equal(await minutesField(app).inputValue(), '20');
      assert.equal(await words(editorNote(app)), 'Saves as stage II, from today. The days before keep stage I.');
      await app.tap(inDialog(app, 'Edit habit', 'Save'));
      assert.deepEqual((await storedHabit(app, 'read')).stages.map(terms).at(-1), { from: '2026-11-03', text: 'Read 20 min', durationMinutes: 20 });
      assert.deepEqual(await row(app, 'Read 20 min'), { text: 'Read 20 min', minutes: '20 min', checked: false });
    } else {
      await app.tap(inDialog(app, 'Edit habit', 'Rest it'));
      await app.tap(inDialog(app, 'Edit habit', 'A week'));
      assert.equal(await editor(app).count(), 0, 'choosing a rest closes the editor');
      const st = (await storedHabit(app, 'read')).stages.at(-1);
      assert.deepEqual({ from: st.from, rest: st.rest, until: st.until }, { from: '2026-11-03', rest: true, until: '2026-11-10' });
      await goToday(app);
      assert.equal(await row(app, 'Read 30 min'), null, 'Read rests, off Today');
      await app.assertNoHorizontalScroll('with Read resting');
    }
    app.assertNoErrors();
  }),

  ...both('Rest it, in a heavy habit\'s editor, brings the rest choices into view', async (t, width) => {
    const habits = coreHabits(SINCE);
    const state = stateWith({ habits, completions: merge(keptScheduled(habits, SINCE, '2026-10-23', ['read']), keptScheduled(habits, '2026-10-30', '2026-10-30', ['read'])) });
    const app = await t.open({ state, width });
    await openEditor(app, 'Read 30 min');
    await app.tap(inDialog(app, 'Edit habit', 'Rest it'));
    const choice = await inDialog(app, 'Edit habit', 'A week').evaluate((e) => {
      const r = e.getBoundingClientRect();
      let box = { top: 0, bottom: window.innerHeight };
      for (let n = e.parentElement; n; n = n.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight) {
          const s = n.getBoundingClientRect();
          box = { top: Math.max(box.top, s.top), bottom: Math.min(box.bottom, s.bottom) };
        }
      }
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), seen: box };
    });
    assert.ok(choice.top >= choice.seen.top && choice.bottom <= choice.seen.bottom,
      `after Rest it, the rest choices are on screen (A week spans ${choice.top}-${choice.bottom}px; the editor shows ${Math.round(choice.seen.top)}-${Math.round(choice.seen.bottom)}px)`);
    app.assertNoErrors();
  }),

  {
    name: 'Keep as it is, for a heavy habit, closes the editor and asks again in two weeks',
    run: async (t) => {
      const habits = coreHabits(SINCE);
      const state = stateWith({ habits, completions: merge(keptScheduled(habits, SINCE, '2026-10-23', ['read']), keptScheduled(habits, '2026-10-30', '2026-10-30', ['read'])) });
      const app = await t.open({ state });
      await openEditor(app, 'Read 30 min');
      assert.match(await words(invitation(app)), /^This one has been heavy lately\./);
      await app.tap(inDialog(app, 'Edit habit', 'Keep as it is'));
      assert.equal(await editor(app).count(), 0);
      assert.equal((await storedHabit(app, 'read')).growth?.snoozeUntil, '2026-11-17');
      assert.equal((await storedHabit(app, 'read')).stages.length, 1, 'kept as it is');
      await openEditor(app, 'Read 30 min');
      assert.equal(await invitation(app).count(), 0, 'not asked again yet');
      await app.press('Escape');
      app.assertNoErrors();
    },
  },

  {
    name: 'Study 1 Hour grows to Study 75 min, from tomorrow (375)',
    run: async (t) => {
      const app = await t.open({ state: held(['study1']), width: 375 });
      await completeDay(app);
      await expectOffer(app, 'Study 1 Hour has held for six weeks. Next: Study 75 min.');
      await app.tap(app.button('Begin tomorrow'));
      assert.equal(await words(setLine(app)), 'Set. Tomorrow, Study 75 min.');
      assert.deepEqual(await row(app, 'Study 1 Hour'), { text: 'Study 1 Hour', minutes: '60 min', checked: true });
      await app.tap(app.button('Next day'));
      assert.deepEqual(await row(app, 'Study 75 min'), { text: 'Study 75 min', minutes: '75 min', checked: false });
      await app.assertNoHorizontalScroll('on the day Study grows');
      app.assertNoErrors();
    },
  },

  {
    name: 'Study 2 Hours, at the top, is never offered more, on Today or in the editor',
    run: async (t) => {
      const app = await t.open({ state: held(['study2'], { until: '2026-11-04' }), now: '2026-11-05T19:00:00' });
      assert.equal((await app.shownDay()).weekday, 'Thu');
      await completeDay(app);
      await expectNoNextStep(app, 'for a habit at two hours');
      await openEditor(app, 'Study 2 Hours');
      assert.equal(await invitation(app).count(), 0, 'the editor offers nothing more');
      assert.equal(await inDialog(app, 'Edit habit', 'Raise a step').count(), 0);
      await app.press('Escape');
      app.assertNoErrors();
    },
  },

  ...both('a next step written under Grows into is the one offered, with its own minutes', async (t, width) => {
    const app = await t.open({ state: held(['meditate']), width });
    // Meditate has no minutes, so nothing is offered until a step is written for it.
    await openEditor(app, 'Meditate');
    assert.equal(await invitation(app).count(), 0);
    await app.tap(growsInto(app));
    await app.type('Meditate 10 min');
    await app.tap(inDialog(app, 'Edit habit', 'Save'));
    const saved = await storedHabit(app, 'meditate');
    assert.equal(saved.next, 'Meditate 10 min');
    assert.equal(saved.stages.length, 1, 'writing a next step is not a step');
    if (app.phone) await goToday(app);
    await completeDay(app);
    await expectOffer(app, 'Meditate has held for six weeks. Next: Meditate 10 min.');
    await app.tap(app.button('Begin tomorrow'));
    assert.equal(await words(setLine(app)), 'Set. Tomorrow, Meditate 10 min.');
    const grown = await storedHabit(app, 'meditate');
    assert.deepEqual(grown.stages.map(terms).at(-1), { from: '2026-11-04', text: 'Meditate 10 min', durationMinutes: 10 });
    assert.equal(grown.next, undefined, 'the written step is used up');
    await app.tap(app.button('Next day'));
    assert.deepEqual(await row(app, 'Meditate 10 min'), { text: 'Meditate 10 min', minutes: '10 min', checked: false });
    if (app.phone) await app.assertNoHorizontalScroll('on the day Meditate grows');
    app.assertNoErrors();
  }),

  {
    name: 'a next step written in hours brings its hours: Study 2 Hours grows into Study 3 Hours, 180 min',
    run: async (t) => {
      const app = await t.open({ state: held(['study2'], { until: '2026-11-04' }), now: '2026-11-05T19:00:00' });
      await openEditor(app, 'Study 2 Hours');
      await app.tap(growsInto(app));
      await app.type('Study 3 Hours');
      await app.tap(inDialog(app, 'Edit habit', 'Save'));
      await completeDay(app);
      await expectOffer(app, /^Study 2 Hours has held for \w+ weeks\. Next: Study 3 Hours\.$/);
      await app.tap(app.button('Begin tomorrow'));
      await app.tap(app.button('Next day'));
      assert.equal((await app.shownDay()).weekday, 'Fri');
      assert.deepEqual(await row(app, 'Study 3 Hours'), { text: 'Study 3 Hours', minutes: '180 min', checked: false }, 'three hours is 180 minutes');
      assert.equal((await storedHabit(app, 'study2')).durationMinutes, 180);
      app.assertNoErrors();
    },
  },

  {
    name: 'the next step can be found and begun from the keyboard',
    run: async (t) => {
      const app = await t.open({ state: held(['read']) });
      await rowAt(app, TUESDAY[0]).focus();
      for (const text of TUESDAY) {
        assert.equal(await app.page.evaluate(() => document.activeElement?.getAttribute('data-habit-row')), text);
        await app.press('Space');
        await app.press('Tab');
      }
      const focused = await app.page.evaluate(() => document.activeElement?.textContent.trim());
      assert.equal(focused, 'Begin tomorrow', 'Tab after the last habit reaches the offer');
      await app.press('Enter');
      assert.equal(await words(setLine(app)), 'Set. Tomorrow, Read 35 min.');
      assert.equal((await storedHabit(app, 'read')).stages.at(-1).from, '2026-11-04');
      app.assertNoErrors();
    },
  },

  {
    name: 'in dark mode the next step, its editor invitation and the Growth switch are light ink on a dark page (375)',
    run: async (t) => {
      const app = await t.open({ state: held(['read'], { settings: { darkMode: true } }), width: 375 });
      await completeDay(app);
      await expectOffer(app, 'Read 30 min has held for six weeks. Next: Read 35 min.');
      for (const loc of [offerLine(app), app.button('Begin tomorrow')]) {
        const c = await color(loc);
        assert.equal(c.bg, DARK_BG, 'a dark page');
        assert.ok(lightInk(c.ink), `light ink, not ${c.ink}`);
      }
      await app.assertNoHorizontalScroll('with the next step offered, dark');
      await app.tap(navButton(app, 'Settings'));
      const label = dialog(app, 'Settings').getByText('Offer a next step on Today', { exact: true });
      const c = await color(label);
      assert.ok(lightInk(c.ink) && c.bg !== 'rgb(255, 255, 255)', `Growth switch in dark: ${JSON.stringify(c)}`);
      await app.press('Escape');
      assert.equal(await dialog(app, 'Settings').count(), 0, 'Escape closes Settings');
      await openEditor(app, 'Read 30 min');
      const inv = await color(invitation(app));
      assert.ok(lightInk(inv.ink) && inv.bg !== 'rgb(255, 255, 255)', `invitation in dark: ${JSON.stringify(inv)}`);
      await app.tap(inDialog(app, 'Edit habit', 'Raise a step'));
      await app.tap(inDialog(app, 'Edit habit', 'Save'));
      await goToday(app);
      assert.deepEqual(await row(app, 'Read 35 min'), { text: 'Read 35 min', minutes: '35 min', checked: true });
      app.assertNoErrors();
    },
  },
];
