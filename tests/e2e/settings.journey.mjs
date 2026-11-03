// Settings, the keyboard, reduced motion, the phone's layout, and time zones.
// Unless a journey says otherwise: the owner's core list (begun Oct 1) on Tue Nov 3, 08:00 in Los Angeles.
import { assert, stateWith, coreHabits, habit } from './harness.mjs';

const both = (name, run) => [1440, 375].map((width) => ({ name: `${name} (${width})`, run: (t) => run(t, width) }));
const TUESDAY = ['Push Day', '5K Walk', 'Study 1 Hour', 'Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet'];
const core = (settings = {}, since = '2026-10-01') => stateWith({ habits: coreHabits(since), settings });

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// `n` consecutive calendar days from `from` ('YYYY-MM-DD'), counted in UTC so no zone can bend them.
const days = (from, n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
});
// Every habit checked on each of its days from `from` to `to`, as a person who kept them would have.
function keptScheduled(habits, from, to) {
  const out = {};
  for (let d = new Date(`${from}T12:00:00`); d <= new Date(`${to}T12:00:00`); d.setDate(d.getDate() + 1)) {
    const ids = habits.filter((h) => h.recurrence.type === 'daily' || h.recurrence.days.includes(d.getDay())).map((h) => h.id);
    if (ids.length) out[dateKey(d)] = Object.fromEntries(ids.map((id) => [id, true]));
  }
  return out;
}

const dialog = (app, name) => app.page.getByRole('dialog', { name });
const inDialog = (app, name, button) => dialog(app, name).getByRole('button', { name: button, exact: true });
// The phone's bottom bar buttons read "☰Settings" and so on; the desktop header has the bare word.
const navButton = (app, name) => (app.phone ? app.page.getByRole('button', { name: new RegExp(`${name}$`) }).first() : app.button(name));
const monthSheetButton = (app) => app.page.getByRole('button', { name: /▼/ });
const darkSwitch = (app) => dialog(app, 'Settings').getByRole('switch', { name: 'Dark Mode' });
const slider = (app) => dialog(app, 'Settings').locator('input[type="range"]');
const blockName = (app, n) => dialog(app, 'Settings').getByLabel(`Name of block ${n}`, { exact: true });
const row = (app, text) => app.page.locator(`[data-habit-row="${text}"]`);

async function openSettings(app) {
  await app.tap(navButton(app, 'Settings'));
  await dialog(app, 'Settings').waitFor();
  if (app.phone) await app.assertNoHorizontalScroll('in Settings');
}
async function saveSettings(app) {
  await app.tap(inDialog(app, 'Settings', 'Save Settings'));
  assert.equal(await dialog(app, 'Settings').count(), 0, 'Settings closes on Save');
}
// Select what is in a field and type over it.
async function retype(app, field, text) {
  await app.tap(field);
  await app.page.keyboard.press('Control+A');
  await app.page.keyboard.press('Backspace');
  if (text) await app.type(text);
}
// A tap that does not wait afterwards, so what is on screen a frame later can be read.
async function tapNow(app, loc) {
  await loc.evaluate((e) => e.scrollIntoView({ block: 'center', inline: 'center' }));
  const b = await loc.boundingBox();
  if (app.phone) await app.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  else await app.page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await app.page.waitForTimeout(60); // a few real frames (the page's own rAF runs on the test clock); a 250ms motion is still mid-way
}

// The section titles on Today, in order.
const blockTitles = (app) => app.page.evaluate(() => [...new Set([...document.querySelectorAll('[data-habit-row]')].map((r) => r.parentElement.firstElementChild.textContent.trim()))]);
// The day's count beside the Impossible Figure: "4/7", or ✓ once the day is done; and the figure's own words.
const progress = (app) => app.page.evaluate(() => {
  const fig = [...document.querySelectorAll('svg[role="img"]')].find((s) => /^\d+ of \d+ habits/.test(s.getAttribute('aria-label') || ''));
  return { text: fig?.nextElementSibling?.textContent.trim() ?? null, label: fig?.getAttribute('aria-label') ?? null };
});
// Is a week-strip day's dot filled in (a complete day)?
const dotFilled = (app, key) => app.page.locator(`[data-week-day="${key}"] > div`).evaluate((d) => getComputedStyle(d).backgroundColor !== 'rgba(0, 0, 0, 0)');
// Is a calendar day struck through?
const struck = (app, key) => app.page.locator(`[data-calendar-day="${key}"] rect[transform]`).count().then((n) => n > 0);
const dayStreak = (app) => app.page.evaluate(() => [...document.querySelectorAll('div')].find((d) => d.textContent === 'Day streak' && !d.children.length)?.previousElementSibling?.textContent.trim());

// The week strip, left to right.
const week = (app) => app.page.evaluate(() => [...document.querySelectorAll('[data-week-day]')].map((e) => ({
  key: e.getAttribute('data-week-day'), n: Number(e.querySelector('[data-date-number]').textContent), current: e.getAttribute('aria-current') === 'date', label: e.getAttribute('aria-label'),
})));
// The month calendar: the month it names, and its 42 cells with which is selected and which is today.
const calendar = (app) => app.page.evaluate(() => {
  const cells = [...document.querySelectorAll('[data-calendar-day]')].map((g) => ({
    key: g.getAttribute('data-calendar-day'),
    inMonth: g.getAttribute('data-in-month') === 'true',
    n: Number(g.getAttribute('data-date-number')),
    selected: [...g.querySelectorAll('rect')].filter((r) => !r.getAttribute('transform')).length === 2,
    today: g.querySelector('text').style.fontWeight === '500',
  }));
  const name = [...document.querySelectorAll('[role="button"][aria-pressed]')].map((e) => e.textContent.trim()).find((t) => /^[A-Z][a-z]+ \d{4}$/.test(t)) || null;
  return { month: name, cells };
});

// What has focus: its name, whether the browser draws a ring round it, and where it sits.
const focusInfo = (app) => app.page.evaluate(() => {
  const e = document.activeElement;
  if (!e || e === document.body || e === document.documentElement) return { name: null };
  const cs = getComputedStyle(e);
  const r = e.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const cal = document.querySelector('[data-calendar-day]')?.closest('svg')?.parentElement?.parentElement;
  return {
    name: e.getAttribute('aria-label') || e.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) || e.getAttribute('placeholder') || e.tagName,
    tag: e.tagName.toLowerCase(),
    type: e.getAttribute('type'),
    role: e.getAttribute('role'),
    ring: e.matches(':focus-visible') && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0,
    textField: e.tagName === 'INPUT' && (e.type === 'text' || e.type === 'search'),
    inDialog: Boolean(e.closest('[role="dialog"]')),
    dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
    inCalendar: Boolean(cal && cal.contains(e)),
    calendarDay: e.closest('[data-calendar-day]')?.getAttribute('data-calendar-day') || null,
    habitRow: e.getAttribute('data-habit-row'),
    visible: r.width > 0 && r.height > 0 && Boolean(hit) && (hit === e || e.contains(hit) || hit.contains(e)),
  };
});
// Press Tab (or Shift+Tab) until `match` has focus; every stop on the way is returned.
async function tabTo(app, match, { back = false, max = 40, what = 'it' } = {}) {
  const stops = [];
  for (let i = 0; i < max; i++) {
    await app.page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
    const f = await focusInfo(app);
    stops.push(f);
    if (match(f)) return stops;
  }
  throw new Error(`${back ? 'Shift+Tab' : 'Tab'} never reached ${what}; it went: ${stops.map((s) => s.name).join(' | ')}`);
}
const isFocused = (loc) => loc.evaluate((e) => e === document.activeElement);
// The page's background once its 300ms change of colour has run.
const pageBg = async (app) => { await app.wait(350); return app.page.evaluate(() => getComputedStyle(document.body).backgroundColor); };

// Text that runs off the screen, or out of a box that clips it.
const clippedText = (app) => app.page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  const hidden = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return true;
    }
    return false;
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!node.textContent.trim() || !el || hidden(el)) continue;
    let left = 0;
    let right = vw;
    let scrolls = false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.position === 'fixed') break;
      // Text in a sideways scroller (the year grid) is within reach by scrolling it; a modal is checked on its own.
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 1 && !n.matches('[role="dialog"]')) { scrolls = true; break; }
      if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip') && n.tagName !== 'svg') {
        const b = n.getBoundingClientRect();
        left = Math.max(left, b.left);
        right = Math.min(right, b.right);
      }
    }
    if (scrolls) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (r.width && (r.left < left - 1 || r.right > right + 1)) {
        out.push(`"${node.textContent.trim().slice(0, 50)}" spans ${Math.round(r.left)}–${Math.round(r.right)}px, room ${Math.round(left)}–${Math.round(right)}px`);
        break;
      }
    }
  }
  return out;
});
// A habit row's name running into its minutes.
const rowOverlaps = (app) => app.page.evaluate(() => [...document.querySelectorAll('[data-habit-row]')].flatMap((r) => {
  const spans = [...r.children].filter((c) => c.tagName === 'SPAN');
  const [name, minutes] = [spans[0], spans.find((s) => /^\d+ min$/.test(s.textContent.trim()))];
  if (!name || !minutes) return [];
  const a = name.getBoundingClientRect();
  const b = minutes.getBoundingClientRect();
  return a.right > b.left + 1 ? [`${name.textContent.slice(0, 40)} runs into "${minutes.textContent}"`] : [];
}));
async function fits(app, where) {
  await app.assertNoHorizontalScroll(where);
  assert.deepEqual(await clippedText(app), [], `text is cut off ${where}`);
  const sideways = await app.page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map((d) => d.scrollWidth - d.clientWidth).filter((o) => o > 1));
  assert.deepEqual(sideways, [], `a modal scrolls sideways ${where}`);
}

// Dark mode: the page is near-black, no big panel is left white, and no text is dark ink on it.
const darkProblems = async (app) => { await app.wait(350); return app.page.evaluate(() => {
  const out = [];
  const body = getComputedStyle(document.body).backgroundColor;
  if (body !== 'rgb(10, 10, 10)') out.push(`page background ${body}`);
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    const bg = (cs.backgroundColor.match(/[\d.]+/g) || []).map(Number);
    if (bg.length >= 3 && (bg.length === 3 || bg[3] > 0.5) && Math.min(bg[0], bg[1], bg[2]) > 200 && r.width * r.height > 30000) {
      out.push(`light panel ${el.tagName} ${Math.round(r.width)}x${Math.round(r.height)} "${el.textContent.trim().slice(0, 30)}"`);
    }
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText && !(el instanceof SVGElement)) {
      const c = cs.color.match(/[\d.]+/g).map(Number);
      if (c.length === 4 && c[3] === 0) continue; // transparent ink: the louvered numeral's outline is drawn by its stroke
      let under = 'rgba(0, 0, 0, 0)';
      for (let n = el; n && under.startsWith('rgba') && under.endsWith(', 0)'); n = n.parentElement) under = getComputedStyle(n).backgroundColor;
      const ub = (under.match(/[\d.]+/g) || [10, 10, 10]).map(Number);
      if (Math.max(c[0], c[1], c[2]) < 60 && Math.max(ub[0], ub[1], ub[2]) < 60) out.push(`dark ink "${el.textContent.trim().slice(0, 30)}" (${cs.color})`);
    }
  }
  return out;
}); };

export default [
  // ---------------------------------------------------------------- opening and closing Settings

  ...both('Settings opens, Escape closes it and gives focus back, and × and the backdrop close it too', async (t, width) => {
    const app = await t.open({ state: core(), width });
    await openSettings(app);
    assert.ok(await isFocused(inDialog(app, 'Settings', 'Close')), 'focus moves into Settings, onto its close button');
    await app.press('Escape');
    assert.equal(await dialog(app, 'Settings').count(), 0, 'Escape closes Settings');
    assert.ok(await isFocused(navButton(app, 'Settings')), 'focus goes back to the Settings button');

    await openSettings(app);
    await app.tap(inDialog(app, 'Settings', 'Close'));
    assert.equal(await dialog(app, 'Settings').count(), 0, '× closes Settings');

    await openSettings(app);
    if (app.phone) await app.page.touchscreen.tap(8, 8);
    else await app.page.mouse.click(60, 60);
    await app.wait(300);
    assert.equal(await dialog(app, 'Settings').count(), 0, 'a tap on the backdrop closes Settings');

    // From Insights, Settings opens over Insights and closes back onto it.
    await app.tap(navButton(app, 'Insights'));
    await app.page.getByText('Day streak', { exact: true }).waitFor();
    await openSettings(app);
    await app.press('Escape');
    assert.ok(await app.page.getByText('Day streak', { exact: true }).isVisible(), 'Insights is still there after Settings closes');
    assert.deepEqual(await app.habitRows(), [], 'and Today did not come back in its place');
    app.assertNoErrors();
  }),

  {
    name: 'on the phone, Settings from the bottom bar closes the month sheet first (375)',
    run: async (t) => {
      const app = await t.open({ state: core(), width: 375 });
      await app.tap(monthSheetButton(app));
      assert.ok(await app.calendarDay(3).count(), 'the month sheet is open');
      await openSettings(app);
      assert.equal(await app.calendarDay(3).count(), 0, 'the sheet closed as Settings opened');
      await app.press('Escape');
      assert.equal(await dialog(app, 'Settings').count(), 0);
      assert.deepEqual((await app.habitRows()).map((r) => r.text), TUESDAY, 'Today is as it was');
      app.assertNoErrors();
    },
  },

  // ---------------------------------------------------------------- Dark Mode

  ...both('Dark Mode: Save turns the page dark at once and it stays dark after a reload; off again is light', async (t, width) => {
    const app = await t.open({ state: core(), width });
    await openSettings(app);
    assert.equal(await darkSwitch(app).getAttribute('aria-checked'), 'false');
    await app.tap(darkSwitch(app));
    assert.equal(await darkSwitch(app).getAttribute('aria-checked'), 'true', 'the switch shows the choice');
    await saveSettings(app);
    assert.deepEqual(await darkProblems(app), [], 'Today is dark as soon as Settings is saved');
    assert.equal(await row(app, 'Push Day').locator('span').first().evaluate((s) => getComputedStyle(s).color), 'rgb(255, 255, 255)', 'habit names are white ink');
    assert.equal((await app.stored()).settings.darkMode, true, 'the choice is saved');
    if (app.phone) await app.assertNoHorizontalScroll('in dark mode');

    await app.reload();
    assert.deepEqual(await darkProblems(app), [], 'still dark after a reload');
    await openSettings(app);
    assert.equal(await darkSwitch(app).getAttribute('aria-checked'), 'true', 'Settings shows Dark Mode on');
    assert.deepEqual(await darkProblems(app), [], 'Settings is dark');
    await app.tap(darkSwitch(app));
    await saveSettings(app);
    assert.equal(await pageBg(app), 'rgb(255, 255, 255)', 'light again once saved');
    assert.equal((await app.stored()).settings.darkMode, false);
    await app.reload();
    assert.equal(await pageBg(app), 'rgb(255, 255, 255)', 'and light after a reload');
    app.assertNoErrors();
  }),

  ...both('a Settings change closed with Escape or × is not kept', async (t, width) => {
    const app = await t.open({ state: core(), width });
    await openSettings(app);
    await app.tap(darkSwitch(app));
    await app.press('Escape');
    assert.equal((await app.stored()).settings.darkMode, false, 'Escape saved nothing');
    assert.equal(await pageBg(app), 'rgb(255, 255, 255)', 'the page stays light');
    await openSettings(app);
    assert.equal(await darkSwitch(app).getAttribute('aria-checked'), 'false', 'Settings opens on what was saved, not on the abandoned change');
    await app.tap(darkSwitch(app));
    await app.tap(inDialog(app, 'Settings', 'Close'));
    assert.equal((await app.stored()).settings.darkMode, false, '× saved nothing either');
    app.assertNoErrors();
  }),

  {
    name: 'Dark Mode from the keyboard: Tab to Settings, Enter, Tab to the switch, Space, Tab to Save, Enter',
    run: async (t) => {
      const app = await t.open({ state: core() });
      await tabTo(app, (f) => f.name === 'Settings', { what: 'the Settings button' });
      await app.press('Enter');
      await dialog(app, 'Settings').waitFor();
      assert.equal((await focusInfo(app)).name, 'Close', 'focus is on Settings\' close button');
      await tabTo(app, (f) => f.role === 'switch' && f.name === 'Dark Mode', { max: 3, what: 'the Dark Mode switch' });
      await app.press('Space');
      assert.equal(await darkSwitch(app).getAttribute('aria-checked'), 'true', 'Space turns the switch on');
      await app.press('Space');
      assert.equal(await darkSwitch(app).getAttribute('aria-checked'), 'false', 'and off');
      await app.press('Enter');
      assert.equal(await darkSwitch(app).getAttribute('aria-checked'), 'true', 'Enter turns it on as well');
      await tabTo(app, (f) => f.name === 'Save Settings', { what: 'Save Settings' });
      await app.press('Enter');
      assert.equal(await dialog(app, 'Settings').count(), 0, 'Enter on Save closes Settings');
      assert.deepEqual(await darkProblems(app), [], 'and the page is dark');
      assert.equal((await focusInfo(app)).name, 'Settings', 'focus is back on the Settings button');
      await app.reload();
      assert.deepEqual(await darkProblems(app), [], 'dark after a reload');
      app.assertNoErrors();
    },
  },

  // ---------------------------------------------------------------- Completion threshold

  ...both('lowering the completion threshold to 50% makes a 4 of 7 day complete', async (t, width) => {
    const habits = coreHabits('2026-10-01');
    const completions = {
      ...keptScheduled(habits, '2026-10-01', '2026-11-01'),
      '2026-11-02': { cycling: true, walk: true, study1: true, meditate: true },
      '2026-11-03': { push: true, walk: true, study1: true, meditate: true },
    };
    const app = await t.open({ state: stateWith({ habits, completions }), width });
    assert.deepEqual(await progress(app), { text: '4/7', label: '4 of 7 habits' }, 'at 80%, 4 of 7 is not a complete day');
    assert.equal(await dotFilled(app, '2026-11-03'), false);
    assert.equal(await dotFilled(app, '2026-11-02'), false);
    assert.equal(await dotFilled(app, '2026-11-01'), true, 'Sunday was kept');
    await app.tap(navButton(app, 'Insights'));
    assert.equal(await dayStreak(app), '0', 'no streak at 80%');
    await app.tap(navButton(app, 'Today'));

    await openSettings(app);
    assert.ok(await dialog(app, 'Settings').getByText('6 of 7', { exact: true }).isVisible(), 'the note says 6 of 7 at 80%');
    const b = await slider(app).boundingBox();
    if (app.phone) await app.page.touchscreen.tap(b.x + 2, b.y + b.height / 2);
    else await app.page.mouse.click(b.x + 2, b.y + b.height / 2);
    await app.wait(200);
    assert.equal(await slider(app).inputValue(), '50', 'the slider is at its lowest');
    assert.ok(await dialog(app, 'Settings').getByText('50%', { exact: true }).isVisible(), 'it reads 50%');
    assert.ok(await dialog(app, 'Settings').getByText('4 of 7', { exact: true }).isVisible(), 'and the note says 4 of 7');
    await saveSettings(app);

    assert.deepEqual(await progress(app), { text: '✓', label: '4 of 7 habits, day complete' }, 'today is now complete');
    assert.match((await app.shownDay()).louver, /^3, 4 of 7 habits done$/);
    assert.equal(await dotFilled(app, '2026-11-03'), true, 'today\'s dot fills');
    assert.equal(await dotFilled(app, '2026-11-02'), true, 'and Monday\'s, judged by the same threshold');
    if (!app.phone) {
      assert.equal(await struck(app, '2026-11-03'), true, 'the calendar strikes today');
      assert.equal(await struck(app, '2026-11-02'), true, 'and Monday');
    }
    assert.equal((await app.stored()).settings.completionThreshold, 0.5);
    await app.tap(navButton(app, 'Insights'));
    assert.equal(await dayStreak(app), '34', 'the streak runs from Oct 1 through today');
    await app.reload();
    await app.tap(navButton(app, 'Today'));
    assert.equal((await progress(app)).text, '✓', 'still complete after a reload');
    app.assertNoErrors();
  }),

  {
    name: 'the threshold slider moves with the arrow keys, and 100% needs every habit',
    run: async (t) => {
      const completions = { '2026-11-03': { push: true, walk: true, study1: true, meditate: true, read: true, water: true } };
      const app = await t.open({ state: stateWith({ habits: coreHabits('2026-10-01'), completions }) });
      assert.equal((await progress(app)).text, '✓', '6 of 7 is complete at 80%');
      await openSettings(app);
      await tabTo(app, (f) => f.type === 'range', { max: 5, what: 'the threshold slider' });
      await app.press('End');
      assert.equal(await slider(app).inputValue(), '100');
      await app.press('ArrowLeft');
      assert.equal(await slider(app).inputValue(), '99', 'one step at a time');
      await app.press('ArrowRight');
      assert.ok(await dialog(app, 'Settings').getByText('7 of 7', { exact: true }).isVisible(), 'the note says 7 of 7 at 100%');
      await saveSettings(app);
      assert.deepEqual(await progress(app), { text: '6/7', label: '6 of 7 habits' }, 'at 100%, 6 of 7 is not complete');
      assert.equal(await dotFilled(app, '2026-11-03'), false);
      await app.tap(row(app, 'Healthy Diet'));
      assert.equal((await progress(app)).text, '✓', 'the seventh completes it');
      app.assertNoErrors();
    },
  },

  // ---------------------------------------------------------------- Time blocks

  ...both('time blocks: Morning renamed Dawn and Evening moved to the top show on Today after Save; Escape abandons an edit', async (t, width) => {
    const app = await t.open({ state: core(), width });
    assert.deepEqual(await blockTitles(app), ['Morning', 'Post-Work', 'Evening']);
    await openSettings(app);
    await retype(app, blockName(app, 1), 'Dawn');
    for (const at of [4, 3, 2, 1]) await app.tap(dialog(app, 'Settings').getByRole('button', { name: 'Move up' }).nth(at));
    const names = async () => Promise.all([1, 2, 3, 4, 5].map((n) => blockName(app, n).inputValue()));
    assert.deepEqual(await names(), ['Evening', 'Dawn', 'Pre-Work', 'Afternoon', 'Post-Work'], 'the editor shows the new order');
    assert.equal(await dialog(app, 'Settings').getByRole('button', { name: 'Move up' }).first().isDisabled(), true, 'the top block cannot move up');
    if (app.phone) await app.assertNoHorizontalScroll('in the time block editor');
    await saveSettings(app);

    assert.deepEqual(await blockTitles(app), ['Evening', 'Dawn', 'Post-Work'], 'Today follows the new names and order');
    assert.deepEqual((await app.habitRows()).map((r) => r.text), ['Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet', 'Push Day', '5K Walk', 'Study 1 Hour']);
    const saved = (await app.stored()).settings;
    assert.equal(saved.timeBlockLabels.morning, 'Dawn');
    assert.deepEqual(saved.timeBlockOrder, ['evening', 'morning', 'prework', 'afternoon', 'postwork']);
    if (!app.phone) assert.ok(await app.page.getByText('Dawn', { exact: true }).first().isVisible(), 'the Schedule names the block Dawn');
    // The habit editor offers the blocks by their new names, in the new order.
    await app.tap(app.button('New habit'));
    const pills = await dialog(app, 'New habit').getByRole('button').allTextContents();
    assert.deepEqual(pills.filter((p) => ['Evening', 'Dawn', 'Pre-Work', 'Afternoon', 'Post-Work'].includes(p)), ['Evening', 'Dawn', 'Pre-Work', 'Afternoon', 'Post-Work'], 'the editor lists the blocks in the new order');
    await app.press('Escape');

    // Escape abandons an edit.
    await openSettings(app);
    await retype(app, blockName(app, 2), 'Sunrise');
    await app.press('Escape');
    assert.equal(await dialog(app, 'Settings').count(), 0, 'Escape in a block name closes Settings');
    assert.deepEqual(await blockTitles(app), ['Evening', 'Dawn', 'Post-Work'], 'and Today keeps Dawn');
    assert.equal((await app.stored()).settings.timeBlockLabels.morning, 'Dawn');
    await openSettings(app);
    assert.equal(await blockName(app, 2).inputValue(), 'Dawn', 'Settings opens on what was saved');

    // A name left empty goes back to the block's own name.
    await retype(app, blockName(app, 2), '');
    await saveSettings(app);
    assert.deepEqual(await blockTitles(app), ['Evening', 'Morning', 'Post-Work'], 'an empty name is Morning again');
    await app.reload();
    assert.deepEqual(await blockTitles(app), ['Evening', 'Morning', 'Post-Work'], 'the order survives a reload');
    app.assertNoErrors();
  }),

  {
    name: 'on the desktop a time block can be dragged into a new order (1440)',
    run: async (t) => {
      const app = await t.open({ state: core() });
      await openSettings(app);
      const grip = (n) => blockName(app, n).locator('xpath=..').locator('span').first();
      await grip(5).dragTo(grip(1));
      await app.wait(200);
      assert.equal(await blockName(app, 1).inputValue(), 'Evening', 'Evening, dropped on the first row, is first');
      await saveSettings(app);
      assert.deepEqual(await blockTitles(app), ['Evening', 'Morning', 'Post-Work']);
      app.assertNoErrors();
    },
  },

  // ---------------------------------------------------------------- The keyboard

  {
    name: 'keyboard only: check a habit, go to tomorrow, back to today, open and close Settings, with focus always shown',
    run: async (t) => {
      const app = await t.open({ state: core() });
      const stops = await tabTo(app, (f) => f.habitRow === 'Push Day', { what: 'the first habit' });
      assert.deepEqual(stops.filter((s) => !s.ring || !s.visible).map((s) => s.name), [], 'every stop on the way shows its focus ring and is on screen');
      await app.press('Space');
      assert.equal((await app.habitRows()).find((r) => r.text === 'Push Day').checked, true, 'Space checks it');
      assert.equal((await app.stored()).completions['2026-11-03'].push, true);

      await tabTo(app, (f) => f.name === 'Next day', { back: true, max: 15, what: 'Next day' });
      await app.press('Enter');
      const shown = await app.shownDay();
      assert.equal(shown.header, 'Wed, November 4', `Enter on Next day shows tomorrow: ${JSON.stringify(shown)}`);
      await tabTo(app, (f) => f.name === 'Back to today', { max: 3, what: 'Back to today' });
      await app.press('Enter');
      assert.equal((await app.shownDay()).header, 'Tue, November 3', 'Enter on Today comes back');
      assert.equal((await app.habitRows()).find((r) => r.text === 'Push Day').checked, true, 'with the check still there');

      const back = await tabTo(app, (f) => f.name === 'Settings', { back: true, max: 30, what: 'Settings' });
      assert.deepEqual(back.filter((s) => s.name && (!s.ring || !s.visible)).map((s) => s.name), [], 'focus is shown on the way back too');
      await app.press('Enter');
      await dialog(app, 'Settings').waitFor();
      const inside = await focusInfo(app);
      assert.ok(inside.inDialog && inside.ring, `focus is inside Settings and shown: ${JSON.stringify(inside)}`);
      await app.press('Escape');
      let f = await focusInfo(app);
      assert.ok(f.name === 'Settings' && f.ring, `Escape gives focus back to Settings, shown: ${JSON.stringify(f)}`);
      await app.press('Enter');
      await dialog(app, 'Settings').waitFor();
      await app.press('Enter');
      assert.equal(await dialog(app, 'Settings').count(), 0, 'Enter on × closes Settings');
      f = await focusInfo(app);
      assert.equal(f.name, 'Settings', 'and focus is back on Settings');
      app.assertNoErrors();
    },
  },

  {
    name: 'every control in Settings shows where the keyboard is',
    run: async (t) => {
      const app = await t.open({ state: core() });
      await openSettings(app);
      const stops = await tabTo(app, (f) => f.name === 'Save Settings', { what: 'Save Settings' });
      const unseen = stops.filter((s) => !s.textField && !s.ring).map((s) => `${s.name} (${s.tag}${s.type ? ` ${s.type}` : ''})`);
      assert.deepEqual(unseen, [], 'each control Tab lands on shows a focus ring (a text field shows its caret)');
      app.assertNoErrors();
    },
  },

  ...both('Tab and Shift+Tab stay inside an open modal, so the page behind is never acted on', async (t, width) => {
    const app = await t.open({ state: core(), width });
    const escapes = [];
    const stillIn = async (how) => { const f = await focusInfo(app); if (!f.inDialog) escapes.push(`${how} -> ${f.name === null ? 'the page itself' : `"${f.name}"`} behind it`); };
    await openSettings(app);
    await tabTo(app, (f) => f.name === 'Save Settings', { what: 'Save Settings' });
    await app.page.keyboard.press('Tab');
    await stillIn('Settings: Tab past Save Settings');
    await app.page.keyboard.press('Tab');
    await stillIn('Settings: Tab twice past Save Settings');
    await inDialog(app, 'Settings', 'Close').focus();
    await app.page.keyboard.press('Shift+Tab');
    await stillIn('Settings: Shift+Tab from ×');
    await app.press('Escape');

    await app.tap(app.button('New habit'));
    await dialog(app, 'New habit').waitFor();
    await app.page.keyboard.press('Shift+Tab');
    await app.page.keyboard.press('Shift+Tab');
    await stillIn('the habit editor: Shift+Tab twice from the name');
    await app.press('Escape');
    assert.deepEqual(escapes, [], 'focus leaves the open modal');
    app.assertNoErrors();
  }),

  {
    name: 'the desktop month calendar can be paged and a day picked from the keyboard',
    run: async (t) => {
      const app = await t.open({ state: core() });
      const stops = await tabTo(app, (f) => f.inCalendar && /›|next month/i.test(f.name), { max: 40, what: 'the calendar\'s next-month arrow' });
      assert.ok(stops.at(-1).ring, 'the arrow shows its focus');
      await app.press('Enter');
      assert.equal((await calendar(app)).month, 'December 2026', 'Enter on › shows December');
      await tabTo(app, (f) => f.calendarDay === '2026-12-01', { max: 10, what: 'December 1 in the calendar' });
      await app.press('Enter');
      assert.equal((await app.shownDay()).header, 'Tue, December 1', 'Enter on a day in the calendar shows that day');
      app.assertNoErrors();
    },
  },

  // ---------------------------------------------------------------- Reduced motion

  ...both('with reduced motion, completing a day, turning the month and opening modals land at once, nothing half-way', async (t, width) => {
    const app = await t.open({ state: core(), width, reducedMotion: 'reduce' });
    for (const text of TUESDAY.slice(0, 5)) await app.tap(row(app, text));
    await tapNow(app, row(app, TUESDAY[5]));
    const struckNow = await app.page.evaluate((phone) => {
      const bars = [...document.querySelectorAll('[role="img"][aria-label$="habits done"] > div')];
      return bars.map((b) => {
        const cs = getComputedStyle(b);
        const m = (cs.transform.match(/matrix\(([^)]+)\)/)?.[1] || '1,0').split(',').map(Number);
        return { opacity: Number(cs.opacity), scale: Math.round(Math.hypot(m[0], m[1]) * 100) / 100, phone };
      });
    }, app.phone);
    assert.deepEqual(struckNow.map(({ opacity, scale }) => ({ opacity, scale })), [{ opacity: 1, scale: 1 }, { opacity: 1, scale: 1 }], 'the strike is whole a frame after the check that completes the day');
    assert.equal((await progress(app)).label, '6 of 7 habits, day complete');
    await tapNow(app, row(app, TUESDAY[6]));
    const slats = await app.page.evaluate(() => [...document.querySelectorAll('.louver-slat')].map((s) => getComputedStyle(s).transform));
    assert.equal(slats.length, 7);
    assert.deepEqual(slats.filter((m) => m !== 'none' && m !== 'matrix(1, 0, 0, 1, 0, 0)'), [], 'every slat lies flat a frame after the last check');
    assert.equal((await progress(app)).text, '✓');

    // The Turn: one press stands the month up at once; another lays it flat.
    if (app.phone) await app.tap(monthSheetButton(app));
    const monthName = app.page.getByRole('button', { name: /^November 2026\./ });
    await tapNow(app, monthName);
    assert.equal(await monthName.getAttribute('aria-pressed'), 'true');
    const elevation = app.page.locator('svg[role="img"][aria-label^="Chapter"]');
    assert.equal(await elevation.count(), 1, 'the elevation is drawn at once');
    assert.equal(await elevation.locator('> g').last().getAttribute('opacity'), '1', 'with its chapter caption fully shown');
    await tapNow(app, monthName);
    assert.equal(await elevation.count(), 0, 'a second press lays it flat at once');
    assert.ok(await app.calendarDay(3).count(), 'the plan is back');
    if (app.phone) { await app.press('Escape'); assert.equal(await app.calendarDay(3).count(), 0, 'Escape closes the sheet'); }

    // Modals and the habit page arrive whole.
    await tapNow(app, navButton(app, 'Settings'));
    assert.ok(await dialog(app, 'Settings').isVisible(), 'Settings is open at once');
    await tapNow(app, darkSwitch(app));
    const knob = await darkSwitch(app).locator('div').evaluate((k) => getComputedStyle(k).transform);
    assert.equal(knob, 'matrix(1, 0, 0, 1, 20, 0)', 'the switch knob is across at once');
    await app.press('Escape');
    await tapNow(app, app.button('New habit'));
    assert.ok(await dialog(app, 'New habit').isVisible(), 'the editor is open at once');
    await app.press('Escape');
    await app.tap(navButton(app, 'Insights'));
    await tapNow(app, app.page.getByRole('button', { name: 'Meditate', exact: true }));
    const page = await app.page.locator('.fade-in').first().evaluate((e) => getComputedStyle(e).opacity);
    assert.equal(page, '1', 'the habit page is fully shown at once');
    app.assertNoErrors();
  }),

  // ---------------------------------------------------------------- Layout at phone width

  {
    name: 'at 375 no screen scrolls sideways or cuts text off, with long habit names (375)',
    run: async (t) => {
      const habits = [
        ...coreHabits('2026-10-01'),
        habit('journal', 'Write three pages in the journal before looking at the phone or reading the news', { minutes: 20, order: 5 }),
        habit('spine', 'Wirbelsäulengymnastik und Rückenübungen nach dem Abendessen', { block: 'evening', minutes: 15, order: 4 }),
      ];
      const app = await t.open({ state: stateWith({ habits, completions: keptScheduled(habits, '2026-10-01', '2026-11-02') }), width: 375 });
      await fits(app, 'on Today');
      assert.deepEqual(await rowOverlaps(app), [], 'long names wrap clear of their minutes');
      await app.tap(row(app, 'Write three pages in the journal before looking at the phone or reading the news'));
      await fits(app, 'on Today with a long habit checked');

      await app.tap(monthSheetButton(app));
      await fits(app, 'in the month sheet');
      await app.press('Escape');

      await app.tap(navButton(app, 'Insights'));
      await app.page.getByText('Day streak', { exact: true }).waitFor();
      await fits(app, 'on Insights');

      await app.tap(app.page.getByRole('button', { name: /^Write three pages/ }));
      await app.page.getByRole('heading', { name: /^Write three pages/ }).waitFor();
      await fits(app, 'on a habit\'s page');
      await app.tap(app.button('Edit this habit'));
      await dialog(app, 'Edit habit').waitFor();
      await fits(app, 'in the habit editor');
      await app.tap(inDialog(app, 'Edit habit', 'Rest for a season'));
      await fits(app, 'in the editor with the rest choices open');
      await app.press('Escape');
      await app.press('Escape');

      await openSettings(app);
      await fits(app, 'in Settings');
      await app.tap(inDialog(app, 'Settings', 'Start over'));
      await fits(app, 'in Settings asking to start over');
      await app.tap(inDialog(app, 'Settings', 'Manage Habits'));
      await app.page.getByText('Manage habits', { exact: true }).waitFor();
      await fits(app, 'in Manage Habits');
      await app.tap(app.button('+ New habit'));
      await app.tap(inDialog(app, 'New habit', 'Specific days'));
      await fits(app, 'in a new habit\'s editor with the days showing');
      await app.press('Escape');
      app.assertNoErrors();
    },
  },

  ...both('in a sample year the banner never covers a modal\'s controls', async (t, width) => {
    const app = await t.open({ state: false, width });
    await app.tap(app.button('Look around a sample year first'));
    await app.page.getByText('A sample year, not saved', { exact: true }).waitFor();
    // Every control in a modal can be reached by a tap: what lies under its middle is the control itself.
    const covered = (name) => dialog(app, name).getByRole('button').evaluateAll((els) => els.flatMap((e) => {
      e.scrollIntoView({ block: 'nearest' });
      const r = e.getBoundingClientRect();
      if (!r.width) return [];
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit && (hit === e || e.contains(hit)) ? [] : [`${e.getAttribute('aria-label') || e.textContent.trim()} under ${hit?.textContent.trim().slice(0, 30)}`];
    }));
    await app.page.evaluate(() => window.scrollTo(0, 600));
    await app.wait(100);
    await openSettings(app);
    assert.deepEqual(await covered('Settings'), [], 'in Settings');
    await app.press('Escape');
    await app.tap(app.button('New habit'));
    await dialog(app, 'New habit').waitFor();
    assert.deepEqual(await covered('New habit'), [], 'in the habit editor');
    await app.tap(inDialog(app, 'New habit', 'Close'));
    if (app.phone) {
      await app.page.evaluate(() => window.scrollTo(0, 0));
      await app.tap(monthSheetButton(app));
      const monthName = app.page.getByRole('button', { name: /^November 2026\./ });
      const top = await monthName.evaluate((e) => { const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit === e || e.contains(hit); });
      assert.ok(top, 'the month sheet\'s month name is not under the banner');
      await fits(app, 'in the sample month sheet');
    }
    app.assertNoErrors();
  }),

  // ---------------------------------------------------------------- Dark mode on every screen

  ...both('in dark mode every screen is light ink on a dark page', async (t, width) => {
    const habits = coreHabits('2026-10-01');
    const app = await t.open({ state: stateWith({ habits, completions: keptScheduled(habits, '2026-10-01', '2026-11-02'), settings: { darkMode: true } }), width });
    assert.deepEqual(await darkProblems(app), [], 'on Today');
    if (app.phone) {
      await app.tap(monthSheetButton(app));
      assert.deepEqual(await darkProblems(app), [], 'in the month sheet');
      await app.press('Escape');
    }
    await app.tap(navButton(app, 'Insights'));
    await app.page.getByText('Day streak', { exact: true }).waitFor();
    assert.deepEqual(await darkProblems(app), [], 'on Insights');
    await app.tap(app.page.getByRole('button', { name: 'Meditate', exact: true }));
    await app.page.getByRole('heading', { name: 'Meditate' }).waitFor();
    assert.deepEqual(await darkProblems(app), [], 'on a habit\'s page');
    await app.tap(app.button('Edit this habit'));
    assert.deepEqual(await darkProblems(app), [], 'in the editor');
    await app.press('Escape');
    await openSettings(app);
    assert.deepEqual(await darkProblems(app), [], 'in Settings');
    await app.tap(inDialog(app, 'Settings', 'Manage Habits'));
    await app.page.getByText('Manage habits', { exact: true }).waitFor();
    assert.deepEqual(await darkProblems(app), [], 'in Manage Habits');
    if (app.phone) await app.assertNoHorizontalScroll('in Manage Habits, dark');
    app.assertNoErrors();
  }),

  // ---------------------------------------------------------------- Time zones and DST

  ...['Asia/Kolkata', 'Pacific/Auckland', 'America/Los_Angeles'].flatMap((tz) => both(`in ${tz}, late Sunday and just after midnight show the right week, month and day, and checks land on the local date`, async (t, width) => {
    for (const [now, day] of [
      ['2026-11-01T23:30:00', { key: '2026-11-01', wd: 'Sun', n: 1, habit: 'Rest Day', id: 'rest' }],
      ['2026-11-02T00:30:00', { key: '2026-11-02', wd: 'Mon', n: 2, habit: 'Cycling', id: 'cycling' }],
    ]) {
      const app = await t.open({ state: core(), width, tz, now });
      const shown = await app.shownDay();
      assert.equal(shown.weekday, day.wd, `at ${now}: ${JSON.stringify(shown)}`);
      assert.equal(shown.numeral, day.n, `at ${now}: ${JSON.stringify(shown)}`);
      const w = await week(app);
      assert.deepEqual(w.map((d) => d.key), days('2026-11-01', 7), `at ${now} the week strip is Sun Nov 1 to Sat Nov 7`);
      assert.deepEqual(w.map((d) => d.n), [1, 2, 3, 4, 5, 6, 7]);
      assert.deepEqual(w.filter((d) => d.current).map((d) => d.key), [day.key], `at ${now} the strip marks ${day.key}`);
      if (app.phone) await app.tap(monthSheetButton(app));
      const cal = await calendar(app);
      assert.equal(cal.month, 'November 2026');
      assert.deepEqual(cal.cells.map((c) => c.key), days('2026-11-01', 42), 'six weeks from Sun Nov 1, no day twice or missing');
      assert.deepEqual(cal.cells.filter((c) => c.inMonth).map((c) => c.n), Array.from({ length: 30 }, (_, i) => i + 1));
      assert.deepEqual(cal.cells.filter((c) => c.selected).map((c) => c.key), [day.key], 'the calendar circles the day');
      assert.deepEqual(cal.cells.filter((c) => c.today).map((c) => c.key), [day.key], 'and marks it as today');
      if (app.phone) { await app.press('Escape'); await app.assertNoHorizontalScroll(); }
      await app.tap(row(app, day.habit));
      const saved = (await app.stored()).completions;
      assert.deepEqual(Object.keys(saved), [day.key], `the check is stored under ${day.key}`);
      assert.equal(saved[day.key][day.id], true);
      app.assertNoErrors();
      await app.close();
    }
  })),

  ...both('the days around the US clock changes are each shown once: Nov 1 and Mar 8, 2026, in Los Angeles', async (t, width) => {
    for (const { now, since, weekFrom, gridFrom, length, month, back, prevWeekFrom, fwd } of [
      { now: '2026-11-01T12:00:00', since: '2026-10-01', weekFrom: '2026-11-01', gridFrom: '2026-11-01', length: 30, month: 'November 2026', back: 'Sat, October 31', prevWeekFrom: '2026-10-25', fwd: 'Mon, November 2' },
      { now: '2026-03-08T12:00:00', since: '2026-01-01', weekFrom: '2026-03-08', gridFrom: '2026-03-01', length: 31, month: 'March 2026', back: 'Sat, March 7', prevWeekFrom: '2026-03-01', fwd: 'Mon, March 9' },
    ]) {
      const app = await t.open({ state: core({}, since), width, now });
      assert.deepEqual((await week(app)).map((d) => d.key), days(weekFrom, 7), `the week of ${weekFrom}`);
      if (app.phone) await app.tap(monthSheetButton(app));
      const cal = await calendar(app);
      assert.equal(cal.month, month);
      assert.deepEqual(cal.cells.map((c) => c.key), days(gridFrom, 42), `${month}: every day once`);
      assert.equal(cal.cells.filter((c) => c.inMonth).length, length);
      if (app.phone) await app.press('Escape');
      await app.tap(app.button('Previous day'));
      const header = (wd) => (app.phone ? wd.replace(/^\w+, (\w{3})\w* (\d+)$/, '$1 $2') : wd);
      assert.equal((await app.shownDay()).header, header(back), 'Previous day goes back one day across the change');
      assert.deepEqual((await week(app)).map((d) => d.key), days(prevWeekFrom, 7), 'and the week before is whole');
      await app.tap(app.button('Next day'));
      await app.tap(app.button('Next day'));
      assert.equal((await app.shownDay()).header, header(fwd), 'Next day twice lands on Monday');
      await app.tap(app.button('Back to today'));
      await app.tap(row(app, 'Rest Day'));
      assert.deepEqual(Object.keys((await app.stored()).completions), [weekFrom], 'Sunday\'s check is stored under Sunday');
      app.assertNoErrors();
      await app.close();
    }
  }),

  {
    name: 'in Auckland, the weeks of its own clock changes (Apr 5 and Sep 27, 2026) are each whole',
    run: async (t) => {
      for (const { now, weekFrom, gridFrom, month } of [
        { now: '2026-04-05T12:00:00', weekFrom: '2026-04-05', gridFrom: '2026-03-29', month: 'April 2026' },
        { now: '2026-09-27T12:00:00', weekFrom: '2026-09-27', gridFrom: '2026-08-30', month: 'September 2026' },
      ]) {
        const app = await t.open({ state: core({}, '2026-01-01'), tz: 'Pacific/Auckland', now });
        assert.deepEqual((await week(app)).map((d) => d.key), days(weekFrom, 7));
        const cal = await calendar(app);
        assert.equal(cal.month, month);
        assert.deepEqual(cal.cells.map((c) => c.key), days(gridFrom, 42));
        assert.deepEqual(cal.cells.filter((c) => c.selected).map((c) => c.key), [weekFrom]);
        app.assertNoErrors();
        await app.close();
      }
    },
  },

  ...both('left open through the night the clocks go back, the next morning is Sunday, then Monday', async (t, width) => {
    const app = await t.open({ state: core(), width, now: '2026-10-31T23:30:00' });
    assert.equal((await app.shownDay()).weekday, 'Sat');
    await app.later('03:00:00'); // 01:30 PST: three hours on, because 1:00 to 2:00 came twice
    let shown = await app.shownDay();
    assert.deepEqual([shown.weekday, shown.numeral], ['Sun', 1], `after the clocks went back: ${JSON.stringify(shown)}`);
    assert.deepEqual((await week(app)).filter((d) => d.current).map((d) => d.key), ['2026-11-01']);
    await app.later('23:00:00'); // 00:30 Monday
    shown = await app.shownDay();
    assert.deepEqual([shown.weekday, shown.numeral], ['Mon', 2], `the next midnight: ${JSON.stringify(shown)}`);
    await app.tap(row(app, 'Cycling'));
    assert.deepEqual(Object.keys((await app.stored()).completions), ['2026-11-02']);
    app.assertNoErrors();
  }),

  {
    name: 'in Auckland, left open past midnight, the week strip and the calendar move to Monday with Today',
    run: async (t) => {
      const app = await t.open({ state: core(), tz: 'Pacific/Auckland', now: '2026-11-01T23:30:00' });
      await app.later('01:00:00');
      assert.equal((await app.shownDay()).header, 'Mon, November 2');
      assert.deepEqual((await week(app)).filter((d) => d.current).map((d) => d.key), ['2026-11-02']);
      const cal = await calendar(app);
      assert.deepEqual(cal.cells.filter((c) => c.selected).map((c) => c.key), ['2026-11-02'], 'the calendar circles Monday');
      assert.deepEqual(cal.cells.filter((c) => c.today).map((c) => c.key), ['2026-11-02'], 'and marks Monday as today');
      app.assertNoErrors();
    },
  },

  {
    name: 'on the desktop the month calendar follows the day into a new month: overnight on Oct 31, and Previous day from Nov 1 (1440)',
    run: async (t) => {
      const app = await t.open({ state: core(), now: '2026-10-31T23:30:00' });
      assert.equal((await calendar(app)).month, 'October 2026');
      const wrong = [];
      await app.later('01:00:00');
      assert.equal((await app.shownDay()).header, 'Sun, November 1', 'Today turned over to Nov 1');
      let cal = await calendar(app);
      if (cal.month !== 'November 2026') wrong.push(`overnight into Nov 1, the calendar still shows ${cal.month}`);
      else if (!cal.cells.some((c) => c.selected && c.key === '2026-11-01')) wrong.push('overnight, Nov 1 is not circled');

      await app.tap(app.button('Previous day'));
      assert.equal((await app.shownDay()).header, 'Sat, October 31');
      await app.tap(app.button('Next day'));
      assert.equal((await app.shownDay()).header, 'Sun, November 1');
      cal = await calendar(app);
      if (cal.month !== 'November 2026') wrong.push(`Next day into Nov 1, the calendar still shows ${cal.month}`);
      await app.tap(app.button('Previous day'));
      cal = await calendar(app);
      if (cal.month !== 'October 2026') wrong.push(`Previous day into Oct 31, the calendar shows ${cal.month}`);
      assert.deepEqual(wrong, [], 'the month calendar shows the month of the day on Today, with that day circled');
      app.assertNoErrors();
    },
  },
];
