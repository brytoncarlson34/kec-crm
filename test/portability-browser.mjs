/* Headless browser checks for shop backup, restore and CSV import.
   Run: node test/portability-browser.mjs
   Needs puppeteer-core (npm install --prefix /tmp/ppt puppeteer-core) and Chrome. */
import { createRequire } from 'module';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const require = createRequire('/tmp/ppt/package.json');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(path.dirname(new globalThis.URL(import.meta.url).pathname), '..');
const ART = '/opt/cursor/artifacts';
const PORTN = 8765;
const APP = 'http://127.0.0.1:' + PORTN + '/index.html';
const shots = [];
const fails = [];

function assert(cond, msg) { if (!cond) { fails.push(msg); console.error('FAIL', msg); } else console.log('ok', msg); }

const crm = {
  leads: {
    'L-solar': {
      id: 'L-solar', pack: 'solar', created: '2026-01-15 09:04', updated: '2026-11-02 14:10',
      source: 'door', name: 'Mina Solís', phone: '6615550101', email: 'mina@example.com',
      address: '100 Main St, Bakersfield, CA 93301', owner_renter: 'Owner', need: 'Solar',
      consent: 'Yes, form 2026-01-15 09:04', stage: 'Booked', next_step: 'Call back', next_date: '2026-11-03',
      appt: '2026-11-12 09:30', outcome: '', notes: 'He said "yes, go ahead"\nLine 2, with a comma and =1+1\n日本語 and café',
      rep: 'Ava Tran',
      jobs: [{ id: 'J-1', type: 'Install', start: '2026-11-12 09:00', mins: 120, note: 'Gate code "1234", bring filters', done: false }]
    },
    'L-plumb': {
      id: 'L-plumb', pack: 'plumbing', created: '2026-02-02 11:00', updated: '2026-02-02 11:00',
      source: 'phone', name: "Joe's Plumbing, Inc.", phone: '6615550102', email: 'joe@example.com',
      address: '9 Oak, Apt 4, Bakersfield, CA', need: 'Water heater', stage: 'Contacted',
      next_step: 'Send quote', next_date: '2026-11-09', notes: 'Asked about a tankless', rep: 'Ava Tran'
    },
    'L-hvac': {
      id: 'L-hvac', pack: 'hvac', created: '2026-03-01 08:00', updated: '2026-03-04 16:00',
      source: 'referral', name: 'Renée Díaz', phone: '6615550103', email: 'renee@example.com',
      address: '50 Elm St', need: 'No heat', stage: 'Quoted', notes: 'Filter size confirmed', rep: 'Ava Tran',
      hv_system: 'Heat pump', hv_filter: '16x25x1', hv_member: 'Active', hv_plan: 'Yearly $149', hv_renew: '2027-03-01'
    },
    'L-hand': {
      id: 'L-hand', pack: 'handyman', created: '2026-04-04 10:00', updated: '2026-04-04 10:00',
      source: 'other', name: '田中 健', phone: '6615550104', email: 'ken@example.com',
      address: '1 丁目', need: 'Repair', stage: 'New', notes: '=1+1', rep: 'Ava Tran'
    }
  },
  queue: [{ op: 'update', id: 'L-solar', fields: { stage: 'Booked' } }],
  checks: [
    { check_id: 'C-1', lead_id: 'L-solar', ts: '2026-01-15 09:04', first: 'Mina', mobile: '6615550101', email: 'mina@example.com', street: '100 Main St', apt: 'B', city: 'Bakersfield', state: 'CA', zip: '93301', utility: 'PG&E', result: 'fit', score: 82, green_button_filename: 'usage.csv', green_button_url: 'https://example.com/usage.csv', source: 'kern-energy-check', rep: 'Ava Tran', odd: 'He said "bring the bill"' },
    { check_id: 'C-2', lead_id: 'L-solar', ts: '2026-01-16 09:04', first: 'Mina', mobile: '6615550101', green_button_filename: 'missing-bill.pdf', result: 'maybe', score: 40 }
  ],
  docs: [{ id: 'F-1', lead_id: 'L-solar', formId: 'estimate', title: 'Estimate', total: '$1,200', ts: '2026-11-01 10:00' }],
  last: '2026-11-02 14:10'
};

const biz = {
  v: 3, id: 'valley', name: 'Valley Trade Co', tagline: 'Bring your data', phone: '6615550199', email: 'ava@example.com',
  logoData: 'data:image/png;base64,iVBORw0KGgo=', colors: { primary: '#B86E00', accent: '#1C1A17', bg: '#FBF6EC' },
  thanks: 'Thanks for choosing Valley Trade Co.', primary: 'solar', same: false, updatedAt: 1700000000000, donateUrl: '',
  packs: { solar: { on: true, page: { headline: 'Energy check' } }, plumbing: { on: true }, hvac: { on: true }, handyman: { on: false } },
  forms: { estimate: { hidden: false } },
  customForms: [{ id: 'cf-1', title: 'Site note', fields: [{ id: 'gate', label: 'Gate code' }] }],
  lists: { solar: { sources: ['Door knock', 'Yard sign'] } },
  extras: { energyCheck: true },
  reps: [{ id: 'R-ava', name: 'Ava Tran', phone: '6615550199', email: 'ava@example.com' }],
  profiles: {
    solar: { name: 'Valley Solar', tagline: '', phone: '', email: '', logoData: '', colors: null, thanks: '', forms: {} },
    plumbing: { name: 'Valley Plumbing', tagline: '', phone: '', email: '', logoData: '', colors: null, thanks: '', forms: {} },
    hvac: { name: 'Valley HVAC', tagline: '', phone: '', email: '', logoData: '', colors: null, thanks: '', forms: {} }
  }
};

const fixture = {
  json: {
    mt_crm: crm,
    mt_biz: biz,
    mtf_recent: [{ id: 'F-1', customer: 'Mina Solís', title: 'Estimate', total: '$1,200', when: '11/1/2026', status: 'sent', phone: '6615550101', email: 'mina@example.com', leadId: 'L-solar' }],
    mtf_outbox: [{ id: 'F-2', formId: 'invoice', title: 'Invoice', customer: "Joe's Plumbing, Inc.", phone: '6615550102', email: 'joe@example.com', total: '$80', pdf: 'PDFBYTES-MARKER', pack: 'plumbing', createdAt: '2026-11-02T18:00:00.000Z' }],
    mtf_draft: { formId: 'estimate', pack: 'plumbing', vals: { c_name: 'Draft "Customer"', problem: 'Line1\nLine2' } },
    mtf_invno: 1044,
    mt_files: { 'C-1': { name: 'usage.csv', note: 'metadata only, not the utility file' } },
    mt_me: 'R-ava',
    mt_lens: 'all',
    mt_cal_view: 'week',
    mt_flags: '',
    mt_qtpl: { solar: { greeting: 'Hi {f}' } },
    mt_setup: { done: true },
    mt_up_v2: 1,
    mt_hv_stage_v2: 1
  },
  raw: { mt_pipe_mode: 'board' }
};

function serve() {
  const child = spawn('python3', ['-m', 'http.server', String(PORTN), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  return child;
}

async function boot(browser, extra, opts) {
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
  const fx = extra || fixture;
  await page.evaluateOnNewDocument(data => {
    localStorage.clear();
    Object.entries(data.json).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
    Object.entries(data.raw || {}).forEach(([k, v]) => localStorage.setItem(k, v));
  }, fx);
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PORT && window.CRM);
  if (!opts || opts.ui !== false) await page.waitForSelector('#portBanner, #v-today.on, #gear', { timeout: 15000 });
  return { page, errors };
}

async function shot(page, name) {
  const file = path.join(ART, name);
  await page.screenshot({ path: file, fullPage: false });
  shots.push(file);
  console.log('shot', file);
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
    await page.waitForFunction(() => getComputedStyle(document.getElementById('v-today')).opacity === '1');
    const state = await page.evaluate(() => document.querySelector('#portBanner') && document.querySelector('#portBanner').dataset.portState);
    assert(state === 'device', 'today shows the device-only warning, got ' + state);
    const bannerText = await page.$eval('#portBanner', el => el.innerText);
    assert(/only on this phone/i.test(bannerText) && /Download everything/.test(bannerText), 'warning names the risk and the download');
    await shot(page, 'screenshot_device_only_warning.png');

    await page.click('#gear');
    await page.waitForSelector('#dlEverything');
    await page.waitForFunction(() => getComputedStyle(document.getElementById('v-x')).opacity === '1');
    await page.evaluate(() => document.getElementById('dlEverything').scrollIntoView({ block: 'center' }));
    const moreState = await page.$eval('#portBanner', el => el.dataset.portState);
    assert(moreState === 'device', 'More shows the same device-only warning');
    assert(await page.$('#csvLeads') && await page.$('#imp') && await page.$('#restoreFile'), 'existing CSV buttons and restore are on More');
    await shot(page, 'screenshot_download_everything.png');

    const downloaded = await page.evaluate(() => {
      const archive = PORT.downloadEverything();
      const entries = PORT.unzip(archive.bytes).map(f => f.name);
      const backupFile = PORT.unzip(archive.bytes).find(f => f.name === 'backup.json');
      const backup = JSON.parse(backupFile.text);
      const leads = PORT.unzip(archive.bytes).find(f => f.name === 'leads.csv').text;
      const forms = PORT.unzip(archive.bytes).find(f => f.name === 'forms.csv').text;
      const settings = PORT.unzip(archive.bytes).find(f => f.name === 'settings.csv').text;
      return {
        entries, checksum: backup.checksum, version: backup.version,
        leadsHasFormula: leads.includes("'=1+1"),
        leadsHasUnicode: leads.includes('田中'),
        leadsHasQuote: leads.includes('yes, go ahead'),
        formsHidePdf: !forms.includes('PDFBYTES-MARKER') && forms.includes('has_pdf'),
        settingsHideLogo: !settings.includes('iVBORw0KGgo') && settings.includes('logo_included'),
        readme: PORT.unzip(archive.bytes).find(f => f.name === 'README.txt').text,
        state: PORT.state().id
      };
    });
    ['README.txt', 'backup.json', 'leads.csv', 'jobs.csv', 'follow-ups.csv', 'notes.csv', 'energy-checks.csv', 'documents.csv', 'forms.csv', 'settings.csv'].forEach(name => {
      assert(downloaded.entries.includes(name), 'archive contains ' + name);
    });
    assert(downloaded.version === 1, 'backup version is 1');
    assert(downloaded.leadsHasFormula, 'spreadsheet formula text is prefixed in CSV');
    assert(downloaded.leadsHasUnicode, 'CSV keeps Unicode names');
    assert(downloaded.leadsHasQuote, 'CSV keeps quoted note text');
    assert(downloaded.formsHidePdf, 'forms CSV omits PDF bytes and says a PDF was stored');
    assert(downloaded.settingsHideLogo, 'settings CSV omits logo bytes');
    assert(/not a server backup/i.test(downloaded.readme), 'README says this is not a server backup');
    assert(downloaded.state === 'fresh', 'a new download clears the warning, got ' + downloaded.state);

    const states = await page.evaluate(() => {
      const out = {};
      const data = PORT.collect();
      localStorage.removeItem('mt_port_log');
      const emptyKeys = ['mt_crm', 'mtf_recent', 'mtf_outbox', 'mtf_draft', 'mt_files'];
      const saved = {};
      emptyKeys.forEach(k => { saved[k] = localStorage.getItem(k); localStorage.removeItem(k); });
      out.empty = PORT.state().id;
      emptyKeys.forEach(k => { if (saved[k] != null) localStorage.setItem(k, saved[k]); });
      localStorage.setItem('mt_port_log', JSON.stringify({ at: Date.now() - 8 * 864e5, checksum: PORT.checksum(data) }));
      out.old = PORT.state().id;
      localStorage.setItem('mt_port_log', JSON.stringify({ at: Date.now(), checksum: 'not-the-current-file' }));
      out.changed = PORT.state().reason;
      localStorage.setItem('mtf_cfg', JSON.stringify({ api: 'https://script.google.com/macros/s/SECRET_SHOP_API/exec', key: 'SHOP-KEY-SECRET', rep: 'Ava' }));
      localStorage.setItem('mt_backup', JSON.stringify({ err: 'net', email: 'ava@example.com' }));
      out.fail = PORT.state().id;
      localStorage.removeItem('mtf_cfg');
      localStorage.removeItem('mt_backup');
      localStorage.removeItem('mt_port_log');
      return out;
    });
    assert(states.empty === 'empty', 'no records means no alarm, got ' + states.empty);
    assert(states.old === 'stale', 'a download older than 7 days is stale, got ' + states.old);
    assert(states.changed === 'changed', 'edits after a download are not covered');
    assert(states.fail === 'sync-fail', 'a configured backup that failed is called out, got ' + states.fail);

    const secret = await page.evaluate(() => {
      localStorage.setItem('mt_solar_cfg', JSON.stringify({ api: 'https://script.google.com/macros/s/SECRET_SHEET_API/exec', key: 'PIN-SECRET-99', rep: 'Ava' }));
      localStorage.setItem('mt_session', JSON.stringify({ access_token: 'TOKEN-SECRET-ABC', refresh_token: 'REFRESH-SECRET-XYZ' }));
      localStorage.setItem('mtf_cfg', JSON.stringify({ api: 'https://script.google.com/macros/s/SECRET_SHOP_API/exec', key: 'SHOP-KEY-SECRET', rep: 'Ava' }));
      localStorage.setItem('mt_cals', JSON.stringify([{ id: 'C1', name: 'Family', url: 'https://calendar.google.com/calendar/ical/SECRET_CAL_URL/basic.ics', calId: 'SECRET_CAL_ID', on: true, kind: 'ical', color: '#2563EB' }]));
      localStorage.setItem('mt_backup', JSON.stringify({ sheetUrl: 'https://docs.google.com/SECRET_SHEET_URL', err: '' }));
      localStorage.setItem('mt_acct', JSON.stringify({ biz: 'BIZ1', access_token: 'ACCT-TOKEN-SECRET' }));
      const before = PORT.canon(PORT.collect());
      const backup = PORT.buildBackup();
      const text = JSON.stringify(backup);
      const bad = ['SECRET_SHEET_API', 'PIN-SECRET-99', 'TOKEN-SECRET-ABC', 'REFRESH-SECRET-XYZ', 'SECRET_SHOP_API', 'SHOP-KEY-SECRET', 'SECRET_CAL_URL', 'SECRET_CAL_ID', 'SECRET_SHEET_URL', 'ACCT-TOKEN-SECRET'].filter(s => text.includes(s));
      return { before, backup, bad, hasFamily: JSON.stringify(backup.data.cals).includes('Family'), pinStays: localStorage.getItem('mt_solar_cfg').includes('PIN-SECRET-99') };
    });
    assert(!secret.bad.length, 'backup leaves out credentials, found ' + secret.bad.join(', '));
    assert(secret.hasFamily, 'calendar name is kept');
    assert(secret.pinStays, 'export does not delete the PIN from this phone');

    const previewShot = await page.evaluate(backup => {
      const copy = JSON.parse(JSON.stringify(backup));
      const crm = JSON.parse(copy.data.raw.mt_crm);
      crm.leads['L-solar'].name = 'Mina Changed';
      crm.leads['L-solar'].phone = '6615550191';
      crm.leads['L-solar'].updated = '2026-12-01 09:00';
      crm.leads['L-file'] = { id: 'L-file', pack: 'plumbing', name: 'From the file', phone: '6615550188', email: 'file@example.com', stage: 'New', notes: 'only in the file' };
      delete crm.leads['L-hvac'];
      copy.data.raw.mt_crm = JSON.stringify(crm);
      copy.checksum = PORT.checksum(copy.data);
      const view = PORT.showRestore(copy);
      const text = document.getElementById('portBody').innerText;
      return { text, conflicts: view.conflicts.length, removed: view.replace.onlyPhone.map(l => l.name), added: view.replace.onlyFile.map(l => l.name) };
    }, secret.backup);
    assert(/Nothing changes until you choose/.test(previewShot.text), 'restore explains that nothing is written yet');
    assert(previewShot.conflicts > 0, 'restore preview lists conflicts');
    assert(previewShot.removed.includes('Renée Díaz'), 'replace preview names the lead that would be removed');
    assert(previewShot.added.includes('From the file'), 'replace preview names the lead that would be added');
    assert(/Left out/.test(previewShot.text) && /Merge/.test(previewShot.text) && /Replace/.test(previewShot.text), 'preview shows omissions, merge and replace');
    await page.setViewport({ width: 390, height: 1100, deviceScaleFactor: 1, isMobile: true });
    await shot(page, 'screenshot_restore_preview.png');

    const cancelled = await page.evaluate(() => {
      const before = localStorage.getItem('mt_crm');
      document.querySelector('[data-port-action="cancel"]').click();
      return { same: localStorage.getItem('mt_crm') === before, closed: document.getElementById('portScreen').hidden };
    });
    assert(cancelled.same && cancelled.closed, 'cancel writes nothing');

    const refused = await page.evaluate(backup => {
      const before = localStorage.getItem('mt_crm');
      const bad = JSON.parse(JSON.stringify(backup));
      const crm = JSON.parse(bad.data.raw.mt_crm);
      crm.leads['L-solar'].name = 'Hacked';
      bad.data.raw.mt_crm = JSON.stringify(crm);
      const checksum = PORT.verify(bad);
      const applied = PORT.apply(bad, 'replace');
      bad.version = 99;
      bad.checksum = PORT.checksum(bad.data);
      const version = PORT.verify(bad);
      PORT.showRestore('{');
      const malformed = document.getElementById('portBody').innerText;
      const noReplace = !document.querySelector('[data-port-action="replace"]');
      document.querySelector('[data-port-action="cancel"]').click();
      return { checksum: checksum.error, applied: applied.error, version: version.error, malformed, noReplace, same: localStorage.getItem('mt_crm') === before };
    }, secret.backup);
    assert(refused.checksum === 'checksum' && refused.applied === 'checksum' && refused.same, 'a damaged backup is refused');
    assert(refused.version === 'version', 'a newer backup version is refused');
    assert(/not a backup this app can read/.test(refused.malformed) && refused.noReplace, 'a malformed file has no replace button');

    const quota = await page.evaluate(backup => {
      const before = localStorage.getItem('mt_crm');
      const orig = localStorage.setItem;
      localStorage.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); };
      let result;
      try { result = PORT.apply(backup, 'replace'); }
      finally { localStorage.setItem = orig; }
      return { error: result && result.error, same: localStorage.getItem('mt_crm') === before };
    }, secret.backup);
    assert(quota.error === 'quota' && quota.same, 'a full phone rolls back and keeps the current data');

    const round = await (async () => {
      const ctx = await browser.createBrowserContext();
      const clean = await boot(ctx, { json: { mt_setup: { done: true }, mt_up_v2: 1, mt_hv_stage_v2: 1 }, raw: {} }, { ui: false });
      const result = await clean.page.evaluate(backup => {
        const applied = PORT.apply(backup, 'replace');
        const after = PORT.canon(PORT.collect());
        const pin = localStorage.getItem('mt_solar_cfg');
        const session = localStorage.getItem('mt_session');
        const cal = localStorage.getItem('mt_cals') || '';
        return { ok: applied.ok, after, pin, session, calHasSecret: cal.includes('SECRET_CAL_URL'), calHasName: cal.includes('Family') };
      }, secret.backup);
      const booted = await ctx.newPage();
      await booted.evaluateOnNewDocument(backup => {
        localStorage.clear();
        Object.entries(backup.data.raw).forEach(([k, v]) => { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); });
        if (backup.data.cals == null) localStorage.removeItem('mt_cals'); else localStorage.setItem('mt_cals', JSON.stringify(backup.data.cals));
        if (backup.data.shop == null) localStorage.removeItem('mtf_shop'); else localStorage.setItem('mtf_shop', JSON.stringify(backup.data.shop));
        localStorage.setItem('mt_setup', JSON.stringify({ done: true }));
        localStorage.setItem('mt_up_v2', JSON.stringify(1));
        localStorage.setItem('mt_hv_stage_v2', JSON.stringify(1));
      }, secret.backup);
      await booted.goto(APP, { waitUntil: 'domcontentloaded' });
      await booted.waitForFunction(() => window.PORT);
      const afterBoot = await booted.evaluate(() => PORT.canon(PORT.collect()));
      await clean.page.close();
      await booted.close();
      await ctx.close();
      return { result, afterBoot, before: secret.before };
    })();
    assert(round.result.ok, 'replace restore succeeds on a clean phone');
    assert(round.result.after === round.before, 'business data matches field for field after restore');
    assert(round.afterBoot === round.before, 'business data still matches after the app boots again' + (round.afterBoot === round.before ? '' : ' @' + (function () { const a = round.afterBoot || '', b = round.before || ''; let i = 0; while (a[i] === b[i]) i++; return i + ' ' + a.slice(Math.max(0, i - 30), i + 50); })()));
    assert(!round.result.pin && !round.result.session, 'a clean phone does not gain a PIN or a sign-in from the file');
    assert(!round.result.calHasSecret && round.result.calHasName, 'calendar name restores and the secret address does not');

    const csv = await page.evaluate(() => {
      localStorage.removeItem('mt_solar_cfg');
      localStorage.removeItem('mtf_cfg');
      const archive = PORT.buildArchive();
      const leadsCsv = PORT.unzip(archive.bytes).find(f => f.name === 'leads.csv').text;
      const saved = localStorage.getItem('mt_crm');
      const original = JSON.parse(saved).leads;
      localStorage.setItem('mt_crm', JSON.stringify({ leads: {}, queue: [], checks: [], docs: [], last: '' }));
      const res = PORT.commitImport(leadsCsv, { preset: 'app', policy: 'merge' });
      const back = JSON.parse(localStorage.getItem('mt_crm')).leads;
      const norm = l => { const o = JSON.parse(JSON.stringify(l)); Object.keys(o).forEach(k => { if (o[k] === '') delete o[k]; }); delete o.import_extra; return o; };
      const ids = Object.keys(original);
      const diffs = ids.filter(id => PORT.canon(norm(original[id])) !== PORT.canon(norm(back[id] || {}))).map(id => {
        const a = PORT.canon(norm(original[id])), b = PORT.canon(norm(back[id] || {}));
        let i = 0; while (a[i] === b[i]) i++;
        return id + ' @' + i + ' [' + a.slice(Math.max(0, i - 20), i + 70) + '] vs [' + b.slice(Math.max(0, i - 20), i + 70) + ']';
      });
      const same = !diffs.length;
      localStorage.setItem('mt_crm', saved);
      const jobber = '\uFEFFClient First Name,Client Last Name,Client Email,Client Mobile Phone,Property Street 1,Property City,Property State/Province,Property Zip/Postal Code,Client Internal Notes,Lead Source,Tags,Nickname\n' +
        'Mina,Solís,mina.jobber@example.com,6615550101,"100 Main St","Bakersfield","CA","93301","He said ""bring it""\nSecond line, still","Yard sign","VIP, Repeat",Ace\n' +
        'José,García,jose@example.com,6615550101,200 Oak,Bakersfield,CA,93304,Other person,Referral,Tag,Jay\n' +
        ',,,,,,,,,,,only-a-tag\n' +
        '田中,健,ken.csv@example.com,6615550198,1 丁目,Bakersfield,CA,93301,日本語,Other,A,Ken\n';
      const plan = PORT.planImport(jobber, {});
      PORT.showMapper(jobber, 'jobber-clients.csv');
      const ui = document.getElementById('portBody').innerText;
      const renamed = 'Customer,Cell,Mail,Town,Favorite color\nAnn Roe,6615550177,ann@example.com,Fresno,blue\n';
      const mapped = PORT.planImport(renamed, { mapping: ['name', 'phone', 'email', 'city', 'extra'], policy: 'create', preset: '' });
      const odd = '\uFEFFname;phone;notes\n"Sam";"6615550166";"line1\nline2; still"\n';
      const semi = PORT.planImport(odd, { preset: 'app', policy: 'create' });
      const broken = PORT.parseCsv('name,notes\n"Mina,forgot the end');
      return {
        same, diffs, imported: res.plan.counts, planPreset: plan.preset, planCounts: plan.counts,
        kept: plan.kept, rejected: plan.rejected, ui, unverifiedPresets: PORT.presets.filter(p => p.unverified).map(p => p.name),
        mappedName: mapped.preview[0] && mapped.preview[0].lead.name, mappedExtra: mapped.preview[0] && mapped.preview[0].lead.import_extra,
        semiName: semi.preview[0] && semi.preview[0].lead.name, semiNotes: semi.preview[0] && semi.preview[0].lead.notes,
        broken: broken.malformed
      };
    });
    assert(csv.same, 'this app\'s lead CSV round-trips names, notes, jobs and custom fields ' + (csv.diffs || []).join(' || '));
    assert(csv.planPreset === 'jobber', 'Jobber headers select the Jobber preset, got ' + csv.planPreset);
    assert(/Unverified/.test(csv.ui), 'the mapping screen says the preset is unverified');
    assert(csv.planCounts.rejected === 1, 'a row with no contact is rejected');
    assert(csv.planCounts.merge + csv.planCounts.create >= 2, 'Jobber rows are planned');
    assert(csv.kept.includes('Nickname'), 'an unknown column is kept');
    assert(csv.mappedName === 'Ann Roe' && csv.mappedExtra && csv.mappedExtra['Favorite color'] === 'blue', 'renamed columns follow the mapping and unknown values are kept');
    assert(csv.semiName === 'Sam' && /line2; still/.test(csv.semiNotes || '') && /\n/.test(csv.semiNotes || ''), 'quoted newlines and a semicolon delimiter parse');
    assert(csv.broken, 'an unclosed quote is reported');
    await shot(page, 'screenshot_csv_mapping.png');

    const undone = await page.evaluate(() => {
      const before = JSON.parse(localStorage.getItem('mt_crm')).leads;
      const text = 'name,phone,email,notes\nUndo Me,6615550144,undo@example.com,temporary\n';
      const res = PORT.commitImport(text, { mapping: ['name', 'phone', 'email', 'notes'], policy: 'create', preset: '' });
      const mid = JSON.parse(localStorage.getItem('mt_crm')).leads;
      const added = Object.values(mid).some(l => l.name === 'Undo Me');
      const back = PORT.undo();
      const after = JSON.parse(localStorage.getItem('mt_crm')).leads;
      return { ok: res.ok && back.ok, added, same: PORT.canon(before) === PORT.canon(after) };
    });
    assert(undone.ok && undone.added && undone.same, 'import undo puts the previous leads back');

    const dup = await page.evaluate(() => {
      const text = 'name,phone,email,notes\nMina Solís,6615550101,mina@example.com,brand new note\nNobody,6615550133,new@example.com,hello\n';
      const skip = PORT.planImport(text, { preset: 'app', policy: 'skip' });
      const merge = PORT.planImport(text, { preset: 'app', policy: 'merge' });
      const create = PORT.planImport(text, { preset: 'app', policy: 'create' });
      return { skip: skip.counts, merge: merge.counts, create: create.counts };
    });
    assert(dup.skip.skip === 1 && dup.skip.create === 1, 'skip leaves a duplicate phone alone');
    assert(dup.merge.merge === 1 && dup.merge.create === 1, 'merge updates the matching phone and adds the new one');
    assert(dup.create.create === 2 && dup.create.merge === 0, 'create anyway makes a second lead');

    const consent = await page.evaluate(() => {
      const text = 'First Name,Last Name,Email,Mobile Number,Do Not Mail\nPat,Lee,pat@example.com,6615550122,TRUE\n';
      const st = PORT.planImport(text, { preset: 'servicetitan' });
      const hcp = PORT.planImport('First Name,Last Name,Mobile Number,Email,Address_1 Street Line 1,ID\nPat,Lee,6615550122,pat@example.com,9 Pine,H-9\n', { preset: 'housecall' });
      const lead = st.preview[0].lead;
      return { preset: st.preset, consent: lead.consent || '', extra: lead.import_extra, hcp: hcp.preset, street: hcp.preview[0].lead.address, id: hcp.preview[0].lead.external_id };
    });
    assert(consent.preset === 'servicetitan', 'ServiceTitan report headers select that preset');
    assert(!consent.consent, 'Do Not Mail is not turned into permission to call or text');
    assert(consent.extra && consent.extra['Do Not Mail'] === 'TRUE', 'Do Not Mail is kept as source evidence');
    assert(consent.hcp === 'housecall' && /9 Pine/.test(consent.street) && consent.id === 'H-9', 'Housecall Pro address and id columns map');

    const opened = await page.evaluate(() => {
      document.getElementById('portScreen').hidden = true;
      return true;
    });
    assert(opened, 'mapping screen can close');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
    await page.click('[data-v="leads"]');
    await page.waitForSelector('.lead');
    await page.click('[data-v="leads"]');
    await page.waitForSelector('#fchips');
    await page.evaluate(() => { const b = [...document.querySelectorAll('#fchips [data-f]')].find(n => n.dataset.f === 'All'); b.click(); });
    await page.waitForSelector('#v-leads .lead');
    const names = await page.$$eval('#v-leads .lead .nm', els => els.map(e => e.textContent));
    assert(names.filter(n => /Mina/.test(n)).length === 1 && names.some(n => /Joe/.test(n)) && names.some(n => /Renée|Renee/.test(n)) && names.some(n => /田中/.test(n)), 'existing leads still render: ' + names.join(' | '));
    await page.evaluate(() => { const el = [...document.querySelectorAll('#v-leads .lead')].find(n => /Mina/.test(n.textContent)); el.click(); });
    await page.waitForSelector('#jobsCard');
    const detail = await page.$eval('#detail', el => el.innerText);
    assert(/Install/.test(detail) && /Gate code/.test(detail) && /Booked/.test(detail), 'lead jobs and the booked follow-up still open: ' + detail.slice(0, 180).replace(/\n/g, ' / '));

    await page.evaluate(() => { const d = document.getElementById('detail'); if (d) d.classList.remove('on'); });
    await page.click('#gear');
    await page.waitForSelector('#bringShots');
    await page.evaluate(() => document.getElementById('bringShots').click());
    await page.waitForSelector('#shotPick');
    const bringText = await page.$eval('#portBody', el => el.innerText);
    assert(/imported records/i.test(bringText) && /beta/i.test(bringText) && /picture is still saved/i.test(bringText), 'Bring screenshots explains that pictures are kept and text reading is optional beta');
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true });
    await shot(page, 'screenshot_bring_screenshots.png');

    const shotsIn = await page.evaluate(async () => {
      const contacts = PORT.readContacts('Mina Solis\n(661) 555-0101\nCustomer\n6615550199\nJoe\'s Plumbing\n661-555-0102');
      window.TextDetector = class { async detect() { return [{ rawValue: 'Mina Solis' }, { rawValue: '(661) 555-0101' }]; } };
      const blob = await new Promise(res => {
        const c = document.createElement('canvas'); c.width = 120; c.height = 64;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 120, 64); g.fillStyle = '#172033'; g.font = '20px sans-serif'; g.fillText('Mina', 8, 40);
        c.toBlob(res, 'image/png');
      });
      const file = new File([blob], 'old-crm-customers.png', { type: 'image/png' });
      const withOcr = await PORT.addScreenshots([file]);
      delete window.TextDetector;
      window.TextDetector = class { async detect() { throw new Error('beta failed'); } };
      const failedOcr = await PORT.addScreenshots([new File([blob], 'second-page.png', { type: 'image/png' })]);
      delete window.TextDetector;
      const plain = await PORT.addScreenshots([new File([blob], 'third-page.png', { type: 'image/png' })]);
      const orig = localStorage.setItem;
      localStorage.setItem = function (k, v) { if (k === 'mt_imports') throw new DOMException('quota', 'QuotaExceededError'); return orig.call(this, k, v); };
      const before = localStorage.getItem('mt_imports');
      let quota;
      try { quota = await PORT.addScreenshots([new File([blob], 'too-full.png', { type: 'image/png' })]); }
      finally { localStorage.setItem = orig; }
      const archive = PORT.buildArchive();
      const csv = PORT.unzip(archive.bytes).find(f => f.name === 'imported-records.csv').text;
      const backup = JSON.parse(PORT.unzip(archive.bytes).find(f => f.name === 'backup.json').text);
      PORT.showImported();
      return {
        contacts,
        ocrName: withOcr.added[0] && withOcr.added[0].name,
        ocrPhone: withOcr.added[0] && withOcr.added[0].phone,
        ocrStatus: withOcr.added[0] && withOcr.added[0].ocr,
        image: withOcr.added[0] && withOcr.added[0].image.slice(0, 15),
        failedStillSaved: failedOcr.added[0] && failedOcr.added[0].ocr === 'failed' && failedOcr.added[0].image.startsWith('data:image/'),
        plainSaved: plain.added[0] && plain.added[0].ocr === 'unavailable' && !plain.added[0].name && plain.added[0].image.startsWith('data:image/'),
        quotaBlocked: quota && !quota.added.length && quota.failed[0] && quota.failed[0].error === 'quota' && localStorage.getItem('mt_imports') === before,
        csvHidesPixels: !csv.includes('data:image/') && csv.includes('old-crm-customers.png'),
        jsonKeepsPixels: JSON.stringify(backup).includes(withOcr.added[0].image.slice(0, 40)),
        count: PORT.loadImports().length
      };
    });
    assert(shotsIn.contacts.length === 3 && shotsIn.contacts[0].name === 'Mina Solis' && /555-?0101|5550101/.test(shotsIn.contacts[0].phone.replace(/\D/g, '') ? shotsIn.contacts[0].phone : ''), 'names next to phone numbers are read from screenshot text');
    assert(shotsIn.contacts[1].name === '' && shotsIn.contacts[2].name === "Joe's Plumbing", 'a column title is not treated as a customer name');
    assert(shotsIn.ocrName === 'Mina Solis' && /\d{10}/.test(String(shotsIn.ocrPhone || '').replace(/\D/g, '')) && shotsIn.ocrStatus === 'beta' && String(shotsIn.image || '').indexOf('data:image/png') === 0, 'beta text reading pre-fills a name and phone and keeps the picture');
    assert(shotsIn.failedStillSaved, 'a picture is saved when beta text reading fails');
    assert(shotsIn.plainSaved, 'a picture is saved when this phone cannot read text');
    assert(shotsIn.quotaBlocked, 'a full phone does not drop screenshots that were already saved');
    assert(shotsIn.csvHidesPixels && shotsIn.jsonKeepsPixels && shotsIn.count === 3, 'the backup JSON keeps the screenshots and the CSV only lists them');
    await page.waitForSelector('#importList img');
    await page.evaluate(() => { const el = [...document.querySelectorAll('#importList article')].find(n => /old-crm-customers/.test(n.innerText)); if (el) el.scrollIntoView({ block: 'start' }); });
    const listText = await page.$eval('#importList', el => el.innerText + ' ' + [...el.querySelectorAll('input')].map(i => i.value).join(' '));
    assert(/beta/i.test(listText) && /old-crm-customers\.png/.test(listText) && /Mina Solis/.test(listText), 'Imported records shows the picture, the beta label, and the pre-filled name');
    await shot(page, 'screenshot_imported_records.png');
    await page.close();
  } finally {
    await browser.close();
    server.kill();
  }
  if (fails.length) {
    console.error('\n' + fails.length + ' failed');
    process.exit(1);
  }
  console.log('\nall checks passed');
  console.log(shots.join('\n'));
}

main().catch(err => { console.error(err); process.exit(1); });
