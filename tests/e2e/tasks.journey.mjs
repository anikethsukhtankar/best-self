// Tasks: the one-off list under the habits on Today. Adding, ticking, deleting, the day a task belongs
// to, the carry-over onto today, text kept as typed, and that tasks never move the habit count.
// Every journey starts on the owner's core list (begun Oct 1) on Tue Nov 3, 08:00 in Los Angeles.
import { assert, stateWith, coreHabits, wallClock } from './harness.mjs';

const TZ = 'America/Los_Angeles';
const PH = 'Add a task...';
const TUESDAY = ['Push Day', '5K Walk', 'Study 1 Hour', 'Meditate', 'Read 30 min', 'Drink 3L Water', 'Healthy Diet'];
const both = (name, run) => [1440, 375].map((width) => ({ name: `${name} (${width})`, run: (t) => run(t, width) }));

// A task as the app stores it, made at a Los Angeles wall-clock time.
const todo = (id, text, { at = '2026-11-03T07:30:00', dueDate, done } = {}) => ({
  id,
  text,
  createdAt: wallClock(at, TZ).toISOString(),
  ...(dueDate ? { dueDate } : {}),
  ...(done ? { completedAt: wallClock(done, TZ).toISOString() } : {}),
});
const withTasks = (todos, settings) => stateWith({ habits: coreHabits('2026-10-01'), todos, settings });
// The Los Angeles calendar day of a stored instant.
const localDay = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

const field = (app) => app.page.getByPlaceholder(PH);
async function addTask(app, text, { paste = false } = {}) {
  await app.tap(field(app));
  if (paste) await app.page.keyboard.insertText(text);
  else await app.type(text);
  await app.press('Enter');
}

// The tasks Today lists, in order: the text as shown, whether it is struck through as done, and its date tag.
const tasks = (app) => app.page.evaluate((ph) => {
  const input = document.querySelector(`input[placeholder="${ph}"]`);
  if (!input) return null;
  return [...input.parentElement.children].filter((el) => el !== input && el.children.length >= 2).map((row) => {
    const textEl = row.children[1];
    const tag = [...row.children].slice(2).map((e) => e.textContent.trim()).find((x) => /^[A-Z][a-z]{2} \d{1,2}$/.test(x)) || null;
    return { text: textEl.textContent, done: getComputedStyle(textEl).textDecorationLine.includes('line-through'), tag };
  });
}, PH);
const texts = async (app) => (await tasks(app)).map((x) => x.text);
const task = async (app, text) => (await tasks(app)).find((x) => x.text === text) || null;

// A task's words, the circle beside them, and its delete control (the ×).
const words = (app, text) => app.page.getByText(text, { exact: true }).first();
const circle = (app, text) => words(app, text).locator('xpath=preceding-sibling::*[1]');
const del = (app, text) => words(app, text).locator('xpath=following-sibling::*[normalize-space(.)="×"]').first();
const opacity = (loc) => loc.evaluate((e) => Number(getComputedStyle(e).opacity));
// Whether keyboard focus is somewhere in the row of the task with this text.
const focusIn = (app, text) => app.page.evaluate((t) => {
  const el = [...document.querySelectorAll('span')].find((s) => s.textContent === t);
  return !!el && el.parentElement.contains(document.activeElement);
}, text);
const focused = (app) => app.page.evaluate(() => {
  const a = document.activeElement;
  return a ? `${a.tagName.toLowerCase()} "${(a.getAttribute('aria-label') || a.textContent || a.getAttribute('placeholder') || '').trim().slice(0, 40)}"` : 'nothing';
});

const prevDay = (app) => app.tap(app.button('Previous day'));
const nextDay = (app) => app.tap(app.button('Next day'));
const backToToday = (app) => app.tap(app.button('Back to today'));
const numeral = async (app) => (await app.shownDay()).numeral;
const louver = async (app) => (await app.shownDay()).louver;

export default [
  ...both('a task typed and entered is listed and saved, and the field clears', async (t, width) => {
    const app = await t.open({ state: withTasks([]), width });
    assert.deepEqual(await tasks(app), [], 'no tasks yet');
    await addTask(app, 'Call the dentist');
    assert.deepEqual(await tasks(app), [{ text: 'Call the dentist', done: false, tag: null }]);
    assert.equal(await field(app).inputValue(), '', 'the field clears after Enter');
    const [saved] = (await app.stored()).todos;
    assert.equal(saved.text, 'Call the dentist');
    assert.equal(localDay(saved.createdAt), '2026-11-03', 'made today');
    assert.equal(saved.dueDate, undefined, 'a task for today has no due date');
    assert.ok(!saved.completedAt, 'a new task is open');

    // A second one goes below the first, typed straight after without leaving the field.
    await app.type('Buy stamps');
    await app.press('Enter');
    assert.deepEqual(await texts(app), ['Call the dentist', 'Buy stamps'], 'tasks are listed in the order added');

    // Enter on an empty field, or on spaces, adds nothing.
    await app.press('Enter');
    await app.type('   ');
    await app.press('Enter');
    assert.deepEqual(await texts(app), ['Call the dentist', 'Buy stamps'], 'an empty Enter adds nothing');
    assert.equal((await app.stored()).todos.length, 2, 'nothing blank was saved');

    // Escape throws away a half-typed task.
    await app.tap(field(app));
    await app.page.keyboard.press('Control+A');
    await app.page.keyboard.press('Backspace');
    await app.type('half a thou');
    await app.press('Escape');
    assert.equal(await field(app).inputValue(), '', 'Escape clears the field');
    assert.equal(await field(app).evaluate((e) => e === document.activeElement), false, 'Escape leaves the field');
    assert.equal((await app.stored()).todos.length, 2, 'Escape adds nothing');

    await app.reload();
    assert.deepEqual(await texts(app), ['Call the dentist', 'Buy stamps'], 'tasks survive a reload');
    if (app.phone) {
      // Scrolled to the very bottom of Today, the field's line sits clear of the bottom bar and takes a tap.
      await app.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await app.wait(200);
      const clear = await field(app).evaluate((input) => {
        const r = input.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + 40, r.top + r.height / 2 + 8);
        return { hit: hit === input, bottom: r.bottom };
      });
      assert.ok(clear.hit, `the task field is not under the bottom bar when scrolled to the end (${JSON.stringify(clear)})`);
      await app.assertNoHorizontalScroll('on Today with tasks');
    }
    app.assertNoErrors();
  }),

  ...both('a task ticks with its circle, unticks, and the tick survives a reload', async (t, width) => {
    const app = await t.open({ state: withTasks([todo('a', 'Buy stamps'), todo('b', 'Email the landlord')]), width });
    await app.tap(circle(app, 'Buy stamps'));
    assert.deepEqual(await tasks(app), [{ text: 'Buy stamps', done: true, tag: null }, { text: 'Email the landlord', done: false, tag: null }]);
    let saved = (await app.stored()).todos.find((x) => x.id === 'a');
    assert.ok(saved.completedAt, 'the tick is saved');
    assert.equal(localDay(saved.completedAt), '2026-11-03', 'ticked today');
    await app.reload();
    assert.equal((await task(app, 'Buy stamps')).done, true, 'still ticked after a reload');
    await app.tap(circle(app, 'Buy stamps'));
    assert.equal((await task(app, 'Buy stamps')).done, false, 'a second tap unticks it');
    saved = (await app.stored()).todos.find((x) => x.id === 'a');
    assert.ok(!saved.completedAt, 'the untick is saved');
    assert.equal((await task(app, 'Email the landlord')).done, false, 'the other task was never touched');
    if (app.phone) await app.assertNoHorizontalScroll('after ticking a task');
    app.assertNoErrors();
  }),

  ...both('a task is deleted with its ×, which can be seen without a mouse hovering', async (t, width) => {
    const app = await t.open({ state: withTasks([todo('a', 'Buy stamps'), todo('b', 'Email the landlord')]), width });
    if (app.phone) {
      // A phone has no hover: the delete control has to be on screen to be found.
      assert.ok(await opacity(del(app, 'Buy stamps')) > 0.5, `the × beside a task is visible on a phone (opacity ${await opacity(del(app, 'Buy stamps'))})`);
    } else {
      await words(app, 'Buy stamps').hover();
      assert.ok(await opacity(del(app, 'Buy stamps')) > 0.5, 'the × shows when the mouse is over the task');
    }
    await app.tap(del(app, 'Buy stamps'));
    assert.deepEqual(await texts(app), ['Email the landlord'], 'the task is gone from Today');
    assert.deepEqual((await app.stored()).todos.map((x) => x.id), ['b'], 'and from what is saved');
    await app.reload();
    assert.deepEqual(await texts(app), ['Email the landlord'], 'it stays gone after a reload');
    if (app.phone) await app.assertNoHorizontalScroll('after deleting a task');
    app.assertNoErrors();
  }),

  {
    name: 'a task carried from an earlier day, deleted on today, is gone from its own day too',
    run: async (t) => {
      const app = await t.open({ state: withTasks([todo('passport', 'Renew the passport', { at: '2026-11-02T09:00:00' }), todo('milk', 'Buy milk')]) });
      assert.deepEqual(await task(app, 'Renew the passport'), { text: 'Renew the passport', done: false, tag: 'Nov 2' });
      await words(app, 'Renew the passport').hover();
      await app.tap(del(app, 'Renew the passport'));
      assert.deepEqual(await texts(app), ['Buy milk']);
      await prevDay(app);
      assert.deepEqual(await tasks(app), [], 'Nov 2 no longer lists it');
      assert.deepEqual((await app.stored()).todos.map((x) => x.id), ['milk']);
      app.assertNoErrors();
    },
  },

  {
    name: 'a task can be ticked and deleted from the keyboard',
    run: async (t) => {
      const app = await t.open({ state: withTasks([todo('a', 'Buy stamps')]) });
      await app.page.locator('[data-habit-row="Healthy Diet"]').focus();
      await app.press('Tab');
      assert.ok(await focusIn(app, 'Buy stamps'), `Tab from the last habit reaches the task (focus is on ${await focused(app)})`);
      await app.press('Space');
      assert.equal((await task(app, 'Buy stamps'))?.done, true, 'Space ticks the task');
      assert.ok((await app.stored()).todos[0].completedAt, 'the tick is saved');
      // On along the row to its delete control.
      for (let i = 0; i < 2 && !(await focused(app)).includes('×') && !/delete|remove/i.test(await focused(app)); i++) await app.press('Tab');
      assert.ok(await focusIn(app, 'Buy stamps'), `Tab reaches the task's delete control (focus is on ${await focused(app)})`);
      await app.press('Enter');
      assert.deepEqual(await tasks(app), [], 'Enter on the × deletes the task');
      assert.deepEqual((await app.stored()).todos, []);
      app.assertNoErrors();
    },
  },

  ...both('a task added on a future day belongs to that day only', async (t, width) => {
    const app = await t.open({ state: withTasks([]), width });
    await nextDay(app);
    assert.equal(await numeral(app), 4);
    await addTask(app, 'Pack for the trip');
    assert.deepEqual(await tasks(app), [{ text: 'Pack for the trip', done: false, tag: null }], 'listed on Wed Nov 4, with no date tag');
    const [saved] = (await app.stored()).todos;
    assert.equal(saved.dueDate, '2026-11-04', 'saved for Nov 4');
    await backToToday(app);
    assert.deepEqual(await tasks(app), [], 'not on today');
    await nextDay(app);
    await nextDay(app);
    assert.equal(await numeral(app), 5);
    assert.deepEqual(await tasks(app), [], 'not on the day after either');
    await app.reload();
    await nextDay(app);
    assert.deepEqual(await texts(app), ['Pack for the trip'], 'still on Nov 4 after a reload');
    if (app.phone) await app.assertNoHorizontalScroll('on a future day with a task');
    app.assertNoErrors();
  }),

  ...both('a task added on a past day belongs to that day and comes forward to today, dated', async (t, width) => {
    const app = await t.open({ state: withTasks([]), width });
    await prevDay(app);
    assert.equal(await numeral(app), 2);
    await addTask(app, 'Return the library books');
    assert.deepEqual(await tasks(app), [{ text: 'Return the library books', done: false, tag: null }], 'listed on Mon Nov 2');
    assert.equal((await app.stored()).todos[0].dueDate, '2026-11-02', 'saved for Nov 2');
    await prevDay(app);
    assert.deepEqual(await tasks(app), [], 'not on Nov 1');
    await backToToday(app);
    assert.deepEqual(await tasks(app), [{ text: 'Return the library books', done: false, tag: 'Nov 2' }], 'still open, so on today with its day');
    if (app.phone) await app.assertNoHorizontalScroll('on today with a carried task');
    app.assertNoErrors();
  }),

  ...both('an unfinished task from an earlier day comes to today with its date, and stays on today once done', async (t, width) => {
    const app = await t.open({
      state: withTasks([
        todo('passport', 'Renew the passport', { at: '2026-10-30T09:00:00' }),
        todo('gift', 'Order the birthday gift', { at: '2026-10-30T09:05:00', done: '2026-10-30T18:00:00' }),
        todo('milk', 'Buy milk'),
      ]),
      width,
    });
    assert.deepEqual(await tasks(app), [
      { text: 'Renew the passport', done: false, tag: 'Oct 30' },
      { text: 'Buy milk', done: false, tag: null },
    ], 'the open one from Friday comes forward with its date; the one done on Friday stays there');
    await app.tap(circle(app, 'Renew the passport'));
    assert.equal((await task(app, 'Renew the passport'))?.done, true, 'ticked, and still on today');
    assert.equal(localDay((await app.stored()).todos.find((x) => x.id === 'passport').completedAt), '2026-11-03', 'saved as done today');

    for (let i = 0; i < 4; i++) await prevDay(app);
    assert.equal(await numeral(app), 30);
    const friday = await tasks(app);
    assert.ok(!friday.some((x) => x.text === 'Renew the passport' && !x.done), `Friday no longer shows it as open: ${JSON.stringify(friday)}`);
    assert.deepEqual(friday.find((x) => x.text === 'Order the birthday gift'), { text: 'Order the birthday gift', done: true, tag: null }, 'what was done on Friday shows on Friday');
    assert.ok(!friday.some((x) => x.text === 'Buy milk'), 'a task of today is not on Friday');

    await backToToday(app);
    await app.reload();
    assert.equal((await task(app, 'Renew the passport'))?.done, true, 'still done on today after a reload');
    // Unticked again, it is open and dated once more.
    await app.tap(circle(app, 'Renew the passport'));
    assert.deepEqual(await task(app, 'Renew the passport'), { text: 'Renew the passport', done: false, tag: 'Oct 30' });
    if (app.phone) await app.assertNoHorizontalScroll('on today with tasks from earlier days');
    app.assertNoErrors();
  }),

  {
    name: 'a task ticked on an earlier day stays on that day, ticked (375)',
    run: async (t) => {
      const app = await t.open({ state: withTasks([todo('books', 'Return the library books', { at: '2026-11-02T09:00:00' })]), width: 375 });
      await prevDay(app);
      assert.equal(await numeral(app), 2);
      assert.deepEqual(await tasks(app), [{ text: 'Return the library books', done: false, tag: null }]);
      await app.tap(circle(app, 'Return the library books'));
      assert.deepEqual(await tasks(app), [{ text: 'Return the library books', done: true, tag: null }], 'the task ticked on Monday is still on Monday, ticked');
      await backToToday(app);
      assert.ok(!(await texts(app)).includes('Return the library books'), 'done on Monday, it is not carried to today');
      await app.assertNoHorizontalScroll('after ticking a task on an earlier day');
      app.assertNoErrors();
    },
  },

  {
    name: 'a task left open at midnight comes to the new day dated, and one added after midnight is the new day\'s (375)',
    run: async (t) => {
      const app = await t.open({ state: withTasks([]), width: 375, now: '2026-11-03T23:58:00' });
      await addTask(app, 'Take out the bins');
      assert.equal(localDay((await app.stored()).todos[0].createdAt), '2026-11-03');
      await app.later('05:00');
      assert.equal(await numeral(app), 4, 'Today turned over to Wed Nov 4');
      assert.deepEqual(await tasks(app), [{ text: 'Take out the bins', done: false, tag: 'Nov 3' }], 'last night\'s task comes forward, dated');
      await addTask(app, 'Water the plants');
      const water = (await app.stored()).todos.find((x) => x.text === 'Water the plants');
      assert.equal(localDay(water.createdAt), '2026-11-04', 'made on the new day');
      assert.equal(water.dueDate, undefined, 'a task for today has no due date');
      assert.deepEqual(await tasks(app), [{ text: 'Take out the bins', done: false, tag: 'Nov 3' }, { text: 'Water the plants', done: false, tag: null }]);
      await prevDay(app);
      assert.deepEqual(await texts(app), ['Take out the bins'], 'Nov 3 has only its own task');
      await app.assertNoHorizontalScroll('after midnight with tasks');
      app.assertNoErrors();
    },
  },

  ...both('a long task wraps on screen and keeps every character as typed', async (t, width) => {
    const app = await t.open({ state: withTasks([todo('old', 'Book the car in for its winter service and ask them about the rattle', { at: '2026-10-28T10:00:00' })]), width });
    const long = 'Write to the council about the broken street light on the corner of Elm and 5th, and ask when it will be fixed before the dark evenings';
    const odd = 'Compare <b>prices</b> & "deals" — café, 50% off 🧘‍♀️🎉 <script>alert(1)</script>';
    await addTask(app, long);
    await addTask(app, odd);
    const stored = (await app.stored()).todos.map((x) => x.text);
    assert.deepEqual(stored.slice(1), [long, odd], 'saved exactly as typed');
    assert.deepEqual((await texts(app)).slice(1), [long, odd], 'shown exactly as typed');
    assert.equal(await app.page.locator('b').count(), 0, 'no markup is made from the text');

    const vw = await app.page.evaluate(() => document.documentElement.clientWidth);
    const box = await words(app, long).boundingBox();
    assert.ok(box.height > 40, `the long task wraps onto more than one line (height ${box.height})`);
    assert.ok(box.x >= 0 && box.x + box.width <= vw, `the long task stays on screen (${box.x}..${box.x + box.width} of ${vw})`);
    // A carried task with long words keeps its date tag clear of its words, on screen.
    const oldText = await words(app, 'Book the car in for its winter service and ask them about the rattle').boundingBox();
    const tag = await app.page.getByText('Oct 28', { exact: true }).boundingBox();
    assert.ok(tag && tag.x >= oldText.x + oldText.width - 0.5, `the date tag sits beside the words, not over them (${JSON.stringify({ oldText, tag })})`);
    assert.ok(tag.x + tag.width <= vw, 'the date tag stays on screen');
    if (app.phone) await app.assertNoHorizontalScroll('with long tasks');
    await app.reload();
    assert.deepEqual((await texts(app)).slice(1), [long, odd], 'still exact after a reload');
    app.assertNoErrors();
  }),

  {
    name: 'a pasted link in a task wraps instead of pushing the phone sideways (375)',
    run: async (t) => {
      const app = await t.open({ state: withTasks([]), width: 375 });
      const link = 'Check https://www.example.com/reservations/confirmation?booking=ABCD1234EFGH5678&guest=jordan.lee&ref=autumn-newsletter';
      await addTask(app, link, { paste: true });
      assert.deepEqual(await texts(app), [link], 'kept exactly as pasted');
      const vw = await app.page.evaluate(() => document.documentElement.clientWidth);
      const box = await words(app, link).boundingBox();
      assert.ok(box.x + box.width <= vw, `the link stays on screen (right edge ${box.x + box.width} of ${vw})`);
      await app.assertNoHorizontalScroll('with a long link in a task');
      app.assertNoErrors();
    },
  },

  ...both('tasks never change the habit count or complete the day', async (t, width) => {
    const app = await t.open({ state: withTasks([todo('a', 'Buy stamps')]), width });
    assert.match(await louver(app), /0 of 7 habits done/);
    const zero = app.page.getByText('0/7', { exact: true });
    const zeros = await zero.count();
    assert.ok(zeros >= 1, 'the progress figure reads 0/7');
    await addTask(app, 'Email the landlord');
    await app.tap(circle(app, 'Email the landlord'));
    await app.tap(circle(app, 'Buy stamps'));
    assert.match(await louver(app), /0 of 7 habits done/, 'ticked tasks are not habits done');
    assert.equal(await zero.count(), zeros, 'the progress figure still reads 0/7');
    assert.deepEqual((await app.stored()).completions, {}, 'no habit check was saved');
    const dot = () => app.page.locator('[data-week-day="2026-11-03"] div').first().evaluate((e) => getComputedStyle(e).backgroundColor);
    assert.equal(await dot(), 'rgba(0, 0, 0, 0)', 'today is not marked complete in the week strip');

    // Every habit done with a task still open: the day is complete all the same.
    await app.tap(circle(app, 'Buy stamps'));
    assert.equal((await task(app, 'Buy stamps')).done, false);
    for (const text of TUESDAY) await app.tap(app.page.locator(`[data-habit-row="${text}"]`));
    assert.match(await louver(app), /7 of 7 habits done/);
    assert.ok(await app.page.getByText('✓', { exact: true }).count() >= 1, 'the progress figure shows the day done');
    assert.equal(await zero.count(), 0, 'nothing reads 0/7 any more');
    assert.equal(await dot(), 'rgb(0, 0, 0)', 'today is marked complete in the week strip');
    // Ticking or deleting a task on a completed day leaves it complete.
    await app.tap(circle(app, 'Buy stamps'));
    if (!app.phone) await words(app, 'Email the landlord').hover();
    await app.tap(del(app, 'Email the landlord'));
    assert.deepEqual(await texts(app), ['Buy stamps']);
    assert.match(await louver(app), /7 of 7 habits done/, 'still 7 of 7 after ticking and deleting tasks');
    assert.equal(Object.keys((await app.stored()).completions['2026-11-03']).length, 7, 'the seven checks are kept');
    if (app.phone) await app.assertNoHorizontalScroll('on a completed day with tasks');
    app.assertNoErrors();
  }),

  ...both('tasks read clearly in dark mode', async (t, width) => {
    const app = await t.open({ state: withTasks([todo('a', 'Buy stamps', { done: '2026-11-03T07:45:00' }), todo('b', 'Renew the passport', { at: '2026-10-30T09:00:00' })], { darkMode: true }), width });
    await addTask(app, 'Email the landlord');
    const look = await app.page.evaluate((ph) => {
      const input = document.querySelector(`input[placeholder="${ph}"]`);
      const rows = [...input.parentElement.children].filter((el) => el !== input && el.children.length >= 2);
      const cs = (e) => getComputedStyle(e);
      const byText = (t) => rows.find((r) => r.children[1].textContent === t);
      return {
        page: cs(document.body).backgroundColor,
        input: cs(input).color,
        open: cs(byText('Email the landlord').children[1]).color,
        openCircle: cs(byText('Email the landlord').children[0]).borderTopColor,
        doneCircle: cs(byText('Buy stamps').children[0]).backgroundColor,
        doneTick: cs(byText('Buy stamps').children[0].querySelector('svg')).stroke,
        tag: cs([...byText('Renew the passport').children].find((e) => e.textContent.trim() === 'Oct 30')).color,
      };
    }, PH);
    assert.deepEqual(look, {
      page: 'rgb(10, 10, 10)',
      input: 'rgb(255, 255, 255)',
      open: 'rgb(255, 255, 255)',
      openCircle: 'rgb(255, 255, 255)',
      doneCircle: 'rgb(255, 255, 255)',
      doneTick: 'rgb(0, 0, 0)',
      tag: 'rgb(85, 85, 85)',
    }, 'white ink on the dark page, the done circle filled white with a black tick');
    if (app.phone) await app.assertNoHorizontalScroll('on Today in dark mode with tasks');
    app.assertNoErrors();
  }),
];
