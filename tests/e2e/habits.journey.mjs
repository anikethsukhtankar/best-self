// Habits: adding, editing, archiving and resting them, Manage Habits, and a habit's own page.
// Every journey starts on the owner's core list (begun Oct 1) on Tue Nov 3, 08:00 in Los Angeles.
import { assert, stateWith, coreHabits, habit } from './harness.mjs';

const DAY = 864e5;
const M2S = [1, 2, 3, 4, 5, 6];
const TUESDAY = ['Push Day', '5K Walk', 'Study 1 Hour', 'Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet'];
const both = (name, run) => [1440, 375].map((width) => ({ name: `${name} (${width})`, run: (t) => run(t, width) }));

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Every habit checked on each day it was scheduled from `from` to `to`, as a person who kept them would have.
function keptScheduled(habits, from, to, { except = [] } = {}) {
  const out = {};
  for (let d = new Date(`${from}T12:00:00`); d <= new Date(`${to}T12:00:00`); d.setDate(d.getDate() + 1)) {
    const ids = habits.filter((h) => !except.includes(h.id) && (h.recurrence.type === 'daily' || h.recurrence.days.includes(d.getDay()))).map((h) => h.id);
    if (ids.length) out[dateKey(d)] = Object.fromEntries(ids.map((id) => [id, true]));
  }
  return out;
}
// The core list, kept every scheduled day from Oct 1 until yesterday.
const keptCore = ({ settings, except } = {}) => {
  const habits = coreHabits('2026-10-01');
  return stateWith({ habits, completions: keptScheduled(habits, '2026-10-01', '2026-11-02', { except }), settings });
};

// What Today lists, with the block each row sits under and its minutes.
const rows = (app) => app.page.evaluate(() => [...document.querySelectorAll('[data-habit-row]')].map((r) => ({
  text: r.getAttribute('data-habit-row'),
  block: r.parentElement.firstElementChild.textContent.trim(),
  minutes: [...r.querySelectorAll('span')].map((s) => s.textContent.trim()).find((x) => /^\d+ min$/.test(x)) || null,
  checked: r.getAttribute('aria-checked') === 'true',
})));
const names = async (app) => (await rows(app)).map((r) => r.text);
const row = async (app, text) => (await rows(app)).find((r) => r.text === text) || null;

async function tapAt(app, x, y) {
  if (app.phone) await app.page.touchscreen.tap(x, y);
  else await app.page.mouse.click(x, y);
  await app.wait(300);
}
// Select what is in a field and type over it.
async function retype(app, field, text) {
  await app.tap(field);
  await app.page.keyboard.press('Control+A');
  await app.page.keyboard.press('Backspace');
  await app.type(text);
}

const dialog = (app, name) => app.page.getByRole('dialog', { name });
const inDialog = (app, name, button) => dialog(app, name).getByRole('button', { name: button, exact: true });
// The phone's bottom bar buttons read "○ Today" and so on; the desktop tabs are the bare word.
const navButton = (app, name) => (app.phone ? app.page.getByRole('button', { name: new RegExp(`${name}$`) }).first() : app.button(name));
const prevDay = (app) => app.tap(app.button('Previous day'));
const nextDay = (app) => app.tap(app.button('Next day'));
const backToToday = (app) => app.tap(app.button('Back to today'));

async function openManage(app) {
  await app.tap(navButton(app, 'Settings'));
  await app.tap(inDialog(app, 'Settings', 'Manage Habits'));
  assert.equal(await dialog(app, 'Settings').count(), 0, 'Settings closes on the way to Manage Habits');
  await app.page.getByText('Manage habits', { exact: true }).waitFor();
  if (app.phone) await app.assertNoHorizontalScroll('on Manage Habits');
}
async function goToday(app) {
  await app.tap(navButton(app, 'Today'));
  await app.page.locator('[data-week-day]').first().waitFor();
}
// A habit's row in Manage Habits, its terms line, and the section it is listed under.
const nameButton = (app, name) => app.page.getByRole('button', { name, exact: true }).first();
const manageRow = (app, name) => app.page.locator('div')
  .filter({ has: app.page.getByRole('button', { name, exact: true }) })
  .filter({ has: app.page.getByRole('button', { name: /^(Edit|Archive|Restore|Bring back)$/ }) })
  .last();
const manageAction = (app, name, action) => manageRow(app, name).getByRole('button', { name: action, exact: true });
const manageMeta = (app, name) => nameButton(app, name).evaluate((b) => b.parentElement.nextElementSibling.textContent.trim());
const manageSection = (app, name) => nameButton(app, name).evaluate((b) => b.parentElement.parentElement.parentElement.parentElement.firstElementChild.textContent.trim());
const manageSections = (app) => app.page.evaluate(() => [...document.querySelectorAll('div')].filter((d) => /^(Morning|Pre-Work|Afternoon|Post-Work|Evening|Resting|Archived)$/.test(d.textContent.trim()) && d.children.length === 0).map((d) => d.textContent.trim()));

// Open the editor for an existing habit: from the row's Edit on desktop Today, from Manage Habits on the phone.
async function editFromToday(app, name) {
  if (app.phone) {
    await openManage(app);
    await app.tap(manageAction(app, name, 'Edit'));
  } else {
    await app.tap(app.button(`Edit ${name}`));
  }
  await dialog(app, 'Edit habit').waitFor();
}

// The Stages list on a habit's page: [numeral, terms, since (and "kept of due")] per row.
const pageStages = (app) => app.page.evaluate(() => {
  const label = [...document.querySelectorAll('div')].find((d) => d.textContent === 'Stages' && !d.children.length);
  const out = [];
  for (let n = label.nextElementSibling; n && n.tagName === 'DIV' && n.children.length === 3; n = n.nextElementSibling) out.push([...n.children].map((c) => c.textContent.trim()));
  return out;
});
const storedHabit = async (app, id) => (await app.stored()).habits.find((h) => h.id === id);
const color = (loc) => loc.evaluate((e) => {
  let bg = 'rgba(0, 0, 0, 0)';
  for (let n = e; n && bg === 'rgba(0, 0, 0, 0)'; n = n.parentElement) bg = getComputedStyle(n).backgroundColor;
  return { ink: getComputedStyle(e).color, bg };
});
const DARK = { ink: 'rgb(255, 255, 255)', bg: 'rgb(10, 10, 10)' };

export default [
  ...both('a new habit needs a name, and the editor says why it will not save', async (t, width) => {
    const app = await t.open({ state: keptCore(), width });
    await app.tap(app.button('New habit'));
    const editor = dialog(app, 'New habit');
    assert.ok(await editor.isVisible(), 'the New habit editor opens');
    assert.equal(await app.page.evaluate(() => document.activeElement?.getAttribute('placeholder')), 'Habit name', 'the name field has focus');
    if (app.phone) await app.assertNoHorizontalScroll('in the New habit editor');

    await app.tap(inDialog(app, 'New habit', 'Add habit'));
    assert.ok(await editor.isVisible(), 'an empty name does not save');
    assert.ok(await editor.getByText('Give the habit a name.').isVisible(), 'and the editor says why');

    await app.tap(app.page.getByPlaceholder('Habit name'));
    await app.type('   ');
    await app.press('Enter');
    assert.ok(await editor.isVisible(), 'spaces alone are not a name');
    assert.ok(await editor.getByText('Give the habit a name.').isVisible());

    await retype(app, app.page.getByPlaceholder('Habit name'), 'Stretch');
    await app.tap(inDialog(app, 'New habit', 'Specific days'));
    await app.tap(inDialog(app, 'New habit', 'Add habit'));
    assert.ok(await editor.getByText('Pick at least one day.').isVisible(), 'specific days need a day');
    await app.tap(inDialog(app, 'New habit', 'Every day'));
    await app.tap(app.page.getByPlaceholder('—'));
    await app.type('2000');
    await app.press('Enter');
    assert.ok(await editor.getByText('Duration is whole minutes, up to 1440.').isVisible(), 'a day has 1440 minutes');

    await app.press('Escape');
    assert.equal(await editor.count(), 0, 'Escape closes the editor');
    const saved = await app.stored();
    assert.equal(saved.habits.length, 12, 'nothing was added');
    assert.deepEqual(await names(app), TUESDAY);
    app.assertNoErrors();
  }),

  ...both('a new Mon, Wed and Fri evening habit with minutes, saved with Enter, shows only on its days from today on', async (t, width) => {
    const app = await t.open({ state: keptCore(), width });
    await app.tap(app.button('New habit'));
    await app.type('Stretch');
    await app.tap(inDialog(app, 'New habit', 'Evening'));
    await app.tap(inDialog(app, 'New habit', 'Specific days'));
    for (const d of ['Monday', 'Wednesday', 'Friday']) await app.tap(inDialog(app, 'New habit', d));
    for (const [d, on] of [['Monday', 'true'], ['Tuesday', 'false'], ['Wednesday', 'true'], ['Friday', 'true']]) {
      assert.equal(await inDialog(app, 'New habit', d).getAttribute('aria-pressed'), on, `${d} pressed`);
    }
    await app.tap(app.page.getByPlaceholder('—'));
    await app.type('15');
    await app.press('Enter');
    assert.equal(await dialog(app, 'New habit').count(), 0, 'Enter saves and closes the editor');

    const added = (await app.stored()).habits.find((h) => h.text === 'Stretch');
    assert.ok(added, 'saved');
    assert.equal(added.timeBlock, 'evening');
    assert.deepEqual(added.recurrence, { type: 'specific_days', days: [1, 3, 5] });
    assert.equal(added.durationMinutes, 15);
    assert.equal(added.stages[0].from, '2026-11-03', 'it begins today');

    assert.deepEqual(await names(app), TUESDAY, 'not on a Tuesday');
    await nextDay(app); // Wed Nov 4
    assert.deepEqual(await row(app, 'Stretch'), { text: 'Stretch', block: 'Evening', minutes: '15 min', checked: false }, 'on Wednesday, in the evening, 15 min');
    assert.equal((await names(app)).at(-1), 'Stretch', 'after the evening habits already there');
    await nextDay(app); // Thu
    assert.equal(await row(app, 'Stretch'), null, 'not on a Thursday');
    await nextDay(app); // Fri
    assert.ok(await row(app, 'Stretch'), 'on Friday');
    await backToToday(app);
    await prevDay(app); // Mon Nov 2, before it began
    assert.equal(await row(app, 'Stretch'), null, 'not on a Monday before it began');
    if (app.phone) await app.assertNoHorizontalScroll('on Today');

    await app.reload();
    await nextDay(app);
    assert.ok(await row(app, 'Stretch'), 'still there after a reload');
    app.assertNoErrors();
  }),

  {
    name: 'a habit added while looking at yesterday begins today, not on the day in view',
    run: async (t) => {
      const app = await t.open({ state: keptCore() });
      await prevDay(app); // Mon Nov 2
      await app.tap(app.button('New habit'));
      await app.type('Journal');
      await app.tap(inDialog(app, 'New habit', 'Add habit'));
      assert.equal(await dialog(app, 'New habit').count(), 0);
      assert.equal(await row(app, 'Journal'), null, 'not on yesterday');
      await backToToday(app);
      assert.deepEqual(await row(app, 'Journal'), { text: 'Journal', block: 'Morning', minutes: null, checked: false }, 'on today, in the morning');
      app.assertNoErrors();
    },
  },

  {
    name: 'a habit added today and corrected the same day changes in place, with no second stage (375)',
    run: async (t) => {
      const app = await t.open({ state: keptCore(), width: 375 });
      await app.tap(app.button('New habit'));
      await app.type('Stretch');
      await app.tap(inDialog(app, 'New habit', 'Add habit'));
      assert.ok(await row(app, 'Stretch'), 'a daily habit shows today');
      await openManage(app);
      await app.tap(manageAction(app, 'Stretch', 'Edit'));
      await app.tap(inDialog(app, 'Edit habit', 'Specific days'));
      await app.tap(inDialog(app, 'Edit habit', 'Monday'));
      assert.equal(await dialog(app, 'Edit habit').getByText(/^Saves as stage/).count(), 0, 'no new stage for a habit begun today');
      await app.tap(inDialog(app, 'Edit habit', 'Save'));
      assert.equal(await manageMeta(app, 'Stretch'), 'Mon');
      const saved = (await app.stored()).habits.find((h) => h.text === 'Stretch');
      assert.deepEqual(saved.stages.map((s) => [s.from, s.recurrence.days]), [['2026-11-03', [1]]], 'one stage, corrected');
      await goToday(app);
      assert.equal(await row(app, 'Stretch'), null, 'and it leaves today, a Tuesday');
      app.assertNoErrors();
    },
  },

  ...both('Escape, the backdrop and × each cancel a new habit without saving it', async (t, width) => {
    const app = await t.open({ state: keptCore(), width });
    const editor = dialog(app, 'New habit');
    await app.tap(app.button('New habit'));
    await app.type('Journal');
    await app.press('Escape');
    assert.equal(await editor.count(), 0, 'Escape closes it');

    await app.tap(app.button('New habit'));
    assert.equal(await app.page.getByPlaceholder('Habit name').inputValue(), '', 'a cancelled name does not come back');
    await app.type('Journal');
    await tapAt(app, 10, 400); // the backdrop beside the editor
    assert.equal(await editor.count(), 0, 'the backdrop closes it');

    await app.tap(app.button('New habit'));
    await app.type('Journal');
    await app.tap(inDialog(app, 'New habit', 'Close'));
    assert.equal(await editor.count(), 0, '× closes it');

    assert.equal((await app.stored()).habits.some((h) => h.text === 'Journal'), false, 'nothing was saved');
    assert.deepEqual(await names(app), TUESDAY);
    app.assertNoErrors();
  }),

  {
    name: 'a new habit can be added from the keyboard alone, and focus returns to +',
    run: async (t) => {
      const app = await t.open({ state: keptCore() });
      await app.button('New habit').focus();
      await app.press('Enter');
      assert.ok(await dialog(app, 'New habit').isVisible());
      await app.type('Floss');
      for (let i = 0; i < 5; i++) await app.press('Tab'); // Morning, Pre-Work, Afternoon, Post-Work, Evening
      assert.equal(await app.page.evaluate(() => document.activeElement?.textContent), 'Evening');
      await app.press('Space');
      await app.press('Tab'); // Every day
      await app.press('Tab'); // Specific days
      await app.press('Tab'); // minutes
      await app.type('2');
      await app.press('Enter');
      assert.equal(await dialog(app, 'New habit').count(), 0);
      assert.deepEqual(await row(app, 'Floss'), { text: 'Floss', block: 'Evening', minutes: '2 min', checked: false });
      assert.equal(await app.page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'New habit', 'focus is back on +');
      app.assertNoErrors();
    },
  },

  {
    name: 'Edit on a row changes a habit\'s name, days and minutes from today; the days before keep it as it was (1440)',
    run: async (t) => {
      const app = await t.open({ state: keptCore() });
      await app.tap(app.button('Edit Study 1 Hour'));
      const editor = dialog(app, 'Edit habit');
      assert.equal(await app.page.getByPlaceholder('Habit name').inputValue(), 'Study 1 Hour');
      await retype(app, app.page.getByPlaceholder('Habit name'), 'Deep Study');
      for (const d of ['Monday', 'Wednesday', 'Thursday']) await app.tap(inDialog(app, 'Edit habit', d));
      await retype(app, app.page.getByPlaceholder('—'), '90');
      assert.ok(await editor.getByText('Saves as stage II, from today. The days before keep stage I.').isVisible(), 'the editor says the change starts today');
      await app.tap(inDialog(app, 'Edit habit', 'Save'));
      assert.equal(await editor.count(), 0);

      assert.deepEqual(await row(app, 'Deep Study'), { text: 'Deep Study', block: 'Post-Work', minutes: '90 min', checked: false }, 'today has the new terms');
      assert.equal(await row(app, 'Study 1 Hour'), null);
      await prevDay(app); // Mon Nov 2
      assert.deepEqual(await row(app, 'Study 1 Hour'), { text: 'Study 1 Hour', block: 'Post-Work', minutes: '60 min', checked: true }, 'yesterday keeps the habit it had, and its check');
      assert.equal(await row(app, 'Deep Study'), null);
      await backToToday(app);
      await nextDay(app); // Wed: no longer a study day
      assert.equal(await row(app, 'Deep Study'), null, 'Wednesday is no longer one of its days');
      await nextDay(app); // Thu
      assert.ok(await row(app, 'Deep Study'), 'Thursday is');

      await openManage(app);
      assert.equal(await manageMeta(app, 'Deep Study'), 'Tue · Thu · 90 min', 'Manage Habits shows the new terms');
      const saved = await storedHabit(app, 'study1');
      assert.deepEqual(saved.stages.map((s) => [s.from, s.text, s.durationMinutes, s.recurrence.days]), [
        ['2026-10-01', 'Study 1 Hour', 60, [1, 2, 3]],
        ['2026-11-03', 'Deep Study', 90, [2, 4]],
      ], 'a new stage from today; the first is untouched');
      app.assertNoErrors();
    },
  },

  ...both('Enter saves an edit and closes the editor', async (t, width) => {
    const app = await t.open({ state: keptCore(), width });
    await editFromToday(app, 'Meditate');
    await app.tap(app.page.getByPlaceholder('—'));
    await app.type('10');
    await app.press('Enter');
    assert.equal((await storedHabit(app, 'meditate')).durationMinutes, 10, 'saved');
    assert.equal(await dialog(app, 'Edit habit').count(), 0, 'and the editor closes, as it does for a new habit');
    if (app.phone) assert.equal(await manageMeta(app, 'Meditate'), 'Mon · Tue · Wed · Thu · Fri · Sat · 10 min');
    else assert.equal((await row(app, 'Meditate')).minutes, '10 min');
    app.assertNoErrors();
  }),

  {
    name: 'on the phone, Settings → Manage Habits → Edit changes a habit\'s days and minutes; earlier days keep the old terms (375)',
    run: async (t) => {
      const app = await t.open({ state: keptCore(), width: 375 });
      assert.equal(await app.page.getByRole('button', { name: /^Edit / }).count(), 0, 'rows on the phone have no Edit; Manage Habits is the way in');
      await editFromToday(app, 'Read 30 min');
      await app.assertNoHorizontalScroll('in the editor');
      for (const d of ['Tuesday', 'Thursday', 'Saturday']) await app.tap(inDialog(app, 'Edit habit', d));
      await retype(app, app.page.getByPlaceholder('—'), '45');
      await app.tap(inDialog(app, 'Edit habit', 'Save'));
      assert.equal(await dialog(app, 'Edit habit').count(), 0);
      assert.equal(await manageMeta(app, 'Read 30 min'), 'Mon · Wed · Fri · 45 min', 'Manage Habits shows the new terms');

      await goToday(app);
      assert.equal(await row(app, 'Read 30 min'), null, 'not on Tuesdays any more');
      for (let i = 0; i < 3; i++) await prevDay(app); // Sat Oct 31
      assert.deepEqual(await row(app, 'Read 30 min'), { text: 'Read 30 min', block: 'Evening', minutes: '30 min', checked: true }, 'last Saturday keeps the old terms');
      await backToToday(app);
      await nextDay(app); // Wed Nov 4
      assert.equal((await row(app, 'Read 30 min'))?.minutes, '45 min', 'Wednesday has the new minutes');
      await app.assertNoHorizontalScroll('on Today');
      app.assertNoErrors();
    },
  },

  {
    name: 'on the phone, a habit\'s own page has Edit, and a new name shows on Today and in Manage Habits (375)',
    run: async (t) => {
      const app = await t.open({ state: keptCore(), width: 375 });
      await openManage(app);
      await app.tap(nameButton(app, 'Cycling'));
      await app.page.getByRole('heading', { name: 'Cycling' }).waitFor();
      await app.tap(app.button('Edit this habit'));
      await retype(app, app.page.getByPlaceholder('Habit name'), 'Cycle 20 km');
      await app.tap(inDialog(app, 'Edit habit', 'Save'));
      assert.ok(await app.page.getByRole('heading', { name: 'Cycle 20 km' }).isVisible(), 'the page shows the new name');
      await app.tap(app.button('‹ Manage habits'));
      assert.equal(await manageMeta(app, 'Cycle 20 km'), 'Mon · Wed · Fri');
      await goToday(app);
      await nextDay(app); // Wed
      assert.ok(await row(app, 'Cycle 20 km'), 'Today shows the new name');
      app.assertNoErrors();
    },
  },

  ...both('archiving from Manage Habits takes a habit off Today and the days ahead, keeps the days before, and Restore brings it back', async (t, width) => {
    const app = await t.open({ state: keptCore(), width });
    const before = await storedHabit(app, 'diet');
    await openManage(app);
    await app.tap(manageAction(app, 'Healthy Diet', 'Archive'));
    assert.equal(await manageSection(app, 'Healthy Diet'), 'Archived', 'it moves to the Archived shelf');
    assert.equal(await manageMeta(app, 'Healthy Diet'), 'Evening · Mon · Tue · Wed · Thu · Fri · Sat · history kept');

    await goToday(app);
    assert.equal(await row(app, 'Healthy Diet'), null, 'gone from Today');
    await nextDay(app);
    assert.equal(await row(app, 'Healthy Diet'), null, 'and from the days ahead');
    await backToToday(app);
    await prevDay(app); // Mon Nov 2
    assert.deepEqual(await row(app, 'Healthy Diet'), { text: 'Healthy Diet', block: 'Evening', minutes: null, checked: true }, 'yesterday still has it, checked');
    await backToToday(app);

    await openManage(app);
    await app.tap(nameButton(app, 'Healthy Diet'));
    await app.page.getByRole('heading', { name: 'Healthy Diet' }).waitFor();
    assert.ok(await app.page.getByText('Mon · Tue · Wed · Thu · Fri · Sat · archived Nov 3', { exact: true }).isVisible(), 'its page says it is archived');
    assert.equal(await app.button('Edit this habit').count(), 0, 'and offers no edit');
    await app.tap(app.button('‹ Manage habits'));
    await app.tap(manageAction(app, 'Healthy Diet', 'Restore'));
    assert.equal(await manageSection(app, 'Healthy Diet'), 'Evening', 'back among the evening habits');
    await goToday(app);
    assert.deepEqual(await names(app), TUESDAY, 'back on Today');
    const after = await storedHabit(app, 'diet');
    assert.equal(after.archivedAt, undefined);
    assert.deepEqual(after.stages, before.stages, 'archived and restored the same day leaves no trace');
    app.assertNoErrors();
  }),

  {
    name: 'a habit restored after days away comes back from today, and the days it was away are not misses (375)',
    run: async (t) => {
      const habits = coreHabits('2026-10-01');
      const completions = keptScheduled(habits, '2026-10-01', '2026-11-02', { except: ['diet'] });
      Object.assign(completions, Object.fromEntries(Object.entries(keptScheduled(habits.filter((h) => h.id === 'diet'), '2026-10-01', '2026-10-26')).map(([k, v]) => [k, { ...completions[k], ...v }])));
      habits.find((h) => h.id === 'diet').archivedAt = '2026-10-27T19:00:00.000Z';
      const app = await t.open({ state: stateWith({ habits, completions, settings: { completionThreshold: 1 } }), width: 375 });
      await openManage(app);
      await app.tap(manageAction(app, 'Healthy Diet', 'Restore'));
      assert.equal(await manageSection(app, 'Healthy Diet'), 'Evening');

      await goToday(app);
      assert.deepEqual(await names(app), TUESDAY, 'back on Today from today');
      for (let i = 0; i < 4; i++) await prevDay(app); // Fri Oct 30
      assert.equal(await row(app, 'Healthy Diet'), null, 'not on a day it was away');
      assert.match((await app.shownDay()).louver, /^30, 6 of 6 habits done/, 'that day is still whole');

      await openManage(app);
      await app.tap(nameButton(app, 'Healthy Diet'));
      await app.page.getByRole('heading', { name: 'Healthy Diet' }).waitFor();
      assert.deepEqual(await pageStages(app), [
        ['I', 'Healthy Diet · Mon · Tue · Wed · Thu · Fri · Sat', 'since Oct 122 of 22'],
        ['', 'Rest, until Nov 3', 'since Oct 27'],
        ['I', 'Healthy Diet · Mon · Tue · Wed · Thu · Fri · Sat', 'since Nov 3'],
      ], 'the days away are a rest, not misses');
      await app.assertNoHorizontalScroll('on the habit page');
      app.assertNoErrors();
    },
  },

  ...both('resting a habit for a week takes it off Today, lists it under Resting, and it comes back by itself', async (t, width) => {
    const app = await t.open({ state: keptCore(), width });
    await editFromToday(app, 'Meditate');
    await app.tap(inDialog(app, 'Edit habit', 'Rest for a season'));
    assert.ok(await dialog(app, 'Edit habit').getByText('It leaves Today while it rests.', { exact: false }).isVisible());
    await app.tap(inDialog(app, 'Edit habit', 'A week'));
    assert.equal(await dialog(app, 'Edit habit').count(), 0, 'choosing a rest closes the editor');

    if (!app.phone) await openManage(app);
    assert.equal(await manageSection(app, 'Meditate'), 'Resting');
    assert.equal(await manageMeta(app, 'Meditate'), 'Evening · resting until Nov 10');
    await goToday(app);
    assert.equal(await row(app, 'Meditate'), null, 'off Today');
    await nextDay(app);
    assert.equal(await row(app, 'Meditate'), null, 'and off tomorrow');
    await backToToday(app);

    await app.later(6 * DAY); // Mon Nov 9
    assert.equal((await app.shownDay()).numeral, 9);
    assert.equal(await row(app, 'Meditate'), null, 'still resting on day six');
    await app.later(DAY); // Tue Nov 10
    assert.equal((await app.shownDay()).numeral, 10);
    assert.ok(await row(app, 'Meditate'), 'back by itself a week later');
    await openManage(app);
    assert.equal(await manageSection(app, 'Meditate'), 'Evening', 'listed with the evening habits again');
    assert.ok(!(await manageSections(app)).includes('Resting'), 'nothing is resting');
    app.assertNoErrors();
  }),

  ...both('Bring back returns a resting habit today, and resting then bringing back the same day leaves no trace', async (t, width) => {
    const app = await t.open({ state: keptCore(), width });
    const before = await storedHabit(app, 'meditate');
    await openManage(app);
    await app.tap(manageAction(app, 'Meditate', 'Edit'));
    await app.tap(inDialog(app, 'Edit habit', 'Rest for a season'));
    await app.tap(inDialog(app, 'Edit habit', 'Until I return'));
    assert.equal(await manageMeta(app, 'Meditate'), 'Evening · resting until you bring it back');
    await app.tap(manageAction(app, 'Meditate', 'Bring back'));
    assert.equal(await manageSection(app, 'Meditate'), 'Evening', 'back with the evening habits');
    assert.ok(!(await manageSections(app)).includes('Resting'));
    const after = await storedHabit(app, 'meditate');
    assert.deepEqual(after.stages, before.stages, 'no trace of the rest in its stages');
    await goToday(app);
    assert.deepEqual(await names(app), TUESDAY, 'back on Today');
    await openManage(app);
    await app.tap(manageAction(app, 'Meditate', 'Edit'));
    assert.equal(await dialog(app, 'Edit habit').getByText('Stages', { exact: true }).count(), 0, 'its editor lists no stages: nothing happened');
    await app.press('Escape');
    app.assertNoErrors();
  }),

  {
    name: 'Bring it back today, in the editor of a resting habit, returns it at once',
    run: async (t) => {
      const app = await t.open({ state: keptCore() });
      await app.tap(app.button('Edit Meditate'));
      await app.tap(inDialog(app, 'Edit habit', 'Rest for a season'));
      await app.tap(inDialog(app, 'Edit habit', 'Two weeks'));
      assert.equal(await row(app, 'Meditate'), null);
      await openManage(app);
      await app.tap(manageAction(app, 'Meditate', 'Edit'));
      assert.ok(await dialog(app, 'Edit habit').getByText('Resting until Nov 17.').isVisible(), 'the editor says how long it rests');
      await app.tap(inDialog(app, 'Edit habit', 'Bring it back today'));
      assert.equal(await dialog(app, 'Edit habit').count(), 0);
      assert.equal(await manageSection(app, 'Meditate'), 'Evening');
      await goToday(app);
      assert.deepEqual(await names(app), TUESDAY);
      app.assertNoErrors();
    },
  },

  {
    name: 'a rest with no end lasts until Bring back, days later, and the days it rested are not misses',
    run: async (t) => {
      const app = await t.open({ state: keptCore({ settings: { completionThreshold: 1 } }) });
      await app.tap(app.button('Edit Meditate'));
      await app.tap(inDialog(app, 'Edit habit', 'Rest for a season'));
      await app.tap(inDialog(app, 'Edit habit', 'Until I return'));
      await app.later(2 * DAY); // Thu Nov 5
      assert.equal((await app.shownDay()).numeral, 5);
      assert.equal(await row(app, 'Meditate'), null, 'still resting two days on');
      await openManage(app);
      await app.tap(manageAction(app, 'Meditate', 'Bring back'));
      await goToday(app);
      assert.ok(await row(app, 'Meditate'), 'back today');
      await prevDay(app); // Wed Nov 4
      assert.equal(await row(app, 'Meditate'), null, 'the days it rested stay rest days');
      await openManage(app);
      await app.tap(nameButton(app, 'Meditate'));
      await app.page.getByRole('heading', { name: 'Meditate' }).waitFor();
      assert.deepEqual(await pageStages(app), [
        ['I', 'Meditate · Mon · Tue · Wed · Thu · Fri · Sat', 'since Oct 128 of 28'],
        ['', 'Rest', 'since Nov 3'],
        ['I', 'Meditate · Mon · Tue · Wed · Thu · Fri · Sat', 'since Nov 5'],
      ], 'its page shows the rest between, and no misses');
      app.assertNoErrors();
    },
  },

  {
    name: 'Edit moves a habit to another time block, and Archive this habit in the editor takes it off Today',
    run: async (t) => {
      const app = await t.open({ state: keptCore() });
      await app.tap(app.button('Edit Meditate'));
      await app.tap(inDialog(app, 'Edit habit', 'Morning'));
      await app.tap(inDialog(app, 'Edit habit', 'Save'));
      assert.equal((await row(app, 'Meditate')).block, 'Morning', 'moved to the morning');
      await app.tap(app.button('Edit Meditate'));
      await app.tap(inDialog(app, 'Edit habit', 'Archive this habit'));
      assert.equal(await dialog(app, 'Edit habit').count(), 0, 'archiving closes the editor');
      assert.equal(await row(app, 'Meditate'), null, 'gone from Today');
      await openManage(app);
      assert.equal(await manageSection(app, 'Meditate'), 'Archived');
      app.assertNoErrors();
    },
  },

  {
    name: 'a habit already checked today rests from tomorrow, so today keeps its check',
    run: async (t) => {
      const app = await t.open({ state: keptCore() });
      await app.tap(app.page.locator('[data-habit-row="Meditate"]'));
      await app.tap(app.button('Edit Meditate'));
      await app.tap(inDialog(app, 'Edit habit', 'Rest for a season'));
      await app.tap(inDialog(app, 'Edit habit', 'A week'));
      assert.deepEqual(await row(app, 'Meditate'), { text: 'Meditate', block: 'Evening', minutes: null, checked: true }, 'today keeps it, checked');
      await nextDay(app); // Wed Nov 4: resting
      assert.equal(await row(app, 'Meditate'), null, 'it rests from tomorrow');
      for (let i = 0; i < 6; i++) await nextDay(app); // Tue Nov 10
      assert.equal(await row(app, 'Meditate'), null, 'for a week');
      await nextDay(app); // Wed Nov 11
      assert.ok(await row(app, 'Meditate'), 'and is back after it');
      assert.equal((await app.stored()).completions['2026-11-03'].meditate, true, 'today\'s check is kept');
      app.assertNoErrors();
    },
  },

  {
    name: 'a habit edited while it rests comes back as edited (375)',
    run: async (t) => {
      const app = await t.open({ state: keptCore(), width: 375 });
      await openManage(app);
      await app.tap(manageAction(app, 'Meditate', 'Edit'));
      await app.tap(inDialog(app, 'Edit habit', 'Rest for a season'));
      await app.tap(inDialog(app, 'Edit habit', 'Until I return'));
      await app.tap(manageAction(app, 'Meditate', 'Edit'));
      for (const d of ['Tuesday', 'Thursday', 'Saturday']) await app.tap(inDialog(app, 'Edit habit', d));
      await app.tap(inDialog(app, 'Edit habit', 'Save'));
      assert.equal(await manageSection(app, 'Meditate'), 'Resting', 'an edit does not end the rest');
      await app.tap(manageAction(app, 'Meditate', 'Bring back'));
      assert.equal(await manageMeta(app, 'Meditate'), 'Mon · Wed · Fri', 'it comes back with the new days');
      await goToday(app);
      assert.equal(await row(app, 'Meditate'), null, 'not on a Tuesday now');
      await nextDay(app);
      assert.ok(await row(app, 'Meditate'), 'on Wednesday');
      for (let i = 0; i < 4; i++) await prevDay(app); // Sat Oct 31
      assert.ok(await row(app, 'Meditate'), 'last Saturday keeps its old days');
      app.assertNoErrors();
    },
  },

  ...both('the habit page from Manage Habits shows times kept and stages, and its back control returns to Manage Habits', async (t, width) => {
    const days = { type: 'specific_days', days: M2S };
    const habits = coreHabits('2026-10-01').map((h) => (h.id !== 'meditate' ? h : habit('meditate', 'Meditate 10 min', {
      block: 'evening', days: M2S, minutes: 10, since: '2026-10-01',
      stages: [{ from: '2026-10-01', text: 'Meditate 5 min', durationMinutes: 5, recurrence: days }, { from: '2026-10-20', text: 'Meditate 10 min', durationMinutes: 10, recurrence: days }],
    })));
    const dark = width === 375;
    const app = await t.open({ state: stateWith({ habits, completions: keptScheduled(habits, '2026-10-01', '2026-11-02'), settings: { darkMode: dark } }), width });
    await openManage(app);
    await app.tap(nameButton(app, 'Meditate 10 min'));
    const title = app.page.getByRole('heading', { name: 'Meditate 10 min' });
    await title.waitFor();
    if (dark) assert.deepEqual(await color(title), DARK, 'light ink on a dark page');
    const text = await app.page.evaluate(() => document.body.innerText);
    assert.match(text, /\n28\nTIMES KEPT/i, '28 times kept (16 at 5 min, 12 at 10 min)');
    assert.match(text, /\n3\.3\nHOURS GIVEN/i, '200 minutes given');
    assert.match(text, /STAGES\nI\nMeditate 5 min · Mon · Tue · Wed · Thu · Fri · Sat\nsince Oct 1\n16 of 16\nII\nMeditate 10 min · Mon · Tue · Wed · Thu · Fri · Sat\nsince Oct 20\n12 of 12/i, 'both stages, each with its record');
    if (app.phone) await app.assertNoHorizontalScroll('on the habit page');

    await app.tap(app.button('‹ Manage habits'));
    assert.ok(await app.page.getByText('Manage habits', { exact: true }).isVisible(), 'back to Manage Habits');
    assert.ok(await nameButton(app, 'Meditate 10 min').isVisible());
    app.assertNoErrors();
  }),

  ...both('Escape closes the editor wherever it opens, and backs out of the rest choices first', async (t, width) => {
    const app = await t.open({ state: keptCore(), width });
    await openManage(app);
    await app.tap(manageAction(app, 'Meditate', 'Edit'));
    await app.press('Escape');
    assert.equal(await dialog(app, 'Edit habit').count(), 0, 'Escape closes the editor over Manage Habits');
    assert.ok(await app.page.getByText('Manage habits', { exact: true }).isVisible(), 'and Manage Habits stays');

    await app.tap(manageAction(app, 'Meditate', 'Edit'));
    await app.tap(inDialog(app, 'Edit habit', 'Rest for a season'));
    await app.press('Escape');
    assert.ok(await dialog(app, 'Edit habit').isVisible(), 'the first Escape closes only the rest choices');
    assert.ok(await inDialog(app, 'Edit habit', 'Rest for a season').isVisible());
    await app.press('Escape');
    assert.equal(await dialog(app, 'Edit habit').count(), 0, 'the second closes the editor');

    await app.tap(app.button('+ New habit'));
    assert.ok(await dialog(app, 'New habit').isVisible(), '+ New habit in Manage Habits opens the editor');
    await app.press('Escape');
    assert.equal(await dialog(app, 'New habit').count(), 0);

    await app.tap(nameButton(app, 'Meditate'));
    await app.tap(app.button('Edit this habit'));
    await app.press('Escape');
    assert.equal(await dialog(app, 'Edit habit').count(), 0, 'Escape closes the editor over a habit page');
    assert.ok(await app.page.getByRole('heading', { name: 'Meditate' }).isVisible(), 'and the page stays');

    await app.tap(navButton(app, 'Settings'));
    await app.press('Escape');
    assert.equal(await dialog(app, 'Settings').count(), 0, 'Escape closes Settings');
    const saved = await storedHabit(app, 'meditate');
    assert.equal(saved.stages.length, 1, 'nothing changed');
    app.assertNoErrors();
  }),

  {
    name: 'in dark mode the editor and Manage Habits are light ink on a dark page (375)',
    run: async (t) => {
      const app = await t.open({ state: keptCore({ settings: { darkMode: true } }), width: 375 });
      await app.tap(app.button('New habit'));
      assert.deepEqual(await color(app.page.getByPlaceholder('Habit name')), DARK, 'the editor');
      await app.type('Stretch');
      await app.tap(inDialog(app, 'New habit', 'Specific days'));
      await app.assertNoHorizontalScroll('in the editor');
      await app.press('Escape');
      await openManage(app);
      assert.deepEqual(await color(nameButton(app, 'Meditate')), DARK, 'Manage Habits');
      app.assertNoErrors();
    },
  },

  {
    name: 'a habit\'s name is kept exactly as typed, and a long one fits the phone (375)',
    run: async (t) => {
      const app = await t.open({ state: keptCore(), width: 375 });
      const name = 'Read "Dune" & <Hyperion> — 20 pages, then journal about what stayed with me';
      await openManage(app);
      await app.tap(app.button('+ New habit'));
      await app.type(name);
      await app.tap(inDialog(app, 'New habit', 'Evening'));
      await app.tap(inDialog(app, 'New habit', 'Add habit'));
      assert.equal(await dialog(app, 'New habit').count(), 0);
      assert.equal(await manageSection(app, name), 'Evening', 'listed in its block in Manage Habits');
      await app.assertNoHorizontalScroll('with a long name in Manage Habits');
      await goToday(app);
      assert.equal((await row(app, name))?.block, 'Evening', 'on Today, as typed');
      assert.ok(await app.page.getByText(name, { exact: true }).isVisible());
      await app.assertNoHorizontalScroll('with a long name on Today');
      assert.equal((await app.stored()).habits.find((h) => h.text === name)?.stages[0].text, name);
      app.assertNoErrors();
    },
  },

  {
    name: 'Manage Habits and the habit page can be left from the keyboard',
    run: async (t) => {
      const app = await t.open({ state: keptCore() });
      await openManage(app);
      await nameButton(app, 'Meditate').focus();
      await app.press('Enter');
      await app.page.getByRole('heading', { name: 'Meditate' }).waitFor();
      await app.button('‹ Manage habits').focus();
      await app.press('Enter');
      assert.ok(await app.page.getByText('Manage habits', { exact: true }).isVisible(), 'the habit page goes back from the keyboard');
      const back = app.page.getByRole('button', { name: /Back$/ });
      assert.equal(await back.count(), 1, 'Manage Habits\' ‹ Back is a control the keyboard can reach');
      await back.focus();
      await app.press('Enter');
      assert.ok(await app.page.locator('[data-week-day]').first().isVisible(), 'and it returns to Today');
      app.assertNoErrors();
    },
  },
];
