/* Shop data portability (v1).
   Download everything writes a versioned JSON backup plus a CSV package, as one zip.
   Restore previews counts, omissions and conflicts, then merges or replaces.
   The JSON copy of business data is the lossless one. Credentials never go in the file.
   CSV vendor presets use published column names and stay labeled unverified. */
(function () {
  const VERSION = 1;
  const FORMAT = 'kec-crm-backup';
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const RAW_KEYS = ['mt_crm', 'mt_biz', 'mtf_recent', 'mtf_outbox', 'mtf_draft', 'mtf_invno', 'mt_files', 'mt_imports', 'mt_me', 'mt_lens', 'mt_pipe_mode', 'mt_cal_view', 'mt_flags', 'mt_qtpl'];
  const PREF_KEYS = ['mt_me', 'mt_lens', 'mt_pipe_mode', 'mt_cal_view', 'mt_flags', 'mt_qtpl'];
  const LEAD_FIELDS = ['id', 'pack', 'created', 'updated', 'source', 'name', 'phone', 'email', 'address', 'owner_renter', 'need', 'consent', 'stage', 'next_step', 'next_date', 'appt', 'outcome', 'notes', 'rep', 'external_id', 'jobs'];
  const BASE_FIELDS = [
    ['name', 'Name'], ['first', 'First name'], ['last', 'Last name'], ['company', 'Company'],
    ['phone', 'Phone'], ['email', 'Email'], ['address', 'Full address'], ['street', 'Street'],
    ['street2', 'Apt or street 2'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP'],
    ['need', 'Interested in'], ['source', 'Source'], ['stage', 'Stage or status'], ['pack', 'Trade'],
    ['notes', 'Notes'], ['consent', 'Consent to call or text'], ['owner_renter', 'Owner or renter'],
    ['next_step', 'Next step'], ['next_date', 'Follow-up date'], ['appt', 'Appointment'],
    ['outcome', 'Outcome'], ['id', 'Lead id'], ['external_id', 'Id in the other app'],
    ['created', 'Created'], ['updated', 'Updated'], ['rep', 'Rep'], ['jobs', 'Jobs (JSON)'],
    ['extra', 'Keep on the lead'], ['skip', 'Skip this column']
  ];

  /* Published headers only. Jobber: help.getjobber.com Import Clients, plus the sample
     client file's "Client First Name" / "Property Street 1" export headers.
     Housecall Pro: ServiceTitan's public "Export your Housecall Pro data" customers.xlsx
     column list (Housecall Pro's own help page describes the export, not the header row).
     ServiceTitan: the Customer list report columns, and the customers template columns.
     None of these have been checked against a file from a real shop. */
  const PRESETS = [
    { id: 'app', name: 'This app', unverified: false, blurb: 'The lead CSV this app downloads.', headers: mapOf(LEAD_FIELDS.concat(['hv_system', 'hv_age', 'hv_tons', 'hv_filter', 'hv_warranty', 'hv_member', 'hv_plan', 'hv_renew', 'hv_visit', 'hv_pitch', 'hv_joined', 'hv_t24', 'hv_win', 'hv_half'])) },
    { id: 'jobber', name: 'Jobber clients', unverified: true, blurb: 'Unverified. Public Jobber client column names. Customers only, not jobs, invoices or attachments.', headers: {
      'client created date': 'created', 'client is company?': 'extra', 'client title': 'extra',
      'client first name': 'first', 'first name': 'first', 'given name': 'first',
      'client last name': 'last', 'last name': 'last', 'family name': 'last',
      'client full name (display only)': 'name', 'full name': 'name', 'name': 'name',
      'client company name': 'company', 'company name': 'company', 'company': 'company', 'organization name': 'company',
      'client email': 'email', 'email': 'email',
      'client main phone': 'phone', 'main phone': 'phone', 'client mobile phone': 'phone', 'mobile phone': 'phone',
      'client home phone': 'extra', 'home phone': 'extra', 'client work phone': 'extra', 'work phone': 'extra',
      'property street 1': 'street', 'street': 'street', 'street 1': 'street',
      'property street 2': 'street2', 'street 2': 'street2',
      'property city': 'city', 'city': 'city',
      'property state/province': 'state', 'province': 'state', 'state': 'state',
      'property zip/postal code': 'zip', 'postal code': 'zip', 'zip code': 'zip',
      'client internal notes': 'notes', 'note': 'notes',
      'lead source': 'source', 'tags': 'extra', 'j_id': 'external_id'
    }, weight: { 'client first name': 4, 'property street 1': 4, 'client email': 2, 'j_id': 3 } },
    { id: 'housecall', name: 'Housecall Pro customers', unverified: true, blurb: 'Unverified. Column names published for the Housecall Pro customers file. Customers only, not jobs, invoices or attachments.', headers: {
      'first name': 'first', 'last name': 'last', 'display name': 'name',
      'mobile number': 'phone', 'mobile phone': 'phone', 'home phone': 'extra', 'home number': 'extra', 'work number': 'extra',
      'email': 'email', 'company': 'company', 'job title': 'extra', 'tags': 'extra', 'customer tags': 'extra',
      'notes': 'notes', 'id': 'external_id',
      'address_1 street line 1': 'street', 'address_1 street line 2': 'street2',
      'address_1 city': 'city', 'address_1 state': 'state', 'address_1 postal code': 'zip',
      'address_1 billing?': 'extra', 'address_1 notes': 'extra'
    }, weight: { 'address_1 street line 1': 5, 'mobile number': 3, 'address_1 postal code': 3 } },
    { id: 'servicetitan', name: 'ServiceTitan customers', unverified: true, blurb: 'Unverified. Columns from ServiceTitan\'s published Customer list report. Customers only, not jobs, invoices, locations or attachments.', headers: {
      'customer id': 'external_id', 'customer name': 'name', 'type': 'extra',
      'phone number': 'phone', 'email': 'email', 'full address': 'address',
      'do not mail': 'extra', 'do not service': 'extra', 'customer tags': 'extra',
      'last job completed': 'extra', 'lifetime revenue': 'extra', 'lifetime jobs completed': 'extra', 'lifetime invoices': 'extra'
    }, weight: { 'do not mail': 5, 'customer id': 3, 'lifetime revenue': 3, 'full address': 2 } },
    { id: 'servicetitan-template', name: 'ServiceTitan customers template', unverified: true, blurb: 'Unverified. Columns from ServiceTitan\'s published customers template, not a full account export. Customers only.', headers: {
      'customer name': 'name', 'billing street': 'extra', 'billing city': 'extra', 'billing state': 'extra', 'billing zip': 'extra',
      'location name': 'extra', 'location street': 'street', 'location city': 'city', 'location state': 'state', 'location zip': 'zip',
      'phone1': 'phone', 'phone memo': 'extra', 'phone name': 'extra', 'mobile': 'phone', 'fax': 'extra',
      'email': 'email', 'notes': 'notes', 'sourceid': 'external_id'
    }, weight: { 'location street': 5, 'billing street': 4, 'sourceid': 3, 'phone1': 2 } }
  ];

  function mapOf(ids) { const o = {}; ids.forEach(id => { o[id] = id; }); return o; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function clone(v) { return v == null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v)); }
  function canon(v) {
    if (v === undefined) return 'null';
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  function checksum(data) {
    const str = canon(data);
    let h = 0xcbf29ce484222325n, p = 0x100000001b3n;
    for (let i = 0; i < str.length; i++) { h ^= BigInt(str.charCodeAt(i)); h = (h * p) & 0xffffffffffffffffn; }
    return h.toString(16).padStart(16, '0');
  }
  function isEmpty(v) {
    if (v == null) return true;
    if (typeof v === 'string') return v.trim() === '';
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') return Object.keys(v).length === 0;
    return false;
  }
  function digits(s) { return String(s || '').replace(/\D/g, '').slice(-10); }
  function notify(m, undo) { try { if (typeof toast === 'function') toast(m, undo); } catch (e) {} }
  function isQuota(e) { return !!(e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(String(e.name || '') + String(e.message || '')))); }

  function collect() {
    const raw = {};
    RAW_KEYS.forEach(k => { raw[k] = localStorage.getItem(k); });
    return { raw: raw, cals: scrubCals(readJSON('mt_cals', null)), shop: scrubShop(readJSON('mtf_shop', null)) };
  }
  function readJSON(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function scrubCals(v) {
    if (v == null) return null;
    if (!Array.isArray(v)) return [];
    return v.map(c => { const o = Object.assign({}, c || {}); delete o.url; delete o.calId; return o; });
  }
  function scrubShop(v) {
    if (!v || typeof v !== 'object') return v == null ? null : {};
    const o = Object.assign({}, v);
    ['api', 'key', 'token', 'secret', 'password', 'access_token', 'refresh_token'].forEach(k => { delete o[k]; });
    return o;
  }
  function secretNotes() {
    let calsSecret = false;
    const cals = readJSON('mt_cals', null);
    if (Array.isArray(cals)) calsSecret = cals.some(c => c && (c.url || c.calId));
    const missing = [];
    const crm = readJSON('mt_crm', {}) || {};
    const files = readJSON('mt_files', {}) || {};
    (crm.checks || []).forEach(c => {
      const name = c && (c.green_button_filename || c.file || '');
      if (name && !files[c.check_id]) missing.push(name);
    });
    return { calsSecret: calsSecret, missingFiles: missing };
  }

  function parseMaybe(s, fallback) {
    if (s == null) return fallback;
    try { const v = JSON.parse(s); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function countsOf(data) {
    const crm = parseMaybe(data.raw.mt_crm, {});
    const leads = crm && crm.leads ? Object.values(crm.leads) : [];
    const recent = parseMaybe(data.raw.mtf_recent, []);
    const outbox = parseMaybe(data.raw.mtf_outbox, []);
    const draft = parseMaybe(data.raw.mtf_draft, null);
    const files = parseMaybe(data.raw.mt_files, {});
    const trades = {};
    leads.forEach(l => { const id = (l && l.pack) || 'solar'; trades[id] = (trades[id] || 0) + 1; });
    let notes = 0, jobs = 0, follow = 0;
    leads.forEach(l => {
      if (!l) return;
      notes += String(l.notes || '').split('\n').filter(x => String(x).trim()).length;
      jobs += (l.jobs || []).length;
      if (l.next_step || l.next_date || l.appt) follow++;
    });
    const forms = (Array.isArray(recent) ? recent.length : 0) + (Array.isArray(outbox) ? outbox.length : 0) + (draft ? 1 : 0);
    const imports = parseMaybe(data.raw.mt_imports, []);
    return {
      leads: leads.length, jobs: jobs, notes: notes, followups: follow,
      checks: (crm.checks || []).length, documents: (crm.docs || []).length,
      forms: forms, files: files && typeof files === 'object' ? Object.keys(files).length : 0,
      imports: Array.isArray(imports) ? imports.length : 0,
      trades: trades
    };
  }
  function hasRecords(c) { return c.leads + c.checks + c.documents + c.forms + c.files + (c.imports || 0) > 0; }

  function buildOmissions(meta) {
    const items = [
      { id: 'secrets', text: 'Left out on purpose: the Google Sheet link, PIN, shop key, account sign-in, and private calendar addresses. Reconnect those in More. This file cannot sign you in.' },
      { id: 'scope', text: 'This is what is stored on this phone. It is not a server backup. Records that live only in a Google Sheet or an account, and were never on this phone, are not here.' },
      { id: 'pdf', text: 'Signed PDFs that already left this phone are not in the file. Sent forms keep their summary and the note on the lead. A PDF still waiting on this phone is in the JSON file only.' },
      { id: 'usage', text: 'A usage-file name or link is not the file itself. File bytes are included only when they were still saved on this phone.' }
    ];
    if (meta.calsSecret) items.push({ id: 'calendars', text: 'Calendar names are included. Secret calendar addresses were removed. Paste them again under Pipeline, Link calendars. Merge keeps addresses already saved on this phone. Replace clears them, because they are not in the file.' });
    if (meta.missingFiles.length) items.push({ id: 'missing-files', text: 'No file bytes on this phone for: ' + meta.missingFiles.slice(0, 8).join(', ') + (meta.missingFiles.length > 8 ? ', and ' + (meta.missingFiles.length - 8) + ' more' : '') + '.' });
    return items;
  }

  function buildBackup() {
    const data = collect();
    const counts = countsOf(data);
    const meta = secretNotes();
    return {
      format: FORMAT,
      version: VERSION,
      checksumAlg: 'fnv1a64',
      checksum: checksum(data),
      exportedAt: new Date().toISOString(),
      timezone: 'America/Los_Angeles',
      scope: 'this-phone',
      counts: counts,
      omissions: buildOmissions(meta),
      reconnect: ['Google Sheet (link and PIN)', 'Back it up for me', 'Account sign-in', 'Linked calendars'],
      data: data
    };
  }

  function verify(backup) {
    if (!backup || typeof backup !== 'object') return { ok: false, error: 'malformed' };
    if (backup.format !== FORMAT || !backup.data || !backup.data.raw) return { ok: false, error: 'malformed' };
    if (backup.version !== VERSION) return { ok: false, error: 'version', version: backup.version };
    if (checksum(backup.data) !== backup.checksum) return { ok: false, error: 'checksum' };
    return { ok: true };
  }

  function noteUnion(a, b) {
    if (canon(a) === canon(b)) return a || '';
    const out = [], seen = new Set();
    String(a || '').split('\n').concat(String(b || '').split('\n')).forEach(line => {
      if (!String(line).trim() || seen.has(line)) return;
      seen.add(line); out.push(line);
    });
    return out.join('\n');
  }
  function pickEarlier(a, b) { if (!a) return b || ''; if (!b) return a; return String(a) <= String(b) ? a : b; }
  function pickLater(a, b) { if (!a) return b || ''; if (!b) return a; return String(a) >= String(b) ? a : b; }

  function mergeAny(a, b, path, fileNewer, conflicts) {
    if (canon(a) === canon(b)) return clone(a);
    if (path === 'notes' || /\.notes$/.test(path)) return noteUnion(a, b);
    if (isEmpty(a)) return clone(b);
    if (isEmpty(b)) return clone(a);
    if (Array.isArray(a) && Array.isArray(b)) {
      const keyed = a.every(x => x && typeof x === 'object' && x.id) && b.every(x => x && typeof x === 'object' && x.id);
      if (keyed) {
        const map = new Map(a.map(x => [x.id, clone(x)]));
        b.forEach(x => {
          if (!map.has(x.id)) map.set(x.id, clone(x));
          else map.set(x.id, mergeAny(map.get(x.id), x, path + '/' + x.id, fileNewer, conflicts));
        });
        return Array.from(map.values());
      }
      if (a.every(x => x == null || typeof x !== 'object') && b.every(x => x == null || typeof x !== 'object')) {
        const out = a.slice();
        b.forEach(x => { if (out.indexOf(x) < 0) out.push(x); });
        return out;
      }
    }
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      const out = clone(a);
      Object.keys(b).forEach(k => {
        if (!Object.prototype.hasOwnProperty.call(a, k) || isEmpty(a[k])) out[k] = clone(b[k]);
        else out[k] = mergeAny(a[k], b[k], path + '.' + k, fileNewer, conflicts);
      });
      return out;
    }
    conflicts.push({ entity: path.split(':')[0] || 'record', path: path, phone: a, file: b, kept: fileNewer ? 'file' : 'phone' });
    return clone(fileNewer ? b : a);
  }

  function mergeJobs(a, b, fileNewer, conflicts, leadId) {
    const out = (a || []).map(j => Object.assign({}, j));
    const idx = new Map();
    out.forEach((j, i) => idx.set(j.id || (j.type + '|' + j.start), i));
    (b || []).forEach(j => {
      const k = j.id || (j.type + '|' + j.start);
      if (!idx.has(k)) { out.push(Object.assign({}, j)); idx.set(k, out.length - 1); return; }
      const i = idx.get(k), cur = out[i];
      if (canon(cur) === canon(j)) return;
      const next = Object.assign({}, cur);
      Object.keys(j).forEach(f => {
        if (canon(cur[f]) === canon(j[f]) || isEmpty(j[f])) return;
        if (isEmpty(cur[f])) { next[f] = j[f]; return; }
        if (fileNewer) { next[f] = j[f]; conflicts.push({ entity: 'job', id: leadId, field: f, phone: cur[f], file: j[f], kept: 'file' }); }
        else conflicts.push({ entity: 'job', id: leadId, field: f, phone: cur[f], file: j[f], kept: 'phone' });
      });
      out[i] = next;
    });
    return out;
  }
  function mergeLead(phone, file, conflicts) {
    const fileNewer = String(file.updated || '') > String(phone.updated || '');
    const a = Object.assign({}, phone), b = Object.assign({}, file);
    ['jobs', 'notes', 'created', 'updated'].forEach(k => { delete a[k]; delete b[k]; });
    const out = mergeAny(a, b, 'lead:' + (phone.id || file.id), fileNewer, conflicts);
    out.id = phone.id || file.id;
    out.notes = noteUnion(phone.notes, file.notes);
    const jobs = mergeJobs(phone.jobs, file.jobs, fileNewer, conflicts, out.id);
    if (jobs.length) out.jobs = jobs; else delete out.jobs;
    out.created = pickEarlier(phone.created, file.created);
    out.updated = pickLater(phone.updated, file.updated);
    return out;
  }
  function contactOf(l) { const d = digits(l && l.phone), e = String(l && l.email || '').trim().toLowerCase(); return { d: d.length >= 7 ? d : '', e: e }; }
  function indexContacts(leads) {
    const by = { d: {}, e: {} };
    Object.keys(leads || {}).forEach(id => {
      const c = contactOf(leads[id]);
      if (c.d && !by.d[c.d]) by.d[c.d] = id;
      if (c.e && !by.e[c.e]) by.e[c.e] = id;
    });
    return by;
  }
  function findContact(by, l) { const c = contactOf(l); if (c.d && by.d[c.d]) return by.d[c.d]; if (c.e && by.e[c.e]) return by.e[c.e]; return ''; }
  function remember(by, l) { const c = contactOf(l); if (c.d && !by.d[c.d]) by.d[c.d] = l.id; if (c.e && !by.e[c.e]) by.e[c.e] = l.id; }

  function mergeById(a, b, idFn, conflicts, entity) {
    const out = (Array.isArray(a) ? a : []).map(x => clone(x));
    const idx = new Map();
    out.forEach((x, i) => { const id = idFn(x); if (id) idx.set(id, i); });
    (Array.isArray(b) ? b : []).forEach(x => {
      const id = idFn(x);
      if (!id || !idx.has(id)) { out.push(clone(x)); if (id) idx.set(id, out.length - 1); return; }
      const i = idx.get(id);
      const fileNewer = String((x && (x.ts || x.updated)) || '') > String((out[i] && (out[i].ts || out[i].updated)) || '');
      out[i] = mergeAny(out[i], x, entity + ':' + id, fileNewer, conflicts);
    });
    return out;
  }
  function mergeQueue(a, b) {
    const out = Array.isArray(a) ? a.slice() : [];
    const seen = new Set(out.map(x => JSON.stringify(x)));
    (Array.isArray(b) ? b : []).forEach(x => { const s = JSON.stringify(x); if (!seen.has(s)) { seen.add(s); out.push(x); } });
    return out;
  }
  function mergeCrm(phone, file, conflicts) {
    const p = phone || {}, f = file || {};
    const leads = Object.assign({}, p.leads || {});
    const by = indexContacts(leads);
    Object.keys(f.leads || {}).forEach(id => {
      const incoming = f.leads[id];
      if (!incoming) return;
      if (leads[id]) { leads[id] = mergeLead(leads[id], Object.assign({ id: id }, incoming), conflicts); remember(by, leads[id]); return; }
      const dup = findContact(by, incoming);
      if (dup && leads[dup]) {
        conflicts.push({ entity: 'lead', id: id, field: 'contact', name: incoming.name || '', phone: dup, file: id, kept: 'both' });
      }
      leads[id] = clone(incoming); if (!leads[id].id) leads[id].id = id;
      remember(by, leads[id]);
    });
    const out = Object.assign({}, p, { leads: leads, queue: mergeQueue(p.queue, f.queue), checks: mergeById(p.checks, f.checks, x => x && x.check_id, conflicts, 'check'), docs: mergeById(p.docs, f.docs, x => x && x.id, conflicts, 'document'), last: pickLater(p.last, f.last) });
    Object.keys(f).forEach(k => {
      if (['leads', 'queue', 'checks', 'docs', 'last'].indexOf(k) >= 0) return;
      if (isEmpty(out[k])) out[k] = clone(f[k]);
      else if (canon(out[k]) !== canon(f[k])) out[k] = mergeAny(out[k], f[k], 'crm.' + k, false, conflicts);
    });
    return out;
  }
  function mergeForms(phoneRaw, fileRaw, conflicts) {
    const recent = mergeById(parseMaybe(phoneRaw.mtf_recent, []), parseMaybe(fileRaw.mtf_recent, []), x => x && x.id, conflicts, 'form');
    const outbox = mergeById(parseMaybe(phoneRaw.mtf_outbox, []), parseMaybe(fileRaw.mtf_outbox, []), x => x && x.id, conflicts, 'form');
    const pd = parseMaybe(phoneRaw.mtf_draft, null), fd = parseMaybe(fileRaw.mtf_draft, null);
    let draft = pd || fd || null;
    if (pd && fd && canon(pd) !== canon(fd)) {
      draft = pd;
      conflicts.push({ entity: 'form', id: 'draft', field: 'draft', phone: 'this phone', file: 'the file', kept: 'phone' });
    }
    const pi = parseMaybe(phoneRaw.mtf_invno, null), fi = parseMaybe(fileRaw.mtf_invno, null);
    const inv = (typeof pi === 'number' || typeof fi === 'number') ? Math.max(+pi || 0, +fi || 0) : (pi != null ? pi : fi);
    return { recent: recent, outbox: outbox, draft: draft, invno: inv };
  }

  function leadNames(map) {
    return Object.keys(map || {}).map(id => { const l = map[id] || {}; return { id: id, name: l.name || id, pack: l.pack || 'solar' }; });
  }
  function leadDiff(phone, file) {
    const p = (phone && phone.leads) || {}, f = (file && file.leads) || {};
    const onlyPhone = [], onlyFile = [], both = [];
    Object.keys(p).forEach(id => { if (!f[id]) onlyPhone.push({ id: id, name: p[id].name || id, pack: p[id].pack || 'solar' }); else both.push(id); });
    Object.keys(f).forEach(id => { if (!p[id]) onlyFile.push({ id: id, name: f[id].name || id, pack: f[id].pack || 'solar' }); });
    return { onlyPhone: onlyPhone, onlyFile: onlyFile, both: both };
  }

  function preview(backup) {
    const v = verify(backup);
    if (!v.ok) return v;
    const phoneRaw = collect();
    const fileRaw = backup.data;
    const conflicts = [];
    const phoneCrm = parseMaybe(phoneRaw.raw.mt_crm, { leads: {} });
    const fileCrm = parseMaybe(fileRaw.raw.mt_crm, { leads: {} });
    mergeCrm(phoneCrm, fileCrm, conflicts);
    mergeForms(phoneRaw.raw, fileRaw.raw, conflicts);
    const phoneBiz = parseMaybe(phoneRaw.raw.mt_biz, {});
    const fileBiz = parseMaybe(fileRaw.raw.mt_biz, {});
    if (phoneBiz && fileBiz && Object.keys(phoneBiz).length && Object.keys(fileBiz).length) mergeAny(phoneBiz, fileBiz, 'settings', String(fileBiz.updatedAt || '') > String(phoneBiz.updatedAt || ''), conflicts);
    return {
      ok: true,
      counts: { phone: countsOf(phoneRaw), file: countsOf(fileRaw) },
      omissions: backup.omissions || [],
      reconnect: backup.reconnect || [],
      conflicts: conflicts,
      replace: leadDiff(phoneCrm, fileCrm),
      exportedAt: backup.exportedAt || '',
      scope: backup.scope || 'this-phone'
    };
  }

  function writeMany(pairs) {
    const prev = pairs.map(pair => [pair[0], localStorage.getItem(pair[0])]);
    try {
      pairs.forEach(pair => { if (pair[1] == null) localStorage.removeItem(pair[0]); else localStorage.setItem(pair[0], pair[1]); });
    } catch (e) {
      prev.forEach(pair => { try { if (pair[1] == null) localStorage.removeItem(pair[0]); else localStorage.setItem(pair[0], pair[1]); } catch (e2) {} });
      const err = new Error(isQuota(e) ? 'quota' : 'write'); err.code = isQuota(e) ? 'quota' : 'write'; throw err;
    }
  }
  function saveUndo(kind, keys) {
    const snap = { at: Date.now(), kind: kind, keys: {} };
    keys.forEach(k => { snap.keys[k] = localStorage.getItem(k); });
    localStorage.setItem('mt_port_undo', JSON.stringify(snap));
  }
  function pairsFor(backup, mode) {
    const file = backup.data, phone = collect(), conflicts = [];
    if (mode === 'replace') {
      const pairs = RAW_KEYS.map(k => [k, file.raw[k] == null ? null : String(file.raw[k])]);
      pairs.push(['mt_cals', file.cals == null ? null : JSON.stringify(file.cals)]);
      pairs.push(['mtf_shop', file.shop == null ? null : JSON.stringify(file.shop)]);
      return pairs;
    }
    const crm = mergeCrm(parseMaybe(phone.raw.mt_crm, { leads: {}, queue: [], checks: [], docs: [], last: '' }), parseMaybe(file.raw.mt_crm, { leads: {}, queue: [], checks: [], docs: [], last: '' }), conflicts);
    const forms = mergeForms(phone.raw, file.raw, conflicts);
    const bizPhone = parseMaybe(phone.raw.mt_biz, null), bizFile = parseMaybe(file.raw.mt_biz, null);
    let biz = bizPhone || bizFile;
    if (bizPhone && bizFile) biz = mergeAny(bizPhone, bizFile, 'settings', String(bizFile.updatedAt || '') > String(bizPhone.updatedAt || ''), conflicts);
    const files = (phone.raw.mt_files == null && file.raw.mt_files == null) ? null : mergeAny(parseMaybe(phone.raw.mt_files, {}), parseMaybe(file.raw.mt_files, {}), 'files', false, conflicts);
    const keep = (a, b, v) => (a == null && b == null) ? null : JSON.stringify(v);
    const pairs = [
      ['mt_crm', phone.raw.mt_crm == null && file.raw.mt_crm == null ? null : JSON.stringify(crm)],
      ['mt_biz', biz == null ? null : JSON.stringify(biz)],
      ['mtf_recent', keep(phone.raw.mtf_recent, file.raw.mtf_recent, forms.recent || [])],
      ['mtf_outbox', keep(phone.raw.mtf_outbox, file.raw.mtf_outbox, forms.outbox || [])],
      ['mtf_draft', forms.draft == null ? null : JSON.stringify(forms.draft)],
      ['mtf_invno', forms.invno == null ? null : JSON.stringify(forms.invno)],
      ['mt_files', files == null ? null : JSON.stringify(files)],
      ['mt_imports', mergedImports(phone.raw.mt_imports, file.raw.mt_imports)]
    ];
    PREF_KEYS.forEach(k => pairs.push([k, phone.raw[k] != null ? phone.raw[k] : file.raw[k]]));
    const cals = mergeById(phone.cals || [], file.cals || [], x => x && x.id, conflicts, 'calendar');
    pairs.push(['mt_cals', (phone.cals == null && file.cals == null) ? null : JSON.stringify(cals)]);
    const shop = !isEmpty(phone.shop) ? phone.shop : file.shop;
    pairs.push(['mtf_shop', shop == null ? null : JSON.stringify(shop)]);
    return pairs;
  }

  function apply(backup, mode) {
    const v = verify(backup);
    if (!v.ok) return v;
    if (mode !== 'replace' && mode !== 'merge') return { ok: false, error: 'mode' };
    const pairs = pairsFor(backup, mode);
    try { saveUndo(mode, pairs.map(p => p[0])); }
    catch (e) { return { ok: false, error: 'quota', message: 'This phone is full, so nothing was changed. Download a backup, then free some space.' }; }
    try { writeMany(pairs); }
    catch (e) {
      try { localStorage.removeItem('mt_port_undo'); } catch (e2) {}
      return { ok: false, error: e.code || 'write', message: e.code === 'quota' ? 'This phone is full, so nothing was changed.' : 'Nothing was changed.' };
    }
    closeScreen();
    refresh();
    notify(mode === 'replace' ? 'Backup restored. This phone matches the file.' : 'Backup merged.', undo);
    return { ok: true, mode: mode };
  }
  function undo() {
    const raw = localStorage.getItem('mt_port_undo');
    if (!raw) return { ok: false, error: 'none' };
    let snap; try { snap = JSON.parse(raw); } catch (e) { return { ok: false, error: 'malformed' }; }
    const pairs = Object.keys(snap.keys || {}).map(k => [k, snap.keys[k]]);
    try { writeMany(pairs); localStorage.removeItem('mt_port_undo'); }
    catch (e) { return { ok: false, error: 'quota', message: 'Could not undo. The previous copy is still on this phone in the undo slot.' }; }
    refresh();
    notify('Undone.');
    return { ok: true };
  }

  function remoteStatus() {
    let configured = false, failing = false;
    const solar = readJSON('mt_solar_cfg', {}) || {};
    if (solar.api && solar.key) {
      configured = true;
      try {
        const s = window.CRM && CRM.syncState ? CRM.syncState() : null;
        if (s && (s.err || s.authed === false)) failing = true;
      } catch (e) {}
    }
    const cfg = readJSON('mtf_cfg', {}) || {};
    const bkp = readJSON('mt_backup', {}) || {};
    if (cfg.api && cfg.key) { configured = true; if (bkp.err) failing = true; }
    const acct = readJSON('mt_acct', {}) || {};
    if (localStorage.getItem('mt_session') && acct.biz) { configured = true; if (acct.err) failing = true; }
    else if (acct.err) { configured = true; failing = true; }
    if (!configured) return 'none';
    return failing ? 'failing' : 'ok';
  }
  function coverage() {
    const data = collect();
    const sum = checksum(data);
    const counts = countsOf(data);
    const has = hasRecords(counts);
    const log = readJSON('mt_port_log', null);
    const at = log && log.at ? +log.at : 0;
    const age = at ? Date.now() - at : Infinity;
    const same = !!(log && log.checksum === sum);
    const fresh = same && age < WEEK;
    const remote = remoteStatus();
    let id = 'empty', reason = 'never';
    if (!has) id = 'empty';
    else if (remote === 'failing') id = 'sync-fail';
    else if (fresh) id = 'fresh';
    else if (remote === 'none' && !log) id = 'device';
    else id = 'stale';
    if (!log) reason = 'never';
    else if (!same) reason = 'changed';
    else if (age >= WEEK) reason = 'old';
    else reason = 'ok';
    return { id: id, has: has, sum: sum, age: age, fresh: fresh, remote: remote, counts: counts, reason: reason, at: at };
  }
  function ageLabel(ms) {
    if (!isFinite(ms)) return '';
    const d = Math.floor(ms / 86400000);
    if (d < 1) return 'today';
    if (d === 1) return '1 day ago';
    return d + ' days ago';
  }
  function bannerCopy(s) {
    if (s.id === 'empty') return { title: 'Nothing stored yet', body: 'No leads, jobs, notes, checks or forms are stored on this phone yet.' };
    if (s.id === 'device') return { title: 'Only on this phone', body: 'These leads, jobs, notes and forms are only on this phone. Clearing the browser, or opening a new phone, will not have them.' };
    if (s.id === 'sync-fail') return { title: 'Backup did not go through', body: 'A backup connection is on, but the last try failed. The current copy is on this phone.' + (s.fresh ? ' The last full download matches this phone.' : '') };
    if (s.id === 'fresh') return { title: 'Full download is up to date', body: 'The last full download matches what is on this phone' + (s.at ? ' (' + ageLabel(s.age) + ')' : '') + '.' };
    if (s.reason === 'changed') return { title: 'Download is out of date', body: 'This phone has changed since the last full download, so that file is no longer a full copy.' };
    if (s.reason === 'old') return { title: 'Download is over 7 days old', body: 'The last full download was ' + ageLabel(s.age) + '. Download a new one so the file matches this phone.' };
    return { title: 'No full download yet', body: s.remote === 'ok' ? 'A connected backup does not include every check, form and file. There is no full download yet.' : 'There is no full download from the last 7 days.' };
  }
  function bannerHtml(where) {
    if (window.CRM && CRM.customer) return '';
    const s = coverage();
    if (s.id === 'empty' && where !== 'more') return '';
    const copy = bannerCopy(s);
    const btn = s.id === 'empty' ? '' : '<button class="btn ' + (s.id === 'fresh' ? 'soft' : 'pri') + ' full tap" type="button" data-port-dl="1">' + (s.id === 'fresh' ? 'Download again' : 'Download everything') + '</button>';
    return '<div id="portBanner" class="port-banner ' + s.id + '" data-port-state="' + s.id + '" data-port-reason="' + esc(s.reason) + '" data-port-remote="' + esc(s.remote) + '"><b>' + esc(copy.title) + '</b><div class="t">' + esc(copy.body) + '</div>' + btn + '</div>';
  }
  function bindBanner(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-port-dl]').forEach(b => { b.onclick = ev => { ev.preventDefault(); downloadEverything(); }; });
    const rf = scope.querySelector('#restoreFile');
    if (rf) rf.onchange = e => openBackup(e);
    const bs = scope.querySelector('#bringShots');
    if (bs) bs.onclick = () => showBringShots();
    const oi = scope.querySelector('#openImports');
    if (oi) oi.onclick = () => showImported();
  }

  function markDownloaded(sum) {
    try { localStorage.setItem('mt_port_log', JSON.stringify({ at: Date.now(), checksum: sum })); } catch (e) {}
  }
  function refresh() {
    try {
      const vx = document.getElementById('v-x');
      if (vx && vx.classList.contains('on') && window.KF && KF.render) { KF.render(); return; }
    } catch (e) {}
    try { if (window.CRM && CRM.render) CRM.render(); } catch (e) {}
  }

  /* ---------- zip (stored, no compression) and CSV ---------- */
  const CRC_TAB = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC_TAB[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function u16(n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n & 0xffff, true); return b; }
  function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0, true); return b; }
  function concat(parts) { let n = 0; parts.forEach(p => { n += p.length; }); const o = new Uint8Array(n); let i = 0; parts.forEach(p => { o.set(p, i); i += p.length; }); return o; }
  function dosStamp(d) {
    const dt = d || new Date();
    return { time: ((dt.getHours() & 31) << 11) | ((dt.getMinutes() & 63) << 5) | ((dt.getSeconds() >> 1) & 31), date: (((dt.getFullYear() - 1980) & 127) << 9) | (((dt.getMonth() + 1) & 15) << 5) | (dt.getDate() & 31) };
  }
  function zipStore(files) {
    const enc = new TextEncoder();
    const locals = [], central = [];
    let offset = 0;
    const stamp = dosStamp(new Date());
    files.forEach(f => {
      const name = enc.encode(f.name);
      const data = f.data || enc.encode(f.text || '');
      const crc = crc32(data);
      const local = concat([u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(stamp.time), u16(stamp.date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
      locals.push(local);
      central.push(concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(stamp.time), u16(stamp.date), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
      offset += local.length;
    });
    const cd = concat(central);
    const eocd = concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)]);
    return concat(locals.concat([cd, eocd]));
  }
  function unzip(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const dv = new DataView(view.buffer, view.byteOffset, view.byteLength);
    const out = [];
    let i = 0;
    const dec = new TextDecoder();
    while (i + 30 <= view.length && dv.getUint32(i, true) === 0x04034b50) {
      const method = dv.getUint16(i + 8, true);
      const crc = dv.getUint32(i + 14, true);
      const size = dv.getUint32(i + 18, true);
      const nameLen = dv.getUint16(i + 26, true);
      const extra = dv.getUint16(i + 28, true);
      const start = i + 30 + nameLen + extra;
      const name = dec.decode(view.subarray(i + 30, i + 30 + nameLen));
      const data = view.subarray(start, start + size);
      if (method !== 0) throw new Error('compressed');
      if (crc32(data) !== crc) throw new Error('checksum');
      out.push({ name: name, data: data, text: dec.decode(data) });
      i = start + size;
    }
    return out;
  }

  function csvEscape(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function toCsv(rows, cols) {
    const lines = [cols.map(csvEscape).join(',')];
    rows.forEach(r => lines.push(cols.map(c => csvEscape(r[c])).join(',')));
    return '\uFEFF' + lines.join('\n') + '\n';
  }
  function colsOf(rows, first) {
    const seen = new Set(first || []), rest = [];
    rows.forEach(r => Object.keys(r || {}).forEach(k => { if (!seen.has(k)) { seen.add(k); rest.push(k); } }));
    rest.sort();
    return (first || []).filter(k => seen.has(k)).concat(rest);
  }
  function flat(v) {
    const o = {};
    Object.keys(v || {}).forEach(k => {
      const x = v[k];
      if (k === 'pdf') { o.has_pdf = x ? 'yes' : 'no'; o.pdf_bytes = x ? String(x).length : 0; return; }
      if (k === 'logoData') { o.logo_included = x ? 'yes' : 'no'; return; }
      o[k] = x != null && typeof x === 'object' ? JSON.stringify(x) : (x == null ? '' : x);
    });
    return o;
  }
  function tradeLine(counts) {
    return Object.keys(counts.trades).sort().map(id => {
      let name = id, off = false;
      try { name = (MT.pack(id) && MT.pack(id).name) || id; off = MT.isOn && !MT.isOn(id); } catch (e) {}
      return name + ' ' + counts.trades[id] + (off ? ' (trade is off)' : '');
    }).join(', ') || 'none';
  }
  function readme(backup) {
    const c = backup.counts || {};
    const lines = [
      'Shop backup',
      'Version ' + backup.version + '  ' + (backup.exportedAt || ''),
      'Times already stored in the app are Pacific wall times (America/Los_Angeles).',
      '',
      'What this is',
      'A copy of the business data on this phone: every trade, lead, job, follow-up, note, energy check, form record and setting that was saved here.',
      'backup.json is the lossless copy. Restoring that file can put the same business data back.',
      'The CSV files are for a spreadsheet. A cell that starts with =, +, - or @ is prefixed with a single quote so the sheet does not treat it as a formula. backup.json keeps the original text.',
      '',
      'Counts',
      'Leads: ' + (c.leads || 0),
      'Jobs: ' + (c.jobs || 0),
      'Notes: ' + (c.notes || 0),
      'Follow-ups: ' + (c.followups || 0),
      'Energy checks: ' + (c.checks || 0),
      'Documents: ' + (c.documents || 0),
      'Form records: ' + (c.forms || 0),
      'Imported screenshots: ' + (c.imports || 0),
      'Trades: ' + tradeLine(c),
      '',
      'Files',
      'leads.csv is one row per lead. jobs.csv, follow-ups.csv, notes.csv, energy-checks.csv, documents.csv and forms.csv link back with lead_id or id.',
      'settings.csv is the business setup. Logo image data stays in backup.json.',
      'forms.csv leaves out PDF bytes. Those bytes, when they were still on this phone, are in backup.json.',
      'imported-records.csv lists screenshots brought over from another app. The pictures themselves are in backup.json, not in the CSV.',
      '',
      'Left out',
    ];
    (backup.omissions || []).forEach(o => lines.push('- ' + o.text));
    lines.push('', 'After a restore, reconnect: ' + (backup.reconnect || []).join('; ') + '.');
    lines.push('', 'This file does not make the phone immune to every kind of loss. Keep a copy somewhere that is not this phone.');
    return lines.join('\n') + '\n';
  }
  function packageFiles(backup) {
    const crm = parseMaybe(backup.data.raw.mt_crm, { leads: {}, checks: [], docs: [] });
    const leads = Object.keys(crm.leads || {}).map(id => flat(Object.assign({ id: id }, crm.leads[id])));
    const jobs = [], notes = [], follow = [];
    Object.keys(crm.leads || {}).forEach(id => {
      const l = crm.leads[id] || {};
      (l.jobs || []).forEach(j => jobs.push({ lead_id: id, lead_name: l.name || '', job_id: j.id || '', type: j.type || '', start: j.start || '', mins: j.mins || '', note: j.note || '', done: j.done ? 'yes' : 'no' }));
      String(l.notes || '').split('\n').forEach((line, i) => { if (String(line).trim()) notes.push({ lead_id: id, lead_name: l.name || '', pack: l.pack || 'solar', index: i + 1, text: line }); });
      if (l.next_step || l.next_date || l.appt) follow.push({ lead_id: id, name: l.name || '', pack: l.pack || 'solar', stage: l.stage || '', next_step: l.next_step || '', next_date: l.next_date || '', appt: l.appt || '' });
    });
    const checks = (crm.checks || []).map(flat);
    const docs = (crm.docs || []).map(flat);
    const recent = parseMaybe(backup.data.raw.mtf_recent, []);
    const outbox = parseMaybe(backup.data.raw.mtf_outbox, []);
    const draft = parseMaybe(backup.data.raw.mtf_draft, null);
    const forms = (Array.isArray(recent) ? recent : []).map(r => Object.assign({ kind: 'recent' }, flat(r)))
      .concat((Array.isArray(outbox) ? outbox : []).map(r => Object.assign({ kind: 'outbox' }, flat(r))));
    if (draft) forms.push(Object.assign({ kind: 'draft' }, flat(draft)));
    const biz = parseMaybe(backup.data.raw.mt_biz, {});
    const settings = [];
    (function walk(obj, prefix) {
      if (!obj || typeof obj !== 'object') { settings.push({ key: prefix, value: obj == null ? '' : obj }); return; }
      if (Array.isArray(obj)) { settings.push({ key: prefix, value: JSON.stringify(obj) }); return; }
      Object.keys(obj).forEach(k => {
        if (k === 'logoData') { settings.push({ key: (prefix ? prefix + '.' : '') + 'logo_included', value: obj[k] ? 'yes' : 'no' }); return; }
        walk(obj[k], prefix ? prefix + '.' + k : k);
      });
    })(biz, '');
    const leadCols = colsOf(leads, LEAD_FIELDS);
    const importRows = (Array.isArray(parseMaybe(backup.data.raw.mt_imports, [])) ? parseMaybe(backup.data.raw.mt_imports, []) : []).map(r => ({
      id: r.id || '', created: r.created || '', file: r.file || '', name: r.name || '', phone: r.phone || '',
      contacts: (r.contacts || []).map(c => [c.name, c.phone].filter(Boolean).join(' ')).join(' | '),
      has_image: r.image ? 'yes' : 'no', text_reading: r.ocr || ''
    }));
    return [
      { name: 'README.txt', text: readme(backup) },
      { name: 'backup.json', text: JSON.stringify(backup, null, 2) },
      { name: 'leads.csv', text: toCsv(leads, leadCols) },
      { name: 'jobs.csv', text: toCsv(jobs, ['lead_id', 'lead_name', 'job_id', 'type', 'start', 'mins', 'note', 'done']) },
      { name: 'follow-ups.csv', text: toCsv(follow, ['lead_id', 'name', 'pack', 'stage', 'next_step', 'next_date', 'appt']) },
      { name: 'notes.csv', text: toCsv(notes, ['lead_id', 'lead_name', 'pack', 'index', 'text']) },
      { name: 'energy-checks.csv', text: toCsv(checks, colsOf(checks, ['check_id', 'lead_id', 'ts', 'first', 'mobile', 'email', 'street', 'apt', 'city', 'state', 'zip', 'utility', 'result', 'score', 'green_button_filename', 'green_button_url', 'rep'])) },
      { name: 'documents.csv', text: toCsv(docs, colsOf(docs, ['id', 'lead_id', 'formId', 'title', 'total', 'ts'])) },
      { name: 'forms.csv', text: toCsv(forms, colsOf(forms, ['kind', 'id', 'title', 'customer', 'phone', 'email', 'total', 'status', 'leadId', 'has_pdf', 'pdf_bytes'])) },
      { name: 'settings.csv', text: toCsv(settings, ['key', 'value']) },
      { name: 'imported-records.csv', text: toCsv(importRows, ['id', 'created', 'file', 'name', 'phone', 'contacts', 'has_image', 'text_reading']) }
    ];
  }
  function buildArchive() {
    const backup = buildBackup();
    const files = packageFiles(backup);
    const bytes = zipStore(files);
    const blob = new Blob([bytes], { type: 'application/zip' });
    let day = '';
    try { day = window.CRM && CRM.today ? CRM.today() : ''; } catch (e) {}
    if (!day) day = new Date().toISOString().slice(0, 10);
    return { name: 'shop-backup-' + day + '.zip', blob: blob, bytes: bytes, backup: backup, files: files };
  }
  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function downloadEverything() {
    const btn = document.querySelector('[data-port-dl]');
    if (btn) { btn.disabled = true; }
    try {
      const archive = buildArchive();
      PORT.lastArchive = archive;
      saveBlob(archive.blob, archive.name);
      markDownloaded(archive.backup.checksum);
      if (btn) btn.disabled = false;
      refresh();
      notify('Download started. Keep the file somewhere that is not this phone.');
      return archive;
    } catch (e) {
      if (btn) btn.disabled = false;
      notify('Could not build the backup.');
      return { ok: false, error: String(e && e.message || e) };
    }
  }

  /* ---------- restore screen ---------- */
  let root, bodyEl;
  function ensure() {
    if (root) return;
    const style = document.createElement('style');
    style.textContent = '#portBanner{margin:0 0 10px;padding:12px 14px;border-radius:16px;background:#FFF8E6;border:1.5px solid #F5D78A;color:#5a4300;font-size:15px}#portBanner b{display:block;margin-bottom:2px}#portBanner .btn{height:44px;margin-top:10px}#portBanner.fresh{background:#ECFDF3;border-color:#86EFAC;color:#14532D}#portBanner.sync-fail{background:#FEF2F2;border-color:#FECACA;color:#7F1D1D}#portBanner.empty{background:#fff;border:1.5px solid var(--line);color:var(--ink2)}#v-today.fit #portBanner,#v-x.fit #portBanner{flex:none}.port-screen{position:fixed;inset:0;z-index:80;background:var(--bg);overflow:auto;padding:calc(12px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom))}.port-screen[hidden]{display:none}.port-in{max-width:520px;margin:0 auto}.port-top{display:flex;align-items:center;gap:8px;margin-bottom:8px}.port-top h2{margin:0;font-size:22px;letter-spacing:-.02em}.port-presets{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 12px}.port-presets .chip{height:auto;min-height:38px;white-space:normal;text-align:left;padding:8px 12px;line-height:1.25}.unver{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;background:#FEF3C7;color:#92400E;border-radius:99px;padding:2px 8px}.port-screen .maprow{margin:0 0 10px}.port-screen select{width:100%;min-height:44px;border-radius:12px;border:1.5px solid var(--line);padding:8px 10px;font:inherit;background:#fff}#portDup button{height:auto;min-height:44px;white-space:normal;line-height:1.25;padding:8px 12px}.port-shot{display:flex;gap:12px;align-items:flex-start}.port-shot img{width:84px;height:84px;object-fit:cover;border-radius:12px;background:#eef1f6;flex:none}.port-screen .fld input{width:100%;min-height:44px;border-radius:12px;border:1.5px solid var(--line);padding:8px 10px;font:inherit;background:#fff}.port-fullimg{width:100%;border-radius:16px;background:#fff}';
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = 'portScreen';
    root.className = 'port-screen';
    root.hidden = true;
    root.innerHTML = '<div class="port-in"><div class="port-top"><button type="button" class="btn soft" id="portBack" style="height:40px;padding:0 12px">Back</button><h2 id="portTitle"></h2></div><div id="portBody"></div></div>';
    document.body.appendChild(root);
    bodyEl = root.querySelector('#portBody');
    root.querySelector('#portBack').onclick = closeScreen;
  }
  function closeScreen() { if (!root) return; root.hidden = true; }
  function openScreen(title, html, bind) {
    ensure();
    root.hidden = false;
    root.querySelector('#portTitle').textContent = title;
    bodyEl.innerHTML = html;
    root.scrollTop = 0;
    if (bind) bind(bodyEl);
  }
  function brief(v) {
    if (v == null) return '';
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > 90 ? s.slice(0, 87) + '...' : s;
  }
  function countBlock(title, c) {
    return '<div class="card"><b>' + esc(title) + '</b><div class="meta2" style="margin-top:6px">' +
      [c.leads + ' leads', c.jobs + ' jobs', c.followups + ' follow-ups', c.notes + ' notes', c.checks + ' energy checks', c.documents + ' documents', c.forms + ' form records', (c.imports || 0) + ' imported screenshots'].join(' · ') +
      '</div><div class="meta2">Trades: ' + esc(tradeLine(c)) + '</div></div>';
  }
  function showRestore(backup) {
    let parsed = backup;
    if (typeof backup === 'string') { try { parsed = JSON.parse(backup); } catch (e) { parsed = null; } }
    const p = preview(parsed);
    if (!p.ok) {
      const msg = p.error === 'version' ? 'This backup is version ' + (p.version == null ? '?' : p.version) + '. This app reads version 1. Nothing was changed.'
        : p.error === 'checksum' ? 'This backup looks damaged. The checksum does not match, so nothing was changed.'
        : 'That file is not a backup this app can read. Nothing was changed.';
      openScreen('Restore from backup', '<div class="card"><b>Cannot restore this file</b><p class="meta2">' + esc(msg) + '</p></div><button class="btn soft full" type="button" data-port-action="cancel">Close</button>', el => {
        el.querySelector('[data-port-action="cancel"]').onclick = closeScreen;
      });
      return p;
    }
    const rm = p.replace;
    const conflictRows = p.conflicts.slice(0, 8).map(c => '<div class="meta2">' + esc((c.name || c.entity) + (c.field ? ' · ' + c.field : '') + ': kept ' + (c.kept === 'both' ? 'both' : c.kept === 'file' ? 'the file' : 'this phone')) + (c.kept === 'both' ? '' : ' · phone "' + brief(c.phone) + '" · file "' + brief(c.file) + '"') + '</div>').join('');
    const html = '<p class="meta2">This is a copy from this phone, not a server backup. ' + esc(p.exportedAt ? 'File date ' + p.exportedAt + '. ' : '') + 'Nothing changes until you choose merge or replace.</p>' +
      countBlock('In the file', p.counts.file) + countBlock('On this phone now', p.counts.phone) +
      '<div class="card"><b>Left out of the file</b>' + (p.omissions.length ? p.omissions.map(o => '<p class="meta2">' + esc(o.text) + '</p>').join('') : '<p class="meta2">Nothing else was flagged.</p>') +
      '<p class="meta2">Reconnect after a restore: ' + esc((p.reconnect || []).join(', ')) + '. The Sheet link, PIN and sign-in stay on this phone either way. They are not in the file.</p></div>' +
      '<div class="card"><b>Merge</b><p class="meta2">Adds ' + rm.onlyFile.length + ' lead' + (rm.onlyFile.length === 1 ? '' : 's') + ' from the file. Keeps ' + rm.onlyPhone.length + ' lead' + (rm.onlyPhone.length === 1 ? '' : 's') + ' that are only on this phone. ' + p.conflicts.length + ' conflict' + (p.conflicts.length === 1 ? '' : 's') + '. Empty fields get filled. A filled field stays unless the file\'s copy is newer. Notes from both sides are kept.</p>' +
      (conflictRows || '<p class="meta2">No field conflicts.</p>') + (p.conflicts.length > 8 ? '<p class="meta2">And ' + (p.conflicts.length - 8) + ' more.</p>' : '') + '</div>' +
      '<div class="card"><b>Replace</b><p class="meta2">Makes this phone\'s business data match the file. Removes ' + rm.onlyPhone.length + ' lead' + (rm.onlyPhone.length === 1 ? '' : 's') + ' that are not in the file' + (rm.onlyPhone.length ? ': ' + esc(rm.onlyPhone.slice(0, 6).map(l => l.name).join(', ')) : '') + '. Adds ' + rm.onlyFile.length + '.</p></div>' +
      '<button class="btn pri full tap" type="button" data-port-action="merge">Merge into this phone</button>' +
      '<button class="btn soft full tap" type="button" data-port-action="replace" style="margin-top:8px">Replace this phone\'s copy</button>' +
      '<button class="linkbtn" type="button" data-port-action="cancel" style="display:block;margin:12px auto 0">Cancel</button>';
    openScreen('Restore from backup', html, el => {
      el.querySelector('[data-port-action="cancel"]').onclick = closeScreen;
      el.querySelector('[data-port-action="merge"]').onclick = () => apply(parsed, 'merge');
      el.querySelector('[data-port-action="replace"]').onclick = () => apply(parsed, 'replace');
    });
    return p;
  }
  async function openBackup(e) {
    const file = e.target && e.target.files && e.target.files[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let backup;
      if (/\.zip$/i.test(file.name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
        const files = unzip(buf);
        const entry = files.find(f => /backup\.json$/i.test(f.name));
        if (!entry) { showRestore('{'); return; }
        backup = JSON.parse(entry.text);
      } else backup = JSON.parse(new TextDecoder().decode(buf));
      showRestore(backup);
    } catch (err) { showRestore('{'); }
  }

  /* ---------- CSV mapping ---------- */
  function normHead(h) { return String(h || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function fieldChoices() {
    const extra = [];
    try {
      (MT.allPacks ? MT.allPacks() : []).forEach(p => (p.fields || []).forEach(f => { if (f && f.id && !extra.some(x => x[0] === f.id)) extra.push([f.id, (p.name ? p.name + ' · ' : '') + (f.label || f.id)]); }));
    } catch (e) {}
    return BASE_FIELDS.slice(0, -2).concat(extra).concat(BASE_FIELDS.slice(-2));
  }
  function scorePreset(p, headers) {
    const set = new Set(headers.map(normHead));
    let s = 0;
    Object.keys(p.headers).forEach(h => { if (set.has(h)) s += (p.weight && p.weight[h]) || 1; });
    return s;
  }
  function guessPreset(headers) {
    let best = null, bestS = 0, second = 0;
    PRESETS.forEach(p => { const s = scorePreset(p, headers); if (s > bestS) { second = bestS; bestS = s; best = p; } else if (s > second) second = s; });
    if (best && bestS >= 4 && bestS > second) return best.id;
    const app = PRESETS[0];
    if (scorePreset(app, headers) >= 4) return 'app';
    return '';
  }
  function mappingFor(headers, presetId) {
    const p = PRESETS.find(x => x.id === presetId);
    const choices = fieldChoices();
    return headers.map(h => {
      const n = normHead(h);
      if (p && p.headers[n]) return p.headers[n];
      const hit = choices.find(f => f[0] !== 'extra' && f[0] !== 'skip' && (normHead(f[0]) === n || normHead(f[1]) === n));
      return hit ? hit[0] : 'extra';
    });
  }
  function parseCsv(text) {
    let t = String(text || '').replace(/^\uFEFF/, '');
    const sample = t.slice(0, 8000);
    const commas = (sample.match(/,/g) || []).length, semis = (sample.match(/;/g) || []).length, tabs = (sample.match(/\t/g) || []).length;
    const delim = tabs > commas && tabs > semis ? '\t' : semis > commas ? ';' : ',';
    const rows = [];
    let row = [], field = '', q = false, malformed = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) {
        if (ch === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"') { if (field === '') q = true; else field += ch; }
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && t[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (q) malformed = true;
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return { rows: rows.filter(r => r.some(v => String(v).trim() !== '')), delim: delim, malformed: malformed };
  }
  function stripFormula(s) { return (s.length > 1 && s[0] === "'" && /^[=+\-@]/.test(s[1])) ? s.slice(1) : s; }
  function defaultPack() {
    try {
      if (MT.lens && MT.lens() !== 'all') return MT.lens();
      if (MT.primary) return MT.primary();
    } catch (e) {}
    return 'solar';
  }
  function packFrom(v) {
    const id = String(v || '').trim().toLowerCase();
    if (!id) return defaultPack();
    try {
      const packs = MT.allPacks ? MT.allPacks() : [];
      const hit = packs.find(p => p.id === id || String(p.name || '').toLowerCase() === id);
      if (hit) return hit.id;
    } catch (e) {}
    return defaultPack();
  }
  function stageFrom(pk, st) {
    const raw = String(st || '').trim();
    if (!raw) return { stage: 'New', original: '' };
    let flow = ['New', 'Contacted', 'Booked', 'Showed', 'Proposal', 'Won'];
    try { flow = (typeof flowOf === 'function' ? flowOf(pk) : (MT.pack(pk).flow || flow)).concat(['Nurture', 'Lost']); } catch (e) { flow = flow.concat(['Nurture', 'Lost']); }
    const hit = flow.find(s => s.toLowerCase() === raw.toLowerCase());
    return { stage: hit || 'New', original: hit ? '' : raw };
  }
  function joinAddr(street, street2, city, state, zip) {
    const line = [street, street2].filter(Boolean).join(', ');
    const region = [state, zip].filter(Boolean).join(' ');
    const cityLine = [city, region].filter(Boolean).join(', ');
    return [line, cityLine].filter(Boolean).join(', ');
  }
  function newId() { return 'L-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function rowToLead(cells, headers, mapping) {
    const bag = {}, extra = {};
    headers.forEach((h, i) => {
      const dest = mapping[i] || 'extra';
      const val = stripFormula(cells[i] == null ? '' : String(cells[i]).trim());
      if (!val || dest === 'skip') return;
      if (dest === 'extra') { extra[h] = val; return; }
      (bag[dest] || (bag[dest] = [])).push(val);
    });
    const one = f => (bag[f] && bag[f][0]) || '';
    (bag.phone || []).slice(1).forEach((v, i) => { extra['Other phone ' + (i + 1)] = v; });
    let name = one('name');
    const first = one('first'), last = one('last'), company = one('company');
    if (!name && (first || last)) name = [first, last].filter(Boolean).join(' ');
    if (!name && company) name = company;
    if (company && name !== company) extra.Company = company;
    let address = one('address');
    if (!address) address = joinAddr(one('street'), one('street2'), one('city'), one('state'), one('zip'));
    const pk = packFrom(one('pack'));
    const st = stageFrom(pk, one('stage'));
    if (st.original) extra['Original status'] = st.original;
    let consent = '';
    const cons = one('consent');
    if (cons) {
      if (/^yes,/i.test(cons)) consent = cons;
      else if (/^(y|yes|true|1)\b/i.test(cons)) consent = 'Yes, imported: ' + cons;
      else consent = cons;
    }
    let jobs = null;
    if (one('jobs')) { try { const j = JSON.parse(one('jobs')); if (Array.isArray(j)) jobs = j; else extra.Jobs = one('jobs'); } catch (e) { extra.Jobs = one('jobs'); } }
    const lead = {
      id: one('id') || newId(), pack: pk, name: name, phone: one('phone'), email: one('email'), address: address,
      need: one('need'), source: one('source') || 'csv import', stage: st.stage, notes: one('notes'),
      consent: consent, owner_renter: one('owner_renter'), next_step: one('next_step'), next_date: one('next_date'),
      appt: one('appt'), outcome: one('outcome'), created: one('created'), updated: one('updated'), rep: one('rep'),
      external_id: one('external_id')
    };
    if (jobs) lead.jobs = jobs;
    Object.keys(bag).forEach(k => { if (lead[k] == null && bag[k] && bag[k][0] && ['first', 'last', 'company', 'street', 'street2', 'city', 'state', 'zip', 'stage', 'jobs'].indexOf(k) < 0) lead[k] = bag[k][0]; });
    if (Object.keys(extra).length) lead.import_extra = extra;
    ['created', 'updated', 'need', 'source', 'notes', 'consent', 'rep', 'external_id', 'owner_renter', 'next_step', 'next_date', 'appt', 'outcome'].forEach(k => { if (!lead[k]) delete lead[k]; });
    return { lead: lead, invalid: !lead.name && !lead.phone && !lead.email };
  }
  function fillLead(old, incoming, conflicts) {
    const out = Object.assign({}, old);
    Object.keys(incoming).forEach(k => {
      if (k === 'id') return;
      if (k === 'notes') { out.notes = noteUnion(old.notes, incoming.notes); return; }
      if (k === 'jobs') { out.jobs = mergeJobs(old.jobs, incoming.jobs, false, conflicts, old.id); if (!out.jobs.length) delete out.jobs; return; }
      if (k === 'import_extra') { out.import_extra = Object.assign({}, old.import_extra || {}, incoming.import_extra || {}); return; }
      if (isEmpty(incoming[k])) return;
      if (isEmpty(old[k])) { out[k] = incoming[k]; return; }
      if (canon(old[k]) !== canon(incoming[k])) conflicts.push({ entity: 'lead', id: old.id, name: old.name || incoming.name || '', field: k, phone: old[k], file: incoming[k], kept: 'phone' });
    });
    out.updated = pickLater(old.updated, incoming.updated) || old.updated;
    return out;
  }
  function planImport(text, opts) {
    opts = opts || {};
    const parsed = parseCsv(text);
    const headers = (parsed.rows[0] || []).map(h => String(h).replace(/^\uFEFF/, '').trim());
    const preset = opts.preset != null ? opts.preset : guessPreset(headers);
    const mapping = opts.mapping || mappingFor(headers, preset);
    const policy = opts.policy || 'merge';
    const current = parseMaybe(localStorage.getItem('mt_crm'), { leads: {} });
    const leads = Object.assign({}, current.leads || {});
    const by = indexContacts(leads);
    const ops = [], rejected = [], conflicts = [];
    parsed.rows.slice(1).forEach((cells, i) => {
      const built = rowToLead(cells, headers, mapping);
      const row = i + 2;
      if (built.invalid) { rejected.push({ row: row, reason: 'No name, phone or email' }); return; }
      let target = leads[built.lead.id] ? built.lead.id : findContact(by, built.lead);
      if (policy === 'create') target = '';
      if (target && policy === 'skip') { ops.push({ type: 'skip', row: row, id: target, lead: leads[target] }); return; }
      if (target && policy === 'merge') {
        const merged = fillLead(leads[target], Object.assign({}, built.lead, { id: target }), conflicts);
        leads[target] = merged; remember(by, merged);
        ops.push({ type: 'merge', row: row, id: target, lead: merged });
        return;
      }
      const lead = Object.assign({}, built.lead);
      if (!lead.id || leads[lead.id] || policy === 'create') lead.id = newId();
      leads[lead.id] = lead; remember(by, lead);
      ops.push({ type: 'create', row: row, id: lead.id, lead: lead });
    });
    const kept = [], skippedCols = [];
    headers.forEach((h, i) => { if ((mapping[i] || 'extra') === 'extra') kept.push(h); if (mapping[i] === 'skip') skippedCols.push(h); });
    return {
      headers: headers, mapping: mapping, preset: preset, policy: policy, delim: parsed.delim, malformed: parsed.malformed,
      ops: ops, rejected: rejected, conflicts: conflicts, kept: kept, skippedCols: skippedCols,
      preview: ops.filter(o => o.type !== 'skip').slice(0, 5),
      counts: { rows: Math.max(0, parsed.rows.length - 1), create: ops.filter(o => o.type === 'create').length, merge: ops.filter(o => o.type === 'merge').length, skip: ops.filter(o => o.type === 'skip').length, rejected: rejected.length }
    };
  }
  function commitImport(text, opts) {
    const plan = planImport(text, opts);
    const prev = localStorage.getItem('mt_crm');
    const d = parseMaybe(prev, { leads: {}, queue: [], checks: [], docs: [], last: '' });
    d.leads = d.leads || {}; d.queue = d.queue || []; d.checks = d.checks || []; d.docs = d.docs || [];
    plan.ops.forEach(op => {
      if (op.type === 'skip') return;
      d.leads[op.id] = op.lead;
      const solar = (op.lead.pack || 'solar') === 'solar';
      if (solar && op.type === 'create') d.queue.push({ op: 'add', lead: op.lead });
      if (solar && op.type === 'merge') d.queue.push({ op: 'update', id: op.id, fields: { name: op.lead.name || '' } });
    });
    try {
      localStorage.setItem('mt_port_undo', JSON.stringify({ at: Date.now(), kind: 'import', keys: { mt_crm: prev } }));
      if (window.CRM && CRM.put) CRM.put(d); else localStorage.setItem('mt_crm', JSON.stringify(d));
    } catch (e) {
      try { if (prev == null) localStorage.removeItem('mt_crm'); else localStorage.setItem('mt_crm', prev); localStorage.removeItem('mt_port_undo'); } catch (e2) {}
      return { ok: false, error: isQuota(e) ? 'quota' : 'write', plan: plan, message: 'This phone is full, so nothing was imported.' };
    }
    try { if (window.CRM && CRM.render) CRM.render(); if (window.CRM && CRM.sync) CRM.sync(); } catch (e) {}
    notify(plan.counts.create + ' added, ' + plan.counts.merge + ' merged.', undo);
    return { ok: true, plan: plan };
  }

  let csvState = null;
  function mapperHtml(plan) {
    const preset = PRESETS.find(p => p.id === plan.preset);
    const choices = fieldChoices();
    const chips = PRESETS.map(p => '<button type="button" class="chip' + (p.id === plan.preset ? ' on' : '') + '" data-preset="' + p.id + '">' + esc(p.name) + (p.unverified ? ' · Unverified' : '') + '</button>').join('');
    const rows = plan.headers.map((h, i) => {
      const sample = (plan.sample && plan.sample[i]) || '';
      return '<div class="fld maprow"><label>' + esc(h || '(blank header)') + '</label><select data-col="' + i + '">' + choices.map(f => '<option value="' + esc(f[0]) + '"' + (plan.mapping[i] === f[0] ? ' selected' : '') + '>' + esc(f[1]) + '</option>').join('') + '</select>' + (sample ? '<div class="meta2">' + esc(sample) + '</div>' : '') + '</div>';
    }).join('');
    const prev = plan.preview.map(op => '<div class="card" style="padding:12px"><b>' + esc(op.lead.name || 'No name') + '</b><div class="meta2">' + esc([op.lead.phone, op.lead.email, op.lead.address].filter(Boolean).join(' · ')) + '</div><div class="meta2">' + esc((op.type === 'merge' ? 'Merge into existing · ' : 'Add · ') + (op.lead.pack || '') + ' · ' + (op.lead.stage || '')) + '</div></div>').join('');
    return '<p class="meta2">Match each column, check five rows, then import. Nothing is written until you tap Import. If the old list is only on the screen, <button type="button" class="linkbtn" id="bringFromCsv">bring screenshots</button>. Each picture is kept.</p>' +
      (plan.malformed ? '<p class="err">This file has an unclosed quote. Check the last row before you import.</p>' : '') +
      '<div class="sec">Preset</div><div class="port-presets" id="portPresets">' + chips + '</div>' +
      (preset && preset.unverified ? '<p class="meta2"><span class="unver">Unverified</span> ' + esc(preset.blurb) + '</p>' : (preset ? '<p class="meta2">' + esc(preset.blurb) + '</p>' : '<p class="meta2">No preset matched. Map the columns yourself. Unknown columns are kept on the lead.</p>')) +
      '<div class="sec">Preview</div>' + (prev || '<div class="card"><b>No rows to add</b></div>') +
      '<p class="meta2">' + plan.counts.rows + ' rows · ' + plan.counts.create + ' to add · ' + plan.counts.merge + ' to merge · ' + plan.counts.skip + ' duplicates skipped · ' + plan.counts.rejected + ' rows rejected.</p>' +
      (plan.rejected.slice(0, 6).map(r => '<p class="meta2">Row ' + r.row + ' skipped: ' + esc(r.reason) + '</p>').join('')) +
      (plan.kept.length ? '<p class="meta2">Kept on the lead, not mapped to a field: ' + esc(plan.kept.join(', ')) + '</p>' : '') +
      (plan.skippedCols.length ? '<p class="meta2">Columns you set to skip: ' + esc(plan.skippedCols.join(', ')) + '</p>' : '') +
      '<div class="sec">Duplicates</div><div class="seg" id="portDup"><button type="button" data-pol="merge"' + (plan.policy === 'merge' ? ' class="on"' : '') + '>Merge, don\'t overwrite</button><button type="button" data-pol="skip"' + (plan.policy === 'skip' ? ' class="on"' : '') + '>Skip duplicates</button><button type="button" data-pol="create"' + (plan.policy === 'create' ? ' class="on"' : '') + '>Create anyway</button></div>' +
      '<p class="meta2">Merge fills empty fields and keeps what this phone already has. A vendor "yes" is not treated as new permission to call or text unless you map that column to Consent.</p>' +
      '<button class="btn pri full tap" type="button" id="portImport" style="margin-top:12px">Import</button>' +
      '<div class="sec">Columns</div><div class="card">' + rows + '</div>';
  }
  function readMapper(el) {
    const mapping = csvState.plan.headers.map((h, i) => { const s = el.querySelector('select[data-col="' + i + '"]'); return s ? s.value : 'extra'; });
    const pol = (el.querySelector('#portDup .on') || {}).dataset;
    return { mapping: mapping, policy: (pol && pol.pol) || csvState.plan.policy, preset: csvState.preset };
  }
  function paintMapper() {
    const plan = csvState.plan;
    plan.sample = (csvState.sample || []).slice();
    openScreen('Import a CSV', mapperHtml(plan), el => {
      el.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => {
        csvState.preset = b.dataset.preset;
        csvState.plan = planImport(csvState.text, { preset: csvState.preset, policy: csvState.plan.policy });
        paintMapper();
      });
      el.querySelectorAll('#portDup [data-pol]').forEach(b => b.onclick = () => {
        const cur = readMapper(el);
        csvState.plan = planImport(csvState.text, { preset: csvState.preset, mapping: cur.mapping, policy: b.dataset.pol });
        paintMapper();
      });
      el.querySelectorAll('select[data-col]').forEach(s => s.onchange = () => {
        const cur = readMapper(el);
        csvState.preset = '';
        csvState.plan = planImport(csvState.text, { preset: '', mapping: cur.mapping, policy: cur.policy });
        paintMapper();
      });
      const fromShot = el.querySelector('#bringFromCsv');
      if (fromShot) fromShot.onclick = () => showBringShots();
      el.querySelector('#portImport').onclick = () => {
        const cur = readMapper(el);
        const res = commitImport(csvState.text, { preset: csvState.preset, mapping: cur.mapping, policy: cur.policy });
        if (!res.ok) { notify(res.message || 'Nothing was imported.'); return; }
        const c = res.plan.counts;
        openScreen('Import finished', '<div class="card"><b>' + c.create + ' added, ' + c.merge + ' merged</b><p class="meta2">' + c.skip + ' duplicates skipped. ' + c.rejected + ' rows rejected.</p></div><button class="btn soft full" type="button" id="portUndo">Undo this import</button><button class="btn pri full" type="button" id="portDone" style="margin-top:8px">Done</button>', box => {
          box.querySelector('#portUndo').onclick = () => { undo(); closeScreen(); };
          box.querySelector('#portDone').onclick = closeScreen;
        });
      };
    });
  }
  function showMapper(text, name) {
    csvState = { text: text, name: name || '', preset: null, plan: null, sample: [] };
    const first = parseCsv(text);
    csvState.sample = (first.rows[1] || []).map(v => String(v).replace(/\s+/g, ' ').slice(0, 80));
    const preset = guessPreset(first.rows[0] || []);
    csvState.preset = preset;
    csvState.plan = planImport(text, { preset: preset, policy: 'merge' });
    paintMapper();
    return csvState.plan;
  }
  async function openCsv(e) {
    const file = e.target && e.target.files && e.target.files[0];
    if (e.target) e.target.value = '';
    if (!file) return;
    const text = await file.text();
    if (/kec-crm-backup/.test(text.slice(0, 400)) && /^\s*\{/.test(text)) {
      try { showRestore(JSON.parse(text)); return; } catch (err) {}
    }
    showMapper(text, file.name);
  }

  /* ---------- screenshots from another app ---------- */
  function mergedImports(phoneRaw, fileRaw) {
    if (phoneRaw == null && fileRaw == null) return null;
    const out = [], seen = new Set();
    [phoneRaw, fileRaw].forEach(raw => {
      const list = parseMaybe(raw, []);
      (Array.isArray(list) ? list : []).forEach(rec => {
        if (!rec || seen.has(rec.id)) return;
        seen.add(rec.id);
        out.push(rec);
      });
    });
    return JSON.stringify(out);
  }
  function loadImports() {
    const v = parseMaybe(localStorage.getItem('mt_imports'), []);
    return Array.isArray(v) ? v : [];
  }
  function saveImports(arr) {
    const prev = localStorage.getItem('mt_imports');
    try { localStorage.setItem('mt_imports', JSON.stringify(arr)); return { ok: true }; }
    catch (e) {
      try { if (prev == null) localStorage.removeItem('mt_imports'); else localStorage.setItem('mt_imports', prev); } catch (e2) {}
      return { ok: false, error: isQuota(e) ? 'quota' : 'write' };
    }
  }
  function looksLikeName(s) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    if (t.length < 2 || t.length > 60) return false;
    if (/^(customer|customers|client|clients|name|phone|mobile|email|address|list|total|balance|job|jobs|date|status|notes|invoice)$/i.test(t)) return false;
    if (/\d{3,}/.test(t)) return false;
    const words = t.split(' ');
    if (words.length > 5) return false;
    return /^[\p{L}][\p{L}'’.\- ]+$/u.test(t);
  }
  function findPhone(line) {
    const m = String(line || '').match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]*)\d{3}[\s.-]*\d{4}/);
    if (!m) return '';
    const d = digits(m[0]);
    if (d.length < 10 || d.length > 11) return '';
    return m[0].trim();
  }
  function readContacts(text) {
    const lines = String(text || '').split(/\n/).map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const out = [], seen = new Set();
    lines.forEach((line, i) => {
      const phone = findPhone(line);
      if (!phone) return;
      const d = digits(phone);
      if (seen.has(d)) return;
      seen.add(d);
      let name = line.replace(phone, '').replace(/[|·,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (!looksLikeName(name) && i > 0 && looksLikeName(lines[i - 1]) && !findPhone(lines[i - 1])) name = lines[i - 1];
      if (!looksLikeName(name)) name = '';
      out.push({ name: name, phone: phone });
    });
    return out.slice(0, 40);
  }
  function blobToDataUrl(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ''));
      r.onerror = () => rej(r.error || new Error('read'));
      r.readAsDataURL(blob);
    });
  }
  function shrinkDataUrl(dataUrl) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const max = 1800, scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const w = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const g = canvas.getContext('2d');
        if (!g) return resolve(null);
        g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }
  async function storeImage(file) {
    let dataUrl = '';
    try { dataUrl = await blobToDataUrl(file); } catch (e) { return { ok: false, error: 'read' }; }
    if (!dataUrl.startsWith('data:image/')) return { ok: false, error: 'not-image' };
    if (dataUrl.length <= 1400000) return { ok: true, dataUrl: dataUrl, shrunk: false };
    const small = await shrinkDataUrl(dataUrl);
    if (small && small.startsWith('data:image/') && small.length < dataUrl.length) return { ok: true, dataUrl: small, shrunk: true };
    return { ok: false, error: 'too-big' };
  }
  async function ocrImage(file) {
    const Detector = globalThis.TextDetector;
    if (typeof Detector !== 'function') return { status: 'unavailable', text: '' };
    try {
      const bmp = await createImageBitmap(file);
      let boxes = [];
      try { boxes = await new Detector().detect(bmp); }
      finally { try { bmp.close(); } catch (e) {} }
      const text = (boxes || []).map(b => b && (b.rawValue || '')).filter(Boolean).join('\n');
      return { status: text ? 'beta' : 'empty', text: text };
    } catch (e) { return { status: 'failed', text: '' }; }
  }
  async function addScreenshots(fileList) {
    const files = [...(fileList || [])];
    const list = loadImports();
    const added = [], failed = [];
    for (const file of files) {
      const img = await storeImage(file);
      if (!img.ok) { failed.push({ name: file.name || 'screenshot', error: img.error }); continue; }
      const ocr = await ocrImage(file);
      const contacts = ocr.text ? readContacts(ocr.text) : [];
      const rec = {
        id: 'IR-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        created: new Date().toISOString(),
        file: file.name || 'screenshot',
        image: img.dataUrl,
        shrunk: !!img.shrunk,
        name: contacts[0] ? contacts[0].name : '',
        phone: contacts[0] ? contacts[0].phone : '',
        contacts: contacts,
        ocr: ocr.status,
        list: 'Imported records'
      };
      list.unshift(rec);
      const saved = saveImports(list);
      if (!saved.ok) { list.shift(); failed.push({ name: rec.file, error: saved.error }); break; }
      added.push(rec);
    }
    return { added: added, failed: failed };
  }
  function ocrLine(rec) {
    if (rec.ocr === 'beta') return '<div class="meta2"><span class="unver">Beta</span> Optional text reading filled these in. Check them. The picture is the record.</div>';
    if (rec.ocr === 'empty' || rec.ocr === 'failed') return '<div class="meta2"><span class="unver">Beta</span> Optional text reading did not find a name and phone. The picture is saved.</div>';
    return '<div class="meta2">This phone did not read text from the picture. The picture is saved.</div>';
  }
  function importCards(list) {
    if (!list.length) return '<div class="card"><b>No screenshots yet</b><p class="meta2">Pictures of a customer list from another app land here. The picture is kept, so nothing on that screen is thrown away.</p></div>';
    return list.map(rec => {
      const people = (rec.contacts && rec.contacts.length) ? rec.contacts : [{ name: rec.name || '', phone: rec.phone || '' }];
      return '<article class="card" data-import="' + esc(rec.id) + '"><div class="port-shot"><button type="button" class="port-shot" data-view="' + esc(rec.id) + '" aria-label="Open the screenshot"><img alt="" src="' + esc(rec.image) + '"></button><div><b>' + esc(rec.file || 'Screenshot') + '</b><div class="meta2">Imported records</div>' + ocrLine(rec) + (rec.shrunk ? '<div class="meta2">The picture was large, so this phone kept a smaller copy you can still read.</div>' : '') + '</div></div>' +
        people.map((p, i) => '<div class="frow" style="margin-top:8px"><div class="fld"><label>Name</label><input data-field="name" data-i="' + i + '" value="' + esc(p.name || '') + '" autocomplete="name"></div><div class="fld"><label>Phone</label><input data-field="phone" data-i="' + i + '" value="' + esc(p.phone || '') + '" inputmode="tel" autocomplete="tel"></div></div>').join('') +
        '<button class="linkbtn" type="button" data-drop="' + esc(rec.id) + '">Remove this picture</button></article>';
    }).join('');
  }
  function bindImportCards(el) {
    el.querySelectorAll('[data-import] input').forEach(input => {
      input.onchange = () => {
        const id = input.closest('[data-import]').dataset.import;
        const i = +input.dataset.i;
        const list = loadImports();
        const rec = list.find(r => r.id === id);
        if (!rec) return;
        if (!rec.contacts || !rec.contacts.length) rec.contacts = [{ name: rec.name || '', phone: rec.phone || '' }];
        if (!rec.contacts[i]) rec.contacts[i] = { name: '', phone: '' };
        rec.contacts[i][input.dataset.field] = input.value.trim();
        rec.name = rec.contacts[0].name || '';
        rec.phone = rec.contacts[0].phone || '';
        const saved = saveImports(list);
        if (!saved.ok) notify('Could not save that change.');
      };
    });
    el.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
      const rec = loadImports().find(r => r.id === b.dataset.view);
      if (!rec) return;
      openScreen('Screenshot', '<img class="port-fullimg" alt="Customer list screenshot" src="' + esc(rec.image) + '"><p class="meta2">' + esc(rec.file || '') + '</p><button class="btn soft full" type="button" id="backImports">Back to Imported records</button>', box => {
        box.querySelector('#backImports').onclick = () => showImported();
      });
    });
    el.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => {
      if (!confirm('Remove this picture from Imported records?')) return;
      saveImports(loadImports().filter(r => r.id !== b.dataset.drop));
      showImported();
    });
  }
  function showImported(result) {
    const list = loadImports();
    const fail = result && result.failed && result.failed.length ? '<div class="card"><b>Some pictures were not saved</b>' + result.failed.map(f => '<p class="meta2">' + esc(f.name) + (f.error === 'quota' ? ' did not fit on this phone. Nothing else was changed.' : f.error === 'too-big' ? ' is too big for this phone.' : ' could not be read.') + '</p>').join('') + '</div>' : '';
    const added = result && result.added && result.added.length ? '<p class="meta2">' + result.added.length + ' screenshot' + (result.added.length === 1 ? '' : 's') + ' saved on Imported records.</p>' : '';
    openScreen('Imported records', '<p class="meta2">Pictures brought over from another app. The picture stays attached, so the list on the screen is not lost. <span class="unver">Beta</span> Name and phone reading is optional.</p>' + added + fail + '<div id="importList">' + importCards(list) + '</div><label class="btn pri full tap" style="cursor:pointer;margin-top:8px">Add more screenshots<input id="shotMore" type="file" accept="image/*" multiple hidden></label>', el => {
      bindImportCards(el);
      el.querySelector('#shotMore').onchange = async e => {
        const files = [...(e.target.files || [])];
        e.target.value = '';
        if (!files.length) return;
        showImported(await addScreenshots(files));
      };
    });
  }
  function showBringShots() {
    const n = loadImports().length;
    openScreen('Bring screenshots', '<p class="meta2">A CSV export is the surest way to bring customers over. If the old app will not give you a file, photograph the customer list and bring the pictures. Each picture is saved on Imported records. Nothing in the picture is thrown away.</p><p class="meta2"><span class="unver">Beta</span> Optional. If this phone can read text, it fills in names and phone numbers for you to check. If it cannot, the picture is still saved.</p><label class="btn pri full tap" style="cursor:pointer">Choose screenshots<input id="shotPick" type="file" accept="image/*" multiple hidden></label>' + (n ? '<button class="btn soft full tap" type="button" id="seeImports" style="margin-top:8px">Imported records (' + n + ')</button>' : ''), el => {
      el.querySelector('#shotPick').onchange = async e => {
        const files = [...(e.target.files || [])];
        e.target.value = '';
        if (!files.length) return;
        const res = await addScreenshots(files);
        showImported(res);
      };
      const see = el.querySelector('#seeImports');
      if (see) see.onclick = () => showImported();
    });
  }

  const PORT = {
    version: VERSION, canon: canon, checksum: checksum, collect: collect, counts: countsOf, buildBackup: buildBackup,
    buildArchive: buildArchive, unzip: unzip, verify: verify, preview: preview, apply: apply, undo: undo,
    coverage: coverage, state: coverage, bannerHtml: bannerHtml, bindBanner: bindBanner, downloadEverything: downloadEverything,
    showRestore: showRestore, openBackup: openBackup, parseCsv: parseCsv, presets: PRESETS, planImport: planImport,
    commitImport: commitImport, showMapper: showMapper, openCsv: openCsv, saveBlob: saveBlob,
    readContacts: readContacts, addScreenshots: addScreenshots, showBringShots: showBringShots, showImported: showImported, loadImports: loadImports
  };
  window.PORT = PORT;
})();
