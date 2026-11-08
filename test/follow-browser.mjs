/* Headless checks for estimate follow-ups, review requests and the members list.
   Run: node test/follow-browser.mjs
   Needs puppeteer-core and Chrome. Screenshots land in /opt/cursor/artifacts. */
import { createRequire } from 'module';
import { mkdir } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const require = createRequire('/tmp/ppt/package.json');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(path.dirname(new globalThis.URL(import.meta.url).pathname), '..');
const ART = '/opt/cursor/artifacts';
const PORTN = 8766;
const APP = 'http://127.0.0.1:' + PORTN + '/index.html';
const shots = [];
const fails = [];

function assert(cond, msg) { if (!cond) { fails.push(msg); console.error('FAIL', msg); } else console.log('ok', msg); }
function pad(n) { return String(n).padStart(2, '0'); }
function pacificToday() {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}
function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
}

const TODAY = pacificToday();
const DAYS_AGO = n => addDays(TODAY, -n);

const biz = {
  v: 3, id: 'valley', name: 'Valley Trade Co', tagline: 'Same job, done right.', phone: '6615550199', email: 'ava@example.com',
  logoData: '', colors: { primary: '#B86E00', accent: '#1C1A17', bg: '#FBF6EC' },
  thanks: 'Thanks for choosing Valley Trade Co.', primary: 'hvac', same: true, updatedAt: 1700000000000,
  packs: { solar: { on: false }, plumbing: { on: true }, hvac: { on: true } },
  forms: {}, customForms: [], lists: {}, extras: { comfortClub: true, hvacReminders: true },
  reps: [{ id: 'R-ava', name: 'Ava Tran', phone: '6615550199', email: 'ava@example.com' }],
  profiles: {}
};

const crm = {
  leads: {
    'L-maria': {
      id: 'L-maria', pack: 'plumbing', created: DAYS_AGO(6) + ' 09:00', updated: DAYS_AGO(4) + ' 15:00',
      source: 'phone', name: 'Maria Chen', phone: '6615550141', email: 'maria@example.com',
      address: '12 Pine St', need: 'Water heater', stage: 'Estimate sent', next_step: 'Follow up on estimate',
      next_date: DAYS_AGO(2), notes: '', rep: 'Ava Tran'
    },
    'L-luis': {
      id: 'L-luis', pack: 'plumbing', created: DAYS_AGO(1) + ' 11:00', updated: DAYS_AGO(1) + ' 11:00',
      source: 'phone', name: 'Luis Ortega', phone: '6615550142', email: 'luis@example.com',
      need: 'Leak', stage: 'Estimate sent', next_step: 'Follow up on estimate', next_date: addDays(TODAY, 1), notes: '', rep: 'Ava Tran'
    },
    'L-alex': {
      id: 'L-alex', pack: 'hvac', created: DAYS_AGO(10) + ' 09:00', updated: DAYS_AGO(1) + ' 09:00',
      source: 'referral', name: 'Alex Kim', phone: '6615550143', email: 'alex@example.com',
      need: 'No heat', stage: 'Sold', notes: '', rep: 'Ava Tran'
    },
    'L-sam': {
      id: 'L-sam', pack: 'plumbing', created: DAYS_AGO(3) + ' 08:00', updated: DAYS_AGO(1) + ' 16:00',
      source: 'phone', name: 'Sam Ortiz', phone: '6615550144', email: 'sam@example.com',
      need: 'Faucet', stage: 'Job done', notes: '', rep: 'Ava Tran'
    },
    'L-noor': {
      id: 'L-noor', pack: 'hvac', created: DAYS_AGO(2) + ' 08:00', updated: DAYS_AGO(1) + ' 17:00',
      source: 'phone', name: 'Noor Ali', phone: '', email: 'noor@example.com',
      need: 'Tune-up', stage: 'Repaired', notes: '', rep: 'Ava Tran'
    },
    'L-dee': {
      id: 'L-dee', pack: 'hvac', created: '2026-03-01 08:00', updated: '2026-03-01 08:00',
      source: 'referral', name: 'Dee Cole', phone: '6615550145', email: 'dee@example.com',
      need: 'Tune-up', stage: 'Sold', hv_member: 'Active', hv_plan: 'Yearly $149', hv_renew: '2027-03-01', notes: '', rep: 'Ava Tran'
    },
    'L-pat': {
      id: 'L-pat', pack: 'plumbing', created: DAYS_AGO(20) + ' 10:00', updated: DAYS_AGO(20) + ' 10:00',
      source: 'phone', name: 'Pat Nguyen', phone: '6615550146', email: 'pat@example.com',
      need: 'Inspection', stage: 'Job done', next_step: 'Annual inspection due', next_date: TODAY, notes: '', rep: 'Ava Tran'
    },
    'L-june': {
      id: 'L-june', pack: 'plumbing', created: '2025-11-08 10:00', updated: '2025-11-08 10:00',
      source: 'phone', name: 'June Park', phone: '6615550147', email: 'june@example.com',
      need: 'Water heater', stage: 'Approved', notes: '', rep: 'Ava Tran'
    },
    'L-riley': {
      id: 'L-riley', pack: 'hvac', created: DAYS_AGO(40) + ' 09:00', updated: DAYS_AGO(40) + ' 09:00',
      source: 'website', name: 'Riley Brooks', phone: '6615550148', email: 'riley@example.com',
      need: 'Filter', stage: 'Contacted', notes: '', rep: 'Ava Tran'
    }
  },
  queue: [],
  checks: [
    { check_id: 'C-riley', lead_id: 'L-riley', ts: DAYS_AGO(40) + ' 09:04', first: 'Riley', mobile: '6615550148', email: 'riley@example.com', reminders: 'yes', reminder_freq: 'fall', consent_text: 'yes', result: 'fit', score: 70 }
  ],
  docs: [
    { id: 'E-maria', lead_id: 'L-maria', formId: 'estimate', title: 'Estimate', total: '$1,240', ts: DAYS_AGO(4) + ' 15:00' },
    { id: 'E-luis', lead_id: 'L-luis', formId: 'estimate', title: 'Estimate', total: '$480', ts: DAYS_AGO(1) + ' 11:00' },
    { id: 'E-alex', lead_id: 'L-alex', formId: 'hvac-quote', title: 'Repair Quote', total: '$860', ts: DAYS_AGO(8) + ' 12:00' }
  ],
  last: TODAY
};

const follow = {
  v: 1, days: 2, reviewUrl: 'https://g.page/r/valley-trade-review', updatedAt: '2026-11-01T00:00:00.000Z',
  texts: {},
  estimates: [
    { id: 'E-maria', leadId: 'L-maria', formId: 'estimate', title: 'Estimate', customer: 'Maria Chen', phone: '6615550141', email: 'maria@example.com', pack: 'plumbing', sent: DAYS_AGO(4), what: 'a leaking water heater', options: 'Good $890, Better $1,240, Best $1,680. ', total: '$1,240', picked: 'Not yet', closed: false, nudged: '' },
    { id: 'E-luis', leadId: 'L-luis', formId: 'estimate', title: 'Estimate', customer: 'Luis Ortega', phone: '6615550142', email: 'luis@example.com', pack: 'plumbing', sent: DAYS_AGO(1), what: 'a kitchen leak', options: 'Good $480. ', total: '$480', picked: 'Not yet', closed: false, nudged: '' },
    { id: 'E-alex', leadId: 'L-alex', formId: 'hvac-quote', title: 'Repair Quote', customer: 'Alex Kim', phone: '6615550143', email: 'alex@example.com', pack: 'hvac', sent: DAYS_AGO(8), what: 'the furnace', options: 'Good $860. ', total: '$860', picked: 'Best', closed: true, nudged: '' }
  ],
  reviews: [
    { id: 'SO-sam', leadId: 'L-sam', customer: 'Sam Ortiz', phone: '6615550144', email: 'sam@example.com', pack: 'plumbing', sent: DAYS_AGO(1), due: TODAY, work: 'replaced the kitchen faucet', happy: 'Yes', done: '' },
    { id: 'SO-noor', leadId: 'L-noor', customer: 'Noor Ali', phone: '', email: 'noor@example.com', pack: 'hvac', sent: DAYS_AGO(1), due: TODAY, work: 'AC tune-up', happy: 'Yes', done: '' }
  ],
  members: [
    { id: 'lead-club-L-dee', leadId: 'L-dee', kind: 'club', plan: 'Comfort Club', which: 'both', freq: '', customer: 'Dee Cole', phone: '6615550145', email: 'dee@example.com', pack: 'hvac', start: '2026-03-01', next: TODAY, renew: '2027-03-01', sms: true, source: 'Comfort Club' },
    { id: 'form-june', leadId: 'L-june', kind: 'water', plan: 'Water heater plan', which: 'year', freq: '', customer: 'June Park', phone: '6615550147', email: 'june@example.com', pack: 'plumbing', start: '2025-11-08', next: TODAY, renew: '', sms: true, source: 'Water heater plan' },
    { id: 'lead-insp-L-pat', leadId: 'L-pat', kind: 'inspection', plan: 'Yearly inspection', which: 'year', freq: '', customer: 'Pat Nguyen', phone: '6615550146', email: 'pat@example.com', pack: 'plumbing', start: DAYS_AGO(20), next: TODAY, renew: '', sms: true, source: 'Yearly inspection' },
    { id: 'check-C-riley', leadId: 'L-riley', kind: 'check', plan: 'Tune-up reminder', which: 'fall', freq: 'fall', customer: 'Riley Brooks', phone: '6615550148', email: 'riley@example.com', pack: 'hvac', start: DAYS_AGO(40), next: TODAY, renew: '', sms: true, source: 'Energy Check' }
  ]
};

const fixture = {
  json: {
    mt_crm: crm,
    mt_biz: biz,
    mt_follow: follow,
    mt_me: 'R-ava',
    mt_lens: 'all',
    mt_flags: '',
    mt_qtpl: {},
    mt_setup: { done: true },
    mt_up_v2: 1,
    mt_hv_stage_v2: 1
  }
};

function serve() {
  return spawn('python3', ['-m', 'http.server', String(PORTN), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
}

async function boot(browser) {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(data => {
    localStorage.clear();
    Object.entries(data.json).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  }, fixture);
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FOLLOW && window.CRM && window.PORT);
  await page.waitForSelector('#v-today.on, #gear', { timeout: 15000 });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('v-today')).opacity === '1');
  return { page, errors };
}

async function shot(page, name) {
  await new Promise(r => setTimeout(r, 450));
  const file = path.join(ART, name);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(file);
  console.log('shot', file);
}
async function showMessage(page) {
  await page.waitForSelector('#fuBody');
  await page.evaluate(() => {
    const ta = document.getElementById('fuBody');
    ta.style.height = (ta.scrollHeight + 16) + 'px';
    const sheet = document.getElementById('sheet');
    const top = ta.getBoundingClientRect().top - sheet.getBoundingClientRect().top + sheet.scrollTop - 8;
    sheet.scrollTop = Math.max(0, top);
  });
}

function decodeSms(href) {
  const i = String(href || '').indexOf('body=');
  if (i < 0) return '';
  return decodeURIComponent(href.slice(i + 5));
}

async function main() {
  await mkdir(ART, { recursive: true });
  const server = serve();
  await new Promise(r => setTimeout(r, 400));
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });
  try {
    const { page, errors } = await boot(browser);
    assert(!errors.length, 'app boots without page errors' + (errors[0] ? ': ' + errors[0] : ''));

    const listed = await page.evaluate(() => {
      const text = document.getElementById('v-today').innerText;
      const est = FOLLOW.waiting().map(e => e.customer);
      const rev = FOLLOW.dueReviews().map(r => r.customer);
      const mem = FOLLOW.membersDue().map(m => ({ name: m.customer, plan: m.plan, next: m.nextVisit, source: m.source }));
      const sms = Array.from(document.querySelectorAll('.lead.fu.est a.fusend')).map(a => a.getAttribute('href'));
      const reviewHrefs = FOLLOW.dueReviews().map(r => { const c = FOLLOW.channel(r, 'rev'); return { name: r.customer, text: c.kind === 'mail' ? 'Email' : 'Text', href: c.href }; });
      const memberBtns = Array.from(document.querySelectorAll('.lead.fu.mem a.fusend')).map(a => a.textContent);
      const btn = document.querySelector('.lead.fu a.fusend');
      const box = btn ? btn.getBoundingClientRect() : null;
      return { text, est, rev, mem, sms, reviewHrefs, memberBtns, box: box && { h: box.height, right: box.right, left: box.left, w: box.width }, width: window.innerWidth };
    });
    assert(listed.est.indexOf('Maria Chen') >= 0 && listed.est.indexOf('Luis Ortega') < 0, 'unsigned estimate shows after 2 days, a 1-day estimate stays quiet, got ' + listed.est.join(', '));
    assert(listed.est.indexOf('Alex Kim') < 0, 'a sold quote is not a follow-up');
    assert(/maria chen/i.test(listed.text) && /follow up/i.test(listed.text), 'Today shows the Follow up list');
    assert(listed.sms.some(h => h.startsWith('sms:6615550141') && /Maria/.test(decodeSms(h)) && /1,240/.test(decodeSms(h)) && /Good/.test(decodeSms(h))), 'estimate text is an sms: link with her name and the estimate');
    assert(listed.rev.indexOf('Sam Ortiz') >= 0 && listed.rev.indexOf('Noor Ali') >= 0, 'both review requests are due this morning');
    assert(listed.reviewHrefs.some(h => h.text === 'Text' && h.href.startsWith('sms:') && /Sam/.test(decodeSms(h.href)) && /g\.page/.test(decodeSms(h.href))), 'review text includes the Google review link');
    assert(listed.reviewHrefs.some(h => h.text === 'Email' && h.href.startsWith('mailto:noor@example.com') && /Noor/.test(decodeURIComponent((h.href.split('body=')[1] || '')))), 'a customer with email only gets a mailto: link');
    assert(listed.mem.filter(m => ['Dee Cole', 'June Park', 'Pat Nguyen', 'Riley Brooks'].indexOf(m.name) >= 0).length === 4, 'members come from the club, water heater plan, yearly inspection and Energy Check, got ' + listed.mem.map(m => m.name).join(', '));
    assert(listed.mem.every(m => m.next), 'every member has a next visit date');
    assert(listed.memberBtns.some(t => /Spring text|Fall text|Visit text|Filter text/.test(t)), 'members have a reminder button, got ' + listed.memberBtns.join(', '));
    assert(listed.box && listed.box.h >= 44, 'the text button is at least 44px tall');
    assert(listed.box && listed.box.right <= listed.width + 1 && listed.box.left >= 0, 'the text button stays on the phone screen');

    await shot(page, 'screenshot_estimate_followups.png');

    await page.click('.lead.fu.est .mid');
    await showMessage(page);
    const draft = await page.$eval('#fuBody', el => el.value);
    const openHref = await page.$eval('#fuGo', el => el.getAttribute('href'));
    assert(/Maria/.test(draft) && /1,240/.test(draft) && /water heater/i.test(draft), 'the follow-up text is editable and names Maria and the estimate');
    assert(openHref.startsWith('sms:6615550141'), 'Open Messages is an sms: link');
    await shot(page, 'screenshot_estimate_followup_text.png');
    await page.evaluate(() => CORE.closeSheet());
    await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('on'));
    await new Promise(r => setTimeout(r, 400));

    await page.evaluate(() => FOLLOW.openList('rev'));
    await page.waitForSelector('.sheet.on .lead.fu.rev');
    await page.waitForFunction(() => /Email/.test(document.querySelector('.sheet').innerText) && /Sam Ortiz/.test(document.querySelector('.sheet').innerText));
    await shot(page, 'screenshot_review_requests.png');
    await page.evaluate(() => { const row = document.querySelector('.sheet.on .lead.fu.rev'); FOLLOW.openEdit(row.dataset.fuKind, row.dataset.fuId); });
    await showMessage(page);
    const reviewDraft = await page.$eval('#fuBody', el => el.value);
    assert(/Sam/.test(reviewDraft) && /g\.page/.test(reviewDraft) && /faucet/i.test(reviewDraft), 'the review text thanks them and includes the Google review link');
    await shot(page, 'screenshot_review_thankyou.png');
    await page.evaluate(() => CORE.closeSheet());
    await page.waitForFunction(() => !document.getElementById('sheet').classList.contains('on'));

    await page.evaluate(() => FOLLOW.openList('mem'));
    await page.waitForSelector('.sheet.on .lead.fu.mem');
    const memberSheet = await page.evaluate(() => document.querySelector('.sheet').innerText);
    assert(/Dee Cole/.test(memberSheet) && /June Park/.test(memberSheet) && /Pat Nguyen/.test(memberSheet) && /Riley Brooks/.test(memberSheet), 'the members list shows every sign-up');
    assert(/Next visit/.test(memberSheet), 'the members list shows the next visit');
    await shot(page, 'screenshot_members_due.png');
    await page.evaluate(() => CORE.closeSheet());

    await page.evaluate(() => { CORE.closeSheet(); KF.goTab('settings'); });
    await page.waitForSelector('#goFollow');
    await page.evaluate(() => document.getElementById('goFollow').scrollIntoView({ block: 'center' }));
    await page.click('#goFollow');
    await page.waitForSelector('#fuDays');
    await page.waitForSelector('#fuLink');
    const settings = await page.evaluate(() => ({
      days: document.getElementById('fuDays').value,
      link: document.getElementById('fuLink').value
    }));
    assert(settings.days === '2', 'the wait defaults to 2 days, got ' + settings.days);
    assert(settings.link.includes('g.page'), 'Settings shows the Google review link');
    await shot(page, 'screenshot_followup_settings.png');

    await page.evaluate(() => { document.getElementById('fuDays').value = '9'; document.getElementById('fuSave').click(); });
    await page.waitForFunction(() => !FOLLOW.waiting().some(e => e.customer === 'Maria Chen'));
    assert(true, 'raising the wait to 9 days takes a 4-day estimate off Today');
    await page.evaluate(() => { CRM.go('more'); });
    await page.waitForSelector('#goFollow');
    await page.evaluate(() => document.getElementById('goFollow').click());
    await page.waitForSelector('#fuDays');
    await page.evaluate(() => { document.getElementById('fuDays').value = '2'; document.getElementById('fuLink').value = 'https://g.page/r/valley-trade-review'; document.getElementById('fuSave').click(); });
    await page.waitForFunction(() => FOLLOW.waiting().some(e => e.customer === 'Maria Chen'));
    assert(true, 'putting the wait back to 2 days shows the estimate again');

    const rules = await page.evaluate(today => {
      const queued = FOLLOW.noteForm({ id: 'SO-new', formId: 'signoff', title: 'Job Completion Sign-Off', customer: 'Casey Ng', phone: '6615550177', email: 'casey@example.com', pack: 'plumbing' }, { happy: 'Yes', work_done: 'Cleared the drain' }, '');
      const unhappy = FOLLOW.noteForm({ id: 'SO-unhappy', formId: 'signoff', title: 'Job Completion Sign-Off', customer: 'Unhappy', phone: '6615550178' }, { happy: 'Not yet, see notes', work_done: 'Still leaking' }, '');
      const fresh = FOLLOW.noteForm({ id: 'E-fresh', formId: 'estimate', title: 'Estimate', customer: 'Fresh Quote', phone: '6615550179', total: '$90', pack: 'plumbing' }, { picked: 'Not yet', problem: 'dripping tap', options: { Good: { price: '90', desc: 'Washer' } } }, '');
      const sold = FOLLOW.noteForm({ id: 'E-sold', formId: 'estimate', title: 'Estimate', customer: 'Sold Quote', phone: '6615550180', total: '$200' }, { picked: 'Better', options: { Better: { price: '200', desc: 'New valve' } } }, '');
      const store = FOLLOW.load();
      const rev = store.reviews.find(r => r.id === 'SO-new');
      return {
        due: rev && rev.due,
        hidden: !FOLLOW.dueReviews().some(r => r.id === 'SO-new'),
        noUnhappy: !store.reviews.some(r => r.id === 'SO-unhappy'),
        freshHidden: !FOLLOW.waiting().some(e => e.id === 'E-fresh'),
        soldClosed: !!(store.estimates.find(e => e.id === 'E-sold') || {}).closed,
        leadPatch: !!(queued && queued.lead),
        unhappyPatch: unhappy
      };
    }, TODAY);
    assert(rules.due === addDays(TODAY, 1) && rules.hidden, 'a sign-off queues a review for the next morning, not today');
    assert(rules.noUnhappy, 'a customer who is not happy yet is not asked for a review');
    assert(rules.freshHidden, 'an estimate sent today is not flagged when the wait is 2 days');
    assert(rules.soldClosed, 'an estimate they already picked is not a follow-up');

    const backup = await page.evaluate(() => {
      const archive = PORT.downloadEverything();
      const file = PORT.unzip(archive.bytes).find(f => f.name === 'backup.json');
      const backup = JSON.parse(file.text);
      const csv = PORT.unzip(archive.bytes).find(f => f.name === 'shop-followups.csv').text;
      const raw = backup.data.raw.mt_follow;
      localStorage.setItem('mt_follow', JSON.stringify({ v: 1, days: 2, reviewUrl: 'https://example.com/changed', updatedAt: '2026-01-01T00:00:00.000Z', texts: {}, estimates: [{ id: 'phone-only', customer: 'Phone Only', phone: '6615550100', sent: '2026-01-01', picked: 'Not yet', closed: false }], reviews: [], members: [] }));
      const merged = PORT.apply(backup, 'merge');
      const afterMerge = JSON.parse(localStorage.getItem('mt_follow'));
      const replaced = PORT.apply(backup, 'replace');
      const after = JSON.parse(localStorage.getItem('mt_follow'));
      return {
        version: backup.version,
        hasKey: typeof raw === 'string' && raw.includes('Maria Chen') && raw.includes('g.page') && raw.includes('Dee Cole') && raw.includes('Sam Ortiz'),
        counts: backup.counts,
        csvHas: csv.includes('Maria Chen') && csv.includes('Sam Ortiz') && csv.includes('Dee Cole'),
        mergeOk: merged.ok,
        mergeKeptPhone: afterMerge.estimates.some(e => e.id === 'phone-only'),
        mergeKeptFile: afterMerge.reviews.some(r => r.id === 'SO-sam') || afterMerge.estimates.some(e => e.id === 'E-maria'),
        replaceOk: replaced.ok,
        replaceUrl: after.reviewUrl,
        replaceDropped: !after.estimates.some(e => e.id === 'phone-only'),
        replaceKept: after.estimates.some(e => e.id === 'E-maria') && after.members.some(m => /Dee Cole|Comfort Club|lead-club/.test((m.customer || '') + m.id))
      };
    });
    assert(backup.version === 1 && backup.hasKey, 'the full JSON backup includes estimates, reviews, members and the review link');
    assert(backup.csvHas, 'the backup zip also lists them in shop-followups.csv');
    assert((backup.counts.estimateFollowups || 0) > 0 && (backup.counts.reviewRequests || 0) > 0 && (backup.counts.members || 0) > 0, 'backup counts include the new lists');
    assert(backup.mergeOk && backup.mergeKeptPhone && backup.mergeKeptFile, 'merge keeps follow-ups from the phone and from the file');
    assert(backup.replaceOk && backup.replaceUrl.includes('g.page') && backup.replaceDropped && backup.replaceKept, 'replace restores the file copy of the lists');

    const still = await page.evaluate(() => {
      FOLLOW.refresh();
      return {
        maria: FOLLOW.waiting().some(e => e.customer === 'Maria Chen'),
        dee: FOLLOW.allMembers().some(m => m.customer === 'Dee Cole')
      };
    });
    assert(still.maria && still.dee, 'after restore, Today can build the lists again');
  } finally {
    await browser.close();
    server.kill();
  }
  console.log('shots', shots.join(', '));
  if (fails.length) {
    console.error(fails.length + ' failed');
    process.exit(1);
  }
  console.log('all follow-up checks passed');
}

main().catch(err => { console.error(err); process.exit(1); });
