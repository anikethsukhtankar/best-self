// First visit and the device's data: the welcome, the sample year, what is kept across reloads and
// tabs, private mode, backups out and in, and starting over.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assert, stateWith, coreHabits, keptDays, App, URL } from './harness.mjs';

const CORE = ['Cycling', 'Push Day', 'Pull Day', 'Leg Day', 'Rest Day', '5K Walk', 'Study 1 Hour', 'Study 2 Hours', 'Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet'];
const SUNDAY = ['Rest Day'];
const TUESDAY = ['Push Day', '5K Walk', 'Study 1 Hour', 'Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet'];
const ALL_IDS = ['cycling', 'push', 'pull', 'leg', 'rest', 'walk', 'study1', 'study2', 'meditate', 'read', 'water', 'diet'];

const both = (name, run) => [1440, 375].map((width) => ({ name: `${name} (${width})`, run: (t) => run(t, width) }));

// A device in use since October: every day kept until yesterday, Meditate done this morning, and
// an open task from yesterday.
const lived = (settings = {}) => stateWith({
  habits: coreHabits('2026-10-01'),
  completions: { ...keptDays('2026-10-01', '2026-11-02', ALL_IDS), '2026-11-03': { meditate: true } },
  todos: [{ id: 't-passport', text: 'Renew passport', createdAt: '2026-11-02T17:00:00.000Z' }],
  settings,
});

const row = (app, text) => app.page.locator(`[data-habit-row="${text}"]`);
const rowChecked = async (app, text) => (await app.habitRows()).find((r) => r.text === text)?.checked;
const begin = (app) => app.button('Begin');
const dialog = (app, name = 'Settings') => app.page.getByRole('dialog', { name });

// The bottom bar on the phone ("○Today"), the tabs along the top on a desktop.
function nav(app, name) {
  return app.phone ? app.page.getByRole('button', { name: new RegExp(`^\\W*${name}$`) }).first() : app.button(name);
}
async function openSettings(app) {
  await app.tap(nav(app, 'Settings'));
  await dialog(app).waitFor({ state: 'visible', timeout: 3000 });
}
async function bodyTheme(app) {
  await app.wait(350); // the page background eases over 300ms
  return app.page.evaluate(() => ({ cls: document.body.className, bg: getComputedStyle(document.body).backgroundColor }));
}
async function expectTheme(app, dark, where) {
  const { cls, bg } = await bodyTheme(app);
  assert.equal(cls, dark ? 'dark' : 'light', `page theme ${where}`);
  assert.equal(bg, dark ? 'rgb(10, 10, 10)' : 'rgb(255, 255, 255)', `page background ${where}`);
}
async function expectToday(app, rows, where = '') {
  const shown = await app.shownDay();
  assert.equal(shown.weekday, 'Tue', `weekday ${where}: ${JSON.stringify(shown)}`);
  assert.equal(shown.numeral, 3, `numeral ${where}: ${JSON.stringify(shown)}`);
  assert.equal(shown.header, app.phone ? 'Nov 3' : 'Tue, November 3', `header ${where}: ${JSON.stringify(shown)}`);
  if (rows) assert.deepEqual((await app.habitRows()).map((r) => r.text), rows, `rows ${where}`);
}
async function expectWelcome(app, where) {
  await begin(app).waitFor({ state: 'visible', timeout: 3000 });
  assert.ok(await app.page.getByText('A quiet place for habits that grow.').isVisible(), `the welcome ${where}`);
  assert.equal(await app.page.locator('[data-habit-row]').count(), 0, `no habits behind the welcome ${where}`);
}
async function addTask(app, text) {
  await app.tap(app.page.getByPlaceholder('Add a task...'));
  await app.type(text);
  await app.press('Enter');
}
const taskVisible = (app, text) => app.page.getByText(text, { exact: true }).isVisible();
// A stat on Insights, by its label ('Day streak', 'Best streak', 'This week').
const stat = (app, label) => app.page.evaluate((l) => {
  const el = [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === l && d.children.length === 0);
  return el?.previousElementSibling?.textContent.trim() ?? null;
}, label);

// What a first Begin stores: the core list from today, nothing checked, nothing to do.
function assertFreshCore(saved, { dark, today = '2026-11-03' }) {
  assert.ok(saved, 'something is stored');
  assert.deepEqual(saved.habits.map((h) => h.text), CORE, 'the core list, in order');
  assert.equal(saved.habits.filter((h) => !h.archivedAt).length, 12);
  assert.ok(saved.habits.every((h) => h.stages?.[0]?.from === today), `every habit begins ${today}`);
  assert.deepEqual(saved.completions, {}, 'no checks');
  assert.deepEqual(saved.todos, [], 'no tasks');
  assert.equal(Boolean(saved.settings.darkMode), dark, 'dark mode as chosen');
}

// A second tab on the same device, with its own error log.
async function secondTab(app) {
  const page = await app.ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror (second tab): ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console (second tab): ${m.text().slice(0, 300)}`); });
  await page.goto(URL);
  await page.waitForFunction(() => document.querySelector('#root')?.children.length > 0);
  await page.waitForTimeout(300);
  return new App(page, app.ctx, errors, { width: app.width, phone: app.phone, tz: app.tz });
}

const scratch = () => fs.mkdtempSync(path.join(os.tmpdir(), 'best-self-e2e-'));
async function exportBackup(app, dir) {
  await openSettings(app);
  const [download] = await Promise.all([app.page.waitForEvent('download', { timeout: 5000 }), app.tap(app.button('Export'))]);
  const file = path.join(dir, download.suggestedFilename());
  await download.saveAs(file);
  return { name: download.suggestedFilename(), file, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
}
async function chooseImport(app, file) {
  const [chooser] = await Promise.all([app.page.waitForEvent('filechooser', { timeout: 5000 }), app.tap(app.button('Import'))]);
  await chooser.setFiles(file);
  await app.wait(300);
}

export default [
  ...both('a first visit follows a dark system, and Begin stores the core list for good', async (t, width) => {
    const app = await t.open({ state: false, scheme: 'dark', width });
    await expectWelcome(app, 'on a first visit');
    await expectTheme(app, true, 'on the welcome');
    assert.equal(await app.stored(), null, 'nothing is stored before Begin');
    if (app.phone) await app.assertNoHorizontalScroll('on the welcome');

    await app.tap(begin(app));
    await expectToday(app, TUESDAY, 'after Begin');
    assert.ok((await app.habitRows()).every((r) => !r.checked), 'nothing is checked yet');
    await expectTheme(app, true, 'on Today after Begin');
    assertFreshCore(await app.stored(), { dark: true });
    if (app.phone) await app.assertNoHorizontalScroll('on Today after Begin');

    await app.reload();
    assert.equal(await begin(app).count(), 0, 'the welcome does not come back after a reload');
    await expectToday(app, TUESDAY, 'after a reload');
    await expectTheme(app, true, 'after a reload');
    app.assertNoErrors();
  }),

  {
    name: 'a first visit on a light system is light, and Begin keeps it light',
    run: async (t) => {
      const app = await t.open({ state: false, scheme: 'light', width: 375 });
      await expectWelcome(app, 'on a first visit');
      await expectTheme(app, false, 'on the welcome');
      await app.tap(begin(app));
      await expectToday(app, TUESDAY, 'after Begin');
      await expectTheme(app, false, 'after Begin');
      assertFreshCore(await app.stored(), { dark: false });
      app.assertNoErrors();
    },
  },

  {
    name: 'the welcome can be begun from the keyboard',
    run: async (t) => {
      const app = await t.open({ state: false });
      await expectWelcome(app, 'on a first visit');
      await app.press('Tab');
      assert.equal(await app.page.evaluate(() => document.activeElement?.textContent), 'Begin', 'the first Tab reaches Begin');
      await app.press('Enter');
      await expectToday(app, TUESDAY, 'after Begin by keyboard');
      assert.equal((await app.stored())?.habits.length, 12);
      app.assertNoErrors();
    },
  },

  {
    name: 'Begin late on a Sunday night shows Sunday, and checks land on Sunday',
    run: async (t) => {
      const app = await t.open({ state: false, width: 375, now: '2026-11-01T22:30:00' });
      await app.tap(begin(app));
      const shown = await app.shownDay();
      assert.deepEqual([shown.weekday, shown.numeral, shown.header], ['Sun', 1, 'Nov 1'], JSON.stringify(shown));
      assert.deepEqual((await app.habitRows()).map((r) => r.text), SUNDAY);
      const saved = await app.stored();
      assertFreshCore(saved, { dark: false, today: '2026-11-01' });
      await app.tap(row(app, 'Rest Day'));
      const id = saved.habits.find((h) => h.text === 'Rest Day').id;
      assert.deepEqual((await app.stored()).completions, { '2026-11-01': { [id]: true } });
      app.assertNoErrors();
    },
  },

  ...both('a sample year from the welcome is looked around, never saved, and Leave goes back to the welcome', async (t, width) => {
    const app = await t.open({ state: false, scheme: 'dark', width });
    await app.tap(app.button('Look around a sample year first'));
    assert.ok(await app.page.getByText('A sample year, not saved', { exact: true }).isVisible(), 'the sample banner');
    await expectToday(app, null, 'in the sample');
    const rows = await app.habitRows();
    assert.ok(rows.length >= 5, `the sample has a day of habits: ${JSON.stringify(rows)}`);
    assert.ok(rows.some((r) => r.text === 'Lights out by 11' && !r.checked), JSON.stringify(rows));
    await expectTheme(app, true, 'in the sample on a dark system');
    if (app.phone) await app.assertNoHorizontalScroll('on Today in the sample');

    await app.tap(row(app, 'Lights out by 11'));
    assert.equal(await rowChecked(app, 'Lights out by 11'), true, 'a check in the sample shows');
    await addTask(app, 'Water the plants');
    assert.ok(await taskVisible(app, 'Water the plants'), 'a task in the sample shows');
    assert.equal(await app.stored(), null, 'nothing from the sample is stored');

    await app.tap(nav(app, 'Insights'));
    assert.equal(await app.page.getByText('Insights fill in as you check things off.').count(), 0, 'the sample has history');
    assert.ok(Number(await stat(app, 'Best streak')) > 0, `a best streak: ${await stat(app, 'Best streak')}`);
    assert.ok((await app.page.getByText('in which we went to the sea').count()) > 0, 'the almanac has its chapter lines');
    if (app.phone) await app.assertNoHorizontalScroll('on Insights in the sample');

    await app.tap(app.button('Leave'));
    await expectWelcome(app, 'after leaving the sample');
    assert.equal(await app.stored(), null, 'still nothing stored after leaving');

    // Looking again, then reloading: the sample is held in memory only, so the welcome is back.
    await app.tap(app.button('Look around a sample year first'));
    assert.ok(await app.page.getByText('A sample year, not saved', { exact: true }).isVisible());
    await app.reload();
    await expectWelcome(app, 'after reloading the sample');

    await app.tap(begin(app));
    await expectToday(app, TUESDAY, 'after Begin, once the sample is left');
    assert.equal(await app.page.getByText('A sample year, not saved').count(), 0, 'no sample banner on your own days');
    assertFreshCore(await app.stored(), { dark: true });
    app.assertNoErrors();
  }),

  ...both('Settings -> Sample year from a real device, and back, leaves the real days as they were', async (t, width) => {
    const app = await t.open({ state: lived({ darkMode: true }), width });
    const before = await app.stored();
    await expectToday(app, TUESDAY, 'on your own day');
    assert.equal(await rowChecked(app, 'Meditate'), true);

    await openSettings(app);
    await expectTheme(app, true, 'in Settings');
    if (app.phone) await app.assertNoHorizontalScroll('in Settings');
    await app.tap(app.button('Look around a sample year'));
    assert.equal(await dialog(app).count(), 0, 'Settings closes');
    assert.ok(await app.page.getByText('A sample year, not saved', { exact: true }).isVisible(), 'the sample banner');
    assert.ok((await app.habitRows()).some((r) => r.text === 'Plan the day on paper'), 'the sample habits are shown');
    await expectTheme(app, true, 'in the sample');

    await app.tap(row(app, 'Lights out by 11'));
    await addTask(app, 'A sample task');
    await openSettings(app);
    assert.ok(await app.button('Leave the sample year').isVisible(), 'Settings offers the way back');
    assert.equal(await app.button('Export').count(), 0, 'no export of the sample');
    assert.equal(await app.button('Start over').count(), 0, 'no start over from the sample');
    if (app.phone) {
      await app.press('Escape');
      assert.equal(await dialog(app).count(), 0, 'Escape closes Settings');
      await app.tap(app.button('Leave'));
    } else {
      await app.tap(app.button('Leave the sample year'));
    }

    assert.equal(await app.page.getByText('A sample year, not saved').count(), 0, 'the banner is gone');
    await expectToday(app, TUESDAY, 'back on your own day');
    assert.equal(await rowChecked(app, 'Meditate'), true, 'this morning\'s check is still there');
    assert.equal(await rowChecked(app, 'Lights out by 11'), undefined);
    assert.ok(await taskVisible(app, 'Renew passport'), 'your own task is back');
    assert.equal(await app.page.getByText('A sample task', { exact: true }).count(), 0, 'the sample task is not');
    assert.deepEqual(await app.stored(), before, 'what is stored is untouched');
    await expectTheme(app, true, 'back on your own day');
    app.assertNoErrors();
  }),

  ...both('checks, tasks and edits survive a reload', async (t, width) => {
    const app = await t.open({ state: stateWith({ habits: coreHabits('2026-10-01') }), width });
    await app.tap(row(app, 'Push Day'));
    await app.tap(row(app, '5K Walk'));
    await addTask(app, 'Call the bank');
    await addTask(app, 'Pick up the bike');
    assert.ok(await taskVisible(app, 'Call the bank'));
    // Tick the first task off.
    await app.tap(app.page.getByText('Call the bank', { exact: true }).locator('xpath=preceding-sibling::div[1]'));

    // Rename a habit: on a desktop from its row, on a phone from Settings -> Manage Habits.
    if (app.phone) {
      await openSettings(app);
      await app.tap(app.button('Manage Habits'));
      const manageRow = app.page.locator('div').filter({ has: app.page.getByRole('button', { name: 'Read 30 min', exact: true }) }).filter({ has: app.page.getByRole('button', { name: 'Edit', exact: true }) }).last();
      await app.tap(manageRow.getByRole('button', { name: 'Edit', exact: true }));
    } else {
      await app.tap(app.button('Edit Read 30 min'));
    }
    await dialog(app, 'Edit habit').waitFor({ state: 'visible', timeout: 3000 });
    await app.page.getByPlaceholder('Habit name').fill('Read 30 min before bed');
    await app.tap(app.button('Save'));
    assert.equal(await dialog(app, 'Edit habit').count(), 0, 'the editor closes on Save');
    if (app.phone) {
      await app.assertNoHorizontalScroll('on Manage habits');
      await app.tap(nav(app, 'Today'));
    }

    const expectKept = async (where) => {
      await expectToday(app, ['Push Day', '5K Walk', 'Study 1 Hour', 'Meditate', 'Read 30 min before bed', 'Drink 3L Water', 'Healthy Diet'], where);
      assert.deepEqual((await app.habitRows()).filter((r) => r.checked).map((r) => r.text), ['Push Day', '5K Walk'], `checks ${where}`);
      assert.ok(await taskVisible(app, 'Call the bank'), `the ticked task ${where}`);
      assert.ok(await taskVisible(app, 'Pick up the bike'), `the open task ${where}`);
      const struck = await app.page.getByText('Call the bank', { exact: true }).evaluate((e) => getComputedStyle(e).textDecorationLine);
      assert.equal(struck, 'line-through', `the ticked task is struck ${where}`);
    };
    await expectKept('before the reload');
    await app.reload();
    await expectKept('after a reload');
    const saved = await app.stored();
    assert.deepEqual(saved.completions['2026-11-03'], { push: true, walk: true });
    assert.deepEqual(saved.todos.map((x) => [x.text, Boolean(x.completedAt)]), [['Call the bank', true], ['Pick up the bike', false]]);
    const read = saved.habits.find((h) => h.id === 'read');
    assert.equal(read.text, 'Read 30 min before bed');
    assert.equal(read.durationMinutes, 30, 'the rename keeps the minutes');
    if (app.phone) await app.assertNoHorizontalScroll('after a reload');
    app.assertNoErrors();
  }),

  {
    name: 'a second tab that saves is adopted by the first, and neither loses anything',
    run: async (t) => {
      const app = await t.open({ state: stateWith({ habits: coreHabits('2026-10-01') }) });
      await app.tap(row(app, 'Meditate'));
      const other = await secondTab(app);
      await expectToday(other, TUESDAY, 'in the second tab');
      assert.equal(await rowChecked(other, 'Meditate'), true, 'the second tab opens with the first tab\'s check');

      await other.tap(row(other, 'Push Day'));
      await addTask(other, 'Post the letter');
      await app.wait(300);
      assert.equal(await rowChecked(app, 'Push Day'), true, 'the first tab takes the second tab\'s check');
      assert.equal(await rowChecked(app, 'Meditate'), true, 'and keeps its own');
      assert.ok(await taskVisible(app, 'Post the letter'), 'and shows its task');

      await app.tap(row(app, 'Read 30 min'));
      await other.wait(300);
      const saved = await app.stored();
      assert.deepEqual(saved.completions['2026-11-03'], { meditate: true, push: true, read: true }, 'every check from both tabs is stored');
      assert.deepEqual(saved.todos.map((x) => x.text), ['Post the letter']);
      assert.deepEqual((await other.habitRows()).filter((r) => r.checked).map((r) => r.text), ['Push Day', 'Meditate', 'Read 30 min'], 'the second tab shows all three');

      // Dark mode turned on in the second tab reaches the first.
      await openSettings(other);
      await other.tap(other.page.getByRole('switch', { name: 'Dark Mode' }));
      await other.tap(other.button('Save Settings'));
      await expectTheme(app, true, 'in the first tab after the second turned dark mode on');
      assert.deepEqual((await app.stored()).completions['2026-11-03'], { meditate: true, push: true, read: true }, 'saving settings kept every check');

      await app.reload();
      assert.deepEqual((await app.habitRows()).filter((r) => r.checked).map((r) => r.text), ['Push Day', 'Meditate', 'Read 30 min']);
      app.assertNoErrors();
      other.assertNoErrors();
    },
  },

  {
    name: 'two tabs on a first visit: Begin in one, then Begin in the other keeps the first one\'s checks',
    run: async (t) => {
      const app = await t.open({ state: false, width: 375 });
      const other = await secondTab(app);
      await expectWelcome(app, 'in the first tab');
      await expectWelcome(other, 'in the second tab');
      await other.tap(begin(other));
      await other.tap(row(other, 'Push Day'));
      const begun = await other.stored();

      await app.tap(begin(app));
      await expectToday(app, TUESDAY, 'after Begin in the first tab');
      assert.equal(await rowChecked(app, 'Push Day'), true, 'the check made in the other tab is there');
      assert.deepEqual(await app.stored(), begun, 'Begin did not start the device over');
      app.assertNoErrors();
      other.assertNoErrors();
    },
  },

  ...both('private mode: the app opens, Begin works, and checks are kept while it is open', async (t, width) => {
    const app = await t.open({ state: false, storageBlocked: true, width });
    await expectWelcome(app, 'in private mode');
    await app.tap(begin(app));
    await expectToday(app, TUESDAY, 'after Begin in private mode');
    await app.tap(row(app, 'Push Day'));
    await app.tap(row(app, 'Meditate'));
    await addTask(app, 'Buy stamps');
    assert.deepEqual((await app.habitRows()).filter((r) => r.checked).map((r) => r.text), ['Push Day', 'Meditate']);
    assert.ok(await taskVisible(app, 'Buy stamps'));

    await app.tap(nav(app, 'Insights'));
    assert.equal(await app.page.getByText('Insights fill in as you check things off.').count(), 0, 'Insights sees today\'s checks');
    if (app.phone) await app.assertNoHorizontalScroll('on Insights in private mode');
    await app.tap(nav(app, 'Today'));
    assert.deepEqual((await app.habitRows()).filter((r) => r.checked).map((r) => r.text), ['Push Day', 'Meditate'], 'checks are kept in memory');
    assert.ok(await taskVisible(app, 'Buy stamps'));
    if (app.phone) await app.assertNoHorizontalScroll('on Today in private mode');
    app.assertNoErrors();
  }),

  {
    name: 'private mode on a dark system stays dark after Begin',
    run: async (t) => {
      const app = await t.open({ state: false, storageBlocked: true, scheme: 'dark', width: 375 });
      await expectWelcome(app, 'in private mode');
      await expectTheme(app, true, 'on the welcome');
      await app.tap(begin(app));
      await expectToday(app, TUESDAY, 'after Begin');
      await expectTheme(app, true, 'on Today after Begin');
      app.assertNoErrors();
    },
  },

  {
    name: 'private mode: a look at the sample year from Settings keeps today\'s checks',
    run: async (t) => {
      const app = await t.open({ state: false, storageBlocked: true, width: 375 });
      await app.tap(begin(app));
      await app.tap(row(app, 'Push Day'));
      await addTask(app, 'Buy stamps');
      await openSettings(app);
      assert.ok(await app.page.getByText('What you have is not touched.', { exact: false }).isVisible());
      await app.tap(app.button('Look around a sample year'));
      assert.ok(await app.page.getByText('A sample year, not saved', { exact: true }).isVisible());
      await app.tap(app.button('Leave'));
      assert.equal(await begin(app).count(), 0, 'leaving the sample goes back to your day, not the welcome');
      await expectToday(app, TUESDAY, 'after leaving the sample');
      assert.equal(await rowChecked(app, 'Push Day'), true, 'this morning\'s check is still there');
      assert.ok(await taskVisible(app, 'Buy stamps'), 'and the task');
      app.assertNoErrors();
    },
  },

  {
    name: 'settings changed in a sample from the welcome are not saved, and Settings -> Leave goes back to the welcome',
    run: async (t) => {
      const app = await t.open({ state: false });
      await app.tap(app.button('Look around a sample year first'));
      await openSettings(app);
      assert.equal(await app.button('Export').count(), 0, 'no export of the sample');
      await app.tap(app.page.getByRole('switch', { name: 'Dark Mode' }));
      await app.tap(app.button('Save Settings'));
      assert.equal(await dialog(app).count(), 0);
      await expectTheme(app, true, 'after turning dark mode on in the sample');
      assert.equal(await app.stored(), null, 'a setting changed in the sample is not stored');
      await openSettings(app);
      await app.tap(app.button('Leave the sample year'));
      await expectWelcome(app, 'after Settings -> Leave the sample year');
      assert.equal(await app.stored(), null);
      app.assertNoErrors();
    },
  },

  {
    name: 'Begin in a time zone ahead of UTC begins the habits on the local day',
    run: async (t) => {
      const app = await t.open({ state: false, width: 375, tz: 'Pacific/Auckland', now: '2026-11-03T07:00:00' });
      await app.tap(begin(app));
      await expectToday(app, TUESDAY, 'in Auckland on Tuesday morning');
      assertFreshCore(await app.stored(), { dark: false, today: '2026-11-03' });
      await app.tap(row(app, 'Push Day'));
      const saved = await app.stored();
      assert.deepEqual(Object.keys(saved.completions), ['2026-11-03'], 'the check is on the local day');
      app.assertNoErrors();
    },
  },

  {
    name: 'a backup from an older version, before habits had stages, imports with its history',
    run: async (t) => {
      const dir = scratch();
      const old = path.join(dir, 'best-self-backup-2026-10-15.json');
      fs.writeFileSync(old, JSON.stringify({
        habits: [
          { id: 'med', text: 'Meditate', timeBlock: 'evening', recurrence: { type: 'daily' }, durationMinutes: null, sortOrder: 0, createdAt: '2026-09-01T12:00:00.000Z' },
          { id: 'run', text: 'Run', timeBlock: 'morning', recurrence: { type: 'specific_days', days: [1, 3, 5] }, durationMinutes: 20, sortOrder: 0, createdAt: '2026-09-01T12:00:00.000Z' },
        ],
        todos: [{ id: 'old-t', text: 'Fix the bike', createdAt: '2026-11-02T09:00:00.000Z' }],
        completions: { '2026-11-01': { med: true }, '2026-11-02': { med: true, run: true } },
        settings: { completionThreshold: 0.8, darkMode: false },
        exportedAt: '2026-11-02T20:00:00.000Z',
        version: '2.0',
      }));
      const app = await t.open({ state: lived() });
      await openSettings(app);
      await chooseImport(app, old);
      assert.ok(await app.page.getByText('Data imported successfully!').isVisible());
      await app.wait(1700);
      await expectToday(app, ['Meditate'], 'after importing an old backup');
      assert.ok(await taskVisible(app, 'Fix the bike'), 'the old open task carries onto today');
      await app.tap(app.weekDay(2));
      assert.deepEqual((await app.habitRows()).map((r) => [r.text, r.checked]), [['Run', true], ['Meditate', true]], 'Monday came across checked');
      const saved = await app.stored();
      assert.deepEqual(saved.habits.map((h) => [h.id, h.stages?.[0]?.from]), [['med', '2026-09-01'], ['run', '2026-09-01']], 'each old habit begins the day it was made');
      app.assertNoErrors();
    },
  },

  ...both('Export downloads a backup, and Import restores it on a fresh device', async (t, width) => {
    const dir = scratch();
    const source = lived({ darkMode: true, completionThreshold: 0.7 });
    const app = await t.open({ state: source, width });
    const { name, data } = await exportBackup(app, dir);
    assert.equal(name, 'best-self-backup-2026-11-03.json');
    assert.deepEqual(data.habits.map((h) => h.text), CORE, 'the backup has the habits');
    assert.deepEqual(data.completions, source.completions, 'the backup has every check');
    assert.deepEqual(data.todos.map((x) => x.text), ['Renew passport'], 'the backup has the tasks');
    assert.equal(data.settings.darkMode, true);
    assert.equal(data.settings.completionThreshold, 0.7);
    assert.ok(await dialog(app).isVisible(), 'Settings stays open after Export');
    app.assertNoErrors();

    // A new phone or laptop: Begin, then Settings -> Import.
    const fresh = await t.open({ state: false, width });
    await fresh.tap(begin(fresh));
    await openSettings(fresh);
    await chooseImport(fresh, path.join(dir, name));
    assert.ok(await fresh.page.getByText('Data imported successfully!').isVisible(), 'the import says it worked');
    await fresh.wait(1700);
    assert.equal(await dialog(fresh).count(), 0, 'Settings closes after the import');
    await expectToday(fresh, TUESDAY, 'after the import');
    assert.deepEqual((await fresh.habitRows()).filter((r) => r.checked).map((r) => r.text), ['Meditate'], 'today\'s check came across');
    assert.ok(await taskVisible(fresh, 'Renew passport'), 'the task came across');
    await expectTheme(fresh, true, 'after importing a dark backup');
    const restored = await fresh.stored();
    assert.deepEqual(restored.habits.map((h) => h.id), source.habits.map((h) => h.id), 'the backup\'s habits replace the fresh ones');
    assert.deepEqual(restored.completions, source.completions, 'every check is restored');
    assert.equal(restored.settings.completionThreshold, 0.7);
    await fresh.tap(fresh.weekDay(1));
    assert.deepEqual((await fresh.habitRows()).map((r) => [r.text, r.checked]), [['Rest Day', true]], 'past days came across');
    await fresh.reload();
    await expectToday(fresh, TUESDAY, 'after a reload');
    assert.equal(await rowChecked(fresh, 'Meditate'), true);
    if (fresh.phone) await fresh.assertNoHorizontalScroll('after the import');
    fresh.assertNoErrors();
  }),

  {
    name: 'importing a file that is not a backup says so and changes nothing; the right file then imports',
    run: async (t) => {
      const dir = scratch();
      const backup = path.join(dir, 'best-self-backup-2026-10-30.json');
      const backupState = stateWith({ habits: coreHabits('2026-10-01'), completions: { '2026-11-03': { push: true, walk: true } } });
      fs.writeFileSync(backup, JSON.stringify(backupState));
      const notes = path.join(dir, 'notes.json');
      fs.writeFileSync(notes, JSON.stringify({ title: 'Groceries', items: ['milk', 'eggs'] }));
      const broken = path.join(dir, 'broken.json');
      fs.writeFileSync(broken, 'this is not JSON at all');

      const app = await t.open({ state: lived() });
      const before = await app.stored();
      await openSettings(app);
      await chooseImport(app, notes);
      assert.ok(await app.page.getByText('Invalid backup file format').isVisible(), 'a JSON file that is not a backup is refused');
      assert.deepEqual(await app.stored(), before, 'nothing changed');
      await chooseImport(app, broken);
      assert.ok(await app.page.getByText('Failed to parse backup file').isVisible(), 'a file that is not JSON is refused');
      assert.deepEqual(await app.stored(), before, 'nothing changed');
      assert.ok(await dialog(app).isVisible(), 'Settings stays open to try again');
      await app.press('Escape');
      assert.equal(await dialog(app).count(), 0, 'Escape closes Settings');
      assert.equal(await rowChecked(app, 'Meditate'), true, 'Today is as it was');

      await openSettings(app);
      await chooseImport(app, backup);
      assert.ok(await app.page.getByText('Data imported successfully!').isVisible());
      await app.wait(1700);
      assert.deepEqual((await app.habitRows()).filter((r) => r.checked).map((r) => r.text), ['Push Day', '5K Walk']);
      assert.deepEqual((await app.stored()).completions, backupState.completions);
      app.assertNoErrors();
    },
  },

  {
    name: 'a backup exported in the evening is named for that day',
    run: async (t) => {
      const app = await t.open({ state: lived(), now: '2026-11-03T20:30:00' });
      const { name } = await exportBackup(app, scratch());
      assert.equal(name, 'best-self-backup-2026-11-03.json', 'the file is named for the day it was exported');
      app.assertNoErrors();
    },
  },

  ...both('Start over: Keep everything keeps it all; Clear and start over begins again with the core list', async (t, width) => {
    const app = await t.open({ state: lived({ darkMode: true }), width });
    const before = await app.stored();
    // Wander off today first: a past day, then Insights.
    await app.tap(app.weekDay(1));
    await app.tap(nav(app, 'Insights'));
    await openSettings(app);
    await app.press('Escape');
    assert.equal(await dialog(app).count(), 0, 'Escape closes Settings');
    await openSettings(app);

    await app.tap(app.button('Start over'));
    assert.ok(await app.page.getByText(/Clear every habit, check and task on this device/).isVisible(), 'Start over asks first');
    if (app.phone) await app.assertNoHorizontalScroll('on the Start over question');
    await app.tap(app.button('Keep everything'));
    assert.equal(await app.page.getByText(/Clear every habit, check and task/).count(), 0, 'the question goes');
    assert.ok(await app.button('Start over').isVisible(), 'Start over is offered again');
    assert.deepEqual(await app.stored(), before, 'Keep everything changes nothing');

    await app.tap(app.button('Start over'));
    await app.tap(app.button('Clear and start over'));
    assert.equal(await dialog(app).count(), 0, 'Settings closes');
    await expectToday(app, TUESDAY, 'after starting over');
    assert.ok((await app.habitRows()).every((r) => !r.checked), 'nothing is checked');
    assert.equal(await app.page.getByText('Renew passport').count(), 0, 'the old task is gone');
    assert.equal(await app.button('Back to today').count(), 0, 'Today is on today');
    assertFreshCore(await app.stored(), { dark: true });
    await expectTheme(app, true, 'after starting over');
    if (app.phone) await app.assertNoHorizontalScroll('after starting over');

    await app.reload();
    assert.equal(await begin(app).count(), 0, 'no welcome after starting over');
    await expectToday(app, TUESDAY, 'after a reload');
    await app.tap(nav(app, 'Insights'));
    assert.ok(await app.page.getByText('Insights fill in as you check things off.').isVisible(), 'Insights starts empty');
    app.assertNoErrors();
  }),
];
